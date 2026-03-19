/**
 * Shopify Sync Worker
 *
 * Processes initial Shopify data sync and periodic refresh jobs.
 * Fetches products, orders, customers, and inventory from Shopify API
 * via performInitialSync() and stores them in shopify_objects_cache for
 * event computation.
 *
 * syncState lifecycle on ShopifyConnection:
 *   idle  →  syncing  →  completed   (happy path)
 *   idle  →  syncing  →  failed      (error path; BullMQ retry handles re-queue)
 */

import { Job, Worker } from 'bullmq';
import { prisma } from '../../db/client';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions, isRedisConfigured } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
} from '../../observability/logger';
import { captureJobError } from '../../observability/sentry';
import { getEventComputeQueue } from '../queues';
import { performInitialSync } from '../../shopify/sync';

// ============================================================================
// TYPES
// ============================================================================

interface ShopifySyncJobData {
  workspace_id: string;
  shopify_connection_id: string;
  sync_type: 'initial' | 'refresh' | 'incremental';
  resources?: ('products' | 'orders' | 'customers' | 'inventory')[];
  correlation_id?: string;
}

interface ShopifySyncResult {
  workspace_id: string;
  shopify_connection_id: string;
  sync_type: string;
  synced: {
    products: number;
    orders: number;
    customers: number;
    inventory_levels: number;
  };
  duration_ms: number;
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

const logger = createWorkerLogger('shopify-sync');

// Only create worker if Redis is configured
export const shopifySyncWorker = isRedisConfigured() && redisConnection
  ? new Worker<ShopifySyncJobData, ShopifySyncResult>(
      QUEUE_NAMES.SHOPIFY_SYNC,
      processShopifySync,
      {
        ...defaultWorkerOptions,
        connection: redisConnection,
      }
    )
  : null;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

if (shopifySyncWorker) {
  shopifySyncWorker.on('completed', (job, result) => {
    logJobComplete(job.id!, job.name!, result, result.duration_ms, result.workspace_id);
  });

  shopifySyncWorker.on('failed', (job, error) => {
    if (job) {
      logJobFailed(
        job.id!,
        job.name!,
        error as Error,
        job.attemptsMade,
        job.data.workspace_id
      );
      captureJobError(error as Error, job.name!, job.id!, job.data, job.attemptsMade);
    }
  });

  shopifySyncWorker.on('error', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Worker error');
    captureJobError(error, 'shopify-sync-worker', 'unknown', {}, 0);
  });
} else {
  logger.warn('Shopify sync worker not initialized - Redis not configured');
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

export async function processShopifySync(
  job: Job<ShopifySyncJobData, ShopifySyncResult>
): Promise<ShopifySyncResult> {
  const startTime = Date.now();
  const { workspace_id, shopify_connection_id, sync_type } = job.data;

  logJobStart(job.id!, job.name!, job.data, workspace_id);

  // Mark the connection as actively syncing so callers can poll state
  await setSyncState(shopify_connection_id, 'syncing');

  try {
    // Resolve the active Shopify connection to get store credentials
    const connection = await prisma.shopifyConnection.findFirst({
      where: {
        id: shopify_connection_id,
        workspace_id,
        status: 'active',
        revoked_at: null,
      },
    });

    if (!connection) {
      throw new Error(
        `No active Shopify connection found for workspace ${workspace_id} ` +
        `(connection_id=${shopify_connection_id})`
      );
    }

    logger.info(
      { workspace_id, shopify_connection_id, sync_type },
      'Starting Shopify sync via performInitialSync'
    );

    // Delegate all fetching, pagination, and cache upserts to the real sync module
    const progress = await performInitialSync({
      workspaceId: workspace_id,
      shop: connection.store_domain,
      encryptedToken: connection.access_token_encrypted,
      correlationId: job.data.correlation_id,
    });

    const duration_ms = Date.now() - startTime;

    // Persist success state with a fresh timestamp
    await setSyncState(shopify_connection_id, 'completed', new Date());

    // After a successful sync, trigger downstream event computation
    const eventQueue = getEventComputeQueue();
    if (eventQueue) {
      await eventQueue.add(
        'compute-events',
        {
          workspace_id,
          trigger: 'shopify_sync_completed',
          correlation_id: job.data.correlation_id,
        },
        {
          priority: 5, // High priority — process signals quickly after sync
        }
      );
    }

    logger.info(
      { workspace_id, shopify_connection_id, progress, duration_ms },
      'Shopify sync completed successfully'
    );

    return {
      workspace_id,
      shopify_connection_id,
      sync_type,
      synced: {
        products: progress.products,
        orders: progress.orders,
        customers: progress.customers,
        inventory_levels: progress.inventoryLevels,
      },
      duration_ms,
    };
  } catch (error: any) {
    // Record failure state so operators / health checks can observe it.
    // We deliberately do NOT re-throw inside the state update — if that secondary
    // write fails we still want BullMQ to see the original error and schedule a retry.
    await setSyncState(shopify_connection_id, 'failed').catch((stateErr) => {
      logger.error(
        { workspace_id, shopify_connection_id, stateErr: stateErr.message },
        'Failed to persist failed sync state'
      );
    });

    logger.error(
      {
        workspace_id,
        shopify_connection_id,
        sync_type,
        error: error.message,
        stack: error.stack,
      },
      'Shopify sync failed'
    );

    // Re-throw so BullMQ can apply its retry/backoff policy
    throw error;
  }
}

// ============================================================================
// SYNC STATE HELPERS
// ============================================================================

/**
 * Persist sync progress state (and optionally a completion timestamp) on the
 * ShopifyConnection record identified by `connectionId`.
 */
async function setSyncState(
  connectionId: string,
  state: 'syncing' | 'completed' | 'failed',
  lastSyncedAt?: Date
): Promise<void> {
  await prisma.shopifyConnection.update({
    where: { id: connectionId },
    data: {
      sync_state: state,
      ...(lastSyncedAt !== undefined ? { last_synced_at: lastSyncedAt } : {}),
    },
  });
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownShopifySyncWorker(): Promise<void> {
  if (!shopifySyncWorker) {
    logger.debug('Shopify sync worker not running - nothing to shut down');
    return;
  }
  logger.info('Shutting down Shopify sync worker...');
  await shopifySyncWorker.close();
  logger.info('Shopify sync worker shut down');
}
