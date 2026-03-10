// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function operatorUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/operador-turnos.html${search ? `?${search}` : ''}`;
}

test.describe('Turnero Operador', () => {
    test('carga estación bloqueada y permite llamar con NumpadEnter', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1201,
                ticketCode: 'A-1201',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];

        let queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 1,
            calledCount: 0,
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1201,
                    ticketCode: 'A-1201',
                    patientInitials: 'ER',
                    position: 1,
                },
            ],
        };

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
            const action =
                new URL(route.request().url()).searchParams.get('action') || '';
            if (action === 'status') {
                return json(route, {
                    ok: true,
                    authenticated: true,
                    csrfToken: 'csrf_operator',
                });
            }
            return json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_operator',
            });
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const resource =
                new URL(request.url()).searchParams.get('resource') || '';

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {},
                        queue_tickets: queueTickets,
                        queueMeta: queueState,
                    },
                });
            }

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: queueState,
                });
            }

            if (resource === 'queue-call-next') {
                const calledTicket = {
                    ...queueTickets[0],
                    status: 'called',
                    assignedConsultorio: 2,
                    calledAt: new Date().toISOString(),
                };
                queueTickets = [calledTicket];
                queueState = {
                    updatedAt: new Date().toISOString(),
                    waitingCount: 0,
                    calledCount: 1,
                    counts: {
                        waiting: 0,
                        called: 1,
                        completed: 0,
                        no_show: 0,
                        cancelled: 0,
                    },
                    callingNow: [calledTicket],
                    nextTickets: [],
                };
                return json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health' || resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorStationSummary')).toContainText(
            'C2 bloqueado'
        );
        await expect(page.locator('#operatorOneTapSummary')).toContainText(
            '1 tecla ON'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-1201');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'Cancelar'
        );

        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#queueC2Now')).toContainText('A-1201');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect(page.locator('#queueCalledCountAdmin')).toHaveText('1');
    });
});
