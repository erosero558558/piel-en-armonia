import { escapeHtml } from '../../../../ui/render.js';
import { statusLabel, toMillis } from '../../helpers.js';
import { getSelectedQueueIds } from '../../selectors.js';
import { renderQueueActions } from './actions.js';
import { renderTicketFlags } from './flags.js';
import { isOperatorSurface } from './surface.js';

function renderLeadingCell(id, isSelected, operatorSurface, isCalled) {
    if (operatorSurface) {
        return `<span class="queue-row-marker">${escapeHtml(
            isCalled ? 'Live' : 'Fila'
        )}</span>`;
    }

    return `<label class="queue-select-cell">
                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${id}" ${isSelected ? 'checked' : ''} />
                </label>`;
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
    const operatorSurface = isOperatorSurface();
    const flags = renderTicketFlags(ticket);
    const ticketCell = `
        <div>${escapeHtml(ticket.ticketCode)}</div>
        ${flags}
    `;
    const leadingCell = renderLeadingCell(
        id,
        isSelected,
        operatorSurface,
        isCalled
    );
    const actions = renderQueueActions(ticket, id, operatorSurface);

    return `
        <tr data-queue-id="${id}" class="${isSelected ? 'is-selected' : ''}">
            <td>
                ${leadingCell}
            </td>
            <td>${ticketCell}</td>
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
