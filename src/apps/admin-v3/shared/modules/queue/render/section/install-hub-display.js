import {getState} from '../../../../core/store.js';
import {createToast, escapeHtml, formatDateTime, setHtml, setText} from '../../../../ui/render.js';
import {getActiveCalledTicketForStation, getCalledTicketForConsultorio, getQueueTicketById, getQueueSource, getVisibleTickets, getWaitingForConsultorio} from '../../selectors.js';
import {ensureOpsAlertsState as ensureOpsAlertsStateStore, ensureOpsFocusMode as ensureOpsFocusModeStore, markOpsAlertsReviewed as markOpsAlertsReviewedStore, persistOpsFocusMode as persistOpsFocusModeStore, setOpsAlertReviewed as setOpsAlertReviewedStore} from './install-hub/ops-alerts.js';
import {createQueueOpsInteractionController} from './install-hub/interaction.js';
import {buildQueueFocusMode as buildQueueFocusModeModule, renderQueueFocusMode as renderQueueFocusModeModule} from './install-hub/focus-mode.js';
import {renderQueueHubDomainView as renderQueueHubDomainViewModule} from './install-hub/domain-view.js';
import {buildQueueOpsAlerts as buildQueueOpsAlertsModule, renderQueueOpsAlerts as renderQueueOpsAlertsModule} from './install-hub/alerts.js';
import {ensureInstallHubRegistryLoaded, getInstallHubDefaultAppDownloads, getInstallHubSurfaceCardCopy, getInstallHubSurfaceDefinition, getInstallHubSurfaceOrder, getInstallHubSurfaceTelemetryCopy, syncInstallHubRuntimePayload} from './install-hub/registry.js';
import {renderQueueMainlineAuditBridge as renderQueueMainlineAuditBridgeModule} from './install-hub/mainline-audit-bridge.js';
import {renderQueueFinalDiagnosisAdjudicationBinder as renderQueueFinalDiagnosisAdjudicationBinderModule} from './install-hub/final-diagnosis-adjudication-binder.js';
import {renderQueueHonestRepoDiagnosisWorkspace as renderQueueHonestRepoDiagnosisWorkspaceModule} from './install-hub/honest-repo-diagnosis-workspace.js';
import {renderQueueRepoDiagnosisVerdictDossier as renderQueueRepoDiagnosisVerdictDossierModule} from './install-hub/repo-diagnosis-verdict-dossier.js';
import {renderQueueTerminalDiagnosticRunway as renderQueueTerminalDiagnosticRunwayModule} from './install-hub/terminal-diagnostic-runway.js';
import {buildQueueQuickConsole as buildQueueQuickConsoleModule, renderQueueQuickConsole as renderQueueQuickConsoleModule} from './install-hub/quick-console.js';
import {buildQueueOpsPilot as buildQueueOpsPilotModule, renderQueueOpsPilot as renderQueueOpsPilotModule} from './install-hub/pilot.js';
import {buildTurneroReleaseControlCenterModel} from '../../../../../../queue-shared/turnero-release-control-center.js';
import {renderTurneroReleaseCommandDeck} from '../../../../../../queue-shared/turnero-release-command-deck.js';
import {mountReleaseIntelligenceSuiteCard} from '../../../../../../queue-shared/turnero-release-baseline-promotion-center.js';
import {createReleaseHistoryDashboard} from '../../../../../../queue-shared/turnero-release-history-dashboard.js';
import {mountTurneroReleaseGovernanceSuite} from '../../../../../../queue-shared/turnero-release-governance-suite.js';
import {mountTurneroReleaseIntegrationCommandCenter} from '../../../../../../queue-shared/turnero-release-integration-command-center.js';
import {mountRegionalProgramOfficeCard} from '../../../../../../queue-shared/turnero-release-program-office.js';
import {mountTurneroReleaseReliabilityRecoveryNerveCenter} from '../../../../../../queue-shared/turnero-release-reliability-recovery-nerve-center.js';
import {mountTurneroReleaseServiceExcellenceAdoptionCloud} from '../../../../../../queue-shared/turnero-release-service-excellence-adoption-cloud.js';
import {mountTurneroReleaseSafetyPrivacyCockpit} from '../../../../../../queue-shared/turnero-release-safety-privacy-cockpit.js';
import {mountTurneroReleaseRepoDiagnosticPrepHub} from '../../../../../../queue-shared/turnero-release-repo-diagnostic-prep-hub.js';
import {mountTurneroReleaseDiagnosticLaunchConsole} from '../../../../../../queue-shared/turnero-release-diagnostic-launch-console.js';
import {mountTurneroReleaseFinalDiagnosticExecutionConsole} from '../../../../../../queue-shared/turnero-release-final-diagnostic-execution-console.js';
import {renderQueueFinalRepoDiagnosticHandoffPack as renderQueueFinalRepoDiagnosticHandoffPackModule} from './install-hub/final-repo-diagnostic-handoff-pack.js';
import {readTurneroIncidentJournal} from '../../../../../../queue-shared/turnero-release-incident-journal.js';
import {renderQueueAssuranceControlPlane} from './install-hub/assurance-control-plane.js';
import {renderQueueUnifiedOrchestrationFabric} from './install-hub/unified-orchestration-fabric.js';
import {renderQueueRepoTruthAuditStudio} from './install-hub/repo-truth-audit-studio.js';
import {renderQueueMainlineClosureCockpit as renderQueueMainlineClosureCockpitModule} from './install-hub/mainline-closure-cockpit.js';
import {hasRecentQueueSmokeSignalForState} from './install-hub/smoke-signal.js';
import {buildPlaybookDefinitions as buildPlaybookDefinitionsModule, buildQueuePlaybook as buildQueuePlaybookModule, buildQueuePlaybookAssist as buildQueuePlaybookAssistModule, buildQueuePlaybookReport as buildQueuePlaybookReportModule, copyQueuePlaybookReport as copyQueuePlaybookReportModule, ensureOpsPlaybookState as ensureOpsPlaybookStateModule, renderQueuePlaybook as renderQueuePlaybookModule, resetOpsPlaybookMode as resetOpsPlaybookModeModule, setOpsPlaybookStep as setOpsPlaybookStepModule} from './install-hub/playbook.js';
import {mountAdminQueuePilotReadinessCard} from '../../../../../../queue-shared/admin-queue-pilot-readiness.js';
import {mountTurneroAdminQueueSurfaceTruthPanel} from '../../../../../../queue-shared/turnero-admin-queue-surface-truth-panel.js';
import {mountTurneroReleaseTelemetryOptimizationHub} from '../../../../../../queue-shared/turnero-release-telemetry-optimization-hub.js';
import {createTurneroSurfaceHandoffLedger, resolveTurneroSurfaceHandoffState} from '../../../../../../queue-shared/turnero-surface-handoff-ledger.js';
import {buildTurneroSurfaceGoLiveSnapshot} from '../../../../../../queue-shared/turnero-surface-go-live-snapshot.js';
import {buildTurneroSurfaceSyncPack} from '../../../../../../queue-shared/turnero-surface-sync-pack.js';
import {mountTurneroAdminQueueSurfaceSyncConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-sync-console.js';
import {mountTurneroAdminQueueSurfaceGoLiveConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-go-live-console.js';
import {buildTurneroSurfaceRecoveryPack} from '../../../../../../queue-shared/turnero-surface-recovery-pack.js';
import {mountTurneroAdminQueueSurfaceRecoveryConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-recovery-console.js';
import {buildTurneroSurfaceIntegrityPack} from '../../../../../../queue-shared/turnero-surface-integrity-pack.js';
import {mountTurneroAdminQueueSurfaceIntegrityConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-integrity-console.js';
import {buildTurneroSurfaceReplicationSnapshot} from '../../../../../../queue-shared/turnero-surface-replication-snapshot.js';
import {mountTurneroAdminQueueSurfaceReplicationConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-replication-console.js';
import {buildTurneroSurfaceServiceHandoverPack} from '../../../../../../queue-shared/turnero-surface-service-handover-pack.js';
import {mountTurneroAdminQueueSurfaceServiceHandoverConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-service-handover-console.js';
import {mountTurneroAdminQueueSurfaceOnboardingConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-onboarding-console.js';
import {mountTurneroAdminQueueSurfaceFleetConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-fleet-console.js';
import {mountTurneroAdminQueueSurfaceAdoptionConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-adoption-console.js';
import {mountTurneroAdminQueueSurfaceCommercialConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-commercial-console.js';
import {mountTurneroAdminQueueSurfaceRenewalConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-renewal-console.js';
import {mountTurneroAdminQueueSurfaceSupportConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-support-console.js';
import {mountTurneroAdminQueueSurfacePackageConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-package-console.js';
import {mountTurneroAdminQueueSurfaceExecutiveReviewConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-executive-review-console.js';
import {mountTurneroAdminQueueSurfaceSuccessConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-success-console.js';
import {mountTurneroAdminQueueSurfaceExpansionConsole} from '../../../../../../queue-shared/turnero-admin-queue-surface-expansion-console.js';
import {buildTurneroSurfacePackageSnapshot} from '../../../../../../queue-shared/turnero-surface-package-snapshot.js';
import {buildTurneroSurfaceExecutiveReviewSnapshot} from '../../../../../../queue-shared/turnero-surface-executive-review-snapshot.js';
import {buildTurneroSurfaceExpansionSnapshot} from '../../../../../../queue-shared/turnero-surface-expansion-snapshot.js';
import {getTurneroActiveClinicId as getTurneroClinicIdFromState, getTurneroActiveClinicProfile as getTurneroClinicProfileFromState, getTurneroActiveClinicProfileCatalogStatus as getTurneroClinicProfileCatalogStatusFromState, getTurneroActiveClinicProfileMeta as getTurneroClinicProfileMetaFromState, getTurneroClinicProfiles as getTurneroClinicProfilesFromState, getTurneroRegionalClinics as getTurneroRegionalClinicsFromState, getTurneroClinicBrandName as getTurneroClinicBrandNameForProfile, getTurneroClinicShortName as getTurneroClinicShortNameForProfile, getTurneroConsultorioLabel as getTurneroConsultorioLabelForProfile} from '../../../../../../queue-shared/turnero-runtime-contract.mjs';
import {FLOW_OS_RECOVERY_FROZEN_ADMIN_PANEL_IDS, getFlowOsRecoveryFreezeNotice, hideFlowOsRecoveryHost, isFlowOsRecoveryAdminPanelFrozen, isFlowOsRecoveryFreezeActive} from '../../../../../../queue-shared/flow-os-recovery-freeze.js';

import {
    getDefaultAppDownloads,
    getSurfaceTelemetryState,
    normalizeSurfaceTelemetryInstance,
    getSurfaceTelemetryInstances,
    ensureInstallPreset,
    buildSurfaceGoLiveTelemetrySnapshot,
    getOperatorShellPhase,
    buildOperatorShellLifecycleLabel,
    buildOperatorOperationalBlocker
} from './install-hub-install.js';

import {
    getTurneroClinicProfile,
    getTurneroConsultorioLabel,
    buildQueueReleaseHistoryCurrentSnapshot,
    buildSignalAgeLabel,
    normalizeOperatorStationKey,
    formatQueueTicketAgeLabel,
    buildConsultorioOperatorContext
} from './install-hub-install.js';


import {
    mergeSurfaceTargets,
    buildPreparedSurfaceUrl,
    getLatestSurfaceDetails,
    getOperatorSurfaceDetailsForStation,
    isSurfaceInstanceLive
} from './install-hub-install.js';

export let queueReleaseHistoryDashboard = null;

export function getSurfaceCardCopy(surfaceKey) {
    return getInstallHubSurfaceCardCopy(surfaceKey);
}

export function getSurfaceTarget(appConfig, targetKey) {
    const resolvedKey = String(targetKey || '').trim();
    if (resolvedKey !== '' && appConfig && typeof appConfig.targets === 'object' && appConfig.targets[resolvedKey]) {
        return appConfig.targets[resolvedKey];
    }
    return null;
}





export function getQueueReleaseHistoryDashboard() {
    if (!queueReleaseHistoryDashboard) {
        queueReleaseHistoryDashboard = createReleaseHistoryDashboard();
    }
    return queueReleaseHistoryDashboard;
}

export function renderQueueReleaseHistoryDashboard(manifest, detectedPlatform) {
    const root = document.getElementById('queueReleaseHistoryDashboard');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    const dashboard = getQueueReleaseHistoryDashboard();
    const currentSnapshot = buildQueueReleaseHistoryCurrentSnapshot();
    const viewModel = dashboard.buildViewModel({
        clinicId: currentSnapshot.clinicId,
        currentSnapshot
    });
    setHtml('#queueReleaseHistoryDashboard', dashboard.renderTextCard(viewModel));
    const panel = document.getElementById('queueReleaseHistoryDashboardPanel');
    if (!(panel instanceof HTMLElement)) {
        return null;
    }
    const rerender = () => renderQueueReleaseHistoryDashboard(manifest, detectedPlatform);
    panel.onchange = async event => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) {
            return;
        }
        if (target.matches('[data-history-select="snapshot-a"], [data-history-select="snapshot-b"]')) {
            const selectA = panel.querySelector('[data-history-select="snapshot-a"]');
            const selectB = panel.querySelector('[data-history-select="snapshot-b"]');
            if (selectA instanceof HTMLSelectElement && selectB instanceof HTMLSelectElement) {
                dashboard.setComparisonSelection({
                    clinicId: viewModel.clinicId,
                    snapshotAId: selectA.value,
                    snapshotBId: selectB.value
                });
                rerender();
            }
        }
    };
    panel.onclick = async event => {
        const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-history-action]') : null;
        if (!(trigger instanceof HTMLElement)) {
            return;
        }
        const action = trigger.dataset.historyAction || '';
        const snapshotId = trigger.dataset.historySnapshotId || '';
        if (action === 'save-current') {
            const result = dashboard.saveCurrentSnapshot({
                clinicId: viewModel.clinicId,
                currentSnapshot
            });
            createToast(result.saved ? `Snapshot guardado: ${result.savedSnapshot?.snapshotId || ''}` : 'No hay snapshot actual para guardar', result.saved ? 'ready' : 'warning');
            rerender();
            return;
        }
        if (action === 'set-baseline-current') {
            const result = dashboard.setBaseline({
                clinicId: viewModel.clinicId,
                currentSnapshot
            });
            createToast(result ? `Baseline fijado: ${result.snapshotId}` : 'No hay snapshot actual para fijar como baseline', result ? 'ready' : 'warning');
            rerender();
            return;
        }
        if (action === 'copy-summary') {
            const result = await dashboard.copySummary({
                clinicId: viewModel.clinicId,
                currentSnapshot
            });
            createToast(result.copied ? 'Resumen copiado' : 'No se pudo copiar el resumen', result.copied ? 'ready' : 'warning');
            return;
        }
        if (action === 'download-json') {
            const result = dashboard.exportPack({
                clinicId: viewModel.clinicId,
                currentSnapshot
            });
            createToast(result.downloaded ? `Pack descargado: ${result.filename}` : 'No se pudo descargar el pack', result.downloaded ? 'ready' : 'warning');
            return;
        }
        if (action === 'select-a') {
            dashboard.setComparisonSelection({
                clinicId: viewModel.clinicId,
                snapshotAId: snapshotId,
                snapshotBId: viewModel.selectedSnapshotBId || ''
            });
            rerender();
            return;
        }
        if (action === 'select-b') {
            dashboard.setComparisonSelection({
                clinicId: viewModel.clinicId,
                snapshotAId: viewModel.selectedSnapshotAId || '',
                snapshotBId: snapshotId
            });
            rerender();
            return;
        }
        if (action === 'set-baseline') {
            const result = dashboard.setBaseline({
                clinicId: viewModel.clinicId,
                snapshotId
            });
            createToast(result ? `Baseline fijado: ${result.snapshotId}` : 'No se encontró el snapshot para fijarlo como baseline', result ? 'ready' : 'warning');
            rerender();
        }
    };
    return panel;
}

export function getQueueSurfaceSyncScope() {
    return String(getTurneroClinicProfile()?.clinic_id || '').trim() || 'default-clinic';
}

export function getQueueSurfaceRecoveryScope() {
    return String(getTurneroClinicProfile()?.region || getTurneroClinicProfile()?.branding?.city || 'regional').trim() || 'regional';
}

export function buildQueueSurfaceSyncCallingNow(queueMeta) {
    const byConsultorio = queueMeta?.callingNowByConsultorio && typeof queueMeta.callingNowByConsultorio === 'object' ? queueMeta.callingNowByConsultorio : {};
    return [byConsultorio[1], byConsultorio[2]].filter(Boolean);
}

export function getQueueSurfaceSyncPrimaryCalledTicket() {
    return getCalledTicketForConsultorio(1) || getCalledTicketForConsultorio(2);
}

export function getQueueSurfaceSyncPrimaryVisibleTurn(queueMeta) {
    return String(getQueueSurfaceSyncPrimaryCalledTicket()?.ticketCode || queueMeta?.nextTickets?.[0]?.ticketCode || '').trim().toUpperCase();
}

export function normalizeSurfaceSyncSnapshot(instance, surfaceKey) {
    const details = instance?.details && typeof instance.details === 'object' ? instance.details : {};
    const snapshot = details.surfaceSyncSnapshot && typeof details.surfaceSyncSnapshot === 'object' ? details.surfaceSyncSnapshot : {};
    return {
        surfaceKey: String(snapshot.surfaceKey || '').trim() || (surfaceKey === 'operator' ? `operator:${String(details.station || 'c1').trim() || 'c1'}` : surfaceKey),
        queueVersion: String(snapshot.queueVersion || '').trim(),
        visibleTurn: String(snapshot.visibleTurn || '').trim().toUpperCase(),
        announcedTurn: String(snapshot.announcedTurn || '').trim().toUpperCase(),
        handoffState: String(snapshot.handoffState || '').trim() || resolveTurneroSurfaceHandoffState(buildRemoteSurfaceSyncHandoffs(instance, surfaceKey)),
        heartbeatState: String(snapshot.heartbeatState || '').trim() || String(instance?.effectiveStatus || instance?.status || 'unknown').trim().toLowerCase(),
        heartbeatChannel: String(snapshot.heartbeatChannel || '').trim() || 'heartbeat',
        updatedAt: String(snapshot.updatedAt || instance?.updatedAt || '').trim() || new Date().toISOString()
    };
}

export function buildRemoteSurfaceSyncHandoffs(instance, surfaceKey) {
    const details = instance?.details && typeof instance.details === 'object' ? instance.details : {};
    const surfaceLabel = surfaceKey === 'operator' ? String(details.station || 'operator').trim().toUpperCase() : surfaceKey;
    const openCount = Math.max(0, Number(details.surfaceSyncHandoffOpenCount || 0));
    return Array.from({
        length: openCount
    }, (_, index) => ({
        id: `remote_${surfaceKey}_${index + 1}`,
        scope: getQueueSurfaceSyncScope(),
        surfaceKey: String(details.surfaceSyncSnapshot?.surfaceKey || '').trim() || surfaceKey,
        title: `Handoff reportado · ${surfaceLabel}`,
        owner: 'remote_surface',
        source: 'remote_surface',
        status: 'open',
        note: 'La surface reportó handoff abierto vía heartbeat.',
        createdAt: String(instance?.updatedAt || new Date().toISOString()),
        updatedAt: String(instance?.updatedAt || new Date().toISOString())
    }));
}

export function buildAdminSurfaceSyncPack() {
    const {queueMeta} = getQueueSource();
    const callingNow = buildQueueSurfaceSyncCallingNow(queueMeta);
    const nextTickets = Array.isArray(queueMeta?.nextTickets) ? queueMeta.nextTickets : [];
    const handoffStore = createTurneroSurfaceHandoffLedger(getQueueSurfaceSyncScope(), getTurneroClinicProfile());
    const handoffs = handoffStore.list({
        includeClosed: false,
        surfaceKey: 'admin-queue'
    });
    const expectedVisibleTurn = getQueueSurfaceSyncPrimaryVisibleTurn(queueMeta);
    return buildTurneroSurfaceSyncPack({
        surfaceKey: 'admin-queue',
        queueVersion: String(queueMeta?.updatedAt || '').trim(),
        visibleTurn: expectedVisibleTurn,
        announcedTurn: String(getQueueSurfaceSyncPrimaryCalledTicket()?.ticketCode || '').trim().toUpperCase(),
        handoffState: resolveTurneroSurfaceHandoffState(handoffs),
        heartbeat: {
            state: 'ready',
            channel: 'admin-store'
        },
        updatedAt: String(queueMeta?.updatedAt || '').trim(),
        counts: queueMeta?.counts || null,
        waitingCount: Number(queueMeta?.waitingCount || 0),
        calledCount: Number(queueMeta?.calledCount || 0),
        callingNow,
        nextTickets,
        expectedVisibleTurn,
        expectedQueueVersion: String(queueMeta?.updatedAt || '').trim(),
        handoffs
    });
}

export function getExpectedOperatorSurfaceVisibleTurn(instance) {
    const details = instance?.details && typeof instance.details === 'object' ? instance.details : {};
    const station = String(details.station || 'c1').trim().toLowerCase();
    const consultorio = station === 'c2' ? 2 : 1;
    return String(getCalledTicketForConsultorio(consultorio)?.ticketCode || getWaitingForConsultorio(consultorio)?.ticketCode || '').trim().toUpperCase();
}

export function listSurfaceSyncConsoleInstances(surfaceKey) {
    const instances = getSurfaceTelemetryInstances(surfaceKey);
    if (instances.length > 0) {
        return instances;
    }
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest = normalizeSurfaceTelemetryInstance(group.latest, group);
    return latest ? [latest] : [];
}

export function buildSurfaceRecoveryConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    return ['operator', 'kiosk', 'display'].map(surfaceKey => {
        const {group, latest, details} = getLatestSurfaceDetails(surfaceKey);
        const surfaceDefinition = clinicProfile?.surfaces?.[surfaceKey] || ({});
        const expectedRoute = String(surfaceDefinition.route || '').trim();
        const currentRoute = String(details.surfaceRouteCurrent || details.currentRoute || latest?.currentRoute || latest?.route || expectedRoute).trim();
        const effectiveState = String(latest?.effectiveStatus || latest?.status || group.status || 'watch').trim().toLowerCase();
        const normalizedState = effectiveState === 'ready' ? 'ready' : effectiveState === 'degraded' ? 'degraded' : effectiveState === 'blocked' || effectiveState === 'alert' ? 'blocked' : 'watch';
        const summary = String(latest?.summary || group.summary || '').trim() || 'Sin telemetría viva todavía.';
        const runtimeState = {
            state: normalizedState,
            status: latest?.status || group.status || 'watch',
            summary,
            online: details.networkOnline !== false,
            connectivity: details.connectivity || (normalizedState === 'blocked' ? 'offline' : 'online'),
            mode: details.mode || details.appMode || 'live',
            reason: details.reason || '',
            pendingCount: Number(details.pendingCount || details.pendingOffline || 0) || 0,
            outboxSize: Number(details.outboxSize || details.pendingOffline || 0) || 0,
            reconciliationSize: Number(details.reconciliationSize || 0) || 0,
            printerReady: typeof details.printerReady === 'boolean' ? details.printerReady : undefined,
            printerPrinted: typeof details.printerPrinted === 'boolean' ? details.printerPrinted : undefined,
            bellPrimed: typeof details.bellPrimed === 'boolean' ? details.bellPrimed : undefined,
            bellMuted: typeof details.bellMuted === 'boolean' ? details.bellMuted : undefined,
            updateChannel: details.updateChannel || 'stable',
            details: {
                ...details,
                telemetryGroup: group,
                telemetryLatest: latest
            }
        };
        const heartbeat = {
            state: normalizedState,
            status: latest?.status || group.status || 'watch',
            summary,
            channel: String(details.channel || details.heartbeatChannel || 'telemetry'),
            lastBeatAt: String(details.lastBeatAt || latest?.updatedAt || group.updatedAt || ''),
            lastEvent: String(details.lastEvent || details.event || latest?.effectiveStatus || latest?.status || group.status || 'telemetry'),
            lastEventAt: String(details.lastEventAt || latest?.updatedAt || group.updatedAt || ''),
            online: details.networkOnline !== false,
            details: {
                ...details
            }
        };
        const pack = buildTurneroSurfaceRecoveryPack({
            surfaceKey,
            clinicProfile,
            currentRoute,
            runtimeState,
            heartbeat
        });
        return {
            surfaceKey,
            label: pack.readout.surfaceLabel || latest?.deviceLabel || surfaceKey,
            pack
        };
    });
}

export function buildSurfaceIntegrityConsolePacks() {
    const {queueMeta} = getQueueSource();
    const queueVersion = String(queueMeta?.updatedAt || 'qv-1').trim() || 'qv-1';
    const surfaceSeeds = [{
        label: 'Turnero Operador',
        surfaceKey: 'operator-turnos',
        visibleTurn: 'A-202',
        announcedTurn: 'A-202',
        ticketDisplay: 'A202',
        maskedTicket: 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live'
        }
    }, {
        label: 'Turnero Kiosco',
        surfaceKey: 'kiosco-turnos',
        visibleTurn: 'A-201',
        announcedTurn: '',
        ticketDisplay: 'A201',
        maskedTicket: 'A201',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live'
        }
    }, {
        label: 'Turnero Sala TV',
        surfaceKey: 'sala-turnos',
        visibleTurn: 'A-202',
        announcedTurn: 'A-201',
        ticketDisplay: 'A202',
        maskedTicket: 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live'
        }
    }];
    return surfaceSeeds.map(seed => ({
        label: seed.label,
        surfaceKey: seed.surfaceKey,
        pack: buildTurneroSurfaceIntegrityPack({
            surfaceKey: seed.surfaceKey,
            queueVersion,
            visibleTurn: seed.visibleTurn,
            announcedTurn: seed.announcedTurn,
            ticketDisplay: seed.ticketDisplay,
            maskedTicket: seed.maskedTicket,
            privacyMode: seed.privacyMode,
            heartbeat: seed.heartbeat,
            evidence: []
        })
    }));
}

export function buildSurfaceServiceHandoverConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    const scope = getQueueSurfaceRecoveryScope();
    return ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].map(surfaceKey => buildTurneroSurfaceServiceHandoverPack({
        surfaceKey,
        clinicProfile,
        scope
    }));
}

export function buildSurfaceAdoptionConsoleSnapshots() {
    const scope = getQueueSurfaceRecoveryScope();
    return ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].map(surfaceKey => ({
        surfaceKey,
        scope
    }));
}

export function buildSurfaceCommercialConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    return [{
        label: 'Turnero Operador',
        surfaceKey: 'operator-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-lead',
        scopeState: 'ready',
        pricingState: 'watch',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Kiosco',
        surfaceKey: 'kiosco-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot',
        commercialOwner: '',
        opsOwner: 'ops-kiosk',
        scopeState: 'draft',
        pricingState: 'draft',
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Sala TV',
        surfaceKey: 'sala-turnos',
        runtimeState: 'ready',
        truth: 'aligned',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-display',
        scopeState: 'ready',
        pricingState: 'ready',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }];
}

export function buildSurfaceSuccessConsoleSnapshots() {
    const clinicProfile = getTurneroClinicProfile();
    return [{
        label: 'Turnero Operador',
        surfaceKey: 'operator-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        adoptionState: 'watch',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-lead',
        followupWindow: 'mensual',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Kiosco',
        surfaceKey: 'kiosco-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        adoptionState: 'watch',
        incidentRateBand: 'medium',
        feedbackState: 'mixed',
        successOwner: '',
        followupWindow: '',
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Sala TV',
        surfaceKey: 'sala-turnos',
        runtimeState: 'ready',
        truth: 'aligned',
        adoptionState: 'ready',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-display',
        followupWindow: 'mensual',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }];
}

export function buildSurfaceExpansionConsoleSnapshots() {
    const clinicProfile = getTurneroClinicProfile();
    const scope = getQueueSurfaceRecoveryScope();
    return [buildTurneroSurfaceExpansionSnapshot({
        scope,
        surfaceKey: 'operator-turnos',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'medium',
        gapState: 'triage-plus',
        expansionOwner: 'ops-lead',
        nextModuleHint: 'historia-clinica-lite',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        }
    }), buildTurneroSurfaceExpansionSnapshot({
        scope,
        surfaceKey: 'kiosco-turnos',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'low',
        gapState: 'self-checkin',
        expansionOwner: '',
        nextModuleHint: '',
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2
            }
        }
    }), buildTurneroSurfaceExpansionSnapshot({
        scope,
        surfaceKey: 'sala-turnos',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        opportunityState: 'ready',
        demandSignal: 'medium',
        gapState: 'voice-announcer',
        expansionOwner: 'ops-display',
        nextModuleHint: 'analytics-board',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        }
    })];
}

