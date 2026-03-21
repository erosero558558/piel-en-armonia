import { createTurneroSurfaceOperatorAckStore } from './turnero-surface-operator-ack-store.js';
import { createTurneroSurfaceTrainingLedger } from './turnero-surface-training-ledger.js';
import { buildTurneroSurfaceAdoptionGate } from './turnero-surface-adoption-gate.js';
import { buildTurneroSurfaceAdoptionReadout } from './turnero-surface-adoption-readout.js';
import { buildTurneroSurfaceAdoptionSnapshot } from './turnero-surface-adoption-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function resolveTrainingLedger(input = {}, scope, clinicProfile) {
    if (
        input.trainingLedger &&
        typeof input.trainingLedger.list === 'function'
    ) {
        return input.trainingLedger;
    }
    return createTurneroSurfaceTrainingLedger(scope, clinicProfile);
}

function resolveAckStore(input = {}, scope, clinicProfile) {
    if (input.ackStore && typeof input.ackStore.list === 'function') {
        return input.ackStore;
    }
    return createTurneroSurfaceOperatorAckStore(scope, clinicProfile);
}

function resolveEntries(list, surfaceKey, kind) {
    return toArray(list({ surfaceKey })).map((entry) => ({
        ...entry,
        kind: toString(entry.kind, kind),
    }));
}

export function buildTurneroSurfaceAdoptionPack(input = {}) {
    const clinicProfile = asObject(input.clinicProfile || input.profile);
    const scope = toString(input.scope, 'regional') || 'regional';
    const surfaceKey = toString(
        input.surfaceKey || input.surface || 'operator',
        'operator'
    );
    const trainingLedger = resolveTrainingLedger(input, scope, clinicProfile);
    const ackStore = resolveAckStore(input, scope, clinicProfile);
    const trainingEntries =
        Array.isArray(input.trainingEntries) && input.trainingEntries.length > 0
            ? input.trainingEntries
            : resolveEntries(
                  trainingLedger.list.bind(trainingLedger),
                  surfaceKey,
                  'training'
              );
    const ackEntries =
        Array.isArray(input.ackEntries) && input.ackEntries.length > 0
            ? input.ackEntries
            : resolveEntries(ackStore.list.bind(ackStore), surfaceKey, 'ack');
    const snapshot = buildTurneroSurfaceAdoptionSnapshot({
        ...input,
        scope,
        clinicProfile,
        surfaceKey,
        trainingEntries,
        ackEntries,
    });
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band || 'watch'),
                  decision: toString(
                      input.gate.decision || 'review-adoption-evidence'
                  ),
                  score: Number(input.gate.score || 0) || 0,
              }
            : buildTurneroSurfaceAdoptionGate({ snapshot });
    const readout = buildTurneroSurfaceAdoptionReadout({
        snapshot,
        gate,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        surfaceId: snapshot.surfaceId,
        surfaceToken: snapshot.surfaceToken,
        snapshot,
        gate,
        readout,
        score: gate.score,
        band: gate.band,
        decision: gate.decision,
        chips: readout.chips,
        trainingEntries,
        ackEntries,
        trainingLedger,
        ackStore,
        generatedAt: snapshot.generatedAt,
    };
}

export { buildTurneroSurfaceAdoptionPack as buildTurneroSurfaceContractAdoptionPack };
