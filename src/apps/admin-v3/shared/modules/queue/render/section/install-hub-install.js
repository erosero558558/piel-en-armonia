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


export const QUEUE_INSTALL_PRESET_STORAGE_KEY = 'queueInstallPresetV1';

export let installPreset = null;

export let installPresetClinicId = null;

export function getDefaultAppDownloads() {
    return getInstallHubDefaultAppDownloads();
}

export function getSurfaceTelemetryCopy(surfaceKey) {
    return getInstallHubSurfaceTelemetryCopy(surfaceKey);
}

export function listInstallHubSurfaceOrder() {
    const surfaceOrder = getInstallHubSurfaceOrder();
    if (surfaceOrder.length > 0) {
        return surfaceOrder;
    }
    return Object.keys(getDefaultAppDownloads());
}

export function normalizeInstallPreset(rawPreset, detectedPlatform) {
    const raw = rawPreset && typeof rawPreset === 'object' ? rawPreset : {};
    const platform = raw.platform === 'mac' ? 'mac' : detectedPlatform === 'mac' ? 'mac' : 'win';
    return {
        clinicId: String(raw.clinicId || getActiveQueueOpsClinicId()).trim() || getActiveQueueOpsClinicId(),
        surface: raw.surface === 'kiosk' || raw.surface === 'sala_tv' ? raw.surface : 'operator',
        station: raw.station === 'c2' ? 'c2' : 'c1',
        lock: Boolean(raw.lock),
        oneTap: Boolean(raw.oneTap),
        platform
    };
}

export function loadStoredInstallPreset(detectedPlatform) {
    const activeClinicId = getActiveQueueOpsClinicId();
    try {
        const rawValue = window.localStorage.getItem(QUEUE_INSTALL_PRESET_STORAGE_KEY);
        if (!rawValue) {
            return null;
        }
        const parsed = JSON.parse(rawValue);
        if (String(parsed?.clinicId || '').trim() !== activeClinicId) {
            return null;
        }
        return normalizeInstallPreset(parsed, detectedPlatform);
    } catch (_error) {
        return null;
    }
}

export function persistInstallPreset(nextPreset, detectedPlatform) {
    installPreset = normalizeInstallPreset(nextPreset, detectedPlatform);
    installPresetClinicId = installPreset.clinicId;
    try {
        window.localStorage.setItem(QUEUE_INSTALL_PRESET_STORAGE_KEY, JSON.stringify(installPreset));
    } catch (_error) {}
    return installPreset;
}

export function buildDerivedInstallPreset(detectedPlatform) {
    const state = getState();
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(operator.details.station || '').toLowerCase();
    const operatorStationMode = String(operator.details.stationMode || '').trim().toLowerCase();
    const operatorOneTap = operator.details.oneTap;
    return normalizeInstallPreset({
        surface: 'operator',
        station: operatorStation === 'c2' ? 'c2' : operatorStation === 'c1' ? 'c1' : Number(state.queue && state.queue.stationConsultorio) === 2 ? 'c2' : 'c1',
        lock: operatorStationMode === 'locked' ? true : operatorStationMode === 'free' ? false : Boolean(state.queue && state.queue.stationMode === 'locked'),
        oneTap: typeof operatorOneTap === 'boolean' ? operatorOneTap : Boolean(state.queue && state.queue.oneTap),
        platform: detectedPlatform === 'win' || detectedPlatform === 'mac' ? detectedPlatform : 'win'
    }, detectedPlatform);
}

export function ensureInstallPreset(detectedPlatform) {
    const activeClinicId = getActiveQueueOpsClinicId();
    if (installPreset && installPresetClinicId === activeClinicId) {
        return installPreset;
    }
    const storedPreset = loadStoredInstallPreset(detectedPlatform);
    if (storedPreset) {
        installPreset = storedPreset;
        installPresetClinicId = storedPreset.clinicId;
        return installPreset;
    }
    return persistInstallPreset(buildDerivedInstallPreset(detectedPlatform), detectedPlatform);
}

export function getInstallPresetLabel(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const modeLabel = preset.lock ? `${stationLabel} fijo` : `${stationLabel} libre`;
    return `Operador ${modeLabel}${preset.oneTap ? ' · 1 tecla' : ''}`;
}

export function buildInstallPresetChoices(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    return [{
        id: 'operator_c1_locked',
        label: 'Operador C1',
        state: preset.surface === 'operator' && preset.station === 'c1' && preset.lock,
        nextPreset: {
            ...preset,
            surface: 'operator',
            station: 'c1',
            lock: true
        }
    }, {
        id: 'operator_c2_locked',
        label: 'Operador C2',
        state: preset.surface === 'operator' && preset.station === 'c2' && preset.lock,
        nextPreset: {
            ...preset,
            surface: 'operator',
            station: 'c2',
            lock: true
        }
    }, {
        id: 'operator_free',
        label: 'Operador libre',
        state: preset.surface === 'operator' && !preset.lock,
        nextPreset: {
            ...preset,
            surface: 'operator',
            station: preset.station === 'c2' ? 'c2' : 'c1',
            lock: false
        }
    }, {
        id: 'kiosk',
        label: 'Kiosco',
        state: preset.surface === 'kiosk',
        nextPreset: {
            ...preset,
            surface: 'kiosk'
        }
    }, {
        id: 'sala_tv',
        label: 'Sala TV',
        state: preset.surface === 'sala_tv',
        nextPreset: {
            ...preset,
            surface: 'sala_tv'
        }
    }];
}

