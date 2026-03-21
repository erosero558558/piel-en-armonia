function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function buildTurneroSurfaceGoLiveGate(input = {}) {
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : {
                  summary: {
                      all: 0,
                      pass: 0,
                      fail: 0,
                  },
                  checks: [],
              };
    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    const readyEvidenceCount = evidence.filter(
        (item) => normalizeText(item?.status) === 'ready'
    ).length;
    const checklistAll = Math.max(0, Number(checklist.summary?.all || 0) || 0);
    const checklistPass = Math.max(
        0,
        Number(checklist.summary?.pass || 0) || 0
    );
    const checklistFail = Math.max(
        0,
        Number(checklist.summary?.fail || 0) || 0
    );
    const checklistPct =
        checklistAll > 0 ? (checklistPass / checklistAll) * 100 : 0;
    const evidencePct =
        evidence.length > 0 ? (readyEvidenceCount / evidence.length) * 100 : 0;

    let score = checklistPct * 0.75 + evidencePct * 0.25;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const band =
        checklistFail >= 4 || checklistPass === 0 || score < 40
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
                ? 'go-live-ok'
                : band === 'watch'
                  ? 'review-evidence-before-go-live'
                  : band === 'degraded'
                    ? 'fix-open-checkpoints'
                    : 'hold-go-live',
        checklistAll,
        checklistPass,
        checklistFail,
        evidenceCount: evidence.length,
        readyEvidenceCount,
        generatedAt: new Date().toISOString(),
    };
}
