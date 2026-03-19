function buildDrill(id, title, owner, risk, context = {}) {
    const region = context.capacity?.topRegionRisk?.region || 'portfolio';
    const hotspotOwner = context.capacity?.topOwnerRisk?.owner || owner;

    return {
        id,
        title,
        owner,
        risk,
        riskNotes: [
            `Owner hotspot: ${hotspotOwner}`,
            `Region hotspot: ${region}`,
            `Risk posture: ${risk}`,
        ],
        prechecks: [
            'capturar snapshot actual',
            'confirmar clinicId/profileFingerprint',
            'validar señales del panel admin queue',
        ],
        steps: [
            `aislar impacto en ${region}`,
            'ejecutar recheck / refresh del paquete remoto',
            'comparar against baseline/control tower',
            'decidir hold/review/promote según evidencia',
        ],
        rollbackSteps: [
            'congelar expansión de la cohorte afectada',
            'reducir tráfico al preset seguro',
            'preparar handoff de owner si persiste',
        ],
        evidenceChecklist: [
            'brief copiado',
            'json exportado',
            'incidente etiquetado por owner',
            'estado actualizado en war room',
        ],
    };
}

export function buildOutageDrillMatrix(context = {}) {
    const drills = [
        buildDrill(
            'public-shell-drift',
            'Public Shell Drift',
            'frontend-runtime',
            'high',
            context
        ),
        buildDrill(
            'health-redacted',
            'Health Redacted / Missing Checks',
            'backend-platform',
            'high',
            context
        ),
        buildDrill(
            'public-sync-missing',
            'Public Sync Missing',
            'deploy-ops',
            'medium',
            context
        ),
        buildDrill(
            'figo-degraded',
            'FIGO Degraded',
            'backend-integrations',
            'medium',
            context
        ),
        buildDrill(
            'coverage-collapse',
            'Coverage Collapse',
            'regional-ops',
            'high',
            context
        ),
        buildDrill(
            'approval-backlog',
            'Approval Backlog',
            'release-governance',
            'medium',
            context
        ),
    ];

    const prioritized = drills.map((drill, index) => ({
        ...drill,
        priority: index < 2 ? 'p1' : index < 4 ? 'p2' : 'p3',
    }));

    return {
        drills: prioritized,
        summary: prioritized
            .map(
                (item) =>
                    `${item.priority} | ${item.title} | owner=${item.owner}`
            )
            .join('\n'),
        topDrill: prioritized[0],
    };
}
