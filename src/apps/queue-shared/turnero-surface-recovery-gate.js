import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function normalizeDriftState(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'aligned':
        case 'watch':
        case 'degraded':
        case 'blocked':
            return normalized;
        default:
            return 'aligned';
    }
}

function normalizeDriftSeverity(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'high':
        case 'medium':
        case 'low':
            return normalized;
        default:
            return 'low';
    }
}

function severityPenalty(severity) {
    switch (normalizeDriftSeverity(severity)) {
        case 'high':
            return 34;
        case 'medium':
            return 14;
        case 'low':
            return 5;
        default:
            return 0;
    }
}

function statePenalty(state) {
    switch (normalizeDriftState(state)) {
        case 'blocked':
            return 30;
        case 'degraded':
            return 12;
        case 'watch':
            return 4;
        default:
            return 0;
    }
}

function normalizeActionState(value) {
    const normalized = toString(value).toLowerCase();
    return ['closed', 'resolved', 'dismissed'].includes(normalized)
        ? 'closed'
        : 'open';
}

function normalizeOpenActionCount(input = {}, snapshot = {}) {
    if (Number.isFinite(Number(input.openActionCount))) {
        return Math.max(0, Number(input.openActionCount));
    }

    const actions = Array.isArray(input.actions)
        ? input.actions
        : Array.isArray(snapshot.actions)
          ? snapshot.actions
          : [];
    return actions.filter(
        (action) => normalizeActionState(action?.state) !== 'closed'
    ).length;
}

function normalizeDrifts(input = {}) {
    const drifts = Array.isArray(input.drifts)
        ? input.drifts
        : input.drift
          ? [input.drift]
          : [];

    return drifts
        .map((drift) => asObject(drift))
        .map((drift) => ({
            ...drift,
            surfaceKey: normalizeTurneroSurfaceRecoveryKey(
                drift.surfaceKey || drift.surface || 'operator'
            ),
            state: normalizeDriftState(drift.state),
            severity: normalizeDriftSeverity(drift.severity),
            summary: toString(drift.summary || ''),
            detail: toString(drift.detail || ''),
            primaryFlag:
                drift.primaryFlag && typeof drift.primaryFlag === 'object'
                    ? { ...drift.primaryFlag }
                    : null,
        }));
}

function buildDecision(band) {
    switch (band) {
        case 'ready':
            return 'keep-operating';
        case 'watch':
            return 'monitor-recovery';
        case 'degraded':
            return 'stabilize-surface';
        default:
            return 'hold-surface';
    }
}

function resolveBand(score, hasBlocked, hasDegraded, hasWatch) {
    if (hasBlocked) {
        return 'blocked';
    }
    if (score >= 90 && !hasDegraded && !hasWatch) {
        return 'ready';
    }
    if (score >= 70 && !hasBlocked) {
        return hasDegraded ? 'degraded' : 'watch';
    }
    if (score >= 45) {
        return hasDegraded ? 'degraded' : 'watch';
    }
    return 'blocked';
}

function summarizeGate(state, drifts, openActionCount) {
    if (state === 'blocked') {
        return drifts.some((drift) => drift.state === 'blocked')
            ? 'Superficie bloqueada por drift de contrato.'
            : 'Superficie bloqueada por riesgo agregado.';
    }
    if (state === 'degraded') {
        return 'Superficie degradada, pero aun recuperable.';
    }
    if (state === 'watch') {
        return openActionCount > 0
            ? `${openActionCount} accion(es) abiertas bajo observacion.`
            : 'Superficie en observacion.';
    }
    return 'Recuperacion alineada.';
}

export function buildTurneroSurfaceRecoveryGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const drifts = normalizeDrifts(input);
    const openActionCount = normalizeOpenActionCount(input, snapshot);
    const hasBlocked = drifts.some((drift) => drift.state === 'blocked');
    const hasDegraded = drifts.some((drift) => drift.state === 'degraded');
    const hasWatch = drifts.some((drift) => drift.state === 'watch');
    const contract = asObject(snapshot.contract);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);

    let score = 100;
    drifts.forEach((drift) => {
        score -= severityPenalty(drift.severity);
        score -= statePenalty(drift.state);
    });
    score -= Math.min(openActionCount * 3, 18);
    if (storage.available === false) {
        score -= 12;
    }
    if (runtime.state === 'blocked') {
        score -= 20;
    } else if (runtime.state === 'degraded') {
        score -= 10;
    } else if (runtime.state === 'watch') {
        score -= 5;
    }
    if (heartbeat.state === 'blocked') {
        score -= 12;
    } else if (heartbeat.state === 'degraded') {
        score -= 8;
    } else if (heartbeat.state === 'watch') {
        score -= 4;
    }
    if (contract.state === 'alert') {
        score -= 24;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const band = resolveBand(
        score,
        hasBlocked || contract.state === 'alert',
        hasDegraded,
        hasWatch
    );

    return {
        surfaceKey: normalizeTurneroSurfaceRecoveryKey(
            snapshot.surfaceKey || input.surfaceKey || 'operator'
        ),
        score,
        band,
        decision: buildDecision(band),
        openActionCount,
        driftCount: drifts.length,
        blockedDriftCount: drifts.filter((drift) => drift.state === 'blocked')
            .length,
        degradedDriftCount: drifts.filter((drift) => drift.state === 'degraded')
            .length,
        watchDriftCount: drifts.filter((drift) => drift.state === 'watch')
            .length,
        contractAlert: contract.state === 'alert',
        storageState: toString(storage.state || ''),
        runtimeState: toString(runtime.state || ''),
        heartbeatState: toString(heartbeat.state || ''),
        summary: summarizeGate(band, drifts, openActionCount),
        generatedAt: new Date().toISOString(),
    };
}

export const buildTurneroSurfaceContractGate = buildTurneroSurfaceRecoveryGate;
