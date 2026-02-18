// @ts-check
const { test, expect } = require('@playwright/test');

const legalPages = [
  { path: '/terminos.html', title: /Términos/, heading: 'Términos y Condiciones' },
  { path: '/privacidad.html', title: /Privacidad/, heading: 'Política de Privacidad' },
  { path: '/cookies.html', title: /Cookies/, heading: 'Política de Cookies' },
  { path: '/aviso-medico.html', title: /Aviso.*Médic/, heading: 'Aviso de Responsabilidad Médica' },
];

for (const lp of legalPages) {
  test.describe(lp.heading, () => {
    test(`carga ${lp.path} correctamente`, async ({ page }) => {
      await page.goto(lp.path);
      await expect(page).toHaveTitle(lp.title);
    });

    test(`muestra encabezado en ${lp.path}`, async ({ page }) => {
      await page.goto(lp.path);
      const h1 = page.locator('h1').first();
      await expect(h1).toContainText(lp.heading);
    });

    test(`tiene enlace de regreso en ${lp.path}`, async ({ page }) => {
      await page.goto(lp.path);
      const backLink = page.locator('a[href*="pielarmonia.com"], a[href="/"]').first();
      await expect(backLink).toBeVisible();
    });

    test(`tiene enlaces a otras páginas legales en ${lp.path}`, async ({ page }) => {
      await page.goto(lp.path);
      const legalLinks = page.locator('.legal-links a, .legal-footer a');
      expect(await legalLinks.count()).toBeGreaterThanOrEqual(2);
    });
  });
}
