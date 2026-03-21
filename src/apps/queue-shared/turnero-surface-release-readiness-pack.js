import { asObject, escapeHtml, toString } from './turnero-surface-helpers.js';
import {
    buildTurneroSurfaceReleaseTruthPack,
    normalizeTurneroSurfaceKey,
} from './turnero-surface-release-truth.js';
import { buildTurneroSurfaceSafeModeState } from './turnero-surface-safe-mode.js';
import { buildTurneroSurfaceSmokeChecklist } from './turnero-surface-smoke-checklist.js';

function getTruthPack(input = {}) {
    if (input.truthPack && typeof input.truthPack === 'object') {
        return input.truthPack;
    }

    if (input.registry && typeof input.registry === 'object') {
        return buildTurneroSurfaceReleaseTruthPack({
            registry: input.registry,
        });
    }

    return buildTurneroSurfaceReleaseTruthPack({ registry: {} });
}

function normalizeRuntimeState(value) {
    const source =
        value && typeof value === 'object'
            ? value.state || value.status || value.mode || value.summary || ''
            : value;
    const token = toString(source, 'unknown').toLowerCase();
    if (['ready', 'watch', 'degraded', 'unknown'].includes(token)) {
        return token;
    }
    if (
        ['live', 'online', 'connected', 'healthy', 'stable', 'ok'].includes(
            token
        )
    ) {
        return 'ready';
    }
    if (['paused', 'fallback', 'reconnecting', 'warning'].includes(token)) {
        return 'watch';
    }
    if (['offline', 'alert', 'error', 'blocked'].includes(token)) {
        return 'degraded';
    }
    return 'unknown';
}

function buildReadinessBand(score, truthMode, safeModeEnabled, runtimeState) {
    if (truthMode === 'unknown' && score === 0) {
        return 'unknown';
    }

    if (truthMode === 'degraded' || runtimeState === 'degraded') {
        return 'degraded';
    }

    if (truthMode === 'watch' || safeModeEnabled) {
        if (score >= 90) {
            return 'watch';
        }
        if (score >= 70) {
            return 'watch';
        }
        return 'degraded';
    }

    if (score >= 90) {
        return 'ready';
    }

    if (score >= 70) {
        return 'watch';
    }

    return 'degraded';
}

function buildReadinessLabel(band) {
    switch (band) {
        case 'ready':
            return 'Listo';
        case 'watch':
            return 'Vigilar';
        case 'degraded':
            return 'Degradado';
        default:
            return 'Desconocido';
    }
}

export function buildTurneroSurfaceReleaseReadinessPack(input = {}) {
    const truthPack = getTruthPack(input);
    const surfaceKey = normalizeTurneroSurfaceKey(
        input.surfaceKey || input.surfaceId || input.surfaceRoute
    );
    const runtimeState = normalizeRuntimeState(
        input.runtimeState || truthPack.summary?.mode || 'unknown'
    );
    const safeMode = buildTurneroSurfaceSafeModeState({
        truthMode: truthPack.summary?.mode,
        readinessBand: input.readinessBand || truthPack.summary?.mode,
        runtimeState,
        manifestSource: truthPack.summary?.manifestSource,
        requestedManifestUrl: truthPack.summary?.requestedManifestUrl,
        resolvedManifestUrl: truthPack.summary?.resolvedManifestUrl,
    });
    const smoke = buildTurneroSurfaceSmokeChecklist({
        ...input,
        truthPack,
        surfaceKey,
        runtimeState,
        safeMode,
    });
    const score = smoke.summary.score;
    const band = buildReadinessBand(
        score,
        truthPack.summary?.mode,
        safeMode.enabled,
        runtimeState
    );

    return {
        truthPack,
        surfaceKey,
        runtimeState,
        safeMode,
        smoke,
        score,
        band,
        label: buildReadinessLabel(band),
        summary: {
            state: band,
            label: buildReadinessLabel(band),
            score,
            smokePass: smoke.summary.pass,
            smokeAll: smoke.summary.all,
            truthMode: truthPack.summary?.mode || 'unknown',
            runtimeState,
            manifestSource: truthPack.summary?.manifestSource || 'missing',
            manifestRequestedUrl: truthPack.summary?.requestedManifestUrl || '',
            manifestResolvedUrl: truthPack.summary?.resolvedManifestUrl || '',
        },
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceReleaseReadinessBrief(pack = {}) {
    const summary = asObject(pack.summary);
    const truthMode = toString(summary.truthMode, 'unknown');
    const runtimeState = toString(summary.runtimeState, 'unknown');
    const manifestSource = toString(summary.manifestSource, 'missing');
    const manifestResolvedUrl = toString(summary.manifestResolvedUrl, '');
    const manifestRequestedUrl = toString(summary.manifestRequestedUrl, '');
    const smokePass = Number(summary.smokePass || 0);
    const smokeAll = Number(summary.smokeAll || 0);
    return [
        '# Turnero Surface Readiness',
        '',
        `Band: ${toString(summary.state, 'unknown')}`,
        `Score: ${Number(summary.score || 0)}/100`,
        `Smoke: ${smokePass}/${smokeAll}`,
        `Truth: ${truthMode}`,
        `Runtime: ${runtimeState}`,
        `Manifest source: ${manifestSource}`,
        `Requested manifest: ${manifestRequestedUrl}`,
        `Resolved manifest: ${manifestResolvedUrl}`,
    ]
        .filter(Boolean)
        .join('\n');
}

export function renderTurneroSurfaceReleaseReadinessSummary(pack = {}) {
    const summary = asObject(pack.summary);
    return `
        <div class="turnero-surface-release-readiness-summary" data-state="${escapeHtml(
            toString(summary.state, 'unknown')
        )}">
            <strong>${escapeHtml(toString(summary.label, 'Desconocido'))}</strong>
            <span>${escapeHtml(
                `${Number(summary.score || 0)}/100 · ${Number(
                    summary.smokePass || 0
                )}/${Number(summary.smokeAll || 0)} checks`
            )}</span>
        </div>
    `.trim();
}
