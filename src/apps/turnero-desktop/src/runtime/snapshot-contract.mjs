import {
    applyOperatorSurfaceSearchParams,
    buildOperatorSurfaceState,
    normalizeAutoStart,
    normalizeLaunchMode,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
} from '../../../queue-shared/turnero-runtime-contract.mjs';
import {
    buildDesktopSupportGuideUrl,
    buildDesktopUpdateMetadataUrl,
} from '../../../queue-shared/desktop-shell-support.mjs';
import { getRetrySnapshot } from './retry-state.mjs';

const DEFAULT_BASE_URL = 'https://pielarmonia.com';

export function normalizeDesktopSurface(surface) {
    return String(surface || 'operator')
        .trim()
        .toLowerCase() === 'kiosk'
        ? 'kiosk'
        : 'operator';
}

export function getDesktopSurfaceLabels(input = {}) {
    const config =
        input?.config && typeof input.config === 'object'
            ? input.config
            : input;
    const surface = normalizeDesktopSurface(config?.surface);
    if (surface === 'kiosk') {
        return {
            surfaceId: 'kiosk',
            surfaceLabel: 'Kiosco',
            surfaceDesktopLabel: 'Turnero Kiosco',
        };
    }

    return {
        surfaceId: 'operator',
        surfaceLabel: 'Operador',
        surfaceDesktopLabel: 'Turnero Operador',
    };
}

export function getDesktopSnapshotPhase(snapshot) {
    return String(snapshot?.status?.phase || snapshot?.phase || 'boot')
        .trim()
        .toLowerCase();
}

export function normalizeDesktopRetrySnapshot(retryState) {
    const snapshot = getRetrySnapshot(retryState);
    const remainingMs = Number(retryState?.remainingMs);

    return {
        ...snapshot,
        remainingMs:
            Number.isFinite(remainingMs) && remainingMs >= 0
                ? remainingMs
                : snapshot.remainingMs,
    };
}

export function getDesktopSurfaceRoute(surface) {
    return normalizeDesktopSurface(surface) === 'kiosk'
        ? '/kiosco-turnos.html'
        : '/operador-turnos.html';
}

