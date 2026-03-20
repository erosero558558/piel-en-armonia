import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_EVIDENCE_ROWS = Object.freeze([
    {
        id: 'ev-1',
        label: 'Mainline audit pack',
        kind: 'audit',
        owner: 'program',
        status: 'ready',
        exportKey: 'mainline-audit',
    },
    {
        id: 'ev-2',
        label: 'Closure cockpit pack',
        kind: 'closure',
        owner: 'ops',
        status: 'ready',
        exportKey: 'closure-cockpit',
    },
    {
        id: 'ev-3',
        label: 'Honest diagnosis pack',
        kind: 'verdict',
        owner: 'program',
        status: 'ready',
        exportKey: 'honest-diagnosis',
    },
    {
        id: 'ev-4',
        label: 'Runtime/source comparison',
        kind: 'runtime',
        owner: 'infra',
        status: 'pending',
        exportKey: 'runtime-diff',
    },
]);

function normalizeEvidenceRow(item, index) {
    const row = asObject(item);

    return {
        id: toText(row.id || row.key || `evidence-export-${index + 1}`),
        label: toText(row.label || row.title || `Evidence Export ${index + 1}`),
        kind: toText(row.kind || row.type || 'snapshot'),
        owner: toText(row.owner || 'program'),
        status: toText(row.status || row.state || 'ready')
            .trim()
            .toLowerCase(),
        exportKey: toText(row.exportKey || row.key || `export-${index + 1}`),
        note: toText(row.note || row.detail || ''),
        generatedAt: toText(row.generatedAt || new Date().toISOString()),
    };
}

function resolveEvidenceRows(input = {}) {
    const candidates = [
        input.evidence,
        input.evidenceRows,
        input.items,
        input.exportItems,
        input.currentSnapshot?.evidence,
        input.currentSnapshot?.releaseEvidenceBundle?.evidence,
        input.currentSnapshot?.releaseEvidenceBundle?.items,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return DEFAULT_EVIDENCE_ROWS;
}

export function buildTurneroReleaseEvidenceExportIndex(input = {}) {
    const rows = toArray(resolveEvidenceRows(input)).map(normalizeEvidenceRow);
    const ready = rows.filter((row) => row.status === 'ready').length;

    return {
        rows,
        summary: {
            all: rows.length,
            ready,
            pending: rows.length - ready,
        },
        generatedAt: new Date().toISOString(),
    };
}