export function buildSurfaceRenewalConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    return [{
        label: 'Turnero Operador',
        surfaceKey: 'operator-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        renewalValueBand: 'high',
        retentionSignal: 'stable',
        feedbackState: 'good',
        activityState: 'active',
        pendingCorrections: 0,
        renewalOwner: 'renewal-lead',
        commercialOwner: 'ernesto',
        successOwner: 'ops-lead',
        nextRenewalWindow: '30 dias',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Kiosco',
        surfaceKey: 'kiosco-turnos',
        runtimeState: 'ready',
        truth: 'watch',
        renewalValueBand: 'medium',
        retentionSignal: 'fragile',
        feedbackState: 'mixed',
        activityState: 'watch',
        pendingCorrections: 2,
        renewalOwner: '',
        commercialOwner: '',
        successOwner: 'ops-kiosk',
        nextRenewalWindow: '15 dias',
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2
            }
        },
        clinicProfile
    }, {
        label: 'Turnero Sala TV',
        surfaceKey: 'sala-turnos',
        runtimeState: 'ready',
        truth: 'aligned',
        renewalValueBand: 'high',
        retentionSignal: 'stable',
        feedbackState: 'good',
        activityState: 'active',
        pendingCorrections: 0,
        renewalOwner: 'ops-display',
        commercialOwner: 'ernesto',
        successOwner: 'ops-display',
        nextRenewalWindow: '45 dias',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        clinicProfile
    }];
}

