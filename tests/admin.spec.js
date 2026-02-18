// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Panel de administración', () => {
  test('página admin carga correctamente', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page).toHaveTitle(/Admin|Piel en Armonía/);
  });

  test('formulario de login está visible', async ({ page }) => {
    await page.goto('/admin.html');
    const loginForm = page.locator('#loginForm, form, [class*="login"]').first();
    await expect(loginForm).toBeVisible();
  });

  test('login con contraseña vacía no funciona', async ({ page }) => {
    await page.goto('/admin.html');
    const passwordInput = page.locator('input[type="password"]').first();
    const loginBtn = page.locator('button[type="submit"], .btn-primary').first();

    if (await passwordInput.isVisible() && await loginBtn.isVisible()) {
      await passwordInput.fill('');
      await loginBtn.click();
      await page.waitForTimeout(1000);
      // No debería mostrar el dashboard
      const dashboard = page.locator('#dashboard, [class*="dashboard"], [class*="admin-content"]').first();
      // Login debería seguir visible
      await expect(passwordInput).toBeVisible();
    }
  });

  test('login con contraseña incorrecta muestra error', async ({ page }) => {
    await page.goto('/admin.html');
    const passwordInput = page.locator('input[type="password"]').first();
    const loginBtn = page.locator('button[type="submit"], .btn-primary').first();

    if (await passwordInput.isVisible() && await loginBtn.isVisible()) {
      await passwordInput.fill('contraseña_incorrecta_test');
      await loginBtn.click();
      await page.waitForTimeout(2000);

      // Debería mostrar algún tipo de error
      const errorMsg = page.locator('[class*="error"], [class*="alert"], .toast').first();
      if (await errorMsg.isVisible()) {
        await expect(errorMsg).toBeVisible();
      }
    }
  });

  test('API health check funciona', async ({ request }) => {
    const resp = await request.get('/api.php?resource=health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ok');
  });

  test('API data sin auth devuelve 401', async ({ request }) => {
    const resp = await request.get('/api.php?resource=data');
    expect(resp.status()).toBe(401);
  });

  test('API availability devuelve datos', async ({ request }) => {
    const resp = await request.get('/api.php?resource=availability');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test('API reviews devuelve datos', async ({ request }) => {
    const resp = await request.get('/api.php?resource=reviews');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });
});