export function normalizeDesktopRuntimePatch(partial = {}) {
    const surface = normalizeDesktopSurface(partial.surface);
    const baseUrl =
        String(partial.baseUrl || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
    const launchMode = normalizeLaunchMode(partial.launchMode);
    const autoStart = normalizeAutoStart(partial.autoStart, true);

    if (surface !== 'operator') {
        return {
            surface,
            baseUrl,
            launchMode,
            autoStart,
            stationMode: 'free',
            stationConsultorio: 1,
            oneTap: false,
        };
    }

    const surfaceState = buildOperatorSurfaceState({
        stationMode: normalizeStationMode(partial.stationMode, 'free'),
        stationConsultorio: normalizeStationConsultorio(
            partial.stationConsultorio,
            1
        ),
        oneTap: normalizeOneTap(partial.oneTap, false),
    });

    return {
        surface,
        baseUrl,
        launchMode,
        autoStart,
        stationMode: surfaceState.stationMode,
        stationConsultorio: surfaceState.stationConsultorio,
        oneTap: surfaceState.oneTap,
    };
}

export function buildDesktopRuntimePatchFromForm(formPayload = {}) {
    const surface = normalizeDesktopSurface(formPayload.surface);
    const profile = String(formPayload.profile || 'free')
        .trim()
        .toLowerCase();

    return normalizeDesktopRuntimePatch({
        surface,
        baseUrl: formPayload.baseUrl,
        launchMode: formPayload.launchMode,
        autoStart: formPayload.autoStart,
        stationMode:
            surface === 'operator' && profile !== 'free' ? 'locked' : 'free',
        stationConsultorio: profile === 'c2_locked' ? 2 : 1,
        oneTap: surface === 'operator' ? formPayload.oneTap : false,
    });
}

export function getDesktopOperatorProfile(config = {}) {
    if (normalizeDesktopSurface(config.surface) !== 'operator') {
        return 'free';
    }

    const surfaceState = buildOperatorSurfaceState(config);
    if (!surfaceState.locked) {
        return 'free';
    }

    return surfaceState.stationConsultorio === 2 ? 'c2_locked' : 'c1_locked';
}

export function buildDesktopLaunchUrl(runtimePatch = {}) {
    const normalizedPatch = normalizeDesktopRuntimePatch(runtimePatch);

    try {
        const url = new URL(
            getDesktopSurfaceRoute(normalizedPatch.surface),
            normalizedPatch.baseUrl
        );
        if (normalizedPatch.surface === 'operator') {
            applyOperatorSurfaceSearchParams(url.searchParams, normalizedPatch);
        }
        return url.toString();
    } catch (_error) {
        return '-';
    }
}

export function buildDesktopPreflightFingerprint(snapshot, runtimePatch = {}) {
    return JSON.stringify({
        packaged: Boolean(snapshot?.packaged),
        surface: normalizeDesktopSurface(
            snapshot?.config?.surface || runtimePatch.surface
        ),
        config: normalizeDesktopRuntimePatch(runtimePatch),
    });
}

export function getDesktopSnapshotSupport(input = {}) {
    const snapshot = input && typeof input === 'object' ? input : {};
    const config =
        snapshot.config && typeof snapshot.config === 'object'
            ? snapshot.config
            : {};
    const surfaceContext = getDesktopSurfaceContext(config);

    return {
        updateFeedUrl: String(snapshot.updateFeedUrl || '').trim(),
        updateMetadataUrl: buildDesktopUpdateMetadataUrl({
            updateMetadataUrl: snapshot.updateMetadataUrl,
            updateFeedUrl: snapshot.updateFeedUrl,
            platform: snapshot.platform,
        }),
        installGuideUrl: buildDesktopSupportGuideUrl({
            installGuideUrl: snapshot.installGuideUrl,
            baseUrl: config.baseUrl,
            surface: surfaceContext.surface,
            platform: snapshot.platform,
            stationMode: surfaceContext.stationMode,
            stationConsultorio: surfaceContext.stationConsultorio,
            oneTap: surfaceContext.oneTap,
        }),
    };
}

export function buildDesktopRuntimeSnapshotBase(input = {}) {
    const snapshot = input && typeof input === 'object' ? input : {};
    const config =
        snapshot.config && typeof snapshot.config === 'object'
            ? snapshot.config
            : {};
    const status =
        snapshot.status && typeof snapshot.status === 'object'
            ? { ...snapshot.status }
            : {};

    return {
        config,
        status,
        surfaceUrl: String(snapshot.surfaceUrl || '').trim(),
        packaged: Boolean(snapshot.packaged),
        platform: String(snapshot.platform || '').trim(),
        arch: String(snapshot.arch || '').trim(),
        version: String(snapshot.version || '').trim(),
        name: String(snapshot.name || '').trim(),
        configPath: String(snapshot.configPath || '').trim(),
        ...getDesktopSurfaceLabels(config),
        retry: normalizeDesktopRetrySnapshot(snapshot.retry),
        ...getDesktopSnapshotSupport(snapshot),
        firstRun: Boolean(snapshot.firstRun),
        settingsMode: Boolean(snapshot.settingsMode),
        appMode: snapshot.packaged ? 'packaged' : 'development',
        phase: String(snapshot.phase || '').trim(),
        message: String(snapshot.message || '').trim(),
    };
}

export function getDesktopPreflightGateState({
    snapshot,
    preflightRunning = false,
    preflightReport = null,
    preflightFingerprint = '',
    currentFingerprint = '',
} = {}) {
    if (!snapshot) {
        return {
            blocked: true,
            state: 'warning',
            detail: 'Cargando la configuración local del shell.',
        };
    }

    if (!snapshot.packaged) {
        return {
            blocked: false,
            state: 'warning',
            detail: 'El checklist remoto completo se valida solo en desktop instalada; en desarrollo puedes continuar.',
        };
    }

    if (preflightRunning) {
        return {
            blocked: true,
            state: 'warning',
            detail: 'Espera a que termine la comprobación antes de abrir la superficie.',
        };
    }

    if (!preflightReport || preflightFingerprint !== currentFingerprint) {
        return {
            blocked: true,
            state: 'warning',
            detail: 'Vuelve a comprobar el equipo después de cambiar la configuración.',
        };
    }

    const reportState = String(preflightReport.state || '')
        .trim()
        .toLowerCase();
    if (reportState === 'danger') {
        return {
            blocked: true,
            state: 'danger',
            detail: 'Corrige los checks en rojo antes de guardar y abrir esta desktop.',
        };
    }

    if (reportState === 'warning') {
        return {
            blocked: false,
            state: 'warning',
            detail: 'El equipo puede abrir, pero todavía quedan validaciones pendientes.',
        };
    }

    return {
        blocked: false,
        state: 'ready',
        detail: 'Checklist vigente para esta configuración local.',
    };
}

export function getDesktopSurfaceContext(input = {}) {
    const config =
        input?.config && typeof input.config === 'object'
            ? input.config
            : input;
    const surface = normalizeDesktopSurface(config.surface);

    if (surface !== 'operator') {
        return {
            surface,
            instance: 'main',
            deviceLabel: 'Kiosco local',
            station: 'c1',
            stationMode: 'free',
            stationConsultorio: 1,
            locked: false,
            oneTap: false,
        };
    }

    const surfaceState = buildOperatorSurfaceState(config);
    return {
        surface,
        instance: surfaceState.instance,
        deviceLabel: surfaceState.locked
            ? `Operador C${surfaceState.stationConsultorio} fijo`
            : 'Operador modo libre',
        station: surfaceState.stationKey,
        stationMode: surfaceState.stationMode,
        stationConsultorio: surfaceState.stationConsultorio,
        locked: surfaceState.locked,
        oneTap: surfaceState.oneTap,
    };
}