export function buildSurfacePackageConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    const scope = getQueueSurfaceRecoveryScope();
    return [buildTurneroSurfacePackageSnapshot({
        scope,
        surfaceKey: 'operator',
        surfaceLabel: 'Turnero Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        packageOwner: 'ops-lead',
        bundleState: 'watch',
        provisioningState: 'watch',
        onboardingKitState: 'draft',
        slaBand: 'watch',
        updatedAt: new Date().toISOString()
    }), buildTurneroSurfacePackageSnapshot({
        scope,
        surfaceKey: 'kiosk',
        surfaceLabel: 'Turnero Kiosco',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot',
        packageOwner: '',
        bundleState: 'draft',
        provisioningState: 'draft',
        onboardingKitState: 'draft',
        slaBand: 'draft',
        updatedAt: new Date().toISOString()
    }), buildTurneroSurfacePackageSnapshot({
        scope,
        surfaceKey: 'display',
        surfaceLabel: 'Turnero Sala TV',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        packageTier: 'pilot-plus',
        packageOwner: 'ops-display',
        bundleState: 'ready',
        provisioningState: 'ready',
        onboardingKitState: 'ready',
        slaBand: 'ready',
        updatedAt: new Date().toISOString()
    })];
}

export function buildSurfaceExecutiveReviewConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    const scope = getQueueSurfaceRecoveryScope();
    const now = new Date().toISOString();
    return [buildTurneroSurfaceExecutiveReviewSnapshot({
        scope,
        surfaceKey: 'operator',
        surfaceLabel: 'Turnero Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'watch',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-lead',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        updatedAt: now
    }), buildTurneroSurfaceExecutiveReviewSnapshot({
        scope,
        surfaceKey: 'kiosk',
        surfaceLabel: 'Turnero Kiosco',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        portfolioBand: 'watch',
        priorityBand: 'p2',
        decisionState: 'pending',
        reviewWindow: '',
        reviewOwner: '',
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2
            }
        },
        updatedAt: now
    }), buildTurneroSurfaceExecutiveReviewSnapshot({
        scope,
        surfaceKey: 'display',
        surfaceLabel: 'Turnero Sala TV',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'approved',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-display',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1
            }
        },
        updatedAt: now
    })];
}

