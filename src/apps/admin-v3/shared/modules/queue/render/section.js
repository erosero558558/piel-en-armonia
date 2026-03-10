import { getState } from '../../../core/store.js';
import { escapeHtml, setHtml, setText } from '../../../ui/render.js';
import { asArray, normalize, toMillis } from '../helpers.js';
import {
    getBulkTargetTickets,
    getCalledTicketForConsultorio,
    getQueueSource,
    getSelectedQueueIds,
    getVisibleTickets,
} from '../selectors.js';
import { renderQueueActivity } from './activity.js';
import { setQueueNowMeta } from './meta.js';
import { queueRow } from './rows.js';

export function renderQueueSection(appendActivity = () => {}) {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const visible = getVisibleTickets();
    const selectedIds = getSelectedQueueIds();
    const selectedCount = selectedIds.length;
    const bulkTargets = getBulkTargetTickets();
    const nextTickets = asArray(queueMeta.nextTickets);
    const waitingCount = Number(
        queueMeta.waitingCount || queueMeta.counts?.waiting || 0
    );

    setQueueNowMeta(queueMeta, appendActivity);

    setHtml(
        '#queueTableBody',
        visible.length
            ? visible.map(queueRow).join('')
            : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
    );

    const nextSummary =
        state.queue.fallbackPartial &&
        nextTickets.length &&
        waitingCount > nextTickets.length
            ? `<li><span>-</span><strong>Mostrando primeros ${nextTickets.length} de ${waitingCount} en espera</strong></li>`
            : '';
    setHtml(
        '#queueNextAdminList',
        nextTickets.length
            ? `${nextSummary}${nextTickets
                  .map(
                      (ticket) =>
                          `<li><span>${escapeHtml(ticket.ticketCode || ticket.ticket_code || '--')}</span><strong>${escapeHtml(
                              ticket.patientInitials ||
                                  ticket.patient_initials ||
                                  '--'
                          )}</strong></li>`
                  )
                  .join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );

    const riskCount = visible.filter((item) => {
        if (item.status !== 'waiting') return false;
        const ageMinutes = Math.max(
            0,
            Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
        );
        return (
            ageMinutes >= 20 || normalize(item.priorityClass) === 'appt_overdue'
        );
    }).length;

    const summaryParts = [
        riskCount > 0 ? `riesgo: ${riskCount}` : 'sin riesgo',
    ];
    if (selectedCount > 0) summaryParts.push(`seleccion: ${selectedCount}`);
    if (state.queue.fallbackPartial) summaryParts.push('fallback parcial');
    setText('#queueTriageSummary', summaryParts.join(' | '));
    setText('#queueSelectedCount', selectedCount);

    const selectionChip = document.getElementById('queueSelectionChip');
    if (selectionChip instanceof HTMLElement) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }

    const selectVisibleBtn = document.getElementById('queueSelectVisibleBtn');
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = visible.length === 0;
    }

    const clearSelectionBtn = document.getElementById('queueClearSelectionBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedCount === 0;
    }

    document
        .querySelectorAll(
            '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            button.disabled = bulkTargets.length === 0;
        });

    setText(
        '#queueStationBadge',
        `Estación C${state.queue.stationConsultorio}`
    );
    setText(
        '#queueStationModeBadge',
        state.queue.stationMode === 'locked' ? 'Bloqueado' : 'Libre'
    );

    const practiceBadge = document.getElementById('queuePracticeModeBadge');
    if (practiceBadge instanceof HTMLElement) {
        practiceBadge.hidden = !state.queue.practiceMode;
    }

    const shortcutPanel = document.getElementById('queueShortcutPanel');
    if (shortcutPanel instanceof HTMLElement) {
        shortcutPanel.hidden = !state.queue.helpOpen;
    }

    const clearKeyBtn = document.querySelector(
        '[data-action="queue-clear-call-key"]'
    );
    if (clearKeyBtn instanceof HTMLElement) {
        clearKeyBtn.hidden = !state.queue.customCallKey;
    }

    const oneTapBtn = document.querySelector(
        '[data-action="queue-toggle-one-tap"]'
    );
    if (oneTapBtn instanceof HTMLElement) {
        oneTapBtn.setAttribute(
            'aria-pressed',
            String(Boolean(state.queue.oneTap))
        );
        oneTapBtn.textContent = state.queue.oneTap
            ? '1 tecla ON'
            : '1 tecla OFF';
    }

    document
        .querySelectorAll(
            '[data-action="queue-call-next"][data-queue-consultorio]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const target =
                Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
            button.disabled =
                state.queue.stationMode === 'locked' &&
                target !== Number(state.queue.stationConsultorio || 1);
        });

    const activeStationTicket = getCalledTicketForConsultorio(
        state.queue.stationConsultorio
    );
    const releaseStationButtons = document.querySelectorAll(
        '[data-action="queue-release-station"][data-queue-consultorio]'
    );
    releaseStationButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const target =
            Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
        const calledTicket = getCalledTicketForConsultorio(target);
        button.disabled = !calledTicket;
        if (
            state.queue.stationMode === 'locked' &&
            target !== Number(state.queue.stationConsultorio || 1)
        ) {
            button.disabled = true;
        }
    });

    if (activeStationTicket) {
        summaryParts.push(
            `activo: ${activeStationTicket.ticketCode} en C${state.queue.stationConsultorio}`
        );
        setText('#queueTriageSummary', summaryParts.join(' | '));
    }

    renderQueueActivity();
}
