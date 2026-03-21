import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceGoLiveReadout } from './turnero-surface-go-live-readout.js';
import { escapeHtml, resolveTarget } from './turnero-surface-helpers.js';

function resolveBannerState(gateBand) {
    if (gateBand === 'watch') {
        return 'warning';
    }
    return 'alert';
}

export function mountTurneroSurfaceGoLiveBanner(target, input = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    const pack =
        input.pack && typeof input.pack === 'object' ? input.pack : null;
    const readout = buildTurneroSurfaceGoLiveReadout({
        snapshot: input.snapshot || pack?.snapshot,
        checklist: input.checklist || pack?.checklist,
        gate: input.gate || pack?.gate,
        evidence: input.evidence || pack?.evidence,
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
    host.className =
        'turnero-surface-ops__banner turnero-surface-go-live-banner';
    host.dataset.state = resolveBannerState(readout.gateBand);
    host.dataset.band = readout.gateBand;
    host.dataset.decision = readout.gateDecision;
    host.innerHTML = `
        <strong>${escapeHtml(readout.title)}</strong>
        <p>${escapeHtml(readout.summary)}</p>
        <p>${escapeHtml(readout.detail)}</p>
    `;
    return host;
}
