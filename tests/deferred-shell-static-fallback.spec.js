const { test, expect } = require('@playwright/test');

test.describe('Deferred shell static fallback', () => {
    test('home keeps visible placeholders when main script fails to load', async ({
        page,
    }) => {
        await page.route('**/script.js**', (route) => route.abort());

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const section = page.locator('#servicios');
        await expect(section).toBeVisible();
        await expect(section).toContainText('Cargando contenido...');
        await expect(section).toContainText('Estamos preparando esta');
    });
});
