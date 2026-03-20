import { asObject, toArray, toText } from './turnero-release-control-center.js';

function resolveResidual(severity) {
    switch (severity) {
        case 'critical':
            return 95;
        case 'high':
            return 85;
        case 'medium':
            return 55;
        case 'low':
            return 25;
        default:
            return 35;
    }
}

function resolveState(blocker, residual) {
    const status = toText(blocker.status || blocker.state, 'open')
        .trim()
        .toLowerCase();
    if (status === 'closed') {
        return 'mitigated';
    }
    if (residual >= 80) {
        return 'elevated';
    }
    if (residual >= 50) {
        return 'watch';
    }
    return 'low';
}

function normalizeBlockerRow(entry, index) {
    const blocker = asObject(entry);
    const severity = toText(blocker.severity || blocker.priority, 'medium')
        .trim()
        .toLowerCase();
    const residual = resolveResidual(severity);

    return {
        id: toText(blocker.id, `risk-${index + 1}`),
        kind: toText(
            blocker.kind || blocker.title || blocker.label,
            `Risk ${index + 1}`
        ),
        owner: toText(blocker.owner, 'program'),
        severity,
        residual,
        state: resolveState(blocker, residual),
        status: toText(blocker.status || blocker.state, 'open'),
        note: toText(blocker.note || blocker.detail || blocker.description, ''),
        createdAt: toText(
            blocker.createdAt || blocker.at,
            new Date().toISOString()
        ),
        updatedAt: toText(
            blocker.updatedAt || blocker.createdAt || blocker.at,
            ''
        ),
    };
}

export function buildTurneroReleaseFinalRiskResidualMap(input = {}) {
    const blockers = toArray(input.blockers).map(asObject);
    const rows = blockers.map((blocker, index) =>
        normalizeBlockerRow(blocker, index)
    );

    return {
        rows,
        summary: {
            all: rows.length,
            elevated: rows.filter((row) => row.state === 'elevated').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            mitigated: rows.filter((row) => row.state === 'mitigated').length,
            low: rows.filter((row) => row.state === 'low').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalRiskResidualMap;
