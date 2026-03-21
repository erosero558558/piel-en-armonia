import {
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

function normalizeMode(value) {
    const source =
        value && typeof value === 'object'
            ? value.state || value.status || value.mode || value.summary || ''
            : value;
    const normalized = toString(source, 'unknown').toLowerCase();
    return ['ready', 'watch', 'degraded', 'unknown'].includes(normalized)
        ? normalized
        : 'unknown';
}

function deriveSafeModeReason(input = {}) {
    const truthMode = normalizeMode(input.truthMode);
    const readinessBand = normalizeMode(input.readinessBand);
    const runtimeState = normalizeMode(input.runtimeState);
    const manifestSource = toString(input.manifestSource, 'missing');

    if (truthMode === 'ready' && readinessBand === 'ready') {
        return 'ready';
    }

    if (manifestSource === 'fallback') {
        return 'manifest-root-fallback';
    }

    if (truthMode === 'degraded' || readinessBand === 'degraded') {
        return 'truth-degraded';
    }

    if (truthMode === 'watch' || readinessBand === 'watch') {
        return 'truth-watch';
    }

    if (runtimeState === 'degraded') {
        return 'runtime-degraded';
    }

    if (runtimeState === 'watch') {
        return 'runtime-watch';
    }

    if (truthMode === 'unknown' || readinessBand === 'unknown') {
        return 'truth-unknown';
    }

    return 'watch';
}

function deriveSafeModeTone(reason) {
    switch (reason) {
        case 'ready':
            return 'ready';
        case 'manifest-root-fallback':
        case 'truth-watch':
        case 'runtime-watch':
            return 'warning';
        case 'truth-unknown':
            return 'unknown';
        default:
            return 'danger';
    }
}

function buildSafeModeLabel(reason) {
    switch (reason) {
        case 'ready':
            return 'Operación normal';
        default:
            return 'Modo seguro visible';
    }
}

function buildSafeModeDetail(input = {}, reason = '') {
    const manifestResolved = toString(input.resolvedManifestUrl, '');
    const manifestRequested = toString(input.requestedManifestUrl, '');
    const truthMode = normalizeMode(input.truthMode);
    const readinessBand = normalizeMode(input.readinessBand);
    const runtimeState = normalizeMode(input.runtimeState);
    const pieces = [];

    if (reason === 'manifest-root-fallback') {
        pieces.push(
            manifestResolved
                ? `Usando fallback ${manifestResolved} porque ${manifestRequested || 'el manifest raíz'} no respondió.`
                : 'Usando fallback porque el manifest raíz no respondió.'
        );
    } else if (reason === 'truth-degraded') {
        pieces.push('La verdad de release quedó degradada.');
    } else if (reason === 'truth-watch') {
        pieces.push('La verdad de release quedó en watch.');
    } else if (reason === 'runtime-degraded') {
        pieces.push('El runtime reportó degradación.');
    } else if (reason === 'runtime-watch') {
        pieces.push('El runtime reportó advertencias.');
    } else if (reason === 'truth-unknown') {
        pieces.push('No fue posible resolver la verdad de superficie.');
    } else {
        pieces.push('La superficie puede operar sin bandera de seguridad.');
    }

    pieces.push(
        `truth ${truthMode} · readiness ${readinessBand} · runtime ${runtimeState}`
    );
    return pieces.join(' ');
}

export function buildTurneroSurfaceSafeModeState(input = {}) {
    const reason = deriveSafeModeReason(input);
    const enabled = reason !== 'ready';
    const tone = deriveSafeModeTone(reason);

    return {
        enabled,
        reason,
        tone,
        label: buildSafeModeLabel(reason),
        detail: buildSafeModeDetail(input, reason),
        truthMode: normalizeMode(input.truthMode),
        readinessBand: normalizeMode(input.readinessBand),
        runtimeState: normalizeMode(input.runtimeState),
        manifestSource: toString(input.manifestSource, 'missing'),
        generatedAt: new Date().toISOString(),
    };
}

export function renderTurneroSurfaceSafeModeBanner(state = {}) {
    if (!state || state.enabled !== true) {
        return '';
    }

    return `
        <aside class="turnero-surface-safe-mode-banner" data-state="${escapeHtml(
            toString(state.tone, 'warning')
        )}" data-reason="${escapeHtml(toString(state.reason, 'unknown'))}">
            <strong>${escapeHtml(toString(state.label, 'Modo seguro visible'))}</strong>
            <p>${escapeHtml(toString(state.detail, ''))}</p>
        </aside>
    `.trim();
}

export function mountTurneroSurfaceSafeModeBanner(target, state = {}) {
    if (!state || state.enabled !== true) {
        return null;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host || typeof host.prepend !== 'function') {
        return null;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderTurneroSurfaceSafeModeBanner(state);
    const node = wrapper.firstElementChild;
    if (!node) {
        return null;
    }

    host.prepend(node);
    return node;
}
