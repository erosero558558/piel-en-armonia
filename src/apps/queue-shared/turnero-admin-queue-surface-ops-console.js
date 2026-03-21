import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { getTurneroClinicProfileFingerprint } from './clinic-profile.js';
import { buildTurneroSurfaceHeartbeatMonitor } from './turnero-surface-heartbeat-monitor.js';
import {
    appendTurneroSurfaceFallbackDrill,
    listTurneroSurfaceFallbackDrills,
} from './turnero-surface-fallback-drill-store.js';
import {
    appendTurneroSurfaceCheckinLogbookEntry,
    listTurneroSurfaceCheckinLogbook,
} from './turnero-surface-checkin-logbook.js';
import { buildTurneroSurfaceOpsReadinessPack } from './turnero-surface-ops-readiness-pack.js';
import { buildTurneroSurfaceOpsSummary } from './turnero-surface-ops-summary.js';
import { mountTurneroSurfaceIncidentBanner } from './turnero-surface-incident-banner.js';
import {
    ensureTurneroSurfaceOpsStyles,
    mountTurneroSurfaceCheckpointChip,
} from './turnero-surface-checkpoint-chip.js';

const PILOT_RELEASE_MANIFEST_URL = '/app-downloads/pilot/release-manifest.json';

let pilotReleaseManifestCache = null;
let pilotReleaseManifestPromise = null;

