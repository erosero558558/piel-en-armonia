// @ts-check
const { test, expect } = require('@playwright/test');
const {
    ADMIN_UI_VARIANT,
    buildQueueIdleState,
    buildQueueMetaFromState,
    buildQueuePilotBookedSlotsPayload,
    buildQueuePilotClinicProfile,
    buildQueuePilotHealthDiagnosticsPayload,
    buildQueuePilotHealthPayload,
    buildQueuePilotProfileFingerprint,
    buildQueuePilotSurfaceStatus,
    buildQueueStateFromTickets,
    buildTurneroClinicProfileCatalogStatus,
    buildQueueDesktopOperatorInstance,
    buildQueueDesktopOperatorSurfaceStatus,
    buildQueueOperationalAppsSurfaceStatus,
    buildQueueOperationalSurfaceStatusEntry,
    expectFlowOsRecoveryHostFrozen,
    getTodayLocalIsoDateForTest,
    installAdminQueueApiMocks,
    installQueueAdminAuthMock,
    installQueuePilotApiMocks,
    installQueueOperationalAppsApiMocks,
    json,
    openQueuePilotDetailGroup,
    openAdminQueue,
} = require('./helpers/admin-queue-fixtures');

test.describe('Admin turnero sala', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('queueAdminViewModeV1', 'expert');
        });
    });

    test('queue arranca en basic para el piloto web y solo reabre expert bajo demanda', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();

        await page.addInitScript(() => {
            window.localStorage.removeItem('queueAdminViewModeV1');
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_mode');

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
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
                            generatedAt: nowIso,
                        },
                        turneroClinicProfile: {
                            schema: 'turnero-clinic-profile/v1',
                            clinic_id: 'clinica-norte-demo',
                            branding: {
                                name: 'Clinica Norte',
                                short_name: 'Norte',
                                base_url: 'https://clinica-norte.example',
                            },
                            consultorios: {
                                c1: {
                                    label: 'Dermatología 1',
                                    short_label: 'D1',
                                },
                                c2: {
                                    label: 'Dermatología 2',
                                    short_label: 'D2',
                                },
                            },
                            surfaces: {
                                admin: {
                                    enabled: true,
                                    label: 'Admin web',
                                    route: '/admin.html#queue',
                                },
                                operator: {
                                    enabled: true,
                                    label: 'Operador web',
                                    route: '/operador-turnos.html',
                                },
                                kiosk: {
                                    enabled: true,
                                    label: 'Kiosco web',
                                    route: '/kiosco-turnos.html',
                                },
                                display: {
                                    enabled: true,
                                    label: 'Sala web',
                                    route: '/sala-turnos.html',
                                },
                            },
                            release: {
                                mode: 'suite_v2',
                                admin_mode_default: 'basic',
                                separate_deploy: true,
                                native_apps_blocking: true,
                                notes: [
                                    'Suite V2 por clínica con apps nativas bloqueantes.',
                                    'Admin queda como fallback operativo y soporte.',
                                ],
                            },
                        },
                        turneroClinicProfileMeta: {
                            source: 'remote',
                            cached: false,
                            clinicId: 'clinica-norte-demo',
                            fetchedAt: nowIso,
                        },
                        turneroClinicProfileCatalogStatus:
                            buildTurneroClinicProfileCatalogStatus({
                                clinicId: 'clinica-norte-demo',
                            }),
                        queue_tickets: [],
                        queueMeta: buildQueueMetaFromState({
                            updatedAt: nowIso,
                            waitingCount: 0,
                            calledCount: 0,
                            counts: {
                                waiting: 0,
                                called: 0,
                                completed: 0,
                                no_show: 0,
                                cancelled: 0,
                            },
                            callingNow: [],
                            nextTickets: [],
                        }),
                        queueSurfaceStatus: {
                            operator: {
                                surface: 'operator',
                                label: 'Operador',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 8,
                                stale: false,
                                summary: 'Operador listo para D1.',
                                latest: {
                                    deviceLabel: 'Operador D1',
                                    appMode: 'desktop',
                                    ageSec: 8,
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
                                status: 'warning',
                                updatedAt: new Date().toISOString(),
                                ageSec: 12,
                                stale: false,
                                summary: 'Falta validar una impresión.',
                                latest: {
                                    deviceLabel: 'Kiosco principal',
                                    appMode: 'browser',
                                    ageSec: 12,
                                    details: {
                                        connection: 'live',
                                        pendingOffline: 0,
                                        printerPrinted: false,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/kiosco-turnos.html',
                                        surfaceRouteCurrent:
                                            '/kiosco-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                            display: {
                                surface: 'display',
                                label: 'Sala',
                                status: 'ready',
                                updatedAt: new Date().toISOString(),
                                ageSec: 10,
                                stale: false,
                                summary: 'Sala lista con audio activo.',
                                latest: {
                                    deviceLabel: 'Sala principal',
                                    appMode: 'browser',
                                    ageSec: 10,
                                    details: {
                                        connection: 'live',
                                        bellMuted: false,
                                        bellPrimed: true,
                                        clinicId: 'clinica-norte-demo',
                                        profileSource: 'remote',
                                        surfaceContractState: 'ready',
                                        surfaceRouteExpected:
                                            '/sala-turnos.html',
                                        surfaceRouteCurrent:
                                            '/sala-turnos.html',
                                    },
                                },
                                instances: [],
                            },
                        },
                    },
                });
            }

            if (resource === 'health') {
                return json(route, {
                    ok: true,
                    status: 'ok',
                    checks: {
                        publicSync: {
                            configured: true,
                            healthy: true,
                            state: 'ok',
                            deployedCommit:
                                '3de287e27f2f5034f6f471234567890abcdef12',
                            headDrift: false,
                            ageSeconds: 32,
                            failureReason: '',
                        },
                    },
                });
            }

            if (resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
        });

        await openAdminQueue(page, '');
        await expect(page.locator('#queueOpsConsoleSummary')).toBeVisible();
        await expect(page.locator('#queueOpsConsoleSummary')).toContainText(
            'Qué sigue en recepción'
        );
        await expect(page.locator('#queueOpsConsoleStatus')).toContainText(
            /Recepcion al dia|turno\(s\) ya piden llamado|apoyo\(s\) piden respuesta/i
        );
        await expect(page.locator('#queueOpsConsoleActionBody')).toContainText(
            /accion util|llamar|completar|No hay una accion urgente/i
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'basic'
        );
        await expect(page.locator('#queueAdminViewMode')).toBeVisible();
        await expect(page.locator('#queueAdminViewModeTitle')).toContainText(
            /Norte .*piloto web por clinica/i
        );
        await expect(page.locator('#queueStationControl')).toBeVisible();
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C1'
        );
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Modo: Libre'
        );
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Basic por defecto'
        );
        await expect(page.locator('#queueAdminViewModeClinic')).toContainText(
            'Clinica Norte · clinica-norte-demo'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Despliegue'
        );
        await expect(page.locator('#queueDomainSummary')).toContainText(
            /checklist|piloto web|apps del release/i
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueOpeningChecklist'
        );
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2|Piloto web/i);
        await expect(
            page.locator('#queueOpsPilotReadinessStatus')
        ).toContainText(/bloqueo|cierre|pendiente/i);
        await expect(
            page.locator('#queueOpsPilotReadinessItem_profile')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_catalog')
        ).toContainText('clinica-norte-demo.json');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('Admin, operador, kiosco y sala web');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_publish')
        ).toContainText('public_main_sync sano');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_health')
        ).toContainText('Pendiente');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_smoke')
        ).toContainText('Todavía falta un llamado real o de prueba');
        await expect(page.locator('#queueOpsPilotIssuesTitle')).toContainText(
            'Bloqueos de salida'
        );
        await expect(page.locator('#queueOpsPilotIssuesStatus')).toContainText(
            /bloqueo|pendiente/i
        );
        await expect(
            page.locator('#queueOpsPilotIssuesItem_health')
        ).toContainText('heartbeats');
        await expect(
            page.locator('#queueOpsPilotIssuesItem_smoke')
        ).toContainText('Todavía falta un llamado real o de prueba');
        await expect(
            page.locator('#queuePublicShellDriftStatus')
        ).toContainText(/Listo|Bloqueado/i);
        await expect(page.locator('#queuePublicShellDriftCard')).toContainText(
            'GET /'
        );
        await expect(page.locator('#queuePublicShellDriftCard')).toContainText(
            'stylesheet'
        );
        await expect(page.locator('#queuePublicShellDriftCard')).toContainText(
            'shell script'
        );
        await expect(page.locator('#queuePublicShellDriftCard')).toContainText(
            'GA4'
        );
        await expect(page.locator('#queueOpsPilotCanonTitle')).toContainText(
            'Rutas por clínica'
        );
        await expect(page.locator('#queueOpsPilotCanonStatus')).toContainText(
            '4/4 activas'
        );
        await expect(
            page.locator('#queueOpsPilotCanonItem_admin')
        ).toContainText('Verificada');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-turnos.html');
        await expect(page.locator('#queueOpsPilotCanonSupport')).toContainText(
            '3/4 superficies ya verificaron su ruta'
        );
        await expect(page.locator('#queueOpsPilotSmokeTitle')).toContainText(
            'Secuencia repetible'
        );
        await expect(page.locator('#queueOpsPilotSmokeStatus')).toContainText(
            '3/5 listos'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_admin')
        ).toContainText('Verifica que la cola abra en `basic`');
        await expect(
            page.locator('#queueOpsPilotSmokeAction_admin')
        ).toHaveAttribute(
            'href',
            'https://clinica-norte.example/admin.html#queue'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_kiosk')
        ).toContainText('Pendiente');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_end_to_end')
        ).toContainText('Cerrar smoke');
        await expect(page.locator('#queueOpsPilotHandoffTitle')).toContainText(
            'Paquete de apertura'
        );
        await expect(
            page.locator('#queueOpsPilotHandoffItem_clinic')
        ).toContainText('Clinica Norte · clinica-norte-demo');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_profile_source')
        ).toContainText('remoto verificado');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_catalog')
        ).toContainText('clinica-norte-demo.json verificado');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_publish')
        ).toContainText('commit 3de287e2');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_canon')
        ).toContainText('3/4 rutas verificadas');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_blockers')
        ).toContainText(
            /Bloqueo activo|Señal viva \/ heartbeats|PIN operativo/i
        );
        await expect(
            page.locator('#queueOpsPilotHandoffCopyBtn')
        ).toContainText('Copiar paquete');
        await expect(page.locator('#queueOpeningChecklist')).toBeVisible();
        await expect(page.locator('#queueAppDownloadsCards')).toBeVisible();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queueDeskReply')).toBeHidden();
        await expect(page.locator('#queueInstallConfigurator')).toBeVisible();

        await page.locator('#queueAdminViewModeExpert').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'expert'
        );
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Expert activo'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queueAppDownloadsCards')).toBeVisible();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(page.locator('#queueInstallConfigurator')).toBeVisible();
    });

    test('queue reinicia el estado local del piloto cuando cambia de clínica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const todayLocal = getTodayLocalIsoDateForTest();

        await page.addInitScript(
            ({ today, now }) => {
                window.localStorage.removeItem('queueAdminViewModeV1');
                window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
                window.localStorage.setItem('queueAdminViewModeV1', 'expert');
                window.localStorage.setItem(
                    'queueAdminViewModeClinicV1',
                    'clinica-sur-demo'
                );
                window.localStorage.setItem(
                    'queueInstallPresetV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        surface: 'sala_tv',
                        station: 'c2',
                        lock: true,
                        oneTap: true,
                        platform: 'win',
                    })
                );
                window.localStorage.setItem(
                    'queueOpeningChecklistV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        steps: {
                            operator_ready: true,
                            kiosk_ready: true,
                            sala_ready: true,
                            smoke_ready: true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueShiftHandoffV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        steps: {
                            queue_clear: true,
                            operator_handoff: true,
                            kiosk_handoff: true,
                            sala_handoff: true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOpsLogV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        items: [
                            {
                                id: 'old-clinic-entry',
                                createdAt: now,
                                tone: 'warning',
                                title: 'Clínica Sur',
                                summary:
                                    'No debe sobrevivir al cambio de clínica.',
                                source: 'manual',
                            },
                        ],
                    })
                );
                window.localStorage.setItem(
                    'queueOpsLogFilterV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        filter: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueOpsAlertsV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        reviewed: {
                            operator_warning: {
                                reviewedAt: now,
                            },
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOpsFocusModeV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        mode: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueOpsPlaybookV1',
                    JSON.stringify({
                        date: today,
                        clinicId: 'clinica-sur-demo',
                        modes: {
                            opening: {
                                check_sur: true,
                            },
                            operations: {
                                queue_sur: true,
                            },
                            incidents: {},
                            closing: {},
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueHubDomainViewV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        selection: 'incidents',
                    })
                );
                window.localStorage.setItem(
                    'queueTicketLookupV1',
                    JSON.stringify({
                        clinicId: 'clinica-sur-demo',
                        term: 'A-1999',
                    })
                );
                window.localStorage.setItem(
                    'queueStationMode',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': 'locked',
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueStationConsultorio',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': 2,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueOneTapAdvance',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueNumpadHelpOpen',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': true,
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueCallKeyBindingV1',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': {
                                key: 'Enter',
                                code: 'NumpadEnter',
                                location: 3,
                            },
                        },
                    })
                );
                window.localStorage.setItem(
                    'queueAdminLastSnapshot',
                    JSON.stringify({
                        values: {
                            'clinica-sur-demo': {
                                queueMeta: {
                                    updatedAt: now,
                                    waitingCount: 1,
                                    calledCount: 0,
                                },
                                queueTickets: [
                                    {
                                        id: 1999,
                                        ticketCode: 'A-1999',
                                        queueType: 'walk_in',
                                        patientInitials: 'ZZ',
                                        priorityClass: 'walk_in',
                                        status: 'waiting',
                                        assignedConsultorio: 2,
                                        createdAt: now,
                                    },
                                ],
                                updatedAt: now,
                            },
                        },
                    })
                );
            },
            { today: todayLocal, now: nowIso }
        );

        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
                base_url: 'https://clinica-norte.example',
            },
            consultorios: {
                c1: {
                    label: 'Dermatología 1',
                    short_label: 'D1',
                },
                c2: {
                    label: 'Dermatología 2',
                    short_label: 'D2',
                },
            },
            release: {
                notes: ['Canon web piloto por clínica.'],
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_clinic_scope_reset');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 8,
                    summary: 'Operador listo para D1.',
                    latest: {
                        deviceLabel: 'Operador D1',
                        appMode: 'desktop',
                    },
                    details: {
                        station: 'c1',
                        stationMode: 'locked',
                        oneTap: false,
                        numpadSeen: true,
                        profileSource: 'remote',
                    },
                },
                kiosk: {
                    status: 'warning',
                    ageSec: 12,
                    summary: 'Falta validar una impresión.',
                    latest: {
                        deviceLabel: 'Kiosco principal',
                    },
                    details: {
                        connection: 'live',
                        pendingOffline: 0,
                        printerPrinted: false,
                        profileSource: 'remote',
                    },
                },
                display: {
                    ageSec: 10,
                    summary: 'Sala lista con audio activo.',
                    latest: {
                        deviceLabel: 'Sala principal',
                    },
                    details: {
                        connection: 'live',
                        bellMuted: false,
                        bellPrimed: true,
                        profileSource: 'remote',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '3de287e27f2f5034f6f471234567890abcdef12',
                    ageSeconds: 32,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'basic'
        );
        await expect(page.locator('#queueOpsPilotProgressValue')).toContainText(
            '0/4'
        );

        const scopedState = await page.evaluate(() => {
            const readStorageValue = (key) => {
                const raw = window.localStorage.getItem(key);
                if (!raw) {
                    return null;
                }
                try {
                    return JSON.parse(raw);
                } catch (_error) {
                    return raw;
                }
            };

            return {
                opening: JSON.parse(
                    window.localStorage.getItem('queueOpeningChecklistV1') ||
                        'null'
                ),
                handoff: JSON.parse(
                    window.localStorage.getItem('queueShiftHandoffV1') || 'null'
                ),
                log: JSON.parse(
                    window.localStorage.getItem('queueOpsLogV1') || 'null'
                ),
                logFilter: readStorageValue('queueOpsLogFilterV1'),
                opsAlerts: readStorageValue('queueOpsAlertsV1'),
                opsFocusMode: readStorageValue('queueOpsFocusModeV1'),
                opsPlaybook: readStorageValue('queueOpsPlaybookV1'),
                domainView: readStorageValue('queueHubDomainViewV1'),
                ticketLookup: readStorageValue('queueTicketLookupV1'),
                queueStationMode: readStorageValue('queueStationMode'),
                queueStationConsultorio: readStorageValue(
                    'queueStationConsultorio'
                ),
                queueOneTapAdvance: readStorageValue('queueOneTapAdvance'),
                queueNumpadHelpOpen: readStorageValue('queueNumpadHelpOpen'),
                queueCallKeyBinding: readStorageValue('queueCallKeyBindingV1'),
                queueAdminLastSnapshot: readStorageValue(
                    'queueAdminLastSnapshot'
                ),
                adminViewMode: window.localStorage.getItem(
                    'queueAdminViewModeV1'
                ),
                adminViewModeClinic: window.localStorage.getItem(
                    'queueAdminViewModeClinicV1'
                ),
                installPreset: JSON.parse(
                    window.localStorage.getItem('queueInstallPresetV1') ||
                        'null'
                ),
            };
        });

        expect(scopedState.opening?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.opening?.steps || {}).some(Boolean)
        ).toBe(false);
        expect(scopedState.handoff?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.handoff?.steps || {}).some(Boolean)
        ).toBe(false);
        expect(scopedState.log?.clinicId).toBe('clinica-norte-demo');
        expect(Array.isArray(scopedState.log?.items)).toBe(true);
        expect(scopedState.log.items).toHaveLength(0);
        expect(scopedState.logFilter?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.logFilter?.filter).toBe('all');
        expect(scopedState.opsAlerts?.clinicId).toBe('clinica-norte-demo');
        expect(Object.keys(scopedState.opsAlerts?.reviewed || {})).toHaveLength(
            0
        );
        expect(scopedState.opsFocusMode?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.opsFocusMode?.mode).toBe('auto');
        expect(scopedState.opsPlaybook?.clinicId).toBe('clinica-norte-demo');
        expect(
            Object.values(scopedState.opsPlaybook?.modes || {}).every(
                (mode) => !mode || Object.keys(mode).length === 0
            )
        ).toBe(true);
        expect(scopedState.domainView?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.domainView?.selection).toBe('auto');
        expect(scopedState.ticketLookup).toBeNull();
        expect(
            scopedState.queueStationMode?.values?.['clinica-norte-demo']
        ).toBe('free');
        expect(
            scopedState.queueStationConsultorio?.values?.['clinica-norte-demo']
        ).toBe(1);
        expect(
            scopedState.queueOneTapAdvance?.values?.['clinica-norte-demo']
        ).toBe(false);
        expect(
            scopedState.queueNumpadHelpOpen?.values?.['clinica-norte-demo']
        ).toBe(false);
        expect(
            scopedState.queueCallKeyBinding?.values?.['clinica-norte-demo'] ||
                null
        ).toBeNull();
        expect(
            scopedState.queueAdminLastSnapshot?.values?.['clinica-sur-demo']
                ?.queueTickets?.[0]?.ticketCode
        ).toBe('A-1999');
        expect(scopedState.adminViewMode).toBe('basic');
        expect(scopedState.adminViewModeClinic).toBe('clinica-norte-demo');
        expect(scopedState.installPreset?.clinicId).toBe('clinica-norte-demo');
        expect(scopedState.installPreset?.surface).toBe('operator');
        expect(scopedState.installPreset?.station).toBe('c1');
        expect(scopedState.installPreset?.lock).toBe(true);
        expect(scopedState.installPreset?.oneTap).toBe(false);
        await expect(page.locator('#queueStationModeBadge')).toContainText(
            'Libre'
        );
        await expect(page.locator('#queueStationBadge')).toContainText(
            'Puesto actual: C1'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]')
        ).toContainText('Un toque inactivo');
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();
        await expect(
            page.locator('[data-action="queue-clear-call-key"]')
        ).toBeHidden();
        await expect
            .poll(async () => {
                const lookup = page.locator('#queueTicketLookupInput');
                return (await lookup.count()) === 0
                    ? ''
                    : await lookup.inputValue();
            })
            .toBe('');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-1999'
        );
    });

    test('queue bloquea el piloto web si una superficie reporta otra ruta canónica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-sur-alerta',
            branding: {
                name: 'Clínica Sur',
                legal_name: 'Clínica Sur Piloto',
                short_name: 'Sur',
                base_url: 'https://clinica-sur.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio 1',
                    short_label: 'S1',
                },
                c2: {
                    label: 'Consultorio 2',
                    short_label: 'S2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_route_alert');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    status: 'alert',
                    ageSec: 7,
                    summary:
                        'Operador abrió una ruta distinta al canon del piloto.',
                    latest: {
                        deviceLabel: 'Operador Sur',
                    },
                    details: {
                        station: 'c1',
                        surfaceContractState: 'alert',
                        surfaceRouteCurrent: '/operador-alt.html',
                    },
                },
                kiosk: {
                    ageSec: 10,
                    latest: {
                        deviceLabel: 'Kiosco Sur',
                    },
                },
                display: {
                    ageSec: 9,
                    latest: {
                        deviceLabel: 'Sala Sur',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 12,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('1 superficie');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-alt.html');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('/operador-turnos.html');
        await expect(page.locator('#queueOpsPilotCanonSupport')).toContainText(
            '1 superficie'
        );
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('Bloquea');
    });

    test('queue bloquea el piloto web si el perfil clínico solo existe en fallback local', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const fallbackProfile = {
            schema: 'turnero-clinic-profile/v1',
            clinic_id: 'clinica-cache-demo',
            branding: {
                name: 'Clínica Cache',
                short_name: 'Cache',
                base_url: 'https://clinica-cache.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Cache 1',
                    short_label: 'K1',
                },
                c2: {
                    label: 'Consultorio Cache 2',
                    short_label: 'K2',
                },
            },
            surfaces: {
                admin: {
                    enabled: true,
                    label: 'Admin web',
                    route: '/admin.html#queue',
                },
                operator: {
                    enabled: true,
                    label: 'Operador web',
                    route: '/operador-turnos.html',
                },
                kiosk: {
                    enabled: true,
                    label: 'Kiosco web',
                    route: '/kiosco-turnos.html',
                },
                display: {
                    enabled: true,
                    label: 'Sala web',
                    route: '/sala-turnos.html',
                },
            },
            release: {
                mode: 'suite_v2',
                admin_mode_default: 'basic',
                separate_deploy: true,
                native_apps_blocking: true,
            },
        };

        await page.addInitScript(
            ({ profile, fetchedAt }) => {
                window.localStorage.setItem(
                    'turnero-clinic-profile',
                    JSON.stringify(profile)
                );
                window.localStorage.setItem(
                    'turnero-clinic-profile-meta',
                    JSON.stringify({
                        source: 'fallback_local',
                        cached: true,
                        clinicId: profile.clinic_id,
                        fetchedAt,
                    })
                );
            },
            {
                profile: fallbackProfile,
                fetchedAt: nowIso,
            }
        );

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_local_profile');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicId: 'clinica-cache-demo',
            clinicProfileCatalogStatus: buildTurneroClinicProfileCatalogStatus({
                clinicId: 'clinica-cache-demo',
            }),
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: 'clinica-cache-demo',
                operator: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Operador Cache',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Cache',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Cache',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 18,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await expect(
            page.locator('#queueOpsPilotReadinessItem_profile')
        ).toContainText('cacheado localmente');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_profile_source')
        ).toContainText('fallback local');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_publish')
        ).toContainText('public_main_sync sano');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Verificada');
    });

    test('queue bloquea el piloto web si una superficie reporta clinic_id de otra clínica', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-centro-demo',
            branding: {
                name: 'Clínica Centro',
                short_name: 'Centro',
                base_url: 'https://clinica-centro.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Centro 1',
                    short_label: 'C1',
                },
                c2: {
                    label: 'Consultorio Centro 2',
                    short_label: 'C2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_clinic_drift');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 5,
                    summary: 'Operador reporta otra clínica.',
                    latest: {
                        deviceLabel: 'Operador Centro',
                    },
                    details: {
                        clinicId: 'clinica-sur-demo',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Centro',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Centro',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 14,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await expect(
            page.locator('#queueOpsPilotReadinessItem_surfaces')
        ).toContainText('vivas fuera');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('clinica-sur-demo');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_canon')
        ).toContainText('1 bloqueo');
    });

    test('queue bloquea el piloto web si una superficie trae una firma de perfil desactualizada', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-aurora-demo',
            branding: {
                name: 'Clínica Aurora',
                short_name: 'Aurora',
                base_url: 'https://clinica-aurora.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Aurora 1',
                    short_label: 'A1',
                },
                c2: {
                    label: 'Consultorio Aurora 2',
                    short_label: 'A2',
                },
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_pilot_profile_fingerprint'
        );
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 5,
                    summary: 'Operador con perfil anterior.',
                    latest: {
                        deviceLabel: 'Operador Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Aurora',
                    },
                    details: {
                        profileFingerprint: 'legacy001',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 15,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('legacy001');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('Bloquea');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('firma');
    });

    test('queue advierte en readiness si /health reporta otra clínica activa para el piloto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-lago-demo',
            branding: {
                name: 'Clínica Lago',
                short_name: 'Lago',
                base_url: 'https://clinica-lago.example',
            },
            consultorios: {
                c1: {
                    label: 'Lago 1',
                    short_label: 'L1',
                },
                c2: {
                    label: 'Lago 2',
                    short_label: 'L2',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_pilot_health_clinic');
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
                profileFingerprint: 'lago0001',
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 4,
                    latest: {
                        deviceLabel: 'Operador Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
                kiosk: {
                    ageSec: 5,
                    latest: {
                        deviceLabel: 'Kiosco Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
                display: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Sala Lago',
                    },
                    details: {
                        profileFingerprint: 'lago0001',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '4cb7bf723aa88f53f52b6bcfddf7004bb83faa19',
                    ageSeconds: 11,
                },
                checks: {
                    turneroPilot: {
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId: 'clinica-sur-real',
                        profileFingerprint: 'sur00001',
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        catalogEntryId: 'clinica-sur-real',
                        releaseMode: 'suite_v2',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: true,
                        surfaces: clinicProfile.surfaces,
                    },
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2|Piloto web/i);
        await expect(
            page.locator('#queueOpsPilotReadinessItem_health')
        ).toContainText('clinica-sur-real');
        await expect(
            page.locator('#queueOpsPilotIssuesItem_health')
        ).toContainText('clinica-sur-real');
    });

    test('queue bloquea el piloto web si una superficie usa perfil de respaldo por clinic-profile faltante', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-bosque-demo',
            branding: {
                name: 'Clínica Bosque',
                short_name: 'Bosque',
                base_url: 'https://clinica-bosque.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Bosque 1',
                    short_label: 'B1',
                },
                c2: {
                    label: 'Consultorio Bosque 2',
                    short_label: 'B2',
                },
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_pilot_profile_missing'
        );
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                profileFingerprint: 'bosque123',
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    status: 'alert',
                    ageSec: 5,
                    summary:
                        'No se pudo cargar clinic-profile.json; la superficie quedó con perfil de respaldo y no puede operar como piloto.',
                    latest: {
                        deviceLabel: 'Operador Bosque',
                    },
                    details: {
                        clinicId: 'default-clinic',
                        profileSource: 'fallback_default',
                        profileFingerprint: 'fallback01',
                        surfaceContractState: 'alert',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Bosque',
                    },
                    details: {
                        profileSource: 'remote',
                        profileFingerprint: 'bosque123',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Bosque',
                    },
                    details: {
                        profileSource: 'remote',
                        profileFingerprint: 'bosque123',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    ageSeconds: 18,
                },
            }),
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await expect(
            page.locator('#queueOpsPilotIssuesItem_surface_operator')
        ).toContainText('clinic-profile.json');
        await expect(
            page.locator('#queueOpsPilotCanonItem_operator')
        ).toContainText('perfil de respaldo');
        await expect(
            page.locator('#queueOpsPilotSmokeItem_operator')
        ).toContainText('clinic-profile.json');
        await expect(
            page.locator('#queueOpsPilotHandoffItem_blockers')
        ).toContainText('clinic-profile.json');
    });

    test('queue monta la tarjeta de salida remota debajo del handoff y la deja lista cuando diagnostics y agenda coinciden', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-remota-demo',
            branding: {
                name: 'Clínica Remota',
                short_name: 'Remota',
                base_url: 'https://clinica-remota.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio Remoto 1',
                    short_label: 'R1',
                },
                c2: {
                    label: 'Consultorio Remoto 2',
                    short_label: 'R2',
                },
            },
        });
        const profileFingerprint =
            buildQueuePilotProfileFingerprint(clinicProfile);
        const publicSync = {
            configured: true,
            healthy: true,
            operationallyHealthy: true,
            repoHygieneIssue: false,
            state: 'ok',
            deployedCommit: '75a8d7c5e18a9f4c2b3d4e5f60718293a4b5c6d7',
            headDrift: false,
            ageSeconds: 12,
            expectedMaxLagSeconds: 120,
            failureReason: '',
        };

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_pilot_remote_release'
        );
        await installQueuePilotApiMocks(page, {
            queueState: buildQueueIdleState(nowIso),
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                profileFingerprint,
                fetchedAt: nowIso,
            },
            availability: {
                [nowIso.slice(0, 10)]: ['09:00', '09:30'],
            },
            availabilityMeta: {
                source: 'store',
                mode: 'live',
                generatedAt: nowIso,
                degraded: false,
            },
            bookedSlotsPayload: buildQueuePilotBookedSlotsPayload({
                bookedSlots: ['09:00'],
                meta: {
                    source: 'store',
                    mode: 'live',
                    generatedAt: nowIso,
                    degraded: false,
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync,
            }),
            healthDiagnosticsPayload: buildQueuePilotHealthDiagnosticsPayload({
                clinicId: clinicProfile.clinic_id,
                profileFingerprint,
                publicSync,
                turneroPilot: {
                    available: true,
                    configured: true,
                    ready: true,
                    profileSource: 'file',
                    clinicId: clinicProfile.clinic_id,
                    profileFingerprint,
                    catalogAvailable: true,
                    catalogMatched: true,
                    catalogReady: true,
                    releaseMode: 'suite_v2',
                    adminModeDefault: 'basic',
                    separateDeploy: true,
                    nativeAppsBlocking: true,
                },
                figoConfigured: true,
                figoRecursiveConfig: false,
                calendarConfigured: true,
                calendarReachable: true,
                calendarRequirementMet: true,
                calendarMode: 'google',
                calendarSource: 'primary',
            }),
        });

        await openAdminQueue(page, '');
        await openQueuePilotDetailGroup(page, 'queueOpsPilotValidationGroup');
        await openQueuePilotDetailGroup(page, 'queueOpsPilotAdvancedGroup');

        await expect(
            page.locator('#queueOpsPilotRemoteReleaseReadiness')
        ).toHaveAttribute('data-state', 'ready');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseTitle')
        ).toContainText('Salida remota lista');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseItem_diagnostics')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseItem_identity')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseItem_public_sync')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseItem_availability')
        ).toContainText('Listo');
        await expect(
            page.locator('#queueOpsPilotRemoteReleaseItem_booked_slots')
        ).toContainText('Listo');

        const nextGroupId = await page
            .locator('#queueOpsPilotValidationGroup')
            .evaluate((element) => element.nextElementSibling?.id || '');
        expect(nextGroupId).toBe('queueMultiClinicControlTowerBasicHost');
        const nextAfterBasicGroupId = await page
            .locator('#queueMultiClinicControlTowerBasicHost')
            .evaluate((element) => element.nextElementSibling?.id || '');
        expect(nextAfterBasicGroupId).toBe('queueOpsPilotAdvancedGroup');

        await expect(
            page.locator('#queueOpsPilotReleaseEvidenceHost')
        ).toContainText('Evidencia de salida del piloto');
        await expect(
            page.locator('#queueOpsPilotReleaseEvidenceHost')
        ).toContainText('Copiar resumen');
        await expect(
            page.locator('#queueOpsPilotReleaseEvidenceHost')
        ).toContainText('Descargar JSON');
        await expect(
            page.locator('#queueOpsPilotRolloutGovernorHost')
        ).toContainText('Rollout Governor');
        await expect(
            page.locator('#queueOpsPilotRolloutGovernorHost')
        ).toContainText('Copiar resumen ejecutivo');
        const executiveHostId = await page
            .locator('#queueOpsPilotRolloutGovernorHost')
            .evaluate((element) => element.nextElementSibling?.id || '');
        expect(executiveHostId).toBe(
            'queueOpsPilotExecutivePortfolioStudioHost'
        );
        await expectFlowOsRecoveryHostFrozen(
            page.locator('#queueOpsPilotExecutivePortfolioStudioHost')
        );
        const strategyHostId = await page
            .locator('#queueOpsPilotExecutivePortfolioStudioHost')
            .evaluate((element) => element.nextElementSibling?.id || '');
        expect(strategyHostId).toBe(
            'queueOpsPilotStrategyDigitalTwinStudioHost'
        );
        await expectFlowOsRecoveryHostFrozen(
            page.locator('#queueOpsPilotStrategyDigitalTwinStudioHost')
        );
        const multiClinicHostId = await page
            .locator('#queueOpsPilotStrategyDigitalTwinStudioHost')
            .evaluate((element) => element.nextElementSibling?.id || '');
        expect(multiClinicHostId).toBe('queueMultiClinicControlTowerHost');
        await expectFlowOsRecoveryHostFrozen(
            page.locator('#queueMultiClinicControlTowerHost')
        );
        await expect(
            page.locator('#queueIncidentExecutionWorkbench')
        ).toBeVisible();
        await expect(
            page.locator('#queueIncidentExecutionWorkbenchTitle')
        ).toContainText('Incident Execution Workbench');
        await expect(
            page.locator('#queueIncidentExecutionWorkbenchOwnerBoard')
        ).toBeVisible();
        await expect(
            page.locator('#queueIncidentExecutionWorkbenchAccordion')
        ).toBeVisible();
        await expect(
            page.locator('#queueIncidentExecutionWorkbenchCopyBoardBtn')
        ).toBeVisible();
        await expect(
            page.locator('#queueIncidentExecutionWorkbenchCopyCommandsBtn')
        ).toBeVisible();

        const doingToggle = page
            .locator(
                '#queueIncidentExecutionWorkbench [data-workbench-action="set-step-state"][data-next-state="doing"]'
            )
            .first();
        await expect(doingToggle).toBeVisible();
        await doingToggle.evaluate((element) => element.click());

        const executorKey = (
            await page
                .locator('#queueIncidentExecutionWorkbenchFooter code')
                .first()
                .textContent()
        )?.trim();
        expect(executorKey).toMatch(/^turnero\.release\.incident\.executor\./);
        const storedIncidentState = await page.evaluate((key) => {
            const raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        }, executorKey);

        expect(storedIncidentState).not.toBeNull();
        expect(storedIncidentState.incidents).toBeTruthy();
        expect(
            Object.values(storedIncidentState.incidents).some((incident) =>
                Object.values(incident.steps || {}).some(
                    (step) => step.state === 'doing'
                )
            )
        ).toBe(true);
    });

    test('queue bloquea acciones operativas del admin si admin.html#queue queda fuera del canon del piloto', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const queueCallNextRequests = [];
        const queueTickets = [
            {
                id: 9101,
                ticketCode: 'A-9101',
                queueType: 'appointment',
                patientInitials: 'QP',
                priorityClass: 'appt_current',
                status: 'waiting',
                assignedConsultorio: 1,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];
        const queueState = buildQueueStateFromTickets(queueTickets);
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-admin-bloqueada',
            branding: {
                name: 'Clínica Admin Bloqueada',
                short_name: 'Admin Bloq',
                base_url: 'https://clinica-admin-bloqueada.example',
            },
            consultorios: {
                c1: {
                    label: 'Consultorio 1',
                    short_label: 'AB1',
                },
                c2: {
                    label: 'Consultorio 2',
                    short_label: 'AB2',
                },
            },
            surfaces: {
                admin: {
                    route: '/admin-alt.html#queue',
                },
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_pilot_block');
        await installQueuePilotApiMocks(page, {
            queueTickets,
            queueState,
            clinicProfile,
            clinicProfileMeta: {
                source: 'remote',
                cached: false,
                clinicId: clinicProfile.clinic_id,
                fetchedAt: nowIso,
            },
            queueSurfaceStatus: buildQueuePilotSurfaceStatus({
                updatedAt: nowIso,
                clinicId: clinicProfile.clinic_id,
                operator: {
                    ageSec: 6,
                    latest: {
                        deviceLabel: 'Operador Bloq',
                    },
                },
                kiosk: {
                    ageSec: 7,
                    latest: {
                        deviceLabel: 'Kiosco Bloq',
                    },
                },
                display: {
                    ageSec: 8,
                    latest: {
                        deviceLabel: 'Sala Bloq',
                    },
                },
            }),
            healthPayload: buildQueuePilotHealthPayload({
                publicSync: {
                    deployedCommit: '03729fced585d79a66e6dd40e026cdb9fef3fdc7',
                    ageSeconds: 20,
                },
            }),
            handleRoute: async ({
                route,
                resource,
                intendedMethod,
                fulfillJson,
            }) => {
                if (
                    resource === 'queue-call-next' &&
                    intendedMethod === 'POST'
                ) {
                    queueCallNextRequests.push(
                        route.request().postData() || ''
                    );
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            queueState,
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await openAdminQueue(page, '');
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText(/Turnero V2 bloqueado|Piloto web bloqueado/i);
        await page
            .locator(
                '#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="1"]'
            )
            .click();
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        });
        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);

        await page.locator('#queueConsultorioPrimary_c1').click();
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar esta clínica desde admin'
        );
        await expect.poll(() => queueCallNextRequests.length).toBe(0);
    });

});
