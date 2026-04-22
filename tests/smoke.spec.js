import { test, expect } from '@playwright/test';

test('main page loads and shows GradPath', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/GradPath|Sign In|Welcome Back/i);
});

test('API hello endpoint responds', async ({ request }) => {
    const response = await request.get('/api/hello');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.message).toBe('Hello from GradPath API!');
});