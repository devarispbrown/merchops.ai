/**
 * Shopify Sync Worker
 *
 * Processes initial Shopify data sync and periodic refresh jobs.
 * Fetches products, orders, customers, and inventory from Shopify API
 * and stores them in shopify_objects_cache for event computation.
 */

import { Job, Worker } from 'bullmq';
import { prisma } from '../../db/client';
import { QUEUE_NAMES, redisConnection, defaultWorkerOptions } from '../config';
import {
  createWorkerLogger,
  logJobStart,
  logJobComplete,
  logJobFailed,
} from '../../observability/logger';
import { eventComputeQueue } from '../queues';

// ============================================================================
// TYPES
// ============================================================================

interface ShopifySyncJobData {
  workspace_id: string;
  sync_type: 'initial' | 'refresh' | 'incremental';
  resources?: ('products' | 'orders' | 'customers' | 'inventory')[];
  correlation_id?: string;
}

interface ShopifySyncResult {
  workspace_id: string;
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

export const shopifySyncWorker = new Worker<ShopifySyncJobData, ShopifySyncResult>(
  QUEUE_NAMES.SHOPIFY_SYNC,
  processShopifySync,
  {
    ...defaultWorkerOptions,
    connection: redisConnection,
  }
);

// ============================================================================
// EVENT HANDLERS
// ============================================================================

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
  }
});

shopifySyncWorker.on('error', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Worker error');
});

// ============================================================================
// JOB PROCESSOR
// ============================================================================

