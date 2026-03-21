import { buildTurneroSurfaceGoLiveSnapshot } from './turnero-surface-go-live-snapshot.js';
import { buildTurneroSurfaceHardwareChecklist } from './turnero-surface-hardware-checklist.js';
import { buildTurneroSurfaceGoLiveGate } from './turnero-surface-go-live-gate.js';
import { buildTurneroSurfaceGoLiveReadout } from './turnero-surface-go-live-readout.js';

export function buildTurneroSurfaceGoLivePack(input = {}) {
    const snapshot = buildTurneroSurfaceGoLiveSnapshot(input);
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : buildTurneroSurfaceHardwareChecklist({ snapshot });
    const evidence = Array.isArray(input.evidence)
        ? input.evidence.filter(Boolean)
        : [];
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceGoLiveGate({
                  checklist,
                  evidence,
              });
    const readout = buildTurneroSurfaceGoLiveReadout({
        snapshot,
        checklist,
        gate,
        evidence,
    });

    return {
        snapshot,
        checklist,
        evidence,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
