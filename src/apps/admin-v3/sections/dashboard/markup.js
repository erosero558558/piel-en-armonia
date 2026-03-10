import { escapeHtml, formatDate } from '../../shared/ui/render.js';
import { CALLBACK_URGENT_THRESHOLD_MINUTES } from './constants.js';
import { relativeWindow } from './time.js';

export function breakdownList(entries, keyLabel, keyValue) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '<li><span>Sin datos</span><strong>0</strong></li>';
    }

    return entries
        .slice(0, 5)
        .map((entry) => {
            const label = String(entry[keyLabel] || entry.label || '-');
            const value = String(entry[keyValue] ?? entry.count ?? 0);
            return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
        })
        .join('');
}

export function attentionItem(title, value, meta, tone = 'neutral') {
    return `
        <li class="dashboard-attention-item" data-tone="${escapeHtml(tone)}">
            <div>
                <span>${escapeHtml(title)}</span>
                <small>${escapeHtml(meta)}</small>
            </div>
            <strong>${escapeHtml(String(value))}</strong>
        </li>
    `;
}

export function actionItem(action, label, meta) {
    return `
        <button type="button" class="operations-action-item" data-action="${escapeHtml(action)}">
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

export function heroSummary({
    pendingTransfers,
    urgentCallbacks,
    noShows,
    nextAppointment,
}) {
    if (pendingTransfers > 0) {
        return `Primero valida ${pendingTransfers} transferencia(s) antes de liberar mas agenda.`;
    }
    if (urgentCallbacks > 0) {
        return `Hay ${urgentCallbacks} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`;
    }
    if (noShows > 0) {
        return `Revisa ${noShows} no show del corte actual para cerrar seguimiento.`;
    }
    if (nextAppointment?.item) {
        return `La siguiente cita es ${nextAppointment.item.name || 'sin nombre'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}.`;
    }
    return 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
}

export function buildLiveMeta({
    pendingTransfers,
    urgentCallbacks,
    nextAppointment,
}) {
    if (pendingTransfers > 0) {
        return 'Transferencias detenidas hasta validar comprobante.';
    }
    if (urgentCallbacks > 0) {
        return 'Callbacks fuera de SLA requieren llamada inmediata.';
    }
    if (nextAppointment?.item) {
        return `Siguiente ingreso: ${nextAppointment.item.name || 'Paciente'} el ${formatDate(nextAppointment.item.date)} a las ${nextAppointment.item.time || '--:--'}.`;
    }
    return 'Sin alertas criticas en la operacion actual.';
}

export function buildOperations(state) {
    const { pendingTransfers, urgentCallbacks, pendingCallbacks } = state;
    const { appointments, nextAppointment } = state;

    return [
        actionItem(
            'context-open-appointments-transfer',
            pendingTransfers > 0
                ? 'Validar transferencias'
                : 'Abrir agenda clinica',
            pendingTransfers > 0
                ? `${pendingTransfers} comprobante(s) por revisar`
                : `${appointments.length} cita(s) en el corte`
        ),
        actionItem(
            'context-open-callbacks-pending',
            urgentCallbacks > 0
                ? 'Resolver callbacks urgentes'
                : 'Abrir callbacks',
            urgentCallbacks > 0
                ? `${urgentCallbacks} caso(s) fuera de SLA`
                : `${pendingCallbacks} callback(s) pendientes`
        ),
        actionItem(
            'refresh-admin-data',
            'Actualizar tablero',
            nextAppointment?.item
                ? `Proxima cita ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                : 'Sincronizar agenda y funnel'
        ),
    ].join('');
}

export function buildAttentionItems(state) {
    const {
        availabilityDays,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    return [
        attentionItem(
            'Transferencias',
            pendingTransfers,
            pendingTransfers > 0
                ? 'Pago detenido antes de confirmar.'
                : 'Sin comprobantes pendientes.',
            pendingTransfers > 0 ? 'warning' : 'success'
        ),
        attentionItem(
            'Callbacks urgentes',
            urgentCallbacks,
            urgentCallbacks > 0
                ? `Mas de ${CALLBACK_URGENT_THRESHOLD_MINUTES} min en espera.`
                : 'SLA dentro de rango.',
            urgentCallbacks > 0 ? 'danger' : 'success'
        ),
        attentionItem(
            'Agenda de hoy',
            todayAppointments,
            todayAppointments > 0
                ? `${todayAppointments} ingreso(s) en la jornada.`
                : 'No hay citas hoy.',
            todayAppointments > 6 ? 'warning' : 'neutral'
        ),
        attentionItem(
            'Disponibilidad',
            availabilityDays,
            availabilityDays > 0
                ? 'Dias con slots listos para publicar.'
                : 'Sin slots cargados en el calendario.',
            availabilityDays > 0 ? 'success' : 'warning'
        ),
    ].join('');
}
