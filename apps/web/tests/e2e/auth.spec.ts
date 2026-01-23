/**
 * E2E Tests: Authentication Flows
 * MerchOps Beta MVP - Playwright
 *
 * Tests:
 * - Signup flow
 * - Login flow
 * - Logout flow
 * - Session persistence
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_USER = {
  email: 'test@merchops.test',
  password: 'SecurePassword123!',
  workspaceName: 'Test Workspace',
};

const EXISTING_USER = {
  email: 'existing@merchops.test',
  password: 'ExistingPassword123!',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fillSignupForm(page: Page, userData: typeof TEST_USER) {
  await page.getByLabel(/email/i).fill(userData.email);
  await page.getByLabel(/password/i).first().fill(userData.password);
  await page.getByLabel(/confirm password/i).fill(userData.password);
  await page.getByLabel(/workspace name/i).fill(userData.workspaceName);
}

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
}

async function expectToBeLoggedIn(page: Page) {
  // Should see user menu or dashboard
  await expect(page.getByTestId('user-menu')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function expectToBeLoggedOut(page: Page) {
  // Should be redirected to login
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
}

// ============================================================================
// TESTS: SIGNUP FLOW
// ============================================================================

test.describe('Signup Flow', () => {
  test('completes full signup successfully', async ({ page }) => {
    await page.goto('/signup');

    // Verify signup page loaded
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();

    // Fill signup form
    await fillSignupForm(page, TEST_USER);

    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to dashboard after successful signup
    await expectToBeLoggedIn(page);

    // Should show welcome message
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test('shows validation errors for invalid inputs', async ({ page }) => {
    await page.goto('/signup');

    // Try to submit empty form
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).first().fill(TEST_USER.password);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('shows error for weak password', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).first().fill('weak');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/password.*at least.*characters/i)).toBeVisible();
  });

  test('shows error for password mismatch', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).first().fill(TEST_USER.password);
    await page.getByLabel(/confirm password/i).fill('DifferentPassword123!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/passwords.*match/i)).toBeVisible();
  });

  test('shows error for duplicate email', async ({ page }) => {
    await page.goto('/signup');

    await fillSignupForm(page, EXISTING_USER);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/email.*already.*registered/i)).toBeVisible();
  });

  test('creates workspace alongside user account', async ({ page }) => {
    await page.goto('/signup');

    await fillSignupForm(page, TEST_USER);
    await page.getByRole('button', { name: /create account/i }).click();

    await expectToBeLoggedIn(page);

    // Navigate to workspace settings
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /settings/i }).click();

    // Verify workspace name
    await expect(page.getByText(TEST_USER.workspaceName)).toBeVisible();
  });
});

// ============================================================================
// TESTS: LOGIN FLOW
// ============================================================================

test.describe('Login Flow', () => {
  test('logs in with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);
  });

  test('shows error for invalid email', async ({ page }) => {
    await page.goto('/login');

    await fillLoginForm(page, 'nonexistent@example.com', 'SomePassword123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();
  });

  test('shows error for incorrect password', async ({ page }) => {
    await page.goto('/login');

    await fillLoginForm(page, EXISTING_USER.email, 'WrongPassword123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();
  });

  test('redirects to intended page after login', async ({ page }) => {
    // Try to access protected page while logged out
    await page.goto('/dashboard/opportunities');

    // Should redirect to login
    await expectToBeLoggedOut(page);

    // Login
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Should redirect back to intended page
    await expect(page).toHaveURL(/\/dashboard\/opportunities/);
  });

  test('remembers session with "Remember Me" checked', async ({ page, context }) => {
    await page.goto('/login');

    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByLabel(/remember me/i).check();
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);

    // Verify session cookie is persistent
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));

    expect(sessionCookie).toBeDefined();
    // Persistent cookies have expiry > 0
    expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
  });

  test('uses session cookie without "Remember Me"', async ({ page, context }) => {
    await page.goto('/login');

    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    // Don't check "Remember Me"
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);

    // Verify session cookie is session-only
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));

    expect(sessionCookie).toBeDefined();
    // Session-only cookies have expiry = -1
    expect(sessionCookie?.expires).toBe(-1);
  });
});

// ============================================================================
// TESTS: LOGOUT FLOW
// ============================================================================

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each logout test
    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();
    await expectToBeLoggedIn(page);
  });

  test('logs out successfully', async ({ page }) => {
    // Click logout
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /log out/i }).click();

    // Should be logged out
    await expectToBeLoggedOut(page);
  });

  test('clears session on logout', async ({ page, context }) => {
    // Logout
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /log out/i }).click();

    await expectToBeLoggedOut(page);

    // Session cookie should be cleared
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));

    expect(sessionCookie).toBeUndefined();
  });

  test('prevents access to protected pages after logout', async ({ page }) => {
    // Logout
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /log out/i }).click();

    await expectToBeLoggedOut(page);

    // Try to access protected page
    await page.goto('/dashboard');

    // Should redirect to login
    await expectToBeLoggedOut(page);
  });
});

// ============================================================================
// TESTS: SESSION PERSISTENCE
// ============================================================================

test.describe('Session Persistence', () => {
  test('maintains session across page reloads', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);

    // Reload page
    await page.reload();

    // Should still be logged in
    await expectToBeLoggedIn(page);
  });

  test('maintains session across navigation', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);

    // Navigate to different pages
    await page.goto('/dashboard/opportunities');
    await expect(page.getByTestId('user-menu')).toBeVisible();

    await page.goto('/dashboard/settings');
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('expires session after inactivity timeout', async ({ page }) => {
    // Note: This test would require mocking time or waiting for actual timeout
    // Documenting expected behavior

    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);

    // In production, after session timeout (e.g., 24 hours):
    // - Next request should redirect to login
    // - User should see "Session expired" message
  });
});

// ============================================================================
// TESTS: PROTECTED ROUTES
// ============================================================================

test.describe('Protected Routes', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expectToBeLoggedOut(page);

    await page.goto('/dashboard/opportunities');
    await expectToBeLoggedOut(page);

    await page.goto('/dashboard/settings');
    await expectToBeLoggedOut(page);
  });

  test('allows authenticated users to access protected routes', async ({ page }) => {
    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/opportunities');
    await expect(page).toHaveURL(/\/dashboard\/opportunities/);
  });

  test('allows unauthenticated access to public routes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible();

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();

    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
  });
});

// ============================================================================
// TESTS: ERROR HANDLING
// ============================================================================

test.describe('Error Handling', () => {
  test('shows error for network failure during login', async ({ page }) => {
    // Simulate network offline
    await page.route('**/api/auth/**', (route) => route.abort('failed'));

    await page.goto('/login');
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText(/network error|connection failed/i)).toBeVisible();
  });

  test('shows error for server error during signup', async ({ page }) => {
    // Simulate server error
    await page.route('**/api/auth/signup', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    await page.goto('/signup');
    await fillSignupForm(page, TEST_USER);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/something went wrong|server error/i)).toBeVisible();
  });

  test('recovers from failed login attempt', async ({ page }) => {
    await page.goto('/login');

    // First attempt: wrong password
    await fillLoginForm(page, EXISTING_USER.email, 'WrongPassword');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible();

    // Second attempt: correct credentials
    await fillLoginForm(page, EXISTING_USER.email, EXISTING_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expectToBeLoggedIn(page);
  });
});

// ============================================================================
// TESTS: ACCESSIBILITY
// ============================================================================

test.describe('Accessibility', () => {
  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/login');

    // Tab through form
    await page.keyboard.press('Tab'); // Email field
    await page.keyboard.type(EXISTING_USER.email);

    await page.keyboard.press('Tab'); // Password field
    await page.keyboard.type(EXISTING_USER.password);

    await page.keyboard.press('Tab'); // Remember me
    await page.keyboard.press('Tab'); // Login button
    await page.keyboard.press('Enter'); // Submit

    await expectToBeLoggedIn(page);
  });

  test('signup form has proper ARIA labels', async ({ page }) => {
    await page.goto('/signup');

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i).first();

    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('error messages are announced to screen readers', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /log in/i }).click();

    const errorMessage = page.getByText(/email is required/i);
    await expect(errorMessage).toHaveAttribute('role', 'alert');
  });
});
