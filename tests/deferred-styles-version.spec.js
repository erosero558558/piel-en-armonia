// @ts-check
const { test, expect } = require('@playwright/test');

const EXPECTED_DEFERRED_VERSION = 'ui-20260221-deferred17-mobileblankfix2';

const PAGE_PATHS = [
    '/',
    '/telemedicina.html',
    '/servicios/acne.html',
    '/servicios/laser.html',
];

test.describe('Deferred stylesheet version parity', () => {
    for (const path of PAGE_PATHS) {
        test(`page ${path} references the current deferred stylesheet version`, async ({
            page,
        }) => {
            const requests = [];
            page.on('request', (req) => {
                const url = req.url();
                if (url.includes('styles-deferred.css')) {
                    requests.push(url);
                }
            });

            await page.goto(path);
            await page.waitForTimeout(800);

            const preloadLink = page
                .locator(
                    'link[rel="preload"][as="style"][href*="styles-deferred.css"]'
                )
                .first();
            await expect(preloadLink).toHaveAttribute(
                'href',
                new RegExp(EXPECTED_DEFERRED_VERSION)
            );

            const resolvedVersionRequest = requests.find((url) =>
                url.includes(EXPECTED_DEFERRED_VERSION)
            );
            expect(
                resolvedVersionRequest,
                `styles-deferred request missing expected version on ${path}`
            ).toBeTruthy();
        });
    }
});
