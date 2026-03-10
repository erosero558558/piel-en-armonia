import { escapeHtml, setHtml } from '../../../../../../ui/render.js';
import { buildSurfaceTelemetryCards } from './cards.js';
import { formatHeartbeatAge, formatIntervalAge } from './format.js';
import { getSurfaceTelemetryAutoRefreshState } from './state.js';

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
