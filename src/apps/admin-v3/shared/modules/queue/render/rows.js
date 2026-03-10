import { escapeHtml } from '../../../ui/render.js';
import { statusLabel, toMillis } from '../helpers.js';
import { getSelectedQueueIds } from '../selectors.js';

function isOperatorSurface() {
    return document.body?.dataset.queueSurface === 'operator';
}

export function queueRow(ticket) {
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
    const operatorSurface = isOperatorSurface();
    const leadingCell = operatorSurface
        ? `<span class="queue-row-marker">${escapeHtml(
              isCalled ? 'Live' : 'Fila'
          )}</span>`
        : `<label class="queue-select-cell">
                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${id}" ${isSelected ? 'checked' : ''} />
                </label>`;
    const actions = operatorSurface
        ? `
                    ${showRecall ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="re-llamar" data-queue-consultorio="${Number(ticket.assignedConsultorio || 1) === 2 ? 2 : 1}">Re-llamar</button>` : ''}
                    ${showRelease ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="liberar">Liberar</button>` : ''}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                `
        : `
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>
                    ${showRecall ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="re-llamar" data-queue-consultorio="${Number(ticket.assignedConsultorio || 1) === 2 ? 2 : 1}">Re-llamar</button>` : ''}
                    ${showRelease ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="liberar">Liberar</button>` : ''}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="cancelar">Cancelar</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                `;

    return `
        <tr data-queue-id="${id}" class="${isSelected ? 'is-selected' : ''}">
            <td>
                ${leadingCell}
            </td>
            <td>${escapeHtml(ticket.ticketCode)}</td>
            <td>${escapeHtml(ticket.queueType)}</td>
            <td>${escapeHtml(statusLabel(ticket.status))}</td>
            <td>${consultorio}</td>
            <td>${ageMinutes} min</td>
            <td>
                <div class="table-actions">
                    ${actions}
                </div>
            </td>
        </tr>
    `;
}
