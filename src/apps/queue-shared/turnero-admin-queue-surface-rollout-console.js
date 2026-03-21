import { buildTurneroSurfaceRolloutPack } from './turnero-surface-rollout-pack.js';
import {
    ensureTurneroSurfaceOpsStyles,
    mountTurneroSurfaceCheckpointChip,
} from './turnero-surface-checkpoint-chip.js';
import { mountTurneroSurfaceRolloutBanner } from './turnero-surface-rollout-banner.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminQueueSurfaceRolloutConsoleInlineStyles';

function ensureRolloutConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-rollout-console__header-copy {
            display: grid;
            gap: 0.18rem;
        }
        .turnero-admin-queue-surface-rollout-console__summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-rollout-console__summary-card {
            display: grid;
            gap: 0.18rem;
            padding: 0.72rem 0.82rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 80%);
        }
        .turnero-admin-queue-surface-rollout-console__summary-card strong {
            font-size: 1.05rem;
        }
        .turnero-admin-queue-surface-rollout-console__grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
            gap: 0.8rem;
        }
        .turnero-admin-queue-surface-rollout-console__surface {
            display: grid;
            gap: 0.72rem;
            padding: 0.95rem 1rem;
            border-radius: 22px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 84%);
        }
        .turnero-admin-queue-surface-rollout-console__surface[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
        }
        .turnero-admin-queue-surface-rollout-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-rollout-console__surface[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-admin-queue-surface-rollout-console__surface-head {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            align-items: flex-start;
        }
        .turnero-admin-queue-surface-rollout-console__surface-head strong,
        .turnero-admin-queue-surface-rollout-console__surface-title {
            font-family: 'FrauncesSoft', serif;
            font-weight: 500;
            letter-spacing: 0.01em;
        }
        .turnero-admin-queue-surface-rollout-console__surface-meta,
        .turnero-admin-queue-surface-rollout-console__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
            font-size: 0.8rem;
            line-height: 1.45;
            opacity: 0.82;
        }
        .turnero-admin-queue-surface-rollout-console__surface-meta span {
            padding: 0.3rem 0.52rem;
            border-radius: 999px;
            background: rgb(15 23 32 / 4%);
        }
        .turnero-admin-queue-surface-rollout-console__surface-meta span[data-state='ready'] {
            background: rgb(220 252 231 / 88%);
            color: rgb(22 101 52);
        }
        .turnero-admin-queue-surface-rollout-console__surface-meta span[data-state='warning'] {
            background: rgb(254 243 199 / 84%);
            color: rgb(120 53 15);
        }
        .turnero-admin-queue-surface-rollout-console__surface-meta span[data-state='alert'] {
            background: rgb(255 228 230 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-admin-queue-surface-rollout-console__surface-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-rollout-console__surface-grid div {
            padding: 0.52rem 0.62rem;
            border-radius: 14px;
            background: rgb(15 23 32 / 3%);
        }
        .turnero-admin-queue-surface-rollout-console__surface-grid dt {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-rollout-console__surface-grid dd {
            margin: 0.18rem 0 0;
            font-weight: 700;
        }
        .turnero-admin-queue-surface-rollout-console__surface-actions,
        .turnero-admin-queue-surface-rollout-console__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-rollout-console__button {
            min-height: 38px;
            padding: 0.56rem 0.84rem;
            border-radius: 999px;
            border: 1px solid rgb(15 23 32 / 12%);
            background: rgb(255 255 255 / 88%);
            color: inherit;
            font: inherit;
            cursor: pointer;
        }
        .turnero-admin-queue-surface-rollout-console__button[data-tone='primary'] {
            border-color: rgb(15 107 220 / 22%);
            background: rgb(15 107 220 / 10%);
            color: rgb(10 67 137);
        }
        .turnero-admin-queue-surface-rollout-console__section {
            display: grid;
            gap: 0.35rem;
        }
        .turnero-admin-queue-surface-rollout-console__section h4 {
            margin: 0;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.72;
        }
        .turnero-admin-queue-surface-rollout-console__section p {
            margin: 0;
            font-size: 0.84rem;
            line-height: 1.45;
        }
        .turnero-admin-queue-surface-rollout-console__section-list {
            display: grid;
            gap: 0.28rem;
            margin: 0;
            padding-left: 1rem;
            font-size: 0.84rem;
            line-height: 1.45;
        }
        .turnero-admin-queue-surface-rollout-console__empty {
            margin: 0;
            font-size: 0.84rem;
            line-height: 1.45;
            opacity: 0.74;
        }
        @media (max-width: 760px) {
            .turnero-admin-queue-surface-rollout-console__header,
            .turnero-admin-queue-surface-rollout-console__surface-head {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getClinicLabel(clinicProfile = {}) {
    return toString(
        clinicProfile?.branding?.name || clinicProfile?.branding?.short_name,
        ''
    );
}

function normalizeSurfacePackItem(item, clinicProfile, sharedInput = {}) {
    const source = asObject(item);
    const directPack = asObject(source.pack);
    if (Object.keys(directPack).length > 0 && directPack.snapshot) {
        return {
            surfaceKey: toString(
                source.surfaceKey || directPack.snapshot.surfaceKey,
                'operator-turnos'
            ),
            label: toString(
                source.label ||
                    directPack.readout?.surfaceLabel ||
                    directPack.snapshot.surfaceLabel,
                directPack.snapshot.surfaceLabel || 'surface'
            ),
            pack: directPack,
        };
    }

    const packInput =
        source.snapshot && typeof source.snapshot === 'object'
            ? source.snapshot
            : source;
    const pack = buildTurneroSurfaceRolloutPack({
        ...sharedInput,
        ...packInput,
        clinicProfile,
        surfaceRegistry: sharedInput.surfaceRegistry,
        releaseManifest: sharedInput.releaseManifest,
        ledgerStore: sharedInput.ledgerStore,
    });

    return {
        surfaceKey: pack.snapshot.surfaceKey,
        label: toString(
            source.label ||
                pack.readout.surfaceLabel ||
                pack.snapshot.surfaceLabel,
            pack.snapshot.surfaceLabel
        ),
        pack,
    };
}

function resolveSurfacePackItems(input = {}, clinicProfile = null) {
    const sharedInput = {
        scope: toString(input.scope, 'regional'),
        surfaceRegistry: input.surfaceRegistry,
        releaseManifest: input.releaseManifest,
        ledgerStore: input.ledgerStore,
        currentRoute: input.currentRoute,
        runtimeState: input.runtimeState,
    };
    const direct =
        typeof input.getSurfacePacks === 'function'
            ? input.getSurfacePacks()
            : Array.isArray(input.surfacePacks)
              ? input.surfacePacks
              : Array.isArray(input.snapshots)
                ? input.snapshots
                : [];

    if (direct.length > 0) {
        return direct
            .map((item) =>
                normalizeSurfacePackItem(item, clinicProfile, sharedInput)
            )
            .sort(
                (left, right) =>
                    ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].indexOf(
                        left.surfaceKey
                    ) -
                    ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].indexOf(
                        right.surfaceKey
                    )
            );
    }

    return ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].map(
        (surfaceKey) =>
            normalizeSurfacePackItem(
                {
                    surfaceKey,
                    label:
                        surfaceKey === 'operator-turnos'
                            ? 'Turnero Operador'
                            : surfaceKey === 'kiosco-turnos'
                              ? 'Turnero Kiosco'
                              : 'Turnero Sala TV',
                },
                clinicProfile,
                sharedInput
            )
    );
}

function buildChecklistSummary(surfacePacks = [], inputChecklist = {}) {
    const direct = asObject(inputChecklist);
    if (asObject(direct.summary).all > 0) {
        return {
            ...direct,
            summary: {
                all: Number(direct.summary.all || 0) || 0,
                pass: Number(direct.summary.pass || 0) || 0,
                fail: Number(direct.summary.fail || 0) || 0,
                requiredFail: Number(direct.summary.requiredFail || 0) || 0,
                optionalFail: Number(direct.summary.optionalFail || 0) || 0,
            },
        };
    }

    const aggregates = surfacePacks.reduce(
        (accumulator, item) => {
            const checklist = asObject(item.pack?.checklist);
            accumulator.all += Number(checklist.summary?.all || 0) || 0;
            accumulator.pass += Number(checklist.summary?.pass || 0) || 0;
            accumulator.fail += Number(checklist.summary?.fail || 0) || 0;
            accumulator.requiredFail +=
                Number(checklist.requiredFail || 0) || 0;
            accumulator.optionalFail +=
                Number(checklist.optionalFail || 0) || 0;
            return accumulator;
        },
        {
            all: 0,
            pass: 0,
            fail: 0,
            requiredFail: 0,
            optionalFail: 0,
        }
    );

    return {
        summary: aggregates,
        coverage: aggregates.all
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((aggregates.pass / aggregates.all) * 100)
                  )
              )
            : 0,
        state:
            aggregates.requiredFail > 0
                ? 'blocked'
                : aggregates.optionalFail > 0
                  ? 'watch'
                  : 'ready',
    };
}

