// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    ADMIN_UI_VARIANT,
    buildQueueMetaFromState,
    buildTurneroClinicProfileCatalogStatus,
    buildQueueIdleState,
    buildQueuePilotClinicProfile,
    buildQueuePilotProfileFingerprint,
    buildQueuePilotSurfaceStatus,
    buildQueuePilotHealthPayload,
    buildQueuePilotHealthDiagnosticsPayload,
    buildQueuePilotBookedSlotsPayload,
    buildQueueStateFromTickets,
    buildQueueDesktopOperatorInstance,
    buildQueueDesktopOperatorSurfaceStatus,
    buildQueueOperationalAppsSurfaceStatus,
    buildQueueOperationalSurfaceStatusEntry,
    installQueueAdminAuthMock,
    installAdminQueueApiMocks,
    installQueuePilotApiMocks,
    installQueueOperationalAppsApiMocks,
    getTodayLocalIsoDateForTest,
    json,
    openAdminQueue,
} = require('./helpers/admin-queue-fixtures');

test.describe('Admin turnero sala', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('queueAdminViewModeV1', 'expert');
        });
    });

    test('balance de carga detecta desvio y rebalancea entre consultorios', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'walk_in',
                patientInitials: 'MR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'walk_in',
                patientInitials: 'QV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
            {
                id: 1403,
                ticketCode: 'A-1403',
                queueType: 'appointment',
                patientInitials: 'LT',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_load_balance',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C2 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C2 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c2',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await expect(page.locator('#queueLoadBalance')).toBeVisible();
        await expect(page.locator('#queueLoadBalanceStatus')).toContainText(
            'Gap 3'
        );
        await expect(
            page.locator('#queueLoadBalanceHeadline_c1')
        ).toContainText('absorbiendo de más');
        await expect(
            page.locator('#queueLoadBalanceCapacity_c1')
        ).toContainText('Ceder A-1402 a C2');
        await expect(page.locator('#queueLoadBalancePrimary_c1')).toContainText(
            'Mover A-1402 a C2'
        );

        await page.locator('#queueLoadBalancePrimary_c1').click();

        await expect(page.locator('#queueLoadBalanceStatus')).not.toContainText(
            'Gap 3'
        );
        await expect(page.locator('#queueLoadBalanceLoad_c2')).toContainText(
            'En cola 1'
        );
        await expect(page.locator('#queueLoadBalancePrimary_c2')).toContainText(
            'Llamar A-1402'
        );
    });

    test('fila priorizada convierte cola general en secuencia accionable', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'NV',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'walk_in',
                patientInitials: 'QP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1503,
                ticketCode: 'A-1503',
                queueType: 'walk_in',
                patientInitials: 'CR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_priority_lane',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 3,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 3,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await expect(page.locator('#queuePriorityLane')).toBeVisible();
        await expect(page.locator('#queuePriorityLaneTitle')).toContainText(
            'Fila priorizada'
        );
        await expect(
            page.locator('#queuePriorityLaneHeadline_0')
        ).toContainText('A-1501');
        await expect(page.locator('#queuePriorityLaneMeta_0')).toContainText(
            'General'
        );
        await expect(
            page.locator('#queuePriorityLaneRecommendation_0')
        ).toContainText('Asignar A-1501 a C1');
        await expect(page.locator('#queuePriorityLanePrimary_0')).toContainText(
            'Asignar A-1501 a C1'
        );

        await page.locator('#queuePriorityLanePrimary_0').click();

        await expect(page.locator('#queuePriorityLaneMeta_0')).toContainText(
            'C1'
        );
        await expect(
            page.locator('#queuePriorityLaneRecommendation_0')
        ).toContainText('Llamar A-1501');
        await expect(page.locator('#queuePriorityLanePrimary_0')).toContainText(
            'Llamar A-1501'
        );
    });

    test('bandejas rápidas filtran la tabla desde el hub', async ({ page }) => {
        let queueTickets = [
            {
                id: 1601,
                ticketCode: 'A-1601',
                queueType: 'appointment',
                patientInitials: 'UR',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            },
            {
                id: 1602,
                ticketCode: 'A-1602',
                queueType: 'walk_in',
                patientInitials: 'C1',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1603,
                ticketCode: 'A-1603',
                queueType: 'walk_in',
                patientInitials: 'C2',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1604,
                ticketCode: 'A-1604',
                queueType: 'appointment',
                patientInitials: 'LL',
                priorityClass: 'appointment',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_quick_trays',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await expect(page.locator('#queueQuickTrays')).toBeVisible();
        await expect(
            page.locator('#queueQuickTrayCount_waiting_unassigned')
        ).toContainText('1 ticket');
        await expect(page.locator('#queueQuickTrayCount_called')).toContainText(
            '1 ticket'
        );

        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(
            page.locator('#queueQuickTray_waiting_unassigned')
        ).toHaveAttribute('data-active', 'true');
        await expect(page.locator('#queueTableBody')).toContainText('A-1601');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1602'
        );
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1604'
        );

        await page.locator('#queueQuickTrayAction_called').click();

        await expect(page.locator('#queueQuickTray_called')).toHaveAttribute(
            'data-active',
            'true'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-1604');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1601'
        );
    });

    test('bandeja activa propone siguiente paso y permite limpiar contexto', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1701,
                ticketCode: 'A-1701',
                queueType: 'appointment',
                patientInitials: 'SC',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_active_tray',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(page.locator('#queueActiveTray')).toBeVisible();
        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'Sin consultorio'
        );
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '1 visible'
        );
        await expect(page.locator('#queueActiveTrayHeadline_0')).toContainText(
            'A-1701'
        );
        await expect(
            page.locator('#queueActiveTrayRecommendation_0')
        ).toContainText('Asignar A-1701 a C1');

        await page.locator('#queueActiveTrayPrimary_0').click();

        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '0 visible'
        );
        await expect(page.locator('#queueActiveTrayEmpty')).toContainText(
            'Sin tickets visibles'
        );

        await page.locator('#queueActiveTrayResetBtn').click();

        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'tabla completa'
        );
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            'Sin filtro activo'
        );
    });

    test('rafaga operativa encadena asignar y llamar desde sin consultorio', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1751,
                ticketCode: 'A-1751',
                queueType: 'appointment',
                patientInitials: 'RF',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_tray_burst',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 4,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 4,
                                    details: {
                                        station: 'c1',
                                        stationMode: 'locked',
                                        oneTap: false,
                                        numpadSeen: true,
                                    },
                                },
                                instances: [],
                            },
                            kiosk: {
                                surface: 'kiosk',
                                label: 'Kiosco',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala TV',
                                status: 'unknown',
                                updatedAt: '',
                                ageSec: 0,
                                stale: true,
                                summary: 'Sin heartbeat',
                                latest: null,
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const consultorio = Number(body.consultorio || 0);
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === ticketId
                        ? {
                              ...ticket,
                              assignedConsultorio: consultorio,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === ticketId
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const candidate = queueTickets.find(
                    (ticket) =>
                        ticket.status === 'waiting' &&
                        Number(ticket.assignedConsultorio || 0) === consultorio
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    Number(ticket.id || 0) === Number(candidate.id || 0)
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) =>
                                Number(ticket.id || 0) ===
                                Number(candidate.id || 0)
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await page.locator('#queueQuickTrayAction_waiting_unassigned').click();

        await expect(page.locator('#queueTrayBurst')).toBeVisible();
        await expect(page.locator('#queueTrayBurstTitle')).toContainText(
            'Sin consultorio'
        );
        await expect(page.locator('#queueTrayBurstStatus')).toContainText(
            '2 paso'
        );
        await expect(page.locator('#queueTrayBurstStepTitle_0')).toContainText(
            'Asignar A-1751 a C1'
        );
        await expect(page.locator('#queueTrayBurstStepTitle_1')).toContainText(
            'Llamar A-1751 en C1'
        );

        await page.locator('#queueTrayBurstRunBtn').click();

        await expect.poll(() => queueCallNextRequests).toEqual([1]);
        await expect(page.locator('#queueActiveTrayStatus')).toContainText(
            '0 visible'
        );
        await expect(page.locator('#queueTrayBurstStatus')).toContainText(
            'Bandeja vacía'
        );
        await expect.poll(() => queueTickets[0]?.status).toBe('called');
        await expect.poll(() => queueTickets[0]?.assignedConsultorio).toBe(1);

        await page.locator('#queueQuickTrayAction_called').click();
        await expect(page.locator('#queueTableBody')).toContainText('A-1751');
        await expect(page.locator('#queueTableBody')).toContainText('C1');
        await expect(page.locator('#queueTableBody')).toContainText('Llamado');
    });

    test('numpad por estacion provisionada mantiene lock y persiste tras recarga', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1101,
                ticketCode: 'A-1101',
                queueType: 'appointment',
                patientInitials: 'ES',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1102,
                ticketCode: 'A-1102',
                queueType: 'walk_in',
                patientInitials: 'PL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_c2',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c2&lock=1');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Consultorio fijo'
        );

        await page.keyboard.press('Enter');
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(2);

        await openAdminQueue(page, 'station=c2&lock=1');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Consultorio fijo'
        );

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(2);
    });

    test('lock de estacion bloquea cambio por numpad y evita llamado con foco en input', async ({
        page,
    }) => {
        let queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1111,
                ticketCode: 'A-1111',
                queueType: 'appointment',
                patientInitials: 'NM',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_c1',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                queueTickets = queueTickets.map((ticket) => ({
                    ...ticket,
                    status: 'called',
                    assignedConsultorio: consultorio,
                    calledAt: new Date().toISOString(),
                }));
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C1'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Consultorio fijo'
        );

        await page.keyboard.press('Numpad2');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C1'
        );
        await expect(page.locator('#toastContainer')).toContainText(
            'Cambio bloqueado por modo estación'
        );

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await page.locator('#queueSearchInput').focus();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
    });

    test('modo 1 tecla provisionado completa ticket activo y llama siguiente en consultorio bloqueado', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'walk_in',
                patientInitials: 'BB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_one_tap_c2',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                const consultorio = Number(body.consultorio || 0);
                queueTicketActions.push({ ticketId, action, consultorio });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const nowIso = new Date().toISOString();
                const updatedTicket = {
                    ...queueTickets[ticketIndex],
                    status: 'completed',
                    assignedConsultorio: null,
                    completedAt: nowIso,
                };
                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);

                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(route, {
                        ok: true,
                        data: {
                            ticket: null,
                            queueState,
                        },
                    });
                }

                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c2&lock=1&one_tap=1');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Consultorio fijo'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('Un toque activo');

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect.poll(() => queueTicketActions[0]?.ticketId).toBe(1501);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('completar');
        await expect.poll(() => queueTicketActions[0]?.consultorio).toBe(2);
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(2);
        await page.waitForTimeout(50);
        await expect(page.locator('#queueC2Now')).toContainText('A-1502');

        await openAdminQueue(page, 'station=c2&lock=1&one_tap=1');
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('Un toque activo');
    });

    test('modo 1 tecla sin ticket activo solo llama siguiente (sin completar)', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1511,
                ticketCode: 'A-1511',
                queueType: 'walk_in',
                patientInitials: 'ZX',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_one_tap_only_call',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                queueTicketActions.push(JSON.parse(request.postData() || '{}'));
                return json(route, { ok: false, error: 'No esperado' }, 500);
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);

                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }

                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1&one_tap=1');
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('Un toque activo');

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);
        await expect(page.locator('#queueC1Now')).toContainText('A-1511');
    });

    test('modo bloqueado impide llamado del consultorio opuesto', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1191,
                ticketCode: 'A-1191',
                queueType: 'walk_in',
                patientInitials: 'OV',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_station_override',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                queueTickets = queueTickets.map((ticket) => ({
                    ...ticket,
                    status: 'called',
                    assignedConsultorio: consultorio,
                    calledAt: new Date().toISOString(),
                }));
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c2&lock=1');
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C2'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Consultorio fijo'
        );

        await expect(
            page
                .locator(
                    '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .first()
        ).toBeDisabled();
        await expect.poll(() => queueCallNextRequests.length).toBe(0);
    });

    test('panel de ayuda se abre/cierra con atajo 0 y numpad + re-llama ticket activo en la estacion', async ({
        page,
    }) => {
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1291,
                ticketCode: 'A-1291',
                queueType: 'appointment',
                patientInitials: 'RT',
                priorityClass: 'appt_current',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: new Date(Date.now() - 90 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1292,
                ticketCode: 'A-1292',
                queueType: 'walk_in',
                patientInitials: 'PQ',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_star_help',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const updatedTicket =
                    action === 're-llamar' || action === 'rellamar'
                        ? {
                              ...currentTicket,
                              status: 'called',
                              assignedConsultorio:
                                  Number(
                                      currentTicket.assignedConsultorio || 1
                                  ) || 1,
                              calledAt: new Date().toISOString(),
                          }
                        : currentTicket;

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await page.locator('[data-action="queue-toggle-shortcuts"]').click();
        await expect(page.locator('#queueShortcutPanel')).toBeVisible();
        await page.keyboard.press('Alt+Shift+0');
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await page.keyboard.press('Alt+Shift+0');
        await expect(page.locator('#queueShortcutPanel')).toBeVisible();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: '+',
                    code: 'NumpadAdd',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('re-llamar');
    });

    test('numpad . y - preparan accion sensible y permiten confirmar/cancelar', async ({
        page,
    }) => {
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1293,
                ticketCode: 'A-1293',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
            },
            {
                id: 1294,
                ticketCode: 'A-1294',
                queueType: 'walk_in',
                patientInitials: 'OP',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_star_confirm',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                let updatedTicket = { ...currentTicket };
                if (action === 'completar') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt: nowIso,
                    };
                } else if (action === 'no_show') {
                    updatedTicket = {
                        ...currentTicket,
                        status: 'no_show',
                        assignedConsultorio: null,
                    };
                }

                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');

        await page.keyboard.press('NumpadDecimal');
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
        await expect.poll(() => queueTicketActions.length).toBe(0);

        await page.keyboard.press('NumpadSubtract');
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect.poll(() => queueTicketActions[0]?.action).toBe('no_show');
        await expect.poll(() => queueTicketActions[0]?.ticketId).toBe(1293);
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
    });

    test('numpad cross-platform soporta Enter por location=3 y decimal regional', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketActions = [];
        let queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'walk_in',
                patientInitials: 'BB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'appointment',
                patientInitials: 'CC',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_numpad_location_fallback',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const waitingTicket = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!waitingTicket) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === waitingTicket.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === waitingTicket.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                const body = JSON.parse(request.postData() || '{}');
                const ticketId = Number(body.id || 0);
                const action = String(body.action || '').toLowerCase();
                queueTicketActions.push({ ticketId, action });

                const ticketIndex = queueTickets.findIndex(
                    (ticket) => Number(ticket.id || 0) === ticketId
                );
                if (ticketIndex < 0) {
                    return json(
                        route,
                        { ok: false, error: 'Ticket no encontrado' },
                        404
                    );
                }

                const currentTicket = queueTickets[ticketIndex];
                const nowIso = new Date().toISOString();
                const updatedTicket =
                    action === 'completar'
                        ? {
                              ...currentTicket,
                              status: 'completed',
                              assignedConsultorio: null,
                              completedAt: nowIso,
                          }
                        : currentTicket;
                queueTickets = queueTickets.map((ticket, index) =>
                    index === ticketIndex ? updatedTicket : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);

                return json(route, {
                    ok: true,
                    data: {
                        ticket: updatedTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');
        await page.locator('#queue').click({ position: { x: 18, y: 16 } });

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: '',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ',',
                    code: 'NumpadDecimal',
                    location: 0,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(0);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect
            .poll(() => queueTicketActions[0]?.action)
            .toBe('completar');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: '',
                    location: 3,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(1);
        await expect(page.locator('#queueC1Now')).toContainText('A-1402');

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Delete',
                    code: 'NumpadDecimal',
                    location: 0,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueTicketActions.length).toBe(1);
        await expect(
            page.locator('#queueSensitiveConfirmDialog')
        ).toBeVisible();
        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueTicketActions.length).toBe(2);
        await expect
            .poll(() => queueTicketActions[1]?.action)
            .toBe('completar');
        await expect(page.locator('#queueSensitiveConfirmDialog')).toBeHidden();
    });

    test('calibra tecla externa para llamado y persiste por estacion hasta limpiar binding', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        let queueTickets = [
            {
                id: 1501,
                ticketCode: 'A-1501',
                queueType: 'walk_in',
                patientInitials: 'KE',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1502,
                ticketCode: 'A-1502',
                queueType: 'appointment',
                patientInitials: 'LA',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1503,
                ticketCode: 'A-1503',
                queueType: 'walk_in',
                patientInitials: 'MI',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_custom_call_key',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                const consultorio = Number(body.consultorio || 0);
                queueCallNextRequests.push(consultorio);
                const waitingTicket = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!waitingTicket) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                const nowIso = new Date().toISOString();
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === waitingTicket.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: consultorio,
                              calledAt: nowIso,
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === waitingTicket.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.locator('[data-action="queue-capture-call-key"]').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'Calibración activa'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect(page.locator('#toastContainer')).toContainText(
            'Tecla externa guardada'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);

        await openAdminQueue(page, 'station=c1&lock=1');
        await expect(
            page.locator('[data-action="queue-clear-call-key"]')
        ).toBeVisible();

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
        await expect.poll(() => queueCallNextRequests[1]).toBe(1);

        page.once('dialog', async (dialog) => {
            await dialog.accept();
        });
        await page.locator('[data-action="queue-clear-call-key"]').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'Tecla externa eliminada'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    location: 1,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect.poll(() => queueCallNextRequests.length).toBe(2);
    });

    test('modo práctica simula acciones y no altera cola real hasta salir de práctica', async ({
        page,
    }) => {
        const queueCallNextRequests = [];
        const queueTicketPatchRequests = [];
        let queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'appointment',
                patientInitials: 'PR',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_practice_mode',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-call-next' && request.method() === 'POST') {
                const body = JSON.parse(request.postData() || '{}');
                queueCallNextRequests.push(Number(body.consultorio || 0));
                const candidate = queueTickets.find(
                    (ticket) => ticket.status === 'waiting'
                );
                if (!candidate) {
                    return json(
                        route,
                        { ok: false, error: 'Sin turnos en espera' },
                        409
                    );
                }
                queueTickets = queueTickets.map((ticket) =>
                    ticket.id === candidate.id
                        ? {
                              ...ticket,
                              status: 'called',
                              assignedConsultorio: Number(
                                  body.consultorio || 1
                              ),
                              calledAt: new Date().toISOString(),
                          }
                        : ticket
                );
                queueState = buildQueueStateFromTickets(queueTickets);
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => ticket.id === candidate.id
                        ),
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket' && request.method() === 'PATCH') {
                queueTicketPatchRequests.push(1);
                return json(route, { ok: true, data: { ticket: null } });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, 'station=c1&lock=1');

        await page.locator('[data-action="queue-start-practice"]').click();
        await expect(page.locator('#queuePracticeModeBadge')).toBeVisible();

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page
            .locator(
                '#queueTableBody [data-action="queue-ticket-action"][data-queue-action="completar"]'
            )
            .first()
            .click();
        await expect.poll(() => queueTicketPatchRequests.length).toBe(0);

        await page.locator('[data-action="queue-stop-practice"]').click();
        await expect(page.locator('#queuePracticeModeBadge')).toBeHidden();

        await page.keyboard.press('NumpadEnter');
        await expect.poll(() => queueCallNextRequests.length).toBe(1);
        await expect.poll(() => queueCallNextRequests[0]).toBe(1);
    });

    test('tabla muestra mensaje de filtro activo cuando hay tickets pero no matchean', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1192,
                ticketCode: 'A-1192',
                queueType: 'walk_in',
                patientInitials: 'FI',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_filter_empty',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueTableBody tr').filter({ hasText: 'A-1192' })
        ).toHaveCount(1);

        await page.locator('[data-queue-filter="called"]').first().click();
        await expect(page.locator('#queueTableBody')).toContainText(
            'No hay tickets para filtro'
        );
    });

    test('reimprime tickets visibles en bloque y deja traza operativa', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 991,
                ticketCode: 'A-991',
                queueType: 'appointment',
                patientInitials: 'AA',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 992,
                ticketCode: 'A-992',
                queueType: 'appointment',
                patientInitials: 'BB',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 993,
                ticketCode: 'A-993',
                queueType: 'walk_in',
                patientInitials: 'CC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);
        let reprintRequests = 0;

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reprint_bulk',
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const resource = url.searchParams.get('resource') || '';
            if (resource === 'features') {
                return json(route, {
                    ok: true,
                    data: { admin_sony_ui: ADMIN_UI_VARIANT === 'sony_v2' },
                });
            }

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
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
                        queue_tickets: queueTickets,
                        queueMeta: buildQueueMetaFromState(queueState),
                    },
                });
            }

            if (resource === 'queue-reprint' && request.method() === 'POST') {
                reprintRequests += 1;
                const body = JSON.parse(request.postData() || '{}');
                const id = Number(body.id || 0);
                if (id === 992) {
                    return json(
                        route,
                        {
                            ok: false,
                            data: {
                                ticket: queueTickets.find(
                                    (ticket) => Number(ticket.id || 0) === id
                                ),
                            },
                            printed: false,
                            print: {
                                ok: false,
                                errorCode: 'printer_connect_failed',
                                message: 'connect_failed',
                            },
                        },
                        503
                    );
                }
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets.find(
                            (ticket) => Number(ticket.id || 0) === id
                        ),
                    },
                    printed: true,
                    print: {
                        ok: true,
                        errorCode: '',
                        message: 'ok',
                    },
                });
            }

            if (resource === 'health') {
                return json(route, { ok: true, status: 'ok' });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        page.on('dialog', (dialog) => dialog.accept());

        await openAdminQueue(page, '');
        await expect(page.locator('#queueTableBody tr')).toHaveCount(3);

        await page.locator('[data-action="queue-bulk-reprint"]').click();

        await expect.poll(() => reprintRequests).toBe(3);
        await expect(page.locator('#queueActivityList')).toContainText(
            'Bulk reimpresion'
        );
    });

});