export function renderInstallHubSurfaceCards(manifest, platform) {
    return listInstallHubSurfaceOrder().map(surfaceKey => {
        const surface = getInstallHubSurfaceDefinition(surfaceKey);
        const appConfig = manifest[surfaceKey] || getDefaultAppDownloads()[surfaceKey];
        if (!surface || !appConfig) {
            return '';
        }
        if (surface.family === 'android') {
            return renderAndroidCard(surfaceKey, appConfig);
        }
        return renderDesktopCard(surfaceKey, appConfig, platform);
    }).join('');
}

export function buildPresetSummaryTitle(preset) {
    if (preset.surface === 'sala_tv') {
        return 'Sala TV lista para TCL C655';
    }
    if (preset.surface === 'kiosk') {
        return 'Kiosco listo para mostrador';
    }
    if (!preset.lock) {
        return 'Operador en modo libre';
    }
    return `Operador ${preset.station === 'c2' ? 'C2' : 'C1'} fijo`;
}

export function buildPresetSteps(preset) {
    if (preset.surface === 'sala_tv') {
        return ['Abre el QR desde otra pantalla o descarga la APK directamente.', 'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.', 'Valida audio, reconexión y que la sala refleje llamados reales.'];
    }
    if (preset.surface === 'kiosk') {
        return ['Instala la app en el mini PC o PC del kiosco.', 'Deja la impresora térmica conectada y la app en fullscreen.', 'Usa la versión web como respaldo inmediato si el equipo se reinicia.'];
    }
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    return [`Instala Turnero Operador en el PC de ${stationLabel} y conecta el receptor USB del Genius Numpad 1000.`, `En el primer arranque deja el equipo como ${preset.lock ? `${stationLabel} fijo` : 'modo libre'}${preset.oneTap ? ' con 1 tecla' : ''}.`, 'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.'];
}

export function getInstallTargetFileName(url) {
    return String(url || '').split('/').filter(Boolean).pop();
}

export function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object' ? runtime : {
        state: 'idle',
        reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
        intervalMs: 45000,
        lastAttemptAt: 0,
        lastSuccessAt: 0,
        lastError: '',
        inFlight: false
    };
}

export function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle').trim().toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt ? `ultimo ciclo hace ${formatHeartbeatAge(Math.max(0, Math.round((Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000)))}` : 'sin ciclo exitoso todavía';
    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`
        };
    }
    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(runtime.reason || 'Reanuda esta sección para continuar.')
        };
    }
    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(runtime.reason || `Modo degradado · ${lastSuccessLabel}`)
        };
    }
    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`
        };
    }
    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.')
    };
}

export function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

export function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object' ? raw : {
        surface: surfaceKey,
        status: 'unknown',
        stale: true,
        summary: '',
        latest: null,
        instances: []
    };
}

export function normalizeSurfaceTelemetryInstance(instance, group) {
    if (!instance || typeof instance !== 'object') {
        return null;
    }
    const fallbackStatus = String(group?.status || 'unknown').trim().toLowerCase();
    const rawStatus = String(instance.effectiveStatus || instance.status || fallbackStatus).trim().toLowerCase();
    const details = instance.details && typeof instance.details === 'object' ? instance.details : {};
    return {
        ...instance,
        details,
        effectiveStatus: rawStatus || fallbackStatus,
        status: String(instance.status || rawStatus || fallbackStatus),
        stale: typeof instance.stale === 'boolean' ? instance.stale : group?.stale === true,
        updatedAt: String(instance.updatedAt || group?.updatedAt || ''),
        ageSec: Number.isFinite(Number(instance.ageSec)) ? Number(instance.ageSec) : Number(group?.ageSec || 0),
        summary: String(instance.summary || group?.summary || '')
    };
}

export function getSurfaceTelemetryInstances(surfaceKey) {
    const group = getSurfaceTelemetryState(surfaceKey);
    return Array.isArray(group.instances) ? group.instances.filter(instance => instance && typeof instance === 'object').map(instance => normalizeSurfaceTelemetryInstance(instance, group)).filter(Boolean) : [];
}

