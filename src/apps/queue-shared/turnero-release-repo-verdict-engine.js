import { asObject, toArray } from './turnero-release-control-center.js';

function countOpenRows(rows = []) {
    return toArray(rows).filter((row) => {
        const status = String(row?.status || row?.state || 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;
}

function resolveSummary(summary, fallback = {}) {
    const value = asObject(summary);
    return Object.keys(value).length > 0 ? value : fallback;
}

export function buildTurneroReleaseRepoVerdictEngine(input = {}) {
    const manifestRows = toArray(input.manifestRows);
    const blockerRows = toArray(input.blockerRows);
    const gapRows = toArray(input.gapRows);
    const branchDeltaRows = toArray(input.branchDeltaRows);
    const evidenceBundle = asObject(input.releaseEvidenceBundle);
    const evidenceSummary = resolveSummary(
        input.evidenceSummary || evidenceBundle.evidenceSummary,
        {
            all: manifestRows.length,
            complete: 0,
            partial: 0,
            missing: manifestRows.length,
        }
    );
    const closureSummary = resolveSummary(
        input.closureSummary || evidenceBundle.closureSummary,
        {
            all: blockerRows.length + gapRows.length + branchDeltaRows.length,
            ready: 0,
            blocked:
                blockerRows.length + gapRows.length + branchDeltaRows.length,
        }
    );

    const evidenceAll = Number(
        evidenceSummary.all ?? evidenceSummary.total ?? manifestRows.length ?? 0
    );
    const evidenceComplete = Number(
        evidenceSummary.complete ??
            evidenceSummary.ready ??
            evidenceSummary.closed ??
            0
    );
    const closureAll = Number(
        closureSummary.all ??
            closureSummary.total ??
            blockerRows.length + gapRows.length + branchDeltaRows.length
    );
    const closureReady = Number(
        closureSummary.ready ??
            closureSummary.closed ??
            closureSummary.complete ??
            0
    );
    const highBlockers = blockerRows.filter((row) => {
        const severity = String(row?.severity || 'medium').toLowerCase();
        const status = String(row?.status || row?.state || 'open')
            .trim()
            .toLowerCase();
        return (
            status !== 'closed' &&
            (severity === 'critical' || severity === 'high')
        );
    }).length;
    const openGaps = countOpenRows(gapRows);
    const openBranchDelta = countOpenRows(branchDeltaRows);
    const evidencePct =
        evidenceAll > 0 ? (evidenceComplete / evidenceAll) * 100 : 0;
    const closurePct = closureAll > 0 ? (closureReady / closureAll) * 100 : 0;

    let verdict = 'review';
    if (
        highBlockers > 0 ||
        openGaps > 0 ||
        openBranchDelta > 0 ||
        evidencePct < 65 ||
        closurePct < 60
    ) {
        verdict = 'not-ready';
    } else if (evidencePct >= 85 && closurePct >= 80) {
        verdict = 'ready-for-honest-diagnostic';
    }

    return {
        manifestCount: manifestRows.length,
        evidencePct: Number(evidencePct.toFixed(1)),
        closurePct: Number(closurePct.toFixed(1)),
        highBlockers,
        openGaps,
        openBranchDelta,
        verdict,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseRepoVerdictEngine;
