import { buildTurneroSurfaceSyncReadout } from './turnero-surface-sync-readout.js';

export function mountTurneroSurfaceSyncBanner(target, input = {}) {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    const handoffs = Array.isArray(input.handoffs)
        ? input.handoffs
        : Array.isArray(input.pack?.handoffs)
          ? input.pack.handoffs
          : [];
    const snapshot = input.snapshot || input.pack?.snapshot || {};
    const drift = input.drift || input.pack?.drift || {};
    const gate = input.gate || input.pack?.gate || {};
    const readout = buildTurneroSurfaceSyncReadout({
        snapshot,
        drift,
        gate,
        handoffs,
    });

    if (
        readout.driftState === 'aligned' &&
        readout.gateBand === 'ready' &&
        readout.openHandoffs <= 0
    ) {
        return null;
    }

    const banner = document.createElement('section');
    banner.className = 'turnero-surface-sync-banner';
    banner.dataset.state =
        readout.gateBand === 'blocked'
            ? 'blocked'
            : readout.gateBand === 'degraded'
              ? 'degraded'
              : readout.gateBand === 'watch'
                ? 'watch'
                : readout.driftState;
    banner.innerHTML = `
        <div class="turnero-surface-sync-banner__copy">
            <strong>${String(input.title || 'Surface Sync')}</strong>
            <p>${readout.summary}</p>
        </div>
        <span class="turnero-surface-sync-banner__badge">
            ${readout.gateBand} · ${readout.gateScore}
        </span>
    `;
    target.prepend(banner);
    return banner;
}
