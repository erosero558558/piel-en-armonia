import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceAcceptanceReadout } from './turnero-surface-acceptance-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceAcceptanceBannerInlineStyles';

function ensureAcceptanceBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }

    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    ensureTurneroSurfaceOpsStyles();

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-acceptance-banner {
            display: flex;
            justify-content: space-between;
            gap: 0.9rem;
            align-items: flex-start;
        }
        .turnero-surface-acceptance-banner__copy {
            display: grid;
            gap: 0.18rem;
            min-width: 0;
        }
        .turnero-surface-acceptance-banner__eyebrow {
            margin: 0;
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.72;
        }
        .turnero-surface-acceptance-banner__copy strong {
            font-size: 0.98rem;
            line-height: 1.18;
        }
        .turnero-surface-acceptance-banner__copy p {
            margin: 0;
            font-size: 0.84rem;
            line-height: 1.45;
            opacity: 0.88;
        }
        .turnero-surface-acceptance-banner__badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 34px;
            padding: 0.34rem 0.7rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 84%);
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.01em;
            white-space: nowrap;
        }
        .turnero-surface-acceptance-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 16%);
            background: rgb(220 252 231 / 76%);
        }
        .turnero-surface-acceptance-banner[data-state='watch'] {
            border-color: rgb(180 83 9 / 16%);
            background: rgb(254 243 199 / 76%);
        }
        .turnero-surface-acceptance-banner[data-state='degraded'] {
            border-color: rgb(234 179 8 / 16%);
            background: rgb(254 249 195 / 76%);
        }
        .turnero-surface-acceptance-banner[data-state='blocked'] {
            border-color: rgb(190 24 93 / 16%);
            background: rgb(255 228 230 / 78%);
        }
        @media (max-width: 760px) {
            .turnero-surface-acceptance-banner {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

export function buildTurneroSurfaceAcceptanceBannerHtml(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const readout =
        input.readout ||
        pack.readout ||
        buildTurneroSurfaceAcceptanceReadout({
            snapshot,
            gate,
        });
    const title = toString(
        input.title,
        readout.surfaceLabel || 'Surface acceptance'
    );

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-acceptance-banner"
            data-state="${escapeHtml(readout.gateBand || gate.band || 'watch')}"
            data-surface="${escapeHtml(readout.surfaceKey)}"
        >
            <div class="turnero-surface-acceptance-banner__copy">
                <p class="turnero-surface-acceptance-banner__eyebrow">
                    ${escapeHtml(readout.surfaceLabel || title)}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(readout.summary)}</p>
            </div>
            <span class="turnero-surface-acceptance-banner__badge">
                ${escapeHtml(readout.badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceAcceptanceBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureAcceptanceBannerStyles();
    root.innerHTML = buildTurneroSurfaceAcceptanceBannerHtml(input);
    return root.querySelector('.turnero-surface-acceptance-banner');
}

export default mountTurneroSurfaceAcceptanceBanner;
