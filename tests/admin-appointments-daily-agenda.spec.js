// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 960 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function toLocalDateKey(value) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildAppointmentsPayload() {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowKey = toLocalDateKey(tomorrow);

    return [
        {
            id: 201,
            name: 'Ana Agenda',
            email: 'ana.agenda@example.com',
            phone: '+593 99 111 2222',
            service: 'consulta_dermatologica',
            doctor: 'rosero',
            date: todayKey,
            time: '09:00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
        {
            id: 202,
            name: 'Bruno Sobrecupo',
            email: 'bruno.sobrecupo@example.com',
            phone: '+593 98 222 3333',
            service: 'control_acne',
            doctor: 'rosero',
            date: todayKey,
            time: '09:00',
            status: 'confirmed',
            paymentMethod: 'transfer',
            paymentStatus: 'pending_transfer_review',
        },
        {
            id: 203,
            name: 'Carla Recepcion',
            email: 'carla.recepcion@example.com',
            phone: '+593 97 333 4444',
            service: 'telemedicina',
            doctor: 'narvaez',
            date: todayKey,
            time: '10:30',
            status: 'arrived',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
        {
            id: 204,
            name: 'Diego Manana',
            email: 'diego.manana@example.com',
            phone: '+593 96 444 5555',
            service: 'dermatitis',
            doctor: 'narvaez',
            date: tomorrowKey,
            time: '11:45',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
    ];
}

async function setupAdminApiMocks(page) {
    const appointments = buildAppointmentsPayload();
    const patchCalls = [];

    await installLegacyAdminAuthMock(page, {
        csrfToken: 'csrf_test_token',
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';
        const method = request.method().toUpperCase();
        const rawBody = request.postData() || '';
        let payload = {};

        if (rawBody) {
            try {
                payload = JSON.parse(rawBody);
            } catch (_error) {
                payload = {};
            }
        }

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments,
                    callbacks: [],
                    reviews: [],
                    availability: {},
                    availabilityMeta: {
                        source: 'store',
                        mode: 'live',
                        timezone: 'America/Guayaquil',
                        calendarConfigured: true,
                        calendarReachable: true,
                        generatedAt: new Date().toISOString(),
                    },
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: {
                    source: 'store',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    calendarConfigured: true,
                    calendarReachable: true,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'appointments' && method === 'PATCH') {
            patchCalls.push(payload);
            const appointmentId = Number(payload.id || 0);
            const appointment = appointments.find(
                (item) => Number(item.id || 0) === appointmentId
            );
            if (appointment) {
                Object.assign(appointment, payload);
            }
            return jsonResponse(route, { ok: true, data: appointment || {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return { patchCalls };
}

async function openAppointmentsSection(page) {
    const mocks = await setupAdminApiMocks(page);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    const navItem = page.locator('.nav-item[data-section="appointments"]');
    if (!(await navItem.isVisible())) {
        await page.locator('#adminMenuToggle').click();
    }
    await navItem.click();
    await expect(page.locator('#appointments')).toHaveClass(/active/);
    await expect(
        page.locator('#appointmentsTableBody tr.appointment-row')
    ).toHaveCount(4);
    return mocks;
}

test.describe('Admin appointments daily agenda', () => {
    test('muestra agenda diaria con alerta de sobrecupo', async ({ page }) => {
        await openAppointmentsSection(page);

        await expect(page.locator('#appointmentsDailySummary')).toContainText(
            '3 cita(s) activas'
        );
        await expect(page.locator('#appointmentsDailyChip')).toContainText(
            '1 sobrecupo'
        );
        await expect(
            page.locator('#appointmentsOverbookingAlerts')
        ).toContainText('Ana Agenda');
        await expect(
            page.locator('#appointmentsOverbookingAlerts')
        ).toContainText('Bruno Sobrecupo');
        await expect(page.locator('#appointmentsDailyList')).toContainText(
            'Carla Recepcion'
        );
        await expect(page.locator('#appointmentsDailyList')).toContainText(
            'Llego'
        );
    });

    test('permite marcar llegada desde la agenda y actualiza el estado local', async ({
        page,
    }) => {
        const { patchCalls } = await openAppointmentsSection(page);

        const anaCard = page
            .locator('.appointments-daily-item')
            .filter({ hasText: 'Ana Agenda' })
            .first();
        const anaArriveButton = page.locator(
            '#appointmentsDailyList button[data-action="mark-arrived"][data-id="201"]'
        );

        await expect(anaCard).toContainText('Confirmada');
        await expect(anaArriveButton).toBeVisible();
        await anaArriveButton.click();

        await expect
            .poll(() => patchCalls.length)
            .toBe(1);
        expect(patchCalls[0]).toMatchObject({
            id: 201,
            status: 'arrived',
        });

        const updatedAnaCard = page
            .locator('.appointments-daily-item')
            .filter({ hasText: 'Ana Agenda' })
            .first();

        await expect(updatedAnaCard).toContainText('Llego');
        await expect(
            page.locator(
                '#appointmentsDailyList button[data-action="mark-arrived"][data-id="201"]'
            )
        ).toHaveCount(0);

        const anaRow = page
            .locator('#appointmentsTableBody tr.appointment-row')
            .filter({ hasText: 'Ana Agenda' })
            .first();
        await expect(anaRow).toContainText('Llego');
        await expect(page.locator('#appointmentsDailySummary')).toContainText(
            '2 ya llego/llegaron'
        );
    });
});
