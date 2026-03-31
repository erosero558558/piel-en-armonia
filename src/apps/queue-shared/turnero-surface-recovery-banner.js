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

    console.log('[RECOVERY LOG]', {
        surface: readout.surfaceKey,
        title: title,
        summary: readout.summary,
        badge: readout.badge,
        state: readout.gateBand || readout.driftState || 'watch'
    });
    localStorage.setItem('turnero_recovery_' + readout.surfaceKey, JSON.stringify({
        ts: Date.now(),
        summary: readout.summary,
        badge: readout.badge
    }));

    return `
        <section
            class="turnero-surface-recovery-banner"
            style="display:none;"
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
