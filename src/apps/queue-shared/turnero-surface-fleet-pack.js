import { buildTurneroSurfaceFleetSnapshot } from './turnero-surface-fleet-snapshot.js';
import { createTurneroSurfaceFleetOwnerStore } from './turnero-surface-fleet-owner-store.js';
import { createTurneroSurfaceWaveLedger } from './turnero-surface-wave-ledger.js';
import { buildTurneroSurfaceFleetGate } from './turnero-surface-fleet-gate.js';
import { buildTurneroSurfaceFleetReadout } from './turnero-surface-fleet-readout.js';

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChecklist(input = {}) {
    if (input.checklist && typeof input.checklist === 'object') {
        return input.checklist;
    }

    return {
        summary: {
            all: 6,
            pass: 4,
            fail: 2,
        },
    };
}

function resolveWaveLabel(snapshot, waves = []) {
    if (snapshot.waveLabel) {
        return snapshot.waveLabel;
    }

    const latest = waves[0] || {};
    return (
        latest.waveLabel ||
        latest.title ||
        latest.label ||
        snapshot.waveLabel ||
        ''
    );
}

function resolveFleetOwner(snapshot, owners = []) {
    if (snapshot.fleetOwner) {
        return snapshot.fleetOwner;
    }

    const latest = owners[0] || {};
    return (
        latest.actor || latest.owner || latest.name || snapshot.fleetOwner || ''
    );
}

function resolveRolloutBatch(snapshot, waves = []) {
    if (snapshot.rolloutBatch && snapshot.rolloutBatch !== 'unassigned') {
        return snapshot.rolloutBatch;
    }

    const latest = waves[0] || {};
    return (
        latest.batch ||
        latest.rolloutBatch ||
        snapshot.rolloutBatch ||
        'unassigned'
    );
}

function resolveDocumentationState(snapshot, waves = []) {
    if (
        snapshot.documentationState &&
        snapshot.documentationState !== 'draft'
    ) {
        return snapshot.documentationState;
    }

    const latest = waves[0] || {};
    return (
        latest.documentationState ||
        latest.documentation_state ||
        snapshot.documentationState ||
        'draft'
    );
}

export function buildTurneroSurfaceFleetPack(input = {}) {
    const snapshotBase = buildTurneroSurfaceFleetSnapshot(input);
    const scope = snapshotBase.region;
    const waveLedger =
        input.waveLedger && typeof input.waveLedger.list === 'function'
            ? input.waveLedger
            : createTurneroSurfaceWaveLedger(scope, input.clinicProfile);
    const ownerStore =
        input.ownerStore && typeof input.ownerStore.list === 'function'
            ? input.ownerStore
            : createTurneroSurfaceFleetOwnerStore(scope, input.clinicProfile);
    const waves = Array.isArray(input.waves)
        ? toArray(input.waves)
        : toArray(waveLedger.list({ surfaceKey: snapshotBase.surfaceKey }));
    const owners = Array.isArray(input.owners)
        ? toArray(input.owners)
        : toArray(ownerStore.list({ surfaceKey: snapshotBase.surfaceKey }));
    const checklist = normalizeChecklist(input);
    const snapshot = {
        ...snapshotBase,
        waveLabel: resolveWaveLabel(snapshotBase, waves),
        fleetOwner: resolveFleetOwner(snapshotBase, owners),
        rolloutBatch: resolveRolloutBatch(snapshotBase, waves),
        documentationState: resolveDocumentationState(snapshotBase, waves),
    };
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceFleetGate({
                  checklist,
                  waves,
                  owners,
                  snapshot,
              });
    const readout = buildTurneroSurfaceFleetReadout({
        snapshot,
        checklist,
        waves,
        owners,
        gate,
    });

    return {
        scope,
        snapshot,
        checklist,
        waves,
        owners,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
