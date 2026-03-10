import {
    escapeHtml,
    formatDate,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import {
    appointmentTimestamp,
    humanizeToken,
    paymentLabel,
    relativeWindow,
    statusLabel,
} from '../utils.js';

export function renderOpsDeck(ops, visibleCount, totalCount) {
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