async function processShopifySync(
  job: Job<ShopifySyncJobData, ShopifySyncResult>
): Promise<ShopifySyncResult> {
  const startTime = Date.now();
  const { workspace_id, sync_type, resources } = job.data;

  logJobStart(job.id!, job.name!, job.data, workspace_id);

  try {
    // Get Shopify connection
    const connection = await prisma.shopifyConnection.findFirst({
      where: {
        workspace_id,
        status: 'active',
        revoked_at: null,
      },
    });

    if (!connection) {
      throw new Error(`No active Shopify connection found for workspace ${workspace_id}`);
    }

    // Determine which resources to sync
    const resourcesToSync = resources || ['products', 'orders', 'customers', 'inventory'];

    const syncResults = {
      products: 0,
      orders: 0,
      customers: 0,
      inventory_levels: 0,
    };

    // Sync each resource type
    for (const resource of resourcesToSync) {
      logger.info(
        { workspace_id, resource, sync_type },
        `Syncing ${resource} for workspace ${workspace_id}`
      );

      switch (resource) {
        case 'products':
          syncResults.products = await syncProducts(workspace_id, connection.store_domain);
          break;
        case 'orders':
          syncResults.orders = await syncOrders(workspace_id, connection.store_domain);
          break;
        case 'customers':
          syncResults.customers = await syncCustomers(workspace_id, connection.store_domain);
          break;
        case 'inventory':
          syncResults.inventory_levels = await syncInventoryLevels(
            workspace_id,
            connection.store_domain
          );
          break;
      }
    }

    const duration_ms = Date.now() - startTime;

    // After successful sync, trigger event computation
    await eventComputeQueue.add(
      'compute-events',
      {
        workspace_id,
        trigger: 'shopify_sync_completed',
        correlation_id: job.data.correlation_id,
      },
      {
        priority: 5, // High priority
      }
    );

    logger.info(
      { workspace_id, syncResults, duration_ms },
      `Shopify sync completed for workspace ${workspace_id}`
    );

    return {
      workspace_id,
      sync_type,
      synced: syncResults,
      duration_ms,
    };
  } catch (error: any) {
    logger.error(
      {
        workspace_id,
        sync_type,
        error: error.message,
        stack: error.stack,
      },
      'Shopify sync failed'
    );
    throw error;
  }
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Sync products from Shopify
 */
async function syncProducts(workspace_id: string, store_domain: string): Promise<number> {
  // TODO: Integrate with actual Shopify API client
  // For now, this is a stub implementation

  logger.debug({ workspace_id, store_domain }, 'Syncing products from Shopify');

  // Mock data for development
  const mockProducts = generateMockProducts(10);
  let count = 0;

  for (const product of mockProducts) {
    await prisma.shopifyObjectCache.upsert({
      where: {
        workspace_id_object_type_shopify_id: {
          workspace_id,
          object_type: 'product',
          shopify_id: product.id,
        },
      },
      create: {
        workspace_id,
        object_type: 'product',
        shopify_id: product.id,
        data_json: product,
        synced_at: new Date(),
      },
      update: {
        data_json: product,
        synced_at: new Date(),
      },
    });
    count++;
  }

  return count;
}

/**
 * Sync orders from Shopify
 */
async function syncOrders(workspace_id: string, store_domain: string): Promise<number> {
  logger.debug({ workspace_id, store_domain }, 'Syncing orders from Shopify');

  // Mock data for development
  const mockOrders = generateMockOrders(20);
  let count = 0;

  for (const order of mockOrders) {
    await prisma.shopifyObjectCache.upsert({
      where: {
        workspace_id_object_type_shopify_id: {
          workspace_id,
          object_type: 'order',
          shopify_id: order.id,
        },
      },
      create: {
        workspace_id,
        object_type: 'order',
        shopify_id: order.id,
        data_json: order,
        synced_at: new Date(),
      },
      update: {
        data_json: order,
        synced_at: new Date(),
      },
    });
    count++;
  }

  return count;
}

/**
 * Sync customers from Shopify
 */
async function syncCustomers(workspace_id: string, store_domain: string): Promise<number> {
  logger.debug({ workspace_id, store_domain }, 'Syncing customers from Shopify');

  // Mock data for development
  const mockCustomers = generateMockCustomers(15);
  let count = 0;

  for (const customer of mockCustomers) {
    await prisma.shopifyObjectCache.upsert({
      where: {
        workspace_id_object_type_shopify_id: {
          workspace_id,
          object_type: 'customer',
          shopify_id: customer.id,
        },
      },
      create: {
        workspace_id,
        object_type: 'customer',
        shopify_id: customer.id,
        data_json: customer,
        synced_at: new Date(),
      },
      update: {
        data_json: customer,
        synced_at: new Date(),
      },
    });
    count++;
  }

  return count;
}

/**
 * Sync inventory levels from Shopify
 */
async function syncInventoryLevels(workspace_id: string, store_domain: string): Promise<number> {
  logger.debug({ workspace_id, store_domain }, 'Syncing inventory levels from Shopify');

  // Mock data for development
  const mockInventoryLevels = generateMockInventoryLevels(10);
  let count = 0;

  for (const level of mockInventoryLevels) {
    await prisma.shopifyObjectCache.upsert({
      where: {
        workspace_id_object_type_shopify_id: {
          workspace_id,
          object_type: 'inventory_level',
          shopify_id: level.inventory_item_id,
        },
      },
      create: {
        workspace_id,
        object_type: 'inventory_level',
        shopify_id: level.inventory_item_id,
        data_json: level,
        synced_at: new Date(),
      },
      update: {
        data_json: level,
        synced_at: new Date(),
      },
    });
    count++;
  }

  return count;
}

// ============================================================================
// MOCK DATA GENERATORS (for development)
// ============================================================================

function generateMockProducts(count: number): any[] {
  const products = [];
  for (let i = 1; i <= count; i++) {
    products.push({
      id: `product_${i}`,
      title: `Product ${i}`,
      variants: [
        {
          id: `variant_${i}_1`,
          title: 'Default',
          price: (Math.random() * 100 + 10).toFixed(2),
          inventory_item_id: `inv_item_${i}_1`,
          inventory_quantity: Math.floor(Math.random() * 50),
        },
      ],
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }
  return products;
}

function generateMockOrders(count: number): any[] {
  const orders = [];
  for (let i = 1; i <= count; i++) {
    const daysAgo = Math.floor(Math.random() * 60);
    orders.push({
      id: `order_${i}`,
      order_number: 1000 + i,
      customer: {
        id: `customer_${Math.floor(Math.random() * 15) + 1}`,
        email: `customer${i}@example.com`,
      },
      line_items: [
        {
          product_id: `product_${Math.floor(Math.random() * 10) + 1}`,
          variant_id: `variant_${Math.floor(Math.random() * 10) + 1}_1`,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: (Math.random() * 100 + 10).toFixed(2),
        },
      ],
      total_price: (Math.random() * 200 + 20).toFixed(2),
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
      created_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return orders;
}

function generateMockCustomers(count: number): any[] {
  const customers = [];
  for (let i = 1; i <= count; i++) {
    const lastOrderDaysAgo = Math.floor(Math.random() * 120);
    customers.push({
      id: `customer_${i}`,
      email: `customer${i}@example.com`,
      first_name: `First${i}`,
      last_name: `Last${i}`,
      orders_count: Math.floor(Math.random() * 10) + 1,
      total_spent: (Math.random() * 1000 + 50).toFixed(2),
      created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - lastOrderDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return customers;
}

function generateMockInventoryLevels(count: number): any[] {
  const levels = [];
  for (let i = 1; i <= count; i++) {
    levels.push({
      inventory_item_id: `inv_item_${i}_1`,
      location_id: 'location_1',
      available: Math.floor(Math.random() * 50),
      updated_at: new Date().toISOString(),
    });
  }
  return levels;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownShopifySyncWorker(): Promise<void> {
  logger.info('Shutting down Shopify sync worker...');
  await shopifySyncWorker.close();
  logger.info('Shopify sync worker shut down');
}
