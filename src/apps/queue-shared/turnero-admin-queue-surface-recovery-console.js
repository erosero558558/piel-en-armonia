import { createTurneroSurfaceRecoveryActionStore } from './turnero-surface-recovery-action-store.js';
import { buildTurneroSurfaceContractReadout } from './turnero-surface-contract-readout.js';
import { buildTurneroSurfaceRecoveryGate } from './turnero-surface-recovery-gate.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'display', 'admin']);

function surfaceOrderRank(surfaceKey) {
    const index = SURFACE_ORDER.indexOf(
        normalizeTurneroSurfaceRecoveryKey(surfaceKey)
    );
    return index >= 0 ? index : SURFACE_ORDER.length;
}

function normalizeSurfacePackItem(item, clinicProfile) {
    const source = asObject(item);
    const pack = asObject(source.pack || source);
    const snapshot = asObject(pack.snapshot || source.snapshot);
    const drift = asObject(pack.drift || source.drift);
    const gate = asObject(pack.gate || source.gate);
    const readiness = asObject(
        pack.readiness || source.readiness || snapshot.readiness
    );
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey ||
            snapshot.surfaceKey ||
            drift.surfaceKey ||
            'operator'
    );
    const label = toString(
        source.label ||
            pack.label ||
            pack.readout?.surfaceLabel ||
            snapshot.surfaceLabel ||
            surfaceKey
    );

    if (snapshot.contract) {
        const readout =
            pack.readout ||
            source.readout ||
            buildTurneroSurfaceContractReadout({
                snapshot,
                drift,
                gate,
                readiness,
            });

        return {
            surfaceKey,
            label,
            pack: {
                ...pack,
                snapshot,
                drift,
                gate,
                readout,
                readiness,
            },
        };
    }

    const fallbackSnapshot = buildFallbackSnapshotFromDrift(
        source,
        surfaceKey,
        clinicProfile
    );
    const fallbackDrift = {
        surfaceKey,
        surfaceLabel: label,
        state: toString(source.state || 'watch').toLowerCase(),
        severity: toString(source.severity || 'low'),
        summary: toString(source.summary || source.detail || ''),
        detail: toString(source.detail || source.summary || ''),
        driftFlags: Array.isArray(source.driftFlags)
            ? source.driftFlags.map((flag) => ({ ...flag }))
            : [],
        primaryFlag:
            source.primaryFlag && typeof source.primaryFlag === 'object'
                ? { ...source.primaryFlag }
                : null,
        generatedAt: new Date().toISOString(),
    };
    const fallbackGate =
        source.gate && typeof source.gate === 'object'
            ? {
                  ...source.gate,
                  band: toString(source.gate.band || source.state || 'watch'),
                  score: Number(source.gate.score || source.score || 0) || 0,
              }
            : buildTurneroSurfaceRecoveryGate({
                  snapshot: fallbackSnapshot,
                  drift: fallbackDrift,
                  actions: [],
              });
    const fallbackReadout = buildTurneroSurfaceContractReadout({
        snapshot: fallbackSnapshot,
        drift: fallbackDrift,
        gate: fallbackGate,
        readiness: fallbackSnapshot.readiness,
    });

    return {
        surfaceKey,
        label,
        pack: {
            snapshot: fallbackSnapshot,
            drift: fallbackDrift,
            gate: fallbackGate,
            readout: fallbackReadout,
            readiness: fallbackSnapshot.readiness,
            contract: fallbackSnapshot.contract,
            storage: fallbackSnapshot.storage,
            runtime: fallbackSnapshot.runtime,
            heartbeat: fallbackSnapshot.heartbeat,
            actions: fallbackSnapshot.actions,
            generatedAt: fallbackSnapshot.generatedAt,
        },
    };
}

