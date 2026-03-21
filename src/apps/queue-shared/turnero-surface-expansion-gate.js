function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const source =
        checklist && typeof checklist === 'object'
            ? checklist.summary && typeof checklist.summary === 'object'
                ? checklist.summary
                : checklist
            : null;
    return {
        all: Math.max(0, toNumber(source?.all)),
        pass: Math.max(0, toNumber(source?.pass)),
        fail: Math.max(0, toNumber(source?.fail)),
    };
}

function normalizeStatus(value) {
    const normalized = toString(value, '').toLowerCase();
    if (
        ['blocked', 'degraded', 'alert', 'critical', 'error', 'failed'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    if (['watch', 'review', 'pending', 'draft', 'paused'].includes(normalized)) {
        return 'watch';
    }
    if (
        ['ready', 'done', 'closed', 'approved', 'aligned', 'active'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    return normalized || 'watch';
}

function scoreTruthState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (normalized === 'aligned' || normalized === 'ready') {
        return 100;
    }
    if (normalized === 'watch') {
        return 76;
    }
    if (normalized === 'draft') {
        return 58;
    }
    if (normalized === 'degraded') {
        return 34;
    }
    if (normalized === 'blocked') {
        return 8;
    }
    return 58;
}

function scoreOpportunityState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (normalized === 'ready') {
        return 100;
    }
    if (normalized === 'watch') {
        return 80;
    }
    if (normalized === 'draft' || normalized === 'pending') {
        return 58;
    }
    if (normalized === 'degraded') {
        return 32;
    }
    if (normalized === 'blocked') {
        return 12;
    }
    return 58;
}

function scoreDemandSignal(value) {
    const normalized = toString(value, 'none').toLowerCase();
    if (normalized === 'high') {
        return 100;
    }
    if (normalized === 'medium') {
        return 82;
    }
    if (normalized === 'low') {
        return 64;
    }
    if (normalized === 'none') {
        return 42;
    }
    return 52;
}

function scorePresence(value, whenMissing = 34) {
    return toString(value) ? 100 : whenMissing;
}

function buildBlockers(snapshot, checklist, ledger, owners) {
    const blockers = [];
    const truth = toString(snapshot.truth, 'watch').toLowerCase();
    const opportunityState = toString(
        snapshot.opportunityState,
        'watch'
    ).toLowerCase();
    const hardLedgerBlocker = ledger.some(
        (entry) => normalizeStatus(entry?.status) === 'blocked'
    );
    const hardOwnerBlocker = owners.some(
        (entry) => normalizeStatus(entry?.status) === 'blocked'
    );

    if (checklist.fail >= 2) {
        blockers.push('checklist');
    }
    if (truth === 'blocked') {
        blockers.push('truth');
    }
    if (opportunityState === 'blocked') {
        blockers.push('opportunity');
    }
    if (hardLedgerBlocker) {
        blockers.push('ledger');
    }
    if (hardOwnerBlocker) {
        blockers.push('owners');
    }

    return blockers;
}

function buildWarnings(snapshot, checklist, ledger, owners) {
    const warnings = [];
    const truth = toString(snapshot.truth, 'watch').toLowerCase();
    const opportunityState = toString(
        snapshot.opportunityState,
        'watch'
    ).toLowerCase();
    const demandSignal = toString(snapshot.demandSignal, 'none').toLowerCase();

    if (checklist.fail === 1) {
        warnings.push('checklist');
    }
    if (truth === 'watch' || truth === 'draft') {
        warnings.push('truth');
    }
    if (opportunityState === 'watch' || opportunityState === 'draft') {
        warnings.push('opportunity');
    }
    if (demandSignal === 'low' || demandSignal === 'none') {
        warnings.push('demand');
    }
    if (!toString(snapshot.gapState)) {
        warnings.push('missing-gap');
    }
    if (!toString(snapshot.expansionOwner)) {
        warnings.push('missing-owner');
    }
    if (!toString(snapshot.nextModuleHint)) {
        warnings.push('missing-next-module');
    }
    if (ledger.length === 0) {
        warnings.push('ledger-empty');
    }
    if (owners.length === 0) {
        warnings.push('owners-empty');
    }

    return warnings;
}

function buildSummary(band) {
    if (band === 'ready') {
        return 'Surface expansion lista para visibilizar el siguiente modulo.';
    }
    if (band === 'watch') {
        return 'Surface expansion visible con seguimiento recomendado.';
    }
    if (band === 'degraded') {
        return 'Surface expansion visible, pero requiere ordenar owners y evidencia.';
    }
    return 'Surface expansion bloqueada por senales de riesgo.';
}

function buildDecision(band) {
    if (band === 'ready') {
        return 'expansion-ready';
    }
    if (band === 'watch') {
        return 'review-expansion-opportunities';
    }
    if (band === 'degraded') {
        return 'stabilize-expansion-readiness';
    }
    return 'hold-expansion-readiness';
}

function buildDetail(snapshot, counts) {
    return [
        `Demand ${toString(snapshot.demandSignal, 'none')}`,
        `expansion ${toString(snapshot.opportunityState, 'watch')}`,
        `gap ${toString(snapshot.gapState, 'sin gap')}`,
        `owner ${toString(snapshot.expansionOwner, 'sin owner') || 'sin owner'}`,
        `next ${toString(snapshot.nextModuleHint, 'sin siguiente modulo') || 'sin siguiente modulo'}`,
        `ledger ${counts.ledgerCount}`,
    ].join(' · ');
}

export function buildTurneroSurfaceExpansionGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const readyLedgerCount = ledger.filter(
        (entry) => normalizeStatus(entry?.status) === 'ready'
    ).length;
    const activeOwnerCount = owners.filter(
        (entry) => normalizeStatus(entry?.status) === 'ready'
    ).length;
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const ledgerPct =
        ledger.length > 0 ? (readyLedgerCount / ledger.length) * 100 : 0;
    const ownerPct =
        owners.length > 0 ? (activeOwnerCount / owners.length) * 100 : 0;

    const score = clamp(
        Number(
            (
                checklistPct * 0.3 +
                ledgerPct * 0.16 +
                ownerPct * 0.1 +
                scoreOpportunityState(snapshot.opportunityState) * 0.12 +
                scoreDemandSignal(snapshot.demandSignal) * 0.08 +
                scoreTruthState(snapshot.truth) * 0.08 +
                scorePresence(snapshot.gapState, 36) * 0.05 +
                scorePresence(snapshot.nextModuleHint, 32) * 0.05 +
                scorePresence(snapshot.expansionOwner, 30) * 0.06
            ).toFixed(1)
        ),
        0,
        100
    );

    const blockers = buildBlockers(snapshot, checklist, ledger, owners);
    const warnings = buildWarnings(snapshot, checklist, ledger, owners);
    let band = 'degraded';

    if (blockers.length > 0) {
        band = 'blocked';
    } else if (score >= 88 && checklist.fail === 0) {
        band = 'ready';
    } else if (score >= 66) {
        band = 'watch';
    }

    return {
        score,
        band,
        decision: buildDecision(band),
        summary: buildSummary(band),
        detail: buildDetail(snapshot, {
            ledgerCount: ledger.length,
            readyLedgerCount,
            ownerCount: owners.length,
            activeOwnerCount,
        }),
        blockers,
        warnings,
        checklist,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        generatedAt: new Date().toISOString(),
    };
}
