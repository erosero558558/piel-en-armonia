// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Consentimiento de cookies', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage para que aparezca el banner
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('banner de cookies aparece sin consentimiento previo', async ({ page }) => {
    const banner = page.locator('#cookieBanner');
    await expect(banner).toBeVisible();
  });

  test('aceptar cookies oculta el banner', async ({ page }) => {
    const banner = page.locator('#cookieBanner');
    await expect(banner).toBeVisible();

    const acceptBtn = page.locator('#cookieAcceptBtn');
    await acceptBtn.click();

    await expect(banner).not.toBeVisible();

    // Verificar que se guardó el consentimiento
    const consent = await page.evaluate(() => {
      const raw = localStorage.getItem('pa_cookie_consent_v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(consent).not.toBeNull();
    expect(consent.status).toBe('accepted');
  });

  test('rechazar cookies oculta el banner', async ({ page }) => {
    const banner = page.locator('#cookieBanner');
    await expect(banner).toBeVisible();

    const rejectBtn = page.locator('#cookieRejectBtn');
    await rejectBtn.click();

    await expect(banner).not.toBeVisible();

    const consent = await page.evaluate(() => {
      const raw = localStorage.getItem('pa_cookie_consent_v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(consent).not.toBeNull();
    expect(consent.status).toBe('rejected');
  });

  test('banner no aparece si ya se aceptó', async ({ page }) => {
    // Aceptar cookies
    await page.evaluate(() => {
      localStorage.setItem('pa_cookie_consent_v1', JSON.stringify({ status: 'accepted', at: new Date().toISOString() }));
    });
    await page.reload();

    const banner = page.locator('#cookieBanner');
    await expect(banner).not.toBeVisible();
  });

  test('GA4 no se carga sin consentimiento', async ({ page }) => {
    // Rechazar cookies
    const rejectBtn = page.locator('#cookieRejectBtn');
    await rejectBtn.click();
    await page.waitForTimeout(1000);

    const ga4Loaded = await page.evaluate(() => !!window._ga4Loaded);
    expect(ga4Loaded).toBe(false);
  });

  test('GA4 se carga al aceptar cookies', async ({ page }) => {
    const acceptBtn = page.locator('#cookieAcceptBtn');
    await acceptBtn.click();
    await page.waitForTimeout(2000);

    const ga4Loaded = await page.evaluate(() => !!window._ga4Loaded);
    expect(ga4Loaded).toBe(true);
  });
});
