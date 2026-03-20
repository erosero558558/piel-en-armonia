import { asObject, toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseVerdictFreezeBoard(input = {}) {
    const blockers = Array.isArray(input.blockers) ? input.blockers : [];
    const rows = blockers.map((blocker, index) => {
        const item = asObject(blocker);
        const status = toText(item.status, 'open').toLowerCase();

        return {
            id: item.id || `freeze-${index + 1}`,
            kind: item.kind || item.title || `Blocker ${index + 1}`,
            owner: item.owner || 'program',
            severity: item.severity || 'medium',
            status,
            frozen: status !== 'closed',
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            frozen: rows.filter((row) => row.frozen).length,
            high: rows.filter((row) => row.frozen && row.severity === 'high')
                .length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseVerdictFreezeBoard;