function buildSurfaceCardHtml(item, scope) {
    const pack = asObject(item.pack);
    const snapshot = asObject(pack.snapshot);
    const readout = asObject(pack.readout);
    const gate = asObject(pack.gate);
    const checklist = asObject(pack.checklist);
    const manifest = asObject(snapshot.manifest);
    const ledger = asObject(snapshot.ledger);

    return `
        <article
            class="turnero-admin-queue-surface-rollout-console__surface"
            data-state="${escapeHtml(readout.gateBand || gate.band || 'watch')}"
            data-surface="${escapeHtml(item.surfaceKey)}"
        >
            <div class="turnero-admin-queue-surface-rollout-console__surface-head">
                <div>
                    <strong class="turnero-admin-queue-surface-rollout-console__surface-title">
                        ${escapeHtml(item.label || readout.surfaceLabel || item.surfaceKey)}
                    </strong>
                    <p class="turnero-admin-queue-surface-rollout-console__meta">
                        ${escapeHtml(readout.summary || gate.summary || '')}
                    </p>
                </div>
                <span class="turnero-admin-queue-surface-rollout-console__button" data-tone="${escapeHtml(
                    readout.tone || 'warning'
                )}">
                    ${escapeHtml(readout.badge || `${gate.band || 'watch'} · ${Number(gate.score || 0) || 0}`)}
                </span>
            </div>
            <div class="turnero-admin-queue-surface-rollout-console__surface-meta">
                <span data-state="${escapeHtml(
                    readout.tone === 'ready'
                        ? 'ready'
                        : readout.tone === 'alert'
                          ? 'alert'
                          : 'warning'
                )}">Scope ${escapeHtml(toString(readout.scope, scope || 'regional'))}</span>
                <span data-state="${escapeHtml(
                    readout.assetTone || 'warning'
                )}">Asset ${escapeHtml(readout.assetTag || 'none')}</span>
                <span data-state="${escapeHtml(
                    readout.rolloutTone || 'warning'
                )}">Rollout ${escapeHtml(readout.gateBand || 'watch')}</span>
            </div>
            <div data-turnero-surface-rollout-banner="${escapeHtml(
                item.surfaceKey
            )}"></div>
            <div
                class="turnero-surface-ops__chips"
                data-turnero-surface-rollout-chips="${escapeHtml(item.surfaceKey)}"
            ></div>
            <div class="turnero-admin-queue-surface-rollout-console__surface-grid">
                <div>
                    <dt>Visita</dt>
                    <dd>${escapeHtml(readout.visitDate || 'pendiente')}</dd>
                </div>
                <div>
                    <dt>Owner</dt>
                    <dd>${escapeHtml(readout.owner || 'pendiente')}</dd>
                </div>
                <div>
                    <dt>Station</dt>
                    <dd>${escapeHtml(readout.stationLabel || 'pendiente')}</dd>
                </div>
                <div>
                    <dt>Install</dt>
                    <dd>${escapeHtml(readout.installMode || 'pendiente')}</dd>
                </div>
                <div>
                    <dt>Checklist</dt>
                    <dd>${escapeHtml(
                        `${Number(readout.checklistPass || 0) || 0}/${
                            Number(readout.checklistAll || 0) || 0
                        }`
                    )}</dd>
                </div>
                <div>
                    <dt>Ledger</dt>
                    <dd>${escapeHtml(
                        `${toString(ledger.state, 'watch')} · ${
                            Number(ledger.totalCount || 0) || 0
                        }`
                    )}</dd>
                </div>
            </div>
            <section class="turnero-admin-queue-surface-rollout-console__section">
                <h4>Checklist</h4>
                <p>
                    ${escapeHtml(
                        `${Number(checklist.summary?.pass || 0) || 0}/${
                            Number(checklist.summary?.all || 0) || 0
                        } · ${Number(checklist.summary?.fail || 0) || 0} pendientes`
                    )}
                </p>
            </section>
            <section class="turnero-admin-queue-surface-rollout-console__section">
                <h4>Manifest</h4>
                <p>${escapeHtml(
                    `${toString(manifest.state, 'watch')} · ${toString(
                        manifest.appKey || manifest.expectedAppKey,
                        'n/a'
                    )}`
                )}</p>
            </section>
            <section class="turnero-admin-queue-surface-rollout-console__section">
                <h4>Ledger</h4>
                <p>${escapeHtml(readout.ledgerState)} · ${escapeHtml(
                    `${Number(ledger.openCount || 0) || 0} abiertas`
                )}</p>
            </section>
            <div class="turnero-admin-queue-surface-rollout-console__surface-actions">
                <button type="button" class="turnero-admin-queue-surface-rollout-console__button" data-action="copy-surface" data-surface="${escapeHtml(
                    item.surfaceKey
                )}">
                    Copiar
                </button>
                <button type="button" class="turnero-admin-queue-surface-rollout-console__button" data-action="download-surface" data-surface="${escapeHtml(
                    item.surfaceKey
                )}">
                    Descargar
                </button>
            </div>
        </article>
    `;
}

