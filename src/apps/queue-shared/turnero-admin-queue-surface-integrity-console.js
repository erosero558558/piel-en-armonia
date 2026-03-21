import { createTurneroSurfaceIntegrityLedger } from './turnero-surface-integrity-ledger.js';
import { buildTurneroSurfaceQueueIntegrityGate } from './turnero-surface-queue-integrity-gate.js';
import { buildTurneroSurfaceIntegrityPack } from './turnero-surface-integrity-pack.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceIntegrityConsoleInlineStyles';

function ensureIntegrityConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-integrity-console__header-copy {
            display: grid;
            gap: 0.18rem;
        }
        .turnero-admin-queue-surface-integrity-console__metric {
            display: grid;
            gap: 0.2rem;
            padding: 0.78rem 0.88rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 80%);
        }
        .turnero-admin-queue-surface-integrity-console__metric strong {
            font-size: 1.05rem;
        }
        .turnero-admin-queue-surface-integrity-console__surface-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-integrity-console__surface-grid div {
            padding: 0.55rem 0.62rem;
            border-radius: 14px;
            background: rgb(15 23 32 / 3%);
        }
        .turnero-admin-queue-surface-integrity-console__surface-grid dt {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-integrity-console__surface-grid dd {
            margin: 0.2rem 0 0;
            font-weight: 700;
        }
        .turnero-admin-queue-surface-integrity-console__form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 0.6rem;
            padding: 0.8rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-integrity-console__form label {
            display: grid;
            gap: 0.3rem;
            font-size: 0.78rem;
        }
        .turnero-admin-queue-surface-integrity-console__form input,
        .turnero-admin-queue-surface-integrity-console__form select,
        .turnero-admin-queue-surface-integrity-console__form textarea {
            min-height: 38px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 96%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-integrity-console__form textarea {
            min-height: 82px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-integrity-console__form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
            align-items: end;
        }
        .turnero-admin-queue-surface-integrity-console__evidence-list {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-integrity-console__evidence-item {
            display: flex;
            justify-content: space-between;
            gap: 0.7rem;
            align-items: flex-start;
            padding: 0.72rem 0.8rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 76%);
        }
        .turnero-admin-queue-surface-integrity-console__evidence-item p {
            margin: 0.08rem 0 0;
        }
        .turnero-admin-queue-surface-integrity-console__brief {
            margin: 0;
            padding: 0.85rem 0.95rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
            white-space: pre-wrap;
            font-size: 0.84rem;
            line-height: 1.5;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeRouteKey(value) {
    return toString(value)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function resolveSurfaceLabel(surfaceKey, clinicProfile) {
    if (surfaceKey === 'operator-turnos') {
        return toString(clinicProfile?.surfaces?.operator?.label, 'Operador');
    }
    if (surfaceKey === 'kiosco-turnos') {
        return toString(clinicProfile?.surfaces?.kiosk?.label, 'Kiosco');
    }
    if (surfaceKey === 'sala-turnos') {
        return toString(clinicProfile?.surfaces?.display?.label, 'Sala TV');
    }
    return surfaceKey;
}

function resolveSurfacePackItems(input = {}, clinicProfile = null) {
    const direct =
        typeof input.getSurfacePacks === 'function'
            ? input.getSurfacePacks()
            : input.surfacePacks;
    if (Array.isArray(direct) && direct.length > 0) {
        return direct.map((item) =>
            normalizeSurfacePackItem(item, clinicProfile)
        );
    }

    const drifts = Array.isArray(input.drifts) ? input.drifts : [];
    if (drifts.length > 0) {
        return drifts.map((drift) =>
            normalizeSurfacePackItem(
                {
                    surfaceKey: drift.surfaceKey,
                    label:
                        resolveSurfaceLabel(drift.surfaceKey, clinicProfile) ||
                        drift.surfaceKey,
                    pack: {
                        snapshot: {
                            surfaceKey: drift.surfaceKey,
                            queueVersion: drift.queueVersion || '',
                            visibleTurn: drift.visibleTurn || '',
                            announcedTurn: drift.announcedTurn || '',
                            ticketDisplay: drift.ticketDisplay || '',
                            maskedTicket: drift.maskedTicket || '',
                            privacyMode: drift.privacyMode || 'masked',
                            heartbeatState: drift.heartbeatState || 'unknown',
                            heartbeatChannel:
                                drift.heartbeatChannel || 'unknown',
                        },
                        drift,
                        gate: buildTurneroSurfaceQueueIntegrityGate({
                            drifts: [drift],
                            evidence: [],
                        }),
                    },
                },
                clinicProfile
            )
        );
    }

    return [];
}

function normalizeSurfacePackItem(item, clinicProfile) {
    const source = asObject(item);
    const pack = asObject(source.pack || source);
    const snapshot = asObject(pack.snapshot || source.snapshot);
    const telemetryKey = normalizeRouteKey(
        source.telemetryKey || source.surface
    );
    const surfaceKey = toString(
        source.surfaceKey ||
            snapshot.surfaceKey ||
            resolveSurfaceLabel(
                telemetryKey ? `${telemetryKey}-turnos` : '',
                clinicProfile
            ) ||
            'surface'
    );
    const label = toString(
        source.label ||
            pack.readout?.surfaceLabel ||
            snapshot.surfaceLabel ||
            resolveSurfaceLabel(surfaceKey, clinicProfile) ||
            surfaceKey
    );
    const fallbackPack = buildTurneroSurfaceIntegrityPack({
        surfaceKey,
        queueVersion: snapshot.queueVersion || '',
        visibleTurn: snapshot.visibleTurn || '',
        announcedTurn: snapshot.announcedTurn || '',
        ticketDisplay: snapshot.ticketDisplay || '',
        maskedTicket: snapshot.maskedTicket || '',
        privacyMode: snapshot.privacyMode || 'masked',
        heartbeat: {
            state: snapshot.heartbeatState || 'unknown',
            channel: snapshot.heartbeatChannel || 'telemetry',
        },
        evidence: toArray(pack.evidence || source.evidence),
    });
    const sourceDrift = asObject(pack.drift || source.drift);
    const sourceMaskState = asObject(pack.maskState || source.maskState);
    const sourceGate = asObject(pack.gate || source.gate);
    const hasMeaningfulDrift =
        Object.keys(sourceDrift).length > 0 &&
        (Object.prototype.hasOwnProperty.call(sourceDrift, 'state') ||
            Object.prototype.hasOwnProperty.call(sourceDrift, 'severity') ||
            Object.prototype.hasOwnProperty.call(sourceDrift, 'summary') ||
            Object.prototype.hasOwnProperty.call(sourceDrift, 'detail') ||
            (Array.isArray(sourceDrift.driftFlags) &&
                sourceDrift.driftFlags.length > 0));
    const hasMeaningfulMaskState =
        Object.keys(sourceMaskState).length > 0 &&
        Object.prototype.hasOwnProperty.call(sourceMaskState, 'state');
    const hasMeaningfulGate =
        Object.keys(sourceGate).length > 0 &&
        Object.prototype.hasOwnProperty.call(sourceGate, 'band');

    return {
        telemetryKey,
        surfaceKey,
        label,
        pack: {
            ...fallbackPack,
            ...pack,
            snapshot: {
                ...fallbackPack.snapshot,
                ...snapshot,
            },
            drift: hasMeaningfulDrift ? sourceDrift : fallbackPack.drift,
            maskState: hasMeaningfulMaskState
                ? sourceMaskState
                : fallbackPack.maskState,
            gate: hasMeaningfulGate ? sourceGate : fallbackPack.gate,
            evidence: toArray(pack.evidence || source.evidence),
        },
    };
}

function buildSurfacePackReadout(item) {
    const pack = asObject(item.pack);
    const snapshot = asObject(pack.snapshot);
    const drift = asObject(pack.drift);
    const maskState = asObject(pack.maskState);
    const gate = asObject(pack.gate);
    const evidence = Array.isArray(pack.evidence) ? pack.evidence : [];
    const visibleTurn = toString(snapshot.visibleTurn, '--');
    const announcedTurn = toString(snapshot.announcedTurn, '--');
    const ticketDisplay = toString(snapshot.ticketDisplay, '--');
    const maskedTicket = toString(
        maskState.maskedTicket || snapshot.maskedTicket,
        '--'
    );
    const driftState = toString(drift.state, 'aligned');
    const gateBand = toString(gate.band, 'unknown');
    const gateScore = Number(gate.score || 0);
    const maskDisplay =
        maskedTicket !== '--'
            ? `${maskedTicket} · ${toString(maskState.state, 'missing')}`
            : toString(maskState.state, 'missing');

    return {
        visibleTurn,
        announcedTurn,
        ticketDisplay,
        maskedTicket,
        maskState: toString(maskState.state, 'missing'),
        maskDisplay: toString(maskDisplay, 'missing'),
        driftState,
        driftSeverity: toString(drift.severity, 'none'),
        gateBand,
        gateScore,
        badge: `${gateBand} · ${gateScore}`,
        summary:
            driftState === 'aligned'
                ? `Visible ${visibleTurn} y anuncio alineados.`
                : drift.detail || drift.summary || 'Drift visible detectado.',
        evidenceCount: evidence.length,
        state:
            gateBand === 'blocked'
                ? 'blocked'
                : gateBand === 'degraded'
                  ? 'degraded'
                  : gateBand === 'watch'
                    ? 'watch'
                    : 'ready',
    };
}

function countPackStates(surfacePacks = []) {
    return surfacePacks.reduce(
        (accumulator, item) => {
            const readout = buildSurfacePackReadout(item);
            accumulator.total += 1;
            accumulator.evidence += readout.evidenceCount;
            accumulator.drifts += readout.driftState === 'aligned' ? 0 : 1;
            accumulator.ready += readout.state === 'ready' ? 1 : 0;
            accumulator.watch += readout.state === 'watch' ? 1 : 0;
            accumulator.degraded += readout.state === 'degraded' ? 1 : 0;
            accumulator.blocked += readout.state === 'blocked' ? 1 : 0;
            return accumulator;
        },
        {
            total: 0,
            evidence: 0,
            drifts: 0,
            ready: 0,
            watch: 0,
            degraded: 0,
            blocked: 0,
        }
    );
}

function buildBrief(state) {
    const lines = [
        '# Surface Queue Integrity',
        '',
        `Scope: ${toString(state.scope, 'global')}`,
        `Gate: ${Number(state.gate.score || 0)} (${toString(
            state.gate.band,
            'unknown'
        )})`,
        `Decision: ${toString(state.gate.decision, 'review')}`,
        `Surfaces: ${state.surfacePacks.length}`,
        `Evidence: ${state.evidence.length}`,
        '',
        '## Surfaces',
    ];

    state.surfacePacks.forEach((item) => {
        const readout = buildSurfacePackReadout(item);
        lines.push(
            `- ${toString(item.label, item.surfaceKey)} · ${readout.state} · ${readout.badge} · visible ${readout.visibleTurn} · announced ${readout.announcedTurn} · mask ${readout.maskState}`
        );
    });

    lines.push('', '## Evidence');

    if (state.evidence.length === 0) {
        lines.push('Sin evidencia registrada.');
    } else {
        state.evidence.forEach((item) => {
            lines.push(
                `- [${toString(item.status, 'pass')}] ${toString(
                    item.surfaceKey,
                    'surface'
                )} · ${toString(item.kind, 'queue-integrity')} · ${toString(
                    item.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

function buildConsoleState(input = {}, evidenceOverride = null) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(input.scope, 'global');
    const surfacePacks = resolveSurfacePackItems(input, clinicProfile);
    const evidence = Array.isArray(evidenceOverride)
        ? evidenceOverride
        : Array.isArray(input.evidence)
          ? input.evidence
          : [];
    const drifts = surfacePacks.map((item) => item.pack.drift).filter(Boolean);
    const gate = buildTurneroSurfaceQueueIntegrityGate({ drifts, evidence });

    return {
        scope,
        clinicProfile,
        surfacePacks,
        drifts,
        evidence,
        gate,
        metrics: countPackStates(surfacePacks),
        generatedAt: new Date().toISOString(),
    };
}

function buildSurfaceCardHtml(item) {
    const readout = buildSurfacePackReadout(item);
    return `
        <article
            class="turnero-surface-ops-console__surface turnero-admin-queue-surface-integrity-console__surface"
            data-state="${escapeHtml(readout.state)}"
            data-surface="${escapeHtml(item.surfaceKey)}"
        >
            <div class="turnero-surface-ops-console__surface-header">
                <div>
                    <strong>${escapeHtml(item.label || item.surfaceKey)}</strong>
                    <p>${escapeHtml(
                        `${item.telemetryKey || item.surfaceKey} · ${readout.badge}`
                    )}</p>
                </div>
                <span class="turnero-surface-ops-console__surface-badge">
                    ${escapeHtml(readout.badge)}
                </span>
            </div>
            <p>${escapeHtml(readout.summary)}</p>
            <dl class="turnero-admin-queue-surface-integrity-console__surface-grid">
                <div>
                    <dt>Visible</dt>
                    <dd>${escapeHtml(readout.visibleTurn || '--')}</dd>
                </div>
                <div>
                    <dt>Announced</dt>
                    <dd>${escapeHtml(readout.announcedTurn || '--')}</dd>
                </div>
                <div>
                    <dt>Ticket</dt>
                    <dd>${escapeHtml(readout.ticketDisplay || '--')}</dd>
                </div>
                <div>
                    <dt>Mask</dt>
                    <dd>${escapeHtml(readout.maskDisplay || 'missing')}</dd>
                </div>
                <div>
                    <dt>Drift</dt>
                    <dd>${escapeHtml(readout.driftState || 'aligned')}</dd>
                </div>
                <div>
                    <dt>Evidence</dt>
                    <dd>${escapeHtml(String(readout.evidenceCount || 0))}</dd>
                </div>
            </dl>
        </article>
    `;
}

function buildMetricsHtml(state) {
    return `
        <article class="turnero-admin-queue-surface-integrity-console__metric">
            <strong>${escapeHtml(String(state.metrics.total))}</strong>
            <span>Surfaces</span>
        </article>
        <article class="turnero-admin-queue-surface-integrity-console__metric" data-state="${
            state.gate.band
        }">
            <strong>${escapeHtml(String(state.gate.score || 0))}</strong>
            <span>${escapeHtml(toString(state.gate.band, 'unknown'))}</span>
        </article>
        <article class="turnero-admin-queue-surface-integrity-console__metric">
            <strong>${escapeHtml(String(state.metrics.drifts))}</strong>
            <span>Drifts</span>
        </article>
        <article class="turnero-admin-queue-surface-integrity-console__metric">
            <strong>${escapeHtml(String(state.metrics.evidence))}</strong>
            <span>Evidence</span>
        </article>
    `;
}

function buildEvidenceFormHtml(state) {
    const options = state.surfacePacks.length
        ? state.surfacePacks
              .map(
                  (item) => `
                <option value="${escapeHtml(item.surfaceKey)}">${escapeHtml(
                    item.label || item.surfaceKey
                )}</option>
            `
              )
              .join('')
        : '<option value="surface">surface</option>';

    return `
        <div class="turnero-admin-queue-surface-integrity-console__form">
            <label>
                <span>Surface</span>
                <select data-field="surface-key">
                    ${options}
                </select>
            </label>
            <label>
                <span>Kind</span>
                <input type="text" data-field="kind" value="queue-integrity" />
            </label>
            <label>
                <span>Status</span>
                <select data-field="status">
                    <option value="pass">pass</option>
                    <option value="review">review</option>
                    <option value="watch">watch</option>
                    <option value="blocked">blocked</option>
                </select>
            </label>
            <label>
                <span>Owner</span>
                <input type="text" data-field="owner" value="ops" />
            </label>
            <label style="grid-column: 1 / -1;">
                <span>Note</span>
                <textarea data-field="note" placeholder="What was validated?"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-integrity-console__form-actions" style="grid-column: 1 / -1;">
                <button type="button" class="turnero-surface-ops-console__button" data-action="add-evidence" data-tone="primary">
                    Add evidence
                </button>
                <button type="button" class="turnero-surface-ops-console__button" data-action="clear-evidence">
                    Clear evidence
                </button>
            </div>
        </div>
    `;
}

function buildEvidenceListHtml(state) {
    if (state.evidence.length === 0) {
        return '<p class="turnero-surface-ops-console__empty">Sin evidencia registrada.</p>';
    }

    return `
        <ul class="turnero-surface-ops-console__list turnero-admin-queue-surface-integrity-console__evidence-list">
            ${state.evidence
                .map(
                    (item) => `
                        <li class="turnero-admin-queue-surface-integrity-console__evidence-item" data-evidence-id="${escapeHtml(
                            item.id
                        )}">
                            <div>
                                <strong>${escapeHtml(
                                    item.kind || 'queue-integrity'
                                )}</strong>
                                <p>${escapeHtml(
                                    `${item.surfaceKey || 'surface'} · ${item.status || 'pass'} · ${formatTimestamp(item.createdAt)}`
                                )}</p>
                                <p>${escapeHtml(item.note || 'Sin nota')}</p>
                            </div>
                            <button
                                type="button"
                                class="turnero-surface-ops-console__button"
                                data-action="remove-evidence"
                                data-evidence-id="${escapeHtml(item.id)}"
                            >
                                Remove
                            </button>
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function renderConsoleHtml(state) {
    const brief = buildBrief(state);
    return `
        <section
            class="turnero-surface-ops-console turnero-admin-queue-surface-integrity-console"
            data-scope="${escapeHtml(state.scope)}"
            data-state="${escapeHtml(state.gate.band || 'unknown')}"
        >
            <div class="turnero-surface-ops-console__header">
                <div class="turnero-admin-queue-surface-integrity-console__header-copy">
                    <p class="turnero-surface-ops-console__surface-title">
                        Surface Queue Integrity
                    </p>
                    <h3>Surface Queue Integrity Console</h3>
                    <p>
                        ${escapeHtml(
                            `Scope ${state.scope} · ${state.metrics.total} surfaces · ${state.metrics.drifts} drifts · ${state.metrics.evidence} evidence rows`
                        )}
                    </p>
                </div>
                <div class="turnero-surface-ops-console__actions">
                    <button type="button" class="turnero-surface-ops-console__button" data-action="copy-brief" data-tone="primary">
                        Copy brief
                    </button>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="download-json">
                        Download JSON
                    </button>
                </div>
            </div>
            <div class="turnero-surface-ops-console__grid">
                ${buildMetricsHtml(state)}
            </div>
            <div class="turnero-surface-ops-console__grid">
                ${state.surfacePacks.map((item) => buildSurfaceCardHtml(item)).join('')}
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Evidence</h4>
                ${buildEvidenceFormHtml(state)}
                ${buildEvidenceListHtml(state)}
            </div>
            <pre class="turnero-admin-queue-surface-integrity-console__brief" data-role="brief">${escapeHtml(
                brief
            )}</pre>
        </section>
    `;
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        surfacePacks: state.surfacePacks,
        drifts: state.drifts,
        evidence: state.evidence,
        gate: state.gate,
        summary: {
            totalSurfaces: state.metrics.total,
            readyCount: state.metrics.ready,
            watchCount: state.metrics.watch,
            degradedCount: state.metrics.degraded,
            blockedCount: state.metrics.blocked,
            driftCount: state.metrics.drifts,
            evidenceCount: state.metrics.evidence,
        },
        brief: buildBrief(state),
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${
                      window.location.hash || ''
                  }`
                : '',
    };
}

export function buildTurneroAdminQueueSurfaceIntegrityConsoleHtml(input = {}) {
    return renderConsoleHtml(buildConsoleState(input, input.evidence));
}

export function mountTurneroAdminQueueSurfaceIntegrityConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureIntegrityConsoleStyles();
    const scope = toString(input.scope, 'global');
    const clinicProfile = asObject(input.clinicProfile);
    const ledger = createTurneroSurfaceIntegrityLedger(scope, clinicProfile);
    const controller = {
        root: document.createElement('section'),
        ledger,
        state: null,
        refresh: null,
        destroy: null,
    };

    const syncState = () => {
        controller.state = buildConsoleState(input, ledger.list());
        controller.root.innerHTML = renderConsoleHtml(controller.state);
        return controller.state;
    };

    const onClick = async (event) => {
        const actionTarget =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-action]')
                : event.target instanceof HTMLElement
                  ? event.target
                  : null;
        if (!(actionTarget instanceof HTMLElement)) {
            return;
        }

        const action = toString(actionTarget.dataset.action);
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyTextToClipboard(buildBrief(controller.state));
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-queue-integrity.json',
                buildDownloadPayload(controller.state)
            );
            return;
        }
        if (action === 'add-evidence') {
            const surfaceKeyField = controller.root.querySelector(
                '[data-field="surface-key"]'
            );
            const kindField = controller.root.querySelector(
                '[data-field="kind"]'
            );
            const statusField = controller.root.querySelector(
                '[data-field="status"]'
            );
            const ownerField = controller.root.querySelector(
                '[data-field="owner"]'
            );
            const noteField = controller.root.querySelector(
                '[data-field="note"]'
            );
            ledger.add({
                surfaceKey: toString(
                    surfaceKeyField && 'value' in surfaceKeyField
                        ? surfaceKeyField.value
                        : controller.state.surfacePacks[0]?.surfaceKey ||
                              'surface'
                ),
                kind: toString(
                    kindField && 'value' in kindField
                        ? kindField.value
                        : 'queue-integrity'
                ),
                status: toString(
                    statusField && 'value' in statusField
                        ? statusField.value
                        : 'pass'
                ),
                owner: toString(
                    ownerField && 'value' in ownerField
                        ? ownerField.value
                        : 'ops'
                ),
                note: toString(
                    noteField && 'value' in noteField ? noteField.value : ''
                ),
            });
            if (noteField && 'value' in noteField) {
                noteField.value = '';
            }
            syncState();
            return;
        }
        if (action === 'clear-evidence') {
            ledger.clear();
            syncState();
            return;
        }
        if (action === 'remove-evidence') {
            const evidenceId = toString(actionTarget.dataset.evidenceId);
            if (evidenceId) {
                ledger.remove(evidenceId);
                syncState();
            }
        }
    };

    controller.refresh = syncState;
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
    };

    controller.root.addEventListener('click', onClick);
    syncState();
    host.replaceChildren(controller.root);
    return controller;
}
