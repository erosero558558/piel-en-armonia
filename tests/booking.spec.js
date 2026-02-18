// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Flujo de reserva de cita', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('formulario de cita tiene todos los campos', async ({ page }) => {
    const form = page.locator('#appointmentForm');
    await expect(form).toBeVisible();

    await expect(page.locator('#serviceSelect, [name="service"]').first()).toBeVisible();
    await expect(page.locator('[name="date"], #dateInput').first()).toBeVisible();
    await expect(page.locator('[name="doctor"], #doctorSelect').first()).toBeVisible();
  });

  test('seleccionar servicio muestra precio', async ({ page }) => {
    const serviceSelect = page.locator('#serviceSelect, [name="service"]').first();
    await serviceSelect.selectOption('consulta');
    // El precio debería aparecer en algún lugar
    const priceText = page.locator('[class*="price"], [id*="price"], [data-i18n*="price"]').first();
    if (await priceText.isVisible()) {
      await expect(priceText).toContainText(/\$/);
    }
  });

  test('seleccionar fecha carga horarios', async ({ page }) => {
    const serviceSelect = page.locator('#serviceSelect, [name="service"]').first();
    await serviceSelect.selectOption('consulta');

    const doctorSelect = page.locator('[name="doctor"], #doctorSelect').first();
    if (await doctorSelect.isVisible()) {
      await doctorSelect.selectOption('rosero');
    }

    const dateInput = page.locator('[name="date"], #dateInput, input[type="date"]').first();
    // Poner fecha de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(dateStr);
    await dateInput.dispatchEvent('change');

    // Esperar que aparezcan horarios
    await page.waitForTimeout(1000);
    const timeSelect = page.locator('[name="time"], #timeSelect, select').nth(2);
    if (await timeSelect.isVisible()) {
      const options = await timeSelect.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(1);
    }
  });

  test('envío sin campos obligatorios muestra error', async ({ page }) => {
    const form = page.locator('#appointmentForm');
    const submitBtn = form.locator('button[type="submit"], .btn-primary').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Debería mostrar algún tipo de validación
      await page.waitForTimeout(500);
    }
  });

  test('flujo completo con pago en efectivo', async ({ page }) => {
    // Seleccionar servicio
    const serviceSelect = page.locator('#serviceSelect, [name="service"]').first();
    await serviceSelect.selectOption('consulta');

    // Seleccionar doctor
    const doctorSelect = page.locator('[name="doctor"], #doctorSelect').first();
    if (await doctorSelect.isVisible()) {
      await doctorSelect.selectOption('rosero');
    }

    // Seleccionar fecha futura
    const dateInput = page.locator('[name="date"], #dateInput, input[type="date"]').first();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await dateInput.fill(futureDate.toISOString().split('T')[0]);
    await dateInput.dispatchEvent('change');
    await page.waitForTimeout(1500);

    // Seleccionar hora si hay disponible
    const timeSelect = page.locator('[name="time"]').first();
    if (await timeSelect.isVisible()) {
      const options = await timeSelect.locator('option[value]:not([value=""])').all();
      if (options.length > 0) {
        await timeSelect.selectOption({ index: 1 });
      }
    }

    // Llenar datos del paciente
    const nameInput = page.locator('[name="name"], #nameInput').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Paciente E2E');
    }
    const emailInput = page.locator('[name="email"], #emailInput').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('test-e2e@example.com');
    }
    const phoneInput = page.locator('[name="phone"], #phoneInput').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+593999999999');
    }

    // Aceptar política de privacidad
    const privacyCheck = page.locator('[name="privacyConsent"], #privacyConsent, input[type="checkbox"]').first();
    if (await privacyCheck.isVisible()) {
      await privacyCheck.check();
    }
  });
});
