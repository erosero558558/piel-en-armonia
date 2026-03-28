// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildEvidenceSnapshot,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
} = require('../tests-node/turnero-release-test-fixtures.js');
const {
    adminUrl,
    buildQueueMetaFromState,
    buildQueueDesktopOperatorInstance,
    buildQueueDesktopOperatorSurfaceStatus,
    buildQueueIdleState,
    buildQueuePilotBookedSlotsPayload,
    buildQueueOperationalAppsSurfaceStatus,
    buildQueueOperationalSurfaceStatusEntry,
    buildQueuePilotClinicProfile,
    buildQueuePilotHealthDiagnosticsPayload,
    buildQueuePilotHealthPayload,
    buildQueuePilotProfileFingerprint,
    buildQueuePilotSurfaceStatus,
    buildQueueStateFromTickets,
    buildTurneroClinicProfileCatalogStatus,
    expectFlowOsRecoveryHostFrozen,
    installAdminQueueApiMocks,
    installQueueAdminAuthMock,
    installQueueOperationalAppsApiMocks,
    installQueuePilotApiMocks,
    getTodayLocalIsoDateForTest,
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

    test('queue muestra hub de apps operativas con desktop y Android TV', async ({
        page,
    }) => {
        test.setTimeout(180000);
        let dataRequestCount = 0;

        await page.addInitScript(() => {
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 120;
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_apps_hub');

        await installQueueOperationalAppsApiMocks(page, {
            queueSurfaceStatus: () => {
                dataRequestCount += 1;
                const updatedAt = new Date().toISOString();
                const operatorAge = dataRequestCount > 1 ? 3 : 8;
                return buildQueueOperationalAppsSurfaceStatus({
                    operator: buildQueueDesktopOperatorSurfaceStatus({
                        updatedAt,
                        status: 'ready',
                        ageSec: operatorAge,
                        summary:
                            dataRequestCount > 1
                                ? 'Equipo listo para operar en C1 fijo. Pulso renovado.'
                                : 'Equipo listo para operar en C1 fijo.',
                        latest: buildQueueDesktopOperatorInstance({
                            deviceLabel: 'Operador C1 fijo',
                            ageSec: operatorAge,
                            details: {
                                station: 'c1',
                                stationMode: 'locked',
                                oneTap: false,
                                numpadSeen: true,
                            },
                        }),
                        instances: [],
                    }),
                    kiosk: buildQueueOperationalSurfaceStatusEntry('kiosk', {
                        status: 'warning',
                        updatedAt,
                        ageSec: 18,
                        stale: false,
                        summary:
                            'Falta probar ticket térmico antes de abrir autoservicio.',
                        latest: {
                            deviceLabel: 'Kiosco principal',
                            appMode: 'desktop',
                            ageSec: 18,
                            details: {
                                connection: 'live',
                                pendingOffline: 0,
                                printerPrinted: false,
                            },
                        },
                        instances: [],
                    }),
                    display: buildQueueOperationalSurfaceStatusEntry(
                        'display',
                        {
                            status: 'ready',
                            updatedAt,
                            ageSec: 12,
                            stale: false,
                            summary:
                                'Sala TV lista: cola en vivo, audio activo y respaldo local disponible.',
                            latest: {
                                deviceLabel: 'Sala TV TCL C655',
                                appMode: 'android_tv',
                                ageSec: 12,
                                details: {
                                    connection: 'live',
                                    bellMuted: false,
                                    bellPrimed: true,
                                },
                            },
                            instances: [],
                        }
                    ),
                });
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await expect(page.locator('#queueAppsHub')).toBeVisible();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'expert'
        );
        await expect(page.locator('#queueAdminViewMode')).toBeVisible();
        await expect(page.locator('#queueAdminViewModeChip')).toContainText(
            'Expert activo'
        );
        await expect(page.locator('#queueFocusMode')).toBeVisible();
        await expect(page.locator('#queueFocusModeTitle')).toContainText(
            'Modo foco: Apertura'
        );
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Auto -> opening'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-focus',
            'opening'
        );
        await expect(page.locator('#queueAppsRefreshShieldChip')).toContainText(
            'Refresh sin bloqueo'
        );
        await page.locator('#queueInstallSurfaceSelect').focus();
        await expect
            .poll(async () => {
                const state = await page
                    .locator('#queueAppsRefreshShieldChip')
                    .getAttribute('data-state');
                return state || '';
            })
            .toMatch(/active|deferred/);
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#queueAppsRefreshShieldChip')
                    .textContent();
                return text || '';
            })
            .toMatch(/Protegiendo interacción|Refresh en espera/);
        await page.locator('#refreshAdminDataBtn').click();
        await expect(
            page.locator('#queueAppsRefreshShieldChip')
        ).toHaveAttribute('data-state', /^(deferred|idle)$/);
        await expect(page.locator('#queueAppsRefreshShieldChip')).toContainText(
            /Refresh en espera|Refresh sin bloqueo/
        );
        await expect(
            page.locator('#queueAppsRefreshShieldChip')
        ).toHaveAttribute('data-state', 'idle', {
            timeout: 2500,
        });
        await page.evaluate(() => {
            window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__ = 60000;
        });
        await expect(page.locator('#queueDomainSwitcher')).toBeVisible();
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Despliegue'
        );
        await expect(page.locator('#queueDomainSummary')).toContainText(
            'Instaladores, checklist, configuracion'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Auto -> deployment'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueAppDownloadsCards'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await expect(page.locator('#queueNumpadGuide')).toBeHidden();
        await expect(page.locator('#queueSurfaceTelemetry')).toBeHidden();
        await expect(page.locator('#queueContingencyDeck')).toBeHidden();

        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queuePlaybookTitle')).toContainText(
            'Playbook activo: Apertura'
        );
        await expect(page.locator('#queuePlaybookChip')).toContainText(
            'Paso 1/3'
        );
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sugeridos 2'
        );
        await expect(page.locator('#queuePlaybookSteps')).toContainText(
            'Abrir Operador'
        );
        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(page.locator('#queueOpsPilotTitle')).toContainText(
            'Confirma 2 paso(s) ya validados'
        );
        await expect(page.locator('#queueOpsPilotChipSuggested')).toContainText(
            'Sugeridos 2'
        );
        await expect(page.locator('#queueOpsPilotChipEquipment')).toContainText(
            'Equipos listos 2/3'
        );
        await expect(page.locator('#queueOpeningChecklist')).toBeVisible();
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'Apertura diaria asistida'
        );
        await expect(
            page.locator('#queueOpeningChecklistAssistChip')
        ).toContainText('Sugeridos 2');
        await expect(
            page.locator('#queueOpeningChecklistApplyBtn')
        ).toContainText('Confirmar sugeridos (2)');
        await expect(page.locator('#queueOpsLog')).toBeVisible();
        await expect(page.locator('#queueOpsLogTitle')).toContainText(
            'Bitácora operativa del día'
        );
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            'Sin eventos'
        );

        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            /Experiencia: Operaci[oó]n/
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Manual -> operations'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueConsultorioBoard'
        );
        await expect(page.locator('#queueDomainAuto')).toBeVisible();
        await expect(page.locator('#queueOpsPilot')).toBeHidden();
        await expect(page.locator('#queueNumpadGuide')).toBeVisible();
        await expect(page.locator('#queueNumpadGuideTitle')).toContainText(
            'Numpad en vivo'
        );
        await expect(page.locator('#queueNumpadGuideSummary')).toContainText(
            'Admin en C1 libre, pero Operador reporta C1 fijo'
        );
        await expect(
            page.locator('#queueNumpadGuideChipStation')
        ).toContainText('Admin C1 libre');
        await expect(
            page.locator('#queueNumpadGuideChipOperator')
        ).toContainText('Operador C1 fijo');
        await expect(page.locator('#queueNumpadGuideChipOneTap')).toContainText(
            '1 tecla OFF'
        );
        await expect(
            page.locator('#queueNumpadGuideChipBinding')
        ).toContainText('Enter integrado');
        await expect(page.locator('#queueNumpadGuideKey_enter')).toContainText(
            'Sin ticket en espera para C1'
        );
        await expect(
            page.locator('#queueNumpadGuideKey_station')
        ).toContainText('1/2 cambian la estación activa');
        await expect(page.locator('#queueConsultorioBoard')).toBeVisible();
        await expect(page.locator('#queueConsultorioBoardTitle')).toContainText(
            'Mesa por consultorio'
        );
        await expect(
            page.locator('#queueConsultorioBoardStatus')
        ).toContainText('1 pendiente');
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueConsultorioCurrent_c1')).toContainText(
            'Sin llamado'
        );
        await expect(page.locator('#queueConsultorioNext_c1')).toContainText(
            'Sin ticket en espera'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Sin operador dedicado'
        );
        await expect(page.locator('#queueConsultorioPrimary_c2')).toContainText(
            'Abrir Operador C2'
        );
        await expect(
            page.locator('#queueConsultorioOpenOperator_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await expect(page.locator('#queueAttentionDeck')).toBeVisible();
        await expect(page.locator('#queueAttentionDeckTitle')).toContainText(
            'Seguimiento de atención'
        );
        await expect(page.locator('#queueAttentionDeckCards')).toBeVisible();
        await expect(page.locator('#queueResolutionDeck')).toBeVisible();
        await expect(page.locator('#queueResolutionDeckTitle')).toContainText(
            'Resolución rápida'
        );
        await expect(page.locator('#queueResolutionDeckCards')).toBeVisible();
        await expect(page.locator('#queueTicketLookup')).toBeVisible();
        await expect(page.locator('#queueTicketLookupTitle')).toContainText(
            'Atajo por ticket'
        );
        await expect(page.locator('#queueTicketRoute')).toBeVisible();
        await expect(page.locator('#queueTicketRouteTitle')).toContainText(
            'Ruta del ticket'
        );
        await expect(page.locator('#queueTicketSimulation')).toBeVisible();
        await expect(page.locator('#queueTicketSimulationTitle')).toContainText(
            'Simulación operativa'
        );
        await expect(page.locator('#queueNextTurns')).toBeVisible();
        await expect(page.locator('#queueNextTurnsTitle')).toContainText(
            'Próximos turnos'
        );
        await expect(page.locator('#queueNextTurnsCards')).toBeVisible();
        await expect(page.locator('#queueMasterSequence')).toBeVisible();
        await expect(page.locator('#queueMasterSequenceTitle')).toContainText(
            'Ronda maestra'
        );
        await expect(page.locator('#queueCoverageDeck')).toBeVisible();
        await expect(page.locator('#queueCoverageDeckTitle')).toContainText(
            'Cobertura siguiente'
        );
        await expect(page.locator('#queueReserveDeck')).toBeVisible();
        await expect(page.locator('#queueReserveDeckTitle')).toContainText(
            'Reserva inmediata'
        );
        await expect(page.locator('#queueGeneralGuidance')).toBeVisible();
        await expect(page.locator('#queueGeneralGuidanceTitle')).toContainText(
            'Cola general guiada'
        );
        await expect(page.locator('#queueProjectedDeck')).toBeVisible();
        await expect(page.locator('#queueProjectedDeckTitle')).toContainText(
            'Proyección de cola'
        );
        await expect(page.locator('#queueIncomingDeck')).toBeVisible();
        await expect(page.locator('#queueIncomingDeckTitle')).toContainText(
            'Ingresos nuevos'
        );
        await expect(page.locator('#queueScenarioDeck')).toBeVisible();
        await expect(page.locator('#queueScenarioDeckTitle')).toContainText(
            'Escenarios de ingreso'
        );
        await expect(page.locator('#queueReceptionScript')).toBeVisible();
        await expect(page.locator('#queueReceptionScriptTitle')).toContainText(
            'Guion de recepción'
        );
        await expect(page.locator('#queueReceptionCollision')).toBeVisible();
        await expect(
            page.locator('#queueReceptionCollisionTitle')
        ).toContainText('Recepción simultánea');
        await expect(page.locator('#queueReceptionLights')).toBeVisible();
        await expect(page.locator('#queueReceptionLightsTitle')).toContainText(
            'Semáforo de recepción'
        );
        await expect(page.locator('#queueWindowDeck')).toBeVisible();
        await expect(page.locator('#queueWindowDeckTitle')).toContainText(
            'Ventana estimada'
        );
        await expect(page.locator('#queueDeskReply')).toBeVisible();
        await expect(page.locator('#queueDeskReplyTitle')).toContainText(
            'Respuesta de mostrador'
        );
        await expect(page.locator('#queueDeskFallback')).toBeVisible();
        await expect(page.locator('#queueDeskFallbackTitle')).toContainText(
            'Plan B de recepción'
        );
        await expect(page.locator('#queueDeskObjections')).toBeVisible();
        await expect(page.locator('#queueDeskObjectionsTitle')).toContainText(
            'Objeciones rápidas'
        );
        await expect(page.locator('#queueDeskCloseout')).toBeVisible();
        await expect(page.locator('#queueDeskCloseoutTitle')).toContainText(
            'Cierre de mostrador'
        );
        await expect(page.locator('#queueDeskRecheck')).toBeVisible();
        await expect(page.locator('#queueDeskRecheckTitle')).toContainText(
            'Revalidación de espera'
        );
        await expect(page.locator('#queueDeskShift')).toBeVisible();
        await expect(page.locator('#queueDeskShiftTitle')).toContainText(
            'Cambio de carril sugerido'
        );
        await expect(page.locator('#queueDeskPromise')).toBeVisible();
        await expect(page.locator('#queueDeskPromiseTitle')).toContainText(
            'Promesa segura'
        );
        await expect(page.locator('#queueDeskEscalation')).toBeVisible();
        await expect(page.locator('#queueDeskEscalationTitle')).toContainText(
            'Escalación sugerida'
        );
        await expect(page.locator('#queueDeskEscalationTalk')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationTalkTitle')
        ).toContainText('Escala verbal');
        await expect(page.locator('#queueDeskEscalationConfirm')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationConfirmTitle')
        ).toContainText('Confirmación de escala');
        await expect(
            page.locator('#queueDeskEscalationFollowup')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationFollowupTitle')
        ).toContainText('Seguimiento de escala');
        await expect(page.locator('#queueDeskEscalationReopen')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReopenTitle')
        ).toContainText('Reapertura de escala');
        await expect(page.locator('#queueDeskEscalationLimit')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationLimitTitle')
        ).toContainText('Límite de reapertura');
        await expect(page.locator('#queueDeskEscalationBridge')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBridgeTitle')
        ).toContainText('Puente a operación');
        await expect(page.locator('#queueDeskEscalationBrief')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationBriefTitle')
        ).toContainText('Brief para operador');
        await expect(page.locator('#queueDeskEscalationReturn')).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationReturnTitle')
        ).toContainText('Retorno a mostrador');
        await expect(
            page.locator('#queueDeskEscalationResolution')
        ).toBeVisible();
        await expect(
            page.locator('#queueDeskEscalationResolutionTitle')
        ).toContainText('Resolución devuelta');
        await expect(page.locator('#queueBlockers')).toBeVisible();
        await expect(page.locator('#queueBlockersTitle')).toContainText(
            'Bloqueos vivos'
        );
        await expect(page.locator('#queueSlaDeck')).toBeVisible();
        await expect(page.locator('#queueSlaDeckTitle')).toContainText(
            'SLA vivo'
        );
        await expect(page.locator('#queueWaitRadar')).toBeVisible();
        await expect(page.locator('#queueWaitRadarTitle')).toContainText(
            'Radar de espera'
        );
        await expect(page.locator('#queueWaitRadarCards')).toBeVisible();
        await expect(page.locator('#queueLoadBalance')).toBeVisible();
        await expect(page.locator('#queueLoadBalanceTitle')).toContainText(
            'Balance de carga'
        );
        await expect(page.locator('#queueLoadBalanceCards')).toBeVisible();
        await expect(page.locator('#queuePriorityLane')).toBeVisible();
        await expect(page.locator('#queuePriorityLaneTitle')).toContainText(
            'Fila priorizada'
        );
        await expect(page.locator('#queuePriorityLaneItems')).toBeVisible();
        await expect(page.locator('#queueQuickTrays')).toBeVisible();
        await expect(page.locator('#queueQuickTraysTitle')).toContainText(
            'Bandejas rápidas'
        );
        await expect(page.locator('#queueQuickTraysCards')).toBeVisible();
        await expect(page.locator('#queueActiveTray')).toBeVisible();
        await expect(page.locator('#queueActiveTrayTitle')).toContainText(
            'Bandeja activa'
        );
        await expect(page.locator('#queueActiveTrayItems')).toBeVisible();
        await expect(page.locator('#queueTrayBurst')).toBeVisible();
        await expect(page.locator('#queueTrayBurstTitle')).toContainText(
            'Ráfaga operativa'
        );
        await expect(page.locator('#queueTrayBurstSteps')).toBeVisible();
        await expect(page.locator('#queueDispatchDeck')).toBeVisible();
        await expect(page.locator('#queueDispatchDeckTitle')).toContainText(
            'Despacho sugerido'
        );
        await expect(page.locator('#queueDispatchDeckStatus')).toContainText(
            '1 bloqueo'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'preparado para el próximo ticket'
        );
        await expect(page.locator('#queueDispatchHeadline_c2')).toContainText(
            'sin operador dedicado'
        );
        await expect(page.locator('#queueDispatchPrimary_c2')).toContainText(
            'Abrir Operador C2'
        );
        await expect(
            page.locator('#queueDispatchOpenOperator_c2')
        ).toHaveAttribute('href', /operador-turnos\.html\?station=c2&lock=1/);
        await page
            .locator('#queueNumpadGuideToggleOneTap')
            .dispatchEvent('click');
        await expect(page.locator('#queueNumpadGuideChipOneTap')).toContainText(
            '1 tecla ON'
        );
        await expect(
            page.locator('[data-action="queue-toggle-one-tap"]').first()
        ).toContainText('Un toque activo');
        await expect(page.locator('#queueQuickConsole')).toBeVisible();
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Apertura'
        );
        await expect(page.locator('#queueQuickConsoleActions')).toContainText(
            'Confirmar sugeridos (2)'
        );
        await expect(page.locator('#queueShiftHandoff')).toBeVisible();
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Cierre y relevo asistido'
        );
        await expect(
            page.locator('#queueShiftHandoffAssistChip')
        ).toContainText('Sugeridos 4');
        await expect(page.locator('#queueShiftHandoffApplyBtn')).toContainText(
            'Confirmar sugeridos (4)'
        );
        await expect(page.locator('#queueShiftHandoffPreview')).toContainText(
            'Perfil actual operador: C1 fijo.'
        );
        await expect(page.locator('#queueOpsLog')).toBeHidden();

        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'incidents'
        );
        await expect(page.locator('#queueDomainTitle')).toContainText(
            'Experiencia: Incidentes'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Manual -> incidents'
        );
        await expect(page.locator('#queueDomainPrimary')).toHaveAttribute(
            'href',
            '#queueSurfaceTelemetry'
        );
        await expect(page.locator('#queueNumpadGuide')).toBeVisible();
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await expect(page.locator('#queueSurfaceTelemetry')).toBeVisible();
        await expect(
            page.locator('#queueSurfaceTelemetryAutoState')
        ).toContainText('Auto-refresh activo');
        await expect(
            page.locator('#queueSurfaceTelemetryAutoMeta')
        ).toContainText('ultimo ciclo');
        await expect(page.locator('#queueSurfaceTelemetryTitle')).toContainText(
            'Equipos con señal parcial'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Android TV'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Térmica pendiente'
        );
        await expect(page.locator('#queueOpsAlerts')).toBeVisible();
        await expect(page.locator('#queueOpsAlertsTitle')).toContainText(
            'Observaciones activas del turno'
        );
        await expect(page.locator('#queueOpsAlertsChipTotal')).toContainText(
            'Alertas 1'
        );
        await expect(page.locator('#queueOpsAlertsChipPending')).toContainText(
            'Pendientes 1'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Térmica pendiente en kiosco'
        );
        await expect(page.locator('#queueContingencyDeck')).toBeVisible();
        await expect(page.locator('#queueContingencyTitle')).toContainText(
            'Contingencia rápida lista'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Numpad no responde'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Térmica no imprime'
        );
        await expect(page.locator('#queueContingencyDeck')).toContainText(
            'Sala TV sin campanilla'
        );
        await expect(page.locator('#queueContingencySyncCard')).toContainText(
            'Cola sincronizada'
        );
        await expect(page.locator('#queueOpsLog')).toBeVisible();
        await expect(page.locator('#queueOpsLogTitle')).toContainText(
            'Bitácora operativa del día'
        );
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            'Sin eventos'
        );
        await page.locator('#queueOpsLogStatusBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '1 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Estado actual registrado'
        );
        await page.locator('#queueOpsLogIncidentBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogChip')).toContainText(
            '2 evento(s) hoy'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Incidencia: Kiosco'
        );
        await page
            .locator('#queueOpsAlertReview_kiosk_printer_pending')
            .dispatchEvent('click');
        await expect(page.locator('#queueOpsAlertsChipPending')).toContainText(
            'Pendientes 0'
        );
        await expect(page.locator('#queueOpsAlertsChipReviewed')).toContainText(
            'Revisadas 1'
        );
        await expect(
            page.locator('#queueOpsAlert_kiosk_printer_pending')
        ).toContainText('Revisada');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Alerta revisada: Kiosco'
        );
        await page.locator('#queueFocusModeIncidents').dispatchEvent('click');
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Manual -> incidents'
        );
        await expect(page.locator('#queueFocusModeSummary')).toContainText(
            'contingencias'
        );
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-focus',
            'incidents'
        );
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Incidencias'
        );
        await expect(page.locator('#queueQuickConsoleActions')).toContainText(
            'Registrar incidencia'
        );
        await expect(page.locator('#queuePlaybookTitle')).toContainText(
            'Playbook activo: Incidencias'
        );
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sugeridos 3'
        );
        await expect(page.locator('#queuePlaybookSteps')).toContainText(
            'Refrescar y confirmar sync'
        );
        await page.locator('#queueFocusModeAuto').dispatchEvent('click');
        await expect(page.locator('#queueFocusModeChip')).toContainText(
            'Auto -> opening'
        );
        await page.locator('#queueDomainAuto').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await expect(page.locator('#queueDomainChip')).toContainText(
            'Auto -> deployment'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toBeVisible();
        await expect(
            page.locator('#queueAppDownloadsCards .queue-app-card')
        ).toHaveCount(3);
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Operador'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Kiosco'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Sala TV'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Mostrar QR de instalación'
        );
        await expect(page.locator('#queueAppDownloadsCards')).toContainText(
            'Descargar APK'
        );
        await expect(
            page.locator('#queueReleaseIntelligenceSuite')
        ).toBeVisible();
        await expect(
            page.locator('#queueReleaseIntelligenceSuiteSummary')
        ).toContainText('Score');
        await expect(
            page.locator('#queueReleaseIntelligenceSuiteSummary')
        ).toContainText('Decision');
        await expect(
            page.locator('#queueReleaseIntelligenceSuiteEvidence')
        ).toContainText('Sin baseline activo');
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Asistente de instalación'
        );
        await page.locator('#queueOpsPilotApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queueOpsPilotTitle')).toContainText(
            'Siguiente paso: Kiosco + ticket térmico'
        );
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'faltan 2 paso(s)'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueQuickConsoleTitle')).toContainText(
            'Consola rápida: Apertura'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queuePlaybook')).toBeVisible();
        await page.locator('#queuePlaybookAssistBtn').dispatchEvent('click');
        await expect(page.locator('#queuePlaybookAssistChip')).toContainText(
            'Sin sugeridos'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: sugeridos confirmados'
        );
        await page.locator('#queuePlaybookApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queuePlaybookChip')).toContainText(
            'Secuencia completa'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Playbook opening: paso confirmado'
        );
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Apertura: 2 sugerido(s) confirmados'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await page.locator('#queueShiftHandoffApplyBtn').dispatchEvent('click');
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Relevo listo'
        );
        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueOpsLogItems')).toContainText(
            'Relevo: 4 sugerido(s) confirmados'
        );
        const openingChecklist = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpeningChecklistV1') || '{}')
        );
        expect(openingChecklist.steps.operator_ready).toBe(true);
        expect(openingChecklist.steps.sala_ready).toBe(true);
        const shiftHandoffChecklist = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueShiftHandoffV1') || '{}')
        );
        expect(shiftHandoffChecklist.steps.queue_clear).toBe(true);
        expect(shiftHandoffChecklist.steps.operator_handoff).toBe(true);
        expect(shiftHandoffChecklist.steps.kiosk_handoff).toBe(true);
        expect(shiftHandoffChecklist.steps.sala_handoff).toBe(true);
        const opsLogState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsLogV1') || '{}')
        );
        expect(Array.isArray(opsLogState.items)).toBe(true);
        expect(opsLogState.items.length).toBeGreaterThanOrEqual(3);
        const opsAlertsState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsAlertsV1') || '{}')
        );
        expect(opsAlertsState.reviewed.kiosk_printer_pending).toBeTruthy();
        const playbookState = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueOpsPlaybookV1') || '{}')
        );
        expect(playbookState.modes.opening.opening_operator).toBe(true);
        expect(playbookState.modes.opening.opening_kiosk).toBe(true);
        expect(playbookState.modes.opening.opening_sala).toBe(true);
        await page.locator('#queueDomainAuto').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'deployment'
        );
        await page
            .locator('#queueOpeningChecklistResetBtn')
            .dispatchEvent('click');
        await expect(page.locator('#queueOpeningChecklistTitle')).toContainText(
            'Apertura diaria asistida'
        );
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await page.locator('#queueShiftHandoffResetBtn').dispatchEvent('click');
        await expect(page.locator('#queueShiftHandoffTitle')).toContainText(
            'Cierre y relevo asistido'
        );
        await page.locator('#queueDomainDeployment').dispatchEvent('click');
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Operador'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'station=c1'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'latest.yml'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'PC 1 · C1 fijo'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'PC 2 · C2 fijo'
        );
        await expect(
            page.locator('#queueInstallPreset_operator_c1_locked')
        ).toBeVisible();
        await expect(page.locator('#queueInstallPreset_kiosk')).toBeVisible();
        await expect(page.locator('#queueInstallPreset_sala_tv')).toBeVisible();

        await page.locator('#queueInstallPreset_kiosk').dispatchEvent('click');
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'kiosk'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Kiosco listo para mostrador'
        );

        await page
            .locator('#queueInstallPreset_sala_tv')
            .dispatchEvent('click');
        await expect(page.locator('#queueInstallSurfaceSelect')).toHaveValue(
            'sala_tv'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Sala TV lista para TCL C655'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Android TV APK'
        );
        await expect(page.locator('#queueInstallConfigurator')).toContainText(
            'Abrir centro público'
        );
        const installPreset = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueInstallPresetV1') || '{}')
        );
        expect(installPreset.surface).toBe('sala_tv');

        const dataCountAtQueueOpen = dataRequestCount;
        await expect
            .poll(() => dataRequestCount)
            .toBeGreaterThan(dataCountAtQueueOpen);
        await page.locator('#queueDomainIncidents').dispatchEvent('click');
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Pulso renovado'
        );
    });

    test('queue renderiza Progressive Delivery Mission Control en el hub operativo', async ({
        page,
    }) => {
        test.setTimeout(45000);

        const nowIso = new Date().toISOString();

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_mission_control_smoke'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus(),
        });

        await page.goto(adminUrl());
        await page.locator('.nav-item[data-section="queue"]').click();
        await openQueuePilotDetailGroup(page, 'queueOpsPilotAdvancedGroup');

        await expect(
            page.locator('#queueReleaseBoardOpsHubHost')
        ).toBeAttached();
        await expect(page.locator('#queueReleaseBoardOpsHub')).toBeVisible();
        await expect(
            page.locator('#queueReleaseBoardOpsHubTitle')
        ).toContainText('Board Ops Hub');
        await expect(
            page.locator('#queueReleaseBoardOpsHubCopyAgendaBtn')
        ).toContainText('Copiar agenda');
        await expect(
            page.locator('#queueReleaseBoardOpsHubCopyBriefBtn')
        ).toContainText('Copiar brief');
        await expect(
            page.locator('#queueReleaseBoardOpsHubCopyActionPackBtn')
        ).toContainText('Copiar action pack');
        await expect(
            page.locator('#queueReleaseBoardOpsHubDownloadJsonBtn')
        ).toContainText('Descargar JSON');
        await expect(
            page.locator('#queueReleaseMissionControlHost')
        ).toBeAttached();
        await expect(page.locator('#queueReleaseMissionControl')).toBeVisible();
        await expect(
            page.locator('#queueReleaseMissionControlTitle')
        ).toContainText('Progressive Delivery Mission Control');
        await expect(
            page.locator('#queueReleaseMissionControlCopyBriefBtn')
        ).toContainText('Copiar brief ejecutivo');
        await expectFlowOsRecoveryHostFrozen(
            page.locator('#queueRegionalProgramOfficeHost')
        );
        await expect(
            page.locator('#queueReleaseAssuranceControlPlaneHost')
        ).toBeAttached();
        await expect(
            page.locator('#queueReleaseAssuranceControlPlane')
        ).toBeVisible();
        await expect(
            page.locator('#queueReleaseAssuranceControlPlaneTitle')
        ).toContainText('Assurance Control Plane');
        await expect(
            page.locator('#queueReleaseUnifiedOrchestrationFabricHost')
        ).toBeAttached();
        await expect(
            page.locator('#turneroReleaseUnifiedOrchestrationFabric')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseUnifiedOrchestrationFabric')
        ).toContainText('Unified Orchestration Fabric');
        const runwayHost = page.locator(
            '#queueReleaseTerminalDiagnosticRunwayHost'
        );
        await expect(runwayHost).toBeVisible();
        await expect(runwayHost).toContainText('Terminal Diagnostic Runway');
        await expect(runwayHost).toContainText('Copy runway brief');
        await expect(runwayHost).toContainText('Download runway JSON');
        await expect(
            page.locator('#turneroReleaseTerminalDiagnosticRunway')
        ).toBeVisible();
        await expect(
            page.locator(
                '#turneroReleaseTerminalDiagnosticRunway [data-role="runway-brief"]'
            )
        ).toBeVisible();
        const honestWorkspaceHost = page.locator(
            '#queueReleaseHonestRepoDiagnosisWorkspaceHost'
        );
        await expect(honestWorkspaceHost).toBeVisible();
        await expect(honestWorkspaceHost).toContainText(
            'Honest Repo Diagnosis Workspace'
        );
        await expect(honestWorkspaceHost).toContainText('Copy honest brief');
        await expect(honestWorkspaceHost).toContainText('Download honest JSON');
        await expect(
            page.locator('#queueReleaseRepoTruthAuditStudioHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Repo Truth Audit Studio');
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Copy repo truth brief');
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Download repo truth JSON');
        await expect(
            page.locator(
                '#turneroReleaseRepoTruthAuditStudio [data-role="score"]'
            )
        ).toContainText('49.5');
        await expect(
            page.locator(
                '#queueReleaseAssuranceControlPlaneCopyCertificationBriefBtn'
            )
        ).toContainText('Copy certification brief');
        await expect(
            page.locator('#queueReleaseAssuranceControlPlaneDownloadJsonBtn')
        ).toContainText('Download assurance JSON');
    });

    test('admin muestra dos operadores Windows por estacion en operaciones e incidentes', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstances = [
            buildQueueDesktopOperatorInstance({
                station: 'c1',
                ageSec: 4,
                summary: 'Equipo listo para operar en C1 fijo.',
                details: {
                    station: 'c1',
                    stationMode: 'locked',
                    oneTap: false,
                    numpadSeen: true,
                    numpadReady: true,
                    numpadProgress: 4,
                    numpadRequired: 4,
                    numpadLabel: 'Numpad listo',
                    numpadSummary: 'Numpad listo · Numpad Enter, +, ., -',
                    shellUpdateMetadataUrl:
                        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                    shellInstallGuideUrl:
                        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c1&lock=1&one_tap=0',
                    shellConfigPath:
                        'C:\\Users\\OperadorC1\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                },
            }),
            buildQueueDesktopOperatorInstance({
                station: 'c2',
                ageSec: 6,
                effectiveStatus: 'warning',
                summary:
                    'Numpad 2/4 · faltan + y - antes de operar en C2 fijo.',
                details: {
                    station: 'c2',
                    stationMode: 'locked',
                    oneTap: true,
                    numpadSeen: true,
                    numpadReady: false,
                    numpadProgress: 2,
                    numpadRequired: 4,
                    numpadLabel: 'Numpad 2/4',
                    numpadSummary: 'Numpad 2/4 · faltan + y -',
                    shellUpdateMetadataUrl:
                        'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                    shellInstallGuideUrl:
                        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
                    shellConfigPath:
                        'C:\\Users\\OperadorC2\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                },
            }),
        ];
        const turneroClinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-dual',
            region: 'regional',
            branding: {
                name: 'Clínica Dual',
                short_name: 'Clínica Dual',
                base_url: 'https://dual.example',
            },
            regionalClinics: [
                {
                    clinicId: 'clinica-dual',
                    label: 'Clínica Dual',
                    stations: 5,
                    avgServiceMinutes: 12,
                },
                {
                    clinicId: 'clinica-satelite',
                    label: 'Clínica Satélite',
                    stations: 3,
                    avgServiceMinutes: 14,
                },
            ],
        });
        const turneroV2Readiness = buildPilotReadiness({
            clinicId: 'clinica-dual',
            profileFingerprint: 'abcd1234',
        });
        const turneroRemoteReleaseReadiness = buildRemoteReadiness({
            clinicId: 'clinica-dual',
            profileFingerprint: 'abcd1234',
        });
        const turneroPublicShellDrift = buildShellDrift({
            driftStatus: 'ready',
        });
        const turneroReleaseEvidenceBundle = buildEvidenceSnapshot({
            turneroClinicProfile,
            pilotReadiness: turneroV2Readiness,
            remoteReleaseReadiness: turneroRemoteReleaseReadiness,
            publicShellDrift: turneroPublicShellDrift,
        });
        turneroReleaseEvidenceBundle.regionalClinics =
            turneroClinicProfile.regionalClinics;

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_dual_operator');
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso, {
                waitingCount: 10,
                calledCount: 10,
                estimatedWaitMin: 3,
                counts: {
                    waiting: 10,
                    called: 10,
                    completed: 80,
                    no_show: 0,
                    cancelled: 0,
                },
            }),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 4,
                    summary:
                        'Un equipo operador listo y otro con numpad pendiente.',
                    latest: operatorInstances[0],
                    instances: operatorInstances,
                }),
                display: {
                    label: 'Sala',
                    status: 'ready',
                    updatedAt: nowIso,
                    ageSec: 3,
                    stale: false,
                    summary: 'Sala lista para emitir.',
                    latest: {
                        deviceLabel: 'Sala principal',
                        ageSec: 3,
                        details: {
                            displayLatencyMs: 180,
                        },
                    },
                    instances: [],
                },
            }),
            dataOverrides: {
                turneroClinicProfile,
                turneroV2Readiness,
                turneroRemoteReleaseReadiness,
                turneroPublicShellDrift,
                turneroReleaseEvidenceBundle,
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'operations'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Numpad listo'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Windows'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Operador C2 fijo'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            '1 tecla ON'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Numpad 2/4'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Desktop instalada'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-domain',
            'incidents'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            '2 PCs operador reportando'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C2 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Numpad listo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Numpad 2/4'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Windows'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'canal stable'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Feed'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'latest.yml'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Guía'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'station=c2'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Config local'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'turnero-desktop.json'
        );
        await expect(
            page.locator('#queueSurfaceTelemetryOptimizationHubHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseTelemetryOptimizationHub')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseTelemetryOptimizationHub')
        ).toHaveAttribute('data-state', /^(ready|review)$/);
        await expect(
            page.locator('#turneroReleaseTelemetryOptimizationHub')
        ).toHaveAttribute('data-band', /^(stable|watch)$/);
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Telemetry Optimization Hub'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Catálogo de eventos'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Readiness'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Copy brief'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Download JSON'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Clínica Dual'
        );
    });

    test('admin mantiene visible una desktop operador en configuracion local sin contarla como lista', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 5,
            effectiveStatus: 'warning',
            summary: 'Configuración local abierta en C1 fijo.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: false,
                numpadSeen: false,
                numpadReady: false,
                numpadProgress: 0,
                numpadRequired: 4,
                numpadLabel: 'Validar en operador',
                numpadSummary:
                    'La matriz del numpad se valida dentro de operador-turnos.html',
                shellContext: 'boot',
                shellPhase: 'settings',
                shellSettingsMode: true,
                shellFirstRun: false,
            },
        });

        await installQueueAdminAuthMock(page, 'csrf_queue_admin_boot_operator');
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 5,
                    summary:
                        'Una desktop operador quedó en configuración local.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').dispatchEvent('click');
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Configuración local'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Pendiente de validar'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Validar en operador'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Configuración local'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Operador C1 fijo'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Configuración local'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Validar en operador'
        );
    });

    test('admin expone intento y causa cuando una desktop operador queda reintentando apertura', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 4,
            effectiveStatus: 'warning',
            summary:
                'No se pudo abrir la superficie operator. Reintentando en 18s.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: true,
                numpadSeen: false,
                numpadReady: false,
                numpadProgress: 0,
                numpadRequired: 4,
                numpadLabel: 'Validar en operador',
                numpadSummary:
                    'La matriz del numpad se valida dentro de operador-turnos.html',
                shellContext: 'boot',
                shellPhase: 'retry',
                shellSettingsMode: false,
                shellFirstRun: false,
                shellRetryActive: true,
                shellRetryAttempt: 2,
                shellRetryDelayMs: 18000,
                shellRetryRemainingMs: 18000,
                shellRetryReason: 'No se pudo abrir la superficie operator',
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_retry'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'warning',
                    ageSec: 4,
                    summary:
                        'Una desktop operador quedó reintentando apertura.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Pendiente de validar'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            '18s'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Reintentando #2'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            '18s'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'No se pudo abrir la superficie operator'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador reintentando apertura'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Reintentando #2'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'No se pudo abrir la superficie operator'
        );
    });

    test('admin mantiene visible launchMode y alerta autoarranque apagado en desktop operador', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c2',
            ageSec: 3,
            summary: 'Equipo listo para operar en C2 fijo.',
            details: {
                station: 'c2',
                stationMode: 'locked',
                oneTap: true,
                numpadSeen: true,
                numpadReady: true,
                numpadProgress: 4,
                numpadRequired: 4,
                numpadLabel: 'Numpad listo',
                numpadSummary: 'Matriz completa validada: llamar, +, . y -',
                shellLaunchMode: 'windowed',
                shellAutoStart: false,
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_autostart'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'ready',
                    ageSec: 3,
                    summary:
                        'Operador Windows listo, pero con autoarranque apagado.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueConsultorioCard_c2')).toContainText(
            'Autoarranque OFF'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueDispatchCard_c2')).toContainText(
            'Autoarranque OFF'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Autoarranque OFF'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador con autoarranque apagado'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Autoarranque OFF'
        );
    });

    test('admin muestra progreso de auto-update del operador sin perder el contexto operativo', async ({
        page,
    }) => {
        const nowIso = new Date().toISOString();
        const operatorInstance = buildQueueDesktopOperatorInstance({
            station: 'c1',
            ageSec: 3,
            summary: 'Equipo listo para operar en C1 fijo.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                oneTap: false,
                numpadSeen: true,
                numpadReady: true,
                numpadProgress: 4,
                numpadRequired: 4,
                numpadLabel: 'Numpad listo',
                numpadSummary: 'Matriz completa validada: llamar, +, . y -',
                shellLaunchMode: 'fullscreen',
                shellAutoStart: true,
                shellStatusPhase: 'download',
                shellStatusLevel: 'info',
                shellStatusPercent: 42,
                shellStatusVersion: '0.2.0',
                shellMessage: 'Descargando update 42%',
            },
        });

        await installQueueAdminAuthMock(
            page,
            'csrf_queue_admin_operator_update'
        );
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: nowIso,
            queueState: buildQueueIdleState(nowIso),
            queueSurfaceStatus: buildQueueOperationalAppsSurfaceStatus({
                operator: buildQueueDesktopOperatorSurfaceStatus({
                    updatedAt: nowIso,
                    status: 'ready',
                    ageSec: 3,
                    summary: 'Operador Windows listo mientras descarga update.',
                    latest: operatorInstance,
                    instances: [operatorInstance],
                }),
            }),
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainOperations').click();
        await expect(page.locator('#queueConsultorioCard_c1')).toContainText(
            'Update 42%'
        );
        await expect(page.locator('#queueDispatchCard_c1')).toContainText(
            'Update 42%'
        );

        await page.locator('#queueDomainIncidents').click();
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Update 42%'
        );
        await expect(page.locator('#queueSurfaceTelemetry')).toContainText(
            'Descargando update 42%'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Operador descargando actualización'
        );
        await expect(page.locator('#queueOpsAlertsItems')).toContainText(
            'Descargando update 42%'
        );
    });

    test('queue renderiza la suite financiera y de riesgo con historia y evidencia actuales', async ({
        page,
    }) => {
        test.setTimeout(20000);

        const clinicId = 'clinica-demo';
        const profileFingerprint = '1234abcd';
        const turneroClinicProfile = buildQueuePilotClinicProfile({
            clinicId,
            branding: {
                name: 'Clínica Demo',
                short_name: 'Demo',
                base_url: 'https://demo.example',
            },
            runtime_meta: {
                source: 'file',
                profileFingerprint,
            },
        });
        const turneroV2Readiness = buildPilotReadiness({
            clinicId,
            profileFingerprint,
        });
        const turneroRemoteReleaseReadiness = buildRemoteReadiness({
            clinicId,
            profileFingerprint,
        });
        const turneroPublicShellDrift = buildShellDrift({
            pageOk: true,
            driftStatus: 'ready',
        });
        const historySnapshots = [
            {
                snapshotId: 'clinica-demo-20260317-090000',
                clinicId,
                clinicName: 'Clínica Demo',
                clinicShortName: 'Demo',
                label: 'Wave 1',
                decision: 'ready',
                severity: 'info',
                summary: 'Wave 1 estable',
                savedAt: '2026-03-17T09:00:00.000Z',
                generatedAt: '2026-03-17T09:00:00.000Z',
                incidentCount: 1,
                surfaceCount: 4,
                clinicCount: 2,
                baseCost: 22000,
                supportCost: 6000,
                incidentReserve: 1500,
            },
            {
                snapshotId: 'clinica-demo-20260318-090000',
                clinicId,
                clinicName: 'Clínica Demo',
                clinicShortName: 'Demo',
                label: 'Wave 2',
                decision: 'review',
                severity: 'warning',
                summary: 'Wave 2 lista para revisión',
                savedAt: '2026-03-18T09:00:00.000Z',
                generatedAt: '2026-03-18T09:00:00.000Z',
                incidentCount: 2,
                surfaceCount: 4,
                clinicCount: 2,
                baseCost: 21000,
                supportCost: 5800,
                incidentReserve: 1800,
            },
        ];
        const turneroReleaseEvidenceBundle = {
            ...buildEvidenceSnapshot({
                turneroClinicProfile,
                pilotReadiness: turneroV2Readiness,
                remoteReleaseReadiness: turneroRemoteReleaseReadiness,
                publicShellDrift: turneroPublicShellDrift,
            }),
            regionalClinics: [
                {
                    clinicId: 'clinica-norte',
                    label: 'Clínica Norte',
                    shortLabel: 'Norte',
                    region: 'norte',
                    plannedBudget: 35000,
                    committedBudget: 24000,
                    atRiskBudget: 2500,
                    riskScore: 34,
                    valueScore: 82,
                },
                {
                    clinicId: 'clinica-sur',
                    label: 'Clínica Sur',
                    shortLabel: 'Sur',
                    region: 'sur',
                    plannedBudget: 25000,
                    committedBudget: 18000,
                    atRiskBudget: 3500,
                    riskScore: 46,
                    valueScore: 68,
                },
            ],
            historySnapshots,
        };

        await page.addInitScript(
            ({
                clinicId: seedClinicId,
                historyKey,
                baselineKey,
                snapshots,
            }) => {
                const baselineId = snapshots[0]?.snapshotId || '';
                window.localStorage.setItem(
                    historyKey,
                    JSON.stringify(snapshots)
                );
                if (baselineId) {
                    window.localStorage.setItem(
                        baselineKey,
                        JSON.stringify({
                            clinicId: seedClinicId,
                            snapshotId: baselineId,
                            updatedAt:
                                snapshots[snapshots.length - 1]?.savedAt ||
                                new Date().toISOString(),
                        })
                    );
                }
            },
            {
                clinicId,
                historyKey: `turnero.release.history.v1:${clinicId}:history`,
                baselineKey: `turnero.release.history.v1:${clinicId}:baseline`,
                snapshots: historySnapshots,
            }
        );

        await installQueueAdminAuthMock(page, 'csrf_queue_governance_suite');
        await installQueueOperationalAppsApiMocks(page, {
            updatedAt: turneroReleaseEvidenceBundle.generatedAt,
            queueState: buildQueueIdleState(
                turneroReleaseEvidenceBundle.generatedAt
            ),
            dataOverrides: {
                turneroClinicProfile,
                turneroV2Readiness,
                turneroRemoteReleaseReadiness,
                turneroPublicShellDrift,
                turneroReleaseEvidenceBundle,
            },
        });

        await page.goto(adminUrl());
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="queue"]').click();
        await page.locator('#queueDomainDeployment').dispatchEvent('click');

        await expect(page.locator('#queueReleaseCommandDeck')).toBeVisible();
        await expect(
            page.locator('#queueReleaseIntelligenceSuiteHost')
        ).toBeVisible();
        await expect(
            page.locator('#queueReleaseHistoryDashboard')
        ).toBeVisible();
        await expect(
            page.locator('#queueReleaseGovernanceSuiteHost')
        ).toBeVisible();
        await expect(
            page.locator('#queueReleaseHistoryDashboardPanel')
        ).toContainText('Snapshots 2');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toHaveAttribute('data-decision', 'ready');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toHaveAttribute('data-compliance', /^(green|amber)$/);
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toHaveAttribute('data-risk-grade', 'A');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toContainText('Financial / Risk Governance Suite');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toContainText('Budget');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toContainText('Risk');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toContainText('Compliance');
        await expect(
            page.locator('#turneroReleaseGovernanceSuite')
        ).toContainText('Mapa de inversión');
        await expect(
            page.locator('#queueReleaseIntegrationCommandCenterHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseIntegrationCommandCenter')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseIntegrationCommandCenter')
        ).toContainText('Integration Command Center');
        await expect(
            page.locator('#turneroReleaseIntegrationCommandCenter')
        ).toContainText('Copy integration brief');
        await expect(
            page.locator('#turneroReleaseIntegrationCommandCenter')
        ).toContainText('Download integration JSON');
        await expect(
            page.locator('#queueReleaseSafetyPrivacyCockpitHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseSafetyPrivacyCockpit')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseSafetyPrivacyCockpitTitle')
        ).toContainText('Safety Privacy Cockpit');
        await expect(
            page.locator(
                '#turneroReleaseSafetyPrivacyCockpitCopyPrivacyBriefBtn'
            )
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseSafetyPrivacyCockpitDownloadJsonBtn')
        ).toBeVisible();
        await expectFlowOsRecoveryHostFrozen(
            page.locator('#queueReleaseServiceExcellenceAdoptionCloudHost')
        );
        await expect(
            page.locator('#queueReleaseUnifiedOrchestrationFabricHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseUnifiedOrchestrationFabric')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseUnifiedOrchestrationFabric')
        ).toContainText('Unified Orchestration Fabric');
        await expect(
            page.locator('#queueReleaseRepoTruthAuditStudioHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Repo Truth Audit Studio');
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Copy repo truth brief');
        await expect(
            page.locator('#turneroReleaseRepoTruthAuditStudio')
        ).toContainText('Download repo truth JSON');
        await expect(
            page.locator(
                '#turneroReleaseRepoTruthAuditStudio [data-role="score"]'
            )
        ).toContainText('49.5');
        await expect(
            page.locator('#queueReleaseRepoDiagnosticPrepHubHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoDiagnosticPrepHub')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseRepoDiagnosticPrepHub')
        ).toContainText('Repo Diagnostic Prep Hub');
        await expect(
            page.locator('#turneroReleaseRepoDiagnosticPrepHub')
        ).toContainText('Copy diagnostic brief');
        await expect(
            page.locator('#turneroReleaseRepoDiagnosticPrepHub')
        ).toContainText('Download diagnostic JSON');
        await expect(
            page.locator('#queueReleaseMainlineAuditBridgeHost')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseMainlineAuditBridge')
        ).toContainText('Mainline Audit Bridge');
        await expect(
            page.locator('#turneroReleaseMainlineAuditBridge')
        ).toContainText('Copy mainline brief');
        await expect(
            page.locator('#turneroReleaseMainlineAuditBridge')
        ).toContainText('Download mainline JSON');
        await expect(
            page.locator('#turneroReleaseMainlineAuditBridge')
        ).toContainText('Add branch delta');
        await expect(
            page.locator('#turneroReleaseGovernanceBudget')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceCosts')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceRisk')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceCompliance')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceHeatmap')
        ).toBeVisible();
        await expect(
            page.locator('#turneroReleaseGovernanceBoard')
        ).toBeVisible();

        const deploymentOrder = await page.evaluate(() => {
            const deploymentGrid = document.querySelector(
                '.queue-premium-band__grid--deployment'
            );
            return deploymentGrid
                ? Array.from(
                      deploymentGrid.querySelectorAll(':scope > div[id]')
                  ).map((node) => node.id)
                : [];
        });
        const installConfiguratorIndex = deploymentOrder.indexOf(
            'queueInstallConfigurator'
        );
        const honestWorkspaceIndex = deploymentOrder.indexOf(
            'queueReleaseHonestRepoDiagnosisWorkspaceHost'
        );
        const finalLaunchIndex = deploymentOrder.indexOf(
            'queueFinalDiagnosticLaunchConsoleHost'
        );
        const runwayIndex = deploymentOrder.indexOf(
            'queueReleaseTerminalDiagnosticRunwayHost'
        );
        const mainlineClosureIndex = deploymentOrder.indexOf(
            'queueReleaseMainlineClosureCockpitHost'
        );
        const repoDiagnosisIndex = deploymentOrder.indexOf(
            'queueReleaseRepoDiagnosisVerdictDossierHost'
        );
        const finalExecutionIndex = deploymentOrder.indexOf(
            'queueFinalDiagnosticExecutionConsoleHost'
        );
        expect(installConfiguratorIndex).toBeGreaterThanOrEqual(0);
        expect(finalLaunchIndex).toBeGreaterThan(installConfiguratorIndex);
        expect(finalLaunchIndex).toBeGreaterThan(repoDiagnosisIndex);
        expect(runwayIndex).toBeGreaterThan(repoDiagnosisIndex);
        expect(honestWorkspaceIndex).toBeGreaterThan(runwayIndex);
        expect(mainlineClosureIndex).toBeGreaterThan(installConfiguratorIndex);
        expect(repoDiagnosisIndex).toBeGreaterThan(mainlineClosureIndex);
        expect(finalExecutionIndex).toBeGreaterThan(repoDiagnosisIndex);
    });

    test('monta el surface sync console y permite agregar handoffs locales', async ({
        page,
    }, testInfo) => {
        testInfo.setTimeout(60000);
        const updatedAt = '2026-03-20T10:00:00.000Z';
        const clinicProfile = buildQueuePilotClinicProfile({
            clinicId: 'clinica-norte-demo',
        });
        const queueState = buildQueueIdleState(updatedAt, {
            waitingCount: 1,
            calledCount: 1,
            callingNow: [
                {
                    id: 51,
                    ticketCode: 'A-051',
                    patientInitials: 'JP',
                    assignedConsultorio: 1,
                    calledAt: updatedAt,
                },
            ],
            nextTickets: [
                {
                    id: 52,
                    ticketCode: 'A-052',
                    patientInitials: 'EP',
                    position: 1,
                },
            ],
        });
        const queueTickets = [
            {
                id: 51,
                ticketCode: 'A-051',
                patientInitials: 'JP',
                status: 'called',
                assignedConsultorio: 1,
                calledAt: updatedAt,
            },
            {
                id: 52,
                ticketCode: 'A-052',
                patientInitials: 'EP',
                status: 'waiting',
                assignedConsultorio: 1,
            },
        ];

        const operatorInstance = {
            deviceLabel: 'Operador C1 fijo',
            appMode: 'desktop',
            ageSec: 4,
            stale: false,
            effectiveStatus: 'warning',
            status: 'warning',
            updatedAt,
            summary: 'Operador con handoff abierto.',
            details: {
                station: 'c1',
                stationMode: 'locked',
                surfaceSyncSnapshot: {
                    surfaceKey: 'operator:c1',
                    queueVersion: updatedAt,
                    visibleTurn: 'A-051',
                    announcedTurn: 'A-051',
                    handoffState: 'open',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'desktop',
                    updatedAt,
                },
                surfaceSyncHandoffOpenCount: 1,
            },
        };
        const kioskInstance = {
            deviceLabel: 'Kiosco principal',
            appMode: 'browser',
            ageSec: 5,
            stale: false,
            effectiveStatus: 'ready',
            status: 'ready',
            updatedAt,
            summary: 'Kiosco listo.',
            details: {
                surfaceSyncSnapshot: {
                    surfaceKey: 'kiosk',
                    queueVersion: updatedAt,
                    visibleTurn: 'A-051',
                    announcedTurn: 'A-051',
                    handoffState: 'clear',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'queue-state-live',
                    updatedAt,
                },
                surfaceSyncHandoffOpenCount: 0,
            },
        };
        const displayInstance = {
            deviceLabel: 'Sala principal',
            appMode: 'browser',
            ageSec: 6,
            stale: false,
            effectiveStatus: 'ready',
            status: 'ready',
            updatedAt,
            summary: 'Sala lista.',
            details: {
                surfaceSyncSnapshot: {
                    surfaceKey: 'display',
                    queueVersion: updatedAt,
                    visibleTurn: 'A-051',
                    announcedTurn: 'A-051',
                    handoffState: 'clear',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'queue-state-live',
                    updatedAt,
                },
                surfaceSyncHandoffOpenCount: 0,
            },
        };

        await installQueueAdminAuthMock(page, 'csrf_surface_sync');
        await installAdminQueueApiMocks(page, {
            queueState,
            queueTickets,
            dataOverrides: {
                turneroClinicProfile: clinicProfile,
                queueSurfaceStatus: {
                    operator: buildQueueOperationalSurfaceStatusEntry(
                        'operator',
                        {
                            status: 'warning',
                            updatedAt,
                            ageSec: 4,
                            stale: false,
                            summary: 'Operador con handoff abierto.',
                            latest: operatorInstance,
                            instances: [operatorInstance],
                        }
                    ),
                    kiosk: buildQueueOperationalSurfaceStatusEntry('kiosk', {
                        status: 'ready',
                        updatedAt,
                        ageSec: 5,
                        stale: false,
                        summary: 'Kiosco listo.',
                        latest: kioskInstance,
                        instances: [kioskInstance],
                    }),
                    display: buildQueueOperationalSurfaceStatusEntry(
                        'display',
                        {
                            status: 'ready',
                            updatedAt,
                            ageSec: 6,
                            stale: false,
                            summary: 'Sala lista.',
                            latest: displayInstance,
                            instances: [displayInstance],
                        }
                    ),
                },
            },
        });

        await page.goto(adminUrl('section=queue'));
        await page.locator('#queueAdminViewModeExpert').click();
        await expect(page.locator('#queueAppsHub')).toHaveAttribute(
            'data-queue-admin-mode',
            'expert'
        );
        await page.locator('#queueDomainIncidents').click();

        await expect(
            page.locator('#queueSurfaceSyncConsoleHost')
        ).toContainText('Surface Sync Console');
        await expect(
            page.locator('#queueSurfaceSyncConsoleHost')
        ).toContainText('Operador C1 fijo');
        await expect(
            page.locator('#queueSurfaceSupportConsoleHost')
        ).toContainText('Surface Support Console');
        await expect(
            page.locator('#queueSurfaceSupportConsoleHost')
        ).toContainText('Copy brief');
        const serviceHandoverConsoleHost = page.locator(
            '#queueSurfaceTelemetry #queueSurfaceServiceHandoverConsoleHost'
        );
        await expect(serviceHandoverConsoleHost).toBeVisible();
        await expect(serviceHandoverConsoleHost).toContainText(
            'Surface Service Handover Console'
        );
        await expect(serviceHandoverConsoleHost).toContainText('Copy brief');
        await expect(serviceHandoverConsoleHost).toContainText('Add playbook');
        await expect(serviceHandoverConsoleHost).toContainText('Add owner');
        await expect(serviceHandoverConsoleHost).toContainText('Recompute');
        await expect(serviceHandoverConsoleHost).toContainText(
            'Operador web'
        );
        await expect(
            serviceHandoverConsoleHost.locator(
                '.turnero-admin-queue-surface-service-handover-console__surface'
            )
        ).toHaveCount(3);
        await expect(serviceHandoverConsoleHost).toHaveAttribute(
            'data-state',
            'blocked'
        );
        const onboardingConsoleHost = page.locator(
            '#queueSurfaceTelemetry #queueSurfaceOnboardingConsoleHost'
        );
        await expect(onboardingConsoleHost).toBeVisible();
        await expect(onboardingConsoleHost).toContainText(
            'Surface Customer Onboarding'
        );
        await expect(onboardingConsoleHost).toContainText('Copy brief');
        await expect(onboardingConsoleHost).toContainText('Download JSON');
        await expect(onboardingConsoleHost).toContainText(
            'Add onboarding item'
        );
        await expect(onboardingConsoleHost).toContainText('Add owner');
        await expect(
            onboardingConsoleHost.locator(
                '.turnero-admin-queue-surface-onboarding-console__surface'
            )
        ).toHaveCount(3);
        await expect(onboardingConsoleHost).toHaveAttribute(
            'data-state',
            'blocked'
        );
        const packageConsoleHost = page.locator(
            '#queueSurfaceTelemetry #queueSurfacePackageConsoleHost'
        );
        await expect(packageConsoleHost).toBeVisible();
        await expect(packageConsoleHost).toContainText(
            'Surface Package Standardization'
        );
        await expect(packageConsoleHost).toContainText('Copy brief');
        await expect(packageConsoleHost).toContainText('Download JSON');
        await expect(packageConsoleHost).toContainText('Add entry');
        await expect(packageConsoleHost).toContainText('Add owner');
        await expect(
            packageConsoleHost.locator(
                '.turnero-admin-queue-surface-package-console__surface'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '#queueSurfaceSyncConsoleHost .turnero-admin-queue-surface-sync-console__handoff-item'
            )
        ).toHaveCount(1);

        await page.selectOption(
            '#queueSurfaceSyncConsoleHost [data-field="surface-key"]',
            'operator:c1'
        );
        await page
            .locator('#queueSurfaceSyncConsoleHost [data-field="title"]')
            .fill('Shift relay');
        await page
            .locator('#queueSurfaceSyncConsoleHost [data-field="note"]')
            .fill('Confirmar continuidad del handoff desde admin.');
        await page
            .locator('#queueSurfaceSyncConsoleHost [data-action="add-handoff"]')
            .click();

        await expect(
            page.locator(
                '#queueSurfaceSyncConsoleHost .turnero-admin-queue-surface-sync-console__handoff-item'
            )
        ).toHaveCount(2);
        await expect(
            page.locator('#queueSurfaceSyncConsoleHost')
        ).toContainText('Shift relay');

        await expect(
            page.locator('#queueSurfaceGoLiveConsoleHost')
        ).toContainText('go-live readiness');
        await expect(
            page.locator(
                '#queueSurfaceGoLiveConsoleHost [data-action="copy-brief"]'
            )
        ).toContainText('Copy brief');
        await expect(
            page.locator(
                '#queueSurfaceGoLiveConsoleHost [data-action="download-json"]'
            )
        ).toContainText('Download JSON');
        await expect(
            page.locator(
                '#queueSurfaceGoLiveConsoleHost [data-action="add-evidence"]'
            )
        ).toContainText('Add evidence');

        await page.selectOption(
            '#queueSurfaceGoLiveConsoleHost [data-field="surface-key"]',
            'operator'
        );
        await page
            .locator('#queueSurfaceGoLiveConsoleHost [data-field="note"]')
            .fill('Chequeo manual de readiness');
        await page
            .locator(
                '#queueSurfaceGoLiveConsoleHost [data-action="add-evidence"]'
            )
            .click();

        await expect(
            page.locator(
                '#queueSurfaceGoLiveConsoleHost .turnero-admin-queue-surface-go-live-console__evidence-item'
            )
        ).toHaveCount(1);
        await expect(
            page.locator('#queueSurfaceGoLiveConsoleHost')
        ).toContainText('Chequeo manual de readiness');

        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toBeVisible();
        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toContainText('Surface Replication Scaleout');
        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toContainText('Copy brief');
        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toContainText('Download JSON');
        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toContainText('Add template');
        await expect(
            page.locator('#queueSurfaceReplicationConsoleHost')
        ).toContainText('Add owner');
        await expect(
            page.locator(
                '#queueSurfaceReplicationConsoleHost .turnero-surface-ops__chip'
            )
        ).toHaveCount(9);

        await expect(
            page.locator('#queueSurfaceFleetConsoleHost')
        ).toContainText('Surface Fleet Readiness');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost')
        ).toContainText('Copy brief');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost')
        ).toContainText('Download JSON');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost')
        ).toContainText('Add wave');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost')
        ).toContainText('Add owner');

        await page.selectOption(
            '#queueSurfaceFleetConsoleHost [data-field="wave-surface-key"]',
            'operator'
        );
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-field="wave-label"]')
            .fill('Wave 9');
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-field="wave-note"]')
            .fill('Plan de despliegue.');
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-action="add-wave"]')
            .click();

        await expect(
            page.locator('#queueSurfaceFleetConsoleHost [data-role="wave-count"]')
        ).toHaveText('1');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost [data-role="wave-list"]')
        ).toContainText('Wave 9');

        await page.selectOption(
            '#queueSurfaceFleetConsoleHost [data-field="owner-surface-key"]',
            'display'
        );
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-field="owner-name"]')
            .fill('ops-lead');
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-field="owner-note"]')
            .fill('Fleet owner en sala.');
        await page
            .locator('#queueSurfaceFleetConsoleHost [data-action="add-owner"]')
            .click();

        await expect(
            page.locator('#queueSurfaceFleetConsoleHost [data-role="owner-count"]')
        ).toHaveText('1');
        await expect(
            page.locator('#queueSurfaceFleetConsoleHost [data-role="owner-list"]')
        ).toContainText('ops-lead');
    });
});
