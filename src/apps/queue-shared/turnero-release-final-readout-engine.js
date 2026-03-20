export function buildTurneroReleaseFinalReadoutEngine(input = {}) {
    const manifestSummary = input.manifestSummary ||
        input.manifest?.summary || {
            critical: 0,
            all: 0,
        };
    const lock = input.lock || null;
    const freezeSummary = input.freezeSummary ||
        input.freezeBoard?.summary || {
            frozen: 0,
            high: 0,
            all: 0,
        };
    const signoffs = Array.isArray(input.signoffs) ? input.signoffs : [];

    const approved = signoffs.filter(
        (item) =>
            String(item.verdict || '')
                .trim()
                .toLowerCase() === 'approve'
    ).length;
    const review = signoffs.filter(
        (item) =>
            String(item.verdict || '')
                .trim()
                .toLowerCase() === 'review'
    ).length;
    const reject = signoffs.filter(
        (item) =>
            String(item.verdict || '')
                .trim()
                .toLowerCase() === 'reject'
    ).length;

    return {
        lockStatus: lock?.status || 'unlocked',
        approved,
        review,
        reject,
        frozenBlockers: freezeSummary.frozen || 0,
        highFrozen: freezeSummary.high || 0,
        criticalChecks: manifestSummary.critical || 0,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalReadoutEngine;
