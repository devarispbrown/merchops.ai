/**
 * Playwright Global Setup
 * MerchOps Beta MVP - E2E Test Global Setup
 *
 * Runs once before all E2E tests to:
 * - Initialize test database
 * - Seed test data
 * - Setup test environment
 */

import { chromium, FullConfig } from '@playwright/test';
import { seedAll, resetDatabase } from './helpers/setup';

async function globalSetup(config: FullConfig) {
  console.log('\n🔧 Global E2E Setup: Initializing test environment...\n');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  try {
    // Reset and seed database
    console.log('📦 Resetting test database...');
    await resetDatabase();
    console.log('✅ Database reset complete\n');

    console.log('🌱 Seeding test data...');
    await seedAll();
    console.log('✅ Test data seeded\n');

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
  } catch (error) {
    console.error('\n❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;
