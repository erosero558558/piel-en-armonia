const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 360, height: 800 }
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8080/es/telemedicina/index.html', { waitUntil: 'networkidle' });
    const widthData = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;
        const badEls = Array.from(document.querySelectorAll('*'))
            .filter(el => el.getBoundingClientRect().width > clientWidth || el.scrollWidth > clientWidth)
            .map(el => el.tagName + '.' + el.className);
        return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth,
            offenders: badEls
        };
    });
    console.log(widthData);
    await browser.close();
})();
