import {
    escapeHtml,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { buildTurneroSurfaceReleaseReadinessPack } from './turnero-surface-release-readiness-pack.js';

function getReadinessPack(input = {}) {
    if (input.readinessPack && typeof input.readinessPack === 'object') {
        return input.readinessPack;
    }

    return buildTurneroSurfaceReleaseReadinessPack(input);
}

export function renderTurneroSurfaceLaunchBadge(input = {}) {
    const readinessPack = getReadinessPack(input);
    const summary = readinessPack.summary || {};
    const truthPack = readinessPack.truthPack || {};
    const rows = toArray(truthPack.rows).slice(0, 3);
    const surfaceKey = toString(readinessPack.surfaceKey, 'surface');
    const safeMode = readinessPack.safeMode || { enabled: false };
    const rowItems = rows
        .map(
            (row) => `
                <li class="turnero-surface-launch-badge__row" data-truth="${escapeHtml(
                    row.truth || 'unknown'
                )}">
                    <strong>${escapeHtml(row.label || row.surfaceKey || '')}</strong>
                    <span>${escapeHtml(row.truthLabel || row.truth || 'unknown')}</span>
                </li>
            `
        )
        .join('');

    return `
        <article
            class="turnero-surface-launch-badge"
            data-state="${escapeHtml(toString(summary.state || readinessPack.band, 'unknown'))}"
            data-band="${escapeHtml(toString(summary.state || readinessPack.band, 'unknown'))}"
            data-truth="${escapeHtml(toString(truthPack.summary?.mode, 'unknown'))}"
            data-manifest-source="${escapeHtml(
                toString(
                    summary.manifestSource,
                    truthPack.summary?.manifestSource || 'missing'
                )
            )}"
            data-surface-key="${escapeHtml(surfaceKey)}"
        >
            <div class="turnero-surface-launch-badge__header">
                <div>
                    <p class="turnero-surface-launch-badge__eyebrow">Launch badge</p>
                    <h4>${escapeHtml(
                        toString(
                            input.surfaceLabel,
                            readinessPack.label || surfaceKey
                        )
                    )}</h4>
                </div>
                <span class="turnero-surface-launch-badge__state">${escapeHtml(
                    toString(
                        summary.label || readinessPack.label,
                        'Desconocido'
                    )
                )}</span>
            </div>
            <p class="turnero-surface-launch-badge__summary">
                Score ${escapeHtml(String(summary.score || readinessPack.score || 0))}/100 ·
                smoke ${escapeHtml(
                    `${Number(summary.smokePass || readinessPack.smoke?.summary?.pass || 0)}/${Number(
                        summary.smokeAll ||
                            readinessPack.smoke?.summary?.all ||
                            0
                    )}`
                )}
            </p>
            <p class="turnero-surface-launch-badge__detail">
                ${escapeHtml(
                    safeMode.enabled ? 'Safe mode visible' : 'Safe mode hidden'
                )}
                · truth ${escapeHtml(
                    toString(truthPack.summary?.mode, 'unknown')
                )}
            </p>
            ${
                rowItems
                    ? `<ul class="turnero-surface-launch-badge__rows">${rowItems}</ul>`
                    : ''
            }
        </article>
    `.trim();
}

export function mountTurneroSurfaceLaunchBadge(target, input = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderTurneroSurfaceLaunchBadge(input);
    const node = wrapper.firstElementChild;
    if (!node) {
        return null;
    }

    host.replaceChildren(node);
    return node;
}
