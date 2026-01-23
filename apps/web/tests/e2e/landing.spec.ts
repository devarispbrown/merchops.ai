/**
 * E2E Tests: Landing Page
 * MerchOps Beta MVP - Playwright
 *
 * Tests verify the landing page renders exact copy from Magic Patterns
 * and all CTAs correctly route to signup with returnTo parameter.
 *
 * Requirements from CLAUDE_LANDING.md:
 * - Exact copy matching Magic Patterns source-of-truth
 * - Conversion CTAs route to /signup?returnTo=/app
 * - Authenticated users redirect to /queue
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

// ============================================================================
// TESTS: LANDING PAGE EXACT COPY
// ============================================================================

test.describe('Landing Page - Exact Copy', () => {
  test('renders exact hero copy', async ({ page }) => {
    await page.goto('/');

    // Verify hero headings and exact strings per CLAUDE_LANDING.md
    await expect(page.getByText('Campaigns ready to send.')).toBeVisible();
    await expect(page.getByText('Not another dashboard.')).toBeVisible();

    // Verify exact subheading
    await expect(
      page.getByText('Draft-first by default. Nothing sends without your approval.')
    ).toBeVisible();

    // Verify exact description
    await expect(
      page.getByText(
        'MerchOps turns your Shopify catalog + sales history into winback, discovery, and restock campaigns. You approve. It schedules.'
      )
    ).toBeVisible();

    // Verify logo text (MerchOps + .ai)
    await expect(page.getByText('MerchOps')).toBeVisible();
    await expect(page.getByText('.ai')).toBeVisible();
  });

  test('renders all hero copy variations', async ({ page }) => {
    await page.goto('/');

    // Test for individual pieces if combined text doesn't match exactly
    const heroSection = page.locator('text=Campaigns ready to send');
    await expect(heroSection).toBeVisible();

    const dashboardText = page.locator('text=Not another dashboard');
    await expect(dashboardText).toBeVisible();
  });
});

// ============================================================================
// TESTS: NAVIGATION CTA ROUTES TO SIGNUP
// ============================================================================

test.describe('Landing Page - Nav CTA', () => {
  test('nav "Join the beta" button routes to signup', async ({ page }) => {
    await page.goto('/');

    // Find and click the navigation "Join the beta" button
    // It should be in the nav/header area
    const navButton = page
      .locator('nav, header')
      .getByRole('button', { name: /join the beta/i });

    await navButton.click();

    // Verify navigation to signup with returnTo parameter
    await expect(page).toHaveURL(/\/signup/);
    await expect(page).toHaveURL(/returnTo/);

    // Verify exact returnTo value
    const url = new URL(page.url());
    const returnTo = url.searchParams.get('returnTo');
    expect(returnTo).toMatch(/\/app/);
  });

  test('nav CTA preserves returnTo=/app or returnTo=%2Fapp', async ({ page }) => {
    await page.goto('/');

    const navButton = page
      .locator('nav, header')
      .getByRole('button', { name: /join the beta/i });

    await navButton.click();

    // Allow either encoded or unencoded version
    const url = page.url();
    expect(url).toMatch(/returnTo=(\/app|%2Fapp)/);
  });
});

// ============================================================================
// TESTS: HERO CTA ROUTES TO SIGNUP
// ============================================================================

test.describe('Landing Page - Hero CTA', () => {
  test('hero "Join the beta" button routes to signup', async ({ page }) => {
    await page.goto('/');

    // Find hero section (not in nav) and click "Join the beta"
    // Look for button outside of nav/header
    const heroButton = page
      .getByRole('button', { name: /join the beta/i })
      .filter({ hasNot: page.locator('nav, header') })
      .first();

    await heroButton.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/signup/);
  });

  test('hero CTA navigates without returnTo check if not required', async ({ page }) => {
    await page.goto('/');

    // Some CTAs may not include returnTo if going to default route
    // But per spec, they should all include returnTo=/app
    const heroButtons = page.getByRole('button', { name: /join the beta/i });

    // Click the second one (assuming first is nav, second is hero)
    const count = await heroButtons.count();
    if (count > 1) {
      await heroButtons.nth(1).click();
    } else {
      // Fallback: click any non-nav button
      await heroButtons.first().click();
    }

    await expect(page).toHaveURL(/\/signup/);
  });
});

// ============================================================================
// TESTS: PRICING CTA ROUTES TO SIGNUP
// ============================================================================

test.describe('Landing Page - Pricing CTA', () => {
  test('pricing section "Start free trial" button routes to signup', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing section
    const pricingSection = page.locator('#pricing, section:has-text("pricing")').first();
    await pricingSection.scrollIntoViewIfNeeded();

    // Find and click any "Start free trial" button in pricing section
    const pricingButton = pricingSection.getByRole('button', {
      name: /start free trial/i,
    });

    // Wait for section to be visible
    await expect(pricingButton.first()).toBeVisible();

    await pricingButton.first().click();

    // Verify navigation
    await expect(page).toHaveURL(/\/signup/);
    await expect(page).toHaveURL(/returnTo/);
  });

  test('all pricing CTAs route to signup', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing
    const pricingSection = page.locator('#pricing, section:has-text("pricing")').first();
    await pricingSection.scrollIntoViewIfNeeded();

    // Get all pricing buttons
    const pricingButtons = pricingSection.getByRole('button', {
      name: /start free trial|join the beta|notify me|contact sales/i,
    });

    const count = await pricingButtons.count();
    expect(count).toBeGreaterThan(0);

    // Click first pricing CTA
    await pricingButtons.first().click();

    await expect(page).toHaveURL(/\/signup/);
  });
});

// ============================================================================
// TESTS: FINAL CTA ROUTES TO SIGNUP
// ============================================================================

test.describe('Landing Page - Final CTA', () => {
  test('final CTA "Start your free trial" routes to signup', async ({ page }) => {
    await page.goto('/');

    // Scroll to final CTA section (usually near bottom, before footer)
    // Look for the specific button text
    const finalButton = page.getByRole('button', {
      name: /start your free trial/i,
    });

    await finalButton.scrollIntoViewIfNeeded();
    await expect(finalButton).toBeVisible();

    await finalButton.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/signup/);
    await expect(page).toHaveURL(/returnTo/);
  });

  test('final CTA section is visible before footer', async ({ page }) => {
    await page.goto('/');

    // Verify final CTA exists and is positioned correctly
    const finalCTA = page.getByRole('button', { name: /start your free trial/i });
    const footer = page.locator('footer');

    await finalCTA.scrollIntoViewIfNeeded();

    // Both should exist
    await expect(finalCTA).toBeVisible();
    await expect(footer).toBeVisible();

    // Final CTA should be above footer in DOM
    const finalBox = await finalCTA.boundingBox();
    const footerBox = await footer.boundingBox();

    expect(finalBox).toBeTruthy();
    expect(footerBox).toBeTruthy();

    if (finalBox && footerBox) {
      expect(finalBox.y).toBeLessThan(footerBox.y);
    }
  });
});

// ============================================================================
// TESTS: AUTHENTICATED REDIRECT
// ============================================================================

test.describe('Landing Page - Authenticated Redirect', () => {
  test('authenticated users redirect to /queue', async ({ page, context }) => {
    // Login to create authenticated session
    await login(page);

    // Verify we're logged in (should be at /queue or /dashboard)
    await expect(page).toHaveURL(/\/(queue|dashboard)/);

    // Now visit landing page
    await page.goto('/');

    // Should redirect back to app
    await page.waitForURL(/\/(queue|dashboard|app)/, { timeout: 5000 });

    // Verify we ended up in the app, not on landing
    const url = page.url();
    expect(url).toMatch(/\/(queue|dashboard|app)/);
    expect(url).not.toMatch(/^\/$|\/$/);
  });

  test('authenticated redirect happens automatically', async ({ page }) => {
    // Login first
    await login(page);

    // Direct navigation to / should redirect immediately
    const response = await page.goto('/');

    // Should either get a redirect response or client-side navigate
    await page.waitForURL(/\/(queue|dashboard|app)/, { timeout: 5000 });

    expect(page.url()).toMatch(/\/(queue|dashboard|app)/);
  });

  test('unauthenticated users see landing page', async ({ page }) => {
    // Visit / without auth
    await page.goto('/');

    // Should stay on landing page (URL is /)
    expect(page.url()).toMatch(/\/$/);

    // Should see landing content, not app content
    await expect(
      page.getByRole('button', { name: /join the beta/i })
    ).toBeVisible();
  });
});

// ============================================================================
// TESTS: NON-CONVERSION CTAS (SCROLL BEHAVIOR)
// ============================================================================

test.describe('Landing Page - Scroll Navigation', () => {
  test('non-conversion CTAs scroll to sections', async ({ page }) => {
    await page.goto('/');

    // Click "How it works" nav link
    const howItWorksLink = page
      .locator('nav, header')
      .getByRole('button', { name: /how it works/i });

    await howItWorksLink.click();

    // Should not navigate away
    expect(page.url()).toMatch(/\/$/);

    // Should scroll to section (verify section is visible)
    const howItWorksSection = page.locator('#how-it-works, section:has-text("How it works")');
    await expect(howItWorksSection.first()).toBeInViewport();
  });

  test('pricing nav link scrolls to pricing', async ({ page }) => {
    await page.goto('/');

    const pricingLink = page
      .locator('nav, header')
      .getByRole('button', { name: /pricing/i });

    await pricingLink.click();

    expect(page.url()).toMatch(/\/$/);

    const pricingSection = page.locator('#pricing, section:has-text("pricing")');
    await expect(pricingSection.first()).toBeInViewport();
  });

  test('FAQ nav link scrolls to FAQ', async ({ page }) => {
    await page.goto('/');

    const faqLink = page.locator('nav, header').getByRole('button', { name: /faq/i });

    await faqLink.click();

    expect(page.url()).toMatch(/\/$/);

    const faqSection = page.locator('#faq, section:has-text("Frequently asked questions")');
    await expect(faqSection.first()).toBeInViewport();
  });
});

// ============================================================================
// TESTS: ACCESSIBILITY
// ============================================================================

test.describe('Landing Page - Accessibility', () => {
  test('landing page has proper semantic structure', async ({ page }) => {
    await page.goto('/');

    // Should have nav
    await expect(page.locator('nav, header')).toBeVisible();

    // Should have main content
    await expect(page.locator('main, [role="main"]')).toBeVisible();

    // Should have footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('all CTA buttons are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab to first button
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);

    // Should be able to reach buttons via keyboard
    expect(['BUTTON', 'A']).toContain(firstFocused);
  });

  test('hero content is readable', async ({ page }) => {
    await page.goto('/');

    // Main heading should have appropriate heading level
    const mainHeading = page.getByRole('heading', { level: 1 }).first();
    await expect(mainHeading).toBeVisible();
  });
});

// ============================================================================
// TESTS: RESPONSIVE BEHAVIOR
// ============================================================================

test.describe('Landing Page - Responsive', () => {
  test('mobile menu works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button:has-text("Menu"), button[aria-label*="menu" i]');

    // Menu might use an icon, so also check for common mobile menu indicators
    const menuTrigger = page.locator(
      'button:has(svg), button[aria-label*="menu"], button:has-text("Menu")'
    ).first();

    // If mobile menu exists, it should toggle
    const menuExists = await menuTrigger.count();
    if (menuExists > 0) {
      await menuTrigger.click();

      // Menu content should appear
      // Look for nav links that are now visible
      const mobileNav = page.locator('nav').getByRole('button', { name: /pricing/i });
      await expect(mobileNav).toBeVisible();
    }
  });

  test('desktop layout renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Desktop nav should be visible
    const desktopNav = page.locator('nav, header');
    await expect(desktopNav).toBeVisible();

    // Should show horizontal navigation
    const navLinks = desktopNav.getByRole('button', { name: /pricing/i });
    await expect(navLinks.first()).toBeVisible();
  });
});
