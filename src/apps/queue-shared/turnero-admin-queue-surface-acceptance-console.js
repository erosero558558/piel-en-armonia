import { buildTurneroSurfaceAcceptancePack } from './turnero-surface-acceptance-pack.js';
import { buildTurneroSurfaceAcceptanceBannerHtml } from './turnero-surface-acceptance-banner.js';
import { formatTurneroSurfaceAcceptanceReadoutBrief } from './turnero-surface-acceptance-readout.js';
import { createTurneroSurfaceAcceptanceLedger } from './turnero-surface-acceptance-ledger.js';
import { createTurneroSurfaceStakeholderSignoffStore } from './turnero-surface-stakeholder-signoff-store.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
} from './turnero-release-control-center.js';
import {
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';
import {
    normalizeTurneroSurfaceAcceptanceKey,
    normalizeTurneroSurfaceAcceptanceOperationalState,
    resolveTurneroSurfaceAcceptancePreset,
} from './turnero-surface-acceptance-snapshot.js';

const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'display', 'admin']);
const STYLE_ID = 'turneroAdminQueueSurfaceAcceptanceConsoleStyles';

function surfaceOrderRank(surfaceKey) {
    const index = SURFACE_ORDER.indexOf(
        normalizeTurneroSurfaceAcceptanceKey(surfaceKey)
    );
    return index >= 0 ? index : SURFACE_ORDER.length;
}

