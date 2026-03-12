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

async function mockOperatorSurface(page, overrides = {}) {
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

    if (overrides.desktopSnapshot) {
        await page.addInitScript((snapshot) => {
            window.__turneroDesktopOpenSettingsCount = 0;
            window.turneroDesktop = {
                onBootStatus: (callback) => {
                    window.__turneroDesktopBootStatusCallback = callback;
                    return () => {
                        window.__turneroDesktopBootStatusCallback = null;
                    };
                },
                getRuntimeSnapshot: () => Promise.resolve(snapshot),
                saveRuntimeConfig: () => Promise.resolve(snapshot),
                runPreflight: () => Promise.resolve({ ok: true }),
                retryLoad: () => Promise.resolve(true),
                openSurface: () => Promise.resolve(true),
                openSettings: () => {
                    window.__turneroDesktopOpenSettingsCount += 1;
                    return Promise.resolve(true);
                },
            };
        }, overrides.desktopSnapshot);
    }
}

test.describe('Turnero Operador', () => {
    test('carga estación bloqueada y permite llamar con NumpadEnter', async ({
        page,
    }) => {
        await mockOperatorSurface(page);

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorStationSummary')).toContainText(
            'C2 bloqueado'
        );
        await expect(page.locator('#operatorOneTapSummary')).toContainText(
            '1 tecla ON'
        );
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Siguiente: A-1201'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Falta validar el numpad'
        );
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '0/4 teclas operativas listas'
        );
        await expect(page.locator('#operatorNumpadCheck_call')).toContainText(
            'Numpad Enter'
        );
        await expect(page.locator('#operatorNumpadCheck_call')).toContainText(
            'Pendiente'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-1201');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'Cancelar'
        );

        await page.keyboard.press('NumpadAdd');
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '1/4 teclas operativas listas'
        );
        await expect(page.locator('#operatorNumpadCheck_recall')).toContainText(
            'OK'
        );

        await page.keyboard.press('NumpadDecimal');
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '2/4 teclas operativas listas'
        );
        await expect(
            page.locator('#operatorNumpadCheck_complete')
        ).toContainText('OK');

        await page.keyboard.press('NumpadSubtract');
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '3/4 teclas operativas listas'
        );
        await expect(page.locator('#operatorNumpadCheck_noShow')).toContainText(
            'OK'
        );

        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Ticket A-1201 en curso'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Equipo listo para operar'
        );
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '4/4 teclas operativas listas'
        );
        await expect(page.locator('#operatorNumpadCheck_call')).toContainText(
            'OK'
        );
        await expect(page.locator('#queueC2Now')).toContainText('A-1201');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect(page.locator('#queueCalledCountAdmin')).toHaveText('1');
    });

    test('muestra metadata del shell desktop Windows cuando existe el bridge', async ({
        page,
    }) => {
        await mockOperatorSurface(page, {
            desktopSnapshot: {
                config: {
                    surface: 'operator',
                    baseUrl: 'https://pielarmonia.com',
                    launchMode: 'fullscreen',
                    stationMode: 'locked',
                    stationConsultorio: 1,
                    oneTap: false,
                    autoStart: true,
                    updateChannel: 'stable',
                    updateBaseUrl: 'https://pielarmonia.com/desktop-updates/',
                },
                status: {
                    phase: 'ready',
                    message: 'Operador listo',
                },
                surfaceUrl:
                    'https://pielarmonia.com/operador-turnos.html?station=c1&lock=1&one_tap=0',
                packaged: true,
                platform: 'win32',
                arch: 'x64',
                version: '0.1.0',
                name: 'Turnero Operador',
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                updateFeedUrl:
                    'https://pielarmonia.com/desktop-updates/stable/operator/win/',
                firstRun: false,
                settingsMode: false,
                appMode: 'packaged',
            },
        });

        await page.goto(operatorUrl('station=c1&lock=1'));
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'Turnero Operador v0.1.0'
        );
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'Windows'
        );
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'canal stable'
        );
        await expect(page.locator('#operatorOneTapSummary')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#operatorAppSettingsBtn')).toBeVisible();
        await expect(page.locator('#operatorAppSettingsBtn')).toContainText(
            'Configurar Windows app'
        );
        await page.locator('#operatorAppSettingsBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroDesktopOpenSettingsCount)
            )
            .toBe(1);
    });
});
