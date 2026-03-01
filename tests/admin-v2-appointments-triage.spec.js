// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 920 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDateTimePartsFromNow(hoursFromNow) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    return {
        date: toLocalDateKey(target),
        time: `${String(target.getHours()).padStart(2, '0')}:${String(
            target.getMinutes()
        ).padStart(2, '0')}`,
    };
}

function buildAppointmentsSeed() {
    const near = toDateTimePartsFromNow(2);
    const tomorrow = toDateTimePartsFromNow(26);
    const noShow = toDateTimePartsFromNow(30);
    const later = toDateTimePartsFromNow(76);

    return [
        {
            id: 701,
            name: 'Ana Transfer',
            email: 'ana@example.com',
            phone: '+593 99 111 2222',
            service: 'limpieza_facial',
            doctor: 'rosero',
            date: near.date,
            time: near.time,
            price: '$45.00',
            status: 'confirmed',
            paymentMethod: 'transfer',
            paymentStatus: 'pending_transfer_review',
            transferProofUrl: 'https://example.com/proof-701.jpg',
        },
        {
            id: 702,
            name: 'Bruno Confirmado',
            email: 'bruno@example.com',
            phone: '+593 98 222 3333',
            service: 'consulta_dermatologica',
            doctor: 'narvaez',
            date: tomorrow.date,
            time: tomorrow.time,
            price: '$35.00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
        },
        {
            id: 703,
            name: 'Carla NoShow',
            email: 'carla@example.com',
            phone: '+593 97 333 4444',
            service: 'telemedicina',
            doctor: 'rosero',
            date: noShow.date,
            time: noShow.time,
            price: '$30.00',
            status: 'no_show',
            paymentMethod: 'transfer',
            paymentStatus: 'failed',
        },
        {
            id: 704,
            name: 'Dario Futuro',
            email: 'dario@example.com',
            phone: '+593 96 444 5555',
            service: 'laser',
            doctor: 'rosero',
            date: later.date,
            time: later.time,
            price: '$60.00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'pending_cash',
        },
    ];
}

async function setupSonyV2AppointmentsMocks(page) {
    const state = {
        appointments: buildAppointmentsSeed(),
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
    };

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();

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
                    appointments: state.appointments,
                    callbacks: [],
                    reviews: [],
                    availability: {},
                    availabilityMeta: state.availabilityMeta,
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

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: state.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openAppointmentsSonyV2(page) {
    await setupSonyV2AppointmentsMocks(page);
    await page.goto('/admin.html?admin_ui=sony_v2&admin_ui_reset=1');

    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v2'
    );
    await expect(page.locator('#adminDashboard')).toBeVisible();

    await page.keyboard.press('Alt+Shift+Digit2');
    await expect(page.locator('#appointments')).toHaveClass(/active/);
    await expect(
        page.locator('#appointmentsTableBody tr.appointment-row')
    ).toHaveCount(4);
}

test.describe('Admin appointments triage sony_v2', () => {
    test('renderiza deck premium con foco operativo y export', async ({
        page,
    }) => {
        await openAppointmentsSonyV2(page);

        await expect(
            page.locator('#appointmentsOpsPendingTransfer')
        ).toHaveText('1');
        await expect(page.locator('#appointmentsOpsUpcomingCount')).toHaveText(
            '3'
        );
        await expect(page.locator('#appointmentsOpsNoShowCount')).toHaveText(
            '1'
        );
        await expect(page.locator('#appointmentsFocusPatient')).toContainText(
            'Ana Transfer'
        );
        await expect(page.locator('#appointmentsExportBtn')).toBeVisible();
        await expect(
            page
                .locator('#appointmentsTableBody tr.appointment-row')
                .filter({ hasText: 'Ana Transfer' })
                .first()
                .locator('td[data-label="Pago"]')
        ).toContainText('Ver comprobante');
    });

    test('resume orden, foco y resultados vacios en toolbar', async ({
        page,
    }) => {
        await openAppointmentsSonyV2(page);

        await page.locator('#appointmentSort').selectOption('patient_az');
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Paciente (A-Z)'
        );

        await page
            .locator('#appointmentFilter')
            .selectOption('pending_transfer');
        await page.locator('#searchAppointments').fill('Bruno');
        await expect(
            page.locator('#appointmentsTableBody tr.table-empty-row')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsToolbarState')).toContainText(
            'Resultados: 0'
        );
    });
});
