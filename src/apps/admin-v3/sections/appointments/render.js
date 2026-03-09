import { getState } from '../../shared/core/store.js';
import {
    escapeHtml,
    formatDate,
    setHtml,
    setText,
} from '../../shared/ui/render.js';
import { persistPreferences } from './preferences.js';
import {
    applyFilter,
    applySearch,
    appointmentPriority,
    buildToolbarStateParts,
    computeOps,
    sortItems,
} from './selectors.js';
import {
    appointmentTimestamp,
    humanizeToken,
    normalize,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
    paymentLabel,
    paymentMethodLabel,
    paymentTone,
    relativeWindow,
    statusLabel,
    statusTone,
    whatsappLink,
} from './utils.js';

function paymentCell(item) {
    const paymentStatus = item.paymentStatus || item.payment_status || '';
    const proofUrl = String(
        item.transferProofUrl ||
            item.transferProofURL ||
            item.transfer_proof_url ||
            ''
    ).trim();

    return `
        <div class="appointment-payment-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(paymentTone(paymentStatus))}">${escapeHtml(paymentLabel(paymentStatus))}</span>
            <small>Metodo: ${escapeHtml(paymentMethodLabel(item.paymentMethod || item.payment_method || ''))}</small>
            ${proofUrl ? `<a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}
        </div>
    `;
}

function statusCell(item) {
    const status = normalizeAppointmentStatus(item.status);
    const paymentStatus = normalizePaymentStatus(item);
    const priority = appointmentPriority(item);
    const notes = [];

    if (paymentStatus === 'pending_transfer_review') {
        notes.push('Transferencia por validar');
    }
    if (status === 'no_show') {
        notes.push('Paciente ausente');
    }
    if (status === 'cancelled') {
        notes.push('Cita cerrada');
    }

    return `
        <div class="appointment-status-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(statusTone(status))}">${escapeHtml(statusLabel(status))}</span>
            <small>${escapeHtml(notes[0] || priority.note)}</small>
        </div>
    `;
}

function rowActions(item) {
    const id = Number(item.id || 0);
    const paymentStatus = normalizePaymentStatus(item);
    const phoneHref = whatsappLink(item.phone || '');
    const actions = [];

    if (phoneHref) {
        actions.push(
            `<a href="${escapeHtml(phoneHref)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${escapeHtml(item.name || 'Paciente')}" title="WhatsApp para seguimiento">WhatsApp</a>`
        );
    }

    if (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer'
    ) {
        actions.push(
            `<button type="button" data-action="approve-transfer" data-id="${id}">Aprobar</button>`
        );
        actions.push(
            `<button type="button" data-action="reject-transfer" data-id="${id}">Rechazar</button>`
        );
    }

    actions.push(
        `<button type="button" data-action="mark-no-show" data-id="${id}">No show</button>`
    );
    actions.push(
        `<button type="button" data-action="cancel-appointment" data-id="${id}">Cancelar</button>`
    );

    return `<div class="table-actions">${actions.join('')}</div>`;
}

function emptyTableRow(message) {
    return `<tr class="table-empty-row"><td colspan="6">${escapeHtml(message)}</td></tr>`;
}

function renderRows(items) {
    if (!items.length) {
        return emptyTableRow('No hay citas para el filtro actual.');
    }

    return items
        .map((item) => {
            const stamp = appointmentTimestamp(item);
            const priority = appointmentPriority(item);

            return `
                <tr class="appointment-row" data-appointment-id="${Number(item.id || 0)}">
                    <td data-label="Paciente">
                        <div class="appointment-person">
                            <strong>${escapeHtml(item.name || 'Sin nombre')}</strong>
                            <span>${escapeHtml(item.email || 'Sin email')}</span>
                            <small>${escapeHtml(item.phone || 'Sin telefono')}</small>
                        </div>
                    </td>
                    <td data-label="Servicio">
                        <div class="appointment-service">
                            <strong>${escapeHtml(humanizeToken(item.service, 'Servicio pendiente'))}</strong>
                            <span>Especialista: ${escapeHtml(humanizeToken(item.doctor, 'Sin asignar'))}</span>
                            <small>${escapeHtml(priority.label)} | ${escapeHtml(priority.note)}</small>
                        </div>
                    </td>
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

function updateQuickFilterButtons(filter) {
    const normalized = normalize(filter);
    document
        .querySelectorAll('.appointment-quick-filter-btn[data-filter-value]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.filterValue) === normalized;
            button.classList.toggle('is-active', isActive);
        });
}

