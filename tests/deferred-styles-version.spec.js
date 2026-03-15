const { test, expect } = require('@playwright/test');

const V6_ROUTES = [
    '/',
    '/en/telemedicine/',
    '/es/servicios/acne-rosacea/',
    '/en/services/laser-dermatologico/',
];

function findAstroStylesheet(hrefs) {
    return hrefs.find((href) => /\/_astro\/[^?#]+\.css(?:[?#].*)?$/.test(href));
}

test.describe('Public V6 stylesheet parity', () => {
    test('selected V6 routes reuse the same hashed Astro stylesheet', async ({
        page,
    }) => {
        let expectedHref = null;

        for (const route of V6_ROUTES) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });

            const hrefs = await page.$$eval(
                'link[rel="stylesheet"][href], link[rel="preload"][as="style"][href]',
                (nodes) => nodes.map((node) => node.getAttribute('href') || '')
            );
            const astroStylesheet = findAstroStylesheet(hrefs);

            expect(
                astroStylesheet,
                `hashed Astro stylesheet missing on ${route}`
            ).toBeTruthy();

            if (expectedHref === null) {
                expectedHref = astroStylesheet;
                continue;
            }

            expect(
                astroStylesheet,
                `public V6 stylesheet drifted on ${route}`
            ).toBe(expectedHref);
        }
    });
});