export function buildSurfaceGoLiveTelemetrySnapshot(surfaceKey, surfaceLabel) {
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest = normalizeSurfaceTelemetryInstance(group.latest, group);
    const details = latest?.details && typeof latest.details === 'object' ? latest.details : {};
    const clinicProfile = getTurneroClinicProfile();
    const runtimeState = String(latest?.effectiveStatus || group.status || details.connection || details.surfaceContractState || 'unknown').trim();
    const truthState = String(details.surfaceContractState || group.status || latest?.status || 'unknown').trim();
    const routeCurrent = String(details.surfaceRouteCurrent || details.currentRoute || '').trim();
    const routeExpected = String(details.surfaceRouteExpected || details.expectedRoute || '').trim();
    const routeMatches = routeCurrent !== '' && routeExpected !== '' && routeCurrent === routeExpected;
    const printerState = surfaceKey === 'kiosk' ? details.printerPrinted ? 'ready' : details.printerErrorCode ? 'alert' : 'watch' : surfaceKey === 'display' ? Number(details.surfaceSyncHandoffOpenCount || 0) > 0 ? 'watch' : 'ready' : routeMatches ? 'ready' : 'watch';
    const bellState = surfaceKey === 'display' ? details.bellPrimed ? 'ready' : 'watch' : surfaceKey === 'kiosk' ? details.assistantSessionId ? 'ready' : 'watch' : String(details.readinessState || '').trim() || 'watch';
    const signageState = surfaceKey === 'operator' ? details.profileSource ? 'ready' : 'watch' : routeMatches ? 'ready' : 'watch';
    const operatorReady = surfaceKey === 'operator' ? runtimeState !== 'unknown' && truthState !== 'alert' : surfaceKey === 'kiosk' ? Boolean(details.printerPrinted && details.connection === 'live') : Boolean(details.connection === 'live' && details.bellPrimed && !details.bellMuted);
    return buildTurneroSurfaceGoLiveSnapshot({
        scope: surfaceKey,
        surfaceKey,
        surfaceLabel,
        clinicProfile,
        runtimeState,
        truth: truthState,
        printerState,
        bellState,
        signageState,
        operatorReady,
        updatedAt: String(latest?.updatedAt || group.updatedAt || latest?.reportedAt || '').trim()
    });
}

export function buildOperatorNumpadTelemetryLabel(details, {compact = false} = {}) {
    if (!details || typeof details !== 'object') {
        return compact ? 'Numpad pendiente' : 'Numpad sin señal';
    }
    if (isOperatorNumpadReady(details)) {
        return 'Numpad listo';
    }
    const progress = Number(details.numpadProgress || 0);
    const required = Number(details.numpadRequired || 0);
    const compactLabel = required > 0 ? `Numpad ${progress}/${required}` : 'Numpad pendiente';
    if (compact) {
        return String(details.numpadLabel || '').trim() || compactLabel;
    }
    return String(details.numpadSummary || '').trim() || String(details.numpadLabel || '').trim() || compactLabel;
}

export function resolveTelemetryBadge(state) {
    if (state === 'ready') return 'En vivo';
    if (state === 'alert') return 'Atender';
    if (state === 'warning') return 'Revisar';
    return 'Sin señal';
}

export function buildSurfaceTelemetryInstanceMeta(surfaceKey, latest) {
    const details = latest?.details && typeof latest.details === 'object' ? latest.details : {};
    const parts = [buildSurfaceAppModeLabel(latest)];
    if (surfaceKey === 'operator') {
        const lifecycleLabel = buildOperatorShellLifecycleMetaLabel(details);
        if (lifecycleLabel) {
            parts.push(lifecycleLabel);
        }
        const platformLabel = formatSurfacePlatformLabel(details.shellPlatform);
        if (platformLabel) {
            parts.push(platformLabel);
        }
        const updateChannel = String(details.shellUpdateChannel || '').trim();
        if (updateChannel) {
            parts.push(`canal ${updateChannel}`);
        }
        parts.push(...buildOperatorShellStartupLabels(details));
        const shellStatusLabel = buildOperatorShellStatusMetaLabel(details);
        if (shellStatusLabel) {
            parts.push(shellStatusLabel);
        }
    }
    return parts.filter(Boolean).join(' · ');
}

export function buildSurfaceTelemetryInstanceSummary(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') {
        return 'Sin señal todavía.';
    }
    const details = latest.details && typeof latest.details === 'object' ? latest.details : {};
    if (surfaceKey === 'operator') {
        const profileLabel = buildOperatorProfileLabel(details);
        const parts = [];
        if (profileLabel) {
            parts.push(profileLabel);
        }
        parts.push(details.oneTap ? '1 tecla ON' : '1 tecla OFF');
        parts.push(buildOperatorNumpadTelemetryLabel(details));
        const lifecycleLabel = buildOperatorShellLifecycleSummaryLabel(details);
        if (lifecycleLabel) {
            parts.push(lifecycleLabel);
        }
        const shellStatusSummary = buildOperatorShellStatusSummaryLabel(details);
        if (shellStatusSummary) {
            parts.push(shellStatusSummary);
        }
        const latestSummary = String(latest.summary || '').trim();
        const summary = parts.join(' · ');
        if (latestSummary && lifecycleLabel && !summary.includes(latestSummary)) {
            return `${summary} · ${latestSummary}`;
        }
        return summary;
    }
    return String(latest.summary || '').trim() || 'Sin señal todavía.';
}

