import { apiRequest } from '../../admin-v2/core/api-client.js';
import { getState, updateState } from '../../admin-v2/core/store.js';
import {
    escapeHtml,
    formatDate,
    setHtml,
    setText,
} from '../../admin-v2/ui/render.js';

const APPOINTMENT_SORT_STORAGE_KEY = 'admin-appointments-sort';
const APPOINTMENT_DENSITY_STORAGE_KEY = 'admin-appointments-density';

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function toTimestamp(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function appointmentTimestamp(item) {
    return toTimestamp(`${item?.date || ''}T${item?.time || '00:00'}:00`);
}

function normalizePaymentStatus(item) {
    return normalize(item.paymentStatus || item.payment_status || '');
}

function normalizeAppointmentStatus(status) {
    return normalize(status);
}

function humanizeToken(value, fallback = '-') {
    const source = String(value || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    if (!source) return fallback;
    return source
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function paymentMethodLabel(method) {
    const labels = {
        transfer: 'Transferencia',
        cash: 'Consultorio',
        card: 'Tarjeta',
        gateway: 'Pasarela',
    };
    return (
        labels[normalize(method)] || humanizeToken(method, 'Metodo pendiente')
    );
}

function paymentLabel(status) {
    const labels = {
        pending_transfer_review: 'Validar pago',
        pending_transfer: 'Transferencia',
        pending_cash: 'Pago en consultorio',
        pending_gateway: 'Pago en proceso',
        paid: 'Pagado',
        failed: 'Fallido',
    };
    return labels[normalize(status)] || humanizeToken(status, 'Pendiente');
}

function statusLabel(status) {
    const labels = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        completed: 'Completada',
        cancelled: 'Cancelada',
        no_show: 'No show',
    };
    return labels[normalize(status)] || humanizeToken(status, 'Pendiente');
}

function paymentTone(status) {
    const normalized = normalize(status);
    if (normalized === 'paid') return 'success';
    if (normalized === 'failed') return 'danger';
    if (normalized === 'pending_cash') return 'neutral';
    return 'warning';
}

function statusTone(status) {
    const normalized = normalize(status);
    if (normalized === 'completed') return 'success';
    if (normalized === 'cancelled' || normalized === 'no_show') return 'danger';
    if (normalized === 'pending') return 'warning';
    return 'neutral';
}

function relativeWindow(timestamp) {
    if (!timestamp) return 'Sin fecha';
    const diffMinutes = Math.round((timestamp - Date.now()) / 60000);
    const absoluteMinutes = Math.abs(diffMinutes);

    if (diffMinutes < 0) {
        if (absoluteMinutes < 60) {
            return `Hace ${absoluteMinutes} min`;
        }
        if (absoluteMinutes < 24 * 60) {
            return `Hace ${Math.round(absoluteMinutes / 60)} h`;
        }
        return 'Ya ocurrio';
    }

    if (diffMinutes < 60) {
        return `En ${Math.max(diffMinutes, 0)} min`;
    }
    if (diffMinutes < 24 * 60) {
        return `En ${Math.round(diffMinutes / 60)} h`;
    }
    return `En ${Math.round(diffMinutes / (24 * 60))} d`;
}

function isToday(item) {
    const stamp = appointmentTimestamp(item);
    if (!stamp) return false;
    const date = new Date(stamp);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function isUpcoming48h(item) {
    const stamp = appointmentTimestamp(item);
    if (!stamp) return false;
    const diff = stamp - Date.now();
    return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
}

function isTriageAttention(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const appointmentStatus = normalizeAppointmentStatus(item.status);

    return (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer' ||
        appointmentStatus === 'no_show' ||
        appointmentStatus === 'cancelled'
    );
}

function applyFilter(items, filter) {
    const normalized = normalize(filter);

    if (normalized === 'pending_transfer') {
        return items.filter((item) => {
            const paymentStatus = normalizePaymentStatus(item);
            return (
                paymentStatus === 'pending_transfer_review' ||
                paymentStatus === 'pending_transfer'
            );
        });
    }

    if (normalized === 'upcoming_48h') {
        return items.filter(isUpcoming48h);
    }

    if (normalized === 'no_show') {
        return items.filter(
            (item) => normalizeAppointmentStatus(item.status) === 'no_show'
        );
    }

    if (normalized === 'triage_attention') {
        return items.filter(isTriageAttention);
    }

    return items;
}

function applySearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;

    return items.filter((item) => {
        const fields = [
            item.name,
            item.email,
            item.phone,
            item.service,
            item.doctor,
            item.paymentStatus,
            item.payment_status,
            item.status,
        ];

        return fields.some((field) => normalize(field).includes(term));
    });
}

function sortItems(items, sort) {
    const normalized = normalize(sort);
    const list = [...items];

    if (normalized === 'patient_az') {
        list.sort((a, b) =>
            normalize(a.name).localeCompare(normalize(b.name), 'es')
        );
        return list;
    }

    if (normalized === 'datetime_asc') {
        list.sort((a, b) => appointmentTimestamp(a) - appointmentTimestamp(b));
        return list;
    }

    list.sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a));
    return list;
}

