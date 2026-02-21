const { test, expect } = require('@playwright/test');

test.describe('Deferred content fallback', () => {
    test('shows a recovery state instead of empty sections when deferred JSON fails', async ({
        page,
    }) => {
        await page.route('**/content/index.json**', (route) => route.abort());

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const servicios = page.locator('#servicios');
        await expect(servicios).toBeVisible();
        await expect(servicios).toContainText('Estamos recargando esta seccion');

        const serviciosTextLength = await servicios.evaluate((node) =>
            (node.textContent || '').trim().length
        );
        expect(serviciosTextLength).toBeGreaterThan(40);

        await expect(servicios.locator('a.btn')).toHaveCount(1);
    });
});
