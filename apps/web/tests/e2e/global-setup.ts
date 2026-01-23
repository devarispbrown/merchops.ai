/**
 * Playwright Global Setup
 * MerchOps Beta MVP - E2E Test Global Setup
 *
 * Runs once before all E2E tests to:
 * - Initialize test database (if available)
 * - Seed test data (if database available)
 * - Setup test environment
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('\n🔧 Global E2E Setup: Initializing test environment...\n');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  // Skip database setup in CI or if SKIP_DB_SETUP is set
  const skipDbSetup = process.env.CI === 'true' || process.env.SKIP_DB_SETUP === 'true';

  if (!skipDbSetup) {
    try {
      // Dynamically import setup helpers (they require database connection)
      const { seedAll, resetDatabase } = await import('./helpers/setup');

      // Reset and seed database
      console.log('📦 Resetting test database...');
      await resetDatabase();
      console.log('✅ Database reset complete\n');

      console.log('🌱 Seeding test data...');
      await seedAll();
      console.log('✅ Test data seeded\n');
    } catch (error) {
      console.warn('⚠️  Database setup skipped (not available):', (error as Error).message);
      console.warn('   Smoke tests will still run without database\n');
    }
  } else {
    console.log('⏭️  Skipping database setup (CI/SKIP_DB_SETUP)\n');
  }

  // Verify application is accessible
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  console.log(`🌐 Verifying application at ${baseURL}...`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(baseURL, { timeout: 30000 });
    console.log('✅ Application is accessible\n');
  } catch (error) {
    console.error('❌ Failed to connect to application:', error);
    console.error('   Make sure the dev server is running: pnpm dev\n');
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
