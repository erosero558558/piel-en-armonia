export function buildTurneroReleaseRepoTruthScore(input = {}) {
    const compareSummary = input.compareSummary || {
        present: 0,
        partial: 0,
        missing: 0,
        all: 0,
    };
    const truthRows = Array.isArray(input.truthRows) ? input.truthRows : [];
    const driftSummary = input.driftSummary || { all: 0, high: 0 };
    const provenance = Array.isArray(input.provenance) ? input.provenance : [];

    const comparePct =
        compareSummary.all > 0
            ? (compareSummary.present / compareSummary.all) * 100
            : 0;
    const truthAvg = truthRows.length
        ? truthRows.reduce((sum, row) => sum + Number(row.truthPct || 0), 0) /
          truthRows.length
        : 0;
    const provenancePct =
        compareSummary.all > 0
            ? (provenance.filter((item) => Boolean(item.commitRef)).length /
                  compareSummary.all) *
              100
            : 0;

    let score = 0;
    score += comparePct * 0.4;
    score += truthAvg * 0.3;
    score += provenancePct * 0.2;
    score +=
        Math.max(0, 100 - driftSummary.all * 8 - driftSummary.high * 10) * 0.1;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'uncertain';

    return {
        score,
        band,
        decision:
            score < 55
                ? 'audit-main-first'
                : score < 75
                  ? 'converge-then-audit'
                  : 'repo-truth-ready',
        generatedAt: new Date().toISOString(),
    };
}
