// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

async function readFeatureFlags(request) {
    const response = await request.get('/api.php?resource=features');
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();

    expect(payload).toBeTruthy();
    expect(payload.ok).toBe(true);
    expect(payload.data).toBeTruthy();
    expect(typeof payload.data.admin_sony_ui).toBe('boolean');
    expect(typeof payload.data.admin_sony_ui_v3).toBe('boolean');

    return {
        sonyV2: payload.data.admin_sony_ui === true,
        sonyV3: payload.data.admin_sony_ui_v3 === true,
    };
}

async function expectVariant(page, variant) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        variant
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

function resolveExpectedVariants(flags) {
    return {
        defaultVariant: flags.sonyV3
            ? 'sony_v3'
            : flags.sonyV2
              ? 'sony_v2'
              : 'legacy',
        queryV2: flags.sonyV2 ? 'sony_v2' : 'legacy',
        queryV3: flags.sonyV3 ? 'sony_v3' : flags.sonyV2 ? 'sony_v2' : 'legacy',
    };
}

test.describe('Admin UI runtime smoke', () => {
    test('resuelve variante correctamente segun query, reset y feature flags reales', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const flags = await readFeatureFlags(request);
        const expected = resolveExpectedVariants(flags);

        await page.goto('/admin.html?admin_ui=legacy&admin_ui_reset=1');
        await expectVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe(null);

        await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');
        await expectVariant(page, expected.queryV2);

        await page.goto('/admin.html?admin_ui=sony_v3&admin_ui_reset=1');
        await expectVariant(page, expected.queryV3);

        await page.goto('/admin.html?admin_ui_reset=1');
        await expectVariant(page, expected.defaultVariant);
    });

    test('mantiene CSP admin endurecida en meta (self-only para script/style/font)', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto('/admin.html');

        const cspMeta = page.locator(
            'meta[http-equiv="Content-Security-Policy"]'
        );
        await expect(cspMeta).toHaveCount(1);

        const cspContent = (await cspMeta.getAttribute('content')) || '';
        expect(cspContent).toContain("script-src 'self'");
        expect(cspContent).toContain("style-src 'self'");
        expect(cspContent).toContain("font-src 'self'");
    });
});
