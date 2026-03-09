import { getState, updateState } from '../../core/store.js';
import {
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../ui/render.js';
import { asArray, normalize, statusLabel, toMillis } from './helpers.js';
import {
    getBulkTargetTickets,
    getCalledTicketForConsultorio,
    getQueueSource,
    getSelectedQueueIds,
    getVisibleTickets,
} from './selectors.js';

let lastWatchdogBucket = '';

function queueRow(ticket) {
    const consultorio = ticket.assignedConsultorio
        ? `C${ticket.assignedConsultorio}`
        : '-';
    const ageMinutes = Math.max(
        0,
        Math.round((Date.now() - toMillis(ticket.createdAt)) / 60000)
    );
    const id = Number(ticket.id || 0);
    const selectedIds = new Set(getSelectedQueueIds());
    const isSelected = selectedIds.has(id);
    const isCalled = ticket.status === 'called';
    const showRelease = isCalled && ticket.assignedConsultorio;
    const showRecall = isCalled;

    return `
        <tr data-queue-id="${id}" class="${isSelected ? 'is-selected' : ''}">
            <td>
                <label class="queue-select-cell">
                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${id}" ${isSelected ? 'checked' : ''} />
                </label>
            </td>
            <td>${escapeHtml(ticket.ticketCode)}</td>
            <td>${escapeHtml(ticket.queueType)}</td>
            <td>${escapeHtml(statusLabel(ticket.status))}</td>
            <td>${consultorio}</td>
            <td>${ageMinutes} min</td>
            <td>
                <div class="table-actions">
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>
                    ${showRecall ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="re-llamar" data-queue-consultorio="${Number(ticket.assignedConsultorio || 1) === 2 ? 2 : 1}">Re-llamar</button>` : ''}
                    ${showRelease ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="liberar">Liberar</button>` : ''}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="cancelar">Cancelar</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                </div>
            </td>
        </tr>
    `;
}

export function showSensitiveConfirm(actionPayload) {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const message = document.getElementById('queueSensitiveConfirmMessage');
    if (message) {
        message.textContent = `Confirmar accion sensible: ${actionPayload.action}`;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: actionPayload,
        },
    }));

    if (
        dialog instanceof HTMLDialogElement &&
        typeof dialog.showModal === 'function'
    ) {
        dialog.hidden = false;
        dialog.removeAttribute('hidden');
        if (!dialog.open) {
            try {
                dialog.showModal();
            } catch (_error) {
                dialog.setAttribute('open', '');
            }
        }
        return;
    }
    if (dialog instanceof HTMLElement) {
        dialog.setAttribute('open', '');
        dialog.hidden = false;
    }
}

export function hideSensitiveConfirm() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
        dialog.close();
    }
    if (dialog instanceof HTMLElement) {
        dialog.removeAttribute('open');
        dialog.hidden = true;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: null,
        },
    }));
}

function setQueueNowMeta(queueMeta, appendActivity) {
    const state = getState();
    const c1 =
        queueMeta.callingNowByConsultorio?.['1'] ||
        queueMeta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        queueMeta.callingNowByConsultorio?.['2'] ||
        queueMeta.callingNowByConsultorio?.[2] ||
        null;
    const c1Code = c1
        ? String(c1.ticketCode || c1.ticket_code || 'A-000')
        : 'Sin llamado';
    const c2Code = c2
        ? String(c2.ticketCode || c2.ticket_code || 'A-000')
        : 'Sin llamado';

    setText(
        '#queueWaitingCountAdmin',
        Number(queueMeta.waitingCount || queueMeta.counts?.waiting || 0)
    );
    setText(
        '#queueCalledCountAdmin',
        Number(queueMeta.calledCount || queueMeta.counts?.called || 0)
    );
    setText('#queueC1Now', c1Code);
    setText('#queueC2Now', c2Code);

    const releaseC1 = document.getElementById('queueReleaseC1');
    if (releaseC1 instanceof HTMLButtonElement) {
        releaseC1.hidden = !c1;
        releaseC1.textContent = c1 ? `Liberar C1 · ${c1Code}` : 'Release C1';
        if (c1) {
            releaseC1.setAttribute('data-queue-id', String(Number(c1.id || 0)));
        } else {
            releaseC1.removeAttribute('data-queue-id');
        }
    }

    const releaseC2 = document.getElementById('queueReleaseC2');
    if (releaseC2 instanceof HTMLButtonElement) {
        releaseC2.hidden = !c2;
        releaseC2.textContent = c2 ? `Liberar C2 · ${c2Code}` : 'Release C2';
        if (c2) {
            releaseC2.setAttribute('data-queue-id', String(Number(c2.id || 0)));
        } else {
            releaseC2.removeAttribute('data-queue-id');
        }
    }

    const syncNode = document.getElementById('queueSyncStatus');
    if (normalize(state.queue.syncMode) === 'fallback') {
        setText('#queueSyncStatus', 'fallback');
        if (syncNode) syncNode.setAttribute('data-state', 'fallback');
        return;
    }

    const updatedAt = String(queueMeta.updatedAt || '').trim();
    if (!updatedAt) return;

    const ageSec = Math.max(
        0,
        Math.round((Date.now() - toMillis(updatedAt)) / 1000)
    );
    const stale = ageSec >= 60;
    setText('#queueSyncStatus', stale ? `Watchdog (${ageSec}s)` : 'vivo');
    if (syncNode) {
        syncNode.setAttribute('data-state', stale ? 'reconnecting' : 'live');
    }

    if (stale) {
        const bucket = `stale-${Math.floor(ageSec / 15)}`;
        if (bucket !== lastWatchdogBucket) {
            lastWatchdogBucket = bucket;
            appendActivity('Watchdog de cola: realtime en reconnecting');
        }
        return;
    }

    lastWatchdogBucket = 'live';
}

export function renderQueueActivity() {
    const activity = getState().queue.activity || [];
    setHtml(
        '#queueActivityList',
        activity.length
            ? activity
                  .map(
                      (item) =>
                          `<li><span>${escapeHtml(formatDateTime(item.at))}</span><strong>${escapeHtml(item.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}

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
