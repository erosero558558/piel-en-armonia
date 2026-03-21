import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function normalizeChipState(value) {
    const normalized = toString(value).toLowerCase();
    if (
        normalized === 'ready' ||
        normalized === 'aligned' ||
        normalized === 'healthy' ||
        normalized === 'live' ||
        normalized === 'success'
    ) {
        return 'ready';
    }
    if (
        normalized === 'watch' ||
        normalized === 'warning' ||
        normalized === 'pending' ||
        normalized === 'safe'
    ) {
        return 'warning';
    }
    return 'alert';
}

function buildSummary(snapshot, gate) {
    const roleLabel = toString(snapshot.roleLabel, snapshot.role);
    const truth = asObject(snapshot.truth);
    const runtime = asObject(snapshot.runtime);
    const checklist = asObject(snapshot.checklist);

    if (gate.band === 'ready') {
        return `${roleLabel} listo · truth aligned · evidencia completa.`;
    }
    if (gate.band === 'watch') {
        return `${roleLabel} en observacion · ${Number(
            checklist.summary?.pass || 0
        )}/${Number(checklist.summary?.all || 0)} checks · faltan evidencias.`;
    }
    if (gate.band === 'degraded') {
        return `${roleLabel} degradado · truth ${truth.state} · runtime ${runtime.state}.`;
    }
    return `${roleLabel} bloqueado · truth ${truth.state} · runtime ${runtime.state}.`;
}

function buildDetail(snapshot) {
    const truth = asObject(snapshot.truth);
    const runtime = asObject(snapshot.runtime);
    const training = asObject(snapshot.training);
    const acknowledgements = asObject(snapshot.acknowledgements);
    const pieces = [
        truth.summary,
        truth.detail,
        runtime.summary,
        training.summary,
        acknowledgements.summary,
        `handoff ${toString(snapshot.handoffMode, 'manual')}`,
    ].filter(Boolean);

    return pieces.join(' · ');
}

export function buildTurneroSurfaceAdoptionReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = asObject(snapshot.checklist);
    const roleLabel = toString(snapshot.roleLabel, snapshot.role || 'surface');
    const adoptionValue = `${Number(checklist.summary?.pass || 0)}/${Number(
        checklist.summary?.all || 0
    )}`;
    const scoreValue = `${Number(gate.score || 0)}/100`;

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceId: toString(snapshot.surfaceId, ''),
        surfaceLabel: toString(snapshot.surfaceLabel, snapshot.surfaceKey),
        scope: toString(snapshot.scope, 'regional'),
        role: toString(snapshot.role, 'surface'),
        roleLabel,
        handoffMode: toString(snapshot.handoffMode, 'manual'),
        truthState: toString(snapshot.truth?.state, 'watch'),
        runtimeState: toString(snapshot.runtime?.state, 'watch'),
        checklistPassCount: Number(checklist.summary?.pass || 0) || 0,
        checklistTotalCount: Number(checklist.summary?.all || 0) || 0,
        checklistFailCount: Number(checklist.summary?.fail || 0) || 0,
        trainingCount: Number(snapshot.training?.training || 0) || 0,
        manualHandoffCount: Number(snapshot.training?.manualHandoff || 0) || 0,
        acknowledgementCount:
            Number(snapshot.acknowledgements?.total || 0) || 0,
        gateBand: toString(gate.band, 'watch'),
        gateScore: Number(gate.score || 0) || 0,
        gateDecision: toString(gate.decision, 'review-adoption-evidence'),
        badge: `${toString(gate.band, 'watch')} · ${Number(gate.score || 0)}`,
        summary: buildSummary(snapshot, gate),
        detail: buildDetail(snapshot),
        chips: [
            {
                label: 'Role',
                value: roleLabel,
                state: normalizeChipState(snapshot.truth?.state || gate.band),
            },
            {
                label: 'Adoption',
                value: adoptionValue,
                state: normalizeChipState(gate.band),
            },
            {
                label: 'Score',
                value: scoreValue,
                state: normalizeChipState(gate.band),
            },
        ],
        generatedAt: new Date().toISOString(),
    };
}

export const buildTurneroSurfaceAdoptionContractReadout =
    buildTurneroSurfaceAdoptionReadout;
