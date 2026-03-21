import {
    asObject,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { loadTurneroSurfaceRegistrySource } from './turnero-surface-registry-source.js';
import {
    buildTurneroSurfaceReleaseTruthPack,
    formatTurneroSurfaceReleaseTruthBrief,
    getSurfaceDefinition,
    normalizeTurneroSurfaceKey,
} from './turnero-surface-release-truth.js';
import {
    buildTurneroSurfaceReleaseReadinessPack,
    formatTurneroSurfaceReleaseReadinessBrief,
} from './turnero-surface-release-readiness-pack.js';
import { renderTurneroSurfaceLaunchBadge } from './turnero-surface-launch-badge.js';
import {
    buildTurneroSurfaceSafeModeState,
    renderTurneroSurfaceSafeModeBanner,
} from './turnero-surface-safe-mode.js';
import { renderTurneroSurfaceSmokeChecklist } from './turnero-surface-smoke-checklist.js';

const DEFAULT_SURFACES_URL = '/data/turnero-surfaces.json';
const DEFAULT_MANIFEST_URL = '/release-manifest.json';

function normalizeRuntimeTone(value) {
    const token = toString(value, 'unknown').toLowerCase();
    if (['ready', 'watch', 'degraded', 'unknown'].includes(token)) {
        return token;
    }
    if (
        ['live', 'online', 'connected', 'healthy', 'stable', 'ok'].includes(
            token
        )
    ) {
        return 'ready';
    }
    if (['paused', 'fallback', 'reconnecting', 'warning'].includes(token)) {
        return 'watch';
    }
    if (['offline', 'alert', 'error', 'blocked'].includes(token)) {
        return 'degraded';
    }
    return 'unknown';
}

function buildSurfaceLabel(state = {}) {
    const surfaceKey = normalizeTurneroSurfaceKey(
        state.surfaceKey || state.surfaceId || state.surfaceRoute
    );
    const definition = getSurfaceDefinition(
        surfaceKey === 'operator-turnos'
            ? 'operator'
            : surfaceKey === 'kiosco-turnos'
              ? 'kiosk'
              : surfaceKey === 'sala-turnos'
                ? 'sala_tv'
                : surfaceKey
    );
    return toString(
        state.surfaceLabel,
        definition?.label || surfaceKey || 'Turnero'
    );
}

function buildClinicSummary(profile) {
    const clinicId = toString(profile?.clinic_id, '');
    const clinicName = toString(
        profile?.branding?.name || profile?.branding?.short_name,
        ''
    );
    const releaseMode = toString(profile?.release?.mode, '');
    const source = toString(profile?.runtime_meta?.source, '');

    return [
        clinicName || 'Clínica sin nombre',
        clinicId ? `ID ${clinicId}` : '',
        releaseMode ? `release ${releaseMode}` : '',
        source ? `source ${source}` : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

function buildStorageSummary(storageInfo = {}) {
    const state = normalizeRuntimeTone(
        storageInfo.state || storageInfo.status || storageInfo.mode
    );
    const label =
        state === 'ready'
            ? 'storage ready'
            : state === 'watch'
              ? 'storage watch'
              : state === 'degraded'
                ? 'storage degraded'
                : 'storage unknown';
    const detail = [
        toString(storageInfo.scope, ''),
        toString(storageInfo.key, ''),
        toString(storageInfo.updatedAt || storageInfo.at, ''),
    ]
        .filter(Boolean)
        .join(' · ');

    return { state, label, detail };
}

function buildHeartbeatSummary(heartbeat = {}) {
    const state = normalizeRuntimeTone(
        heartbeat.state || heartbeat.status || heartbeat.mode
    );
    const label =
        state === 'ready'
            ? 'heartbeat ready'
            : state === 'watch'
              ? 'heartbeat watch'
              : state === 'degraded'
                ? 'heartbeat degraded'
                : 'heartbeat unknown';
    const detail = [
        toString(heartbeat.summary, ''),
        toString(heartbeat.lastEventAt || heartbeat.updatedAt, ''),
    ]
        .filter(Boolean)
        .join(' · ');

    return { state, label, detail };
}

function buildRuntimeSummary(runtimeState = {}) {
    const state = normalizeRuntimeTone(
        runtimeState.state || runtimeState.status || runtimeState.mode
    );
    const label =
        state === 'ready'
            ? 'runtime ready'
            : state === 'watch'
              ? 'runtime watch'
              : state === 'degraded'
                ? 'runtime degraded'
                : 'runtime unknown';
    const detail = [
        toString(runtimeState.summary, ''),
        toString(runtimeState.detail, ''),
    ]
        .filter(Boolean)
        .join(' · ');

    return { state, label, detail };
}

function getTruthPack(input = {}) {
    if (input.truthPack && typeof input.truthPack === 'object') {
        return input.truthPack;
    }

    const registry = asObject(input.registry);
    if (Object.keys(registry).length === 0) {
        return buildTurneroSurfaceReleaseTruthPack({
            registry,
            loadedAt: input.loadedAt,
        });
    }

    return buildTurneroSurfaceReleaseTruthPack({
        registry,
        loadedAt: input.loadedAt,
    });
}

function getReadinessPack(input = {}, truthPack) {
    if (input.readinessPack && typeof input.readinessPack === 'object') {
        return input.readinessPack;
    }

    return buildTurneroSurfaceReleaseReadinessPack({
        ...input,
        truthPack,
    });
}

function getSafeModeState(readinessPack, input = {}) {
    if (readinessPack?.safeMode) {
        return readinessPack.safeMode;
    }

    return buildTurneroSurfaceSafeModeState({
        truthMode: readinessPack?.truthPack?.summary?.mode,
        readinessBand: readinessPack?.band,
        runtimeState: input.runtimeState,
        manifestSource: readinessPack?.summary?.manifestSource,
        requestedManifestUrl: readinessPack?.summary?.manifestRequestedUrl,
        resolvedManifestUrl: readinessPack?.summary?.manifestResolvedUrl,
    });
}

function getSmokeChecklist(input, truthPack, readinessPack, safeMode) {
    if (readinessPack?.smoke) {
        return readinessPack.smoke;
    }

    return {
        ...input,
        truthPack,
        readinessPack,
        safeMode,
    };
}

function buildRuntimeBootstrapState(input = {}) {
    const registry = asObject(input.registry);
    const truthPack = getTruthPack({ ...input, registry });
    const readinessPack = getReadinessPack(
        { ...input, registry, truthPack },
        truthPack
    );
    const safeMode = getSafeModeState(readinessPack, input);
    const smoke = getSmokeChecklist(input, truthPack, readinessPack, safeMode);
    const surfaceKey = normalizeTurneroSurfaceKey(
        input.surfaceKey || input.surfaceId || input.surfaceRoute
    );
    const runtimeState = buildRuntimeSummary(input.runtimeState);
    const storageState = buildStorageSummary(input.storageInfo);
    const heartbeatState = buildHeartbeatSummary(input.heartbeat);
    const surfaceLabel = buildSurfaceLabel({
        ...input,
        surfaceKey,
    });
    const clinicSummary = buildClinicSummary(input.clinicProfile);
    const rows = toArray(truthPack.rows);
    const topRows = rows.slice(0, 3);
    const truthSummary = asObject(truthPack.summary);
    const readinessSummary = asObject(readinessPack.summary);

    return {
        loading: input.loading === true,
        error: toString(input.error, ''),
        registry,
        truthPack,
        readinessPack,
        safeMode,
        smoke,
        surfaceKey,
        surfaceLabel,
        clinicProfile: asObject(input.clinicProfile),
        clinicSummary,
        storageInfo: asObject(input.storageInfo),
        storageState,
        heartbeat: asObject(input.heartbeat),
        heartbeatState,
        runtimeState,
        currentRoute: toString(input.currentRoute, ''),
        truthSummary,
        readinessSummary,
        rows,
        topRows,
        manifestSource: toString(
            readinessSummary.manifestSource,
            truthSummary.manifestSource || registry.manifestSource || 'missing'
        ),
        requestedManifestUrl: toString(
            readinessSummary.manifestRequestedUrl,
            truthSummary.requestedManifestUrl ||
                registry.requestedManifestUrl ||
                ''
        ),
        resolvedManifestUrl: toString(
            readinessSummary.manifestResolvedUrl,
            truthSummary.resolvedManifestUrl ||
                registry.resolvedManifestUrl ||
                ''
        ),
        generatedAt:
            readinessPack.generatedAt ||
            truthPack.generatedAt ||
            new Date().toISOString(),
    };
}

function renderSectionLabel(label, detail) {
    return `
        <article class="turnero-surface-runtime-bootstrap__tile">
            <p class="turnero-surface-runtime-bootstrap__tile-label">${escapeHtml(
                label
            )}</p>
            <strong>${escapeHtml(detail || 'n/a')}</strong>
        </article>
    `.trim();
}

function renderBriefBox(title, brief) {
    return `
        <section class="turnero-surface-runtime-bootstrap__brief-box">
            <p class="turnero-surface-runtime-bootstrap__tile-label">${escapeHtml(
                title
            )}</p>
            <pre>${escapeHtml(brief)}</pre>
        </section>
    `.trim();
}

export function renderTurneroSurfaceRuntimeBootstrap(input = {}) {
    const state = buildRuntimeBootstrapState(input);
    const truthBrief = formatTurneroSurfaceReleaseTruthBrief(state.truthPack);
    const readinessBrief = formatTurneroSurfaceReleaseReadinessBrief(
        state.readinessPack
    );
    const launchBadge = renderTurneroSurfaceLaunchBadge({
        ...state,
        readinessPack: state.readinessPack,
        surfaceLabel: state.surfaceLabel,
    });
    const safeModeBanner = renderTurneroSurfaceSafeModeBanner(state.safeMode);
    const smokeChecklist = renderTurneroSurfaceSmokeChecklist({
        ...state.smoke,
        truthPack: state.truthPack,
        readinessPack: state.readinessPack,
        safeMode: state.safeMode,
    });
    const surfaceRows = state.topRows
        .map(
            (row) => `
                <li class="turnero-surface-runtime-bootstrap__truth-row" data-truth="${escapeHtml(
                    row.truth || 'unknown'
                )}">
                    <strong>${escapeHtml(row.label || row.surfaceKey || '')}</strong>
                    <span>${escapeHtml(
                        `${row.truthLabel || row.truth || 'unknown'} · ${row.runtimeState || 'unknown'}/${row.releaseState || 'unknown'}`
                    )}</span>
                </li>
            `
        )
        .join('');

    return `
        <article
            class="queue-app-card turnero-surface-runtime-bootstrap"
            data-state="${escapeHtml(toString(state.readinessSummary.state, 'unknown'))}"
            data-band="${escapeHtml(toString(state.readinessPack.band, 'unknown'))}"
            data-truth="${escapeHtml(toString(state.truthSummary.mode, 'unknown'))}"
            data-manifest-source="${escapeHtml(state.manifestSource)}"
            data-surface-key="${escapeHtml(state.surfaceKey)}"
        >
            <header class="turnero-surface-runtime-bootstrap__header">
                <div>
                    <p class="queue-app-card__eyebrow">Surface runtime</p>
                    <h5 class="queue-app-card__title">${escapeHtml(
                        state.surfaceLabel
                    )}</h5>
                    <p class="queue-app-card__description">
                        Bootstrap visible para registry, manifest, clinic profile, storage, heartbeat y runtime contract.
                    </p>
                </div>
                <div class="turnero-surface-runtime-bootstrap__chips">
                    <span class="turnero-surface-mini-tag">${escapeHtml(
                        state.clinicSummary || 'Clínica sin perfil'
                    )}</span>
                    <span class="turnero-surface-mini-tag">${escapeHtml(
                        state.storageState.label
                    )}</span>
                    <span class="turnero-surface-mini-tag">${escapeHtml(
                        state.heartbeatState.label
                    )}</span>
                    <span class="turnero-surface-mini-tag">${escapeHtml(
                        state.runtimeState.label
                    )}</span>
                </div>
            </header>
            ${
                safeModeBanner
                    ? `<div class="turnero-surface-runtime-bootstrap__banner">${safeModeBanner}</div>`
                    : ''
            }
            <div class="turnero-surface-runtime-bootstrap__badge-wrap">
                ${launchBadge}
            </div>
            <div class="turnero-surface-runtime-bootstrap__grid">
                ${renderSectionLabel(
                    'Clinic profile',
                    state.clinicSummary || 'Perfil pendiente'
                )}
                ${renderSectionLabel(
                    'Storage',
                    state.storageState.detail || state.storageState.label
                )}
                ${renderSectionLabel(
                    'Heartbeat',
                    state.heartbeatState.detail || state.heartbeatState.label
                )}
                ${renderSectionLabel(
                    'Runtime contract',
                    state.runtimeState.detail || state.runtimeState.label
                )}
            </div>
            <div class="turnero-surface-runtime-bootstrap__brief-grid">
                ${renderBriefBox('Truth brief', truthBrief)}
                ${renderBriefBox('Readiness brief', readinessBrief)}
            </div>
            <section class="turnero-surface-runtime-bootstrap__truth-section">
                <div class="turnero-surface-runtime-bootstrap__truth-header">
                    <p class="turnero-surface-runtime-bootstrap__tile-label">Truth rows</p>
                    <span>${escapeHtml(
                        `${Number(state.truthSummary.aligned || 0)}/${Number(
                            state.truthSummary.totalCount || 0
                        )} aligned`
                    )}</span>
                </div>
                <ul class="turnero-surface-runtime-bootstrap__truth-list">
                    ${
                        surfaceRows ||
                        '<li class="turnero-surface-runtime-bootstrap__truth-row turnero-surface-runtime-bootstrap__truth-row--empty"><strong>Sin filas</strong><span>El registry todavía no respondió.</span></li>'
                    }
                </ul>
            </section>
            <section class="turnero-surface-runtime-bootstrap__checklist">
                ${smokeChecklist}
            </section>
            ${
                state.loading
                    ? `<p class="turnero-surface-runtime-bootstrap__note">Cargando bootstrap de surfaces...</p>`
                    : ''
            }
            ${
                state.error
                    ? `<p class="turnero-surface-runtime-bootstrap__error">${escapeHtml(
                          state.error
                      )}</p>`
                    : ''
            }
            <p class="turnero-surface-runtime-bootstrap__note">
                Registry ${escapeHtml(state.manifestSource)} · requested ${escapeHtml(
                    state.requestedManifestUrl || 'n/a'
                )} · resolved ${escapeHtml(
                    state.resolvedManifestUrl || 'n/a'
                )} · updated ${escapeHtml(formatTimestamp(state.generatedAt))}
            </p>
        </article>
    `.trim();
}

export function mountTurneroSurfaceRuntimeBootstrap(target, input = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const state = {
        ...input,
        loading: true,
    };

    const controller = {
        root: null,
        state,
        ready: null,
        rerender(nextState = {}) {
            Object.assign(controller.state, nextState);
            if (controller.root) {
                controller.root.innerHTML =
                    renderTurneroSurfaceRuntimeBootstrap(controller.state);
            }
            return controller.root;
        },
        setClinicProfile(nextClinicProfile = {}) {
            controller.state.clinicProfile = asObject(nextClinicProfile);
            return controller.rerender();
        },
        setRuntimeState(nextRuntimeState = {}) {
            controller.state.runtimeState = asObject(nextRuntimeState);
            return controller.rerender();
        },
        setHeartbeat(nextHeartbeat = {}) {
            controller.state.heartbeat = asObject(nextHeartbeat);
            return controller.rerender();
        },
        setStorageInfo(nextStorageInfo = {}) {
            controller.state.storageInfo = asObject(nextStorageInfo);
            return controller.rerender();
        },
        setTruthPack(nextTruthPack = {}) {
            controller.state.truthPack = nextTruthPack;
            return controller.rerender();
        },
        setReadinessPack(nextReadinessPack = {}) {
            controller.state.readinessPack = nextReadinessPack;
            return controller.rerender();
        },
        setRegistry(nextRegistry = {}) {
            controller.state.registry = asObject(nextRegistry);
            return controller.rerender();
        },
        setSurfaceLabel(nextSurfaceLabel = '') {
            controller.state.surfaceLabel = toString(nextSurfaceLabel, '');
            return controller.rerender();
        },
        setError(error) {
            controller.state.error = toString(
                error?.message || error,
                'surface_bootstrap_error'
            );
            return controller.rerender({ loading: false });
        },
    };

    host.innerHTML = renderTurneroSurfaceRuntimeBootstrap(state);
    controller.root = host.firstElementChild || host;

    controller.ready = (async () => {
        const registryOptions = {
            surfacesUrl: toString(
                input.registryOptions?.surfacesUrl,
                DEFAULT_SURFACES_URL
            ),
            manifestUrl: toString(
                input.registryOptions?.manifestUrl,
                DEFAULT_MANIFEST_URL
            ),
            fallbackManifestUrl: toString(
                input.registryOptions?.fallbackManifestUrl,
                '/app-downloads/pilot/release-manifest.json'
            ),
            refresh: input.registryOptions?.refresh === true,
        };

        try {
            if (
                !controller.state.registry ||
                Object.keys(controller.state.registry).length === 0
            ) {
                const loaded =
                    await loadTurneroSurfaceRegistrySource(registryOptions);
                controller.state.registry = loaded;
            }

            if (!controller.state.truthPack) {
                controller.state.truthPack =
                    buildTurneroSurfaceReleaseTruthPack({
                        registry: controller.state.registry,
                    });
            }

            if (!controller.state.readinessPack) {
                controller.state.readinessPack =
                    buildTurneroSurfaceReleaseReadinessPack({
                        ...controller.state,
                        registry: controller.state.registry,
                        truthPack: controller.state.truthPack,
                    });
            }

            controller.state.safeMode = getSafeModeState(
                controller.state.readinessPack,
                controller.state
            );
            controller.state.smoke = getSmokeChecklist(
                controller.state,
                controller.state.truthPack,
                controller.state.readinessPack,
                controller.state.safeMode
            );
            controller.state.loading = false;
            controller.state.error = '';
            controller.state.surfaceLabel = buildSurfaceLabel(controller.state);
            controller.rerender();
            return controller;
        } catch (error) {
            controller.state.loading = false;
            controller.state.error = String(error?.message || error || '');
            controller.rerender();
            return controller;
        }
    })();

    return controller;
}
