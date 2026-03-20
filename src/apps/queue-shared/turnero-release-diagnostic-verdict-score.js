function asSummary(input, fallback) {
    return input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : fallback;
}

export function buildTurneroReleaseDiagnosticVerdictScore(input = {}) {
    const ownerSummary = asSummary(input.ownerSummary, {
        ready: 0,
        blocked: 0,
        all: 0,
    });
    const blockerSummary = asSummary(input.blockerSummary, {
        mustClose: 0,
        open: 0,
    });
    const gapSummary = asSummary(input.gapSummary, {
        open: 0,
        all: 0,
    });
    const branchDeltaSummary = asSummary(input.branchDeltaSummary, {
        open: 0,
        all: 0,
    });
    const repoVerdict = asSummary(input.repoVerdict, {
        evidencePct: 0,
        closurePct: 0,
    });

    const ownerPct =
        Number(ownerSummary.all || 0) > 0
            ? (Number(ownerSummary.ready || 0) /
                  Number(ownerSummary.all || 0)) *
              100
            : 0;
    const evidencePct = Number(repoVerdict.evidencePct || 0);
    const closurePct = Number(repoVerdict.closurePct || 0);
    const pressurePenalty = Math.max(
        0,
        100 -
            Number(blockerSummary.mustClose || 0) * 16 -
            Number(blockerSummary.open || 0) * 5 -
            Number(gapSummary.open || 0) * 8 -
            Number(branchDeltaSummary.open || 0) * 4
    );

    let score = 0;
    score += ownerPct * 0.3;
    score += evidencePct * 0.25;
    score += closurePct * 0.2;
    score += pressurePenalty * 0.25;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'ready'
            : score >= 75
              ? 'near-ready'
              : score >= 60
                ? 'review'
                : 'blocked';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'run-final-honest-diagnostic'
                : band === 'near-ready'
                  ? 'close-minor-items'
                  : band === 'review'
                    ? 'resolve-open-gaps'
                    : 'close-blockers-first',
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseDiagnosticVerdictScore;
