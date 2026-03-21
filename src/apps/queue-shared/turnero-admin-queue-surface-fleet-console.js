import {
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { buildTurneroSurfaceFleetGate } from './turnero-surface-fleet-gate.js';
import { buildTurneroSurfaceFleetPack } from './turnero-surface-fleet-pack.js';
import { buildTurneroSurfaceFleetSnapshot } from './turnero-surface-fleet-snapshot.js';
import { createTurneroSurfaceFleetOwnerStore } from './turnero-surface-fleet-owner-store.js';
import { createTurneroSurfaceWaveLedger } from './turnero-surface-wave-ledger.js';

const STYLE_ID = 'turneroAdminQueueSurfaceFleetConsoleInlineStyles';
const DEFAULT_SURFACE_KEYS = Object.freeze(['operator', 'kiosk', 'display']);

function ensureFleetConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-fleet-console {
            display: grid;
            gap: 0.9rem;
        }
        .turnero-admin-queue-surface-fleet-console__header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.8rem;
            align-items: flex-start;
        }
        .turnero-admin-queue-surface-fleet-console__header-copy h3,
        .turnero-admin-queue-surface-fleet-console__header-copy p,
        .turnero-admin-queue-surface-fleet-console__section h4,
        .turnero-admin-queue-surface-fleet-console__section p,
        .turnero-admin-queue-surface-fleet-console__brief {
            margin: 0;
        }
        .turnero-admin-queue-surface-fleet-console__actions,
        .turnero-admin-queue-surface-fleet-console__form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-fleet-console__button {
            min-height: 38px;
            padding: 0.55rem 0.82rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 88%);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }
        .turnero-admin-queue-surface-fleet-console__button[data-tone='primary'] {
            border-color: rgb(15 107 220 / 22%);
            background: rgb(15 107 220 / 10%);
            color: rgb(10 67 137);
        }
        .turnero-admin-queue-surface-fleet-console__metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-fleet-console__metric {
            display: grid;
            gap: 0.18rem;
            padding: 0.78rem 0.88rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
        }
        .turnero-admin-queue-surface-fleet-console__metric span {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-fleet-console__metric strong {
            font-size: 1.05rem;
        }
        .turnero-admin-queue-surface-fleet-console__grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 0.8rem;
        }
        .turnero-admin-queue-surface-fleet-console__panel,
        .turnero-admin-queue-surface-fleet-console__form {
            display: grid;
            gap: 0.65rem;
            padding: 0.9rem 0.95rem;
            border-radius: 20px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 80%);
        }
        .turnero-admin-queue-surface-fleet-console__panel ul,
        .turnero-admin-queue-surface-fleet-console__panel ol {
            margin: 0;
            padding-left: 1rem;
            display: grid;
            gap: 0.35rem;
        }
        .turnero-admin-queue-surface-fleet-console__surface {
            display: grid;
            gap: 0.35rem;
            padding: 0.72rem 0.78rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 88%);
        }
        .turnero-admin-queue-surface-fleet-console__surface[data-state='ready'] {
            border-color: rgb(22 163 74 / 20%);
        }
        .turnero-admin-queue-surface-fleet-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-fleet-console__surface[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
        }
        .turnero-admin-queue-surface-fleet-console__surface[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-admin-queue-surface-fleet-console__surface header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 0.5rem;
            align-items: baseline;
        }
        .turnero-admin-queue-surface-fleet-console__surface header strong,
        .turnero-admin-queue-surface-fleet-console__surface header span {
            margin: 0;
        }
        .turnero-admin-queue-surface-fleet-console__section {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-fleet-console__section h4 {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.72;
        }
        .turnero-admin-queue-surface-fleet-console__form label {
            display: grid;
            gap: 0.3rem;
            font-size: 0.78rem;
        }
        .turnero-admin-queue-surface-fleet-console__form input,
        .turnero-admin-queue-surface-fleet-console__form select,
        .turnero-admin-queue-surface-fleet-console__form textarea {
            min-height: 38px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 96%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-fleet-console__form textarea {
            min-height: 82px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-fleet-console__list {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-fleet-console__list-item {
            display: grid;
            gap: 0.22rem;
            padding: 0.7rem 0.75rem;
            border-radius: 14px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 84%);
        }
        .turnero-admin-queue-surface-fleet-console__list-item p {
            margin: 0;
            opacity: 0.86;
        }
        .turnero-admin-queue-surface-fleet-console__brief {
            padding: 0.9rem 0.95rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 84%);
            white-space: pre-wrap;
            font-size: 0.84rem;
            line-height: 1.5;
        }
        @media (max-width: 760px) {
            .turnero-admin-queue-surface-fleet-console__header {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope || clinicProfile?.region || 'regional',
        'regional'
    );
}

function resolveSurfaceLabel(surfaceKey) {
    return (
        {
            operator: 'Operador',
            kiosk: 'Kiosco',
            display: 'Sala TV',
            admin: 'Admin',
        }[toString(surfaceKey, '').toLowerCase()] ||
        toString(surfaceKey, 'surface')
    );
}

function resolveSnapshots(
    input = {},
    clinicProfile = null,
    scope = 'regional'
) {
    const direct = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : null;

    if (direct && direct.length > 0) {
        return direct.map((snapshot) =>
            buildTurneroSurfaceFleetSnapshot({
                ...snapshot,
                clinicProfile,
                region: snapshot.region || scope,
            })
        );
    }

    return DEFAULT_SURFACE_KEYS.map((surfaceKey) =>
        buildTurneroSurfaceFleetSnapshot({
            surfaceKey,
            clinicProfile,
            region: scope,
            runtimeState: 'ready',
            truth: 'watch',
            waveLabel: '',
            fleetOwner: '',
            rolloutBatch: 'unassigned',
            documentationState: 'draft',
        })
    );
}

function normalizeChecklist(input = {}) {
    if (input.checklist && typeof input.checklist === 'object') {
        return input.checklist;
    }

    return {
        summary: {
            all: 6,
            pass: 4,
            fail: 2,
        },
    };
}

function buildSnapshotCardsHtml(snapshots = []) {
    if (snapshots.length === 0) {
        return '<p class="turnero-admin-queue-surface-fleet-console__empty">Sin snapshots.</p>';
    }

    return snapshots
        .map(
            (snapshot) => `
                <article class="turnero-admin-queue-surface-fleet-console__surface" data-state="${escapeHtml(
                    toString(snapshot.runtimeState, 'unknown').toLowerCase()
                )}">
                    <header>
                        <strong>${escapeHtml(resolveSurfaceLabel(snapshot.surfaceKey))}</strong>
                        <span>${escapeHtml(toString(snapshot.runtimeState, 'unknown'))}</span>
                    </header>
                    <p>${escapeHtml(
                        `truth ${toString(snapshot.truth, 'unknown')} · region ${toString(
                            snapshot.region,
                            'regional'
                        )}`
                    )}</p>
                    <p>${escapeHtml(
                        `wave ${toString(snapshot.waveLabel, 'none')} · owner ${toString(
                            snapshot.fleetOwner,
                            'unassigned'
                        )} · batch ${toString(snapshot.rolloutBatch, 'unassigned')} · docs ${toString(
                            snapshot.documentationState,
                            'draft'
                        )}`
                    )}</p>
                    <p>${escapeHtml(formatTimestamp(snapshot.updatedAt))}</p>
                </article>
            `
        )
        .join('');
}

function buildEntriesHtml(entries = [], kind = 'items') {
    if (entries.length === 0) {
        return `<p class="turnero-admin-queue-surface-fleet-console__empty">Sin ${escapeHtml(
            kind
        )}.</p>`;
    }

    return `
        <ul class="turnero-admin-queue-surface-fleet-console__list">
            ${entries
                .slice(0, 12)
                .map(
                    (entry) => `
                        <li class="turnero-admin-queue-surface-fleet-console__list-item">
                            <strong>${escapeHtml(
                                entry.title ||
                                    entry.waveLabel ||
                                    entry.actor ||
                                    entry.owner ||
                                    'Item'
                            )}</strong>
                            <p>${escapeHtml(
                                `${toString(entry.surfaceKey, 'surface')} · ${toString(
                                    entry.status,
                                    'draft'
                                )} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
                            )}</p>
                            <p>${escapeHtml(
                                entry.note ||
                                    entry.role ||
                                    entry.batch ||
                                    entry.documentationState ||
                                    ''
                            )}</p>
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function buildConsoleBrief(state) {
    const lines = [
        '# Surface Fleet Readiness',
        '',
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Region: ${toString(state.scope, 'regional')}`,
        `Snapshots: ${state.snapshots.length}`,
        `Wave items: ${state.waves.length}`,
        `Owners: ${state.owners.length}`,
        `Gate: ${toString(state.gate.band, 'unknown')} (${Number(state.gate.score || 0)})`,
        `Decision: ${toString(state.gate.decision, 'review')}`,
        '',
        '## Snapshots',
    ];

    state.snapshots.forEach((snapshot) => {
        lines.push(
            `- ${resolveSurfaceLabel(snapshot.surfaceKey)} · ${toString(
                snapshot.runtimeState,
                'unknown'
            )} · wave ${toString(snapshot.waveLabel, 'none')} · owner ${toString(
                snapshot.fleetOwner,
                'unassigned'
            )} · docs ${toString(snapshot.documentationState, 'draft')}`
        );
    });

    lines.push('', '## Waves');
    if (state.waves.length === 0) {
        lines.push('- Sin wave items.');
    } else {
        state.waves.forEach((wave) => {
            lines.push(
                `- [${toString(wave.status, 'planned')}] ${toString(
                    wave.surfaceKey,
                    'surface'
                )} · ${toString(wave.title || wave.waveLabel, 'Wave item')} · ${toString(
                    wave.owner,
                    'ops'
                )} · ${toString(wave.note, '')}`
            );
        });
    }

    lines.push('', '## Owners');
    if (state.owners.length === 0) {
        lines.push('- Sin owner items.');
    } else {
        state.owners.forEach((owner) => {
            lines.push(
                `- [${toString(owner.status, 'active')}] ${toString(
                    owner.surfaceKey,
                    'surface'
                )} · ${toString(owner.actor || owner.owner, 'owner')} · ${toString(
                    owner.role,
                    'regional'
                )} · ${toString(owner.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        snapshots: state.snapshots,
        checklist: state.checklist,
        waves: state.waves,
        owners: state.owners,
        gate: state.gate,
        readout: state.readout,
        brief: state.brief,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
                : '',
    };
}

export function buildTurneroAdminQueueSurfaceFleetConsoleHtml(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const scope = getScope(input, clinicProfile);
    const snapshots = resolveSnapshots(input, clinicProfile, scope);
    const waveStore = createTurneroSurfaceWaveLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceFleetOwnerStore(
        scope,
        clinicProfile
    );
    const waves = waveStore.list();
    const owners = ownerStore.list();
    const checklist = normalizeChecklist(input);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceFleetGate({
                  checklist,
                  waves,
                  owners,
              });
    const pack = buildTurneroSurfaceFleetPack({
        scope,
        clinicProfile,
        snapshots,
        waves,
        owners,
        checklist,
        gate,
    });
    const readout = pack.readout;
    const brief = buildConsoleBrief({
        scope,
        clinicProfile,
        snapshots,
        waves,
        owners,
        checklist,
        gate,
        readout,
        clinicId: readout.clinicId,
        clinicLabel: readout.clinicLabel,
        generatedAt: new Date().toISOString(),
    });
    const surfaceOptions = snapshots
        .map(
            (snapshot) => `
                <option value="${escapeHtml(snapshot.surfaceKey)}">${escapeHtml(
                    resolveSurfaceLabel(snapshot.surfaceKey)
                )}</option>
            `
        )
        .join('');

    return `
        <section class="turnero-admin-queue-surface-fleet-console" data-scope="${escapeHtml(
            scope
        )}">
            <div class="turnero-admin-queue-surface-fleet-console__header">
                <div class="turnero-admin-queue-surface-fleet-console__header-copy">
                    <p class="turnero-admin-queue-surface-fleet-console__eyebrow">Fleet readiness console</p>
                    <h3>Surface Fleet Readiness</h3>
                    <p>Wave plan, fleet owner y gate de readiness multi-clínica.</p>
                    <p>${escapeHtml(
                        `${toString(readout.clinicLabel || readout.clinicId, 'n/a')} · ${toString(
                            scope,
                            'regional'
                        )}`
                    )}</p>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-fleet-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-fleet-console__button" data-action="download-json">Download JSON</button>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-fleet-console__metrics">
                <div class="turnero-admin-queue-surface-fleet-console__metric">
                    <span>Snapshots</span>
                    <strong data-role="snapshot-count">${snapshots.length}</strong>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__metric">
                    <span>Wave items</span>
                    <strong data-role="wave-count">${waves.length}</strong>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__metric">
                    <span>Owners</span>
                    <strong data-role="owner-count">${owners.length}</strong>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__metric">
                    <span>Fleet gate</span>
                    <strong data-role="gate-state">${escapeHtml(
                        `${toString(gate.band, 'unknown')} · ${Number(gate.score || 0)}`
                    )}</strong>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-fleet-console__grid">
                <div class="turnero-admin-queue-surface-fleet-console__panel">
                    <h4>Snapshots</h4>
                    <div data-role="snapshot-list">${buildSnapshotCardsHtml(snapshots)}</div>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__panel">
                    <h4>Wave items</h4>
                    <div data-role="wave-list">${buildEntriesHtml(waves, 'wave items')}</div>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__panel">
                    <h4>Fleet owners</h4>
                    <div data-role="owner-list">${buildEntriesHtml(owners, 'fleet owners')}</div>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__form">
                    <h4>Add wave</h4>
                    <label>
                        <span>Surface</span>
                        <select data-field="wave-surface-key">
                            ${surfaceOptions}
                        </select>
                    </label>
                    <label>
                        <span>Wave label</span>
                        <input type="text" data-field="wave-label" placeholder="Wave 1" />
                    </label>
                    <label>
                        <span>Wave note</span>
                        <textarea data-field="wave-note" placeholder="Wave note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-fleet-console__form-actions">
                        <button type="button" class="turnero-admin-queue-surface-fleet-console__button" data-action="add-wave">Add wave</button>
                    </div>
                </div>
                <div class="turnero-admin-queue-surface-fleet-console__form">
                    <h4>Add owner</h4>
                    <label>
                        <span>Surface</span>
                        <select data-field="owner-surface-key">
                            ${surfaceOptions}
                        </select>
                    </label>
                    <label>
                        <span>Owner</span>
                        <input type="text" data-field="owner-name" placeholder="ops-lead" />
                    </label>
                    <label>
                        <span>Owner note</span>
                        <textarea data-field="owner-note" placeholder="Owner note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-fleet-console__form-actions">
                        <button type="button" class="turnero-admin-queue-surface-fleet-console__button" data-action="add-owner">Add owner</button>
                    </div>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-fleet-console__section">
                <h4>Brief</h4>
                <pre class="turnero-admin-queue-surface-fleet-console__brief" data-role="brief">${escapeHtml(
                    brief
                )}</pre>
            </div>
        </section>
    `;
}

export function mountTurneroAdminQueueSurfaceFleetConsole(target, input = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureFleetConsoleStyles();
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const scope = getScope(input, clinicProfile);
    const waveStore = createTurneroSurfaceWaveLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceFleetOwnerStore(
        scope,
        clinicProfile
    );

    const state = {
        scope,
        clinicProfile,
        snapshots: resolveSnapshots(input, clinicProfile, scope),
        checklist: normalizeChecklist(input),
        waves: waveStore.list(),
        owners: ownerStore.list(),
        gate: null,
        readout: null,
        brief: '',
        generatedAt: new Date().toISOString(),
    };

    function recompute() {
        state.snapshots = resolveSnapshots(input, clinicProfile, scope);
        state.waves = waveStore.list();
        state.owners = ownerStore.list();
        state.gate =
            input.gate && typeof input.gate === 'object'
                ? input.gate
                : buildTurneroSurfaceFleetGate({
                      checklist: state.checklist,
                      waves: state.waves,
                      owners: state.owners,
                  });
        const pack = buildTurneroSurfaceFleetPack({
            scope,
            clinicProfile,
            snapshots: state.snapshots,
            waves: state.waves,
            owners: state.owners,
            checklist: state.checklist,
            gate: state.gate,
        });
        state.readout = pack.readout;
        state.brief = buildConsoleBrief({
            ...state,
            gate: state.gate,
        });
        state.generatedAt = pack.generatedAt;

        const snapshotCountNode = host.querySelector(
            '[data-role="snapshot-count"]'
        );
        const waveCountNode = host.querySelector('[data-role="wave-count"]');
        const ownerCountNode = host.querySelector('[data-role="owner-count"]');
        const gateStateNode = host.querySelector('[data-role="gate-state"]');
        const briefNode = host.querySelector('[data-role="brief"]');
        const snapshotListNode = host.querySelector(
            '[data-role="snapshot-list"]'
        );
        const waveListNode = host.querySelector('[data-role="wave-list"]');
        const ownerListNode = host.querySelector('[data-role="owner-list"]');

        if (snapshotCountNode) {
            snapshotCountNode.textContent = String(state.snapshots.length);
        }
        if (waveCountNode) {
            waveCountNode.textContent = String(state.waves.length);
        }
        if (ownerCountNode) {
            ownerCountNode.textContent = String(state.owners.length);
        }
        if (gateStateNode) {
            gateStateNode.textContent = `${toString(
                state.gate.band,
                'unknown'
            )} · ${Number(state.gate.score || 0)}`;
        }
        if (briefNode) {
            briefNode.textContent = state.brief;
        }
        if (snapshotListNode) {
            snapshotListNode.innerHTML = buildSnapshotCardsHtml(
                state.snapshots
            );
        }
        if (waveListNode) {
            waveListNode.innerHTML = buildEntriesHtml(
                state.waves,
                'wave items'
            );
        }
        if (ownerListNode) {
            ownerListNode.innerHTML = buildEntriesHtml(
                state.owners,
                'fleet owners'
            );
        }
    }

    host.className = 'turnero-admin-queue-surface-fleet-console-host';
    host.innerHTML = buildTurneroAdminQueueSurfaceFleetConsoleHtml(input);

    host.addEventListener('click', async (event) => {
        const actionNode = event.target?.closest?.('[data-action]');
        if (!(actionNode instanceof HTMLElement)) {
            return;
        }

        const action = toString(actionNode.dataset.action, '');
        if (action === 'copy-brief') {
            await copyTextToClipboard(state.brief);
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-fleet-readiness.json',
                buildDownloadSnapshot(state)
            );
            return;
        }
        if (action === 'add-wave') {
            const surfaceKey = toString(
                host.querySelector('[data-field="wave-surface-key"]')?.value,
                ''
            );
            const label = toString(
                host.querySelector('[data-field="wave-label"]')?.value,
                ''
            );
            const note = toString(
                host.querySelector('[data-field="wave-note"]')?.value,
                ''
            );
            if (!surfaceKey) {
                return;
            }
            waveStore.add({
                surfaceKey,
                title: label || 'Wave item',
                waveLabel: label || 'Wave item',
                owner: 'ops',
                status: 'planned',
                note,
            });
            recompute();
            return;
        }
        if (action === 'add-owner') {
            const surfaceKey = toString(
                host.querySelector('[data-field="owner-surface-key"]')?.value,
                ''
            );
            const owner = toString(
                host.querySelector('[data-field="owner-name"]')?.value,
                ''
            );
            const note = toString(
                host.querySelector('[data-field="owner-note"]')?.value,
                ''
            );
            if (!surfaceKey) {
                return;
            }
            ownerStore.add({
                surfaceKey,
                actor: owner || 'owner',
                owner: owner || 'owner',
                role: 'regional',
                status: 'active',
                note,
            });
            recompute();
        }
    });

    recompute();
    return {
        root: host,
        pack: state,
        recompute,
    };
}
