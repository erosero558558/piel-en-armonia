import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceFleetReadout } from './turnero-surface-fleet-readout.js';
import {
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

function resolveBannerState(gateBand) {
    if (gateBand === 'blocked' || gateBand === 'degraded') {
        return 'alert';
    }
    return 'warning';
}

function normalizePack(input = {}) {
    if (input.pack && typeof input.pack === 'object') {
        return input.pack;
    }

    return {
        snapshot: input.snapshot,
        checklist: input.checklist,
        waves: input.waves,
        owners: input.owners,
        gate: input.gate,
    };
}

export function mountTurneroSurfaceFleetBanner(target, input = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    const pack = normalizePack(input);
    const readout =
        input.readout ||
        buildTurneroSurfaceFleetReadout({
            snapshot: input.snapshot || pack.snapshot,
            checklist: input.checklist || pack.checklist,
            waves: input.waves || pack.waves,
            owners: input.owners || pack.owners,
            gate: input.gate || pack.gate,
        });

    if (readout.gateBand === 'ready') {
        host.hidden = true;
        host.removeAttribute?.('data-state');
        host.removeAttribute?.('data-band');
        host.removeAttribute?.('data-decision');
        host.replaceChildren();
        return null;
    }

    host.hidden = false;
    host.className = 'turnero-surface-ops__banner turnero-surface-fleet-banner';
    host.dataset.state = resolveBannerState(readout.gateBand);
    host.dataset.band = readout.gateBand;
    host.dataset.decision = readout.gateDecision;
    host.innerHTML = `
        <strong>${escapeHtml(toString(input.title, 'Surface Fleet Readiness'))}</strong>
        <p>${escapeHtml(readout.summary)}</p>
        <p>${escapeHtml(readout.detail)}</p>
    `;
    return host;
}
