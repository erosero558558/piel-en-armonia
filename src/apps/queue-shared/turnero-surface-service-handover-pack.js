import { buildTurneroSurfaceServiceHandoverSnapshot } from './turnero-surface-service-handover-snapshot.js';
import { buildTurneroSurfaceServiceHandoverGate } from './turnero-surface-service-handover-gate.js';
import { buildTurneroSurfaceServiceHandoverReadout } from './turnero-surface-service-handover-readout.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChecklist(input = {}) {
    const checklist = asObject(input.checklist);
    const summary = asObject(checklist.summary);
    return {
        checks: toArray(checklist.checks).map((item) => ({
            ...asObject(item),
        })),
        summary: {
            all: Number(summary.all || 0) || 0,
            pass: Number(summary.pass || 0) || 0,
            fail: Number(summary.fail || 0) || 0,
        },
    };
}

export function buildTurneroSurfaceServiceHandoverPack(input = {}) {
    const snapshot = buildTurneroSurfaceServiceHandoverSnapshot(input);
    const checklist = normalizeChecklist(input);
    const playbook = toArray(input.playbook).map((item) => ({
        ...asObject(item),
    }));
    const roster = toArray(input.roster).map((item) => ({ ...asObject(item) }));
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceServiceHandoverGate({
                  snapshot,
                  snapshots: input.snapshots,
                  checklist,
                  playbook,
                  roster,
              });
    const readout = buildTurneroSurfaceServiceHandoverReadout({
        snapshot,
        checklist,
        playbook,
        roster,
        gate,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        playbook,
        roster,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