function buildConsoleBrief(state = {}) {
    const packs = Array.isArray(state.surfacePacks) ? state.surfacePacks : [];
    const checklist = asObject(state.checklist);
    const lines = [
        '# Turnero Surface Rollout Console',
        '',
        `Scope: ${toString(state.scope, 'regional')}`,
        `Clinic: ${toString(
            state.clinicShortName || state.clinicName,
            state.clinicId || 'n/a'
        )}`,
        `Checklist: ${Number(checklist.summary?.pass || 0) || 0}/${
            Number(checklist.summary?.all || 0) || 0
        } · ${Number(checklist.summary?.fail || 0) || 0} pendientes`,
        '',
        '## Surfaces',
    ];

    packs.forEach((item) => {
        lines.push(
            `- ${toString(item.pack?.readout?.surfaceLabel, item.surfaceKey)}: ${toString(
                item.pack?.readout?.gateBand,
                'watch'
            )} · ${Number(item.pack?.readout?.gateScore || 0) || 0} · ${toString(
                item.pack?.readout?.summary,
                ''
            )}`
        );
    });

    return lines.join('\n').trim();
}

function buildConsoleSnapshot(state = {}) {
    return {
        scope: toString(state.scope, 'regional'),
        clinicId: toString(state.clinicId, ''),
        clinicName: toString(state.clinicName, ''),
        clinicShortName: toString(state.clinicShortName, ''),
        generatedAt: new Date().toISOString(),
        checklist: state.checklist,
        surfacePacks: Array.isArray(state.surfacePacks)
            ? state.surfacePacks.map((item) => ({
                  surfaceKey: item.surfaceKey,
                  label: item.label,
                  snapshot: item.pack?.snapshot,
                  checklist: item.pack?.checklist,
                  manifest: item.pack?.snapshot?.manifest,
                  ledger: item.pack?.snapshot?.ledger,
                  gate: item.pack?.gate,
                  readout: item.pack?.readout,
              }))
            : [],
    };
}

