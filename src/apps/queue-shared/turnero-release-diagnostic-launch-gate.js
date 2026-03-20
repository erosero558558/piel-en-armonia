export function buildTurneroReleaseDiagnosticLaunchGate(input = {}) {
    const readout = input.readout || {};
    const signoffs = Array.isArray(input.signoffs) ? input.signoffs : [];

    const totalSignoffs = signoffs.length;
    const approved = signoffs.filter(
        (item) =>
            String(item.verdict || '')
                .trim()
                .toLowerCase() === 'approve'
    ).length;

    let score = 100;
    score -= readout.lockStatus === 'locked' ? 0 : 20;
    score -= Number(readout.highFrozen || 0) * 15;
    score -= Number(readout.frozenBlockers || 0) * 4;
    score -= Number(readout.reject || 0) * 15;
    score -= Math.max(0, 3 - approved) * 8;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'launch-ready'
            : score >= 75
              ? 'near-ready'
              : score >= 60
                ? 'review'
                : 'blocked';

    return {
        score,
        band,
        decision:
            band === 'launch-ready'
                ? 'launch-honest-diagnostic'
                : band === 'near-ready'
                  ? 'collect-last-signoffs'
                  : 'hold-launch',
        totalSignoffs,
        approved,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseDiagnosticLaunchGate;
