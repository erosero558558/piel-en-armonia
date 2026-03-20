export function buildTurneroReleaseFinalDiagnosisLaunchManifest(input = {}) {
    const items = (Array.isArray(input.items) && input.items.length > 0
        ? input.items
        : Array.isArray(input.rows) && input.rows.length > 0
          ? input.rows
          : null) || [
        {
            key: 'evidence-lock',
            label: 'Evidence Lock',
            owner: 'program',
            criticality: 'critical',
        },
        {
            key: 'owner-signoff',
            label: 'Owner Signoff',
            owner: 'program',
            criticality: 'critical',
        },
        {
            key: 'blocker-freeze',
            label: 'Blocker Freeze',
            owner: 'program',
            criticality: 'critical',
        },
        {
            key: 'runtime-truth',
            label: 'Runtime Truth',
            owner: 'infra',
            criticality: 'high',
        },
        {
            key: 'surface-handoff',
            label: 'Surface Handoff',
            owner: 'ops',
            criticality: 'high',
        },
        {
            key: 'final-readout',
            label: 'Final Readout',
            owner: 'program',
            criticality: 'critical',
        },
    ];

    const rows = items.map((item, index) => ({
        id: item.id || `launch-item-${index + 1}`,
        key: item.key || `launch-item-${index + 1}`,
        label: item.label || `Launch Item ${index + 1}`,
        owner: item.owner || 'program',
        criticality: item.criticality || 'high',
    }));

    return {
        rows,
        summary: {
            all: rows.length,
            critical: rows.filter((row) => row.criticality === 'critical')
                .length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export const buildTurneroReleaseFinalDiagnosticLaunchManifest =
    buildTurneroReleaseFinalDiagnosisLaunchManifest;

export default buildTurneroReleaseFinalDiagnosisLaunchManifest;
