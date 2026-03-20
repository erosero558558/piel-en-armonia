import { asObject, toArray, toText } from './turnero-release-control-center.js';

function normalizeSeverity(value, fallback = 'medium') {
    const severity = toText(value, fallback).toLowerCase();
    return ['critical', 'high', 'medium', 'low', 'info'].includes(severity)
        ? severity
        : fallback;
}

function normalizeStatus(value, fallback = 'open') {
    const status = toText(value, fallback).toLowerCase();
    return status || fallback;
}

function getDisposition(source, severity, status) {
    if (status === 'closed') {
        return 'monitor';
    }

    if (source === 'gap') {
        return severity === 'critical' || severity === 'high'
            ? 'must-close'
            : 'owner-review';
    }

    if (source === 'branch-delta') {
        return severity === 'critical' || severity === 'high'
            ? 'must-close'
            : 'owner-review';
    }

    return severity === 'critical' || severity === 'high'
        ? 'must-close'
        : severity === 'medium'
          ? 'owner-review'
          : 'monitor';
}

function normalizeRow(entry, index, source) {
    const item = asObject(entry);
    const label = toText(
        item.label || item.title || item.kind || item.name,
        `${source} ${index + 1}`
    );
    const severity = normalizeSeverity(
        item.severity || item.priority || item.criticality,
        source === 'blocker' ? 'medium' : 'high'
    );
    const status = normalizeStatus(
        item.status || item.state || (item.closed === true ? 'closed' : 'open'),
        'open'
    );
    const owner = toText(item.owner || item.team || 'program', 'program');

    return {
        id: toText(item.id || item.key, `${source}-${index + 1}`),
        key: toText(item.key || item.id, `${source}-${index + 1}`),
        kind: label,
        label,
        owner,
        severity,
        status,
        disposition: getDisposition(source, severity, status),
        source,
        note: toText(item.note || item.detail || item.description, ''),
        createdAt: toText(item.createdAt || item.at, new Date().toISOString()),
        updatedAt: toText(item.updatedAt || item.updated_at, ''),
    };
}

export function buildTurneroReleaseBlockerDispositionMap(input = {}) {
    const blockers = toArray(input.blockers);
    const gaps = toArray(input.gaps);
    const branchDelta = toArray(input.branchDelta);

    const rows = [
        ...blockers.map((entry, index) =>
            normalizeRow(entry, index, 'blocker')
        ),
        ...gaps.map((entry, index) => normalizeRow(entry, index, 'gap')),
        ...branchDelta.map((entry, index) =>
            normalizeRow(entry, index, 'branch-delta')
        ),
    ];

    return {
        rows,
        summary: {
            all: rows.length,
            blockers: blockers.length,
            gaps: gaps.length,
            branchDelta: branchDelta.length,
            mustClose: rows.filter(
                (row) =>
                    row.disposition === 'must-close' && row.status !== 'closed'
            ).length,
            open: rows.filter((row) => row.status !== 'closed').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseBlockerDispositionMap;
