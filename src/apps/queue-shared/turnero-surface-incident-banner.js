import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';

function resolveHost(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function resolveBannerState(watch = {}) {
    if (watch.state === 'fallback' || watch.status === 'alert' || watch.stale) {
        return 'alert';
    }
    if (watch.state === 'watch') {
        return 'warning';
    }
    return 'info';
}

function resolveBannerTitle(watch = {}) {
    if (watch.safeMode) {
        return 'Modo seguro activo';
    }
    if (watch.stale) {
        return 'Heartbeat sin renovar';
    }
    if (watch.routeMatch === false) {
        return 'Ruta fuera de canon';
    }
    if (watch.clinicMatch === false || watch.profileMatch === false) {
        return 'Identidad del heartbeat no coincide';
    }
    if (watch.status === 'alert' || watch.state === 'fallback') {
        return 'Fallback operativo';
    }
    return 'Superficie con avisos';
}

export function mountTurneroSurfaceIncidentBanner(
    target,
    { surface, watch, readiness, summary } = {}
) {
    const host = resolveHost(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    const runtimeWatch =
        watch && typeof watch === 'object'
            ? watch
            : { surface, state: 'unknown' };
    const visible =
        runtimeWatch.state === 'fallback' ||
        runtimeWatch.status === 'alert' ||
        runtimeWatch.stale === true ||
        runtimeWatch.safeMode === true;

    host.className = 'turnero-surface-ops__banner';
    host.hidden = !visible;
    host.innerHTML = '';

    if (!visible) {
        return host;
    }

    const detail = normalizeText(
        summary?.summaryText ||
            runtimeWatch.summary ||
            runtimeWatch.safeModeDetail ||
            '',
        'La superficie quedó fuera de condición saludable y necesita revisión.'
    );
    host.dataset.state = resolveBannerState(runtimeWatch);
    host.innerHTML = `
        <strong>${resolveBannerTitle(runtimeWatch)}</strong>
        <p>${detail}</p>
        <p>Score ${normalizeText(
            readiness?.score,
            '--'
        )} · decisión ${normalizeText(readiness?.decision, 'review')}</p>
    `;
    return host;
}