export function buildSurfaceReplicationConsolePacks() {
    const clinicProfile = getTurneroClinicProfile();
    return [buildTurneroSurfaceReplicationSnapshot({
        scope: getQueueSurfaceRecoveryScope(),
        surfaceKey: 'operator-turnos',
        surfaceLabel: 'Turnero Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        templateState: 'ready',
        assetProfile: 'mini-pc + printer',
        replicationOwner: 'ops-lead',
        installTimeBucket: 'half-day',
        documentationState: 'ready'
    }), buildTurneroSurfaceReplicationSnapshot({
        scope: getQueueSurfaceRecoveryScope(),
        surfaceKey: 'kiosco-turnos',
        surfaceLabel: 'Turnero Kiosco',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        templateState: 'draft',
        assetProfile: 'kiosk + printer',
        replicationOwner: '',
        installTimeBucket: 'unknown',
        documentationState: 'draft'
    }), buildTurneroSurfaceReplicationSnapshot({
        scope: getQueueSurfaceRecoveryScope(),
        surfaceKey: 'sala-turnos',
        surfaceLabel: 'Turnero Sala TV',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        templateState: 'ready',
        assetProfile: 'tv + audio',
        replicationOwner: 'ops-display',
        installTimeBucket: 'half-day',
        documentationState: 'ready'
    })];
}

