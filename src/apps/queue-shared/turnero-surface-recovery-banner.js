import { buildTurneroSurfaceContractReadout } from './turnero-surface-contract-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

export function buildTurneroSurfaceRecoveryBannerHtml(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const drift = asObject(input.drift || pack.drift);
    const gate = asObject(input.gate || pack.gate);
    const readiness = asObject(
        input.readiness || pack.readiness || snapshot.readiness
    );
    const readout =
        input.readout ||
        buildTurneroSurfaceContractReadout({
            snapshot,
            drift,
            gate,
            readiness,
        });
    const title = toString(
        input.title,
        readout.surfaceLabel || 'Surface recovery'
    );

    return `
        <section
            class="turnero-surface-recovery-banner"
            data-state="${escapeHtml(readout.gateBand || readout.driftState || 'watch')}"
            data-surface="${escapeHtml(readout.surfaceKey)}"
        >
            <div class="turnero-surface-recovery-banner__copy">
                <p class="turnero-surface-recovery-banner__eyebrow">
                    ${escapeHtml(readout.surfaceLabel || title)}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(readout.summary)}</p>
            </div>
            <span class="turnero-surface-recovery-banner__badge">
                ${escapeHtml(readout.badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceRecoveryBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    root.innerHTML = buildTurneroSurfaceRecoveryBannerHtml(input);
    return root.querySelector('.turnero-surface-recovery-banner');
}
