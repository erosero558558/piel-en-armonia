import {
    buildDesktopRuntimeSnapshotBase,
    getDesktopSnapshotPhase,
    getDesktopSurfaceContext,
    normalizeDesktopSurface,
} from './snapshot-contract.mjs';

export const DESKTOP_HEARTBEAT_INTERVAL_MS = 15000;

const HEARTBEAT_WARNING_PHASES = new Set([
    'boot',
    'loading',
    'settings',
    'update',
]);
const HEARTBEAT_ALERT_PHASES = new Set(['retry', 'blocked']);

function canRunDesktopHeartbeatSnapshot(snapshot) {
    const surface = normalizeDesktopSurface(snapshot?.config?.surface);
    if (surface !== 'operator') {
        return false;
    }

    const phase = getDesktopSnapshotPhase(snapshot);
    return (
        snapshot.firstRun === true ||
        snapshot.settingsMode === true ||
        HEARTBEAT_WARNING_PHASES.has(phase) ||
        HEARTBEAT_ALERT_PHASES.has(phase)
    );
}

function buildDefaultSummary(surfaceContext, snapshot, phase) {
    const { surface } = surfaceContext;
    if (surface === 'kiosk') {
        if (snapshot?.firstRun) {
            return 'Kiosco en primer arranque; confirma la configuración local antes de abrir la superficie.';
        }
        if (snapshot?.settingsMode || phase === 'settings') {
            return 'Configuración local del kiosco abierta desde la desktop.';
        }
        if (phase === 'retry') {
            return 'Kiosco reintentando conexión desde el shell local.';
        }
        if (phase === 'loading') {
            return 'Kiosco conectando la superficie remota desde la desktop.';
        }
        if (phase === 'blocked') {
            return 'El shell del kiosco bloqueó una navegación no permitida.';
        }
        return 'Kiosco reportando desde el boot local de la desktop.';
    }

    const profileLabel = surfaceContext.locked
        ? `C${surfaceContext.stationConsultorio} fijo`
        : 'modo libre';
    if (snapshot?.firstRun) {
        return `Primer arranque de ${profileLabel}; confirma la configuración local antes de abrir Operador.`;
    }
    if (snapshot?.settingsMode || phase === 'settings') {
        return `Configuración local abierta en ${profileLabel}.`;
    }
    if (phase === 'retry') {
        return `Operador reintentando conexión en ${profileLabel}.`;
    }
    if (phase === 'loading') {
        return `Operador conectando la superficie remota en ${profileLabel}.`;
    }
    if (phase === 'blocked') {
        return `El shell desktop bloqueó una navegación no permitida mientras ${profileLabel} seguía abierto.`;
    }
    return `Desktop local reportando ${profileLabel} mientras la superficie remota no está visible.`;
}

function buildNetworkOnline(phase) {
    return !HEARTBEAT_ALERT_PHASES.has(phase);
}

export function shouldRunDesktopHeartbeat(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    return canRunDesktopHeartbeatSnapshot(
        buildDesktopRuntimeSnapshotBase(snapshot)
    );
}

export function buildDesktopHeartbeatEndpoint(snapshot) {
    try {
        return new URL(
            '/api.php?resource=queue-surface-heartbeat',
            String(snapshot?.config?.baseUrl || '')
        ).toString();
    } catch (_error) {
        return '';
    }
}

export function buildDesktopHeartbeatRequest(
    snapshot,
    { reason = 'desktop_boot', now = new Date().toISOString() } = {}
) {
    const payload = buildDesktopHeartbeatPayload(snapshot, {
        reason,
        now,
    });
    if (!payload) {
        return null;
    }

    const endpoint = buildDesktopHeartbeatEndpoint(snapshot);
    if (!endpoint) {
        return null;
    }

    return {
        endpoint,
        payload,
    };
}

export function buildDesktopHeartbeatPayload(
    snapshot,
    { reason = 'desktop_boot', now = new Date().toISOString() } = {}
) {
    const runtimeSnapshot = buildDesktopRuntimeSnapshotBase(snapshot);
    if (!canRunDesktopHeartbeatSnapshot(runtimeSnapshot)) {
        return null;
    }

    const config = runtimeSnapshot.config || {};
    const surfaceContext = getDesktopSurfaceContext(config);
    const { surface } = surfaceContext;
    const phase = getDesktopSnapshotPhase(runtimeSnapshot);
    const summary =
        String(
            runtimeSnapshot?.status?.message || runtimeSnapshot?.message || ''
        ).trim() || buildDefaultSummary(surfaceContext, runtimeSnapshot, phase);
    const updateChannel = String(config.updateChannel || 'stable').trim();
    const retry = runtimeSnapshot.retry;

    return {
        surface,
        deviceId: `${surface}-desktop-shell`,
        instance: surfaceContext.instance,
        deviceLabel: surfaceContext.deviceLabel,
        appMode: 'desktop',
        route: String(runtimeSnapshot?.surfaceUrl || '').trim(),
        status: HEARTBEAT_ALERT_PHASES.has(phase) ? 'alert' : 'warning',
        summary,
        networkOnline: buildNetworkOnline(phase),
        lastEvent: String(reason || 'desktop_boot'),
        lastEventAt: String(now || new Date().toISOString()),
        details: {
            station: surfaceContext.station,
            stationMode: surfaceContext.stationMode,
            oneTap: surfaceContext.oneTap,
            callKeyLabel: 'Numpad Enter',
            numpadSeen: false,
            numpadReady: false,
            numpadProgress: 0,
            numpadRequired: 4,
            numpadLabel: 'Validar en operador',
            numpadSummary:
                'La matriz del numpad se valida dentro de operador-turnos.html',
            shellContext: 'boot',
            shellPhase: phase,
            shellSettingsMode: Boolean(runtimeSnapshot?.settingsMode),
            shellFirstRun: Boolean(runtimeSnapshot?.firstRun),
            shellStatusPhase: phase,
            shellStatusLevel: String(runtimeSnapshot?.status?.level || ''),
            shellStatusPercent: Number(runtimeSnapshot?.status?.percent || 0),
            shellStatusVersion: String(
                runtimeSnapshot?.status?.version ||
                    runtimeSnapshot?.version ||
                    ''
            ),
            shellMessage: summary,
            shellPackaged: Boolean(runtimeSnapshot?.packaged),
            shellPlatform: String(runtimeSnapshot?.platform || ''),
            shellUpdateChannel: updateChannel,
            shellUpdateFeedUrl: String(runtimeSnapshot?.updateFeedUrl || ''),
            shellUpdateMetadataUrl: String(
                runtimeSnapshot?.updateMetadataUrl || ''
            ),
            shellInstallGuideUrl: String(
                runtimeSnapshot?.installGuideUrl || ''
            ),
            shellConfigPath: String(runtimeSnapshot?.configPath || ''),
            shellVersion: String(runtimeSnapshot?.version || ''),
            shellName: String(runtimeSnapshot?.name || ''),
            shellRetryActive: Boolean(retry?.active),
            shellRetryAttempt: Number(retry?.attempt || 0),
            shellRetryDelayMs: Number(retry?.delayMs || 0),
            shellNextRetryAt: String(retry?.nextRetryAt || ''),
            shellRetryRemainingMs: Number(retry?.remainingMs || 0),
            shellRetryReason: String(retry?.reason || ''),
        },
    };
}
