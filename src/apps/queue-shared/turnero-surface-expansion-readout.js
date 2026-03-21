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

function resolveState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (['ready', 'aligned', 'high'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'medium'].includes(normalized)) {
        return 'warning';
    }
    return 'alert';
}

function resolveGateState(band) {
    const normalized = toString(band, 'degraded').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

export function buildTurneroSurfaceExpansionReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const readyLedgerCount = ledger.filter((entry) =>
        ['ready', 'done', 'closed', 'approved'].includes(
            toString(entry?.status).toLowerCase()
        )
    ).length;
    const activeOwnerCount = owners.filter((entry) =>
        ['active', 'ready', 'primary'].includes(
            toString(entry?.status, 'active').toLowerCase()
        )
    ).length;
    const gateBand = toString(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;

    return {
        scope: toString(snapshot.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'watch'),
        opportunityState: toString(snapshot.opportunityState, 'watch'),
        demandSignal: toString(snapshot.demandSignal, 'none'),
        gapState: toString(snapshot.gapState, ''),
        expansionOwner: toString(snapshot.expansionOwner, ''),
        nextModuleHint: toString(snapshot.nextModuleHint, ''),
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'hold-expansion-readiness'),
        summary: toString(
            gate.summary,
            `Expansion ${gateBand} para ${toString(
                snapshot.surfaceLabel,
                snapshot.surfaceKey || 'surface'
            )}`
        ),
        detail: toString(
            gate.detail,
            [
                `demand ${toString(snapshot.demandSignal, 'none')}`,
                `expansion ${toString(snapshot.opportunityState, 'watch')}`,
                `gap ${toString(snapshot.gapState, 'sin gap') || 'sin gap'}`,
                `owner ${toString(snapshot.expansionOwner, 'sin owner') || 'sin owner'}`,
                `next ${toString(snapshot.nextModuleHint, 'sin siguiente modulo') || 'sin siguiente modulo'}`,
            ].join(' · ')
        ),
        badge: `${gateBand} · ${gateScore}`,
        checkpoints: [
            {
                label: 'demand',
                value: toString(snapshot.demandSignal, 'none'),
                state: resolveState(snapshot.demandSignal),
            },
            {
                label: 'expansion',
                value: toString(snapshot.opportunityState, gateBand),
                state:
                    toString(snapshot.opportunityState, 'watch') === 'ready'
                        ? 'ready'
                        : toString(snapshot.opportunityState, 'watch') === 'watch'
                          ? 'warning'
                          : resolveGateState(gateBand),
            },
            {
                label: 'score',
                value: String(gateScore),
                state: resolveGateState(gateBand),
            },
        ],
        chips: [],
        generatedAt: new Date().toISOString(),
    };
}
