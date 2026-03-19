export function buildTurneroReleaseActualRepoIntake(input = {}) {
    const actual = Array.isArray(input.actualModules)
        ? input.actualModules
        : [];
    const rows = actual.map((item, index) => ({
        id: item.id || `actual-${index + 1}`,
        key: item.key || `actual-${index + 1}`,
        label: item.label || `Actual Module ${index + 1}`,
        domain: item.domain || 'general',
        surface: item.surface || 'admin-queue',
        mounted: Boolean(item.mounted ?? true),
        sourcePath: item.sourcePath || '',
        commitRef: item.commitRef || '',
    }));

    return {
        rows,
        summary: {
            all: rows.length,
            mounted: rows.filter((row) => row.mounted).length,
            withCommitRef: rows.filter((row) => Boolean(row.commitRef)).length,
        },
        generatedAt: new Date().toISOString(),
    };
}
