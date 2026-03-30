// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1366, height: 900 },
});

function toLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function plusDays(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() + days);
    return toLocalDateKey(date);
}

function buildDailyAppointments(todayKey) {
    return [
        {
            id: 301,
            name: 'Eva Torres',
            email: 'eva@example.com',
            phone: '+593 99 111 2222',
            service: 'consulta_dermatologica',
            doctor: 'rosero',
            date: todayKey,
            time: '09:00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            checkinToken: 'CHK-301',
        },
        {
            id: 302,
            name: 'Fabian Mejia',
            email: 'fabian@example.com',
            phone: '+593 98 222 3333',
            service: 'laser',
            doctor: 'rosero',
            date: todayKey,
            time: '09:00',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            checkinToken: 'CHK-302',
        },
        {
            id: 303,
            name: 'Gina Luna',
            email: 'gina@example.com',
            phone: '+593 97 333 4444',
            service: 'peeling',
            doctor: 'narvaez',
            date: todayKey,
            time: '10:30',
            status: 'confirmed',
            paymentMethod: 'transfer',
            paymentStatus: 'paid',
            checkinToken: 'CHK-303',
        },
        {
            id: 304,
            name: 'Hector Mora',
            email: 'hector@example.com',
            phone: '+593 96 444 5555',
            service: 'control',
            doctor: 'rosero',
            date: plusDays(todayKey, 1),
            time: '11:15',
            status: 'confirmed',
            paymentMethod: 'cash',
            paymentStatus: 'pending_cash',
            checkinToken: 'CHK-304',
        },
    ];
}

async function openAppointments(page, options = {}) {
    const todayKey = toLocalDateKey();
    const appointments =
        options.appointments || buildDailyAppointments(todayKey);

    await installLegacyAdminAuthMock(page);
    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            appointments,
            queue_tickets: Array.isArray(options.queueTickets)
                ? options.queueTickets
                : [],
        },
        handleRoute: options.handleRoute,
    });

    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();
    await page.locator('.nav-item[data-section="appointments"]').click();
    await expect(page.locator('#appointments')).toHaveClass(/active/);

    return {
        todayKey,
        appointments,
    };
}

test.describe('Admin appointments daily agenda', () => {
    test('muestra agenda diaria con overbooking y citas ya llegadas', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();

        await openAppointments(page, {
            queueTickets: [
                {
                    id: 901,
                    ticketCode: 'A-091',
                    appointmentId: 303,
                    patientInitials: 'GL',
                    queueType: 'appointment',
                    status: 'waiting',
                    createdAt: nowIso,
                },
            ],
        });

        await expect(
            page.locator('#appointmentsDailyAgenda [data-daily-agenda-item="true"]')
        ).toHaveCount(3);
        await expect(
            page.locator('#appointmentsDailyAgenda [data-overbooking-slot="true"]')
        ).toHaveCount(1);
        await expect(page.locator('#appointmentsDailyAgenda')).toContainText(
            '09:00'
        );
        await expect(page.locator('#appointmentsDeckChip')).toHaveText(
            /Overbooking detectado/
        );

        const arrivedCard = page.locator(
            '[data-daily-agenda-item="true"][data-appointment-id="303"]'
        );
        await expect(arrivedCard).toHaveAttribute('data-queue-status', 'waiting');
        await expect(arrivedCard).toContainText('Llegó');
        await expect(arrivedCard).toContainText('A-091');
        await expect(
            arrivedCard.getByRole('button', { name: 'Marcar llegó' })
        ).toHaveCount(0);
    });

    test('marcar llegó usa queue-checkin y sincroniza el estado en la agenda', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        let checkinPayload = null;

        await openAppointments(page, {
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                payload,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-checkin' &&
                    intendedMethod === 'POST'
                ) {
                    checkinPayload = payload;
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            id: 911,
                            ticketCode: 'A-101',
                            appointmentId: 301,
                            patientInitials: 'ET',
                            queueType: 'appointment',
                            status: 'waiting',
                            createdAt: nowIso,
                        },
                        queueState: {
                            updatedAt: nowIso,
                            waitingCount: 1,
                            calledCount: 0,
                            counts: {
                                waiting: 1,
                                called: 0,
                                completed: 0,
                                no_show: 0,
                                cancelled: 0,
                            },
                            activeConsultorios: 1,
                            estimatedWaitMin: 12,
                            delayReason: '',
                            assistancePendingCount: 0,
                            activeHelpRequests: [],
                            recentResolvedHelpRequests: [],
                            nextTickets: [
                                {
                                    id: 911,
                                    ticketCode: 'A-101',
                                    appointmentId: 301,
                                    patientInitials: 'ET',
                                    queueType: 'appointment',
                                    priorityClass: 'appointment',
                                    position: 1,
                                    createdAt: nowIso,
                                    estimatedWaitMin: 12,
                                },
                            ],
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await expect(
            page.locator('#appointmentsDailyAgenda [data-daily-agenda-item="true"]')
        ).toHaveCount(3);
        const card = page
            .locator('#appointmentsDailyAgenda [data-daily-agenda-item="true"]')
            .first();
        await expect(card).toContainText('Eva Torres');
        const checkinButton = card.locator('button', {
            hasText: 'Marcar llegó',
        });
        await expect(checkinButton).toBeVisible();
        await checkinButton.click();

        await expect.poll(() => checkinPayload?.checkinToken || '').toBe(
            'CHK-301'
        );
        await expect(card).toHaveAttribute('data-queue-status', 'waiting');
        await expect(card).toContainText('A-101');
        await expect(card).toContainText('Llegó');
        await expect(
            card.getByRole('button', { name: 'Marcar llegó' })
        ).toHaveCount(0);
    });
});
