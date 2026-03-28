// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    ADMIN_UI_VARIANT,
    adminUrl,
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

    test('escenarios de ingreso separan con cita y sin cita sobre la proyeccion actual', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1331,
                ticketCode: 'A-1331',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1332,
                ticketCode: 'A-1332',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1333,
                ticketCode: 'A-1333',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1334,
                ticketCode: 'A-1334',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1335,
                ticketCode: 'A-1335',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_scenarios',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueScenarioDeck')).toBeVisible();
        await expect(page.locator('#queueScenarioDeckTitle')).toContainText(
            'Escenarios de ingreso'
        );
        await expect(page.locator('#queueScenarioDeckSummary')).toContainText(
            'Si llega con cita conviene C2'
        );
        await expect(
            page.locator('#queueScenarioHeadline_appointment')
        ).toContainText('Con cita: C2');
        await expect(
            page.locator('#queueScenarioHeadline_walkin')
        ).toContainText('Sin cita: C1');
        await expect(
            page.locator('#queueScenarioOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(page.locator('#queueScenarioOpen_walkin')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c1&lock=1/
        );
    });

    test('guion de recepcion compacta general con cita sin cita y siguiente ingreso', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1341,
                ticketCode: 'A-1341',
                queueType: 'appointment',
                patientInitials: 'RS',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1342,
                ticketCode: 'A-1342',
                queueType: 'walk_in',
                patientInitials: 'LM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1343,
                ticketCode: 'A-1343',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                id: 1344,
                ticketCode: 'A-1344',
                queueType: 'walk_in',
                patientInitials: 'AD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1345,
                ticketCode: 'A-1345',
                queueType: 'walk_in',
                patientInitials: 'BT',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_script',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionScript')).toBeVisible();
        await expect(page.locator('#queueReceptionScriptTitle')).toContainText(
            'Guion de recepción'
        );
        await expect(
            page.locator('#queueReceptionScriptHeadline_0')
        ).toContainText('A-1344 -> C2');
        await expect(
            page.locator('#queueReceptionScriptHeadline_1')
        ).toContainText('Enviar a C2');
        await expect(
            page.locator('#queueReceptionScriptHeadline_2')
        ).toContainText('Enviar a C1');
        await expect(
            page.locator('#queueReceptionScriptHeadline_3')
        ).toContainText('Ingreso 1 -> C2');
        await expect(
            page.locator('#queueReceptionScriptOpen_0')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('recepcion simultanea divide con cita y sin cita cuando ambos chocan en el mismo carril', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1361,
                ticketCode: 'A-1361',
                queueType: 'walk_in',
                patientInitials: 'MV',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1362,
                ticketCode: 'A-1362',
                queueType: 'appointment',
                patientInitials: 'CP',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
            },
            {
                id: 1363,
                ticketCode: 'A-1363',
                queueType: 'appointment',
                patientInitials: 'LT',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1364,
                ticketCode: 'A-1364',
                queueType: 'walk_in',
                patientInitials: 'AR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_collision',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionCollision')).toBeVisible();
        await expect(
            page.locator('#queueReceptionCollisionTitle')
        ).toContainText('Recepción simultánea');
        await expect(
            page.locator('#queueReceptionCollisionSummary')
        ).toContainText('con cita entra por C2 y sin cita se desvía a C1');
        await expect(
            page.locator('#queueReceptionCollisionStatus')
        ).toContainText('Cruce resuelto con preparación');
        await expect(
            page.locator('#queueReceptionCollisionHeadline_appointment')
        ).toContainText('1. Con cita -> C2');
        await expect(
            page.locator('#queueReceptionCollisionHeadline_walkin')
        ).toContainText('2. Sin cita -> C1');
        await expect(
            page.locator('#queueReceptionCollisionDetail_walkin')
        ).toContainText('Desvía el sin cita a C1');
        await expect(
            page.locator('#queueReceptionCollisionOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(
            page.locator('#queueReceptionCollisionOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('semaforo de recepcion marca carril abierto y carril solo citas', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1381,
                ticketCode: 'A-1381',
                queueType: 'appointment',
                patientInitials: 'NR',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1382,
                ticketCode: 'A-1382',
                queueType: 'walk_in',
                patientInitials: 'SP',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1383,
                ticketCode: 'A-1383',
                queueType: 'walk_in',
                patientInitials: 'GM',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
            },
            {
                id: 1384,
                ticketCode: 'A-1384',
                queueType: 'walk_in',
                patientInitials: 'TR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_reception_lights',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueReceptionLights')).toBeVisible();
        await expect(page.locator('#queueReceptionLightsTitle')).toContainText(
            'Semáforo de recepción'
        );
        await expect(
            page.locator('#queueReceptionLightsSummary')
        ).toContainText('C2 queda abierto para sin cita');
        await expect(
            page.locator('#queueReceptionLightsHeadline_c1')
        ).toContainText('C1 reservar para citas');
        await expect(
            page.locator('#queueReceptionLightsBadge_c1')
        ).toContainText('Solo citas');
        await expect(
            page.locator('#queueReceptionLightsRules_c1')
        ).toContainText('Con cita: preferido');
        await expect(
            page.locator('#queueReceptionLightsHeadline_c2')
        ).toContainText('C2 abierto para recepción');
        await expect(
            page.locator('#queueReceptionLightsBadge_c2')
        ).toContainText('Abierto');
        await expect(
            page.locator('#queueReceptionLightsRules_c2')
        ).toContainText('Sin cita: preferido');
        await expect(
            page.locator('#queueReceptionLightsOpen_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('ventana estimada resume la proxima apertura util por consultorio', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1401,
                ticketCode: 'A-1401',
                queueType: 'appointment',
                patientInitials: 'DA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1402,
                ticketCode: 'A-1402',
                queueType: 'walk_in',
                patientInitials: 'FB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1403,
                ticketCode: 'A-1403',
                queueType: 'walk_in',
                patientInitials: 'GC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1404,
                ticketCode: 'A-1404',
                queueType: 'walk_in',
                patientInitials: 'HD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_window_deck',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueWindowDeck')).toBeVisible();
        await expect(page.locator('#queueWindowDeckTitle')).toContainText(
            'Ventana estimada'
        );
        await expect(page.locator('#queueWindowDeckSummary')).toContainText(
            'cita -> C1 (~1m), sin cita -> C2 (~22m)'
        );
        await expect(page.locator('#queueWindowHeadline_c1')).toContainText(
            'C1 abre ventana en ~1m'
        );
        await expect(page.locator('#queueWindowBadge_c1')).toContainText('~1m');
        await expect(page.locator('#queueWindowRules_c1')).toContainText(
            'Cita: ~1m · preferido'
        );
        await expect(page.locator('#queueWindowHeadline_c2')).toContainText(
            'C2 abre ventana en ~22m'
        );
        await expect(page.locator('#queueWindowBadge_c2')).toContainText(
            '~22m'
        );
        await expect(page.locator('#queueWindowRules_c2')).toContainText(
            'Sin cita: ~22m · preferido'
        );
        await expect(page.locator('#queueWindowOpen_c1')).toHaveAttribute(
            'href',
            /operador-turnos\.html\?station=c1&lock=1/
        );
    });

    test('respuesta de mostrador entrega frases listas para cita sin cita y llegada doble', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1411,
                ticketCode: 'A-1411',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1412,
                ticketCode: 'A-1412',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1413,
                ticketCode: 'A-1413',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1414,
                ticketCode: 'A-1414',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_reply',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskReply')).toBeVisible();
        await expect(page.locator('#queueDeskReplyTitle')).toContainText(
            'Respuesta de mostrador'
        );
        await expect(
            page.locator('#queueDeskReplyPhrase_appointment')
        ).toContainText('Le paso por C1; la ventana visible está en ~1m.');
        await expect(
            page.locator('#queueDeskReplyPhrase_walkin')
        ).toContainText(
            'Le ubico por C2; la siguiente ventana visible está en ~22m.'
        );
        await expect(
            page.locator('#queueDeskReplyPhrase_collision')
        ).toContainText(
            'Si llegan dos juntas: con cita por C1 y sin cita por C2.'
        );
        await expect(
            page.locator('#queueDeskReplyOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('plan b de recepcion deja una alternativa visible para cita y sin cita', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1511,
                ticketCode: 'A-1511',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1512,
                ticketCode: 'A-1512',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1513,
                ticketCode: 'A-1513',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1514,
                ticketCode: 'A-1514',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_fallback',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskFallback')).toBeVisible();
        await expect(page.locator('#queueDeskFallbackTitle')).toContainText(
            'Plan B de recepción'
        );
        await expect(
            page.locator('#queueDeskFallbackPhrase_appointment')
        ).toContainText(
            'Primero le ofrecería C1 (~1m). Si no le sirve, la alternativa visible es C2 (~22m).'
        );
        await expect(
            page.locator('#queueDeskFallbackPhrase_walkin')
        ).toContainText(
            'Primero le ofrecería C2 (~22m). Si no le sirve, la alternativa visible es C1 (~1m).'
        );
        await expect(
            page.locator('#queueDeskFallbackOpen_appointment')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('objeciones rápidas responde a lo más rápido espera corta y la otra opción', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1611,
                ticketCode: 'A-1611',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1612,
                ticketCode: 'A-1612',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1613,
                ticketCode: 'A-1613',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1614,
                ticketCode: 'A-1614',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_objections',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskObjections')).toBeVisible();
        await expect(page.locator('#queueDeskObjectionsTitle')).toContainText(
            'Objeciones rápidas'
        );
        await expect(
            page.locator('#queueDeskObjectionsPhrase_first_available')
        ).toContainText('Lo más rápido visible ahora es C1 (~1m).');
        await expect(
            page.locator('#queueDeskObjectionsPhrase_short_wait')
        ).toContainText('Sí le puedo ofrecer una espera corta por C1 (~1m).');
        await expect(
            page.locator('#queueDeskObjectionsPhrase_other_lane')
        ).toContainText(
            'Si quiere la otra opción, hoy el carril alterno visible es C2 (~22m).'
        );
        await expect(
            page.locator('#queueDeskObjectionsOpen_other_lane')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
    });

    test('cierre de mostrador deja la frase final y la regla de revalidación', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1711,
                ticketCode: 'A-1711',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1712,
                ticketCode: 'A-1712',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1713,
                ticketCode: 'A-1713',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1714,
                ticketCode: 'A-1714',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_desk_closeout',
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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskCloseout')).toBeVisible();
        await expect(page.locator('#queueDeskCloseoutTitle')).toContainText(
            'Cierre de mostrador'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_appointment')
        ).toContainText(
            'Le dejo por C1; conserve su ticket y esté atento a la TV o campanilla. Si pasa más de ~1m sin llamado, me avisa.'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_walkin')
        ).toContainText(
            'Le dejo por C2; conserve su ticket y esté atento a la TV o campanilla. Si pasa más de ~22m sin llamado, me avisa.'
        );
        await expect(
            page.locator('#queueDeskCloseoutPhrase_if_not_called')
        ).toContainText(
            'Si no lo llaman dentro de ~1m, vuelva a mostrador y revalidamos el carril sin perder el turno.'
        );
        await expect(
            page.locator('#queueDeskCloseoutOpen_if_not_called')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('revalidación de espera guía qué hacer si el paciente vuelve a preguntar', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1811,
                ticketCode: 'A-1811',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1812,
                ticketCode: 'A-1812',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1813,
                ticketCode: 'A-1813',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1814,
                ticketCode: 'A-1814',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_recheck');

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskRecheck')).toBeVisible();
        await expect(page.locator('#queueDeskRecheckTitle')).toContainText(
            'Revalidación de espera'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_appointment')
        ).toContainText(
            'Si vuelve antes de ~1m, sigue por C1. Si ya pasó esa ventana, revalídelo aquí y confirme si mantiene C1.'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_walkin')
        ).toContainText(
            'Si vuelve y ya pasó ~22m, revalídelo aquí: hoy conviene moverlo a C1 (~1m) sin perder el turno.'
        );
        await expect(
            page.locator('#queueDeskRecheckPhrase_timing')
        ).toContainText(
            'Si vuelve antes de ~1m, mantenga el carril actual y pídale seguir atento. Si ya pasó, revalide aquí y compare C1 (~1m) contra C2 (~22m) antes de moverlo.'
        );
        await expect(
            page.locator('#queueDeskRecheckOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('cambio de carril sugerido explica cuándo mover o sostener el carril', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1911,
                ticketCode: 'A-1911',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1912,
                ticketCode: 'A-1912',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 1913,
                ticketCode: 'A-1913',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1914,
                ticketCode: 'A-1914',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_shift');

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskShift')).toBeVisible();
        await expect(page.locator('#queueDeskShiftTitle')).toContainText(
            'Cambio de carril sugerido'
        );
        await expect(
            page.locator('#queueDeskShiftPhrase_appointment')
        ).toContainText(
            'No conviene moverlo de C1 a C2 ahora: el carril actual sigue mejor (~1m vs ~22m).'
        );
        await expect(
            page.locator('#queueDeskShiftPhrase_walkin')
        ).toContainText(
            'Si acepta moverse de C2 a C1, hoy baja la espera visible de ~22m a ~1m.'
        );
        await expect(page.locator('#queueDeskShiftPhrase_rule')).toContainText(
            'Solo cambie de carril si gana al menos ~8m o si ya venció la ventana prometida; hoy C1 le saca ~21m a C2.'
        );
        await expect(
            page.locator('#queueDeskShiftOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('promesa segura resume lo que recepción sí puede comprometer', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 2011,
                ticketCode: 'A-2011',
                queueType: 'appointment',
                patientInitials: 'JA',
                priorityClass: 'appt_overdue',
                status: 'called',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 2012,
                ticketCode: 'A-2012',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'called',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
                calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            },
            {
                id: 2013,
                ticketCode: 'A-2013',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 2014,
                ticketCode: 'A-2014',
                queueType: 'walk_in',
                patientInitials: 'MD',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_promise');

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskPromise')).toBeVisible();
        await expect(page.locator('#queueDeskPromiseTitle')).toContainText(
            'Promesa segura'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_appointment')
        ).toContainText(
            'Lo seguro es prometer C1 con una ventana visible de ~1m y pedirle que siga atento a la TV o campanilla.'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_walkin')
        ).toContainText(
            'Lo seguro es confirmar primero si acepta moverse de C2 a C1; si sí, promete ~1m. Si no, mantén C2 sin prometer un recorte extra.'
        );
        await expect(
            page.locator('#queueDeskPromisePhrase_rule')
        ).toContainText(
            'Promete solo la ventana visible y el paso siguiente; hoy la promesa más segura es C1 (~1m) y revalidar si pasa esa ventana o si el otro carril gana al menos ~8m.'
        );
        await expect(
            page.locator('#queueDeskPromiseOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('escalación sugerida marca cuándo recepción debe abrir operador y cuándo sostener', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3012,
                ticketCode: 'A-3012',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3013,
                ticketCode: 'A-3013',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_desk_escalation');

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalation')).toBeVisible();
        await expect(page.locator('#queueDeskEscalationTitle')).toContainText(
            'Escalación sugerida'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_appointment')
        ).toContainText(
            'Todavía no hace falta escalar: sostén C1, conserva la promesa visible de ahora y revalida solo si rebasa esa ventana o aparece un bloqueo vivo.'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_walkin')
        ).toContainText(
            'Si el paciente ya no acepta C2, sí conviene escalar a C1: hoy el recorte visible justifica moverlo antes de seguir prometiendo sobre C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationPhrase_rule')
        ).toContainText(
            'Escala solo cuando la promesa segura ya no aguanta: ventana vencida, bloqueo vivo o ticket en SLA crítico.'
        );
        await expect(
            page.locator('#queueDeskEscalationOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('escala verbal baja la escalación a una frase operativa de mostrador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3112,
                ticketCode: 'A-3112',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3113,
                ticketCode: 'A-3113',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_talk'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationTalk')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationTalkTitle')
        ).toContainText('Escala verbal');
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_appointment')
        ).toContainText(
            'Por ahora lo mantengo por C1 con una ventana visible de ahora; si esa referencia se corre o cambia la carga, le confirmo otra opción sin quitarle este carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_walkin')
        ).toContainText(
            'Le voy a revisar una opción mejor por C1; si queda abierta, le confirmo el cambio sin perder la referencia actual por C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkPhrase_rule')
        ).toContainText(
            'Si ya toca escalar, primero diga que va a revisar la opción y confirme el cambio solo después de abrir el operador.'
        );
        await expect(
            page.locator('#queueDeskEscalationTalkOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('confirmación de escala cierra la conversación cuando el carril ya quedó resuelto', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3212,
                ticketCode: 'A-3212',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3213,
                ticketCode: 'A-3213',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_confirm'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationConfirm')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationConfirmTitle')
        ).toContainText('Confirmación de escala');
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_appointment')
        ).toContainText(
            'Por ahora sigue por C1 con una ventana visible de ahora; si hay un cambio real de carril, se lo confirmamos antes de moverlo.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_walkin')
        ).toContainText(
            'Ya quedó por C1; desde aquí mantenga el ticket a mano y siga la TV o campanilla. Si la referencia vuelve a cambiar, se lo confirmamos sin devolverlo a C2.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmPhrase_rule')
        ).toContainText(
            'Cierre la conversación confirmando únicamente el carril que ya quedó operativo; si todavía está en revisión, mantenga la referencia actual y diga que le avisará el ajuste.'
        );
        await expect(
            page.locator('#queueDeskEscalationConfirmOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('seguimiento de escala explica qué hacer si el paciente vuelve a preguntar tras el cambio', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3312,
                ticketCode: 'A-3312',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3313,
                ticketCode: 'A-3313',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_followup'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(
            page.locator('#queueDeskEscalationFollowup')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationFollowupTitle')
        ).toContainText('Seguimiento de escala');
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_appointment')
        ).toContainText(
            'Si vuelve a preguntar, manténgalo por C1 y recuérdele que la referencia visible actual es ahora; solo revalide aquí si esa ventana ya pasó o cambia el carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_walkin')
        ).toContainText(
            'Si vuelve a preguntar, manténgalo por C1 y recuérdele que la referencia visible actual es ahora; solo revalide aquí si esa ventana ya pasó o cambia el carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupPhrase_rule')
        ).toContainText(
            'Después de confirmar la escala, el seguimiento es simple: sostenga el carril ya resuelto y reabra la conversación solo si se vence la ventana visible o si el hub vuelve a marcar otro cambio real.'
        );
        await expect(
            page.locator('#queueDeskEscalationFollowupOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('reapertura de escala indica cómo reabrir si la nueva referencia ya se venció', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3412,
                ticketCode: 'A-3412',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3413,
                ticketCode: 'A-3413',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_reopen'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationReopen')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReopenTitle')
        ).toContainText('Reapertura de escala');
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_appointment')
        ).toContainText(
            'Si la referencia por C1 ya se venció, reabra solo para actualizar la nueva ventana visible (ahora) y confirmar que sigue por el mismo carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_walkin')
        ).toContainText(
            'Si ya se venció la referencia por C2, reabra la conversación y ofrezca moverlo a C1: hoy la nueva ventana visible baja a ahora.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenPhrase_rule')
        ).toContainText(
            'Si la escala confirmada vuelve a vencerse, primero actualice la ventana visible del carril resuelto y solo ofrezca otro cambio si el otro carril gana al menos ~8m.'
        );
        await expect(
            page.locator('#queueDeskEscalationReopenOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('límite de reapertura marca cuándo dejar de ajustar verbalmente y abrir operador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3512,
                ticketCode: 'A-3512',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3513,
                ticketCode: 'A-3513',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_limit'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationLimit')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationLimitTitle')
        ).toContainText('Límite de reapertura');
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_appointment')
        ).toContainText(
            'Si vuelve a correrse otra vez, no prometa una tercera ventana verbal; abra C1 y confirme ahí si se sostiene el mismo carril o si se mueve de verdad.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_walkin')
        ).toContainText(
            'Si vuelve a correrse otra vez, no prometa una tercera ventana verbal; abra C1 y confirme ahí si se sostiene el mismo carril o si se mueve de verdad.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitPhrase_rule')
        ).toContainText(
            'Después de una reapertura, la siguiente conversación ya no va por guion: o actualiza una sola ventana o abre operador; evita prometer un tercer ajuste desde mostrador.'
        );
        await expect(
            page.locator('#queueDeskEscalationLimitOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('puente a operación deja la frase breve para pasar el caso al operador', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 3612,
                ticketCode: 'A-3612',
                queueType: 'walk_in',
                patientInitials: 'KB',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
            {
                id: 3613,
                ticketCode: 'A-3613',
                queueType: 'walk_in',
                patientInitials: 'LC',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: 2,
                createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_bridge'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationBridge')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBridgeTitle')
        ).toContainText('Puente a operación');
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_appointment')
        ).toContainText(
            'Ya no le voy a prometer otra ventana aquí: lo validamos con C1 y en cuanto quede resuelto le confirmamos si sigue igual o cambia de carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_walkin')
        ).toContainText(
            'Ya no le voy a prometer otra ventana aquí: lo validamos con C1 y en cuanto quede resuelto le confirmamos si sigue igual o cambia de carril.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgePhrase_rule')
        ).toContainText(
            'Cuando el caso ya llegó a límite, cierre el mostrador con un puente corto a operación: abra el operador, evite discutir otra ventana y confirme una sola salida.'
        );
        await expect(
            page.locator('#queueDeskEscalationBridgeOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('brief para operador resume el contexto minimo para la escalacion', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1201,
                ticketCode: 'A-1201',
                queueType: 'appointment',
                patientInitials: 'LM',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
            {
                id: 1202,
                ticketCode: 'A-1202',
                queueType: 'walk_in',
                patientInitials: 'RS',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_brief'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationBrief')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBriefTitle')
        ).toContainText('Brief para operador');
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_appointment')
        ).toContainText(
            'La cita ya fue revalidada en mostrador; valide con C1 si sostiene el carril actual o si conviene moverla ahora mismo.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_walkin')
        ).toContainText(
            'El ingreso sin cita ya agotó el margen verbal en mostrador; revise con C1 si entra por hueco inmediato o si sigue en cola general sin otra promesa.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefPhrase_rule')
        ).toContainText(
            'Al pasar el caso, resuma qué se agotó en mostrador y cuál es la única decisión pendiente: sostener, mover o recalcular. Nada más.'
        );
        await expect(
            page.locator('#queueDeskEscalationBriefOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('retorno a mostrador deja lista la respuesta cerrada desde operacion', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1211,
                ticketCode: 'A-1211',
                queueType: 'appointment',
                patientInitials: 'PM',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
            },
            {
                id: 1212,
                ticketCode: 'A-1212',
                queueType: 'walk_in',
                patientInitials: 'DG',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_return'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(page.locator('#queueDeskEscalationReturn')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReturnTitle')
        ).toContainText('Retorno a mostrador');
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_appointment')
        ).toContainText(
            'Operación ya lo está validando con C1; en cuanto cierre, le confirmamos si sigue por ese carril o si pasa directo al ajuste que sí le convenga.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_walkin')
        ).toContainText(
            'Operación ya lo está validando con C1; en cuanto cierre, le confirmamos si entra por hueco inmediato o si sigue en cola general con la ventana actualizada.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnPhrase_rule')
        ).toContainText(
            'Cuando operación responda, mostrador comunica una sola salida cerrada: sostener, mover o recalcular. No vuelve a abrir la negociación desde cero.'
        );
        await expect(
            page.locator('#queueDeskEscalationReturnOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('resolucion devuelta deja la frase final cuando operacion ya cerro la decision', async ({
        page,
    }) => {
        const queueTickets = [
            {
                id: 1221,
                ticketCode: 'A-1221',
                queueType: 'appointment',
                patientInitials: 'SV',
                priorityClass: 'appointment',
                status: 'waiting',
                assignedConsultorio: 'c1',
                createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
                scheduledAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            },
            {
                id: 1222,
                ticketCode: 'A-1222',
                queueType: 'walk_in',
                patientInitials: 'TN',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);

        await page.addInitScript(() => {
            window.localStorage.setItem('queueOpsFocusModeV1', 'operations');
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_desk_escalation_resolution'
        );

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

            return json(route, { ok: true, data: {} });
        });

        await page.goto('/admin.html#queue');
        await page.locator('a[href="#queue"]').last().click();

        await expect(
            page.locator('#queueDeskEscalationResolution')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationResolutionTitle')
        ).toContainText('Resolución devuelta');
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_appointment')
        ).toContainText(
            'Operación ya cerró la validación con C1; seguimos con la salida confirmada y, si aparece un ajuste real, se lo avisamos aquí sin volver a prometer otra ventana.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_walkin')
        ).toContainText(
            'Operación ya cerró la validación con C1; seguimos con la salida confirmada y, si cambia algo real, se lo avisamos aquí sin reabrir la fila desde cero.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionPhrase_rule')
        ).toContainText(
            'Cuando operación ya respondió, mostrador comunica la salida confirmada y cierra el caso. Solo se reabre si aparece una señal nueva, no por presión verbal.'
        );
        await expect(
            page.locator('#queueDeskEscalationResolutionOpen_walkin')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c1&lock=1/);
    });

    test('radar de espera prioriza cola general antigua y mueve el siguiente foco', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1301,
                ticketCode: 'A-1301',
                queueType: 'walk_in',
                patientInitials: 'MR',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
            },
            {
                id: 1302,
                ticketCode: 'A-1302',
                queueType: 'walk_in',
                patientInitials: 'QL',
                priorityClass: 'walk_in',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
            },
        ];
        let queueState = buildQueueStateFromTickets(queueTickets);

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_queue_wait_radar',
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
                                ageSec: 5,
                                stale: false,
                                summary: 'Equipo listo para operar en C1 fijo.',
                                latest: {
                                    deviceLabel: 'Operador C1 fijo',
                                    appMode: 'desktop',
                                    ageSec: 5,
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

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );

        await expect(page.locator('#queueWaitRadar')).toBeVisible();
        await expect(page.locator('#queueWaitRadarStatus')).toContainText(
            'en rojo'
        );
        await expect(
            page.locator('#queueWaitRadarHeadline_general')
        ).toContainText('A-1301');
        await expect(
            page.locator('#queueWaitRadarOldest_general')
        ).toContainText('A-1301');
        await expect(
            page.locator('#queueWaitRadarPrimary_general')
        ).toContainText('Asignar A-1301 a C1');

        await page.locator('#queueWaitRadarPrimary_general').click();

        await expect(
            page.locator('#queueWaitRadarOldest_general')
        ).toContainText('A-1302');
        await expect(page.locator('#queueWaitRadarPrimary_c1')).toContainText(
            'Llamar A-1301'
        );
        await expect(page.locator('#queueWaitRadarPressure_c1')).toContainText(
            'Propios 1'
        );
    });
});