function resolveHost(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function normalizeSurface(surface) {
    const normalized = toText(surface, 'operator').toLowerCase();
    return normalized === 'sala_tv' ? 'display' : normalized;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDateTime(value) {
    const timestamp =
        typeof value === 'number' ? value : Date.parse(toText(value));
    if (!Number.isFinite(timestamp)) {
        return '';
    }

    try {
        return new Date(timestamp).toLocaleString('es-EC', {
            dateStyle: 'short',
            timeStyle: 'short',
        });
    } catch (_error) {
        return new Date(timestamp).toISOString();
    }
}

function formatNowLabel(now) {
    return formatDateTime(Number(now) || Date.now());
}

function buildSnapshotScope(clinicProfile) {
    const clinicId = toText(clinicProfile?.clinic_id, 'default-clinic');
    const fingerprint = toText(
        getTurneroClinicProfileFingerprint(clinicProfile),
        'default-profile'
    ).slice(0, 8);
    return `${clinicId}-${fingerprint}`.replace(/[^a-z0-9-_]+/gi, '-');
}

function resolveRegistryEntry(surfaceRegistry, surface) {
    const registry = asObject(surfaceRegistry);
    const normalizedSurface = normalizeSurface(surface);
    const direct = asObject(registry[normalizedSurface]);
    if (Object.keys(direct).length > 0) {
        return direct;
    }

    if (normalizedSurface === 'display') {
        return asObject(registry.sala_tv);
    }

    return {};
}

function resolveReleaseEntry(releaseManifest, surface, registryEntry = {}) {
    const manifest = asObject(releaseManifest);
    const apps = asObject(manifest.apps);
    const registryId = normalizeSurface(registryEntry.id);
    return asObject(
        apps[normalizeSurface(surface)] || apps[registryId] || apps.sala_tv
    );
}

function resolveReleaseTargets(releaseEntry = {}) {
    return Object.entries(asObject(releaseEntry.targets))
        .map(([targetKey, targetValue]) => ({
            id: targetKey,
            label: toText(targetValue?.label, targetKey),
            url: toText(targetValue?.url),
            bytes: Number(targetValue?.bytes || 0),
        }))
        .filter((entry) => entry.url);
}

function resolveSurfaceRows({
    clinicProfile,
    telemetryMap,
    surfaceRegistry,
    releaseManifest,
    now,
} = {}) {
    const monitor = buildTurneroSurfaceHeartbeatMonitor({
        telemetryMap,
        clinicProfile,
        surfaceRegistry,
        now,
    });

    return monitor.rows.map((row) => {
        const registryEntry = resolveRegistryEntry(
            surfaceRegistry,
            row.surface
        );
        const drills = listTurneroSurfaceFallbackDrills({
            clinicProfile,
            surface: row.surface,
        });
        const logbook = listTurneroSurfaceCheckinLogbook({
            clinicProfile,
            surface: row.surface,
        });
        const readiness = buildTurneroSurfaceOpsReadinessPack({
            surface: row.surface,
            watch: row.watch,
            drills,
            logbook,
            now,
        });
        const summary = buildTurneroSurfaceOpsSummary({
            surface: row.surface,
            watch: row.watch,
            readiness,
            drills,
            logbook,
        });
        const release = resolveReleaseEntry(
            releaseManifest,
            row.surface,
            registryEntry
        );

        return {
            ...row,
            registryEntry,
            drills,
            logbook,
            readiness,
            summary,
            release,
            releaseTargets: resolveReleaseTargets(release),
        };
    });
}

function buildSurfaceOpsSnapshot({
    clinicProfile,
    releaseManifest,
    rows,
    now,
} = {}) {
    return {
        generatedAt: new Date(Number(now) || Date.now()).toISOString(),
        clinicId: toText(clinicProfile?.clinic_id),
        clinicName: toText(
            clinicProfile?.branding?.name || clinicProfile?.branding?.short_name
        ),
        profileFingerprint: toText(
            getTurneroClinicProfileFingerprint(clinicProfile)
        ),
        releaseManifest: {
            channel: toText(releaseManifest?.channel),
            version: toText(releaseManifest?.version),
            releasedAt: toText(releaseManifest?.releasedAt),
        },
        surfaces: rows.map((row) => ({
            surface: row.surface,
            label: row.label,
            registryId: toText(row.registryEntry?.id, row.surface),
            watch: row.watch,
            readiness: row.readiness,
            summary: row.summary,
            release: {
                version: toText(row.release?.version),
                updatedAt: toText(row.release?.updatedAt),
                guideUrl: toText(
                    row.release?.guideUrl || row.registryEntry?.guideUrl
                ),
                targets: row.releaseTargets,
            },
            drills: row.drills,
            logbook: row.logbook,
        })),
    };
}

function buildSurfaceBriefLine(row) {
    const details = [
        `${row.label}: ${toText(row.watch.state, 'unknown')}`,
        `score ${toText(row.summary.scoreLabel, '--')}`,
        `decision ${toText(row.summary.decisionLabel, 'Review')}`,
        `heartbeat ${toText(row.summary.heartbeatChipValue, 'sin envio')}`,
        `canon ${toText(row.summary.contractLabel, 'sin detalle')}`,
    ];

    const extras = [
        toText(row.summary.summaryText),
        row.summary.latestDrillLabel !== 'Sin drill reciente'
            ? `drill ${row.summary.latestDrillLabel}`
            : '',
        row.summary.latestLogLabel !== 'Sin bitacora reciente'
            ? `bitacora ${row.summary.latestLogLabel}`
            : '',
    ].filter(Boolean);

    return `- ${details.join(' · ')}\n  ${extras.join(' · ')}`;
}

function buildOpsBrief({
    clinicProfile,
    releaseManifest,
    rows,
    now,
    title = 'Turnero Surface Ops Brief',
} = {}) {
    const header = [
        title,
        `Clinica: ${toText(clinicProfile?.clinic_id, 'sin-clinic-id')}`,
        `Firma: ${toText(
            getTurneroClinicProfileFingerprint(clinicProfile),
            'sin-firma'
        )}`,
        `Generado: ${formatNowLabel(now)}`,
        `Release pilot: ${toText(releaseManifest?.version, 'sin-manifest')} · ${toText(
            releaseManifest?.releasedAt,
            'sin-fecha'
        )}`,
    ];

    return `${header.join('\n')}\n\n${rows
        .map((row) => buildSurfaceBriefLine(row))
        .join('\n')}`;
}

function renderEntriesList(entries, kind) {
    const items = toArray(entries).slice(0, 3);
    if (!items.length) {
        return `<p class="turnero-surface-ops-console__empty">Sin ${escapeHtml(
            kind
        )} reciente.</p>`;
    }

    return `
        <ul class="turnero-surface-ops-console__list">
            ${items
                .map(
                    (entry) => `
                        <li>
                            <strong>${escapeHtml(
                                toText(entry.title, 'Registro')
                            )}</strong>
                            ${escapeHtml(toText(entry.detail || entry.note))}
                            ${
                                toText(
                                    entry.createdAt ||
                                        entry.updatedAt ||
                                        entry.at
                                )
                                    ? ` · ${escapeHtml(
                                          formatDateTime(
                                              entry.createdAt ||
                                                  entry.updatedAt ||
                                                  entry.at
                                          )
                                      )}`
                                    : ''
                            }
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function renderSupportList(row) {
    const notes = toArray(row.registryEntry?.notes);
    const links = [];
    const guideUrl = toText(
        row.registryEntry?.guideUrl || row.release?.guideUrl
    );
    if (guideUrl) {
        links.push(
            `<a href="${escapeHtml(
                guideUrl
            )}" target="_blank" rel="noopener">Guia</a>`
        );
    }
    row.releaseTargets.forEach((target) => {
        links.push(
            `<a href="${escapeHtml(
                target.url
            )}" target="_blank" rel="noopener">${escapeHtml(target.label)}</a>`
        );
    });

    const linkMarkup = links.length
        ? `<p class="turnero-surface-ops-console__meta">${links.join(' · ')}</p>`
        : '';

    if (!notes.length) {
        return `${linkMarkup}<p class="turnero-surface-ops-console__empty">Sin notas adicionales.</p>`;
    }

    return `
        ${linkMarkup}
        <ul class="turnero-surface-ops-console__list">
            ${notes
                .slice(0, 3)
                .map((note) => `<li>${escapeHtml(note)}</li>`)
                .join('')}
        </ul>
    `;
}

async function ensurePilotReleaseManifest() {
    if (pilotReleaseManifestCache) {
        return pilotReleaseManifestCache;
    }
    if (pilotReleaseManifestPromise) {
        return pilotReleaseManifestPromise;
    }
    if (typeof fetch !== 'function') {
        return {};
    }

    pilotReleaseManifestPromise = fetch(PILOT_RELEASE_MANIFEST_URL, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
        },
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`release_manifest_${response.status}`);
            }
            return response.json();
        })
        .then((payload) => {
            pilotReleaseManifestCache =
                payload && typeof payload === 'object' ? payload : {};
            return pilotReleaseManifestCache;
        })
        .catch(() => ({}))
        .finally(() => {
            pilotReleaseManifestPromise = null;
        });

    return pilotReleaseManifestPromise;
}