export function buildTurneroAdminQueueSurfaceRolloutConsoleHtml(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const surfacePacks = resolveSurfacePackItems(input, clinicProfile);
    const checklist = buildChecklistSummary(surfacePacks, input.checklist);
    const scope = toString(input.scope, 'regional');
    const clinicName = getClinicLabel(clinicProfile);
    const clinicId = toString(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        ''
    );
    const clinicShortName = toString(
        clinicProfile?.branding?.short_name,
        clinicName
    );

    return `
        <section class="turnero-admin-queue-surface-rollout-console queue-app-card" data-scope="${escapeHtml(
            scope
        )}">
            <div class="turnero-admin-queue-surface-rollout-console__header">
                <div class="turnero-admin-queue-surface-rollout-console__header-copy">
                    <p class="queue-app-card__eyebrow">Surface rollout / regional</p>
                    <h3>Consola de rollout por clínica</h3>
                    <p class="turnero-admin-queue-surface-rollout-console__meta">
                        Scope ${escapeHtml(scope)} · Clínica ${escapeHtml(
                            clinicShortName || clinicName || clinicId || 'n/a'
                        )} · ${escapeHtml(String(surfacePacks.length))} superficies
                    </p>
                    <p class="turnero-admin-queue-surface-rollout-console__meta">
                        Checklist ${escapeHtml(
                            `${Number(checklist.summary?.pass || 0) || 0}/${
                                Number(checklist.summary?.all || 0) || 0
                            } · ${Number(checklist.summary?.fail || 0) || 0} pendientes`
                        )}
                    </p>
                </div>
                <div class="turnero-admin-queue-surface-rollout-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-rollout-console__button" data-action="copy-summary" data-tone="primary">
                        Copiar brief
                    </button>
                    <button type="button" class="turnero-admin-queue-surface-rollout-console__button" data-action="download-summary">
                        Descargar snapshot
                    </button>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-rollout-console__summary-grid">
                <div class="turnero-admin-queue-surface-rollout-console__summary-card" data-state="${escapeHtml(
                    checklist.state || 'watch'
                )}">
                    <span>Checklist</span>
                    <strong>${escapeHtml(
                        `${Number(checklist.summary?.pass || 0) || 0}/${
                            Number(checklist.summary?.all || 0) || 0
                        }`
                    )}</strong>
                    <p>${escapeHtml(
                        `${Number(checklist.summary?.fail || 0) || 0} pendientes`
                    )}</p>
                </div>
                <div class="turnero-admin-queue-surface-rollout-console__summary-card">
                    <span>Ready</span>
                    <strong>${escapeHtml(
                        String(
                            surfacePacks.filter(
                                (item) =>
                                    item.pack?.readout?.gateBand === 'ready'
                            ).length
                        )
                    )}</strong>
                    <p>Superficies listas</p>
                </div>
                <div class="turnero-admin-queue-surface-rollout-console__summary-card">
                    <span>Watch</span>
                    <strong>${escapeHtml(
                        String(
                            surfacePacks.filter(
                                (item) =>
                                    item.pack?.readout?.gateBand === 'watch'
                            ).length
                        )
                    )}</strong>
                    <p>Superficies en observacion</p>
                </div>
                <div class="turnero-admin-queue-surface-rollout-console__summary-card">
                    <span>Blocked</span>
                    <strong>${escapeHtml(
                        String(
                            surfacePacks.filter(
                                (item) =>
                                    item.pack?.readout?.gateBand === 'blocked'
                            ).length
                        )
                    )}</strong>
                    <p>Superficies bloqueadas</p>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-rollout-console__grid">
                ${surfacePacks
                    .map((item) => buildSurfaceCardHtml(item, scope))
                    .join('')}
            </div>
        </section>
    `;
}

