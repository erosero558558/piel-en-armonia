import { asObject, toString } from './turnero-surface-helpers.js';
import {
    normalizeTurneroSurfaceAcceptanceOperationalState,
    normalizeTurneroSurfaceAcceptanceKey,
    normalizeTurneroSurfaceAcceptanceTruthState,
} from './turnero-surface-acceptance-snapshot.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function stateRank(state) {
    switch (toString(state).toLowerCase()) {
        case 'blocked':
            return 3;
        case 'degraded':
            return 2;
        case 'watch':
            return 1;
        default:
            return 0;
    }
}

function stateTone(value) {
    switch (toString(value).toLowerCase()) {
        case 'ready':
            return 'ready';
        case 'watch':
            return 'warning';
        case 'degraded':
        case 'blocked':
            return 'alert';
        default:
            return 'warning';
    }
}

function summarizeChecks(checks = []) {
    const primaryIssue =
        checks.find((check) => stateRank(check.state) > 0) || null;
    return {
        checks: checks.map((check) => ({ ...check })),
        primaryIssue,
        hasBlocked: checks.some((check) => check.state === 'blocked'),
        hasDegraded: checks.some((check) => check.state === 'degraded'),
        hasWatch: checks.some((check) => check.state === 'watch'),
    };
}

function scoreFromChecklist(checklist = {}) {
    const pass = Math.max(0, Number(checklist.pass || 0) || 0);
    const all = Math.max(0, Number(checklist.all || 0) || 0);
    if (all <= 0) {
        return 60;
    }

    return 60 + Math.round((Math.min(pass, all) / all) * 40);
}

function scoreFromEvidence(evidenceSummary = {}) {
    let score = 0;
    score += Math.min(Number(evidenceSummary.total || 0) * 2, 8);
    score -= Math.min(Number(evidenceSummary.missing || 0) * 2, 8);
    score -= Math.min(Number(evidenceSummary.stale || 0) * 4, 12);
    return score;
}

function scoreFromSignoffs(signoffSummary = {}, signoffMode = 'manual') {
    let score = 0;
    score += Math.min(Number(signoffSummary.approve || 0) * 4, 8);
    score -= Math.min(Number(signoffSummary.reject || 0) * 30, 40);
    if (
        signoffMode === 'manual' &&
        Number(signoffSummary.approve || 0) <= 0 &&
        Number(signoffSummary.reject || 0) <= 0
    ) {
        score -= 6;
    }
    return score;
}

function scoreFromState(
    state,
    readyBonus,
    watchPenalty,
    degradedPenalty,
    blockedPenalty
) {
    switch (state) {
        case 'ready':
            return readyBonus;
        case 'watch':
            return watchPenalty;
        case 'degraded':
            return degradedPenalty;
        case 'blocked':
            return blockedPenalty;
        default:
            return 0;
    }
}

function resolveBand(checks) {
    const summary = summarizeChecks(checks);
    if (summary.hasBlocked) {
        return 'blocked';
    }
    if (summary.hasDegraded) {
        return 'degraded';
    }
    if (summary.hasWatch) {
        return 'watch';
    }
    return 'ready';
}

function summarizeGate(band, snapshot, primaryIssue) {
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);
    const checklistLabel = `${Number(checklist.pass || 0) || 0}/${
        Number(checklist.all || 0) || 0
    }`;

    if (band === 'blocked') {
        return `Aceptación bloqueada · ${
            primaryIssue?.detail ||
            primaryIssue?.label ||
            snapshot.contractDetail ||
            'Revisa la superficie antes de firmar.'
        }`;
    }

    if (band === 'degraded') {
        return `Aceptación degradada · ${
            primaryIssue?.detail ||
            primaryIssue?.label ||
            'Hay señales degradadas en runtime, sitio o entrenamiento.'
        }`;
    }

    if (band === 'watch') {
        return `Aceptación bajo observacion · ${
            primaryIssue?.detail ||
            'Aun faltan aprobaciones o señales por cerrar.'
        }`;
    }

    return `Aceptación lista · ${checklistLabel} checklist · ${Number(
        evidenceSummary.total || 0
    )} evidencia(s) · ${Number(signoffSummary.approve || 0) || 0} approval(es).`;
}

