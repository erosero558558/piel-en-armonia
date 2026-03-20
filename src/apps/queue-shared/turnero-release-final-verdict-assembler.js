import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_BLOCKERS = Object.freeze([
    {
        id: 'blk-1',
        kind: 'runtime-source-drift',
        owner: 'infra',
        severity: 'high',
        status: 'open',
        note: 'Runtime source and deployed bundle diverged.',
    },
    {
        id: 'blk-2',
        kind: 'signoff-gap',
        owner: 'program',
        severity: 'medium',
        status: 'open',
        note: 'Final signoff is still pending.',
    },
]);

function normalizeBlocker(item, index) {
    const row = asObject(item);

    return {
        id: toText(row.id || row.key || `blocker-${index + 1}`),
        kind: toText(row.kind || row.type || row.title || 'blocker'),
        owner: toText(row.owner || 'program'),
        severity: toText(row.severity || 'medium')
            .trim()
            .toLowerCase(),
        status: toText(row.status || row.state || 'open')
            .trim()
            .toLowerCase(),
        note: toText(row.note || row.detail || ''),
    };
}

function resolveBlockers(input = {}) {
    const candidates = [
        input.blockers,
        input.blockerRows,
        input.items,
        input.currentSnapshot?.blockers,
        input.currentSnapshot?.releaseEvidenceBundle?.blockers,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return DEFAULT_BLOCKERS;
}

export function buildTurneroReleaseFinalVerdictAssembler(input = {}) {
    const launchGate = asObject(
        input.launchGate || input.currentSnapshot?.launchGate || {}
    );
    const workspaceVerdict = asObject(
        input.workspaceVerdict || input.currentSnapshot?.workspaceVerdict || {}
    );
    const blockers = toArray(resolveBlockers(input)).map(normalizeBlocker);
    const openBlockers = blockers.filter(
        (row) => String(row.status).trim().toLowerCase() !== 'closed'
    );
    const highOpen = openBlockers.filter(
        (row) => row.severity === 'high'
    ).length;
    const mediumOpen = openBlockers.filter(
        (row) => row.severity === 'medium'
    ).length;
    const launchDecision = toText(launchGate.decision, 'collect-last-signoffs');
    const workspaceVerdictName = toText(workspaceVerdict.verdict, 'review');
    const decision =
        highOpen > 0
            ? 'blocked'
            : launchDecision === 'launch-honest-diagnostic' &&
                workspaceVerdictName === 'ready-for-honest-diagnostic'
              ? 'green'
              : launchDecision === 'collect-last-signoffs'
                ? 'amber'
                : 'review';

    return {
        launchDecision,
        workspaceVerdict: workspaceVerdictName,
        blockers,
        openBlockers: openBlockers.length,
        highOpen,
        mediumOpen,
        summary: {
            all: blockers.length,
            open: openBlockers.length,
            highOpen,
            mediumOpen,
        },
        decision,
        generatedAt: new Date().toISOString(),
    };
}