function promptForEntry(label, fallbackTitle, fallbackDetail) {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
        return null;
    }

    const title = window.prompt(`${label}: titulo`, fallbackTitle);
    if (title === null) {
        return null;
    }

    const detail = window.prompt(`${label}: detalle`, fallbackDetail);
    if (detail === null) {
        return null;
    }

    return {
        title: toText(title, fallbackTitle),
        detail: toText(detail, fallbackDetail),
    };
}

export function mountTurneroAdminQueueSurfaceOpsConsole(
    target,
    {
        clinicProfile,
        telemetryMap,
        surfaceRegistry,
        releaseManifest,
        now = Date.now(),
    } = {}
) {
    const host = resolveHost(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    let currentReleaseManifest =
        releaseManifest && typeof releaseManifest === 'object'
            ? releaseManifest
            : {};

    function getRows() {
        return resolveSurfaceRows({
            clinicProfile,
            telemetryMap,
            surfaceRegistry,
            releaseManifest: currentReleaseManifest,
            now: typeof now === 'function' ? now() : now,
        });
    }

    function render() {
        const renderNow = typeof now === 'function' ? now() : now;
        const rows = getRows();
        const monitorCounts = rows.reduce(
            (accumulator, row) => {
                accumulator[toText(row.watch.state, 'unknown')] =
                    Number(
                        accumulator[toText(row.watch.state, 'unknown')] || 0
                    ) + 1;
                return accumulator;
            },
            {
                healthy: 0,
                watch: 0,
                fallback: 0,
                unknown: 0,
            }
        );

        host.className = 'turnero-surface-ops-console queue-app-card';
        host.innerHTML = `
            <div class="turnero-surface-ops-console__header">
                <div>
                    <p class="queue-app-card__eyebrow">Surface ops / fallback</p>
                    <h3>Consola operativa por superficie</h3>
                    <p class="turnero-surface-ops-console__meta">
                        Clinica ${escapeHtml(
                            toText(clinicProfile?.clinic_id, 'sin-clinic-id')
                        )} · firma ${escapeHtml(
                            toText(
                                getTurneroClinicProfileFingerprint(
                                    clinicProfile
                                ),
                                'sin-firma'
                            ).slice(0, 12)
                        )} · render ${escapeHtml(formatNowLabel(renderNow))}
                    </p>
                    <p class="turnero-surface-ops-console__meta">
                        healthy ${escapeHtml(String(monitorCounts.healthy))} · watch ${escapeHtml(
                            String(monitorCounts.watch)
                        )} · fallback ${escapeHtml(
                            String(monitorCounts.fallback)
                        )} · release ${escapeHtml(
                            toText(
                                currentReleaseManifest?.version,
                                'sin-manifest'
                            )
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
            <div class="turnero-surface-ops-console__grid">
                ${rows
                    .map(
                        (row) => `
                            <article
                                class="turnero-surface-ops-console__surface"
                                data-state="${escapeHtml(row.watch.state)}"
                                data-surface="${escapeHtml(row.surface)}"
                            >
                                <div class="turnero-surface-ops-console__surface-header">
                                    <div>
                                        <h4 class="turnero-surface-ops-console__surface-title">${escapeHtml(
                                            row.label
                                        )}</h4>
                                        <p class="turnero-surface-ops-console__meta">
                                            Heartbeat ${escapeHtml(
                                                row.summary.heartbeatChipValue
                                            )} · ${escapeHtml(
                                                row.summary.contractLabel
                                            )} · decision ${escapeHtml(
                                                row.summary.decisionLabel
                                            )}
                                        </p>
                                    </div>
                                    <div class="turnero-surface-ops-console__surface-actions">
                                        <button
                                            type="button"
                                            class="turnero-surface-ops-console__button"
                                            data-action="copy-surface"
                                            data-surface="${escapeHtml(row.surface)}"
                                        >
                                            Copiar
                                        </button>
                                        <button
                                            type="button"
                                            class="turnero-surface-ops-console__button"
                                            data-action="download-surface"
                                            data-surface="${escapeHtml(row.surface)}"
                                        >
                                            Descargar
                                        </button>
                                        <button
                                            type="button"
                                            class="turnero-surface-ops-console__button"
                                            data-action="add-drill"
                                            data-surface="${escapeHtml(row.surface)}"
                                        >
                                            Agregar drill
                                        </button>
                                        <button
                                            type="button"
                                            class="turnero-surface-ops-console__button"
                                            data-action="add-log"
                                            data-surface="${escapeHtml(row.surface)}"
                                        >
                                            Agregar bitacora
                                        </button>
                                    </div>
                                </div>
                                <div data-turnero-surface-banner="${escapeHtml(
                                    row.surface
                                )}"></div>
                                <div
                                    class="turnero-surface-ops__chips"
                                    data-turnero-surface-chips="${escapeHtml(
                                        row.surface
                                    )}"
                                ></div>
                                <section class="turnero-surface-ops-console__section">
                                    <h4>Resumen</h4>
                                    <p>${escapeHtml(row.summary.summaryText)}</p>
                                    ${
                                        row.summary.detailText
                                            ? `<p class="turnero-surface-ops-console__meta">${escapeHtml(
                                                  row.summary.detailText
                                              )}</p>`
                                            : ''
                                    }
                                </section>
                                <section class="turnero-surface-ops-console__section">
                                    <h4>Canon</h4>
                                    <ul class="turnero-surface-ops-console__list">
                                        <li>Esperado: ${escapeHtml(
                                            toText(
                                                row.watch.expectedRoute,
                                                'sin canon'
                                            )
                                        )}</li>
                                        <li>Actual: ${escapeHtml(
                                            toText(
                                                row.watch.currentRoute,
                                                'sin ruta'
                                            )
                                        )}</li>
                                        <li>clinicId: ${escapeHtml(
                                            toText(
                                                row.watch.reportedClinicId,
                                                'sin clinicId'
                                            )
                                        )}</li>
                                        <li>fingerprint: ${escapeHtml(
                                            toText(
                                                row.watch.reportedFingerprint,
                                                'sin firma'
                                            ).slice(0, 16)
                                        )}</li>
                                    </ul>
                                </section>
                                <section class="turnero-surface-ops-console__section">
                                    <h4>Drills recientes</h4>
                                    ${renderEntriesList(row.drills, 'drill')}
                                </section>
                                <section class="turnero-surface-ops-console__section">
                                    <h4>Ultima bitacora</h4>
                                    ${renderEntriesList(row.logbook, 'bitacora')}
                                </section>
                                <section class="turnero-surface-ops-console__section">
                                    <h4>Release y soporte</h4>
                                    <p class="turnero-surface-ops-console__meta">
                                        Version ${escapeHtml(
                                            toText(
                                                row.release?.version,
                                                'sin release'
                                            )
                                        )} · updatedAt ${escapeHtml(
                                            toText(
                                                row.release?.updatedAt,
                                                'sin fecha'
                                            )
                                        )}
                                    </p>
                                    ${renderSupportList(row)}
                                </section>
                            </article>
                        `
                    )
                    .join('')}
            </div>
        `;

        rows.forEach((row) => {
            const chipsHost = host.querySelector(
                `[data-turnero-surface-chips="${row.surface}"]`
            );
            if (chipsHost instanceof HTMLElement) {
                chipsHost.replaceChildren();
                [
                    {
                        label: 'Ops',
                        value: row.summary.opsChipValue,
                        state: row.summary.opsChipState,
                    },
                    {
                        label: 'Heartbeat',
                        value: row.summary.heartbeatChipValue,
                        state: row.summary.heartbeatChipState,
                    },
                    {
                        label: 'Score',
                        value: row.summary.scoreLabel,
                        state: row.summary.scoreState,
                    },
                    {
                        label: 'Canon',
                        value: row.summary.contractLabel,
                        state: row.summary.contractState,
                    },
                ].forEach((chip) => {
                    const chipNode = document.createElement('span');
                    chipsHost.appendChild(chipNode);
                    mountTurneroSurfaceCheckpointChip(chipNode, chip);
                });
            }

            const bannerHost = host.querySelector(
                `[data-turnero-surface-banner="${row.surface}"]`
            );
            if (bannerHost instanceof HTMLElement) {
                mountTurneroSurfaceIncidentBanner(bannerHost, {
                    surface: row.surface,
                    watch: row.watch,
                    readiness: row.readiness,
                    summary: row.summary,
                });
            }
        });

        host.querySelectorAll('[data-action]').forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            button.onclick = async () => {
                const action = toText(button.dataset.action);
                const surface = normalizeSurface(button.dataset.surface);
                const activeRows = getRows();
                const activeRow =
                    activeRows.find((row) => row.surface === surface) || null;

                if (action === 'copy-all') {
                    await copyToClipboardSafe(
                        buildOpsBrief({
                            clinicProfile,
                            releaseManifest: currentReleaseManifest,
                            rows: activeRows,
                            now: renderNow,
                        })
                    );
                    return;
                }

                if (action === 'download-all') {
                    downloadJsonSnapshot(
                        `turnero-surface-ops-${buildSnapshotScope(
                            clinicProfile
                        )}.json`,
                        buildSurfaceOpsSnapshot({
                            clinicProfile,
                            releaseManifest: currentReleaseManifest,
                            rows: activeRows,
                            now: renderNow,
                        })
                    );
                    return;
                }

                if (!activeRow) {
                    return;
                }

                if (action === 'copy-surface') {
                    await copyToClipboardSafe(
                        buildOpsBrief({
                            clinicProfile,
                            releaseManifest: currentReleaseManifest,
                            rows: [activeRow],
                            now: renderNow,
                            title: `Turnero Surface Ops · ${activeRow.label}`,
                        })
                    );
                    return;
                }

                if (action === 'download-surface') {
                    downloadJsonSnapshot(
                        `turnero-surface-${surface}-${buildSnapshotScope(
                            clinicProfile
                        )}.json`,
                        buildSurfaceOpsSnapshot({
                            clinicProfile,
                            releaseManifest: currentReleaseManifest,
                            rows: [activeRow],
                            now: renderNow,
                        })
                    );
                    return;
                }

                if (action === 'add-drill') {
                    const entry = promptForEntry(
                        `Drill ${activeRow.label}`,
                        `Drill ${activeRow.label}`,
                        activeRow.summary.summaryText
                    );
                    if (!entry) {
                        return;
                    }
                    appendTurneroSurfaceFallbackDrill({
                        clinicProfile,
                        surface,
                        entry: {
                            ...entry,
                            actor: 'ops',
                            state: activeRow.readiness.band,
                            decision: activeRow.readiness.decision,
                            createdAt: new Date(renderNow).toISOString(),
                        },
                    });
                    render();
                    return;
                }

                if (action === 'add-log') {
                    const entry = promptForEntry(
                        `Bitacora ${activeRow.label}`,
                        `Bitacora ${activeRow.label}`,
                        activeRow.summary.summaryText
                    );
                    if (!entry) {
                        return;
                    }
                    appendTurneroSurfaceCheckinLogbookEntry({
                        clinicProfile,
                        surface,
                        entry: {
                            ...entry,
                            owner: 'ops',
                            severity:
                                activeRow.watch.state === 'fallback'
                                    ? 'alert'
                                    : activeRow.watch.state === 'watch'
                                      ? 'warning'
                                      : 'ready',
                            createdAt: new Date(renderNow).toISOString(),
                        },
                    });
                    render();
                }
            };
        });
    }

    render();

    if (!asObject(currentReleaseManifest).apps) {
        void ensurePilotReleaseManifest().then((payload) => {
            if (!(host instanceof HTMLElement) || !host.isConnected) {
                return;
            }
            if (
                payload &&
                typeof payload === 'object' &&
                Object.keys(payload).length
            ) {
                currentReleaseManifest = payload;
                render();
            }
        });
    }

    return {
        refresh() {
            render();
        },
    };
}
