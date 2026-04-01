const { test, expect } = require('@playwright/test');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks.js');

test('debug settings boot', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text(), msg.location()?.url));
    page.on('pageerror', err => console.log('PAGE ERROR STR:', err.stack || err.message));
    
    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            doctorProfile: { fullName: 'Dra. Aurora Demo' }
        }
    });

    await page.goto('/admin.html');
    const readyState = await page.locator('html').getAttribute('data-admin-ready');
    console.log('READY STATE AFTER GOTO:', readyState);
    await page.waitForTimeout(4000);
    const readyStateAfter = await page.locator('html').getAttribute('data-admin-ready');
    console.log('READY STATE AFTER 4S:', readyStateAfter);
});
