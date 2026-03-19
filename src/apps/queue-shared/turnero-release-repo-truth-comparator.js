export function buildTurneroReleaseRepoTruthComparator(input = {}) {
    const expectedRows = Array.isArray(input.expectedRows)
        ? input.expectedRows
        : [];
    const actualRows = Array.isArray(input.actualRows) ? input.actualRows : [];

    const rows = expectedRows.map((expected) => {
        const actual = actualRows.find(
            (item) =>
                item.key === expected.key || item.domain === expected.domain
        );
        const state =
            actual && actual.mounted
                ? 'present'
                : actual
                  ? 'partial'
                  : 'missing';
        return {
            key: expected.key,
            label: expected.label,
            domain: expected.domain,
            surface: expected.surface,
            expectedPriority: expected.priority,
            actualSurface: actual?.surface || '',
            mounted: Boolean(actual?.mounted),
            commitRef: actual?.commitRef || '',
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            present: rows.filter((row) => row.state === 'present').length,
            partial: rows.filter((row) => row.state === 'partial').length,
            missing: rows.filter((row) => row.state === 'missing').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
