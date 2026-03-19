function resolvePresetList(context = {}) {
    if (Array.isArray(context.presets)) {
        return context.presets.filter(Boolean);
    }

    if (Array.isArray(context.presets?.presets)) {
        return context.presets.presets.filter(Boolean);
    }

    return [];
}

export function buildExecutivePack(context = {}) {
    const presetList = resolvePresetList(context);
    const activePreset =
        presetList.find((item) => item.id === context.activePresetId) ||
        presetList[0] ||
        context.forecast?.active ||
        context.forecast?.best ||
        null;
    const forecast = context.forecast?.active || context.forecast?.best || null;
    const windows = context.waveCalendar?.windows || [];
    const drills = context.drills?.drills || [];
    const notes = context.store?.notes || '';

    const executiveBrief = [
        'Regional Program Office',
        `Program Office preset: ${activePreset?.label || 'N/A'}`,
        `Decision: ${context.forecast?.recommendedDecision || 'review'}`,
        `Promotable clinics: ${forecast?.promotableClinics ?? 'N/A'}`,
        `Aggregated risk: ${forecast?.aggregatedRisk || 'N/A'}`,
        `Operational debt: ${forecast?.operationalDebt ?? 'N/A'}`,
        `Top owner risk: ${context.capacity?.topOwnerRisk?.owner || 'N/A'}`,
        `Top region risk: ${context.capacity?.topRegionRisk?.region || 'N/A'}`,
        notes ? `Notas: ${notes}` : null,
    ]
        .filter(Boolean)
        .join('\n');

    const operatorBrief = [
        'Agenda operativa inmediata:',
        ...windows
            .slice(0, 4)
            .map(
                (item) =>
                    `- ${item.windowLabel} | cohort=${item.targetCohort} | traffic=${item.targetTrafficPercent}% | ${item.goNoGoHint}`
            ),
    ].join('\n');

    const regionalAgenda = windows
        .map(
            (item) =>
                `${item.windowLabel} | owners=${item.requiredOwners.join(', ')} | risk=${item.riskNotes.join('; ')}`
        )
        .join('\n');
    const drillPlan = drills
        .slice(0, 4)
        .map((item) => `${item.priority} | ${item.title} | owner=${item.owner}`)
        .join('\n');

    return {
        activePreset,
        executiveBrief,
        operatorBrief,
        regionalAgenda,
        drillPlan,
        jsonPack: {
            generatedAt: new Date().toISOString(),
            activePresetId: context.activePresetId || activePreset?.id || null,
            activePreset,
            store: context.store,
            presets: context.presets,
            capacity: context.capacity,
            forecast: context.forecast,
            waveCalendar: context.waveCalendar,
            drills: context.drills,
        },
    };
}
