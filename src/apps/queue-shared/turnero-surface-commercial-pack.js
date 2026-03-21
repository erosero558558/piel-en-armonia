import { buildTurneroSurfaceCommercialGate } from './turnero-surface-commercial-gate.js';
import { buildTurneroSurfaceCommercialReadout } from './turnero-surface-commercial-readout.js';
import { buildTurneroSurfaceCommercialSnapshot } from './turnero-surface-commercial-snapshot.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildTurneroSurfaceCommercialPack(input = {}) {
    const snapshot = buildTurneroSurfaceCommercialSnapshot(input);
    const checklist = asObject(input.checklist).summary
        ? input.checklist
        : {
              summary: {
                  all: 4,
                  pass: 2,
                  fail: 2,
              },
          };
    const ledger = toArray(input.ledger);
    const owners = toArray(input.owners);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceCommercialGate({
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceCommercialReadout({
        snapshot,
        gate,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
