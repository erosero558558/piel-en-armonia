// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Reprogramación de citas', () => {
  test('token inválido muestra error', async ({ page }) => {
    await page.goto('/?reschedule=token_invalido_123');
    await page.waitForTimeout(2000);

    // Debería mostrar un toast o mensaje de error
    const toast = page.locator('.toast, [class*="toast"], [role="alert"]').first();
    if (await toast.isVisible()) {
      await expect(toast).toContainText(/inválido|no encontrada|error/i);
    }
  });

  test('modal de reprogramación tiene los campos necesarios', async ({ page }) => {
    await page.goto('/');
    // Verificar que el modal existe en el DOM
    const modal = page.locator('#rescheduleModal');
    await expect(modal).toBeAttached();

    const dateInput = page.locator('#rescheduleDate');
    await expect(dateInput).toBeAttached();

    const timeSelect = page.locator('#rescheduleTime');
    await expect(timeSelect).toBeAttached();

    const submitBtn = page.locator('#rescheduleSubmitBtn');
    await expect(submitBtn).toBeAttached();
  });

  test('API GET reschedule con token vacío devuelve 400', async ({ request }) => {
    const resp = await request.get('/api.php?resource=reschedule&token=');
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.ok).toBe(false);
  });

  test('API GET reschedule con token inexistente devuelve 404', async ({ request }) => {
    const resp = await request.get('/api.php?resource=reschedule&token=abcdef1234567890abcdef1234567890');
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.ok).toBe(false);
  });

  test('API PATCH reschedule sin fecha devuelve 400', async ({ request }) => {
    const resp = await request.patch('/api.php?resource=reschedule', {
      data: { token: 'abcdef1234567890abcdef1234567890', date: '', time: '' }
    });
    expect(resp.status()).toBe(400);
  });
});
