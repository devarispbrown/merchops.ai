/**
 * E2E Test Auth Helpers
 * MerchOps Beta MVP - Authentication utilities for Playwright tests
 *
 * Provides:
 * - Login helper
 * - Signup helper
 * - Authenticated page context
 */

import { Page, BrowserContext } from '@playwright/test';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './mocks';

/**
 * Login helper for E2E tests
 * Navigates to login page and submits credentials
 */
export async function login(
  page: Page,
  email: string = TEST_USER_EMAIL,
  password: string = TEST_USER_PASSWORD
): Promise<void> {
  await page.goto('/login');

  // Wait for login form to be visible
  await page.waitForSelector('form');

  // Fill in credentials
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (should redirect to dashboard)
  await page.waitForURL(/\/(dashboard|queue)/);

  // Verify we're authenticated by checking for user-specific elements
  await page.waitForSelector('[data-testid="user-menu"], [data-testid="workspace-header"]', {
    timeout: 10000,
  });
}

/**
 * Signup helper for E2E tests
 * Creates a new user account
 */
export async function signup(
  page: Page,
  email: string,
  password: string,
  workspaceName?: string
): Promise<void> {
  await page.goto('/signup');

  // Wait for signup form
  await page.waitForSelector('form');

  // Fill in registration details
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  if (workspaceName) {
    const workspaceInput = page.locator('input[name="workspace"], input[name="workspaceName"]');
    if (await workspaceInput.count() > 0) {
      await workspaceInput.fill(workspaceName);
    }
  }

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or onboarding
  await page.waitForURL(/\/(dashboard|onboarding|queue)/);
}

/**
 * Get an authenticated page context
 * Sets up session state for authenticated requests
 */
export async function getAuthenticatedPage(
  context: BrowserContext,
  email: string = TEST_USER_EMAIL,
  password: string = TEST_USER_PASSWORD
): Promise<Page> {
  const page = await context.newPage();

  // Login to establish session
  await login(page, email, password);

  return page;
}

/**
 * Setup authentication state in storage
 * Useful for bypassing login UI when testing other flows
 */
export async function setupAuthState(
  context: BrowserContext,
  sessionData: {
    userId: string;
    workspaceId: string;
    sessionToken?: string;
  }
): Promise<void> {
  // Set session cookie if provided
  if (sessionData.sessionToken) {
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: sessionData.sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
    ]);
  }

  // Set user data in localStorage
  await context.addInitScript((data) => {
    localStorage.setItem('merchops:user', JSON.stringify({
      id: data.userId,
      workspaceId: data.workspaceId,
    }));
  }, sessionData);
}

/**
 * Logout helper
 * Signs out the current user
 */
export async function logout(page: Page): Promise<void> {
  // Try to find and click logout button
  const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), [data-testid="logout-button"]');

  if (await logoutButton.count() > 0) {
    await logoutButton.first().click();
  } else {
    // Navigate to logout route directly
    await page.goto('/api/auth/signout');
    const confirmButton = page.locator('button[type="submit"]');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }
  }

  // Wait for redirect to login or home
  await page.waitForURL(/\/(login|$)/);
}

/**
 * Check if user is authenticated
 * Returns true if session is active
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for authenticated-only elements
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="workspace-header"]');
    await userMenu.waitFor({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for authentication to complete
 * Useful after signup or login
 */
export async function waitForAuth(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check for session indicators
      const hasUserMenu = document.querySelector('[data-testid="user-menu"]') !== null;
      const hasWorkspaceHeader = document.querySelector('[data-testid="workspace-header"]') !== null;
      const hasAuthCookie = document.cookie.includes('next-auth.session-token');

      return hasUserMenu || hasWorkspaceHeader || hasAuthCookie;
    },
    { timeout }
  );
}
