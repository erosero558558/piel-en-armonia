import { toArray } from './turnero-release-control-center.js';

function pushSummaryLine(lines, label, value) {
    lines.push(`${label}: ${value}`);
}

function pushRowList(lines, title, rows, formatRow) {
    const list = toArray(rows);
    if (list.length === 0) {
        return;
    }

    lines.push('', title + ':');
    for (const row of list.slice(0, 4)) {
        lines.push(`- ${formatRow(row)}`);
    }
}

export function buildTurneroReleaseHonestDiagnosticReport(pack = {}) {
    const lines = ['# Honest Repo Diagnosis Workspace', ''];

    pushSummaryLine(lines, 'Scope', pack.scope || pack.region || 'global');
    pushSummaryLine(lines, 'Region', pack.region || 'regional');
    pushSummaryLine(lines, 'Platform', pack.detectedPlatform || 'unknown');
    pushSummaryLine(
        lines,
        'Verdict score',
        `${pack.verdictScore?.score ?? 0} (${pack.verdictScore?.band || 'n/a'})`
    );
    pushSummaryLine(lines, 'Decision', pack.verdictScore?.decision || 'review');
    pushSummaryLine(
        lines,
        'Repo verdict',
        pack.repoVerdict?.verdict || 'review'
    );
    pushSummaryLine(
        lines,
        'Evidence pct',
        `${pack.repoVerdict?.evidencePct ?? 0}%`
    );
    pushSummaryLine(
        lines,
        'Closure pct',
        `${pack.repoVerdict?.closurePct ?? 0}%`
    );
    pushSummaryLine(
        lines,
        'Must-close blockers',
        pack.blockerMap?.summary?.mustClose ?? 0
    );
    pushSummaryLine(lines, 'Open gaps', pack.summary?.openGapCount ?? 0);
    pushSummaryLine(
        lines,
        'Open branch deltas',
        pack.summary?.openBranchDeltaCount ?? 0
    );
    pushSummaryLine(
        lines,
        'Owners ready',
        `${pack.ownerVerdicts?.summary?.ready ?? 0}/${pack.ownerVerdicts?.summary?.all ?? 0}`
    );
    pushSummaryLine(lines, 'Attestations', toArray(pack.attestations).length);

    pushRowList(
        lines,
        'Top blockers',
        pack.blockerMap?.rows,
        (row) => `${row.kind} · ${row.owner} · ${row.disposition}`
    );
    pushRowList(
        lines,
        'Owner verdicts',
        pack.ownerVerdicts?.rows,
        (row) =>
            `${row.owner} · ${row.readiness} · ${row.blockers} blockers / ${row.gaps} gaps / ${row.branchDelta} delta`
    );
    pushRowList(
        lines,
        'Latest attestations',
        pack.attestations,
        (row) => `${row.label} · ${row.owner} · ${row.status}`
    );

    return {
        markdown: lines.join('\n'),
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseHonestDiagnosticReport;
