import { getState } from '../../../../../core/store.js';
import { escapeHtml, setHtml } from '../../../../../ui/render.js';
import { getQueueSource } from '../../../selectors.js';
import { DEFAULT_APP_DOWNLOADS, SURFACE_TELEMETRY_COPY } from './constants.js';
import { buildPreparedSurfaceUrl } from './manifest.js';
import { ensureInstallPreset } from './state.js';

export function formatHeartbeatAge(ageSec) {
    const safeAge = Number(ageSec);
    if (!Number.isFinite(safeAge) || safeAge < 0) return 'sin señal';
    if (safeAge < 60) return `${safeAge}s`;
    const minutes = Math.floor(safeAge / 60);
    const seconds = safeAge % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatIntervalAge(intervalMs) {
    const safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval <= 0) return 'cada --';
    const seconds = Math.max(1, Math.round(safeInterval / 1000));
    if (seconds < 60) return `cada ${seconds}s`;
    return `cada ${Math.round(seconds / 60)}m`;
}

function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object'
        ? runtime
        : {
              state: 'idle',
              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
              intervalMs: 45000,
              lastAttemptAt: 0,
              lastSuccessAt: 0,
              lastError: '',
              inFlight: false,
          };
}

function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle')
        .trim()
        .toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt
        ? `ultimo ciclo hace ${formatHeartbeatAge(Math.max(0, Math.round((Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000)))}`
        : 'sin ciclo exitoso todavía';

    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`,
        };
    }
    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(
                runtime.reason || 'Reanuda esta sección para continuar.'
            ),
        };
    }
    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(
                runtime.reason || `Modo degradado · ${lastSuccessLabel}`
            ),
        };
    }
    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`,
        };
    }
    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(
            runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.'
        ),
    };
}

function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

export function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object'
        ? raw
        : {
              surface: surfaceKey,
              status: 'unknown',
              stale: true,
              summary: '',
              latest: null,
              instances: [],
          };
}

function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') return ['Sin señal'];
    const details =
        latest.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    const chips = [];
    const appMode = String(latest.appMode || '').trim();
    chips.push(
        appMode === 'desktop'
            ? 'Desktop'
            : appMode === 'android_tv'
              ? 'Android TV'
              : 'Web'
    );

    if (surfaceKey === 'operator') {
        const station = String(details.station || '').toUpperCase();
        const stationMode = String(details.stationMode || '');
        if (station)
            chips.push(
                stationMode === 'locked'
                    ? `${station} fijo`
                    : `${station} libre`
            );
        chips.push(details.oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(details.numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    } else if (surfaceKey === 'kiosk') {
        chips.push(details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Cola en vivo'
                : 'Cola degradada'
        );
    } else if (surfaceKey === 'display') {
        chips.push(details.bellPrimed ? 'Audio listo' : 'Audio pendiente');
        chips.push(details.bellMuted ? 'Campanilla Off' : 'Campanilla On');
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Sala en vivo'
                : 'Sala degradada'
        );
    }

    return chips.slice(0, 4);
}

function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [
        {
            key: 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];

    return cards.map((entry) => {
        const group = getSurfaceTelemetryState(entry.key);
        const latest =
            group.latest && typeof group.latest === 'object'
                ? group.latest
                : null;
        const effectiveState = String(group.status || 'unknown');
        const summary =
            String(group.summary || '').trim() ||
            SURFACE_TELEMETRY_COPY[entry.key]?.emptySummary ||
            'Sin señal todavía.';
        const route = buildPreparedSurfaceUrl(
            entry.fallbackSurface,
            entry.appConfig,
            { ...preset, surface: entry.fallbackSurface }
        );

        return {
            key: entry.key,
            title: SURFACE_TELEMETRY_COPY[entry.key]?.title || entry.key,
            state: ['ready', 'warning', 'alert'].includes(effectiveState)
                ? effectiveState
                : 'unknown',
            badge:
                effectiveState === 'ready'
                    ? 'En vivo'
                    : effectiveState === 'alert'
                      ? 'Atender'
                      : effectiveState === 'warning'
                        ? 'Revisar'
                        : 'Sin señal',
            deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
            summary,
            ageLabel:
                latest && latest.ageSec !== undefined && latest.ageSec !== null
                    ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            route,
            actionLabel: entry.actionLabel,
        };
    });
}

