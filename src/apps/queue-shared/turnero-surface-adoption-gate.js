import { asObject, toString } from './turnero-surface-helpers.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function truthWeight(state) {
    switch (toString(state, '').toLowerCase()) {
        case 'aligned':
            return 30;
        case 'watch':
            return 18;
        case 'degraded':
            return 8;
        default:
            return 0;
    }
}

function runtimeWeight(state) {
    switch (toString(state, '').toLowerCase()) {
        case 'ready':
            return 20;
        case 'watch':
            return 10;
        case 'degraded':
            return 4;
        default:
            return 0;
    }
}

function buildDecision(band) {
    switch (band) {
        case 'ready':
            return 'adoption-go';
        case 'watch':
            return 'review-adoption-evidence';
        case 'degraded':
            return 'stabilize-adoption';
        default:
            return 'hold-adoption';
    }
}

function summarizeGate(band, snapshot) {
    const roleLabel = toString(snapshot.roleLabel, snapshot.role || 'surface');
    const checklist = asObject(snapshot.checklist);
    const training = asObject(snapshot.training);
    const acknowledgements = asObject(snapshot.acknowledgements);

    if (band === 'blocked') {
        return `${roleLabel} bloqueado: truth no confiable o runtime bloqueado.`;
    }
    if (band === 'degraded') {
        return `${roleLabel} degradado: hay drift o evidencia parcial.`;
    }
    if (band === 'watch') {
        return `${roleLabel} en observacion: ${Number(
            checklist.summary?.pass || 0
        )}/${Number(checklist.summary?.all || 0)} checks y ${training.training}/${training.total} training, ${training.manualHandoff}/${training.total} manual handoff, ${acknowledgements.total} ack.`;
    }
    return `${roleLabel} listo: checklist ${Number(
        checklist.summary?.pass || 0
    )}/${Number(checklist.summary?.all || 0)} con training, manual handoff y ack completos.`;
}

export function buildTurneroSurfaceAdoptionGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const truth = asObject(snapshot.truth);
    const runtime = asObject(snapshot.runtime);
    const training = asObject(snapshot.training);
    const acknowledgements = asObject(snapshot.acknowledgements);
    const checklist = asObject(snapshot.checklist);
    const hasCriticalBlock =
        truth.state === 'blocked' || runtime.state === 'blocked';
    const hasDrift =
        truth.state === 'degraded' ||
        runtime.state === 'degraded' ||
        truth.routeMatches === false;
    const evidenceComplete =
        Number(training.training || 0) > 0 &&
        Number(training.manualHandoff || 0) > 0 &&
        Number(acknowledgements.total || 0) > 0;
    const checklistAll = Math.max(0, Number(checklist.summary?.all || 0) || 0);
    const checklistPass = Math.max(
        0,
        Number(checklist.summary?.pass || 0) || 0
    );
    const checklistRatio =
        checklistAll > 0 ? (checklistPass / checklistAll) * 100 : 0;

    let score = 0;
    score += truthWeight(truth.state);
    score += truth.routeMatches === false ? 0 : 10;
    score += runtimeWeight(runtime.state);
    score += Number(training.training || 0) > 0 ? 15 : 0;
    score += Number(training.manualHandoff || 0) > 0 ? 15 : 0;
    score += Number(acknowledgements.total || 0) > 0 ? 15 : 0;
    score += Math.min(10, checklistRatio * 0.1);
    score = clamp(Math.round(score), 0, 100);

    let band = 'watch';
    if (hasCriticalBlock || score < 35) {
        band = 'blocked';
    } else if (
        truth.state === 'aligned' &&
        runtime.state === 'ready' &&
        evidenceComplete &&
        checklistPass >= Math.max(0, checklistAll - 1) &&
        score >= 90
    ) {
        band = 'ready';
    } else if (hasDrift) {
        band = 'degraded';
    } else if (!evidenceComplete && score < 70) {
        band = 'watch';
    } else if (score < 55) {
        band = 'degraded';
    }

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, snapshot.surfaceKey),
        score,
        band,
        decision: buildDecision(band),
        truthState: toString(truth.state, 'watch'),
        runtimeState: toString(runtime.state, 'watch'),
        trainingCount: Number(training.training || 0) || 0,
        manualHandoffCount: Number(training.manualHandoff || 0) || 0,
        acknowledgementCount: Number(acknowledgements.total || 0) || 0,
        checklistPassCount: checklistPass,
        checklistTotalCount: checklistAll,
        checklistFailCount: Math.max(0, checklistAll - checklistPass),
        truthAligned: truth.state === 'aligned',
        routeMatches: truth.routeMatches !== false,
        summary: summarizeGate(band, snapshot),
        generatedAt: new Date().toISOString(),
    };
}
