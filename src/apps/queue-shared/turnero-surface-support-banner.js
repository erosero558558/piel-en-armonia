import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceSupportPack } from './turnero-surface-support-pack.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceSupportBannerInlineStyles';

function ensureSupportBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-support-banner {
            gap: 0.22rem;
        }
        .turnero-surface-support-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-support-banner[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-support-banner[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
            background: rgb(255 247 237 / 84%);
            color: rgb(154 52 18);
        }
        .turnero-surface-support-banner[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-support-banner__meta {
            opacity: 0.84;
        }
        .turnero-surface-support-banner__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
        }
        .turnero-surface-support-banner__chip {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.28rem 0.5rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
            font-size: 0.74rem;
            line-height: 1.2;
        }
        .turnero-surface-support-banner__chip[data-state='ready'] {
            border-color: rgb(22 163 74 / 20%);
            background: rgb(220 252 231 / 84%);
            color: rgb(22 101 52);
        }
        .turnero-surface-support-banner__chip[data-state='warning'] {
            border-color: rgb(180 83 9 / 20%);
            background: rgb(254 243 199 / 84%);
            color: rgb(120 53 15);
        }
        .turnero-surface-support-banner__chip[data-state='alert'] {
            border-color: rgb(190 24 93 / 20%);
            background: rgb(255 228 230 / 84%);
            color: rgb(159 18 57);
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveBannerPack(input = {}) {
    if (input.pack && typeof input.pack === 'object') {
        return input.pack;
    }
    return buildTurneroSurfaceSupportPack(input);
}

function resolveBannerState(pack = {}) {
    const gate = asObject(pack.gate);
    const snapshot = asObject(pack.snapshot);
    return toString(gate.band || snapshot.state, 'watch');
}

function buildBannerHtml(input = {}) {
    const pack = resolveBannerPack(input);
    const snapshot = asObject(pack.snapshot);
    const readout = asObject(pack.readout);
    const state = resolveBannerState(pack);
    const title = toString(
        input.title,
        `${snapshot.surfaceLabel || snapshot.surfaceKey || 'Surface'} support`
    );
    const eyebrow = toString(input.eyebrow, 'Surface support');
    const badge = toString(
        readout.badge,
        `${state} · ${Number(pack.gate?.score || 0) || 0}`
    );
    const summary = toString(
        readout.summary,
        snapshot.summary || 'Support ready.'
    );
    const detail = toString(
        readout.detail,
        snapshot.detail ||
            `${Number(snapshot.contactSummary?.active || 0)} contacto(s) activos · ${Number(
                snapshot.escalationSummary?.open || 0
            )} escalacion(es) abiertas`
    );
    const chips = Array.isArray(readout.chips) ? readout.chips : [];

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-support-banner"
            data-scope="${escapeHtml(snapshot.scope || 'queue-support')}"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'admin')}"
            data-state="${escapeHtml(state)}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">${escapeHtml(
                    eyebrow
                )}</p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-support-banner__meta">${escapeHtml(
                    detail
                )}</p>
                ${
                    chips.length > 0
                        ? `<div class="turnero-surface-support-banner__chips">${chips
                              .map(
                                  (chip) => `
                                    <span class="turnero-surface-support-banner__chip" data-state="${escapeHtml(
                                        chip.state || 'ready'
                                    )}">
                                        <strong>${escapeHtml(chip.label || 'Chip')}</strong>
                                        <span>${escapeHtml(chip.value || '')}</span>
                                    </span>
                                `
                              )
                              .join('')}</div>`
                        : ''
                }
            </div>
            <span class="turnero-surface-ops__banner-badge">${escapeHtml(badge)}</span>
        </section>
    `.trim();
}

export function mountTurneroSurfaceSupportBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureSupportBannerStyles();
    root.innerHTML = buildBannerHtml(input);
    return root.querySelector('.turnero-surface-support-banner');
}

export { buildBannerHtml as buildTurneroSurfaceSupportBannerHtml };
