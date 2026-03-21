import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceRolloutReadout } from './turnero-surface-rollout-readout.js';
import {
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceRolloutBannerInlineStyles';

function ensureRolloutBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-rollout-banner {
            gap: 0.22rem;
        }
        .turnero-surface-rollout-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-rollout-banner[data-state='watch'],
        .turnero-surface-rollout-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-rollout-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-rollout-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveBannerState(readout) {
    const band = toString(readout?.gateBand, 'watch');
    if (band === 'ready') {
        return 'ready';
    }
    if (band === 'blocked') {
        return 'alert';
    }
    return 'warning';
}

function resolveRolloutPack(input = {}) {
    const directPack =
        input.pack && typeof input.pack === 'object' ? input.pack : null;
    if (directPack) {
        return directPack;
    }

    return {
        snapshot: input.snapshot,
        checklist: input.checklist,
        manifest: input.manifest,
        ledger: input.ledger,
        gate: input.gate,
    };
}

function buildMeta(readout) {
    return [
        `Scope ${toString(readout.scope, 'regional')}`,
        `Visita ${toString(readout.visitDate, 'pendiente') || 'pendiente'}`,
        `Owner ${toString(readout.owner, 'pendiente') || 'pendiente'}`,
        `Asset ${toString(readout.assetTag, 'none') || 'none'}`,
        `Station ${toString(readout.stationLabel, 'pendiente') || 'pendiente'}`,
        `Install ${toString(readout.installMode, 'pendiente') || 'pendiente'}`,
        `Checklist ${Number(readout.checklistPass || 0) || 0}/${Number(readout.checklistAll || 0) || 0}`,
        `Manifest ${toString(readout.manifestState, 'watch')}`,
        `Ledger ${toString(readout.ledgerState, 'watch')}`,
    ].join(' · ');
}

export function buildTurneroSurfaceRolloutBannerHtml(input = {}) {
    const pack = resolveRolloutPack(input);
    const snapshot = pack.snapshot || input.snapshot || {};
    const checklist = pack.checklist || input.checklist || snapshot.checklist;
    const gate = pack.gate || input.gate || snapshot.gate;
    const manifest = pack.manifest || input.manifest || snapshot.manifest;
    const ledger = pack.ledger || input.ledger || snapshot.ledger;
    const readout =
        input.readout ||
        buildTurneroSurfaceRolloutReadout({
            snapshot,
            checklist,
            gate,
            manifest,
            ledger,
        });
    const state = resolveBannerState(readout);
    const title = toString(input.title, readout.title || 'Turnero rollout');
    const eyebrow = toString(
        input.eyebrow,
        `${toString(readout.surfaceLabel, readout.surfaceKey)} · ${toString(
            readout.clinicShortName || readout.clinicName,
            readout.clinicId || 'clínica'
        )}`
    );
    const summary = toString(input.summary, readout.summary);
    const detail = toString(input.detail, readout.detail);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-rollout-banner"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(readout.gateBand, 'watch'))}"
            data-surface="${escapeHtml(toString(readout.surfaceKey, 'surface'))}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(eyebrow)}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-rollout-banner__meta">
                    ${escapeHtml(buildMeta(readout))}
                </p>
                <p class="turnero-surface-rollout-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(toString(readout.badge, 'watch · 0'))}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceRolloutBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureRolloutBannerStyles();
    root.innerHTML = buildTurneroSurfaceRolloutBannerHtml(input);
    return root.querySelector('.turnero-surface-rollout-banner');
}
