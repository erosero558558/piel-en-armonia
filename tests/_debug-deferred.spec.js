const { test } = require('@playwright/test');

test('debug deferred root load', async ({ page }) => {
    page.on('console', (msg) => {
        if (['error', 'warning'].includes(msg.type())) {
            // eslint-disable-next-line no-console
            console.log(`[console:${msg.type()}] ${msg.text()}`);
        }
    });
    page.on('pageerror', (err) => {
        // eslint-disable-next-line no-console
        console.log(`[pageerror] ${err.message}`);
    });
    page.on('requestfailed', (req) => {
        // eslint-disable-next-line no-console
        console.log(
            `[requestfailed] ${req.url()} :: ${req.failure()?.errorText || ''}`
        );
    });
    page.on('response', (res) => {
        const url = res.url();
        if (
            url.includes('/content/index.json') ||
            url.includes('script.js') ||
            url.includes('styles-deferred')
        ) {
            // eslint-disable-next-line no-console
            console.log(`[res ${res.status()}] ${url}`);
        }
    });

    await page.goto('/');
    await page.waitForTimeout(6000);

    const state = await page.evaluate(() => {
        const ids = ['showcase', 'servicios', 'chatbotWidget'];
        const output = {};
        for (const id of ids) {
            const el = document.getElementById(id);
            output[id] = el
                ? {
                      className: el.className,
                      htmlLen: (el.innerHTML || '').length,
                      childCount: el.children.length,
                  }
                : null;
        }
        return output;
    });

    // eslint-disable-next-line no-console
    console.log('STATE', JSON.stringify(state));
});
