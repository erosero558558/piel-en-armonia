function fallbackNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function buildPreset({
    id,
    label,
    targetCohorts,
    clinicCap,
    trafficPercent,
    riskTolerance,
    approvalsRequired,
    minimumCoverage,
    rollbackPosture,
    notes,
}) {
    return {
        id,
        label,
        targetCohorts,
        clinicCap,
        trafficPercent,
        riskTolerance,
        approvalsRequired,
        minimumCoverage,
        rollbackPosture,
        notes,
    };
}

export function buildScenarioPresets(context = {}) {
    const clinics = Array.isArray(context.rollout?.registry?.clinics)
        ? context.rollout.registry.clinics
        : Array.isArray(context.clinics)
          ? context.clinics
          : [];
    const clinicsCount = clinics.length || 1;
    const singleClinic = clinicsCount <= 1;
    const baselineTraffic = fallbackNumber(
        context.rollout?.simulator?.recommendedScenario?.trafficPercent,
        15
    );
    const readyCount = Math.max(
        0,
        Math.min(
            clinicsCount,
            fallbackNumber(
                context.rollout?.scoreboard?.summaryCounts?.ready,
                singleClinic ? 1 : Math.ceil(clinicsCount / 3)
            )
        )
    );
    const reviewCount = Math.max(
        0,
        Math.min(
            Math.max(0, clinicsCount - readyCount),
            fallbackNumber(
                context.rollout?.scoreboard?.summaryCounts?.review,
                singleClinic ? 0 : Math.ceil(clinicsCount / 3)
            )
        )
    );
    const holdCount = Math.max(
        0,
        fallbackNumber(
            context.rollout?.scoreboard?.summaryCounts?.hold,
            clinicsCount - readyCount - reviewCount
        )
    );

    const presets = [
        buildPreset({
            id: 'stabilize-core',
            label: 'Stabilize Core',
            targetCohorts: ['pilot', 'wave-1'],
            clinicCap: Math.max(1, Math.ceil(clinicsCount * 0.35)),
            trafficPercent: Math.max(10, Math.min(25, baselineTraffic)),
            riskTolerance: 'low',
            approvalsRequired: Math.max(
                1,
                Math.ceil((readyCount + reviewCount) / 4)
            ),
            minimumCoverage: '2 owners por región activa',
            rollbackPosture: 'instant-hold',
            notes: [
                'Prioriza estabilizar clínicas listas.',
                `Mantiene holdouts fuera de expansión si hold=${holdCount}.`,
            ],
        }),
        buildPreset({
            id: 'regional-expand',
            label: 'Regional Expand',
            targetCohorts: ['pilot', 'wave-1', 'wave-2'],
            clinicCap: Math.max(2, Math.ceil(clinicsCount * 0.6)),
            trafficPercent: Math.max(20, Math.min(40, baselineTraffic + 10)),
            riskTolerance: 'medium',
            approvalsRequired: Math.max(
                2,
                Math.ceil((readyCount + reviewCount) / 3)
            ),
            minimumCoverage: 'owner primario + backup por región',
            rollbackPosture: 'selective-rollback',
            notes: [
                'Expande por cohortes con control regional.',
                'Requiere seguimiento de approvals y coverage regional.',
            ],
        }),
        buildPreset({
            id: 'aggressive-scale',
            label: 'Aggressive Scale',
            targetCohorts: ['pilot', 'wave-1', 'wave-2', 'wave-3'],
            clinicCap: Math.max(1, clinicsCount),
            trafficPercent: Math.max(35, Math.min(70, baselineTraffic + 25)),
            riskTolerance: 'high',
            approvalsRequired: Math.max(3, Math.ceil(clinicsCount / 3)),
            minimumCoverage: 'cobertura reforzada 24/7 por owner',
            rollbackPosture: 'regional-rollback-ready',
            notes: [
                'Solo usar con heatmap limpio y debt controlada.',
                'Exige rehearsals de rollback y backlog de approvals bajo.',
            ],
        }),
        buildPreset({
            id: 'rollback-contain',
            label: 'Rollback Contain',
            targetCohorts: ['pilot'],
            clinicCap: Math.max(1, Math.ceil(clinicsCount * 0.2)),
            trafficPercent: Math.max(5, Math.min(15, baselineTraffic - 5)),
            riskTolerance: 'very-low',
            approvalsRequired: 1,
            minimumCoverage: 'owner crítico disponible',
            rollbackPosture: 'global-freeze-ready',
            notes: [
                'Modo contención ante drift o outage repetido.',
                'Mantener solo el mínimo portfolio en línea.',
            ],
        }),
    ];

    return {
        generatedAt: new Date().toISOString(),
        clinicsCount,
        readyCount,
        reviewCount,
        holdCount,
        presets,
        recommendedPresetId: singleClinic
            ? 'stabilize-core'
            : holdCount > Math.max(1, Math.ceil(clinicsCount * 0.25))
              ? 'rollback-contain'
              : reviewCount > readyCount
                ? 'stabilize-core'
                : 'regional-expand',
    };
}
