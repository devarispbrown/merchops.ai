/**
 * Worker Entry Point
 *
 * Standalone script to run background job workers.
 * This is the entry point for the worker process in production.
 *
 * Usage: pnpm workers (or tsx server/jobs/worker.ts)
 */

import { startJobSystem } from './index';
import { logger } from '../observability/logger';
import { isRedisConfigured } from './config';

async function main() {
  logger.info('Starting MerchOps worker process...');

  // Check if Redis is configured
  if (!isRedisConfigured()) {
    logger.error(
      'Redis is not configured. Workers require Redis to function. ' +
      'Set REDIS_URL or REDIS_HOST environment variable.'
    );
    process.exit(1);
  }

  try {
    await startJobSystem();
    logger.info('Worker process started successfully. Waiting for jobs...');
  } catch (error) {
    logger.error({ error }, 'Failed to start worker process');
    process.exit(1);
  }
}

main();
