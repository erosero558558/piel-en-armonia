import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceAdoptionReadout } from './turnero-surface-adoption-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceAdoptionBannerInlineStyles';

function ensureAdoptionBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-adoption-banner {
            gap: 0.22rem;
        }
        .turnero-surface-adoption-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-adoption-banner[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-adoption-banner[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
            background: rgb(255 247 237 / 84%);
            color: rgb(154 52 18);
        }
        .turnero-surface-adoption-banner[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-adoption-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveAdoptionReadout(input = {}) {
    const snapshot = asObject(input.snapshot || input.pack?.snapshot);
    const gate = asObject(input.gate || input.pack?.gate);
    const readout = asObject(input.readout || input.pack?.readout);
    if (Object.keys(readout).length > 0) {
        return {
            snapshot,
            gate,
            readout,
        };
    }

    return {
        snapshot,
        gate,
        readout: buildTurneroSurfaceAdoptionReadout({
            snapshot,
            gate,
        }),
    };
}

function resolveBannerState(gateBand) {
    const normalized = toString(gateBand, 'watch').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'watch';
    }
    if (normalized === 'degraded') {
        return 'degraded';
    }
    return 'blocked';
}

export function buildTurneroSurfaceAdoptionBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveAdoptionReadout(input);
    const title = toString(
        input.title,
        readout.surfaceLabel || 'Surface adoption'
    );
    const eyebrow = toString(input.eyebrow, 'Adoption');
    const state = resolveBannerState(gate.band || readout.gateBand);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-adoption-banner"
            data-state="${escapeHtml(state)}"
            data-surface="${escapeHtml(snapshot.surfaceKey || readout.surfaceKey || 'surface')}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(eyebrow)}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(readout.summary)}</p>
                <p class="turnero-surface-adoption-banner__meta">
                    ${escapeHtml(readout.detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(readout.badge || `${readout.gateBand || 'watch'} · ${Number(readout.gateScore || 0)}`)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceAdoptionBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureAdoptionBannerStyles();
    const { snapshot, gate, readout } = resolveAdoptionReadout(input);
    root.innerHTML = buildTurneroSurfaceAdoptionBannerHtml({
        ...input,
        snapshot,
        gate,
        readout,
    });
    return root.querySelector('.turnero-surface-adoption-banner');
}
