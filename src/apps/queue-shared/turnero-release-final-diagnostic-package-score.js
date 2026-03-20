import { toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseFinalDiagnosticPackageScore(input = {}) {
    const exportSummary = input.exportSummary || { ready: 0, all: 0 };
    const queue = Array.isArray(input.auditQueue) ? input.auditQueue : [];
    const verdict = input.verdict || { decision: 'review' };
    const session = input.session || null;
    const openQueue = queue.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;

    const exportPct =
        Number(exportSummary.all || 0) > 0
            ? (Number(exportSummary.ready || 0) /
                  Number(exportSummary.all || 0)) *
              100
            : 0;

    let score = 0;
    score += exportPct * 0.35;
    score +=
        (session?.status === 'prepared' || session?.status === 'locked'
            ? 95
            : 55) * 0.2;
    score +=
        (verdict.decision === 'green'
            ? 95
            : verdict.decision === 'amber'
              ? 72
              : 45) * 0.3;
    score += Math.max(0, 100 - openQueue * 8) * 0.15;
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
                ? 'ship-final-diagnostic-pack'
                : band === 'near-ready'
                  ? 'finish-audit-queue'
                  : 'hold-pack',
        exportPct: Number(exportPct.toFixed(1)),
        openQueue,
        sessionStatus: toText(session?.status || 'unprepared'),
        verdictDecision: toText(verdict.decision || 'review'),
        generatedAt: new Date().toISOString(),
    };
}
