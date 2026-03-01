// @ts-check
const { test, expect } = require('@playwright/test');

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

async function setupVariantBootstrapMocks(
    page,
    featureFlags = { admin_sony_ui: true, admin_sony_ui_v3: false }
) {
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();
        if (action === 'status') {
            return jsonResponse(route, {
                ok: true,
                authenticated: false,
            });
        }
        return jsonResponse(route, { ok: true });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();

        if (resource === 'features') {
            const data = {
                admin_sony_ui: featureFlags.admin_sony_ui === true,
            };
            if (typeof featureFlags.admin_sony_ui_v3 === 'boolean') {
                data.admin_sony_ui_v3 = featureFlags.admin_sony_ui_v3;
            }
            return jsonResponse(route, {
                ok: true,
                data,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function expectResolvedVariant(page, variant) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        variant
    );
}

test.describe('Admin UI variant loader', () => {
    test('query=legacy overrides storage and feature flags', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: true,
        });

        await page.goto('/admin.html?admin_ui=legacy');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('query=sony_v2 is blocked when feature kill-switch is off', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'legacy');
        });
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: false,
        });

        await page.goto('/admin.html?admin_ui=sony_v2');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('query=sony_v3 downgrades to sony_v2 when v3 kill-switch is off but v2 stays enabled', async ({
        page,
    }) => {
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: false,
        });

        await page.goto('/admin.html?admin_ui=sony_v3');
        await expectResolvedVariant(page, 'sony_v2');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('sony_v2');
    });

    test('query=sony_v3 downgrades to legacy when both sony flags are off', async ({
        page,
    }) => {
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: false,
            admin_sony_ui_v3: false,
        });

        await page.goto('/admin.html?admin_ui=sony_v3');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('stored sony_v3 is forced to sony_v2 when v3 kill-switch is off', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v3');
        });
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: false,
        });

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'sony_v2');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('sony_v2');
    });

    test('admin_ui_reset=1 clears storage and keeps legacy query override session-only', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v3');
        });
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: true,
        });

        await page.goto('/admin.html?admin_ui=legacy&admin_ui_reset=1');
        await expectResolvedVariant(page, 'legacy');
        await expect(page).toHaveURL(/\/admin\.html\?admin_ui=legacy$/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe(null);
    });

    test('admin_ui_reset=1 keeps sony_v3 query override session-only when v3 is enabled', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: true,
        });

        await page.goto('/admin.html?admin_ui=sony_v3&admin_ui_reset=1');
        await expectResolvedVariant(page, 'sony_v3');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe(null);
    });

    test('feature flag enables sony_v3 when no query and no storage variant', async ({
        page,
    }) => {
        await setupVariantBootstrapMocks(page, {
            admin_sony_ui: true,
            admin_sony_ui_v3: true,
        });

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'sony_v3');
        await expect(page.locator('body')).toHaveClass(/admin-v3-mode/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('sony_v3');
    });

    test('loader falls back to legacy when features endpoint is unavailable', async ({
        page,
    }) => {
        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            jsonResponse(route, {
                ok: true,
                authenticated: false,
            })
        );
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = String(
                url.searchParams.get('resource') || ''
            ).toLowerCase();
            if (resource === 'features') {
                return jsonResponse(
                    route,
                    { ok: false, error: 'unavailable' },
                    503
                );
            }
            return jsonResponse(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'legacy');
    });
});