function ensureConsoleStyles() {
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
        .turnero-admin-queue-surface-acceptance-console__shell {
            display: grid;
            gap: 0.85rem;
        }
        .turnero-admin-queue-surface-acceptance-console {
            display: grid;
            gap: 0.85rem;
        }
        .turnero-admin-queue-surface-acceptance-console__summary-chips {
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-acceptance-console__grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 0.85rem;
        }
        .turnero-admin-queue-surface-acceptance-console__surface {
            gap: 0.7rem;
        }
        .turnero-admin-queue-surface-acceptance-console__surface[data-state='ready'] {
            border-color: rgb(22 163 74 / 20%);
        }
        .turnero-admin-queue-surface-acceptance-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-acceptance-console__surface[data-state='degraded'] {
            border-color: rgb(234 179 8 / 18%);
        }
        .turnero-admin-queue-surface-acceptance-console__surface[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-admin-queue-surface-acceptance-console__form,
        .turnero-admin-queue-surface-acceptance-console__list,
        .turnero-admin-queue-surface-acceptance-console__section {
            display: grid;
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-acceptance-console__form {
            padding: 0.7rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 8%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-acceptance-console__form label {
            display: grid;
            gap: 0.25rem;
            font-size: 0.8rem;
        }
        .turnero-admin-queue-surface-acceptance-console__form input,
        .turnero-admin-queue-surface-acceptance-console__form select,
        .turnero-admin-queue-surface-acceptance-console__form textarea {
            width: 100%;
            min-height: 36px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 94%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-acceptance-console__form textarea {
            min-height: 72px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-acceptance-console__form-actions,
        .turnero-admin-queue-surface-acceptance-console__surface-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-acceptance-console__list-item {
            display: flex;
            justify-content: space-between;
            gap: 0.7rem;
            align-items: flex-start;
            padding: 0.55rem 0.65rem;
            border-radius: 14px;
            border: 1px solid rgb(15 23 32 / 9%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-acceptance-console__list-item p,
        .turnero-admin-queue-surface-acceptance-console__meta {
            margin: 0;
        }
        .turnero-admin-queue-surface-acceptance-console__brief {
            margin: 0;
            padding: 0.8rem 0.9rem;
            border-radius: 18px;
            background: rgb(15 23 32 / 4%);
            border: 1px solid rgb(15 23 32 / 7%);
            white-space: pre-wrap;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getScope(input = {}) {
    return toString(
        input.scope ||
            input.clinicProfile?.clinic_id ||
            input.clinicProfile?.clinicId ||
            'global',
        'global'
    );
}

function resolveSurfaceRoute(clinicProfile, surfaceKey) {
    const preset = resolveTurneroSurfaceAcceptancePreset(surfaceKey);
    return toString(
        clinicProfile?.surfaces?.[surfaceKey]?.route ||
            clinicProfile?.surfaces?.[surfaceKey]?.path ||
            preset.route ||
            '',
        preset.route || ''
    );
}

function buildSurfacePackFromSource({
    source = {},
    clinicProfile,
    telemetryEntry,
    ledger,
    signoffStore,
} = {}) {
    const raw = asObject(source);
    const existingPack = asObject(raw.pack || source.pack);
    const explicitSnapshot = asObject(existingPack.snapshot || raw.snapshot);
    const explicitGate = asObject(existingPack.gate || raw.gate);
    const explicitReadout = asObject(
        existingPack.readout || raw.readout || explicitSnapshot.readout
    );
    const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
        raw.surfaceKey ||
            explicitSnapshot.surfaceKey ||
            explicitGate.surfaceKey ||
            existingPack.surfaceKey ||
            'operator'
    );
    const label = toString(
        raw.label ||
            existingPack.label ||
            explicitReadout.surfaceLabel ||
            explicitSnapshot.surfaceLabel ||
            surfaceKey
    );

    if (
        explicitSnapshot.contract ||
        explicitGate.band ||
        explicitReadout.summary
    ) {
        return {
            surfaceKey,
            label,
            pack: {
                ...existingPack,
                surfaceKey,
                label,
                snapshot: {
                    ...explicitSnapshot,
                    surfaceKey,
                },
                gate: {
                    ...explicitGate,
                    surfaceKey,
                },
                readout: {
                    ...explicitReadout,
                    surfaceKey,
                },
            },
            evidence: toArray(
                raw.evidence ||
                    existingPack.evidence ||
                    explicitSnapshot.evidence
            ),
            signoffs: toArray(
                raw.signoffs ||
                    existingPack.signoffs ||
                    explicitSnapshot.signoffs
            ),
        };
    }

    const preset = resolveTurneroSurfaceAcceptancePreset(surfaceKey);
    const runtimeState = normalizeTurneroSurfaceAcceptanceOperationalState(
        telemetryEntry?.state ||
            telemetryEntry?.status ||
            raw.runtimeState ||
            preset.runtimeState,
        preset.runtimeState
    );
    const pack = buildTurneroSurfaceAcceptancePack({
        surfaceKey,
        clinicProfile,
        currentRoute: resolveSurfaceRoute(clinicProfile, surfaceKey),
        runtimeState,
        truth: raw.truth || preset.truth,
        acceptanceOwner:
            raw.acceptanceOwner || raw.owner || preset.acceptanceOwner,
        siteStatus: raw.siteStatus || preset.siteStatus,
        trainingStatus: raw.trainingStatus || preset.trainingStatus,
        signoffMode: raw.signoffMode || preset.signoffMode,
        checklist: raw.checklist || preset.checklist,
        evidence: ledger?.list?.({ surfaceKey }) || [],
        signoffs: signoffStore?.list?.({ surfaceKey }) || [],
    });

    return {
        surfaceKey,
        label,
        pack,
        evidence: pack.evidence || [],
        signoffs: pack.signoffs || [],
        telemetryEntry: telemetryEntry || null,
    };
}

function resolveSurfacePackItems(
    input = {},
    clinicProfile,
    ledger,
    signoffStore
) {
    const explicitItems =
        typeof input.getSurfacePacks === 'function'
            ? input.getSurfacePacks()
            : input.snapshots || input.surfacePacks;
    if (Array.isArray(explicitItems) && explicitItems.length > 0) {
        return explicitItems
            .map((item) =>
                buildSurfacePackFromSource({
                    source: item,
                    clinicProfile,
                    ledger,
                    signoffStore,
                })
            )
            .sort(
                (left, right) =>
                    surfaceOrderRank(left.surfaceKey) -
                    surfaceOrderRank(right.surfaceKey)
            );
    }

    const telemetryMap = asObject(input.telemetryMap);
    const surfaceRegistry = asObject(input.surfaceRegistry);
    const surfaceKeys = toArray(input.surfaceKeys)
        .map((key) => normalizeTurneroSurfaceAcceptanceKey(key))
        .filter(Boolean);
    if (!surfaceKeys.length) {
        surfaceKeys.push('operator', 'kiosk', 'display');
    }

    return surfaceKeys
        .map((surfaceKey) => {
            const registryEntry = asObject(surfaceRegistry[surfaceKey]);
            const telemetryEntry = asObject(telemetryMap[surfaceKey]);
            return buildSurfacePackFromSource({
                source: {
                    surfaceKey,
                    label:
                        registryEntry.label ||
                        registryEntry.title ||
                        surfaceKey,
                    acceptanceOwner: registryEntry.acceptanceOwner || '',
                    truth: registryEntry.truth || '',
                    runtimeState: registryEntry.runtimeState || '',
                    siteStatus: registryEntry.siteStatus || '',
                    trainingStatus: registryEntry.trainingStatus || '',
                    signoffMode: registryEntry.signoffMode || '',
                },
                clinicProfile,
                telemetryEntry,
                ledger,
                signoffStore,
            });
        })
        .sort(
            (left, right) =>
                surfaceOrderRank(left.surfaceKey) -
                surfaceOrderRank(right.surfaceKey)
        );
}

function summarizeOverallGate(surfacePacks = []) {
    const gates = toArray(surfacePacks).map((item) =>
        asObject(item.pack?.gate)
    );
    const blocked = gates.some((gate) => gate.band === 'blocked');
    const degraded = gates.some((gate) => gate.band === 'degraded');
    const watch = gates.some((gate) => gate.band === 'watch');
    const score = gates.length
        ? Math.round(
              gates.reduce(
                  (accumulator, gate) => accumulator + Number(gate.score || 0),
                  0
              ) / gates.length
          )
        : 0;
    const band = blocked
        ? 'blocked'
        : degraded
          ? 'degraded'
          : watch
            ? 'watch'
            : 'ready';

    return {
        band,
        score,
        summary:
            band === 'blocked'
                ? 'Aceptación global bloqueada.'
                : band === 'degraded'
                  ? 'Aceptación global degradada.'
                  : band === 'watch'
                    ? 'Aceptación global bajo observacion.'
                    : 'Aceptación global lista.',
        generatedAt: new Date().toISOString(),
    };
}

function buildConsoleBrief(state) {
    const overall = asObject(state.overallGate);
    const lines = [
        '# Surface Acceptance Console',
        '',
        `Scope: ${toString(state.scope, 'global')}`,
        `Clinic: ${toString(
            state.clinicLabel || state.clinicProfile?.branding?.name || '',
            'sin-clinica'
        )}`,
        `Gate: ${toString(overall.band, 'watch')} (${Number(overall.score || 0) || 0})`,
        `Evidence: ${Number(state.evidenceSummary?.total || 0) || 0}`,
        `Signoffs: ${Number(state.signoffSummary?.approve || 0) || 0}/${
            Number(state.signoffSummary?.total || 0) || 0
        }`,
        '',
    ];

    state.surfacePacks.forEach((item) => {
        lines.push(
            formatTurneroSurfaceAcceptanceReadoutBrief(item.pack.readout)
        );
        lines.push('');
    });

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state, surfaceKey = '') {
    const currentRoute =
        typeof window !== 'undefined'
            ? `${window.location.pathname || ''}${window.location.search || ''}${
                  window.location.hash || ''
              }`
            : '';

    const filteredSurfacePacks = surfaceKey
        ? state.surfacePacks.filter(
              (item) =>
                  item.surfaceKey ===
                  normalizeTurneroSurfaceAcceptanceKey(surfaceKey)
          )
        : state.surfacePacks;

    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        overallGate: state.overallGate,
        evidenceSummary: state.evidenceSummary,
        signoffSummary: state.signoffSummary,
        surfacePacks: filteredSurfacePacks.map((item) => ({
            surfaceKey: item.surfaceKey,
            label: item.label,
            pack: item.pack,
            evidence: item.evidence,
            signoffs: item.signoffs,
        })),
        generatedAt: state.generatedAt,
        brief: state.brief,
        currentRoute,
    };
}

function renderChipHtml(chip) {
    return `
        <span class="queue-ops-pilot__chip turnero-surface-ops__chip" data-state="${escapeHtml(
            chip.state
        )}">
            <span>${escapeHtml(chip.label)}</span>
            <strong>${escapeHtml(chip.value)}</strong>
        </span>
    `;
}

function renderChipsHtml(chips = []) {
    return toArray(chips)
        .map((chip) => renderChipHtml(chip))
        .join('');
}

function renderEvidenceItems(items = []) {
    const rows = toArray(items);
    if (!rows.length) {
        return '<p class="turnero-admin-queue-surface-acceptance-console__meta">Sin evidencia registrada.</p>';
    }

    return rows
        .map(
            (item) => `
                <article class="turnero-admin-queue-surface-acceptance-console__list-item" data-evidence-id="${escapeHtml(
                    item.id
                )}">
                    <div>
                        <strong>${escapeHtml(item.title || 'Evidence')}</strong>
                        <p>${escapeHtml(
                            `${item.surfaceKey || 'surface'} · ${item.status || 'captured'} · ${formatTimestamp(item.updatedAt || item.createdAt || item.capturedAt)}`
                        )}</p>
                        <p>${escapeHtml(item.note || 'Sin nota')}</p>
                    </div>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="remove-evidence" data-evidence-id="${escapeHtml(
                        item.id
                    )}">Eliminar</button>
                </article>
            `
        )
        .join('');
}

function renderSignoffItems(items = []) {
    const rows = toArray(items);
    if (!rows.length) {
        return '<p class="turnero-admin-queue-surface-acceptance-console__meta">Sin signoff registrado.</p>';
    }

    return rows
        .map(
            (item) => `
                <article class="turnero-admin-queue-surface-acceptance-console__list-item" data-signoff-id="${escapeHtml(
                    item.id
                )}">
                    <div>
                        <strong>${escapeHtml(item.stakeholder || 'stakeholder')}</strong>
                        <p>${escapeHtml(
                            `${item.role || 'reviewer'} · ${item.verdict || 'review'} · ${formatTimestamp(item.updatedAt || item.createdAt)}`
                        )}</p>
                        <p>${escapeHtml(item.note || 'Sin nota')}</p>
                    </div>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="remove-signoff" data-signoff-id="${escapeHtml(
                        item.id
                    )}">Eliminar</button>
                </article>
            `
        )
        .join('');
}

function renderEvidenceForm(
    surfacePacks = [],
    selectedSurfaceKey = surfacePacks[0]?.surfaceKey || 'operator'
) {
    const options = toArray(surfacePacks)
        .map(
            (item) => `
                <option value="${escapeHtml(item.surfaceKey)}"${
                    normalizeTurneroSurfaceAcceptanceKey(item.surfaceKey) ===
                    normalizeTurneroSurfaceAcceptanceKey(selectedSurfaceKey)
                        ? ' selected'
                        : ''
                }>${escapeHtml(item.label || item.surfaceKey)}</option>
            `
        )
        .join('');

    return `
        <form class="turnero-admin-queue-surface-acceptance-console__form" data-role="evidence-form" data-surface="${escapeHtml(
            normalizeTurneroSurfaceAcceptanceKey(selectedSurfaceKey)
        )}">
            <label>
                <span>Surface</span>
                <select data-field="evidence-surface-key">${options}</select>
            </label>
            <label>
                <span>Titulo</span>
                <input type="text" data-field="evidence-title" placeholder="Manual evidence" />
            </label>
            <label>
                <span>Estado</span>
                <select data-field="evidence-status">
                    <option value="captured">captured</option>
                    <option value="review">review</option>
                    <option value="resolved">resolved</option>
                    <option value="missing">missing</option>
                    <option value="stale">stale</option>
                </select>
            </label>
            <label>
                <span>Nota</span>
                <textarea data-field="evidence-note" placeholder="Que se valido manualmente"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-acceptance-console__form-actions">
                <button type="button" class="turnero-surface-ops-console__button" data-action="add-evidence">Registrar evidencia</button>
                <button type="button" class="turnero-surface-ops-console__button" data-action="clear-evidence">Limpiar evidencia</button>
            </div>
        </form>
    `;
}

function renderSignoffForm(
    surfacePacks = [],
    selectedSurfaceKey = surfacePacks[0]?.surfaceKey || 'operator'
) {
    const options = toArray(surfacePacks)
        .map(
            (item) => `
                <option value="${escapeHtml(item.surfaceKey)}"${
                    normalizeTurneroSurfaceAcceptanceKey(item.surfaceKey) ===
                    normalizeTurneroSurfaceAcceptanceKey(selectedSurfaceKey)
                        ? ' selected'
                        : ''
                }>${escapeHtml(item.label || item.surfaceKey)}</option>
            `
        )
        .join('');

    return `
        <form class="turnero-admin-queue-surface-acceptance-console__form" data-role="signoff-form" data-surface="${escapeHtml(
            normalizeTurneroSurfaceAcceptanceKey(selectedSurfaceKey)
        )}">
            <label>
                <span>Surface</span>
                <select data-field="signoff-surface-key">${options}</select>
            </label>
            <label>
                <span>Stakeholder</span>
                <input type="text" data-field="signoff-stakeholder" placeholder="ops lead" />
            </label>
            <label>
                <span>Role</span>
                <input type="text" data-field="signoff-role" placeholder="reviewer" />
            </label>
            <label>
                <span>Verdict</span>
                <select data-field="signoff-verdict">
                    <option value="approve">approve</option>
                    <option value="review">review</option>
                    <option value="reject">reject</option>
                </select>
            </label>
            <label>
                <span>Nota</span>
                <textarea data-field="signoff-note" placeholder="Observaciones del stakeholder"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-acceptance-console__form-actions">
                <button type="button" class="turnero-surface-ops-console__button" data-action="add-signoff">Registrar signoff</button>
                <button type="button" class="turnero-surface-ops-console__button" data-action="clear-signoffs">Limpiar signoff(s)</button>
            </div>
        </form>
    `;
}

function renderSurfaceCardHtml(item, surfacePacks = []) {
    const pack = asObject(item.pack);
    const snapshot = asObject(pack.snapshot);
    const readout = asObject(pack.readout);
    const gate = asObject(pack.gate);
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    const signoffs = Array.isArray(item.signoffs) ? item.signoffs : [];
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);

    return `
        <article class="turnero-surface-ops-console__surface turnero-admin-queue-surface-acceptance-console__surface" data-state="${escapeHtml(
            readout.gateBand || gate.band || 'watch'
        )}" data-surface="${escapeHtml(item.surfaceKey)}">
            <div class="turnero-surface-ops-console__surface-header">
                <div>
                    <strong class="turnero-surface-ops-console__surface-title">${escapeHtml(
                        item.label || readout.surfaceLabel || item.surfaceKey
                    )}</strong>
                    <p class="turnero-surface-ops-console__meta">${escapeHtml(
                        readout.summary || 'Surface acceptance'
                    )}</p>
                </div>
                <div class="turnero-admin-queue-surface-acceptance-console__surface-actions">
                    <button type="button" class="turnero-surface-ops-console__button" data-action="copy-surface" data-surface="${escapeHtml(
                        item.surfaceKey
                    )}">Copy</button>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="download-surface" data-surface="${escapeHtml(
                        item.surfaceKey
                    )}">Download</button>
                </div>
            </div>

            ${buildTurneroSurfaceAcceptanceBannerHtml({
                readout,
                gate,
                snapshot,
                title: `${item.label || readout.surfaceLabel || item.surfaceKey} acceptance`,
            })}

            <div class="turnero-surface-ops__chips turnero-admin-queue-surface-acceptance-console__surface-chips">
                ${renderChipsHtml(readout.chips)}
            </div>

            <section class="turnero-admin-queue-surface-acceptance-console__section">
                <h4>Evidence</h4>
                <p class="turnero-surface-ops-console__meta">${escapeHtml(
                    evidenceSummary.detail || 'Evidence list'
                )}</p>
                ${renderEvidenceForm(surfacePacks, item.surfaceKey)}
                <div class="turnero-admin-queue-surface-acceptance-console__list">
                    ${renderEvidenceItems(evidence)}
                </div>
            </section>

            <section class="turnero-admin-queue-surface-acceptance-console__section">
                <h4>Signoffs</h4>
                <p class="turnero-surface-ops-console__meta">${escapeHtml(
                    signoffSummary.detail || 'Stakeholder signoffs'
                )}</p>
                ${renderSignoffForm(surfacePacks, item.surfaceKey)}
                <div class="turnero-admin-queue-surface-acceptance-console__list">
                    ${renderSignoffItems(signoffs)}
                </div>
            </section>

            <section class="turnero-admin-queue-surface-acceptance-console__section">
                <h4>Resumen</h4>
                <p class="turnero-surface-ops-console__meta">
                    Checklist ${escapeHtml(
                        `${Number(checklist.pass || 0) || 0}/${Number(checklist.all || 0) || 0}`
                    )} · Evidence ${escapeHtml(
                        String(Number(evidenceSummary.total || 0) || 0)
                    )} · Signoffs ${escapeHtml(
                        String(Number(signoffSummary.total || 0) || 0)
                    )}
                </p>
            </section>
        </article>
    `;
}

function summarizeChipState(value, fallback = 'warning') {
    const normalized = toString(value, fallback).toLowerCase();
    switch (normalized) {
        case 'ready':
        case 'watch':
        case 'degraded':
        case 'blocked':
            return normalized;
        case 'review':
            return 'watch';
        case 'alert':
            return 'blocked';
        default:
            return fallback;
    }
}

function buildSummaryChips(state) {
    return [
        {
            label: 'Surfaces',
            value: String(Number(state.surfacePacks?.length || 0) || 0),
            state:
                Number(state.surfacePacks?.length || 0) > 0 ? 'ready' : 'watch',
        },
        {
            label: 'Gate',
            value: `${toString(state.overallGate?.band, 'watch')} · ${
                Number(state.overallGate?.score || 0) || 0
            }`,
            state: summarizeChipState(state.overallGate?.band, 'watch'),
        },
        {
            label: 'Evidence',
            value: String(Number(state.evidenceSummary?.total || 0) || 0),
            state: summarizeChipState(state.evidenceSummary?.state, 'watch'),
        },
        {
            label: 'Signoffs',
            value: `${Number(state.signoffSummary?.approve || 0) || 0}/${
                Number(state.signoffSummary?.total || 0) || 0
            }`,
            state: summarizeChipState(state.signoffSummary?.state, 'watch'),
        },
    ];
}

function buildTurneroAdminQueueSurfaceAcceptanceConsoleHtml(state = {}) {
    const clinicLabel = toString(
        state.clinicLabel ||
            state.clinicProfile?.branding?.name ||
            state.clinicProfile?.branding?.short_name ||
            state.clinicProfile?.clinic_id,
        'sin-clinica'
    );
    const generatedAt = formatTimestamp(
        state.generatedAt || new Date().toISOString()
    );
    const brief = toString(state.brief || '');
    const surfaceCount = Number(state.surfacePacks?.length || 0) || 0;
    const surfaceCards = toArray(state.surfacePacks)
        .map((item) => renderSurfaceCardHtml(item, state.surfacePacks))
        .join('');

    return `
        <section class="turnero-admin-queue-surface-acceptance-console__shell">
            <div class="turnero-surface-ops-console__header">
                <div>
                    <p class="queue-app-card__eyebrow">Surface acceptance / signoff</p>
                    <h3>Consola de aceptación clínica</h3>
                    <p class="turnero-surface-ops-console__meta">
                        Scope ${escapeHtml(toString(state.scope, 'global'))} · Clinica ${escapeHtml(
                            clinicLabel
                        )} · ${escapeHtml(
                            toString(
                                state.overallGate?.summary,
                                'Aceptación global lista.'
                            )
                        )}
                    </p>
                    <p class="turnero-surface-ops-console__meta">
                        ${escapeHtml(
                            `${surfaceCount} surface(s) · render ${generatedAt}`
                        )}
                    </p>
                </div>
                <div class="turnero-surface-ops-console__actions">
                    <button
                        type="button"
                        class="turnero-surface-ops-console__button"
                        data-action="copy-all"
                        data-tone="primary"
                    >
                        Copiar brief
                    </button>
                    <button
                        type="button"
                        class="turnero-surface-ops-console__button"
                        data-action="download-all"
                    >
                        Descargar snapshot
                    </button>
                </div>
            </div>

            <div class="turnero-surface-ops__chips turnero-admin-queue-surface-acceptance-console__summary-chips">
                ${renderChipsHtml(buildSummaryChips(state))}
            </div>

            <pre class="turnero-admin-queue-surface-acceptance-console__brief" data-role="brief">${escapeHtml(
                brief
            )}</pre>

            <div class="turnero-admin-queue-surface-acceptance-console__grid">
                ${surfaceCards}
            </div>
        </section>
    `;
}

function getConsoleSurfacePack(state = {}, surfaceKey = '') {
    const normalizedSurfaceKey =
        normalizeTurneroSurfaceAcceptanceKey(surfaceKey);
    return toArray(state.surfacePacks).find(
        (item) => item.surfaceKey === normalizedSurfaceKey
    );
}

function getFormValue(container, selector, fallback = '') {
    const node = container?.querySelector?.(selector);
    return toString(node?.value || node?.textContent || '', fallback);
}

function getActionSurfaceKey(actionNode, selectorFallback = '') {
    const current = actionNode?.closest?.('[data-surface]');
    return normalizeTurneroSurfaceAcceptanceKey(
        current?.getAttribute?.('data-surface') ||
            current?.dataset?.surface ||
            actionNode?.getAttribute?.('data-surface') ||
            selectorFallback
    );
}

function refreshDerivedState(controller) {
    const surfacePacks = resolveSurfacePackItems(
        controller.input,
        controller.clinicProfile,
        controller.ledger,
        controller.signoffStore
    );
    const overallGate = summarizeOverallGate(surfacePacks);
    const evidenceSummary = controller.ledger.summary();
    const signoffSummary = controller.signoffStore.summary();
    const generatedAt = new Date().toISOString();

    Object.assign(controller.state, {
        scope: controller.scope,
        clinicProfile: controller.clinicProfile,
        clinicLabel: controller.clinicLabel,
        surfacePacks,
        overallGate,
        evidenceSummary,
        signoffSummary,
        generatedAt,
    });
    controller.state.brief = buildConsoleBrief(controller.state);
    return controller.state;
}

function renderConsole(controller) {
    const host = controller?.host;
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const state = controller.state;
    host.className =
        'turnero-admin-queue-surface-acceptance-console queue-app-card';
    host.dataset.turneroAdminQueueSurfaceAcceptanceConsole = 'mounted';
    host.dataset.turneroAdminQueueSurfaceAcceptanceBand = toString(
        state.overallGate?.band,
        'watch'
    );
    host.dataset.turneroAdminQueueSurfaceAcceptanceScope = toString(
        state.scope,
        'global'
    );
    host.dataset.turneroAdminQueueSurfaceAcceptanceSurfaceCount = String(
        Number(state.surfacePacks?.length || 0) || 0
    );
    host.innerHTML = buildTurneroAdminQueueSurfaceAcceptanceConsoleHtml(state);
    return host;
}

function getControllerState(controller) {
    return controller?.state || null;
}

function bindConsoleActions(controller) {
    const host = controller?.host;
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const handleClick = async (event) => {
        const actionNode =
            event?.target?.closest?.('[data-action]') ||
            (event?.target?.getAttribute?.('data-action')
                ? event.target
                : null);
        const action = toString(actionNode?.getAttribute?.('data-action'), '');
        if (!action) {
            return;
        }

        const state = getControllerState(controller);
        if (!state) {
            return;
        }

        if (action === 'copy-all') {
            await copyToClipboardSafe(state.brief || buildConsoleBrief(state));
            return;
        }

        if (action === 'download-all') {
            downloadJsonSnapshot(
                'turnero-admin-queue-surface-acceptance-console.json',
                buildDownloadSnapshot(state)
            );
            return;
        }

        if (action === 'copy-surface' || action === 'download-surface') {
            const surfaceKey = getActionSurfaceKey(actionNode);
            const pack = getConsoleSurfacePack(state, surfaceKey);
            if (!pack) {
                return;
            }

            if (action === 'copy-surface') {
                await copyToClipboardSafe(
                    formatTurneroSurfaceAcceptanceReadoutBrief(
                        pack.pack.readout
                    )
                );
                return;
            }

            downloadJsonSnapshot(
                `turnero-surface-acceptance-${surfaceKey}.json`,
                buildDownloadSnapshot(state, surfaceKey)
            );
            return;
        }

        if (action === 'remove-evidence') {
            const evidenceId = toString(
                actionNode?.getAttribute?.('data-evidence-id') ||
                    actionNode?.dataset?.evidenceId,
                ''
            );
            if (!evidenceId) {
                return;
            }

            controller.ledger.remove(evidenceId);
            refreshDerivedState(controller);
            renderConsole(controller);
            return;
        }

        if (action === 'clear-evidence' || action === 'add-evidence') {
            const form = actionNode?.closest?.('[data-role="evidence-form"]');
            const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
                getFormValue(form, '[data-field="evidence-surface-key"]') ||
                    form?.dataset?.surface ||
                    controller.state.surfacePacks[0]?.surfaceKey ||
                    'operator'
            );

            if (action === 'clear-evidence') {
                controller.ledger.clear({ surfaceKey });
                refreshDerivedState(controller);
                renderConsole(controller);
                return;
            }

            controller.ledger.add({
                surfaceKey,
                title: getFormValue(
                    form,
                    '[data-field="evidence-title"]',
                    'Evidencia manual'
                ),
                status: getFormValue(
                    form,
                    '[data-field="evidence-status"]',
                    'captured'
                ),
                note: getFormValue(form, '[data-field="evidence-note"]', ''),
                owner:
                    toString(controller.clinicProfile?.branding?.short_name) ||
                    toString(controller.clinicProfile?.branding?.name) ||
                    'ops',
                source: 'manual',
            });
            refreshDerivedState(controller);
            renderConsole(controller);
            return;
        }

        if (action === 'remove-signoff') {
            const signoffId = toString(
                actionNode?.getAttribute?.('data-signoff-id') ||
                    actionNode?.dataset?.signoffId,
                ''
            );
            if (!signoffId) {
                return;
            }

            controller.signoffStore.remove(signoffId);
            refreshDerivedState(controller);
            renderConsole(controller);
            return;
        }

        if (action === 'clear-signoffs' || action === 'add-signoff') {
            const form = actionNode?.closest?.('[data-role="signoff-form"]');
            const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
                getFormValue(form, '[data-field="signoff-surface-key"]') ||
                    form?.dataset?.surface ||
                    controller.state.surfacePacks[0]?.surfaceKey ||
                    'operator'
            );

            if (action === 'clear-signoffs') {
                controller.signoffStore.clear({ surfaceKey });
                refreshDerivedState(controller);
                renderConsole(controller);
                return;
            }

            controller.signoffStore.add({
                surfaceKey,
                stakeholder: getFormValue(
                    form,
                    '[data-field="signoff-stakeholder"]',
                    'stakeholder'
                ),
                role: getFormValue(
                    form,
                    '[data-field="signoff-role"]',
                    'reviewer'
                ),
                verdict: getFormValue(
                    form,
                    '[data-field="signoff-verdict"]',
                    'review'
                ),
                note: getFormValue(form, '[data-field="signoff-note"]', ''),
                source: 'manual',
            });
            refreshDerivedState(controller);
            renderConsole(controller);
        }
    };

    controller.handleClick = handleClick;
    host.addEventListener('click', handleClick);
    return handleClick;
}

export function mountTurneroAdminQueueSurfaceAcceptanceConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureConsoleStyles();

    const clinicProfile = asObject(input.clinicProfile || input.profile);
    const ledger =
        input.ledger && typeof input.ledger.list === 'function'
            ? input.ledger
            : createTurneroSurfaceAcceptanceLedger(clinicProfile, {
                  storageKey: input.ledgerStorageKey,
              });
    const signoffStore =
        input.signoffStore && typeof input.signoffStore.list === 'function'
            ? input.signoffStore
            : createTurneroSurfaceStakeholderSignoffStore(clinicProfile, {
                  storageKey: input.signoffStorageKey,
              });

    const controller = {
        host,
        input,
        clinicProfile,
        clinicLabel: toString(
            input.clinicLabel ||
                clinicProfile?.branding?.name ||
                clinicProfile?.branding?.short_name ||
                clinicProfile?.clinic_id,
            'sin-clinica'
        ),
        scope: getScope(input),
        ledger,
        signoffStore,
        state: {
            scope: '',
            clinicProfile,
            clinicLabel: '',
            surfacePacks: [],
            overallGate: {
                band: 'watch',
                score: 0,
                summary: '',
                generatedAt: '',
            },
            evidenceSummary: {
                total: 0,
                captured: 0,
                review: 0,
                resolved: 0,
                missing: 0,
                stale: 0,
                state: 'watch',
            },
            signoffSummary: {
                total: 0,
                approve: 0,
                review: 0,
                reject: 0,
                state: 'watch',
            },
            generatedAt: '',
            brief: '',
        },
    };

    refreshDerivedState(controller);
    renderConsole(controller);
    bindConsoleActions(controller);

    return {
        root: host,
        controller,
        state: controller.state,
        pack: controller.state,
        ledger,
        signoffStore,
        refresh() {
            refreshDerivedState(controller);
            renderConsole(controller);
            return controller.state;
        },
        destroy() {
            if (controller.handleClick) {
                host.removeEventListener('click', controller.handleClick);
            }
        },
    };
}

export default mountTurneroAdminQueueSurfaceAcceptanceConsole;
