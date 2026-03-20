import { asObject, toArray, toText } from './turnero-release-control-center.js';

function normalizeConsensusRows(rows = []) {
    return toArray(rows).map(asObject);
}

function normalizeBlockers(rows = []) {
    return toArray(rows).map(asObject);
}

function countOpenBlockers(blockers, owner) {
    return blockers.filter((blocker) => {
        const blockerOwner = toText(blocker.owner, '');
        const status = toText(blocker.status || blocker.state, 'open')
            .trim()
            .toLowerCase();
        return blockerOwner === owner && status !== 'closed';
    });
}

function normalizeCasefileRow(row, index, consensusRows, blockers) {
    const entry = asObject(row);
    const key = toText(entry.key || entry.id, `dossier-item-${index + 1}`);
    const consensus =
        consensusRows.find((item) => {
            const candidateKey = toText(item.key || item.id, '');
            return candidateKey === key;
        }) || null;
    const openBlockers = countOpenBlockers(blockers, toText(entry.owner, ''));
    const consensusVerdict = toText(
        consensus?.verdict || consensus?.state,
        'pending'
    );
    const state =
        consensusVerdict === 'accepted' && openBlockers.length === 0
            ? 'closed'
            : consensusVerdict !== 'pending'
              ? 'review'
              : 'open';

    return {
        id: toText(entry.id, key),
        key,
        label: toText(entry.label, `Dossier Item ${index + 1}`),
        owner: toText(entry.owner, 'program'),
        consensusVerdict,
        blockerCount: openBlockers.length,
        state,
    };
}

export function buildTurneroReleaseRepoDiagnosisCasefile(input = {}) {
    const manifestRows = toArray(input.manifestRows).map(asObject);
    const consensusRows = normalizeConsensusRows(input.consensusRows);
    const blockers = normalizeBlockers(input.blockers);

    const rows = manifestRows.map((row, index) =>
        normalizeCasefileRow(row, index, consensusRows, blockers)
    );

    return {
        rows,
        summary: {
            all: rows.length,
            closed: rows.filter((row) => row.state === 'closed').length,
            review: rows.filter((row) => row.state === 'review').length,
            open: rows.filter((row) => row.state === 'open').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseRepoDiagnosisCasefile;
