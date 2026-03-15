const { test, expect } = require('@playwright/test');

const V6_ROUTES = [
    '/',
    '/en/telemedicine/',
    '/es/servicios/acne-rosacea/',
    '/en/services/laser-dermatologico/',
];

test.describe('Public V6 script asset parity', () => {
    test('selected V6 routes load the versioned public shell bundle', async ({
        page,
    }) => {
        let expectedShell = null;

        for (const route of V6_ROUTES) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });

            const scriptSources = await page.$$eval('script[src]', (nodes) =>
                nodes.map((node) => node.getAttribute('src') || '')
            );
            const publicShell = scriptSources.find((src) =>
                src.includes('/js/public-v6-shell.js')
            );

            expect(
                publicShell,
                `public-v6 shell missing on ${route}`
            ).toBeTruthy();
            expect(
                publicShell,
                `public-v6 shell must be versioned on ${route}`
            ).toContain('?v=');

            if (expectedShell === null) {
                expectedShell = publicShell;
                continue;
            }

            expect(
                publicShell,
                `public-v6 shell version drifted on ${route}`
            ).toBe(expectedShell);
        }
    });

    test('selected V6 routes do not regress to legacy public bundles', async ({
        page,
    }) => {
        for (const route of V6_ROUTES) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });

            const scriptSources = await page.$$eval('script[src]', (nodes) =>
                nodes.map((node) => node.getAttribute('src') || '')
            );
            const legacyBundles = scriptSources.filter(
                (src) =>
                    src.includes('/script.js') ||
                    src.includes('/js/bootstrap-inline-engine.js')
            );

            expect(
                legacyBundles,
                `legacy public bundles should stay absent on ${route}`
            ).toEqual([]);
        }
    });
});
