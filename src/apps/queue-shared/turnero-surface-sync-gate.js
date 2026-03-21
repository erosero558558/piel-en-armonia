export function buildTurneroSurfaceSyncGate(input = {}) {
    const drifts = Array.isArray(input.drifts) ? input.drifts : [];
    const handoffs = Array.isArray(input.handoffs) ? input.handoffs : [];
    const high = drifts.filter((item) => item.severity === 'high').length;
    const medium = drifts.filter((item) => item.severity === 'medium').length;
    const low = drifts.filter((item) => item.severity === 'low').length;
    const openHandoffs = handoffs.filter(
        (item) => String(item?.status || '').toLowerCase() !== 'closed'
    ).length;

    let score = 100;
    score -= high * 20;
    score -= medium * 10;
    score -= low * 4;
    score -= openHandoffs * 5;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        high > 0
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
                ? 'sync-ok'
                : band === 'watch'
                  ? 'review-sync'
                  : 'hold-handoff',
        generatedAt: new Date().toISOString(),
    };
}
