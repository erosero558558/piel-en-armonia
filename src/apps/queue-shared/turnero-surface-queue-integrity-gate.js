function normalizeStatus(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

export function buildTurneroSurfaceQueueIntegrityGate(input = {}) {
    const drifts = Array.isArray(input.drifts) ? input.drifts : [];
    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    const high = drifts.filter(
        (item) =>
            String(item?.severity || '').toLowerCase() === 'high' ||
            String(item?.state || '').toLowerCase() === 'blocked'
    ).length;
    const medium = drifts.filter(
        (item) =>
            String(item?.severity || '').toLowerCase() === 'medium' ||
            String(item?.state || '').toLowerCase() === 'degraded'
    ).length;
    const low = drifts.filter(
        (item) =>
            String(item?.severity || '').toLowerCase() === 'low' ||
            String(item?.state || '').toLowerCase() === 'watch'
    ).length;
    const passEvidence = evidence.filter(
        (item) => normalizeStatus(item?.status) === 'pass'
    ).length;

    let score = 100;
    score -= high * 24;
    score -= medium * 14;
    score -= low * 5;
    if (evidence.length > 0) {
        score += Math.min(6, passEvidence * 2);
    }
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        high > 0
            ? 'blocked'
            : medium > 0
              ? 'degraded'
              : low > 0
                ? 'watch'
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
                ? 'queue-integrity-ok'
                : band === 'watch'
                  ? 'review-visible-drift'
                  : band === 'degraded'
                    ? 'review-visible-drift'
                    : 'hold-surface-queue',
        highDriftCount: high,
        mediumDriftCount: medium,
        lowDriftCount: low,
        evidenceCount: evidence.length,
        passEvidenceCount: passEvidence,
        generatedAt: new Date().toISOString(),
    };
}
