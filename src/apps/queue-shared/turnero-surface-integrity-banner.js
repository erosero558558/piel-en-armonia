import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceIntegrityPack } from './turnero-surface-integrity-pack.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceIntegrityBannerInlineStyles';

function ensureIntegrityBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-integrity-banner {
            gap: 0.22rem;
        }
        .turnero-surface-integrity-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-integrity-banner[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-integrity-banner[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
            background: rgb(255 247 237 / 84%);
            color: rgb(154 52 18);
        }
        .turnero-surface-integrity-banner[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-integrity-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeTicketToken(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function resolveBannerState(pack) {
    const drift = asObject(pack?.drift);
    const maskState = asObject(pack?.maskState);
    const gate = asObject(pack?.gate);

    if (gate.band === 'blocked' || drift.state === 'blocked') {
        return 'blocked';
    }
    if (gate.band === 'degraded' || drift.state === 'degraded') {
        return 'degraded';
    }
    if (
        gate.band === 'watch' ||
        drift.state === 'watch' ||
        maskState.state === 'watch' ||
        maskState.state === 'open'
    ) {
        return 'watch';
    }
    return 'ready';
}

function buildIntegritySummary(pack) {
    const snapshot = asObject(pack?.snapshot);
    const drift = asObject(pack?.drift);
    const maskState = asObject(pack?.maskState);
    const gate = asObject(pack?.gate);
    const visibleTurn = toString(snapshot.visibleTurn, '--');
    const announcedTurn = toString(snapshot.announcedTurn, '--');
    const ticketDisplay = toString(snapshot.ticketDisplay, '--');
    const maskedTicket = toString(
        maskState.maskedTicket || snapshot.maskedTicket,
        '--'
    );

    if (drift.state === 'aligned') {
        return `Visible ${visibleTurn} y anuncio alineados. Mascara ${maskedTicket}.`;
    }

    return `Visible ${visibleTurn} · anunciado ${announcedTurn} · ticket ${ticketDisplay} · mascara ${maskedTicket} (${toString(
        maskState.state,
        'missing'
    )}) · drift ${toString(
        drift.severity,
        'none'
    )} · gate ${toString(gate.band, 'unknown')}.`;
}

function buildIntegrityBadge(pack) {
    const gate = asObject(pack?.gate);
    return `${toString(gate.band, 'unknown')} · ${Number(gate.score || 0)}`;
}

function resolveIntegrityPack(input = {}) {
    const directPack = asObject(input.pack);
    if (Object.keys(directPack).length > 0) {
        return directPack;
    }

    const drift = asObject(input.drift);
    if (Object.keys(drift).length > 0) {
        return buildTurneroSurfaceIntegrityPack({
            surfaceKey: drift.surfaceKey,
            queueVersion: drift.queueVersion,
            visibleTurn: drift.visibleTurn,
            announcedTurn: drift.announcedTurn,
            ticketDisplay: drift.ticketDisplay,
            maskedTicket: drift.maskedTicketRaw || drift.maskedTicket,
            privacyMode: drift.privacyMode,
            heartbeat: {
                state: drift.heartbeatState,
                channel: drift.heartbeatChannel,
            },
            evidence: input.evidence,
        });
    }

    return buildTurneroSurfaceIntegrityPack(input);
}

export function buildTurneroSurfaceIntegrityBannerHtml(input = {}) {
    const normalizedPack = resolveIntegrityPack(input);
    const snapshot = asObject(normalizedPack.snapshot);
    const drift = asObject(normalizedPack.drift);
    const gate = asObject(normalizedPack.gate);
    const maskState = asObject(normalizedPack.maskState);
    const state = resolveBannerState(normalizedPack);
    const title = toString(input.title, 'Queue integrity visible');
    const badge = buildIntegrityBadge(normalizedPack);
    const summary = buildIntegritySummary(normalizedPack);
    const detail = drift.detail || drift.summary || 'Sin drift visible.';

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-integrity-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-severity="${escapeHtml(drift.severity || 'none')}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface integrity'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-integrity-banner__meta">
                    ${escapeHtml(
                        `Mask ${toString(maskState.state, 'missing')} · gate ${toString(
                            gate.decision,
                            'review'
                        )}`
                    )}
                </p>
                <p class="turnero-surface-integrity-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceIntegrityBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureIntegrityBannerStyles();
    root.innerHTML = buildTurneroSurfaceIntegrityBannerHtml(input);
    return root.querySelector('.turnero-surface-integrity-banner');
}