export function getQueueSyncHealth() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const syncMode = String(state.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state.queue?.fallbackPartial);
    const updatedAt = String(queueMeta?.updatedAt || '').trim();
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const ageSec = Number.isFinite(updatedAtMs)
        ? Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
        : null;

    if (syncMode === 'fallback' || fallbackPartial) {
        return {
            state: 'alert',
            badge: 'Atender ahora',
            title: 'Cola en fallback',
            summary:
                'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
            steps: [
                'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
            ],
        };
    }

    if (Number.isFinite(ageSec) && ageSec >= 60) {
        return {
            state: 'warning',
            badge: `Watchdog ${ageSec}s`,
            title: 'Realtime lento o en reconexión',
            summary:
                'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
            steps: [
                'Refresca la cola y confirma que Sync vuelva a "vivo".',
                'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
            ],
        };
    }

    return {
        state: 'ready',
        badge: 'Sin incidentes',
        title: 'Cola sincronizada',
        summary:
            'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
        steps: [
            'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
            'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
            'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
        ],
    };
}

export function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) return;

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const hasAlert = cards.some((card) => card.state === 'alert');
    const hasWarning = cards.some(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const title = hasAlert
        ? 'Equipos con atención urgente'
        : hasWarning
          ? 'Equipos con señal parcial'
          : 'Equipos en vivo';
    const summary = hasAlert
        ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.'
        : hasWarning
          ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.'
          : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.';
    const statusLabel = hasAlert
        ? 'Atender ahora'
        : hasWarning
          ? 'Revisar hoy'
          : 'Todo al día';
    const statusState = hasAlert ? 'alert' : hasWarning ? 'warning' : 'ready';

    setHtml(
        '#queueSurfaceTelemetry',
        `
        <section class="queue-surface-telemetry__shell">
            <div class="queue-surface-telemetry__header">
                <div>
                    <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                    <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(title)}</h5>
                    <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(summary)}</p>
                    <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                        <span id="queueSurfaceTelemetryAutoState" class="queue-surface-telemetry__auto-state" data-state="${escapeHtml(autoRefresh.state)}">${escapeHtml(autoRefresh.label)}</span>
                        <span class="queue-surface-telemetry__auto-copy">${escapeHtml(autoRefresh.meta)}</span>
                    </div>
                </div>
                <span id="queueSurfaceTelemetryStatus" class="queue-surface-telemetry__status" data-state="${escapeHtml(statusState)}">${escapeHtml(statusLabel)}</span>
            </div>
            <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                ${cards
                    .map(
                        (card) => `
                    <article class="queue-surface-card" data-state="${escapeHtml(card.state)}" role="listitem">
                        <div class="queue-surface-card__header">
                            <div>
                                <strong>${escapeHtml(card.title)}</strong>
                                <p class="queue-surface-card__meta">${escapeHtml(card.deviceLabel)}</p>
                            </div>
                            <span class="queue-surface-card__badge">${escapeHtml(card.badge)}</span>
                        </div>
                        <p class="queue-surface-card__summary">${escapeHtml(card.summary)}</p>
                        <p class="queue-surface-card__age">${escapeHtml(card.ageLabel)}</p>
                        <div class="queue-surface-card__chips">${card.chips.map((chip) => `<span class="queue-surface-card__chip">${escapeHtml(chip)}</span>`).join('')}</div>
                        <div class="queue-surface-card__actions">
                            <a href="${escapeHtml(card.route)}" target="_blank" rel="noopener" class="queue-surface-card__action queue-surface-card__action--primary">${escapeHtml(card.actionLabel)}</a>
                            <button type="button" class="queue-surface-card__action" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(card.route)}">Copiar ruta</button>
                            <button type="button" class="queue-surface-card__action" data-action="refresh-admin-data">Actualizar estado</button>
                        </div>
                    </article>
                `
                    )
                    .join('')}
            </div>
        </section>
    `
    );
}
