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

  test('renderiza reseñas en la sección pública', async ({ page }) => {
    const reviewsSection = page.locator('#resenas, #reviews, .reviews-section').first();
    await expect(reviewsSection).toBeVisible();
    await reviewsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    await expect(page.locator('.reviews-grid .review-card').first()).toBeVisible();
  });

  test('navegación principal funciona', async ({ page }) => {
    const nav = page.locator('nav, .nav, .navbar').first();
    await expect(nav).toBeVisible();
  });

  test('selector de idioma existe en el DOM', async ({ page }) => {
    const langBtn = page.locator('[onclick*="changeLanguage"], [data-lang="en"], .lang-btn, .language-selector button');
    expect(await langBtn.count()).toBeGreaterThanOrEqual(1);
  });

  test('sistema de temas existe en el DOM', async ({ page }) => {
    const themeBtn = page.locator('[data-theme-mode], .theme-btn, .theme-toggle');
    expect(await themeBtn.count()).toBeGreaterThanOrEqual(1);
    // Verificar que el atributo data-theme está presente
    await expect(page.locator('html')).toHaveAttribute('data-theme', /(light|dark)/);
  });

  test('footer visible con enlaces legales', async ({ page }) => {
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
    const links = footer.locator('a[href*="terminos"], a[href*="privacidad"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });
});
