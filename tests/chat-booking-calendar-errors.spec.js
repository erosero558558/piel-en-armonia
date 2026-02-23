// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function nextDate(daysAhead = 4) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
}

function isLocalBaseUrl(testInfo) {
    const baseURL = String(testInfo?.project?.use?.baseURL || '').toLowerCase();
    return baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
}

async function mockApiWithAppointmentError(page, errorCode, statusCode, message) {
    const dateValue = nextDate(4);

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    [dateValue]: ['10:00', '10:30', '11:00'],
                },
                meta: {
                    source: 'google',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    doctor: String(url.searchParams.get('doctor') || 'indiferente'),
                    service: String(url.searchParams.get('service') || 'consulta'),
                    durationMin:
                        String(url.searchParams.get('service') || 'consulta') ===
                        'laser'
                            ? 60
                            : 30,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'booked-slots') {
            return jsonResponse(route, {
                ok: true,
                data: [],
                meta: {
                    source: 'google',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    doctor: String(url.searchParams.get('doctor') || 'indiferente'),
                    service: String(url.searchParams.get('service') || 'consulta'),
                    durationMin:
                        String(url.searchParams.get('service') || 'consulta') ===
                        'laser'
                            ? 60
                            : 30,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'appointments' && request.method() === 'POST') {
            return jsonResponse(
                route,
                {
                    ok: false,
                    code: errorCode,
                    error: message,
                },
                statusCode
            );
        }

        if (resource === 'reviews') {
            return jsonResponse(route, { ok: true, data: [] });
        }

        if (resource === 'health') {
            return jsonResponse(route, {
                ok: true,
                calendarSource: 'google',
                calendarMode: 'live',
                calendarReachable: true,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return { dateValue };
}

async function mockApiWithAvailabilityError(page, message) {
    const dateValue = nextDate(5);

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'availability') {
            return jsonResponse(
                route,
                {
                    ok: false,
                    error: message,
                },
                503
            );
        }

        if (resource === 'booked-slots') {
            return jsonResponse(route, {
                ok: true,
                data: [],
                meta: {
                    source: 'google',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    doctor: String(url.searchParams.get('doctor') || 'indiferente'),
                    service: String(url.searchParams.get('service') || 'consulta'),
                    durationMin: 30,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'reviews') {
            return jsonResponse(route, { ok: true, data: [] });
        }

        if (resource === 'health') {
            return jsonResponse(route, {
                ok: true,
                calendarSource: 'google',
                calendarMode: 'live',
                calendarReachable: true,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return { dateValue };
}

async function openChatAndStartBooking(page) {
    await page.addInitScript(() => {
        localStorage.setItem(
            'pa_cookie_consent_v1',
            JSON.stringify({
                status: 'rejected',
                at: new Date().toISOString(),
            })
        );
    });

    await page.goto('/');
    await page.locator('#chatbotWidget .chatbot-toggle').click();
    await expect(page.locator('#chatbotContainer')).toHaveClass(/active/);
    await page
        .locator(
            '#quickOptions [data-action="quick-message"][data-value="appointment"]'
        )
        .click();
}

async function sendChatText(page, value) {
    const input = page.locator('#chatInput');
    await input.fill(value);
    await input.press('Enter');
}

async function completeChatBookingUntilCashSelection(page, dateValue) {
    await page
        .locator(
            '#chatMessages button[data-action="chat-booking"][data-value="consulta"]'
        )
        .last()
        .click();
    await page
        .locator(
            '#chatMessages button[data-action="chat-booking"][data-value="indiferente"]'
        )
        .last()
        .click();

    const dateInputs = page.locator('#chatMessages #chatDateInput');
    await expect(dateInputs.last()).toBeVisible();
    const beforeErrorDateInputCount = await dateInputs.count();
    await dateInputs.last().evaluate((input, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, dateValue);

    await page
        .locator(
            '#chatMessages button[data-action="chat-booking"][data-value="10:00"]'
        )
        .last()
        .click();

    await sendChatText(page, 'Paciente Test Agenda Real');
    await sendChatText(page, 'agenda-real-test@example.com');
    await sendChatText(page, '+593987654321');

    await page
        .locator(
            '#chatMessages button[data-action="chat-booking"][data-value="efectivo"]'
        )
        .last()
        .click();

    return { beforeErrorDateInputCount };
}

test.describe('Chat booking con agenda real: errores de calendario', () => {
    test('calendar_unreachable devuelve mensaje claro y vuelve al paso de fecha', async ({
        page,
    }, testInfo) => {
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(
            !isLocalBaseUrl(testInfo),
            'Este test valida comportamiento del build local antes de desplegar.'
        );
        const { dateValue } = await mockApiWithAppointmentError(
            page,
            'calendar_unreachable',
            503,
            'No se pudo consultar la agenda real'
        );

        await openChatAndStartBooking(page);
        const { beforeErrorDateInputCount } =
            await completeChatBookingUntilCashSelection(page, dateValue);

        await expect(page.locator('#chatMessages')).toContainText(
            'La agenda esta temporalmente no disponible'
        );
        await expect
            .poll(() => page.locator('#chatMessages #chatDateInput').count())
            .toBeGreaterThan(beforeErrorDateInputCount);
    });

    test('slot_unavailable devuelve mensaje de horario ocupado y vuelve a fecha', async ({
        page,
    }, testInfo) => {
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(
            !isLocalBaseUrl(testInfo),
            'Este test valida comportamiento del build local antes de desplegar.'
        );
        const { dateValue } = await mockApiWithAppointmentError(
            page,
            'slot_unavailable',
            409,
            'Ese horario no esta disponible'
        );

        await openChatAndStartBooking(page);
        const { beforeErrorDateInputCount } =
            await completeChatBookingUntilCashSelection(page, dateValue);

        await expect(page.locator('#chatMessages')).toContainText(
            'Ese horario ya no esta disponible'
        );
        await expect
            .poll(() => page.locator('#chatMessages #chatDateInput').count())
            .toBeGreaterThan(beforeErrorDateInputCount);
    });

    test('slot_conflict devuelve mensaje de horario ocupado y vuelve a fecha', async ({
        page,
    }, testInfo) => {
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(
            !isLocalBaseUrl(testInfo),
            'Este test valida comportamiento del build local antes de desplegar.'
        );
        const { dateValue } = await mockApiWithAppointmentError(
            page,
            'slot_conflict',
            409,
            'slot_conflict'
        );

        await openChatAndStartBooking(page);
        const { beforeErrorDateInputCount } =
            await completeChatBookingUntilCashSelection(page, dateValue);

        await expect(page.locator('#chatMessages')).toContainText(
            'Ese horario ya no esta disponible'
        );
        await expect
            .poll(() => page.locator('#chatMessages #chatDateInput').count())
            .toBeGreaterThan(beforeErrorDateInputCount);
    });

    test('error de disponibilidad por mensaje muestra agenda no disponible', async ({
        page,
    }, testInfo) => {
        // eslint-disable-next-line playwright/no-skipped-test
        test.skip(
            !isLocalBaseUrl(testInfo),
            'Este test valida comportamiento del build local antes de desplegar.'
        );
        const { dateValue } = await mockApiWithAvailabilityError(
            page,
            'No se pudo consultar la agenda real en Google Calendar'
        );

        await openChatAndStartBooking(page);
        await page
            .locator(
                '#chatMessages button[data-action="chat-booking"][data-value="consulta"]'
            )
            .last()
            .click();
        await page
            .locator(
                '#chatMessages button[data-action="chat-booking"][data-value="indiferente"]'
            )
            .last()
            .click();

        const dateInputs = page.locator('#chatMessages #chatDateInput');
        await expect(dateInputs.last()).toBeVisible();
        await dateInputs.last().evaluate((input, value) => {
            input.value = String(value);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, dateValue);

        await expect(page.locator('#chatMessages')).toContainText(
            'La agenda esta temporalmente no disponible'
        );
    });
});
