import { escapeHtml, setHtml } from '../../../../../../ui/render.js';
import {
    applyOpeningChecklistSuggestions,
    ensureOpeningChecklistState,
    formatOpeningChecklistDate,
    resetOpeningChecklistState,
    setOpeningChecklistStep,
} from '../state.js';
import { buildOpeningChecklistAssist } from './assist.js';
import { buildOpeningChecklistSteps } from './steps.js';

function renderOpeningChecklistShell(steps, checklist, assist) {
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

    return `
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
    `;
}

function bindOpeningChecklistStepToggles(root, rerenderAll) {
    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            setOpeningChecklistStep(stepId, !current.steps[stepId]);
            rerenderAll();
        };
    });
}

function bindOpeningChecklistActions(assist, rerenderAll) {
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

    setHtml(
        '#queueOpeningChecklist',
        renderOpeningChecklistShell(steps, checklist, assist)
    );

    bindOpeningChecklistStepToggles(root, rerenderAll);
    bindOpeningChecklistActions(assist, rerenderAll);
}
