/**
 * Playwright Global Teardown
 * MerchOps Beta MVP - E2E Test Global Teardown
 *
 * Runs once after all E2E tests to:
 * - Clean up test data (if database available)
 * - Close database connections
 * - Report test summary
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  console.log('\n🧹 Global E2E Teardown: Cleaning up test environment...\n');

  // Skip database cleanup in CI or if SKIP_DB_SETUP is set
  const skipDbCleanup = process.env.CI === 'true' || process.env.SKIP_DB_SETUP === 'true';

  if (!skipDbCleanup) {
    try {
      // Dynamically import setup helpers (they require database connection)
      const { cleanupAll, disconnect } = await import('./helpers/setup');

      // Clean up test data
      console.log('🗑️  Cleaning up test data...');
      await cleanupAll();
      console.log('✅ Test data cleaned up\n');

      // Disconnect from database
      console.log('🔌 Disconnecting from database...');
      await disconnect();
      console.log('✅ Database disconnected\n');
    } catch (error) {
      console.warn('⚠️  Database cleanup skipped (not available):', (error as Error).message);
    }
  } else {
    console.log('⏭️  Skipping database cleanup (CI/SKIP_DB_SETUP)\n');
  }

  console.log('✅ Global teardown complete\n');
}

export default globalTeardown;
