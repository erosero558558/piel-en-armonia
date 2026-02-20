const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to homepage...');
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'verification/homepage.png' });
    console.log('Homepage screenshot taken.');

    console.log('Navigating to admin...');
    await page.goto('http://localhost:8080/admin.html');
    await page.waitForLoadState('domcontentloaded');

    console.log('Waiting for login button...');
    try {
        const submitBtn = '#loginForm button[type="submit"]';
        await page.waitForSelector(submitBtn, { timeout: 5000 });
        console.log('Login button found!');

        console.log('Filling login...');
        await page.fill('#adminPassword', 'admin123');
        await page.click(submitBtn);

        console.log('Waiting for dashboard...');
        await page.waitForSelector('#adminDashboard', { state: 'visible', timeout: 5000 });
        console.log('Dashboard visible!');
        await page.screenshot({ path: 'verification/admin_dashboard.png' });
    } catch (e) {
        console.error('Error:', e);
        await page.screenshot({ path: 'verification/admin_failure.png' });
    }

    await browser.close();
})();
