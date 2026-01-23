/**
 * Playwright Global Teardown
 * MerchOps Beta MVP - E2E Test Global Teardown
 *
 * Runs once after all E2E tests to:
 * - Clean up test data
 * - Close database connections
 * - Report test summary
 */

import { FullConfig } from '@playwright/test';
import { cleanupAll, disconnect } from './helpers/setup';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Global E2E Teardown: Cleaning up test environment...\n');

  try {
    // Clean up test data
    console.log('🗑️  Cleaning up test data...');
    await cleanupAll();
    console.log('✅ Test data cleaned up\n');

    // Disconnect from database
    console.log('🔌 Disconnecting from database...');
    await disconnect();
    console.log('✅ Database disconnected\n');

    console.log('✅ Global teardown complete\n');
  } catch (error) {
    console.error('\n❌ Global teardown failed:', error);
    // Don't throw - we want tests to report their results even if teardown fails
  }
}

export default globalTeardown;
