// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Aurora page loading bar', () => {
    test('injects the shared loader on public navigation surfaces', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('#aurora-loader')).toHaveCount(1);
        await expect(page.locator('#aurora-loader')).toHaveAttribute(
            'data-state',
            /idle|complete/
        );

        const loaderMeta = await page.evaluate(() => {
            const loader = document.querySelector('#aurora-loader');
            return {
                hasApi:
                    typeof window.__auroraPageLoader === 'object' &&
                    typeof window.__auroraPageLoader.start === 'function' &&
                    typeof window.__auroraPageLoader.finish === 'function',
                height: loader instanceof HTMLElement ? loader.style.height : '',
            };
        });

        expect(loaderMeta.hasApi).toBe(true);
        expect(loaderMeta.height).toBe('3px');
    });
});
