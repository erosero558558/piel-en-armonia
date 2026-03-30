// @ts-check
const { test, expect } = require('@playwright/test');
const { findLocaleSwitch, gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 API docs', () => {
    test('software API docs page publishes OpenAPI summary, groups, and locale switch', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/api-docs/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(page.locator('[data-v6-api-docs-page]')).toBeVisible();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            'href',
            'https://pielarmonia.com/es/software/turnero-clinicas/api-docs/'
        );
        await expect(
            page.locator('link[rel="alternate"][hreflang="en"]').first()
        ).toHaveAttribute(
            'href',
            'https://pielarmonia.com/en/software/clinic-flow-suite/api-docs/'
        );
        await expect(
            page.locator('[data-v6-section-nav="software-surface"] [data-v6-section-link]')
        ).toHaveCount(6);
        await expect(page.locator('[data-v6-api-docs-openapi-version]')).toContainText(
            '3.1.0'
        );
        await expect(page.locator('[data-v6-api-docs-download]')).toHaveAttribute(
            'href',
            '/docs/openapi.yaml'
        );
        await expect(page.locator('[data-v6-api-docs-server]')).toHaveCount(2);
        await expect(page.locator('[data-v6-api-docs-group]')).toHaveCount(8);
        await expect(page.locator('[data-v6-api-docs-group]').first()).toContainText(
            'Analytics'
        );
        await expect(page.locator('[data-v6-api-docs-group]').nth(7)).toContainText(
            'Telemedicine'
        );
        await expect(page.locator('[data-v6-api-docs-code]')).toHaveCount(2);

        const localeSwitch = await findLocaleSwitch(page);
        await expect(localeSwitch).toHaveAttribute(
            'href',
            '/en/software/clinic-flow-suite/api-docs/'
        );
    });

    test('software header search surfaces API docs route', async ({ page }) => {
        await gotoPublicRoute(page, '/en/software/clinic-flow-suite/');

        const header = page.locator('[data-v6-header]').first();
        await expect
            .poll(async () => header.getAttribute('data-v6-search-ready'))
            .toBe('true');

        await header.locator('[data-v6-search-open]').first().click();
        const overlay = header.locator('[data-v6-search]').first();
        await expect(overlay).toBeVisible();

        await overlay.locator('[data-v6-search-input]').first().fill('api');

        await expect(
            overlay
                .locator(
                    '[data-v6-search-result] a[href="/en/software/clinic-flow-suite/api-docs/"]'
                )
                .first()
        ).toBeVisible();
    });
});
