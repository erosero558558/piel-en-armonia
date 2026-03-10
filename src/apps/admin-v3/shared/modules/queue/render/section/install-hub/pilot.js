import { escapeHtml, setHtml } from '../../../../../ui/render.js';
import { DEFAULT_APP_DOWNLOADS } from './constants.js';
import {
    buildOpeningChecklistAssist,
    buildOpeningChecklistSteps,
} from './checklist.js';
import { buildPreparedSurfaceUrl } from './manifest.js';
import {
    applyOpeningChecklistSuggestions,
    ensureInstallPreset,
    ensureOpeningChecklistState,
} from './state.js';
import { getQueueSyncHealth } from './telemetry.js';

function buildQueueOpsPilot(manifest, detectedPlatform) {
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = [
        'operator_ready',
        'kiosk_ready',
        'sala_ready',
    ].filter((key) => Boolean(assist.suggestions[key]?.suggested)).length;
    const issueCount =
        Math.max(0, 3 - readyEquipmentCount) +
        (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;

    let tone = 'idle';
    let eyebrow = 'Siguiente paso';
    let title = 'Centro de apertura listo';
    let summary =
        'Sigue la siguiente acción sugerida para terminar la apertura sin revisar cada tarjeta por separado.';
    let primaryAction = null;
    let secondaryAction = null;
    let supportCopy = '';

    if (syncHealth.state === 'alert') {
        tone = 'alert';
        title = 'Resuelve la cola antes de abrir';
        summary =
            'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotRefreshBtn',
            action: 'queue-refresh-state',
            label: 'Refrescar cola ahora',
        };
        secondaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        supportCopy =
            'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.';
    } else if (suggestedCount > 0) {
        tone = 'suggested';
        title = `Confirma ${suggestedCount} paso(s) ya validados`;
        summary =
            pendingAfterSuggestions.length > 0
                ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotApplyBtn',
            label: `Confirmar sugeridos (${suggestedCount})`,
        };
        secondaryAction =
            pendingAfterSuggestions.length > 0
                ? {
                      kind: 'anchor',
                      href: pendingAfterSuggestions[0].href,
                      label: pendingAfterSuggestions[0].actionLabel,
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Volver a la cola',
                  };
        supportCopy =
            'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.';
    } else if (pendingAfterSuggestions.length > 0) {
        tone = syncHealth.state === 'warning' ? 'warning' : 'active';
        title = `Siguiente paso: ${pendingAfterSuggestions[0].title}`;
        summary =
            pendingAfterSuggestions.length > 1
                ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                : 'Solo queda una validación manual para dejar la apertura lista.';
        primaryAction = {
            kind: 'anchor',
            href: pendingAfterSuggestions[0].href,
            label: pendingAfterSuggestions[0].actionLabel,
        };
        secondaryAction =
            syncHealth.state === 'warning'
                ? {
                      kind: 'button',
                      id: 'queueOpsPilotRefreshBtn',
                      action: 'queue-refresh-state',
                      label: 'Refrescar cola',
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  };
        supportCopy = String(
            assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                pendingAfterSuggestions[0].hint ||
                ''
        );
    } else {
        tone = 'ready';
        eyebrow = 'Operación lista';
        title = 'Apertura completada';
        summary =
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.';
        primaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        secondaryAction = {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        };
        supportCopy =
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.';
    }

    return {
        tone,
        eyebrow,
        title,
        summary,
        supportCopy,
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        primaryAction,
        secondaryAction,
    };
}

function renderQueueOpsPilotAction(action, variant = 'secondary') {
    if (!action) return '';
    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button ${action.id ? `id="${escapeHtml(action.id)}"` : ''} type="button" class="${className}" ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}>
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a ${action.id ? `id="${escapeHtml(action.id)}"` : ''} href="${escapeHtml(action.href || '/')}" class="${className}" target="_blank" rel="noopener">
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

export function renderQueueOpsPilot(manifest, detectedPlatform, rerenderAll) {
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) return;

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    setHtml(
        '#queueOpsPilot',
        `
        <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
            <div class="queue-ops-pilot__layout">
                <div class="queue-ops-pilot__copy">
                    <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                    <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(pilot.title)}</h5>
                    <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(pilot.summary)}</p>
                    <p class="queue-ops-pilot__support">${escapeHtml(pilot.supportCopy)}</p>
                    <div class="queue-ops-pilot__actions">
                        ${renderQueueOpsPilotAction(pilot.primaryAction, 'primary')}
                        ${renderQueueOpsPilotAction(pilot.secondaryAction, 'secondary')}
                    </div>
                </div>
                <div class="queue-ops-pilot__status">
                    <div class="queue-ops-pilot__progress">
                        <div class="queue-ops-pilot__progress-head">
                            <span>Apertura confirmada</span>
                            <strong id="queueOpsPilotProgressValue">${escapeHtml(`${pilot.confirmedCount}/${pilot.totalSteps}`)}</strong>
                        </div>
                        <div class="queue-ops-pilot__bar" aria-hidden="true">
                            <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                        </div>
                    </div>
                    <div class="queue-ops-pilot__chips">
                        <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">Confirmados ${escapeHtml(String(pilot.confirmedCount))}</span>
                        <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">Sugeridos ${escapeHtml(String(pilot.suggestedCount))}</span>
                        <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3</span>
                        <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">Incidencias ${escapeHtml(String(pilot.issueCount))}</span>
                    </div>
                </div>
            </div>
        </section>
    `
    );

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) return;
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            rerenderAll();
        };
    }
}
