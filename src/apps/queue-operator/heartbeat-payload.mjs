import {
    buildOperatorSurfaceState,
    normalizeAutoStart,
    normalizeLaunchMode,
} from '../queue-shared/turnero-runtime-contract.mjs';

function formatOperatorLabelList(labels) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return '';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} y ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

function resolveOperatorHeartbeatStatus({
    online,
    degraded,
    readyForLiveUse,
    offlineMode,
}) {
    if (offlineMode === 'offline') {
        return 'warning';
    }
    if (!online) {
        return 'alert';
    }
    if (degraded) {
        return 'warning';
    }
    return readyForLiveUse ? 'ready' : 'warning';
}

function resolveOperatorHeartbeatSummary({
    online,
    degraded,
    locked,
    stationConsultorio,
    numpadStatus,
    readyForLiveUse,
    offlineMode,
}) {
    if (offlineMode === 'offline') {
        return 'Equipo en offline operativo; los llamados y cierres quedarán pendientes hasta recuperar red.';
    }

    if (!online) {
        return 'Equipo sin red; recupera conectividad antes de operar.';
    }

    if (degraded) {
        return 'Equipo en fallback local; espera sincronización antes de llamar o cerrar tickets.';
    }

    if (readyForLiveUse) {
        return `Equipo listo para operar en ${locked ? `C${stationConsultorio} fijo` : 'modo libre'}.`;
    }

    return `${numpadStatus.label}. Falta validar ${formatOperatorLabelList(
        numpadStatus.pendingLabels
    )} antes del primer llamado.`;
}

export function buildOperatorHeartbeatPayload({
    queueState,
    online = true,
    shell = {},
    shellRuntime = null,
    appMode = 'web',
    numpadStatus,
    syncHealth,
    surfaceSyncSnapshot = null,
    surfaceSyncHandoffOpenCount = 0,
    now = new Date().toISOString(),
} = {}) {
    const surfaceState = buildOperatorSurfaceState(queueState);
    const stationNumber = surfaceState.stationConsultorio;
    const stationKey = surfaceState.stationKey;
    const locked = surfaceState.locked;
    const networkOnline = online !== false;
    const degraded = syncHealth?.degraded === true;
    const offlineMode = String(shellRuntime?.mode || '')
        .trim()
        .toLowerCase();
    const numpadReady = numpadStatus?.ready === true;
    const numpadSeen = numpadStatus?.seen === true;
    const readyForLiveUse = networkOnline && !degraded && numpadReady;
    const status = resolveOperatorHeartbeatStatus({
        online: networkOnline,
        degraded,
        readyForLiveUse,
        offlineMode,
    });
    const summary = resolveOperatorHeartbeatSummary({
        online: networkOnline,
        degraded,
        locked,
        stationConsultorio: stationNumber,
        numpadStatus: numpadStatus || {
            label: 'Numpad 0/4',
            pendingLabels: [],
        },
        readyForLiveUse,
        offlineMode,
    });
    const lastEventAt =
        String(numpadStatus?.lastAt || now).trim() || new Date().toISOString();
    const stationLabel = locked
        ? `Operador C${stationNumber} fijo`
        : 'Operador modo libre';
    const details = {
        station: stationKey,
        stationMode: surfaceState.stationMode,
        oneTap: surfaceState.oneTap,
        queueSyncMode: String(syncHealth?.syncMode || 'live'),
        queueFallbackPartial: Boolean(syncHealth?.fallbackPartial),
        callKeyLabel: String(numpadStatus?.callKeyLabel || 'Numpad Enter'),
        offlineMode,
        outboxSize: Math.max(0, Number(shellRuntime?.outboxSize || 0) || 0),
        snapshotAgeSec: Number.isFinite(Number(shellRuntime?.snapshotAgeSec))
            ? Number(shellRuntime.snapshotAgeSec)
            : null,
        lastSuccessfulSyncAt: String(shellRuntime?.lastSuccessfulSyncAt || ''),
        shellRuntimeReason: String(shellRuntime?.reason || ''),
        numpadSeen,
        numpadReady,
        numpadProgress: Number(numpadStatus?.validatedCount || 0),
        numpadRequired: Number(numpadStatus?.requiredCount || 0),
        numpadLabel: String(numpadStatus?.label || ''),
        numpadSummary: String(numpadStatus?.summary || ''),
        lastNumpadCode: String(numpadStatus?.lastCode || ''),
        shellMode: String(appMode || 'web'),
        shellName: String(shell?.name || ''),
        shellVersion: String(shell?.version || ''),
        shellPlatform: String(shell?.platform || ''),
        shellPackaged: Boolean(shell?.packaged),
        shellUpdateChannel: String(shell?.updateChannel || ''),
        shellStatusPhase: String(shell?.statusPhase || ''),
        shellStatusLevel: String(shell?.statusLevel || ''),
        shellStatusPercent: Number(shell?.statusPercent || 0),
        shellStatusVersion: String(shell?.statusVersion || ''),
        shellUpdateFeedUrl: String(shell?.updateFeedUrl || ''),
        shellUpdateMetadataUrl: String(shell?.updateMetadataUrl || ''),
        shellInstallGuideUrl: String(shell?.installGuideUrl || ''),
        shellConfigPath: String(shell?.configPath || ''),
        shellMessage: String(shell?.statusMessage || ''),
    };

    if (surfaceSyncSnapshot && typeof surfaceSyncSnapshot === 'object') {
        details.surfaceSyncSnapshot = {
            surfaceKey: String(surfaceSyncSnapshot.surfaceKey || ''),
            queueVersion: String(surfaceSyncSnapshot.queueVersion || ''),
            visibleTurn: String(surfaceSyncSnapshot.visibleTurn || ''),
            announcedTurn: String(surfaceSyncSnapshot.announcedTurn || ''),
            handoffState: String(surfaceSyncSnapshot.handoffState || ''),
            heartbeatState: String(surfaceSyncSnapshot.heartbeatState || ''),
            heartbeatChannel: String(
                surfaceSyncSnapshot.heartbeatChannel || ''
            ),
            updatedAt: String(surfaceSyncSnapshot.updatedAt || ''),
        };
        details.surfaceSyncHandoffOpenCount = Math.max(
            0,
            Number(surfaceSyncHandoffOpenCount || 0)
        );
    }

    if (shell?.available) {
        details.shellLaunchMode = normalizeLaunchMode(shell.launchMode);
        details.shellAutoStart = normalizeAutoStart(shell.autoStart, true);
    }

    return {
        instance: surfaceState.instance,
        deviceLabel: stationLabel,
        appMode: String(appMode || 'web'),
        status,
        summary,
        networkOnline,
        lastEvent: numpadSeen ? 'numpad_detected' : 'heartbeat',
        lastEventAt,
        details,
    };
}