export function buildTurneroSurfaceAcceptanceGate(input = {}) {
    const snapshot = asObject(input.snapshot || input);
    const contractState = toString(
        snapshot.contractState || snapshot.contract?.state || 'ready'
    );
    const truthState = normalizeTurneroSurfaceAcceptanceTruthState(
        snapshot.truth?.state || snapshot.truthState || snapshot.truth,
        'watch'
    );
    const runtimeState = normalizeTurneroSurfaceAcceptanceOperationalState(
        snapshot.runtime?.state || snapshot.runtimeState || 'watch',
        'watch'
    );
    const siteState = normalizeTurneroSurfaceAcceptanceOperationalState(
        snapshot.site?.state || snapshot.siteStatus || 'watch',
        'watch'
    );
    const trainingState = normalizeTurneroSurfaceAcceptanceOperationalState(
        snapshot.training?.state || snapshot.trainingStatus || 'watch',
        'watch'
    );
    const acceptanceOwner = toString(
        snapshot.acceptanceOwner || snapshot.owner || ''
    );
    const signoffMode = toString(snapshot.signoffMode || 'manual', 'manual');
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);
    const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
        snapshot.surfaceKey || input.surfaceKey || 'operator'
    );

    const signoffState =
        Number(signoffSummary.reject || 0) > 0
            ? 'blocked'
            : Number(signoffSummary.approve || 0) > 0 ||
                signoffMode === 'broadcast'
              ? 'ready'
              : 'watch';
    const ownerState = acceptanceOwner ? 'ready' : 'watch';
    const checklistState =
        Number(checklist.fail || 0) <= 0
            ? 'ready'
            : Number(checklist.fail || 0) >= 3
              ? 'degraded'
              : 'watch';
    const evidenceState =
        Number(evidenceSummary.total || 0) > 0 ? 'ready' : 'watch';

    const checks = [
        {
            key: 'contract',
            label: 'Contract',
            state: contractState === 'alert' ? 'blocked' : 'ready',
            detail: toString(snapshot.contractDetail || ''),
        },
        {
            key: 'truth',
            label: 'Truth',
            state: truthState,
            detail: toString(snapshot.truth?.summary || ''),
        },
        {
            key: 'runtime',
            label: 'Runtime',
            state: runtimeState,
            detail: toString(snapshot.runtime?.summary || ''),
        },
        {
            key: 'site',
            label: 'Site',
            state: siteState,
            detail: toString(snapshot.site?.summary || ''),
        },
        {
            key: 'training',
            label: 'Training',
            state: trainingState,
            detail: toString(snapshot.training?.summary || ''),
        },
        {
            key: 'owner',
            label: 'Owner',
            state: ownerState,
            detail: acceptanceOwner || 'Sin owner asignado.',
        },
        {
            key: 'signoffs',
            label: 'Signoffs',
            state: signoffState,
            detail: toString(
                signoffSummary.detail ||
                    (signoffMode === 'broadcast'
                        ? 'Canal broadcast.'
                        : 'Pendiente de signoff manual.'),
                'Pendiente de signoff manual.'
            ),
        },
    ];

    const summary = summarizeChecks(checks);
    const band = resolveBand(checks);
    let score = scoreFromChecklist(checklist);
    score += scoreFromState(truthState, 8, -10, -20, -40);
    score += scoreFromState(runtimeState, 4, -8, -16, -32);
    score += scoreFromState(siteState, 4, -8, -16, -32);
    score += scoreFromState(trainingState, 4, -8, -16, -32);
    score += acceptanceOwner ? 4 : -4;
    score += scoreFromEvidence(evidenceSummary);
    score += scoreFromSignoffs(signoffSummary, signoffMode);
    score += contractState === 'alert' ? -30 : 0;
    score = clamp(Math.round(score), 0, 100);

    const checklistScore = Number(checklist.all || 0)
        ? Math.round(
              ((Number(checklist.pass || 0) || 0) /
                  Number(checklist.all || 0)) *
                  100
          )
        : 0;

    return {
        surfaceKey,
        score,
        band,
        tone: stateTone(band),
        decision:
            band === 'ready'
                ? 'accept'
                : band === 'watch'
                  ? 'review'
                  : band === 'degraded'
                    ? 'stabilize'
                    : 'hold',
        contractState,
        truthState,
        runtimeState,
        siteState,
        trainingState,
        ownerState,
        signoffState,
        checklistState,
        evidenceState,
        checklistScore,
        checklist,
        evidenceSummary,
        signoffSummary,
        checks: summary.checks,
        primaryIssue: summary.primaryIssue,
        summary: summarizeGate(band, snapshot, summary.primaryIssue),
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroSurfaceAcceptanceGate;
