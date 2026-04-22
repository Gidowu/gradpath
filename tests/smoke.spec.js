import { test, expect } from '@playwright/test';

test('main page loads and shows GradPath UI', async ({ page }) => {
    await page.goto('/');

    // Page should load and contain the app's key UI elements
    await expect(page.locator('body')).toContainText(/GradPath|Sign In|Welcome Back/i);
});

test('page has correct title and structure', async ({ page }) => {
    await page.goto('/');

    // Should have an email input for login
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Should have a password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Should have a sign-in button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('sign-up link is present', async ({ page }) => {
    await page.goto('/');

    // Should have a link to switch to sign-up
    await expect(page.locator('text=Sign Up')).toBeVisible();
});