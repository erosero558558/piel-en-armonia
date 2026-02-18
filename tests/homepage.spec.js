// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga correctamente con título', async ({ page }) => {
    await expect(page).toHaveTitle(/Piel en Armonía/);
  });

  test('muestra la sección hero', async ({ page }) => {
    const hero = page.locator('.hero, #hero, [class*="hero"]').first();
    await expect(hero).toBeVisible();
  });

  test('muestra la sección de servicios', async ({ page }) => {
    const servicios = page.locator('#servicios, #services, [id*="servicio"]').first();
    await expect(servicios).toBeVisible();
  });

  test('muestra el formulario de citas', async ({ page }) => {
    const form = page.locator('#appointmentForm');
    await expect(form).toBeVisible();
  });

  test('navegación principal funciona', async ({ page }) => {
    const nav = page.locator('nav, .nav, .navbar').first();
    await expect(nav).toBeVisible();
  });

  test('selector de idioma cambia a inglés', async ({ page }) => {
    const langBtn = page.locator('[onclick*="changeLanguage"][onclick*="en"], [data-lang="en"]').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await expect(page.locator('[data-i18n="success_title"]')).toHaveText(/Appointment Confirmed|Confirmed/);
    }
  });

  test('tema oscuro se puede activar', async ({ page }) => {
    const darkBtn = page.locator('[data-theme-mode="dark"]').first();
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
  });

  test('footer visible con enlaces legales', async ({ page }) => {
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
    const links = footer.locator('a[href*="terminos"], a[href*="privacidad"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });
});