export function mountTurneroAdminQueueSurfaceRolloutConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureRolloutConsoleStyles();

    const clinicProfile = asObject(input.clinicProfile);
    const surfacePacks = resolveSurfacePackItems(input, clinicProfile);
    const checklist = buildChecklistSummary(surfacePacks, input.checklist);
    const scope = toString(input.scope, 'regional');
    const clinicName = getClinicLabel(clinicProfile);
    const clinicId = toString(
        clinicProfile?.clinic_id || clinicProfile?.clinicId,
        ''
    );
    const clinicShortName = toString(
        clinicProfile?.branding?.short_name,
        clinicName
    );

    host.className =
        'turnero-admin-queue-surface-rollout-console queue-app-card';
    host.dataset.scope = scope;
    host.innerHTML = buildTurneroAdminQueueSurfaceRolloutConsoleHtml({
        ...input,
        clinicProfile,
        surfacePacks,
        checklist,
        scope,
    });

    surfacePacks.forEach((item) => {
        const bannerHost = host.querySelector(
            `[data-turnero-surface-rollout-banner="${item.surfaceKey}"]`
        );
        if (bannerHost instanceof HTMLElement) {
            mountTurneroSurfaceRolloutBanner(bannerHost, {
                pack: item.pack,
                readout: item.pack?.readout,
                title: item.pack?.readout?.title,
                summary: item.pack?.readout?.summary,
                detail: item.pack?.readout?.detail,
            });
        }

        const chipsHost = host.querySelector(
            `[data-turnero-surface-rollout-chips="${item.surfaceKey}"]`
        );
        if (chipsHost instanceof HTMLElement) {
            chipsHost.replaceChildren();
            toArray(item.pack?.readout?.checkpointChips).forEach((chip) => {
                const chipNode = document.createElement('span');
                chipsHost.appendChild(chipNode);
                mountTurneroSurfaceCheckpointChip(chipNode, chip);
            });
        }
    });

    if (typeof host.querySelectorAll === 'function') {
        host.querySelectorAll('[data-action]').forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            button.onclick = async () => {
                const action = toString(button.dataset.action);
                const surfaceKey = toString(button.dataset.surface, '');
                const activePack =
                    surfacePacks.find(
                        (item) => item.surfaceKey === surfaceKey
                    ) || null;

                if (action === 'copy-summary') {
                    await copyTextToClipboard(
                        buildConsoleBrief({
                            scope,
                            clinicId,
                            clinicName,
                            clinicShortName,
                            checklist,
                            surfacePacks,
                        })
                    );
                    return;
                }

                if (action === 'download-summary') {
                    downloadJsonSnapshot(
                        `turnero-surface-rollout-${scope}.json`,
                        buildConsoleSnapshot({
                            scope,
                            clinicId,
                            clinicName,
                            clinicShortName,
                            checklist,
                            surfacePacks,
                        })
                    );
                    return;
                }

                if (!activePack) {
                    return;
                }

                if (action === 'copy-surface') {
                    await copyTextToClipboard(
                        activePack.pack?.readout?.brief ||
                            buildConsoleBrief({
                                scope,
                                clinicId,
                                clinicName,
                                clinicShortName,
                                checklist: activePack.pack?.checklist,
                                surfacePacks: [activePack],
                            })
                    );
                    return;
                }

                if (action === 'download-surface') {
                    downloadJsonSnapshot(
                        `turnero-surface-${surfaceKey}-${scope}.json`,
                        {
                            scope,
                            clinicId,
                            clinicName,
                            clinicShortName,
                            surface: activePack.surfaceKey,
                            pack: activePack.pack,
                        }
                    );
                }
            };
        });
    }

    return host;
}
