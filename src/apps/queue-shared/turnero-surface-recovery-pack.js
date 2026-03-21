import { createTurneroSurfaceRecoveryActionStore } from './turnero-surface-recovery-action-store.js';
import { buildTurneroSurfaceContractReadout } from './turnero-surface-contract-readout.js';
import { buildTurneroSurfaceContractDrift } from './turnero-surface-contract-drift.js';
import {
    buildTurneroSurfaceContractSnapshot,
    normalizeTurneroSurfaceRecoveryKey,
} from './turnero-surface-contract-snapshot.js';
import { buildTurneroSurfaceRecoveryGate } from './turnero-surface-recovery-gate.js';
import { asObject, toString } from './turnero-surface-helpers.js';

function resolveActions(actionStore, surfaceKey, inputActions) {
    if (Array.isArray(inputActions) && inputActions.length > 0) {
        return inputActions;
    }

    return actionStore.list({ surfaceKey, includeClosed: true });
}

function resolveStorageInfo(actionStore, surfaceKey, inputStorageInfo) {
    if (inputStorageInfo && typeof inputStorageInfo === 'object') {
        return inputStorageInfo;
    }

    return actionStore.snapshot({ surfaceKey });
}

export function buildTurneroSurfaceRecoveryPack(input = {}) {
    const profile = asObject(input.clinicProfile || input.profile);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        input.surfaceKey || input.surface || 'operator'
    );
    const currentRoute = toString(input.currentRoute || input.route);
    const actionStore =
        input.actionStore && typeof input.actionStore.list === 'function'
            ? input.actionStore
            : createTurneroSurfaceRecoveryActionStore(profile, {
                  storageKey: input.storageKey,
              });
    const actions = resolveActions(actionStore, surfaceKey, input.actions);
    const storageInfo = resolveStorageInfo(
        actionStore,
        surfaceKey,
        input.storageInfo
    );
    const snapshot = buildTurneroSurfaceContractSnapshot({
        ...input,
        clinicProfile: profile,
        surfaceKey,
        currentRoute,
        actions,
        storageInfo,
    });
    const drift = buildTurneroSurfaceContractDrift({
        snapshot,
        actions,
    });
    const gate = buildTurneroSurfaceRecoveryGate({
        snapshot,
        drift,
        actions,
    });
    const readout = buildTurneroSurfaceContractReadout({
        snapshot,
        drift,
        gate,
        readiness: snapshot.readiness,
    });

    return {
        surfaceKey,
        surfaceToken: snapshot.surfaceToken,
        snapshot,
        drift,
        gate,
        readout,
        actions,
        contract: snapshot.contract,
        readiness: snapshot.readiness,
        storage: snapshot.storage,
        runtime: snapshot.runtime,
        heartbeat: snapshot.heartbeat,
        actionStore,
        generatedAt: snapshot.generatedAt,
    };
}

export { buildTurneroSurfaceRecoveryPack as buildTurneroSurfaceContractRecoveryPack };
