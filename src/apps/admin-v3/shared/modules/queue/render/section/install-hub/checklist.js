import { getState } from '../../../../../core/store.js';
import { escapeHtml, setHtml } from '../../../../../ui/render.js';
import { getQueueSource } from '../../../selectors.js';
import { DEFAULT_APP_DOWNLOADS } from './constants.js';
import { buildPreparedSurfaceUrl } from './manifest.js';
import {
    applyOpeningChecklistSuggestions,
    ensureInstallPreset,
    ensureOpeningChecklistState,
    formatOpeningChecklistDate,
    resetOpeningChecklistState,
    setOpeningChecklistStep,
} from './state.js';
import { getSurfaceTelemetryState } from './telemetry.js';

export function buildOpeningChecklistSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';

    return [
        {
            id: 'operator_ready',
            title: 'Operador + Genius Numpad 1000',
            detail: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''} y confirma Numpad Enter, Decimal y Subtract.`,
            hint: 'El receptor USB 2.4 GHz del numpad debe quedar conectado en el PC operador.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_ready',
            title: 'Kiosco + ticket térmico',
            detail: 'Abre el kiosco, genera un ticket de prueba y confirma que el panel muestre "Impresion OK".',
            hint: 'Revisa papel, energía y USB de la térmica antes de dejar autoservicio abierto.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_ready',
            title: 'Sala TV + audio en TCL C655',
            detail: 'Abre la sala, ejecuta "Probar campanilla" y confirma audio activo con la TV conectada por Ethernet.',
            hint: 'La TCL C655 debe quedar con volumen fijo y sin mute antes del primer llamado real.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
        {
            id: 'smoke_ready',
            title: 'Smoke final de apertura',
            detail: 'Haz un llamado real o de prueba desde Operador y verifica que recepción, kiosco y sala entiendan el flujo completo.',
            hint: 'Marca este paso solo cuando el llamado salga end-to-end y sea visible en la TV.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
    ];
}

function getLatestSurfaceDetails(surfaceKey) {
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest =
        group.latest && typeof group.latest === 'object' ? group.latest : null;
    const details =
        latest?.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    return { group, details };
}

function hasRecentQueueSmokeSignal(maxAgeSec = 21600) {
    const queueMeta = getQueueSource().queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) return true;

    const queueTickets = Array.isArray(getState().data?.queueTickets)
        ? getState().data.queueTickets
        : [];
    if (queueTickets.some((ticket) => String(ticket.status || '') === 'called'))
        return true;

    return (getState().queue?.activity || []).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) return false;
        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) return true;
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}

export function buildOpeningChecklistAssist(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');

    const operatorStation = String(
        operator.details.station || ''
    ).toLowerCase();
    const operatorConnection = String(
        operator.details.connection || 'live'
    ).toLowerCase();
    const operatorStationMatches =
        !preset.lock || !operatorStation || operatorStation === expectedStation;
    const operatorSuggested =
        operator.group.status === 'ready' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen) &&
        operatorStationMatches &&
        operatorConnection !== 'fallback';

    const kioskConnection = String(
        kiosk.details.connection || ''
    ).toLowerCase();
    const kioskSuggested =
        kiosk.group.status === 'ready' &&
        !kiosk.group.stale &&
        Boolean(kiosk.details.printerPrinted) &&
        kioskConnection === 'live';

    const displayConnection = String(
        display.details.connection || ''
    ).toLowerCase();
    const displaySuggested =
        display.group.status === 'ready' &&
        !display.group.stale &&
        Boolean(display.details.bellPrimed) &&
        !display.details.bellMuted &&
        displayConnection === 'live';

    const smokeSuggested =
        operatorSuggested && displaySuggested && hasRecentQueueSmokeSignal();

    const suggestions = {
        operator_ready: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? `Heartbeat operador listo${preset.lock ? ` en ${expectedStation.toUpperCase()} fijo` : ''} con numpad detectado.`
                : operator.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del operador.'
                  : !operatorStationMatches
                    ? `El operador reporta ${operatorStation.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`
                    : !operator.details.numpadSeen
                      ? 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                      : 'Confirma el operador manualmente antes de abrir consulta.',
        },
        kiosk_ready: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                : kiosk.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del kiosco.'
                  : !kiosk.details.printerPrinted
                    ? 'Falta imprimir un ticket real o de prueba para validar la térmica.'
                    : kioskConnection !== 'live'
                      ? 'El kiosco no está reportando cola en vivo todavía.'
                      : 'Confirma el kiosco manualmente antes de abrir autoservicio.',
        },
        sala_ready: {
            suggested: displaySuggested,
            reason: displaySuggested
                ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                : display.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                  : display.details.bellMuted
                    ? 'La TV sigue en mute o con campanilla apagada.'
                    : !display.details.bellPrimed
                      ? 'Falta ejecutar la prueba de campanilla en la TV.'
                      : displayConnection !== 'live'
                        ? 'La Sala TV no está reportando conexión en vivo todavía.'
                        : 'Confirma la Sala TV manualmente antes del primer llamado.',
        },
        smoke_ready: {
            suggested: smokeSuggested,
            reason: smokeSuggested
                ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(([_stepId, signal]) => Boolean(signal?.suggested))
        .map(([stepId]) => stepId);

    return { suggestedIds, suggestions, suggestedCount: suggestedIds.length };
}

export function renderOpeningChecklist(
    manifest,
    detectedPlatform,
    rerenderAll
) {
    const root = document.getElementById('queueOpeningChecklist');
    if (!(root instanceof HTMLElement)) return;

    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = steps.filter(
        (step) =>
            !checklist.steps[step.id] &&
            Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Apertura diaria lista'
            : suggestedCount > 0
              ? 'Apertura diaria asistida'
              : confirmedCount <= 0
                ? 'Apertura diaria pendiente'
                : `Apertura diaria: faltan ${pendingCount} paso(s)`;
    const summary =
        pendingCount <= 0
            ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
            : suggestedCount > 0
              ? `${suggestedCount} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
              : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';

    setHtml(
        '#queueOpeningChecklist',
        `
        <section class="queue-opening-checklist__shell">
            <div class="queue-opening-checklist__header">
                <div>
                    <p class="queue-app-card__eyebrow">Apertura diaria</p>
                    <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${escapeHtml(title)}</h5>
                    <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${escapeHtml(summary)}</p>
                </div>
                <div class="queue-opening-checklist__meta">
                    <span id="queueOpeningChecklistAssistChip" class="queue-opening-checklist__assist" data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}">${escapeHtml(suggestedCount > 0 ? `Sugeridos ${suggestedCount}` : pendingCount <= 0 ? 'Checklist completo' : `Confirmados ${confirmedCount}/${steps.length}`)}</span>
                    <button id="queueOpeningChecklistApplyBtn" type="button" class="queue-opening-checklist__apply" ${suggestedCount > 0 ? '' : 'disabled'}>${suggestedCount > 0 ? `Confirmar sugeridos (${suggestedCount})` : 'Sin sugeridos todavía'}</button>
                    <button id="queueOpeningChecklistResetBtn" type="button" class="queue-opening-checklist__reset">Reiniciar apertura de hoy</button>
                    <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">${escapeHtml(formatOpeningChecklistDate(checklist.date))}</span>
                </div>
            </div>
            <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">
                ${steps
                    .map((step) => {
                        const isReady = Boolean(checklist.steps[step.id]);
                        const isSuggested =
                            !isReady &&
                            Boolean(assist.suggestions[step.id]?.suggested);
                        const stepState = isReady
                            ? 'ready'
                            : isSuggested
                              ? 'suggested'
                              : 'pending';
                        const stateLabel = isReady
                            ? 'Confirmado'
                            : isSuggested
                              ? 'Sugerido'
                              : 'Pendiente';
                        const evidence = String(
                            assist.suggestions[step.id]?.reason || step.hint
                        );
                        return `
                        <article class="queue-opening-step" data-state="${stepState}" role="listitem">
                            <div class="queue-opening-step__header">
                                <div>
                                    <strong>${escapeHtml(step.title)}</strong>
                                    <p class="queue-opening-step__detail">${escapeHtml(step.detail)}</p>
                                </div>
                                <span class="queue-opening-step__state">${escapeHtml(stateLabel)}</span>
                            </div>
                            <p class="queue-opening-step__hint">${escapeHtml(step.hint)}</p>
                            <p class="queue-opening-step__evidence">${escapeHtml(evidence)}</p>
                            <div class="queue-opening-step__actions">
                                <a href="${escapeHtml(step.href)}" target="_blank" rel="noopener" class="queue-opening-step__primary">${escapeHtml(step.actionLabel)}</a>
                                <button id="queueOpeningToggle_${escapeHtml(step.id)}" type="button" class="queue-opening-step__toggle" data-queue-opening-step="${escapeHtml(step.id)}" data-state="${stepState}">${isReady ? 'Marcar pendiente' : isSuggested ? 'Confirmar sugerido' : 'Marcar listo'}</button>
                            </div>
                        </article>
                    `;
                    })
                    .join('')}
            </div>
        </section>
    `
    );

    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            setOpeningChecklistStep(stepId, !current.steps[stepId]);
            rerenderAll();
        };
    });

    const applyButton = document.getElementById(
        'queueOpeningChecklistApplyBtn'
    );
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) return;
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            rerenderAll();
        };
    }

    const resetButton = document.getElementById(
        'queueOpeningChecklistResetBtn'
    );
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpeningChecklistState();
            rerenderAll();
        };
    }
}
