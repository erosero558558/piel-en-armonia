import { asObject, toArray, toText } from './turnero-release-control-center.js';

function renderPreviewLines(rows, formatter, emptyLabel) {
    const list = toArray(rows);
    if (list.length === 0) {
        return [`- ${emptyLabel}`];
    }

    return list.slice(0, 4).map(formatter);
}

export function buildTurneroReleaseFinalDiagnosticPackage(pack = {}) {
    const session = asObject(pack.session || {});
    const exportIndex = asObject(pack.exportIndex || {});
    const auditQueue = toArray(pack.auditQueue);
    const verdict = asObject(pack.verdict || {});
    const timeline = asObject(pack.timeline || {});
    const packageScore = asObject(pack.packageScore || {});
    const blockers = toArray(pack.blockers || verdict.blockers);
    const openQueueRows = auditQueue.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });
    const openBlockers = blockers.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });

    const lines = [
        '# Final Repo Diagnostic Handoff Pack',
        '',
        `Clinic: ${toText(
            pack.clinicLabel ||
                pack.clinicShortName ||
                pack.clinicId ||
                'regional'
        )}${pack.clinicId ? ` (${pack.clinicId})` : ''}`,
        `Scope: ${toText(pack.scope, 'global')}`,
        `Region: ${toText(pack.region, 'regional')}`,
        `Session status: ${toText(session.status || 'unprepared')}`,
        `Launch gate: ${toText(verdict.launchDecision || 'collect-last-signoffs')}`,
        `Workspace verdict: ${toText(verdict.workspaceVerdict || 'review')}`,
        `Final verdict: ${toText(verdict.decision || 'review')}`,
        `Package score: ${packageScore.score ?? 0} (${packageScore.band || 'n/a'})`,
        `Package decision: ${toText(packageScore.decision || 'hold-pack')}`,
        `Evidence exports ready: ${exportIndex.summary?.ready ?? 0}/${
            exportIndex.summary?.all ?? 0
        }`,
        `Audit queue open: ${openQueueRows.length}`,
        `Open blockers: ${verdict.highOpen ?? 0} high · ${
            verdict.openBlockers ?? openBlockers.length
        } open`,
        '',
        '## Timeline',
        ...renderPreviewLines(
            timeline.rows,
            (row) => `- ${toText(row.window)}: ${toText(row.label)}`,
            'Sin timeline'
        ),
        '',
        '## Evidence exports',
        ...renderPreviewLines(
            exportIndex.rows,
            (row) =>
                `- [${toText(row.status)}] ${toText(row.label)} · ${toText(
                    row.kind
                )} · ${toText(row.exportKey)}`,
            'Sin evidence exports'
        ),
        '',
        '## Audit queue',
        ...renderPreviewLines(
            auditQueue,
            (row) =>
                `- [${toText(row.status)}] ${toText(row.title)} · ${toText(
                    row.owner
                )} · ${toText(row.area)}`,
            'Sin audit queue'
        ),
        '',
        '## Blockers',
        ...renderPreviewLines(
            openBlockers,
            (row) =>
                `- [${toText(row.severity)}] ${toText(row.kind)} · ${toText(
                    row.owner
                )}`,
            'Sin blockers'
        ),
        '',
        `Generated at: ${toText(pack.generatedAt || new Date().toISOString())}`,
    ];

    return {
        markdown: lines.join('\n'),
        summary: {
            openQueue: openQueueRows.length,
            openBlockers: openBlockers.length,
            evidenceReady: exportIndex.summary?.ready ?? 0,
            evidenceAll: exportIndex.summary?.all ?? 0,
            timelineSteps: toArray(timeline.rows).length,
            score: packageScore.score ?? 0,
            band: packageScore.band || 'n/a',
        },
        generatedAt: new Date().toISOString(),
    };
}
