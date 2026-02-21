// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Pruebas de regresión visual', () => {

    test('Homepage Desktop - visualmente correcta', async ({ page }) => {
        test.setTimeout(90000);
        // Navegar a la página de inicio
        await page.goto('/');

        // Esperar a que la carga termine
        await page.waitForLoadState('load');
        // eslint-disable-next-line playwright/no-networkidle
        await page.waitForLoadState('networkidle');
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(2000); // Allow layout to settle

        // Tomar una captura de pantalla de toda la página
        await expect(page).toHaveScreenshot({ fullPage: true, timeout: 60000, maxDiffPixelRatio: 0.3 });
    });

    test('Homepage Mobile - visualmente correcta', async ({ page }) => {
        test.setTimeout(90000);
        // Configurar viewport móvil (iPhone SE / Pixel 5 size approx)
        await page.setViewportSize({ width: 375, height: 667 });

        // Navegar a la página de inicio
        await page.goto('/');

        // Esperar a que la carga termine
        await page.waitForLoadState('load');
        // eslint-disable-next-line playwright/no-networkidle
        await page.waitForLoadState('networkidle');
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(2000); // Allow layout to settle

        // Tomar una captura de pantalla del viewport (más estable que fullPage en móvil)
        await expect(page).toHaveScreenshot({ fullPage: false, timeout: 60000, maxDiffPixelRatio: 0.1 });
    });

    test('Sección de Reserva - carga correctamente', async ({ page }) => {
        await page.goto('/');

        // Scroll hasta la sección de citas para activar lazy load
        const bookingSection = page.locator('#citas');
        await bookingSection.scrollIntoViewIfNeeded();

        // Esperar a que el formulario sea visible (indica que el JS cargó)
        const bookingForm = page.locator('#appointmentForm');
        await expect(bookingForm).toBeVisible({ timeout: 20000 });

        // Esperar un poco más para asegurar renderizado completo
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(2000);

        // Tomar screenshot solo de la sección de citas
        await expect(bookingSection).toHaveScreenshot({ timeout: 60000, maxDiffPixelRatio: 0.2 });
    });

    test('Login Admin - visualmente correcto', async ({ page }) => {
        await page.goto('/admin.html');

        // Esperar a que el formulario de login sea visible
        const loginForm = page.locator('#loginForm');
        await expect(loginForm).toBeVisible();

        // Tomar screenshot de la página de login
        await expect(page).toHaveScreenshot();
    });
});