function buildFallbackSnapshotFromDrift(item, surfaceKey, clinicProfile) {
    const source = asObject(item);
    const surfaceLabel = toString(
        source.surfaceLabel || source.label || surfaceKey
    );
    const contractState =
        toString(source.state || '').toLowerCase() === 'blocked'
            ? 'alert'
            : 'ready';
    const summary = toString(
        source.summary || source.detail || 'Surface recovery summary.'
    );
    const clinicId = toString(clinicProfile?.clinic_id || 'default-clinic');
    const clinicName = toString(
        clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            clinicId
    );
    const currentRoute = toString(source.currentRoute || source.route || '');

    return {
        surfaceKey,
        surfaceToken: toString(source.surfaceKey || surfaceKey),
        surfaceLabel,
        profile: {
            clinicId,
            clinicName,
            clinicShortName: toString(
                clinicProfile?.branding?.short_name || clinicName
            ),
            source: 'telemetry',
            fingerprint: toString(
                clinicProfile?.runtime_meta?.profileFingerprint || ''
            ),
            releaseMode: toString(clinicProfile?.release?.mode || 'suite_v2'),
            surfaceKey,
            surfaceLabel,
            expectedRoute: currentRoute,
            currentRoute,
            routeMatches: true,
            contractState,
            contractReason:
                contractState === 'alert' ? 'route_mismatch' : 'ready',
            contractDetail: summary,
            readinessState: contractState === 'alert' ? 'alert' : 'ready',
            readinessSummary: summary,
            readinessBlockers: [],
            readinessWarnings: [],
        },
        contract: {
            state: contractState,
            reason: contractState === 'alert' ? 'route_mismatch' : 'ready',
            detail: summary,
            expectedRoute: currentRoute,
            currentRoute,
            routeMatches: true,
            enabled: true,
            label: surfaceLabel,
        },
        readiness: {
            state: contractState === 'alert' ? 'alert' : 'ready',
            summary,
            blockers: contractState === 'alert' ? [summary] : [],
            warnings: [],
            readySurfaceCount: contractState === 'alert' ? 0 : 1,
            enabledSurfaceCount: 1,
            blockedSurfaceCount: contractState === 'alert' ? 1 : 0,
        },
        storage: {
            key: 'turneroSurfaceRecoveryActionsV1',
            available: true,
            state: 'ready',
            summary: 'Recuperacion visible.',
            openActionCount: 0,
            closedActionCount: 0,
            actionCount: 0,
            surfaceCount: 0,
            surfacesTracked: 0,
            updatedAt: new Date().toISOString(),
            persistedAt: '',
            source: 'telemetry',
            details: {},
        },
        runtime: {
            state: toString(source.state || 'watch'),
            summary,
            online: true,
            connectivity: 'online',
            mode: 'live',
            reason: '',
            pendingCount: 0,
            outboxSize: 0,
            reconciliationSize: 0,
            updateChannel: 'stable',
            details: {
                ...source,
            },
        },
        heartbeat: {
            state: toString(source.state || 'watch'),
            summary,
            channel: 'telemetry',
            lastBeatAt: toString(source.updatedAt || new Date().toISOString()),
            lastEvent: 'telemetry',
            lastEventAt: toString(source.updatedAt || new Date().toISOString()),
            online: true,
            details: {
                ...source,
            },
        },
        actions: [],
        actionCount: 0,
        openActionCount: 0,
        closedActionCount: 0,
        generatedAt: new Date().toISOString(),
    };
}

function resolveSurfacePackItems(input = {}, clinicProfile = null) {
    const directPacks =
        typeof input.getSurfacePacks === 'function'
            ? input.getSurfacePacks()
            : input.surfacePacks;
    if (Array.isArray(directPacks) && directPacks.length > 0) {
        return directPacks
            .map((item) => normalizeSurfacePackItem(item, clinicProfile))
            .sort(
                (left, right) =>
                    surfaceOrderRank(left.surfaceKey) -
                    surfaceOrderRank(right.surfaceKey)
            );
    }

    const drifts = toArray(input.drifts);
    if (drifts.length > 0) {
        return drifts
            .map((item) => normalizeSurfacePackItem(item, clinicProfile))
            .sort(
                (left, right) =>
                    surfaceOrderRank(left.surfaceKey) -
                    surfaceOrderRank(right.surfaceKey)
            );
    }

    return [];
}