function renderOpsDeck(ops, visibleCount, totalCount) {
    setText('#appointmentsOpsPendingTransfer', ops.pendingTransferCount);
    setText(
        '#appointmentsOpsPendingTransferMeta',
        ops.pendingTransferCount > 0
            ? `${ops.pendingTransferCount} pago(s) detenidos`
            : 'Nada por validar'
    );
    setText('#appointmentsOpsUpcomingCount', ops.upcomingCount);
    setText(
        '#appointmentsOpsUpcomingMeta',
        ops.upcomingCount > 0
            ? `${ops.upcomingCount} cita(s) dentro de 48h`
            : 'Sin presion inmediata'
    );
    setText('#appointmentsOpsNoShowCount', ops.noShowCount);
    setText(
        '#appointmentsOpsNoShowMeta',
        ops.noShowCount > 0
            ? `${ops.noShowCount} caso(s) con seguimiento`
            : 'Sin incidencias'
    );
    setText('#appointmentsOpsTodayCount', ops.todayCount);
    setText(
        '#appointmentsOpsTodayMeta',
        ops.todayCount > 0
            ? `${ops.todayCount} cita(s) en agenda de hoy`
            : 'Carga diaria limpia'
    );

    const summary =
        totalCount > 0
            ? `${ops.pendingTransferCount} transferencia(s), ${ops.triageCount} frente(s) accionables y ${visibleCount} cita(s) visibles.`
            : 'Sin citas cargadas.';
    setText('#appointmentsDeckSummary', summary);
    setText(
        '#appointmentsWorkbenchHint',
        ops.pendingTransferCount > 0
            ? 'Primero valida pagos; luego ordena la mesa por fecha o paciente.'
            : ops.triageCount > 0
              ? 'La agenda tiene incidencias abiertas dentro de esta misma mesa.'
              : 'Filtros, orden y tabla en un workbench unico.'
    );

    const chip = document.getElementById('appointmentsDeckChip');
    if (chip) {
        const state =
            ops.pendingTransferCount > 0 || ops.noShowCount > 0
                ? 'warning'
                : 'success';
        chip.textContent =
            state === 'warning' ? 'Atencion operativa' : 'Agenda estable';
        chip.setAttribute('data-state', state);
    }

    const focus = ops.focus;
    setText('#appointmentsFocusLabel', focus.label);

    if (!focus.item) {
        setText('#appointmentsFocusPatient', 'Sin citas activas');
        setText(
            '#appointmentsFocusMeta',
            'Cuando entren citas accionables apareceran aqui.'
        );
        setText('#appointmentsFocusWindow', '-');
        setText('#appointmentsFocusPayment', '-');
        setText('#appointmentsFocusStatus', '-');
        setText('#appointmentsFocusContact', '-');
        setHtml('#appointmentsFocusTags', '');
        setText('#appointmentsFocusHint', focus.hint);
        return;
    }

    const item = focus.item;
    setText('#appointmentsFocusPatient', item.name || 'Sin nombre');
    setText(
        '#appointmentsFocusMeta',
        `${humanizeToken(item.service, 'Servicio pendiente')} | ${formatDate(item.date)} ${item.time || '--:--'}`
    );
    setText(
        '#appointmentsFocusWindow',
        relativeWindow(appointmentTimestamp(item))
    );
    setText(
        '#appointmentsFocusPayment',
        paymentLabel(item.paymentStatus || item.payment_status)
    );
    setText('#appointmentsFocusStatus', statusLabel(item.status));
    setText('#appointmentsFocusContact', item.phone || 'Sin telefono');
    setHtml(
        '#appointmentsFocusTags',
        focus.tags
            .map(
                (tag) =>
                    `<span class="appointments-focus-tag">${escapeHtml(tag)}</span>`
            )
            .join('')
    );
    setText('#appointmentsFocusHint', focus.hint);
}

function syncAppointmentControls(appointmentsState, visibleCount, totalCount) {
    setText(
        '#appointmentsToolbarMeta',
        `Mostrando ${visibleCount} de ${totalCount}`
    );

    setText(
        '#appointmentsToolbarState',
        buildToolbarStateParts(appointmentsState, visibleCount).join(' | ')
    );

    const clearButton = document.getElementById('clearAppointmentsFiltersBtn');
    if (clearButton) {
        const canReset =
            normalize(appointmentsState.filter) !== 'all' ||
            normalize(appointmentsState.search) !== '';
        clearButton.classList.toggle('is-hidden', !canReset);
    }

    const filterSelect = document.getElementById('appointmentFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = appointmentsState.filter;
    }

    const sortSelect = document.getElementById('appointmentSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = appointmentsState.sort;
    }

    const searchInput = document.getElementById('searchAppointments');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== appointmentsState.search
    ) {
        searchInput.value = appointmentsState.search;
    }

    const section = document.getElementById('appointments');
    if (section) {
        section.classList.toggle(
            'appointments-density-compact',
            normalize(appointmentsState.density) === 'compact'
        );
    }

    document
        .querySelectorAll('[data-action="appointment-density"][data-density]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.density) ===
                normalize(appointmentsState.density);
            button.classList.toggle('is-active', isActive);
        });

    updateQuickFilterButtons(appointmentsState.filter);
    persistPreferences(appointmentsState);
}

export function renderAppointmentsSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const appointmentsState = state?.appointments || {
        filter: 'all',
        search: '',
        sort: 'datetime_desc',
        density: 'comfortable',
    };

    const filtered = applyFilter(source, appointmentsState.filter);
    const searched = applySearch(filtered, appointmentsState.search);
    const sorted = sortItems(searched, appointmentsState.sort);

    setHtml('#appointmentsTableBody', renderRows(sorted));
    syncAppointmentControls(appointmentsState, sorted.length, source.length);
    renderOpsDeck(computeOps(source), sorted.length, source.length);
}
