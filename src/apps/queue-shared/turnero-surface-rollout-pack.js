import { createTurneroSurfaceRolloutLedger } from './turnero-surface-rollout-ledger.js';
import { buildTurneroSurfaceRolloutGate } from './turnero-surface-rollout-gate.js';
import { buildTurneroSurfaceRolloutReadout } from './turnero-surface-rollout-readout.js';
import { buildTurneroSurfaceRolloutSnapshot } from './turnero-surface-rollout-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function resolveLedgerStore(input = {}, clinicProfile = {}, surfaceKey = '') {
    if (
        input.ledgerStore &&
        typeof input.ledgerStore.snapshot === 'function' &&
        typeof input.ledgerStore.list === 'function'
    ) {
        return input.ledgerStore;
    }

    return createTurneroSurfaceRolloutLedger(clinicProfile, {
        storageKey: input.storageKey,
        seed: toArray(input.seedLedger),
        surfaceKey,
    });
}

function resolveLedgerSnapshot(input = {}, ledgerStore, surfaceKey = '') {
    if (input.ledgerSnapshot && typeof input.ledgerSnapshot === 'object') {
        return input.ledgerSnapshot;
    }
    if (input.ledger && typeof input.ledger === 'object') {
        return input.ledger;
    }
    if (ledgerStore && typeof ledgerStore.snapshot === 'function') {
        return ledgerStore.snapshot({ surfaceKey });
    }
    return [];
}

export function buildTurneroSurfaceRolloutPack(input = {}) {
    const clinicProfile = asObject(input.clinicProfile || input.profile);
    const surfaceKey = toString(
        input.surfaceKey || input.surfaceId || input.surface,
        'operator'
    );
    const ledgerStore = resolveLedgerStore(input, clinicProfile, surfaceKey);
    const ledgerSnapshot = resolveLedgerSnapshot(
        input,
        ledgerStore,
        surfaceKey
    );
    const snapshot = buildTurneroSurfaceRolloutSnapshot({
        ...input,
        clinicProfile,
        surfaceKey,
        ledger: ledgerSnapshot,
        ledgerSnapshot,
        ledgerStore,
    });
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : snapshot.checklist;
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceRolloutGate({
                  snapshot,
                  checklist,
                  ledger: snapshot.ledger,
                  runtimeState: snapshot.runtimeState,
                  manifest: snapshot.manifest,
                  contract: snapshot.contract,
                  registryState: snapshot.registryState,
                  truth: snapshot.truth,
              });
    const readout =
        input.readout && typeof input.readout === 'object'
            ? input.readout
            : buildTurneroSurfaceRolloutReadout({
                  snapshot,
                  checklist,
                  gate,
                  ledger: snapshot.ledger,
                  manifest: snapshot.manifest,
              });

    return {
        snapshot,
        checklist,
        ledger: snapshot.ledger,
        gate,
        readout,
        ledgerStore,
        generatedAt: new Date().toISOString(),
    };
}