function buildSurfaceCardHtml(item) {
    const pack = asObject(item.pack);
    const snapshot = asObject(pack.snapshot);
    const readout = asObject(pack.readout);
    const contract = asObject(snapshot.contract);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);

    return `
        <article class="turnero-admin-queue-surface-recovery-console__surface" data-state="${escapeHtml(
            readout.gateBand || pack.gate?.band || pack.drift?.state || 'watch'
        )}">
            <div class="turnero-admin-queue-surface-recovery-console__surface-head">
                <div>
                    <strong>${escapeHtml(item.label || readout.surfaceLabel || item.surfaceKey)}</strong>
                    <p>${escapeHtml(readout.summary || pack.drift?.summary || '')}</p>
                </div>
                <span class="turnero-admin-queue-surface-recovery-console__surface-badge">
                    ${escapeHtml(readout.badge || `${pack.gate?.band || 'watch'} · ${Number(pack.gate?.score || 0)}`)}
                </span>
            </div>
            <div class="turnero-admin-queue-surface-recovery-console__surface-meta">
                <span data-state="${escapeHtml(
                    contract.state === 'alert' ? 'blocked' : 'ready'
                )}">Contract ${escapeHtml(contract.state || 'ready')}</span>
                <span data-state="${escapeHtml(storage.state || 'ready')}">Storage ${escapeHtml(storage.state || 'ready')}</span>
                <span data-state="${escapeHtml(runtime.state || 'ready')}">Runtime ${escapeHtml(runtime.state || 'ready')}</span>
                <span data-state="${escapeHtml(heartbeat.state || 'ready')}">Heartbeat ${escapeHtml(heartbeat.state || 'ready')}</span>
            </div>
            <dl class="turnero-admin-queue-surface-recovery-console__surface-grid">
                <div><dt>Ruta</dt><dd>${escapeHtml(contract.currentRoute || 'sin ruta')}</dd></div>
                <div><dt>Storage</dt><dd>${escapeHtml(storage.summary || 'Sin detalle')}</dd></div>
                <div><dt>Runtime</dt><dd>${escapeHtml(runtime.summary || 'Sin detalle')}</dd></div>
                <div><dt>Heartbeat</dt><dd>${escapeHtml(heartbeat.summary || 'Sin detalle')}</dd></div>
                <div><dt>Acciones</dt><dd>${escapeHtml(String(snapshot.openActionCount || 0))}</dd></div>
                <div><dt>Drift</dt><dd>${escapeHtml(pack.drift?.state || 'aligned')}</dd></div>
            </dl>
        </article>
    `;
}