export function buildSurfaceSyncConsolePacks() {
    const {queueMeta} = getQueueSource();
    const baseQueueVersion = String(queueMeta?.updatedAt || '').trim();
    const surfacePacks = [{
        label: 'Admin Queue',
        surfaceKey: 'admin-queue',
        pack: buildAdminSurfaceSyncPack(),
        remoteHandoffs: []
    }];
    for (const surfaceKey of ['operator', 'kiosk', 'display']) {
        for (const instance of listSurfaceSyncConsoleInstances(surfaceKey)) {
            const snapshot = normalizeSurfaceSyncSnapshot(instance, surfaceKey);
            const remoteHandoffs = buildRemoteSurfaceSyncHandoffs(instance, surfaceKey);
            const expectedVisibleTurn = surfaceKey === 'operator' ? getExpectedOperatorSurfaceVisibleTurn(instance) : getQueueSurfaceSyncPrimaryVisibleTurn(queueMeta);
            const pack = buildTurneroSurfaceSyncPack({
                surfaceKey: snapshot.surfaceKey,
                queueVersion: snapshot.queueVersion,
                visibleTurn: snapshot.visibleTurn,
                announcedTurn: snapshot.announcedTurn,
                handoffState: snapshot.handoffState,
                heartbeat: {
                    state: snapshot.heartbeatState,
                    channel: snapshot.heartbeatChannel
                },
                updatedAt: snapshot.updatedAt,
                counts: queueMeta?.counts || null,
                waitingCount: Number(queueMeta?.waitingCount || 0),
                calledCount: Number(queueMeta?.calledCount || 0),
                callingNow: buildQueueSurfaceSyncCallingNow(queueMeta),
                nextTickets: Array.isArray(queueMeta?.nextTickets) ? queueMeta.nextTickets : [],
                expectedVisibleTurn,
                expectedQueueVersion: baseQueueVersion,
                handoffs: remoteHandoffs
            });
            surfacePacks.push({
                label: surfaceKey === 'operator' ? String(instance.deviceLabel || 'Operador').trim() || 'Operador' : surfaceKey === 'kiosk' ? 'Kiosco principal' : 'Sala principal',
                surfaceKey: snapshot.surfaceKey,
                pack,
                remoteHandoffs
            });
        }
    }
    return surfacePacks;
}

