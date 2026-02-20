const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // 1. Verify Homepage (Lazy loading shouldn't break it)
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'verification/homepage.png' });
    console.log('Homepage screenshot taken.');

    // 2. Verify Admin Login
    console.log('Navigating to admin...');
    await page.goto('http://localhost:8080/admin.html');

    // Fill login
    console.log('Filling login...');
    await page.fill('#adminPassword', 'admin123');
    await page.click('#loginBtn');

    // Wait for dashboard to be visible
    console.log('Waiting for dashboard...');
    try {
        await page.waitForSelector('#adminDashboard', { state: 'visible', timeout: 5000 });
        console.log('Dashboard visible!');
        await page.screenshot({ path: 'verification/admin_dashboard.png' });
    } catch (e) {
        console.error('Dashboard not visible within timeout.');
        await page.screenshot({ path: 'verification/admin_failure.png' });
    }

    await browser.close();
})();
