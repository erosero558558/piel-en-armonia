export function buildTurneroReleaseDriftWatchlist(input = {}) {
    const compareRows = Array.isArray(input.compareRows)
        ? input.compareRows
        : [];
    const provenance = Array.isArray(input.provenance) ? input.provenance : [];

    const rows = compareRows
        .filter((row) => row.state !== 'present' || !row.commitRef)
        .map((row, index) => {
            const prov = provenance.find((item) => item.moduleKey === row.key);
            const driftKind =
                row.state === 'missing'
                    ? 'missing-module'
                    : !row.commitRef && prov?.commitRef
                      ? 'commit-not-linked'
                      : row.state === 'partial'
                        ? 'partial-wiring'
                        : 'watch';
            return {
                id: `drift-${index + 1}`,
                key: row.key,
                label: row.label,
                domain: row.domain,
                driftKind,
                owner: prov?.owner || 'program',
                severity: driftKind === 'missing-module' ? 'high' : 'medium',
            };
        });

    return {
        rows,
        summary: {
            all: rows.length,
            high: rows.filter((row) => row.severity === 'high').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
