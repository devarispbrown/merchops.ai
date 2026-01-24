/**
 * Job Processors
 *
 * Exports all processor functions for enqueueing background jobs.
 * These functions are called from API routes and server actions.
 */

import {
  getShopifySyncQueue,
  getEventComputeQueue,
  getOpportunityGenerateQueue,
  getExecutionQueue,
  getOutcomeComputeQueue,
  QueueUnavailableError,
} from '../queues';
import { JOB_PRIORITIES, QUEUE_NAMES } from '../config';

// ============================================================================
// SHOPIFY SYNC PROCESSORS
// ============================================================================

export interface EnqueueShopifySyncParams {
  workspace_id: string;
  sync_type: 'initial' | 'refresh' | 'incremental';
  resources?: ('products' | 'orders' | 'customers' | 'inventory')[];
  correlation_id?: string;
  priority?: number;
}

export async function enqueueShopifySync(params: EnqueueShopifySyncParams) {
  const { workspace_id, sync_type, resources, correlation_id, priority } = params;

  const queue = getShopifySyncQueue();
  if (!queue) {
    throw new QueueUnavailableError(QUEUE_NAMES.SHOPIFY_SYNC);
  }

  const job = await queue.add(
    `sync-${sync_type}-${workspace_id}`,
    {
      workspace_id,
      sync_type,
      resources,
      correlation_id,
    },
    {
      priority: priority || JOB_PRIORITIES.HIGH,
      jobId: `shopify-sync-${workspace_id}-${Date.now()}`,
    }
  );

  return job;
}

// ============================================================================
// EVENT COMPUTE PROCESSORS
// ============================================================================

export interface EnqueueEventComputeParams {
  workspace_id: string;
  trigger: 'shopify_sync_completed' | 'webhook_received' | 'scheduled';
  event_types?: (
    | 'inventory_threshold'
    | 'out_of_stock'
    | 'back_in_stock'
    | 'velocity_spike'
    | 'customer_inactivity'
  )[];
  correlation_id?: string;
  priority?: number;
}

export async function enqueueEventCompute(params: EnqueueEventComputeParams) {
  const { workspace_id, trigger, event_types, correlation_id, priority } = params;

  const queue = getEventComputeQueue();
  if (!queue) {
    throw new QueueUnavailableError(QUEUE_NAMES.EVENT_COMPUTE);
  }

  const job = await queue.add(
    `compute-events-${workspace_id}`,
    {
      workspace_id,
      trigger,
      event_types,
      correlation_id,
    },
    {
      priority: priority || JOB_PRIORITIES.HIGH,
      jobId: `event-compute-${workspace_id}-${Date.now()}`,
    }
  );

  return job;
}

// ============================================================================
// OPPORTUNITY GENERATE PROCESSORS
// ============================================================================

export interface EnqueueOpportunityGenerateParams {
  workspace_id: string;
  trigger: 'events_computed' | 'manual';
  event_ids?: string[];
  correlation_id?: string;
  priority?: number;
}

export async function enqueueOpportunityGenerate(params: EnqueueOpportunityGenerateParams) {
  const { workspace_id, trigger, event_ids, correlation_id, priority } = params;

  const queue = getOpportunityGenerateQueue();
  if (!queue) {
    throw new QueueUnavailableError(QUEUE_NAMES.OPPORTUNITY_GENERATE);
  }

  const job = await queue.add(
    `generate-opportunities-${workspace_id}`,
    {
      workspace_id,
      trigger,
      event_ids,
      correlation_id,
    },
    {
      priority: priority || JOB_PRIORITIES.NORMAL,
      jobId: `opportunity-generate-${workspace_id}-${Date.now()}`,
    }
  );

  return job;
}

// ============================================================================
// EXECUTION PROCESSORS
// ============================================================================

export interface EnqueueExecutionParams {
  execution_id: string;
  workspace_id: string;
  action_draft_id: string;
  execution_type: string;
  payload: any;
  idempotency_key: string;
  correlation_id?: string;
  priority?: number;
}

export async function enqueueExecution(params: EnqueueExecutionParams) {
  const {
    execution_id,
    workspace_id,
    action_draft_id,
    execution_type,
    payload,
    idempotency_key,
    correlation_id,
    priority,
  } = params;

  const queue = getExecutionQueue();
  if (!queue) {
    throw new QueueUnavailableError(QUEUE_NAMES.EXECUTION);
  }

  const job = await queue.add(
    `execute-${execution_id}`,
    {
      execution_id,
      workspace_id,
      action_draft_id,
      execution_type,
      payload,
      idempotency_key,
      correlation_id,
    },
    {
      priority: priority || JOB_PRIORITIES.CRITICAL,
      jobId: `execution-${execution_id}`,
    }
  );

  return job;
}

// ============================================================================
// OUTCOME COMPUTE PROCESSORS
// ============================================================================

export interface EnqueueOutcomeComputeParams {
  execution_id: string;
  workspace_id: string;
  correlation_id?: string;
  delay_ms?: number;
  priority?: number;
}

export async function enqueueOutcomeCompute(params: EnqueueOutcomeComputeParams) {
  const { execution_id, workspace_id, correlation_id, delay_ms, priority } = params;

  const queue = getOutcomeComputeQueue();
  if (!queue) {
    throw new QueueUnavailableError(QUEUE_NAMES.OUTCOME_COMPUTE);
  }

  const job = await queue.add(
    `compute-outcome-${execution_id}`,
    {
      execution_id,
      workspace_id,
      correlation_id,
    },
    {
      priority: priority || JOB_PRIORITIES.NORMAL,
      delay: delay_ms || 0,
      jobId: `outcome-compute-${execution_id}`,
    }
  );

  return job;
}

// ============================================================================
// BATCH PROCESSORS
// ============================================================================

/**
 * Enqueue batch of event computations for multiple workspaces
 */
export async function enqueueBatchEventCompute(workspace_ids: string[]) {
  const jobs = await Promise.all(
    workspace_ids.map((workspace_id) =>
      enqueueEventCompute({
        workspace_id,
        trigger: 'scheduled',
        priority: JOB_PRIORITIES.NORMAL,
      })
    )
  );

  return jobs;
}

/**
 * Enqueue batch of outcome computations
 */
export async function enqueueBatchOutcomeCompute(execution_ids: string[], workspace_id: string) {
  const jobs = await Promise.all(
    execution_ids.map((execution_id) =>
      enqueueOutcomeCompute({
        execution_id,
        workspace_id,
        priority: JOB_PRIORITIES.LOW,
      })
    )
  );

  return jobs;
}
