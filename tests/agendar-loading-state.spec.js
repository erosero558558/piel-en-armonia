// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

function nextBookingDate() {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
}

function fullDaySlots() {
    const slots = [];
    for (let hour = 9; hour <= 17; hour += 1) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
        slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
}

async function openBooking(page) {
    await page.goto('/es/agendar/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
}

async function stubBookedSlots(page, slots) {
    await page.route(/\/api\.php\?resource=booked-slots.*/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                data: slots,
            }),
        });
    });
}

async function delayJson(route, payload, delayMs = 1200) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
    });
}

async function selectService(page, label) {
    await page.locator('#service-grid label', { hasText: label }).click();
    await page.getByRole('button', { name: 'Continuar a Medico' }).click();
}

async function selectDoctor(page, label) {
    await page.locator('#doctor-grid label', { hasText: label }).click();
    await page.getByRole('button', { name: 'Elegir Fecha' }).click();
}

async function chooseDateAndTime(page, date, timeLabel = '09:00') {
    await page.locator('#booking-date').fill(date);
    await page.getByRole('button', { name: timeLabel }).click();
    await page.getByRole('button', { name: 'Validar Horario' }).click();
}

async function fillPatient(page) {
    await page.locator('#p-name').fill('Paciente Demo');
    await page.locator('#p-email').fill('paciente@example.com');
    await page.locator('#p-phone').fill('0991234567');
}

async function expectLoadingState(page, submitSelector, expectedButtonLabel, expectedTitle) {
    const submitButton = page.locator(submitSelector);
    const loadingState = page.locator('[data-booking-loading-state]');

    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText(expectedButtonLabel);
    await expect(submitButton.locator('.booking-btn__spinner')).toBeVisible();
    await expect(loadingState).toBeVisible();
    await expect(loadingState).toContainText(expectedTitle);
    await expect(loadingState.locator('.skeleton')).toBeVisible();
    await expect(page.locator('#booking-app')).toHaveAttribute('aria-busy', 'true');
}

test.describe('es/agendar loading state', () => {
    test('muestra overlay y spinner inline al confirmar una reserva normal', async ({ page }) => {
        const bookingDate = nextBookingDate();

        await stubBookedSlots(page, []);
        await page.route(/\/api\.php\?resource=appointments$/, async (route) => {
            await delayJson(route, {
                ok: true,
                data: {
                    id: 'appt-demo-1',
                },
            });
        });

        await openBooking(page);
        await selectService(page, 'Consulta dermatologica');
        await selectDoctor(page, 'Indiferente');
        await chooseDateAndTime(page, bookingDate);
        await fillPatient(page);

        await page.locator('#btn-next-details').click();
        await expectLoadingState(
            page,
            '#btn-next-details',
            'Agendando...',
            'Confirmando tu cita...'
        );

        await expect(page.locator('#step-success')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#booking-app')).not.toHaveAttribute('aria-busy', 'true');
    });

    test('muestra feedback visible durante la evaluacion de telemedicina', async ({ page }) => {
        const bookingDate = nextBookingDate();

        await stubBookedSlots(page, []);
        await page.route(/\/api\.php\?resource=appointments$/, async (route) => {
            await delayJson(route, {
                ok: true,
                data: {
                    id: 'appt-demo-tele',
                    telemedicineSuitability: 'suitable',
                },
            });
        });

        await openBooking(page);
        await selectService(page, 'Teledermatologia');
        await selectDoctor(page, 'Indiferente');
        await chooseDateAndTime(page, bookingDate);
        await fillPatient(page);

        await page.locator('#btn-next-details').click();
        await expect(page.locator('#step-telemedicina-intake')).toBeVisible();

        await page.locator('#tm-reason').fill('Brote inflamatorio en mejillas desde hace dos semanas.');
        await page.locator('#tm-area').fill('Rostro');
        await page.locator('#tm-time').selectOption('1 a 4 semanas');
        await page.locator('#tm-consent').check();

        await page.locator('#btn-next-telemedicina').click();
        await expectLoadingState(
            page,
            '#btn-next-telemedicina',
            'Evaluando...',
            'Evaluando tu solicitud...'
        );

        await expect(page.locator('#step-success')).toBeVisible({ timeout: 5000 });
    });

    test('muestra loading state visible al registrar la lista de espera', async ({ page }) => {
        const bookingDate = nextBookingDate();

        await stubBookedSlots(page, fullDaySlots());
        await page.route(/\/api\.php\?resource=callbacks$/, async (route) => {
            await delayJson(route, {
                ok: true,
                data: {
                    callbackId: 'callback-demo-1',
                },
            });
        });

        await openBooking(page);
        await selectService(page, 'Consulta dermatologica');
        await selectDoctor(page, 'Indiferente');
        await page.locator('#booking-date').fill(bookingDate);
        await page.getByRole('button', { name: 'Unirme a lista de espera' }).click();

        await page.locator('#wl-name').fill('Paciente Lista');
        await page.locator('#wl-email').fill('lista@example.com');
        await page.locator('#wl-phone').fill('0997654321');

        await page.locator('#btn-next-waitlist').click();
        await expectLoadingState(
            page,
            '#btn-next-waitlist',
            'Guardando...',
            'Registrando tu lista de espera...'
        );

        await expect(page.locator('#step-waitlist-success')).toBeVisible({ timeout: 5000 });
    });
});
