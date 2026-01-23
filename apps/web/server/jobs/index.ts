/**
 * Job System Entry Point
 *
 * Initializes all workers and handles graceful shutdown.
 * This file should be imported and started by the main server process.
 */

import { Worker } from 'bullmq';
import { logger } from '../observability/logger';
import { initializeSentry, flushSentry } from '../observability/sentry';
import { shopifySyncWorker, shutdownShopifySyncWorker } from './workers/shopify-sync.worker';
import { eventComputeWorker, shutdownEventComputeWorker } from './workers/event-compute.worker';
import {
  opportunityGenerateWorker,
  shutdownOpportunityGenerateWorker,
} from './workers/opportunity-generate.worker';
import { executionWorker, shutdownExecutionWorker } from './workers/execution.worker';
import { outcomeComputeWorker, shutdownOutcomeComputeWorker } from './workers/outcome-compute.worker';
import { initializeScheduler, removeAllScheduledJobs } from './scheduler';
import { closeAllQueues } from './queues';

/**
 * All active workers
 */
const workers: Worker[] = [];

/**
 * Shutdown flag
 */
let isShuttingDown = false;

/**
 * Start all job workers and scheduler
 */
export async function startJobSystem(): Promise<void> {
  logger.info('Starting MerchOps job system...');

  try {
    // Initialize Sentry for error tracking
    initializeSentry();

    // Store worker references
    workers.push(
      shopifySyncWorker,
      eventComputeWorker,
      opportunityGenerateWorker,
      executionWorker,
      outcomeComputeWorker
    );

    // Initialize scheduler
    await initializeScheduler();

    // Set up graceful shutdown handlers
    setupShutdownHandlers();

    logger.info(
      {
        workersCount: workers.length,
        workers: workers.map((w) => w.name),
      },
      'Job system started successfully'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start job system');
    throw error;
  }
}

/**
 * Stop all job workers and scheduler gracefully
 */
export async function stopJobSystem(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Job system is already shutting down');
    return;
  }

  isShuttingDown = true;
  logger.info('Stopping MerchOps job system...');

  try {
    // Remove scheduled jobs first to prevent new jobs
    await removeAllScheduledJobs();

    // Shut down all workers gracefully
    await Promise.all([
      shutdownShopifySyncWorker(),
      shutdownEventComputeWorker(),
      shutdownOpportunityGenerateWorker(),
      shutdownExecutionWorker(),
      shutdownOutcomeComputeWorker(),
    ]);

    // Close all queue connections
    await closeAllQueues();

    // Flush Sentry events
    await flushSentry();

    logger.info('Job system stopped successfully');
  } catch (error) {
    logger.error({ error }, 'Error during job system shutdown');
    throw error;
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupShutdownHandlers(): void {
  // Handle SIGTERM (e.g., from Docker, Kubernetes)
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await gracefulShutdown('SIGTERM');
  });

  // Handle SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await gracefulShutdown('SIGINT');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'Uncaught exception'
    );

    // Give time to log before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        reason,
        promise,
      },
      'Unhandled promise rejection'
    );
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Starting graceful shutdown');

  try {
    await stopJobSystem();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Get job system health status
 */
export async function getJobSystemHealth(): Promise<{
  healthy: boolean;
  workers: Array<{
    name: string;
    running: boolean;
    isPaused: boolean;
  }>;
}> {
  const workerStatuses = await Promise.all(
    workers.map(async (worker) => {
      try {
        const isPaused = await worker.isPaused();
        const isRunning = worker.isRunning();

        return {
          name: worker.name,
          running: isRunning,
          isPaused,
        };
      } catch (error) {
        logger.error(
          { error, workerName: worker.name },
          'Failed to get worker status'
        );
        return {
          name: worker.name,
          running: false,
          isPaused: false,
        };
      }
    })
  );

  const allHealthy = workerStatuses.every(
    (status) => status.running && !status.isPaused
  );

  return {
    healthy: allHealthy,
    workers: workerStatuses,
  };
}

/**
 * Pause all workers
 */
export async function pauseAllWorkers(): Promise<void> {
  logger.info('Pausing all workers...');

  await Promise.all(workers.map((worker) => worker.pause()));

  logger.info('All workers paused');
}

/**
 * Resume all workers
 */
export async function resumeAllWorkers(): Promise<void> {
  logger.info('Resuming all workers...');

  await Promise.all(workers.map((worker) => worker.resume()));

  logger.info('All workers resumed');
}

/**
 * Get worker by name
 */
export function getWorkerByName(name: string): Worker | undefined {
  return workers.find((worker) => worker.name === name);
}

/**
 * Get all workers
 */
export function getAllWorkers(): Worker[] {
  return workers;
}

/**
 * Check if job system is shutting down
 */
export function isJobSystemShuttingDown(): boolean {
  return isShuttingDown;
}

// Export for testing
export const __testing__ = {
  setupShutdownHandlers,
  gracefulShutdown,
};