function appointmentPriority(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const status = normalizeAppointmentStatus(item.status);
    const stamp = appointmentTimestamp(item);

    if (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer'
    ) {
        return {
            label: 'Transferencia',
            tone: 'warning',
            note: 'No liberar hasta validar pago.',
        };
    }

    if (status === 'no_show') {
        return {
            label: 'No show',
            tone: 'danger',
            note: 'Requiere seguimiento o cierre.',
        };
    }

    if (status === 'cancelled') {
        return {
            label: 'Cancelada',
            tone: 'danger',
            note: 'Bloqueo operativo cerrado.',
        };
    }

    if (isToday(item)) {
        return {
            label: 'Hoy',
            tone: 'success',
            note: stamp ? relativeWindow(stamp) : 'Agenda del dia',
        };
    }

    if (isUpcoming48h(item)) {
        return {
            label: '48h',
            tone: 'neutral',
            note: 'Ventana inmediata de agenda.',
        };
    }

    return {
        label: 'Programada',
        tone: 'neutral',
        note: 'Sin incidencias abiertas.',
    };
}

function buildFocusAppointment(items) {
    const byPriority = items
        .map((item) => ({
            item,
            stamp: appointmentTimestamp(item),
        }))
        .sort((a, b) => a.stamp - b.stamp);

    const pendingTransfer = byPriority.find(({ item }) => {
        const paymentStatus = normalizePaymentStatus(item);
        return (
            paymentStatus === 'pending_transfer_review' ||
            paymentStatus === 'pending_transfer'
        );
    });
    if (pendingTransfer) {
        return {
            item: pendingTransfer.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    }

    const noShow = byPriority.find(
        ({ item }) => normalizeAppointmentStatus(item.status) === 'no_show'
    );
    if (noShow) {
        return {
            item: noShow.item,
            label: 'Seguimiento abierto',
            hint: 'Define si se reprograma o se cierra la incidencia.',
            tags: ['No show', 'Seguimiento'],
        };
    }

    const nextAppointment = byPriority.find(({ stamp }) => stamp >= Date.now());
    if (nextAppointment) {
        return {
            item: nextAppointment.item,
            label: 'Siguiente ingreso',
            hint: 'Deja contexto listo para la siguiente atencion.',
            tags: ['Agenda viva'],
        };
    }

    return {
        item: null,
        label: 'Sin foco activo',
        hint: 'Cuando entre una cita accionable aparecera aqui.',
        tags: [],
    };
}

function computeOps(items) {
    const pendingTransfers = applyFilter(items, 'pending_transfer');
    const upcoming48h = applyFilter(items, 'upcoming_48h');
    const noShows = applyFilter(items, 'no_show');
    const triage = applyFilter(items, 'triage_attention');
    const today = items.filter(isToday);

    return {
        pendingTransferCount: pendingTransfers.length,
        upcomingCount: upcoming48h.length,
        noShowCount: noShows.length,
        todayCount: today.length,
        triageCount: triage.length,
        focus: buildFocusAppointment(items),
    };
}

function whatsappLink(phone) {
    const digits = String(phone || '').replace(/\D+/g, '');
    return digits ? `https://wa.me/${digits}` : '';
}

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

function persistPreferences(appointmentsState) {
    try {
        localStorage.setItem(
            APPOINTMENT_SORT_STORAGE_KEY,
            JSON.stringify(appointmentsState.sort)
        );
        localStorage.setItem(
            APPOINTMENT_DENSITY_STORAGE_KEY,
            JSON.stringify(appointmentsState.density)
        );
    } catch (_error) {
        // no-op
    }
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

export function hydrateAppointmentPreferences() {
    let sort = 'datetime_desc';
    let density = 'comfortable';

    try {
        sort = JSON.parse(
            localStorage.getItem(APPOINTMENT_SORT_STORAGE_KEY) ||
                '"datetime_desc"'
        );
        density = JSON.parse(
            localStorage.getItem(APPOINTMENT_DENSITY_STORAGE_KEY) ||
                '"comfortable"'
        );
    } catch (_error) {
        // no-op
    }

    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            sort: typeof sort === 'string' ? sort : 'datetime_desc',
            density: typeof density === 'string' ? density : 'comfortable',
        },
    }));
}

