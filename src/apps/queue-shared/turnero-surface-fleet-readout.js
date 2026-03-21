import {
    asObject,
    formatTimestamp,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

function resolveSurfaceLabel(surfaceKey) {
    const normalized = toString(surfaceKey, 'surface').toLowerCase();
    return (
        {
            admin: 'Admin',
            operator: 'Operador',
            kiosk: 'Kiosco',
            display: 'Sala TV',
        }[normalized] || toString(surfaceKey, 'surface')
    );
}

function buildSummary(gateBand, gateDecision) {
    if (gateBand === 'ready') {
        return `Fleet readiness aligned · ${gateBand} · ${gateDecision}`;
    }
    return `Fleet readiness visible · ${gateBand} · ${gateDecision}`;
}

function buildDetail(snapshot, gate) {
    const checklistAll = Number(gate.checklistSummary?.all || 0) || 0;
    const checklistPass = Number(gate.checklistSummary?.pass || 0) || 0;
    const checklistFragment =
        checklistAll > 0 ? `${checklistPass}/${checklistAll}` : '0/0';

    return [
        `Surface ${resolveSurfaceLabel(snapshot.surfaceKey)}`,
        `Clinic ${toString(snapshot.clinicLabel || snapshot.clinicId, 'n/a')}`,
        `Region ${toString(snapshot.region, 'regional')}`,
        `Wave ${toString(snapshot.waveLabel, 'none')}`,
        `Owner ${toString(snapshot.fleetOwner, 'unassigned')}`,
        `Batch ${toString(snapshot.rolloutBatch, 'unassigned')}`,
        `Docs ${toString(snapshot.documentationState, 'draft')}`,
        `Checklist ${checklistFragment}`,
    ].join(' · ');
}

function buildBrief(state) {
    const lines = [
        '# Surface Fleet Readiness',
        '',
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey)}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Region: ${toString(state.region, 'regional')}`,
        `Wave: ${toString(state.waveLabel, 'none')}`,
        `Fleet owner: ${toString(state.fleetOwner, 'unassigned')}`,
        `Rollout batch: ${toString(state.rolloutBatch, 'unassigned')}`,
        `Documentation: ${toString(state.documentationState, 'draft')}`,
        `Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `Truth: ${toString(state.truth, 'unknown')}`,
        `Gate: ${toString(state.gateBand, 'unknown')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'review')}`,
        '',
        '## Checklist',
    ];

    if (state.checklistChecks.length === 0) {
        lines.push('- Sin checklist visible.');
    } else {
        state.checklistChecks.forEach((check) => {
            lines.push(
                `- [${check.pass ? 'x' : ' '}] ${toString(
                    check.label || check.key,
                    'Check'
                )}`
            );
        });
    }

    lines.push('', '## Waves');
    if (state.waves.length === 0) {
        lines.push('- Sin wave items.');
    } else {
        state.waves.slice(0, 8).forEach((wave) => {
            lines.push(
                `- [${toString(wave.status, 'planned')}] ${toString(
                    wave.surfaceKey,
                    'surface'
                )} · ${toString(wave.title || wave.waveLabel, 'Wave item')} · ${toString(
                    wave.owner,
                    'ops'
                )} · ${toString(wave.note, '')}`
            );
        });
    }

    lines.push('', '## Owners');
    if (state.owners.length === 0) {
        lines.push('- Sin owner items.');
    } else {
        state.owners.slice(0, 8).forEach((owner) => {
            lines.push(
                `- [${toString(owner.status, 'active')}] ${toString(
                    owner.surfaceKey,
                    'surface'
                )} · ${toString(owner.actor || owner.owner, 'owner')} · ${toString(
                    owner.role,
                    'regional'
                )} · ${toString(owner.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceFleetReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = asObject(input.checklist);
    const waves = toArray(input.waves);
    const owners = toArray(input.owners);
    const checklistChecks = toArray(checklist.checks);
    const gateBand = toString(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;
    const gateDecision = toString(gate.decision, 'review');
    const surfaceLabel = resolveSurfaceLabel(snapshot.surfaceKey);
    const clinicLabel = toString(snapshot.clinicLabel || snapshot.clinicId, '');

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel,
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel,
        region: toString(snapshot.region, 'regional'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        waveLabel: toString(snapshot.waveLabel, 'none'),
        fleetOwner: toString(snapshot.fleetOwner, 'unassigned'),
        rolloutBatch: toString(snapshot.rolloutBatch, 'unassigned'),
        documentationState: toString(snapshot.documentationState, 'draft'),
        checklistAll:
            Number(gate.checklistSummary?.all || checklist.summary?.all || 0) ||
            0,
        checklistPass:
            Number(
                gate.checklistSummary?.pass || checklist.summary?.pass || 0
            ) || 0,
        checklistFail:
            Number(
                gate.checklistSummary?.fail || checklist.summary?.fail || 0
            ) || 0,
        waveCount: Number(gate.waveCount || waves.length || 0) || 0,
        ownerCount: Number(gate.ownerCount || owners.length || 0) || 0,
        gateBand,
        gateScore,
        gateDecision,
        title:
            gateBand === 'ready'
                ? 'Fleet readiness aligned'
                : 'Fleet readiness visible',
        summary: buildSummary(gateBand, gateDecision),
        detail: buildDetail(snapshot, gate),
        checkpoints: [
            {
                label: 'Wave',
                value: toString(snapshot.waveLabel, 'none'),
                state: toString(snapshot.waveLabel, '') ? 'ready' : 'warning',
            },
            {
                label: 'Owner',
                value: toString(snapshot.fleetOwner, 'unassigned'),
                state: toString(snapshot.fleetOwner, '') ? 'ready' : 'warning',
            },
            {
                label: 'Batch',
                value: toString(snapshot.rolloutBatch, 'unassigned'),
                state:
                    toString(snapshot.rolloutBatch, 'unassigned') !==
                    'unassigned'
                        ? 'ready'
                        : 'warning',
            },
            {
                label: 'Docs',
                value: toString(snapshot.documentationState, 'draft'),
                state:
                    toString(snapshot.documentationState, 'draft') === 'ready'
                        ? 'ready'
                        : toString(snapshot.documentationState, 'draft') ===
                            'draft'
                          ? 'warning'
                          : 'alert',
            },
            {
                label: 'Score',
                value: String(gateScore),
                state:
                    gateBand === 'ready'
                        ? 'ready'
                        : gateBand === 'watch'
                          ? 'warning'
                          : 'alert',
            },
        ],
        brief: buildBrief({
            ...snapshot,
            surfaceLabel,
            checklistChecks,
            waves,
            owners,
            gateBand,
            gateScore,
            gateDecision,
        }),
        generatedAt: new Date().toISOString(),
    };
}