function buildActionItemHtml(action, surfaceLabel) {
    const state = toString(action.state || 'open');
    const severity = toString(action.severity || 'low');
    return `
        <article class="turnero-admin-queue-surface-recovery-console__action" data-state="${escapeHtml(
            state
        )}" data-severity="${escapeHtml(severity)}">
            <div>
                <strong>${escapeHtml(action.title || 'Recovery action')}</strong>
                <p>${escapeHtml(surfaceLabel || action.surfaceKey || 'surface')} · ${escapeHtml(
                    action.detail || 'Sin detalle'
                )}</p>
            </div>
            <div class="turnero-admin-queue-surface-recovery-console__action-meta">
                <span>${escapeHtml(severity)}</span>
                <span>${escapeHtml(state)}</span>
                ${
                    state === 'closed'
                        ? '<span class="turnero-admin-queue-surface-recovery-console__closed-pill">closed</span>'
                        : `<button type="button" data-action="close-action" data-action-id="${escapeHtml(
                              action.id
                          )}">Cerrar</button>`
                }
            </div>
        </article>
    `;
}

function buildConsoleBrief({
    scope,
    clinicLabel,
    gate,
    surfacePacks,
    actions,
}) {
    const openActions = actions.filter(
        (action) =>
            !['closed', 'resolved', 'dismissed'].includes(
                toString(action.state).toLowerCase()
            )
    );
    const lines = [
        '# Surface Recovery Console',
        '',
        `Scope: ${scope}`,
        `Clinic: ${clinicLabel}`,
        `Gate: ${gate.score} (${gate.band})`,
        `Decision: ${gate.decision}`,
        `Open actions: ${openActions.length}`,
        '',
    ];

    surfacePacks.forEach((item) => {
        const readout = asObject(item.pack?.readout);
        lines.push(
            `- ${item.label || readout.surfaceLabel || item.surfaceKey}: ${readout.summary || 'Sin resumen'}`
        );
    });

    if (openActions.length > 0) {
        lines.push(
            '',
            'Open actions:',
            ...openActions.map(
                (action) => `- ${action.surfaceKey}: ${action.title}`
            )
        );
    }

    return lines.join('\n');
}

export function buildTurneroAdminQueueSurfaceRecoveryConsoleHtml(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope ||
            clinicProfile.region ||
            clinicProfile.branding?.city ||
            'regional',
        'regional'
    );
    const clinicLabel = toString(
        input.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicProfile.clinic_id ||
            scope,
        scope
    );
    const surfacePacks = resolveSurfacePackItems(input, clinicProfile);
    const actions = Array.isArray(input.actions)
        ? input.actions
              .map((action) => asObject(action))
              .filter((action) => Boolean(action.id))
        : surfacePacks
              .flatMap((item) => toArray(item.pack?.actions))
              .filter((action) => Boolean(action?.id));
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band || 'watch'),
                  decision: toString(input.gate.decision || 'monitor-recovery'),
                  score: Number(input.gate.score || 0) || 0,
              }
            : buildTurneroSurfaceRecoveryGate({
                  snapshot: {
                      surfaceKey: 'admin',
                      actions,
                  },
                  drifts: surfacePacks
                      .map((item) => item.pack?.drift)
                      .filter(Boolean),
                  actions,
              });
    const brief = buildConsoleBrief({
        scope,
        clinicLabel,
        gate,
        surfacePacks,
        actions,
    });

    const openActionCount = actions.filter(
        (action) =>
            !['closed', 'resolved', 'dismissed'].includes(
                toString(action.state).toLowerCase()
            )
    ).length;
    const blockedSurfaceCount = surfacePacks.filter(
        (item) => item.pack?.gate?.band === 'blocked'
    ).length;
    const degradedSurfaceCount = surfacePacks.filter(
        (item) =>
            item.pack?.gate?.band === 'degraded' ||
            item.pack?.drift?.state === 'degraded'
    ).length;
    const watchSurfaceCount = surfacePacks.filter(
        (item) =>
            item.pack?.gate?.band === 'watch' ||
            item.pack?.drift?.state === 'watch'
    ).length;

    return `
        <section
            class="turnero-admin-queue-surface-recovery-console"
            data-scope="${escapeHtml(scope)}"
            data-state="${escapeHtml(gate.band)}"
        >
            <div class="turnero-admin-queue-surface-recovery-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-recovery-console__eyebrow">Surface recovery</p>
                    <h3>Recovery Console</h3>
                    <p>Perfil, storage, runtime y heartbeat por surface con acciones persistidas por clínica.</p>
                </div>
                <div class="turnero-admin-queue-surface-recovery-console__actions">
                    <button type="button" data-action="copy-brief">Copy summary</button>
                    <button type="button" data-action="download-json">Download JSON</button>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-recovery-console__metrics">
                <article>
                    <strong>${escapeHtml(String(surfacePacks.length))}</strong>
                    <span>Surfaces</span>
                </article>
                <article>
                    <strong>${escapeHtml(String(openActionCount))}</strong>
                    <span>Open actions</span>
                </article>
                <article data-state="${escapeHtml(
                    blockedSurfaceCount > 0
                        ? 'blocked'
                        : degradedSurfaceCount > 0
                          ? 'degraded'
                          : watchSurfaceCount > 0
                            ? 'watch'
                            : gate.band
                )}">
                    <strong>${escapeHtml(String(gate.score))}</strong>
                    <span>${escapeHtml(gate.band)}</span>
                </article>
                <article>
                    <strong>${escapeHtml(String(blockedSurfaceCount))}</strong>
                    <span>Blocked</span>
                </article>
            </div>
            <div class="turnero-admin-queue-surface-recovery-console__grid">
                ${
                    surfacePacks.length
                        ? surfacePacks.map(buildSurfaceCardHtml).join('')
                        : '<p class="turnero-admin-queue-surface-recovery-console__empty">Sin surfaces para mostrar.</p>'
                }
            </div>
            <div class="turnero-admin-queue-surface-recovery-console__actions-panel">
                <form class="turnero-admin-queue-surface-recovery-console__form" data-role="recovery-form">
                    <label>
                        <span>Surface</span>
                        <select data-field="surface-key">
                            ${surfacePacks
                                .map(
                                    (item) => `
                                        <option value="${escapeHtml(item.surfaceKey)}">${escapeHtml(
                                            item.label || item.surfaceKey
                                        )}</option>
                                    `
                                )
                                .join('')}
                        </select>
                    </label>
                    <label>
                        <span>Severity</span>
                        <select data-field="severity">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </label>
                    <label>
                        <span>Title</span>
                        <input type="text" data-field="title" placeholder="Recovery action" />
                    </label>
                    <label>
                        <span>Detail</span>
                        <textarea data-field="detail" placeholder="Que debe revisarse"></textarea>
                    </label>
                    <button type="submit" data-action="add-action">Add action</button>
                </form>
                <div class="turnero-admin-queue-surface-recovery-console__action-list">
                    <strong>Open actions</strong>
                    ${
                        actions.length
                            ? actions
                                  .map((action) =>
                                      buildActionItemHtml(
                                          action,
                                          surfacePacks.find(
                                              (item) =>
                                                  item.surfaceKey ===
                                                  normalizeTurneroSurfaceRecoveryKey(
                                                      action.surfaceKey
                                                  )
                                          )?.label
                                      )
                                  )
                                  .join('')
                            : '<p class="turnero-admin-queue-surface-recovery-console__empty">Sin acciones abiertas.</p>'
                    }
                </div>
            </div>
            <pre class="turnero-admin-queue-surface-recovery-console__brief">${escapeHtml(
                brief
            )}</pre>
        </section>
    `;
}

export function mountTurneroAdminQueueSurfaceRecoveryConsole(
    target,
    input = {}
) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    const actionStore = createTurneroSurfaceRecoveryActionStore(
        input.clinicProfile || null,
        {
            storageKey: input.storageKey,
        }
    );

    function resolveActions() {
        return actionStore.list({ includeClosed: true });
    }

    function resolveGateAndSurfacePacks() {
        const clinicProfile = asObject(input.clinicProfile);
        const surfacePacks = resolveSurfacePackItems(input, clinicProfile);
        const actions = resolveActions();
        const drifts = surfacePacks
            .map((item) => item.pack?.drift)
            .filter(Boolean);
        const gate =
            input.gate && typeof input.gate === 'object'
                ? {
                      ...input.gate,
                      band: toString(input.gate.band || 'watch'),
                      decision: toString(
                          input.gate.decision || 'monitor-recovery'
                      ),
                      score: Number(input.gate.score || 0) || 0,
                  }
                : buildTurneroSurfaceRecoveryGate({
                      snapshot: {
                          surfaceKey: 'admin',
                          actions,
                      },
                      drifts,
                      actions,
                  });
        return { surfacePacks, actions, gate };
    }

    function render() {
        const clinicProfile = asObject(input.clinicProfile);
        const scope = toString(
            input.scope ||
                clinicProfile.region ||
                clinicProfile.branding?.city ||
                'regional',
            'regional'
        );
        const clinicLabel = toString(
            input.clinicLabel ||
                clinicProfile.branding?.name ||
                clinicProfile.branding?.short_name ||
                clinicProfile.clinic_id ||
                scope,
            scope
        );
        const { surfacePacks, actions, gate } = resolveGateAndSurfacePacks();

        root.innerHTML = buildTurneroAdminQueueSurfaceRecoveryConsoleHtml({
            scope,
            clinicProfile,
            clinicLabel,
            surfacePacks,
            actions,
            gate,
        });

        return { surfacePacks, actions, gate };
    }

    root.addEventListener('click', async (event) => {
        const targetNode = event.target;
        const action = targetNode?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            const { surfacePacks, actions, gate } =
                resolveGateAndSurfacePacks();
            const clinicProfile = asObject(input.clinicProfile);
            const scope = toString(
                input.scope ||
                    clinicProfile.region ||
                    clinicProfile.branding?.city ||
                    'regional',
                'regional'
            );
            const clinicLabel = toString(
                input.clinicLabel ||
                    clinicProfile.branding?.name ||
                    clinicProfile.branding?.short_name ||
                    clinicProfile.clinic_id ||
                    scope,
                scope
            );
            await copyTextToClipboard(
                buildConsoleBrief({
                    scope,
                    clinicLabel,
                    gate,
                    surfacePacks,
                    actions,
                })
            );
            return;
        }

        if (action === 'download-json') {
            const { surfacePacks, actions, gate } =
                resolveGateAndSurfacePacks();
            const clinicProfile = asObject(input.clinicProfile);
            const scope = toString(
                input.scope ||
                    clinicProfile.region ||
                    clinicProfile.branding?.city ||
                    'regional',
                'regional'
            );
            const clinicLabel = toString(
                input.clinicLabel ||
                    clinicProfile.branding?.name ||
                    clinicProfile.branding?.short_name ||
                    clinicProfile.clinic_id ||
                    scope,
                scope
            );
            downloadJsonSnapshot('turnero-surface-recovery-console.json', {
                scope,
                clinicLabel,
                surfacePacks,
                actions,
                gate,
            });
            return;
        }

        if (action === 'close-action') {
            const actionId = toString(
                targetNode?.getAttribute?.('data-action-id')
            );
            if (!actionId) {
                return;
            }
            actionStore.close(actionId);
            render();
        }
    });

    root.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }
        if (!form.matches('[data-role="recovery-form"]')) {
            return;
        }

        event.preventDefault();
        const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
            form.querySelector('[data-field="surface-key"]')?.value
        );
        if (!surfaceKey) {
            return;
        }

        actionStore.add({
            surfaceKey,
            severity: form.querySelector('[data-field="severity"]')?.value,
            title: form.querySelector('[data-field="title"]')?.value,
            detail: form.querySelector('[data-field="detail"]')?.value,
        });
        form.reset();
        render();
    });

    return render();
}
