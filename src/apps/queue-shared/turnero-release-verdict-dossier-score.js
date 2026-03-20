function asSummary(input, fallback) {
    return input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : fallback;
}

function countOpenRows(rows = []) {
    return Array.isArray(rows)
        ? rows.filter((row) => {
              const status = String(row?.status || row?.state || 'open')
                  .trim()
                  .toLowerCase();
              return status !== 'closed';
          }).length
        : 0;
}

export function buildTurneroReleaseVerdictDossierScore(input = {}) {
    const casefileSummary = asSummary(input.casefileSummary, {
        closed: 0,
        review: 0,
        open: 0,
        all: 0,
    });
    const riskSummary = asSummary(input.riskSummary, {
        elevated: 0,
        watch: 0,
        mitigated: 0,
        all: 0,
    });
    const disagreements = Array.isArray(input.disagreements)
        ? input.disagreements
        : [];
    const consensus = Array.isArray(input.consensus) ? input.consensus : [];

    const closedPct =
        Number(casefileSummary.all || 0) > 0
            ? (Number(casefileSummary.closed || 0) /
                  Number(casefileSummary.all || 0)) *
              100
            : 0;
    const consensusPct =
        Number(casefileSummary.all || 0) > 0
            ? (Number(consensus.length || 0) /
                  Number(casefileSummary.all || 0)) *
              100
            : 0;
    const openDisagreements = countOpenRows(disagreements);

    let score = 0;
    score += closedPct * 0.4;
    score += consensusPct * 0.25;
    score +=
        Math.max(
            0,
            100 -
                Number(riskSummary.elevated || 0) * 15 -
                Number(riskSummary.watch || 0) * 6
        ) * 0.2;
    score += Math.max(0, 100 - openDisagreements * 10) * 0.15;
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
                ? 'issue-final-verdict'
                : band === 'near-ready'
                  ? 'resolve-last-comments'
                  : 'hold-dossier',
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseVerdictDossierScore;
