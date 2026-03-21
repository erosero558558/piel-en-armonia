function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const summary =
        checklist && typeof checklist === 'object' ? checklist.summary : null;
    return {
        all: Math.max(0, toNumber(summary?.all)),
        pass: Math.max(0, toNumber(summary?.pass)),
        fail: Math.max(0, toNumber(summary?.fail)),
    };
}

export function buildTurneroSurfaceCommercialGate(input = {}) {
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = Array.isArray(input.ledger)
        ? input.ledger.filter(Boolean)
        : [];
    const owners = Array.isArray(input.owners)
        ? input.owners.filter(Boolean)
        : [];
    const readyLedgerCount = ledger.filter((entry) =>
        ['ready', 'done', 'closed'].includes(
            toString(entry?.status, '').toLowerCase()
        )
    ).length;
    const activeOwnerCount = owners.filter(
        (entry) => toString(entry?.status, '').toLowerCase() === 'active'
    ).length;
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const ledgerPct =
        ledger.length > 0 ? (readyLedgerCount / ledger.length) * 100 : 0;
    const ownerPct =
        owners.length > 0 ? (activeOwnerCount / owners.length) * 100 : 0;

    let score = checklistPct * 0.55 + ledgerPct * 0.25 + ownerPct * 0.2;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const band =
        checklist.fail >= 2
            ? 'blocked'
            : score >= 90
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'commercial-ready'
                : band === 'watch'
                  ? 'review-package-readiness'
                  : 'hold-commercial-readiness',
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        generatedAt: new Date().toISOString(),
    };
}
