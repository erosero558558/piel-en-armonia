function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChecklist(input = {}) {
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : input;
    const summary =
        checklist.summary && typeof checklist.summary === 'object'
            ? checklist.summary
            : {};
    const checks = toArray(checklist.checks);

    const all = Number(summary.all || checks.length || 0) || 0;
    const pass =
        Number(
            summary.pass || checks.filter((item) => item.pass === true).length
        ) || 0;
    const fail =
        Number(
            summary.fail || checks.filter((item) => item.pass !== true).length
        ) || 0;

    return {
        checks,
        summary: {
            all,
            pass,
            fail,
        },
    };
}

function normalizeWaveStatus(value) {
    const normalized = toString(value, 'planned').toLowerCase();
    if (['ready', 'planned', 'scheduled', 'done'].includes(normalized)) {
        return normalized;
    }
    if (['active', 'live'].includes(normalized)) {
        return 'ready';
    }
    if (['paused', 'blocked', 'hold'].includes(normalized)) {
        return 'paused';
    }
    return 'planned';
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'ready', 'primary'].includes(normalized)) {
        return 'active';
    }
    if (['paused', 'hold', 'suspended'].includes(normalized)) {
        return 'paused';
    }
    if (['inactive', 'retired', 'done', 'closed'].includes(normalized)) {
        return 'inactive';
    }
    return 'active';
}

function resolveReadyWaves(waves = []) {
    return toArray(waves).filter((item) => {
        const status = normalizeWaveStatus(item?.status);
        return ['ready', 'planned', 'scheduled', 'done'].includes(status);
    }).length;
}

function resolveActiveOwners(owners = []) {
    return toArray(owners).filter(
        (item) => normalizeOwnerStatus(item?.status) === 'active'
    ).length;
}

export function buildTurneroSurfaceFleetGate(input = {}) {
    const checklist = normalizeChecklist(input.checklist || input);
    const waves = toArray(input.waves);
    const owners = toArray(input.owners);
    const readyWaves = resolveReadyWaves(waves);
    const activeOwners = resolveActiveOwners(owners);
    const checklistPct =
        checklist.summary.all > 0
            ? (checklist.summary.pass / checklist.summary.all) * 100
            : 0;
    const wavesPct = waves.length > 0 ? (readyWaves / waves.length) * 100 : 0;
    const ownersPct =
        owners.length > 0 ? (activeOwners / owners.length) * 100 : 0;

    let score = 0;
    score += checklistPct * 0.55;
    score += wavesPct * 0.25;
    score += ownersPct * 0.2;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        checklist.summary.fail >= 2
            ? 'blocked'
            : score >= 90
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'fleet-ready'
                : band === 'watch'
                  ? 'review-wave-plan'
                  : 'hold-fleet-expansion',
        checklistSummary: {
            all: checklist.summary.all,
            pass: checklist.summary.pass,
            fail: checklist.summary.fail,
        },
        checklistPassRate: checklistPct,
        waveCount: waves.length,
        readyWaveCount: readyWaves,
        ownerCount: owners.length,
        activeOwnerCount: activeOwners,
        generatedAt: new Date().toISOString(),
    };
}