export function renderAppointmentsSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];

    const filtered = applyFilter(source, state.appointments.filter);
    const searched = applySearch(filtered, state.appointments.search);
    const sorted = sortItems(searched, state.appointments.sort);

    setHtml('#appointmentsTableBody', renderRows(sorted));
    setText(
        '#appointmentsToolbarMeta',
        `Mostrando ${sorted.length} de ${source.length}`
    );

    const stateParts = [];
    if (normalize(state.appointments.filter) !== 'all') {
        const labels = {
            pending_transfer: 'Transferencias por validar',
            triage_attention: 'Triage accionable',
            upcoming_48h: 'Proximas 48h',
            no_show: 'No show',
        };
        stateParts.push(
            labels[normalize(state.appointments.filter)] ||
                state.appointments.filter
        );
    }

    if (normalize(state.appointments.search)) {
        stateParts.push(`Busqueda: ${state.appointments.search}`);
    }

    if (normalize(state.appointments.sort) === 'patient_az') {
        stateParts.push('Paciente (A-Z)');
    } else if (normalize(state.appointments.sort) === 'datetime_asc') {
        stateParts.push('Fecha ascendente');
    } else {
        stateParts.push('Fecha reciente');
    }

    if (sorted.length === 0) {
        stateParts.push('Resultados: 0');
    }

    setText('#appointmentsToolbarState', stateParts.join(' | '));

    const clearButton = document.getElementById('clearAppointmentsFiltersBtn');
    if (clearButton) {
        const canReset =
            normalize(state.appointments.filter) !== 'all' ||
            normalize(state.appointments.search) !== '';
        clearButton.classList.toggle('is-hidden', !canReset);
    }

    const filterSelect = document.getElementById('appointmentFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = state.appointments.filter;
    }

    const sortSelect = document.getElementById('appointmentSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = state.appointments.sort;
    }

    const searchInput = document.getElementById('searchAppointments');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== state.appointments.search
    ) {
        searchInput.value = state.appointments.search;
    }

    const section = document.getElementById('appointments');
    if (section) {
        section.classList.toggle(
            'appointments-density-compact',
            normalize(state.appointments.density) === 'compact'
        );
    }

    document
        .querySelectorAll('[data-action="appointment-density"][data-density]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.density) ===
                normalize(state.appointments.density);
            button.classList.toggle('is-active', isActive);
        });

    updateQuickFilterButtons(state.appointments.filter);
    persistPreferences(state.appointments);
    renderOpsDeck(computeOps(source), sorted.length, source.length);
}

function updateAppointmentState(patch) {
    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            ...patch,
        },
    }));
    renderAppointmentsSection();
}

export function setAppointmentFilter(filter) {
    updateAppointmentState({ filter: normalize(filter) || 'all' });
}

export function setAppointmentSearch(search) {
    updateAppointmentState({ search: String(search || '') });
}

export function clearAppointmentFilters() {
    updateAppointmentState({
        filter: 'all',
        search: '',
    });
}

export function setAppointmentSort(sort) {
    updateAppointmentState({ sort: normalize(sort) || 'datetime_desc' });
}

export function setAppointmentDensity(density) {
    updateAppointmentState({
        density: normalize(density) === 'compact' ? 'compact' : 'comfortable',
    });
}

function mutateAppointmentInState(id, patch) {
    const targetId = Number(id || 0);

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            appointments: (state.data.appointments || []).map((item) =>
                Number(item.id || 0) === targetId
                    ? {
                          ...item,
                          ...patch,
                      }
                    : item
            ),
        },
    }));

    renderAppointmentsSection();
}

async function patchAppointment(id, body) {
    await apiRequest('appointments', {
        method: 'PATCH',
        body: {
            id: Number(id || 0),
            ...body,
        },
    });
}

export async function approveTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'paid' });
    mutateAppointmentInState(id, { paymentStatus: 'paid' });
}

export async function rejectTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'failed' });
    mutateAppointmentInState(id, { paymentStatus: 'failed' });
}

export async function markNoShow(id) {
    await patchAppointment(id, { status: 'no_show' });
    mutateAppointmentInState(id, { status: 'no_show' });
}

export async function cancelAppointment(id) {
    await patchAppointment(id, { status: 'cancelled' });
    mutateAppointmentInState(id, { status: 'cancelled' });
}

export function exportAppointmentsCsv() {
    const state = getState();
    const rows = (state.data.appointments || []).map((item) => [
        item.id,
        item.name,
        item.service,
        item.date,
        item.time,
        item.status,
        item.paymentStatus || item.payment_status || '',
    ]);

    const csv = [
        ['id', 'name', 'service', 'date', 'time', 'status', 'payment_status'],
        ...rows,
    ]
        .map((line) =>
            line
                .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
                .join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