export function buildSurfaceGoLiveConsolePacks() {
    return [buildSurfaceGoLiveTelemetrySnapshot('operator', 'Operador'), buildSurfaceGoLiveTelemetrySnapshot('kiosk', 'Kiosco'), buildSurfaceGoLiveTelemetrySnapshot('display', 'Sala TV')];
}

export function formatSurfacePlatformLabel(platform) {
    const normalized = String(platform || '').trim().toLowerCase();
    if (normalized === 'win32') {
        return 'Windows';
    }
    if (normalized === 'darwin') {
        return 'macOS';
    }
    if (normalized === 'linux') {
        return 'Linux';
    }
    return normalized === '' ? '' : normalized;
}


export function buildSurfaceAppModeLabel(latest) {
    if (!latest || typeof latest !== 'object') {
        return 'Sin señal';
    }
    const appMode = String(latest.appMode || '').trim().toLowerCase();
    const details = latest.details && typeof latest.details === 'object' ? latest.details : {};
    if (appMode === 'desktop') {
        return details.shellPackaged ? 'Desktop instalada' : 'Desktop en desarrollo';
    }
    if (appMode === 'android_tv') {
        return 'Android TV';
    }
    return 'Fallback web';
}


export function buildKioskAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.kiosk || getDefaultAppDownloads().kiosk;
    const route = buildPreparedSurfaceUrl('kiosk', appConfig, {
        ...preset,
        surface: 'kiosk'
    });
    const {group, latest, details} = getLatestSurfaceDetails('kiosk');
    const connection = String(details.connection || 'live').trim().toLowerCase();
    const pendingOffline = Math.max(0, Number(details.pendingOffline || 0));
    const ageLabel = buildSignalAgeLabel(latest);
    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'kiosk_signal',
            scope: 'Kiosco',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Kiosco sin señal reciente',
            summary: String(group.summary || '').trim() || 'No hay heartbeat reciente del kiosco. Conviene abrir la superficie antes de dejar autoservicio abierto.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir kiosco'
        };
    }
    if (!details.printerPrinted) {
        return {
            id: 'kiosk_printer_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Térmica pendiente en kiosco',
            summary: 'Todavía no hay impresión OK reportada. Genera un ticket real o de prueba antes de depender del kiosco.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar kiosco'
        };
    }
    if (pendingOffline > 0) {
        return {
            id: 'kiosk_offline_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco con pendientes offline',
            summary: `El kiosco mantiene ${pendingOffline} registro(s) sin sincronizar. Resuélvelo antes de dejar el equipo solo por mucho tiempo.`,
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco'
        };
    }
    if (connection !== 'live') {
        return {
            id: 'kiosk_connection',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco sin cola viva',
            summary: 'El kiosco está arriba, pero la cola no figura como viva. Mantén una ruta web preparada antes de seguir recibiendo pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco'
        };
    }
    return null;
}

export function buildDisplayAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.sala_tv || getDefaultAppDownloads().sala_tv;
    const route = buildPreparedSurfaceUrl('sala_tv', appConfig, {
        ...preset,
        surface: 'sala_tv'
    });
    const {group, latest, details} = getLatestSurfaceDetails('display');
    const connection = String(details.connection || 'live').trim().toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);
    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'display_signal',
            scope: 'Sala TV',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Sala TV sin señal reciente',
            summary: String(group.summary || '').trim() || 'La TV no está enviando heartbeat reciente. Conviene abrir la app o el fallback antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir sala TV'
        };
    }
    if (details.bellMuted) {
        return {
            id: 'display_bell_muted',
            scope: 'Sala TV',
            tone: 'alert',
            title: 'Campanilla o volumen apagados en Sala TV',
            summary: 'La TV reporta mute o campanilla desactivada. El llamado visual puede salir, pero perderás confirmación sonora para pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir audio'
        };
    }
    if (!details.bellPrimed) {
        return {
            id: 'display_bell_pending',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV sin prueba de campanilla',
            summary: 'Falta ejecutar la prueba de audio o campanilla en la TCL C655. Hazlo antes del siguiente llamado real.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar sala TV'
        };
    }
    if (connection !== 'live') {
        return {
            id: 'display_connection',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV fuera de cola viva',
            summary: 'La pantalla sigue abierta, pero no está marcando conexión viva. Conviene revisar la app o la red antes de depender de la TV.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar sala TV'
        };
    }
    return null;
}

