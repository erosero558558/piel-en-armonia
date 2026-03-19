function scorePreset(preset, context = {}) {
    const clinicsCount = context.presets?.clinicsCount || 1;
    const capacityRisk = context.capacity?.topOwnerRisk?.queuePressure || 0;
    const regionFragility =
        context.capacity?.topRegionRisk?.singlePointRisk === 'high' ? 15 : 5;
    const freezePenalty = context.store?.freeze ? 20 : 0;
    const debt = Math.max(
        0,
        Math.round(capacityRisk + regionFragility + freezePenalty)
    );
    const promotable = Math.max(
        1,
        Math.min(preset.clinicCap, clinicsCount - Math.ceil(debt / 10))
    );
    const rollbackExposure =
        preset.rollbackPosture === 'regional-rollback-ready'
            ? 'high'
            : preset.rollbackPosture === 'selective-rollback'
              ? 'medium'
              : 'low';
    const aggregatedRisk =
        preset.riskTolerance === 'very-low'
            ? 'low'
            : preset.riskTolerance === 'low'
              ? debt > 25
                  ? 'medium'
                  : 'low'
              : preset.riskTolerance === 'medium'
                ? debt > 35
                    ? 'high'
                    : 'medium'
                : debt > 20
                  ? 'high'
                  : 'medium';

    const recommendedDecision = context.store?.freeze
        ? 'hold'
        : aggregatedRisk === 'high'
          ? 'review'
          : promotable >= Math.ceil(clinicsCount * 0.5)
            ? 'promote'
            : 'review';

    return {
        presetId: preset.id,
        label: preset.label,
        promotableClinics: promotable,
        aggregatedRisk,
        operationalDebt: debt,
        requiredOwners: preset.minimumCoverage,
        rollbackExposure,
        approvalsPending: preset.approvalsRequired,
        recommendedDecision,
    };
}

function resolvePresetList(context = {}) {
    if (Array.isArray(context.presets)) {
        return context.presets.filter(Boolean);
    }

    if (Array.isArray(context.presets?.presets)) {
        return context.presets.presets.filter(Boolean);
    }

    const clinicsCount = context.capacity?.clinics?.length || 1;
    const fallbackPresetId =
        context.activePresetId || context.store?.presetId || 'stabilize-core';

    return [
        {
            id: fallbackPresetId,
            label:
                fallbackPresetId === 'regional-expand'
                    ? 'Regional Expand'
                    : fallbackPresetId === 'aggressive-scale'
                      ? 'Aggressive Scale'
                      : fallbackPresetId === 'rollback-contain'
                        ? 'Rollback Contain'
                        : 'Stabilize Core',
            targetCohorts: ['pilot'],
            clinicCap: Math.max(1, clinicsCount),
            trafficPercent: Number.isFinite(
                Number(context.store?.trafficLimitPercent)
            )
                ? Number(context.store.trafficLimitPercent)
                : 15,
            riskTolerance: 'low',
            approvalsRequired: 1,
            minimumCoverage: 'single-clinic coverage',
            rollbackPosture: 'instant-hold',
            notes: ['Fallback preset sintetizado.'],
        },
    ];
}

export function buildPortfolioForecast(context = {}) {
    const presets = resolvePresetList(context);
    const forecasts = presets.map((preset) => scorePreset(preset, context));

    const rank = (item) => {
        const decisionScore =
            item.recommendedDecision === 'promote'
                ? 3
                : item.recommendedDecision === 'review'
                  ? 2
                  : item.recommendedDecision === 'hold'
                    ? 1
                    : 0;
        return (
            decisionScore * 1000 +
            item.promotableClinics * 10 -
            item.operationalDebt
        );
    };

    const active =
        forecasts.find((item) => item.presetId === context.activePresetId) ||
        forecasts[0] ||
        null;
    const best = forecasts.length
        ? [...forecasts].sort((a, b) => rank(b) - rank(a))[0]
        : null;

    const recommendedDecision = context.store?.freeze
        ? 'hold'
        : active?.recommendedDecision || best?.recommendedDecision || 'review';

    return {
        active,
        best,
        forecasts,
        recommendedDecision,
        summary: forecasts
            .map(
                (item) =>
                    `${item.label} | ${item.recommendedDecision} | clinics=${item.promotableClinics} | debt=${item.operationalDebt}`
            )
            .join('\n'),
    };
}
