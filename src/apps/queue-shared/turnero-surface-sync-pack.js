import { buildTurneroSurfaceSyncSnapshot } from './turnero-surface-sync-snapshot.js';
import { buildTurneroSurfaceSyncDrift } from './turnero-surface-sync-drift.js';
import { buildTurneroSurfaceSyncGate } from './turnero-surface-sync-gate.js';

export function buildTurneroSurfaceSyncPack(input = {}) {
    const handoffs = Array.isArray(input.handoffs) ? input.handoffs : [];
    const snapshot = buildTurneroSurfaceSyncSnapshot(input);
    const drift = buildTurneroSurfaceSyncDrift({
        snapshot,
        expectedVisibleTurn: input.expectedVisibleTurn,
        expectedQueueVersion: input.expectedQueueVersion,
    });
    const gate = buildTurneroSurfaceSyncGate({
        drifts: [drift],
        handoffs,
    });

    return {
        snapshot,
        drift,
        gate,
        handoffs,
        expectedVisibleTurn: String(input.expectedVisibleTurn || '').trim(),
        expectedQueueVersion: String(input.expectedQueueVersion || '').trim(),
        generatedAt: new Date().toISOString(),
    };
}
