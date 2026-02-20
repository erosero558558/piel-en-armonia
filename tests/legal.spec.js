// @ts-check
const { test, expect } = require('@playwright/test');

const legalPages = [
    {
        path: '/terminos.html',
        title: /Términos|Terms/,
        heading: /Términos y Condiciones|Terms (and|&) Conditions/,
    },
    {
        path: '/privacidad.html',
        title: /Privacidad|Privacy/,
        heading: /Política de Privacidad|Privacy Policy/,
    },
    {
        path: '/cookies.html',
        title: /Cookies|Cookie/,
        heading: /Política de Cookies|Cookie Policy/,
    },
    {
        path: '/aviso-medico.html',
        title: /Aviso.*Médic|Medical Disclaimer/,
        heading: /Aviso de Responsabilidad Médica|Medical Disclaimer/,
    },
];

for (const lp of legalPages) {
    test.describe(`Página legal: ${lp.path}`, () => {
        test(`carga ${lp.path} correctamente`, async ({ page }) => {
            await page.goto(lp.path);
            await expect(page).toHaveTitle(lp.title);
        });

        test(`muestra encabezado en ${lp.path}`, async ({ page }) => {
            await page.goto(lp.path);
            const h1 = page.locator('h1').first();
            await expect(h1).toHaveText(lp.heading);
        });

        test(`tiene enlace de regreso en ${lp.path}`, async ({ page }) => {
            await page.goto(lp.path);
            const backLink = page
                .locator('a[href*="pielarmonia.com"], a[href="/"]')
                .first();
            await expect(backLink).toBeVisible();
        });

        test(`tiene enlaces a otras páginas legales en ${lp.path}`, async ({
            page,
        }) => {
            await page.goto(lp.path);
            const legalLinks = page.locator('.legal-links a, .legal-footer a');
            expect(await legalLinks.count()).toBeGreaterThanOrEqual(2);
        });
    });
}
