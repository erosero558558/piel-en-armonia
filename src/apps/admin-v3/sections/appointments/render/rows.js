import { escapeHtml, formatDate, setHtml } from '../../../shared/ui/render.js';
import { appointmentTimestamp, relativeWindow } from '../utils.js';
import { paymentCell, rowActions, serviceCell, statusCell } from './cells.js';

function emptyTableRow(message) {
    return `<tr class="table-empty-row"><td colspan="6">${escapeHtml(message)}</td></tr>`;
}

export function renderRows(items) {
    if (!items.length) {
        return emptyTableRow('No hay citas para el filtro actual.');
    }

    return items
        .map((item) => {
            const stamp = appointmentTimestamp(item);

            return `
                <tr class="appointment-row" data-appointment-id="${Number(item.id || 0)}">
                    <td data-label="Paciente">
                        <div class="appointment-person">
                            <strong>${escapeHtml(item.name || 'Sin nombre')}</strong>
                            <span>${escapeHtml(item.email || 'Sin email')}</span>
                            <small>${escapeHtml(item.phone || 'Sin telefono')}</small>
                        </div>
                    </td>
                    <td data-label="Servicio">${serviceCell(item)}</td>
                    <td data-label="Fecha">
                        <div class="appointment-date-stack">
                            <strong>${escapeHtml(formatDate(item.date))}</strong>
                            <span>${escapeHtml(item.time || '--:--')}</span>
                            <small>${escapeHtml(relativeWindow(stamp))}</small>
                        </div>
                    </td>
                    <td data-label="Pago">${paymentCell(item)}</td>
                    <td data-label="Estado">${statusCell(item)}</td>
                    <td data-label="Acciones">${rowActions(item)}</td>
                </tr>
            `;
        })
        .join('');
}

export function renderAppointmentsTable(items) {
    setHtml('#appointmentsTableBody', renderRows(items));
}
