import { toArray, toString } from './turnero-surface-helpers.js';
import { buildTurneroSurfaceSyncReadout } from './turnero-surface-sync-readout.js';

function countEvidenceSummary(evidenceSummary = {}) {
    return {
        all: Number(evidenceSummary.all || 0) || 0,
        captured: Number(evidenceSummary.captured || 0) || 0,
        review: Number(evidenceSummary.review || 0) || 0,
        resolved: Number(evidenceSummary.resolved || 0) || 0,
        missing: Number(evidenceSummary.missing || 0) || 0,
        stale: Number(evidenceSummary.stale || 0) || 0,
        open: Number(evidenceSummary.open || 0) || 0,
    };
}

function summarizeSurfacePacks(surfacePacks = []) {
    const summary = {
        all: 0,
        ready: 0,
        watch: 0,
        degraded: 0,
        blocked: 0,
    };

    for (const item of toArray(surfacePacks)) {
        const readout = buildTurneroSurfaceSyncReadout(item?.pack || {});
        const band = toString(readout.gateBand, 'degraded');
        summary.all += 1;
        if (band === 'ready') {
            summary.ready += 1;
        } else if (band === 'watch') {
            summary.watch += 1;
        } else if (band === 'blocked') {
            summary.blocked += 1;
        } else {
            summary.degraded += 1;
        }
    }

    return summary;
}

function deriveScorePenalty(summary, input = {}) {
    let score = 100;
    score -= Number(summary.degraded || 0) * 18;
    score -= Number(summary.watch || 0) * 8;
    score -= Number(summary.blocked || 0) * 24;
    score -= Number(input.evidenceSummary?.missing || 0) * 12;
    score -= Number(input.evidenceSummary?.stale || 0) * 5;
    score -= Number(input.openHandoffs || 0) * 4;

    if (input.runtimeSnapshot?.online === false) {
        score -= 20;
    }

    if (toString(input.runtimeSnapshot?.visibilityState, '') === 'hidden') {
        score -= 5;
    }

    if (toString(input.manifestSource, '') === 'fallback') {
        score -= 8;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveBand(score, summary, input = {}) {
    if (input.runtimeSnapshot?.online === false) {
        return score >= 70 && summary.blocked === 0 ? 'watch' : 'degraded';
    }

    if (summary.blocked > 0) {
        return score >= 55 ? 'degraded' : 'blocked';
    }

    if (
        summary.degraded > 0 ||
        Number(input.evidenceSummary?.missing || 0) > 0
    ) {
        return score >= 70 ? 'watch' : 'degraded';
    }

    if (summary.watch > 0 || Number(input.evidenceSummary?.stale || 0) > 0) {
        return score >= 85 ? 'watch' : 'degraded';
    }

    return score >= 90 ? 'ready' : 'watch';
}

export function buildTurneroSurfaceSmokeGate(input = {}) {
    const surfacePacks = toArray(input.surfacePacks);
    const surfaceSummary = summarizeSurfacePacks(surfacePacks);
    const evidenceSummary = countEvidenceSummary(input.evidenceSummary);
    const openHandoffs = Number(input.openHandoffs || 0) || 0;
    const score = deriveScorePenalty(surfaceSummary, {
        ...input,
        evidenceSummary,
        openHandoffs,
    });
    const band = resolveBand(score, surfaceSummary, {
        ...input,
        evidenceSummary,
        openHandoffs,
    });
    const blockers = [];
    const warnings = [];

    if (input.runtimeSnapshot?.online === false) {
        blockers.push('runtime-offline');
    }
    if (surfaceSummary.blocked > 0) {
        blockers.push('surface-blocked');
    }
    if (evidenceSummary.missing > 0) {
        blockers.push('evidence-missing');
    }
    if (score < 45) {
        blockers.push('score-floor');
    }
    if (surfaceSummary.degraded > 0) {
        warnings.push('surface-degraded');
    }
    if (surfaceSummary.watch > 0) {
        warnings.push('surface-watch');
    }
    if (evidenceSummary.stale > 0) {
        warnings.push('evidence-stale');
    }
    if (toString(input.manifestSource, '') === 'fallback') {
        warnings.push('manifest-fallback');
    }

    if (band === 'ready') {
        blockers.length = 0;
    }

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'smoke-clear'
                : band === 'watch'
                  ? 'smoke-review'
                  : band === 'degraded'
                    ? 'smoke-hold'
                    : 'smoke-blocked',
        surfaceSummary,
        evidenceSummary,
        openHandoffs,
        blockers,
        warnings,
        generatedAt: new Date().toISOString(),
    };
}

export function resolveTurneroSurfaceSmokeGate(input = {}) {
    return buildTurneroSurfaceSmokeGate(input);
}
