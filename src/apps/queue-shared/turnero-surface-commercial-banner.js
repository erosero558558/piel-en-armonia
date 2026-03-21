import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceCommercialReadout } from './turnero-surface-commercial-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceCommercialBannerInlineStyles';

function ensureCommercialBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-commercial-banner {
            gap: 0.22rem;
        }
        .turnero-surface-commercial-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-commercial-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-commercial-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeBannerState(gateBand) {
    const normalized = toString(gateBand, 'degraded');
    if (normalized === 'watch') {
        return 'warning';
    }
    if (normalized === 'ready') {
        return 'ready';
    }
    return 'alert';
}

function buildBannerSummary(readout) {
    return [
        `${toString(readout.packageTier, 'pilot')}`,
        `owner ${toString(readout.commercialOwner, 'sin owner') || 'sin owner'}`,
        `ops ${toString(readout.opsOwner, 'ops')}`,
        `scope ${toString(readout.scopeState, 'draft')}`,
        `pricing ${toString(readout.pricingState, 'draft')}`,
    ].join(' · ');
}

function buildBannerDetail(readout) {
    return [
        `runtime ${toString(readout.runtimeState, 'unknown')}`,
        `truth ${toString(readout.truth, 'unknown')}`,
        `gate ${toString(readout.gateBand, 'degraded')}`,
        `score ${Number(readout.gateScore || 0)}`,
    ].join(' · ');
}

function buildBannerBadge(readout) {
    return `${toString(readout.gateBand, 'degraded')} · ${Number(
        readout.gateScore || 0
    )}`;
}

function resolveCommercialReadout(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const directReadout = asObject(input.readout);
    const readout =
        Object.keys(directReadout).length > 0
            ? directReadout
            : buildTurneroSurfaceCommercialReadout({
                  snapshot,
                  gate,
              });

    return {
        snapshot,
        gate,
        readout,
    };
}

export function buildTurneroSurfaceCommercialBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveCommercialReadout(input);
    if (toString(gate.band, 'degraded') === 'ready') {
        return '';
    }

    const title = toString(input.title, 'Commercial readiness visible');
    const summary = toString(input.summary, buildBannerSummary(readout));
    const detail = toString(input.detail, buildBannerDetail(readout));
    const badge = toString(input.badge, buildBannerBadge(readout));
    const state = normalizeBannerState(gate.band);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-commercial-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(gate.band, 'degraded'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'hold-commercial-readiness')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface commercial'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-commercial-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceCommercialBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureCommercialBannerStyles();

    const { snapshot, gate, readout } = resolveCommercialReadout(input);
    if (toString(gate.band, 'degraded') === 'ready') {
        root.hidden = true;
        root.innerHTML = '';
        root.removeAttribute?.('data-state');
        root.removeAttribute?.('data-band');
        root.removeAttribute?.('data-decision');
        return null;
    }

    root.hidden = false;
    root.className =
        'turnero-surface-ops__banner turnero-surface-commercial-banner';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'degraded');
    root.dataset.decision = toString(
        gate.decision,
        'hold-commercial-readiness'
    );
    root.innerHTML = buildTurneroSurfaceCommercialBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-commercial-banner') || root;
}
