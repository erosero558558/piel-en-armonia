function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function iso(value) {
    return value.toISOString();
}

function resolvePresetList(context = {}) {
    if (Array.isArray(context.presets)) {
        return context.presets.filter(Boolean);
    }

    if (Array.isArray(context.presets?.presets)) {
        return context.presets.presets.filter(Boolean);
    }

    return [];
}

export function buildWaveCalendar(context = {}) {
    const presets = resolvePresetList(context);
    const preset = presets.find((item) => item.id === context.activePresetId) ||
        presets[0] || {
            id: 'stabilize-core',
            label: 'Stabilize Core',
            targetCohorts: ['pilot'],
            trafficPercent: 15,
        };
    const topOwner = context.capacity?.topOwnerRisk?.owner || 'ops-owner';
    const topRegion = context.capacity?.topRegionRisk?.region || 'portfolio';
    const base = new Date();
    const windows = [
        { label: 'hoy-am', offset: 2 },
        { label: 'hoy-pm', offset: 8 },
        { label: 'mañana-am', offset: 20 },
        { label: 'mañana-pm', offset: 30 },
        { label: 'siguiente-turno', offset: 42 },
        { label: 'ventana-extendida', offset: 54 },
    ].map((slot, index) => {
        const start = addHours(base, slot.offset);
        const traffic = Math.max(
            5,
            Math.min(80, Number(preset?.trafficPercent || 15) + index * 2)
        );
        const targetTrafficPercent = Number.isFinite(
            Number(context.store?.trafficLimitPercent)
        )
            ? Math.max(
                  0,
                  Math.min(100, Number(context.store.trafficLimitPercent))
              )
            : traffic;
        const goNoGoHint = context.store?.freeze
            ? 'hold'
            : context.forecast?.recommendedDecision === 'promote' && index < 3
              ? 'go-candidate'
              : index < 2
                ? 'review'
                : 'conditional';

        return {
            id: slot.label,
            windowLabel: slot.label,
            startAt: iso(start),
            targetCohort:
                preset?.targetCohorts?.[
                    Math.min(index, (preset?.targetCohorts?.length || 1) - 1)
                ] || 'pilot',
            targetTrafficPercent,
            requiredOwners: [topOwner, 'backup-owner'],
            riskNotes: [
                `Region foco: ${topRegion}`,
                `Preset: ${preset?.label || 'custom'}`,
                context.store?.freeze
                    ? 'Freeze local activo'
                    : 'Sin freeze local',
            ],
            goNoGoHint,
        };
    });

    return {
        presetId: preset?.id || null,
        windows,
        summary: windows
            .map(
                (item) =>
                    `${item.windowLabel} | ${item.targetCohort} | ${item.targetTrafficPercent}% | ${item.goNoGoHint}`
            )
            .join('\n'),
    };
}