export function buildSurfaceTelemetryInstances(surfaceKey, group) {
    const instances = getSurfaceTelemetryInstances(surfaceKey);
    return instances.map((instance, index) => {
        const effectiveState = String(instance.effectiveStatus || instance.status || 'unknown').trim().toLowerCase();
        return {
            id: `${surfaceKey}-${index + 1}`,
            state: ['ready', 'warning', 'alert'].includes(effectiveState) ? effectiveState : 'unknown',
            badge: resolveTelemetryBadge(effectiveState),
            deviceLabel: String(instance.deviceLabel || 'Sin equipo reportando'),
            profileLabel: buildOperatorProfileLabel(instance.details || ({})),
            meta: buildSurfaceTelemetryInstanceMeta(surfaceKey, instance),
            summary: buildSurfaceTelemetryInstanceSummary(surfaceKey, instance),
            supportEntries: surfaceKey === 'operator' ? buildOperatorShellSupportEntries(instance.details || ({})) : [],
            ageLabel: buildSignalAgeLabel(instance, 'Sin heartbeat todavía')
        };
    });
}

export function buildSurfaceTelemetryGroupLabel(surfaceKey, latest, instances) {
    if (instances.length <= 1) {
        return String(latest?.deviceLabel || 'Sin equipo reportando');
    }
    if (surfaceKey === 'operator') {
        return `${instances.length} PCs operador reportando`;
    }
    return `${instances.length} equipos reportando`;
}

export function buildSurfaceTelemetryGroupSummary(surfaceKey, group, instances) {
    const baseSummary = String(group.summary || '').trim();
    if (surfaceKey === 'operator' && instances.length > 1) {
        const profiles = Array.from(new Set(instances.map(instance => String(instance.profileLabel || '')).filter(Boolean)));
        if (profiles.length > 0) {
            return `${instances.length} equipos operador reportando: ${profiles.join(' y ')}.`;
        }
    }
    return baseSummary || getSurfaceTelemetryCopy(surfaceKey).emptySummary || 'Sin señal todavía.';
}