export function buildConsultorioBoardCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(manifest, detectedPlatform, consultorio);
    const {slot, slotKey, operatorAssigned, operatorSignal, operatorReady, operatorBlocker, operatorLabel, operatorUrl, oneTapLabel, numpadLabel, heartbeatLabel, shellLabel} = operatorContext;
    const slotLabel = getTurneroConsultorioLabel(slot, {
        short: true
    });
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextTicket = getWaitingForConsultorio(slot);
    let state = 'idle';
    let badge = 'Sin cola';
    let summary = 'No hay ticket activo ni en espera para este consultorio en este momento.';
    let primaryLabel = 'Sin ticket listo';
    let primaryAction = 'none';
    if (currentTicket) {
        state = 'active';
        badge = 'Llamado activo';
        summary = `${currentTicket.ticketCode} sigue en atención. Puedes re-llamar o liberar ${slotLabel} sin salir del hub.`;
        primaryLabel = `Re-llamar ${currentTicket.ticketCode}`;
        primaryAction = 'recall';
    } else if (nextTicket && operatorAssigned && operatorReady) {
        state = 'ready';
        badge = 'Listo para llamar';
        summary = `${nextTicket.ticketCode} ya puede llamarse desde ${slotLabel} con el operador correcto arriba y heartbeat vigente.`;
        primaryLabel = `Llamar ${nextTicket.ticketCode}`;
        primaryAction = 'call';
    } else if (nextTicket) {
        state = 'warning';
        badge = 'Falta operador';
        summary = operatorAssigned && operatorBlocker ? `${nextTicket.ticketCode} está listo, pero ${slotLabel} sigue con validación pendiente: ${operatorBlocker}` : `${nextTicket.ticketCode} está listo, pero ${slotLabel} todavía no tiene un operador dedicado o señal suficiente para confiar en el llamado rápido.`;
        primaryLabel = `Abrir Operador ${slotLabel}`;
        primaryAction = 'open';
    } else if (!operatorAssigned) {
        state = operatorSignal ? 'warning' : 'idle';
        badge = operatorSignal ? 'Sin operador dedicado' : 'Sin señal';
        summary = operatorSignal ? `${slotLabel} no coincide con el operador reportado. Conviene abrir el operador correcto antes del siguiente pico de atención.` : `Todavía no hay heartbeat del operador preparado para ${slotLabel}.`;
        primaryLabel = `Abrir Operador ${slotLabel}`;
        primaryAction = 'open';
    } else if (operatorAssigned && operatorReady) {
        state = 'ready';
        badge = 'Listo hoy';
        summary = `${slotLabel} ya tiene operador en vivo y puede recibir el siguiente ticket en cuanto entre a la cola.`;
        primaryLabel = `Abrir Operador ${slotLabel}`;
        primaryAction = 'open';
    } else if (operatorAssigned && operatorBlocker) {
        state = 'warning';
        badge = 'Pendiente de validar';
        summary = `${slotLabel} todavía no está operativo: ${operatorBlocker}`;
        primaryLabel = `Abrir Operador ${slotLabel}`;
        primaryAction = 'open';
    }
    return {
        slot,
        slotKey,
        slotLabel,
        state,
        badge,
        operatorUrl,
        operatorLabel,
        oneTapLabel,
        numpadLabel,
        shellLabel,
        heartbeatLabel,
        summary,
        currentLabel: currentTicket ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(currentTicket, 'called')}` : 'Sin llamado',
        nextLabel: nextTicket ? `${nextTicket.ticketCode} · ${formatQueueTicketAgeLabel(nextTicket, 'waiting')}` : 'Sin ticket en espera',
        primaryLabel,
        primaryAction,
        canRelease: Boolean(currentTicket),
        currentTicketId: Number(currentTicket?.id || 0)
    };
}

export function buildConsultorioBoard(manifest, detectedPlatform) {
    const cards = [1, 2].map(consultorio => buildConsultorioBoardCard(manifest, detectedPlatform, consultorio));
    const activeCount = cards.filter(card => card.state === 'active').length;
    const readyCount = cards.filter(card => card.state === 'ready' || card.state === 'active').length;
    const warningCount = cards.filter(card => card.state === 'warning' || card.state === 'alert').length;
    const title = warningCount > 0 ? 'Mesa por consultorio con pendientes' : 'Mesa por consultorio lista';
    const summary = warningCount > 0 ? `Cada tarjeta resume ${getTurneroConsultorioLabel(1, {
        short: true
    })} y ${getTurneroConsultorioLabel(2, {
        short: true
    })} con ticket actual, siguiente en cola y el operador esperado para resolver el turno sin navegar por toda la tabla.` : `${getTurneroConsultorioLabel(1, {
        short: true
    })} y ${getTurneroConsultorioLabel(2, {
        short: true
    })} ya muestran su contexto operativo directo: ticket activo, siguiente en cola y acceso inmediato al operador correcto.`;
    return {
        title,
        summary,
        statusLabel: warningCount > 0 ? `${warningCount} pendiente(s)` : readyCount > 0 ? `${readyCount}/2 listo(s)` : 'Sin cola ahora',
        statusState: warningCount > 0 ? 'warning' : readyCount > 0 ? 'ready' : 'idle',
        chips: [`Activos ${activeCount}`, `Listos ${readyCount}`, `Pendientes ${warningCount}`],
        cards
    };
}

export function renderConsultorioBoard(manifest, detectedPlatform) {
    const root = document.getElementById('queueConsultorioBoard');
    if (!(root instanceof HTMLElement)) {
        return;
    }
    const board = buildConsultorioBoard(manifest, detectedPlatform);
    setHtml('#queueConsultorioBoard', `
            <section class="queue-consultorio-board__shell" data-state="${escapeHtml(board.statusState)}">
                <div class="queue-consultorio-board__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Mesa por consultorio</p>
                        <h5 id="queueConsultorioBoardTitle" class="queue-app-card__title">${escapeHtml(board.title)}</h5>
                        <p id="queueConsultorioBoardSummary" class="queue-consultorio-board__summary">${escapeHtml(board.summary)}</p>
                    </div>
                    <div class="queue-consultorio-board__meta">
                        <span
                            id="queueConsultorioBoardStatus"
                            class="queue-consultorio-board__status"
                            data-state="${escapeHtml(board.statusState)}"
                        >
                            ${escapeHtml(board.statusLabel)}
                        </span>
                        <div class="queue-consultorio-board__chips">
                            ${board.chips.map(chip => `<span class="queue-consultorio-board__chip">${escapeHtml(chip)}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div id="queueConsultorioBoardCards" class="queue-consultorio-board__grid" role="list" aria-label="Estado vivo por consultorio">
                    ${board.cards.map(card => `
                                <article
                                    id="queueConsultorioCard_${escapeHtml(card.slotKey)}"
                                    class="queue-consultorio-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-consultorio-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.slotLabel)}</strong>
                                            <p class="queue-consultorio-card__operator">${escapeHtml(card.operatorLabel)}</p>
                                        </div>
                                        <span class="queue-consultorio-card__badge">${escapeHtml(card.badge)}</span>
                                    </div>
                                    <p class="queue-consultorio-card__summary">${escapeHtml(card.summary)}</p>
                                    <div class="queue-consultorio-card__facts">
                                        <div class="queue-consultorio-card__fact">
                                            <span>Ahora</span>
                                            <strong id="queueConsultorioCurrent_${escapeHtml(card.slotKey)}">${escapeHtml(card.currentLabel)}</strong>
                                        </div>
                                        <div class="queue-consultorio-card__fact">
                                            <span>Siguiente</span>
                                            <strong id="queueConsultorioNext_${escapeHtml(card.slotKey)}">${escapeHtml(card.nextLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-consultorio-card__chips">
                                        <span class="queue-consultorio-card__chip">${escapeHtml(card.oneTapLabel)}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(card.numpadLabel)}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(card.shellLabel)}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(card.heartbeatLabel)}</span>
                                    </div>
                                    <div class="queue-consultorio-card__actions">
                                        <button
                                            id="queueConsultorioPrimary_${escapeHtml(card.slotKey)}"
                                            type="button"
                                            class="queue-consultorio-card__action queue-consultorio-card__action--primary"
                                            data-queue-consultorio-action="${escapeHtml(card.primaryAction)}"
                                            data-queue-consultorio="${escapeHtml(String(card.slot))}"
                                            data-queue-ticket-id="${escapeHtml(String(card.currentTicketId))}"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <button
                                            id="queueConsultorioRelease_${escapeHtml(card.slotKey)}"
                                            type="button"
                                            class="queue-consultorio-card__action"
                                            data-queue-consultorio-release="${escapeHtml(String(card.slot))}"
                                            ${card.canRelease ? '' : 'disabled'}
                                        >
                                            Liberar ${escapeHtml(card.slotLabel)}
                                        </button>
                                        <a
                                            id="queueConsultorioOpenOperator_${escapeHtml(card.slotKey)}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-consultorio-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(card.slotLabel)}
                                        </a>
                                    </div>
                                </article>
                            `).join('')}
                </div>
            </section>
        `);
    board.cards.forEach(card => {
        const primaryButton = document.getElementById(`queueConsultorioPrimary_${card.slotKey}`);
        if (primaryButton instanceof HTMLButtonElement) {
            primaryButton.onclick = () => {
                if (card.primaryAction === 'call') {
                    const headerButton = document.querySelector(`#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${card.slot}"]`);
                    if (headerButton instanceof HTMLButtonElement) {
                        headerButton.click();
                    }
                    return;
                }
                if (card.primaryAction === 'recall' && card.currentTicketId > 0) {
                    const recallButton = document.querySelector(`[data-action="queue-ticket-action"][data-queue-id="${card.currentTicketId}"][data-queue-action="re-llamar"]`);
                    if (recallButton instanceof HTMLButtonElement) {
                        recallButton.click();
                        return;
                    }
                }
                if (card.primaryAction === 'open') {
                    window.open(card.operatorUrl, '_blank', 'noopener');
                }
            };
        }
        const releaseButton = document.getElementById(`queueConsultorioRelease_${card.slotKey}`);
        if (releaseButton instanceof HTMLButtonElement) {
            releaseButton.onclick = () => {
                const targetButton = document.getElementById(card.slot === 2 ? 'queueReleaseC2' : 'queueReleaseC1');
                if (targetButton instanceof HTMLButtonElement) {
                    targetButton.click();
                }
            };
        }
    });
}

export function renderQueueSurfaceRecoveryConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceRecoveryConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceRecoveryConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        getSurfacePacks: buildSurfaceRecoveryConsolePacks,
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceAdoptionConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceAdoptionConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceAdoptionConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceAdoptionConsoleSnapshots(),
        surfacesUrl: '/data/turnero-surfaces.json',
        manifestUrl: '/release-manifest.json',
        fallbackManifestUrl: '/app-downloads/pilot/release-manifest.json',
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceIntegrityConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceIntegrityConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceIntegrityConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        getSurfacePacks: buildSurfaceIntegrityConsolePacks,
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceServiceHandoverConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceServiceHandoverConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceServiceHandoverConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        surfacePacks: buildSurfaceServiceHandoverConsolePacks(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceOnboardingConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceOnboardingConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceOnboardingConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: [{
            surfaceKey: 'operator-turnos',
            runtimeState: 'ready',
            truth: 'watch',
            kickoffState: 'ready',
            dataIntakeState: 'ready',
            accessState: 'watch',
            onboardingOwner: 'ops-lead',
            trainingWindow: 'martes 09:00'
        }, {
            surfaceKey: 'kiosco-turnos',
            runtimeState: 'ready',
            truth: 'watch',
            kickoffState: 'watch',
            dataIntakeState: 'pending',
            accessState: 'pending',
            onboardingOwner: '',
            trainingWindow: ''
        }, {
            surfaceKey: 'sala-turnos',
            runtimeState: 'ready',
            truth: 'aligned',
            kickoffState: 'ready',
            dataIntakeState: 'ready',
            accessState: 'ready',
            onboardingOwner: 'ops-display',
            trainingWindow: 'miercoles 08:00'
        }],
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceReplicationConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceReplicationConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceReplicationConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceReplicationConsolePacks(),
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceFleetConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceFleetConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceFleetConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceCommercialConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceCommercialConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    if (isFlowOsRecoveryAdminPanelFrozen('queueSurfaceCommercialConsoleHost')) {
        hideFlowOsRecoveryHost(root, getFlowOsRecoveryFreezeNotice());
        return null;
    }
    return mountTurneroAdminQueueSurfaceCommercialConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceCommercialConsolePacks(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceRenewalConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceRenewalConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    if (isFlowOsRecoveryAdminPanelFrozen('queueSurfaceRenewalConsoleHost')) {
        hideFlowOsRecoveryHost(root, getFlowOsRecoveryFreezeNotice());
        return null;
    }
    return mountTurneroAdminQueueSurfaceRenewalConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        surfacePacks: buildSurfaceRenewalConsolePacks(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceSuccessConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceSuccessConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceSuccessConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceSuccessConsoleSnapshots(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceExpansionConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceExpansionConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    if (isFlowOsRecoveryAdminPanelFrozen('queueSurfaceExpansionConsoleHost')) {
        hideFlowOsRecoveryHost(root, getFlowOsRecoveryFreezeNotice());
        return null;
    }
    return mountTurneroAdminQueueSurfaceExpansionConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceExpansionConsoleSnapshots(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        releaseManifest: manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceSupportConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceSupportConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceSupportConsole(root, {
        scope: 'queue-support',
        clinicProfile: getTurneroClinicProfile(),
        surfaceKey: 'admin'
    });
}

export function renderQueueSurfacePackageConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfacePackageConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfacePackageConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfacePackageConsolePacks(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        releaseManifest: manifest,
        detectedPlatform
    });
}

export function renderQueueSurfaceExecutiveReviewConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceExecutiveReviewConsoleHost');
    if (!(root instanceof HTMLElement)) {
        return null;
    }
    return mountTurneroAdminQueueSurfaceExecutiveReviewConsole(root, {
        scope: getQueueSurfaceRecoveryScope(),
        clinicProfile: getTurneroClinicProfile(),
        snapshots: buildSurfaceExecutiveReviewConsolePacks(),
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2
            }
        },
        releaseManifest: manifest,
        detectedPlatform
    });
}

