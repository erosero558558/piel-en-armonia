export function buildTurneroReleaseWiringTruthMatrix(input = {}) {
    const surfaces = Array.isArray(input.surfaces) ? input.surfaces : [];
    const compareRows = Array.isArray(input.compareRows)
        ? input.compareRows
        : [];

    const rows = surfaces.map((surface, index) => {
        const surfaceId = surface.id || `surface-${index + 1}`;
        const relevant = compareRows.filter(
            (row) =>
                row.surface === surfaceId || row.actualSurface === surfaceId
        );
        const present = relevant.filter(
            (row) => row.state === 'present'
        ).length;
        const expected = relevant.length;
        const truthPct =
            expected > 0 ? Number(((present / expected) * 100).toFixed(1)) : 0;
        const state =
            truthPct >= 90 ? 'strong' : truthPct >= 70 ? 'watch' : 'partial';
        return {
            surfaceId,
            label: surface.label || `Surface ${index + 1}`,
            expected,
            present,
            truthPct,
            state,
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