export function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') {
        return ['Sin señal'];
    }
    const details = latest.details && typeof latest.details === 'object' ? latest.details : {};
    const chips = [];
    chips.push(buildSurfaceAppModeLabel(latest));
    if (surfaceKey === 'operator') {
        const profileLabel = buildOperatorProfileLabel(details);
        if (profileLabel) {
            chips.push(profileLabel);
        }
        chips.push(details.oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(buildOperatorNumpadTelemetryLabel(details, {
            compact: true
        }));
        const lifecycleLabel = buildOperatorShellLifecycleMetaLabel(details);
        if (lifecycleLabel) {
            chips.push(lifecycleLabel);
        }
        const shellStatusLabel = buildOperatorShellStatusMetaLabel(details);
        if (shellStatusLabel) {
            chips.push(shellStatusLabel);
        }
    } else if (surfaceKey === 'kiosk') {
        chips.push(details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(String(details.connection || '').toLowerCase() === 'live' ? 'Cola en vivo' : 'Cola degradada');
    } else if (surfaceKey === 'display') {
        chips.push(details.bellPrimed ? 'Audio listo' : 'Audio pendiente');
        chips.push(details.bellMuted ? 'Campanilla Off' : 'Campanilla On');
        chips.push(String(details.connection || '').toLowerCase() === 'live' ? 'Sala en vivo' : 'Sala degradada');
    }
    return chips.slice(0, 4);
}

export function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [{
        key: 'operator',
        appConfig: manifest.operator || getDefaultAppDownloads().operator,
        fallbackSurface: 'operator',
        actionLabel: 'Abrir operador'
    }, {
        key: 'kiosk',
        appConfig: manifest.kiosk || getDefaultAppDownloads().kiosk,
        fallbackSurface: 'kiosk',
        actionLabel: 'Abrir kiosco'
    }, {
        key: 'display',
        appConfig: manifest.sala_tv || getDefaultAppDownloads().sala_tv,
        fallbackSurface: 'sala_tv',
        actionLabel: 'Abrir sala TV'
    }];
    return cards.map(entry => {
        const group = getSurfaceTelemetryState(entry.key);
        const instances = buildSurfaceTelemetryInstances(entry.key, group);
        const latest = group.latest && typeof group.latest === 'object' ? group.latest : null;
        const effectiveState = String(group.status || 'unknown');
        const route = buildPreparedSurfaceUrl(entry.fallbackSurface, entry.appConfig, {
            ...preset,
            surface: entry.fallbackSurface
        });
        return {
            key: entry.key,
            title: getSurfaceTelemetryCopy(entry.key).title || entry.key,
            state: effectiveState === 'ready' || effectiveState === 'warning' || effectiveState === 'alert' ? effectiveState : 'unknown',
            badge: effectiveState === 'ready' ? 'En vivo' : effectiveState === 'alert' ? 'Atender' : effectiveState === 'warning' ? 'Revisar' : 'Sin señal',
            deviceLabel: buildSurfaceTelemetryGroupLabel(entry.key, latest, instances),
            summary: buildSurfaceTelemetryGroupSummary(entry.key, group, instances),
            ageLabel: latest && latest.ageSec !== undefined && latest.ageSec !== null ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}` : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            instances,
            route,
            actionLabel: entry.actionLabel
        };
    });
}

export function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) {
        return;
    }
    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const hasAlert = cards.some(card => card.state === 'alert');
    const hasWarning = cards.some(card => card.state === 'warning' || card.state === 'unknown');
    const title = hasAlert ? 'Equipos con atención urgente' : hasWarning ? 'Equipos con señal parcial' : 'Equipos en vivo';
    const summary = hasAlert ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.' : hasWarning ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.' : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.';
    const statusLabel = hasAlert ? 'Atender ahora' : hasWarning ? 'Revisar hoy' : 'Todo al día';
    const statusState = hasAlert ? 'alert' : hasWarning ? 'warning' : 'ready';
    setHtml('#queueSurfaceTelemetry', `
            <section class="queue-surface-telemetry__shell">
                <div class="queue-surface-telemetry__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                        <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(title)}</h5>
                        <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(summary)}</p>
                        <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                            <span
                                id="queueSurfaceTelemetryAutoState"
                                class="queue-surface-telemetry__auto-state"
                                data-state="${escapeHtml(autoRefresh.state)}"
                            >
                                ${escapeHtml(autoRefresh.label)}
                            </span>
                            <span class="queue-surface-telemetry__auto-copy">${escapeHtml(autoRefresh.meta)}</span>
                        </div>
                    </div>
                    <span
                        id="queueSurfaceTelemetryStatus"
                        class="queue-surface-telemetry__status"
                        data-state="${escapeHtml(statusState)}"
                    >
                        ${escapeHtml(statusLabel)}
                    </span>
                </div>
                <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                    ${cards.map(card => `
                                <article
                                    class="queue-surface-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-surface-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-surface-card__meta">${escapeHtml(card.deviceLabel)}</p>
                                        </div>
                                        <span class="queue-surface-card__badge">${escapeHtml(card.badge)}</span>
                                    </div>
                                    <p class="queue-surface-card__summary">${escapeHtml(card.summary)}</p>
                                    <p class="queue-surface-card__age">${escapeHtml(card.ageLabel)}</p>
                                    ${card.instances.length > 0 ? `
                                                <div class="queue-surface-card__instances" role="list" aria-label="Instancias en vivo de ${escapeHtml(card.title)}">
                                                    ${card.instances.map(instance => `
                                                                <article
                                                                    class="queue-surface-card__instance"
                                                                    data-state="${escapeHtml(instance.state)}"
                                                                    role="listitem"
                                                                >
                                                                    <div class="queue-surface-card__instance-head">
                                                                        <strong>${escapeHtml(instance.deviceLabel)}</strong>
                                                                        <span class="queue-surface-card__instance-badge">${escapeHtml(instance.badge)}</span>
                                                                    </div>
                                                                    <p class="queue-surface-card__instance-meta">${escapeHtml(instance.meta)}</p>
                                                                    <p class="queue-surface-card__instance-summary">${escapeHtml(instance.summary)}</p>
                                                                    ${Array.isArray(instance.supportEntries) && instance.supportEntries.length > 0 ? `
                                                                                <div class="queue-surface-card__instance-support" role="list" aria-label="Soporte remoto de ${escapeHtml(instance.deviceLabel)}">
                                                                                    ${instance.supportEntries.map(entry => `
                                                                                                <p class="queue-surface-card__instance-support-entry" role="listitem">
                                                                                                    <strong>${escapeHtml(entry.label)}</strong>
                                                                                                    <span>${escapeHtml(entry.value)}</span>
                                                                                                </p>
                                                                                            `).join('')}
                                                                                </div>
                                                                            ` : ''}
                                                                    <p class="queue-surface-card__instance-age">${escapeHtml(instance.ageLabel)}</p>
                                                                </article>
                                                            `).join('')}
                                                </div>
                                            ` : ''}
                                    <div class="queue-surface-card__chips">
                                        ${card.chips.map(chip => `<span class="queue-surface-card__chip">${escapeHtml(chip)}</span>`).join('')}
                                    </div>
                                    <div class="queue-surface-card__actions">
                                        <a
                                            href="${escapeHtml(card.route)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-surface-card__action queue-surface-card__action--primary"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="queue-copy-install-link"
                                            data-queue-install-url="${escapeHtml(card.route)}"
                                        >
                                            Copiar ruta
                                        </button>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="refresh-admin-data"
                                        >
                                            Actualizar estado
                                        </button>
                                    </div>
                                </article>
                            `).join('')}
                </div>
                <div id="queueSurfaceSyncConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceGoLiveConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceIntegrityConsoleHost" class="queue-surface-telemetry__sync-console-host" data-turnero-surface-integrity-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents" aria-live="polite"></div>
                <div id="queueSurfaceReplicationConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceServiceHandoverConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceOnboardingConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceFleetConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceCommercialConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceRenewalConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceSuccessConsoleHost" class="queue-surface-telemetry__sync-console-host" data-turnero-surface-success-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents" aria-live="polite"></div>
                <div id="queueSurfaceExpansionConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceSupportConsoleHost" class="queue-surface-telemetry__sync-console-host" aria-live="polite"></div>
                <div id="queueSurfaceExecutiveReviewConsoleHost" class="queue-surface-telemetry__sync-console-host" data-turnero-surface-executive-review-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents" aria-live="polite"></div>
                <div id="queueSurfacePackageConsoleHost" class="queue-surface-telemetry__sync-console-host" data-turnero-surface-package-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents" aria-live="polite"></div>
                <div id="queueSurfaceTelemetryOptimizationHubHost" class="queue-surface-telemetry__optimization-host" aria-live="polite"></div>
            </section>
        `);
    const surfaceSyncConsoleHost = document.getElementById('queueSurfaceSyncConsoleHost');
    if (surfaceSyncConsoleHost instanceof HTMLElement) {
        mountTurneroAdminQueueSurfaceSyncConsole(surfaceSyncConsoleHost, {
            scope: getQueueSurfaceSyncScope(),
            clinicProfile: getTurneroClinicProfile(),
            getSurfacePacks: buildSurfaceSyncConsolePacks
        });
    }
    const surfaceGoLiveConsoleHost = document.getElementById('queueSurfaceGoLiveConsoleHost');
    if (surfaceGoLiveConsoleHost instanceof HTMLElement) {
        mountTurneroAdminQueueSurfaceGoLiveConsole(surfaceGoLiveConsoleHost, {
            scope: getQueueSurfaceSyncScope(),
            clinicProfile: getTurneroClinicProfile(),
            getSurfacePacks: buildSurfaceGoLiveConsolePacks
        });
    }
    const surfaceSupportConsoleHost = document.getElementById('queueSurfaceSupportConsoleHost');
    if (surfaceSupportConsoleHost instanceof HTMLElement) {
        mountTurneroAdminQueueSurfaceSupportConsole(surfaceSupportConsoleHost, {
            scope: 'queue-support',
            clinicProfile: getTurneroClinicProfile()
        });
    }
    const optimizationHubHost = document.getElementById('queueSurfaceTelemetryOptimizationHubHost');
    if (optimizationHubHost instanceof HTMLElement) {
        const state = getState();
        const {queueMeta} = getQueueSource();
        const releaseParts = getTurneroReleaseCommandDeckParts();
        const turneroClinicProfile = getTurneroClinicProfile();
        const releaseEvidenceBundle = releaseParts.releaseEvidenceBundle || state.data.turneroReleaseEvidenceBundle || null;
        const resolvedRegion = turneroClinicProfile?.region || releaseEvidenceBundle?.region || 'regional';
        mountTurneroReleaseTelemetryOptimizationHub(optimizationHubHost, {
            scope: resolvedRegion,
            region: resolvedRegion,
            turneroClinicProfile,
            queueMeta,
            queueSurfaceStatus: state.data.queueSurfaceStatus || null,
            turneroReleaseEvidenceBundle: releaseEvidenceBundle
        });
    }
}

export function renderInstallConfigurator(manifest, detectedPlatform) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }
    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey = preset.surface === 'kiosk' || preset.surface === 'sala_tv' ? preset.surface : 'operator';
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        root.innerHTML = '';
        return;
    }
    const targetKey = surfaceKey === 'sala_tv' ? 'android_tv' : preset.platform === 'mac' ? 'mac' : 'win';
    const downloadTarget = appConfig.targets && appConfig.targets[targetKey] || getDesktopTarget(appConfig, detectedPlatform) || null;
    const preparedWebUrl = buildPreparedSurfaceUrl(surfaceKey, appConfig, preset);
    const qrUrl = surfaceKey === 'sala_tv' ? buildQrUrl(downloadTarget && downloadTarget.url || preparedWebUrl) : buildQrUrl(preparedWebUrl);
    const guideUrl = buildGuideUrl(surfaceKey, preset, appConfig);
    const autoUpdateFeedUrl = String(downloadTarget && downloadTarget.feedUrl || '');
    const operatorRollout = buildOperatorRolloutEntries(preset, appConfig, downloadTarget);
    const setupSteps = buildPresetSteps(preset).map(step => `<li>${escapeHtml(step)}</li>`).join('');
    const presetChoices = buildInstallPresetChoices(detectedPlatform).map(choice => `
                <button
                    id="queueInstallPreset_${escapeHtml(choice.id)}"
                    type="button"
                    class="queue-install-preset-btn"
                    data-queue-install-preset="${escapeHtml(choice.id)}"
                    data-state="${choice.state ? 'active' : 'idle'}"
                >
                    ${escapeHtml(choice.label)}
                </button>
            `).join('');
    setHtml('#queueInstallConfigurator', `
            <div class="queue-install-configurator__grid">
                <section class="queue-install-configurator__panel">
                    <div>
                        <p class="queue-app-card__eyebrow">Preparar equipo</p>
                        <h5 class="queue-app-card__title">Asistente de instalación</h5>
                        <p class="queue-app-card__description">
                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.
                        </p>
                    </div>
                    <div class="queue-install-configurator__presets" role="group" aria-label="Perfiles rápidos de instalación">
                        ${presetChoices}
                    </div>
                    <div class="queue-install-configurator__fields">
                        <label class="queue-install-field" for="queueInstallSurfaceSelect">
                            <span>Equipo</span>
                            <select id="queueInstallSurfaceSelect">
                                <option value="operator"${surfaceKey === 'operator' ? ' selected' : ''}>Operador</option>
                                <option value="kiosk"${surfaceKey === 'kiosk' ? ' selected' : ''}>Kiosco</option>
                                <option value="sala_tv"${surfaceKey === 'sala_tv' ? ' selected' : ''}>Sala TV</option>
                            </select>
                        </label>
                        ${surfaceKey === 'operator' ? `
                                    <label class="queue-install-field" for="queueInstallProfileSelect">
                                        <span>Perfil operador</span>
                                        <select id="queueInstallProfileSelect">
                                            <option value="c1_locked"${preset.lock && preset.station === 'c1' ? ' selected' : ''}>C1 fijo</option>
                                            <option value="c2_locked"${preset.lock && preset.station === 'c2' ? ' selected' : ''}>C2 fijo</option>
                                            <option value="free"${!preset.lock ? ' selected' : ''}>Modo libre</option>
                                        </select>
                                    </label>
                                ` : ''}
                        ${surfaceKey !== 'sala_tv' ? `
                                    <label class="queue-install-field" for="queueInstallPlatformSelect">
                                        <span>Plataforma</span>
                                        <select id="queueInstallPlatformSelect">
                                            <option value="win"${preset.platform === 'win' ? ' selected' : ''}>Windows</option>
                                            <option value="mac"${preset.platform === 'mac' ? ' selected' : ''}>macOS</option>
                                        </select>
                                    </label>
                                ` : ''}
                        ${surfaceKey === 'operator' ? `
                                    <label class="queue-install-toggle">
                                        <input id="queueInstallOneTapInput" type="checkbox"${preset.oneTap ? ' checked' : ''} />
                                        <span>Activar 1 tecla para este operador</span>
                                    </label>
                                ` : ''}
                    </div>
                </section>
                <section class="queue-install-configurator__panel queue-install-configurator__result">
                    <div>
                        <p class="queue-app-card__eyebrow">Resultado listo</p>
                        <h5 class="queue-app-card__title">${escapeHtml(buildPresetSummaryTitle(preset))}</h5>
                        <p class="queue-app-card__description">
                            ${surfaceKey === 'sala_tv' ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}
                        </p>
                    </div>
                    <div class="queue-install-result__chips">
                        <span class="queue-app-card__tag">
                            ${escapeHtml(downloadTarget && downloadTarget.label ? downloadTarget.label : 'Perfil listo')}
                        </span>
                        ${surfaceKey === 'operator' ? `<span class="queue-app-card__tag">${preset.lock ? preset.station === 'c2' ? 'C2 bloqueado' : 'C1 bloqueado' : 'Modo libre'}</span>` : ''}
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Descarga recomendada</span>
                        <strong>${escapeHtml(downloadTarget && downloadTarget.url || 'Sin artefacto')}</strong>
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Ruta web preparada</span>
                        <strong>${escapeHtml(preparedWebUrl)}</strong>
                    </div>
                    ${autoUpdateFeedUrl ? `
                                <div class="queue-install-result__meta">
                                    <span>Feed auto-update</span>
                                    <strong>${escapeHtml(autoUpdateFeedUrl)}</strong>
                                </div>
                            ` : ''}
                    <div class="queue-install-configurator__actions">
                        ${downloadTarget && downloadTarget.url ? `<a href="${escapeHtml(downloadTarget.url)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>` : ''}
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(absoluteUrl(downloadTarget && downloadTarget.url || ''))}"
                        >
                            Copiar descarga
                        </button>
                        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(preparedWebUrl)}"
                        >
                            Copiar ruta preparada
                        </button>
                        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">
                            Mostrar QR
                        </a>
                        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">
                            Abrir centro público
                        </a>
                    </div>
                    ${operatorRollout.length > 0 ? `
                                <section class="queue-install-rollout">
                                    <div class="queue-install-rollout__header">
                                        <span>Despliegue dual</span>
                                        <strong>Despliegue operador Windows</strong>
                                    </div>
                                    <p class="queue-install-rollout__summary">
                                        Usa el mismo TurneroOperadorSetup.exe en las dos PCs operador. Cada equipo se provisiona una sola vez como C1 fijo o C2 fijo.
                                    </p>
                                    <div class="queue-install-rollout__lanes">
                                        ${operatorRollout.map(entry => `
                                                    <article class="queue-install-rollout__lane" data-state="${entry.active ? 'active' : 'ready'}">
                                                        <span>${escapeHtml(entry.title)}</span>
                                                        <strong>${escapeHtml(entry.summary)}</strong>
                                                        <code>${escapeHtml(entry.preparedWebUrl)}</code>
                                                        <a href="${escapeHtml(entry.preparedWebUrl)}" target="_blank" rel="noopener">Abrir preset web</a>
                                                    </article>
                                                `).join('')}
                                    </div>
                                </section>
                            ` : ''}
                    <ul class="queue-app-card__notes">${setupSteps}</ul>
                </section>
            </div>
        `);
    root.querySelectorAll('[data-queue-install-preset]').forEach(button => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const choice = buildInstallPresetChoices(detectedPlatform).find(item => item.id === button.dataset.queueInstallPreset);
            if (!choice) {
                return;
            }
            persistInstallPreset(choice.nextPreset, detectedPlatform);
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: `Preset rápido: ${choice.label}`,
                summary: `${getInstallPresetLabel(detectedPlatform)}. El asistente ya quedó listo con este perfil.`
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            persistInstallPreset({
                ...preset,
                surface: surfaceSelect.value
            }, detectedPlatform);
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            persistInstallPreset({
                ...preset,
                station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                lock: profileSelect.value !== 'free'
            }, detectedPlatform);
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: 'Perfil operativo ajustado',
                summary: `${getInstallPresetLabel(detectedPlatform)}. La ruta preparada ya quedó alineada para descarga y fallback.`
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
    const platformSelect = document.getElementById('queueInstallPlatformSelect');
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            persistInstallPreset({
                ...preset,
                platform: platformSelect.value === 'mac' ? 'mac' : 'win'
            }, detectedPlatform);
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            persistInstallPreset({
                ...preset,
                oneTap: oneTapInput.checked
            }, detectedPlatform);
            appendOpsLogEntry({
                tone: oneTapInput.checked ? 'info' : 'warning',
                source: 'config',
                title: oneTapInput.checked ? 'Modo 1 tecla activado' : 'Modo 1 tecla desactivado',
                summary: `${getInstallPresetLabel(detectedPlatform)}. Ajuste guardado en el preparador de rutas operativas.`
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
}

export function renderQueueInstallHub(options = {}) {
    const {allowDuringInteraction = false, manifestOverride = null, platformOverride = ''} = options || ({});
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }
    const runtimeAppDownloads = getState().data.appDownloads;
    const hasRuntimeRegistry = syncInstallHubRuntimePayload(runtimeAppDownloads);
    if (!hasRuntimeRegistry) {
        ensureInstallHubRegistryLoaded(() => {
            renderQueueInstallHub({
                allowDuringInteraction: true,
                platformOverride: typeof options?.platformOverride === 'string' ? options.platformOverride : ''
            });
        });
    }
    const hubRoot = getQueueAppsHubRoot();
    if (hubRoot) {
        queueOpsInteractionController.bind(hubRoot);
    }
    if (cardsRoot instanceof HTMLElement) {
        queueOpsInteractionController.bind(cardsRoot);
    }
    const configuratorRoot = document.getElementById('queueInstallConfigurator');
    if (configuratorRoot instanceof HTMLElement) {
        queueOpsInteractionController.bind(configuratorRoot);
    }
    const platform = platformOverride === 'mac' || platformOverride === 'win' || platformOverride === 'other' ? platformOverride : detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel = platform === 'mac' ? 'macOS detectado' : platform === 'win' ? 'Windows detectado' : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }
    syncQueueClinicScopedLocalState(platform);
    const manifest = manifestOverride && typeof manifestOverride === 'object' ? manifestOverride : mergeManifest();
    if (!allowDuringInteraction && hubRoot && hubRoot.dataset.queueHubReady === 'true' && queueOpsInteractionController.hasActive()) {
        queueOpsInteractionController.scheduleDeferred(manifest, platform);
        return;
    }
    queueOpsInteractionController.clearDeferred();
    const adminMode = ensureQueueAdminViewMode();
    renderQueueAdminViewMode(manifest, platform);
    mountAdminQueuePilotReadinessCard(getTurneroClinicProfile(), {
        currentRoute: `${window.location.pathname || ''}${window.location.hash || ''}`,
        trustedProfileFingerprint: getTurneroClinicProfileMeta()?.profileFingerprint || getTurneroClinicProfile()?.runtime_meta?.profileFingerprint || ''
    });
    mountTurneroAdminQueueSurfaceTruthPanel(document.getElementById('queueSurfaceTruthPanel'), {
        clinicProfile: getTurneroClinicProfile(),
        currentRoute: `${window.location.pathname || ''}${window.location.hash || ''}`,
        surfacesUrl: '/data/turnero-surfaces.json',
        manifestUrl: '/release-manifest.json'
    });
    renderQueueHubCorePanels(manifest, platform);
    if (shouldRenderQueueHubExpandedPanels(adminMode)) {
        renderQueueHubExpertPanels(manifest, platform);
    } else {
        clearQueueExpertPanels();
    }
    primeQueueAdminViewModeToHub(adminMode);
    renderQueueHubDomainView();
    applyQueueAdminViewModeToHub(adminMode);
    applyFlowOsRecoveryFreezeToQueueHub();
    if (hubRoot) {
        hubRoot.dataset.queueHubReady = 'true';
    }
    queueOpsInteractionController.syncIndicator();
    queueOpsInteractionController.scheduleSettle();
}

