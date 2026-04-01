const { test, expect } = require('@playwright/test');
test('Dump console', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    await page.goto('/admin.html');
    await page.waitForTimeout(2000);
    const ready = await page.evaluate(() => document.documentElement.getAttribute('data-admin-ready'));
    console.log('Final data-admin-ready:', ready);
});
