import { asObject, toArray, toText } from './turnero-release-control-center.js';

function collectOwners(...rowGroups) {
    const owners = new Set();

    for (const group of rowGroups) {
        for (const row of toArray(group)) {
            const owner = toText(asObject(row).owner, '');
            if (owner) {
                owners.add(owner);
            }
        }
    }

    return [...owners];
}

function isOpenRow(row) {
    const status = toText(row.status || row.state || 'open', 'open')
        .trim()
        .toLowerCase();
    return status !== 'closed';
}

export function buildTurneroReleaseFinalOwnerVerdicts(input = {}) {
    const manifestRows = toArray(input.manifestRows);
    const blockerRows = toArray(input.blockerRows);
    const gapRows = toArray(input.gapRows);
    const branchDeltaRows = toArray(input.branchDeltaRows);
    const attestationRows = toArray(input.attestationRows);

    const owners = collectOwners(
        manifestRows,
        blockerRows,
        gapRows,
        branchDeltaRows,
        attestationRows
    );
    const rows = owners.map((owner) => {
        const ownerManifest = manifestRows.filter(
            (row) => toText(row.owner, '') === owner
        );
        const ownerBlockers = blockerRows.filter(
            (row) => toText(row.owner, '') === owner && isOpenRow(row)
        );
        const ownerGaps = gapRows.filter(
            (row) => toText(row.owner, '') === owner && isOpenRow(row)
        );
        const ownerBranchDelta = branchDeltaRows.filter(
            (row) => toText(row.owner, '') === owner && isOpenRow(row)
        );
        const ownerAttestations = attestationRows.filter(
            (row) => toText(row.owner, '') === owner
        );
        const openIssues =
            ownerBlockers.length + ownerGaps.length + ownerBranchDelta.length;

        let readiness = 'blocked';
        if (
            openIssues === 0 &&
            ownerAttestations.length >=
                Math.max(1, Math.floor(ownerManifest.length / 2))
        ) {
            readiness = 'ready';
        } else if (openIssues <= 1 && ownerAttestations.length > 0) {
            readiness = 'review';
        }

        return {
            owner,
            manifestCount: ownerManifest.length,
            blockers: ownerBlockers.length,
            gaps: ownerGaps.length,
            branchDelta: ownerBranchDelta.length,
            attestations: ownerAttestations.length,
            issues: openIssues,
            readiness,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            ready: rows.filter((row) => row.readiness === 'ready').length,
            review: rows.filter((row) => row.readiness === 'review').length,
            blocked: rows.filter((row) => row.readiness === 'blocked').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalOwnerVerdicts;
