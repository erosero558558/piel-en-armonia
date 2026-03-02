import {
    escapeHtml,
    formatDate,
    formatNumber,
    setHtml,
    setText,
} from '../../admin-v2/ui/render.js';

const CALLBACK_URGENT_THRESHOLD_MINUTES = 120;

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

function callbackTimestamp(item) {
    return toTimestamp(item?.fecha || item?.createdAt || '');
}

function isToday(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
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

function averageRating(reviews) {
    if (!reviews.length) return '0.0';
    const total = reviews.reduce(
        (sum, item) => sum + Number(item.rating || 0),
        0
    );
    return (total / reviews.length).toFixed(1);
}

function countRecentReviews(reviews, days = 30) {
    const now = Date.now();
    return reviews.filter((item) => {
        const stamp = toTimestamp(item.date || item.createdAt || '');
        if (!stamp) return false;
        return now - stamp <= days * 24 * 60 * 60 * 1000;
    }).length;
}

function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = normalize(item.paymentStatus || item.payment_status);
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

function countNoShows(appointments) {
    return appointments.filter((item) => normalize(item.status) === 'no_show')
        .length;
}

function countTodayAppointments(appointments) {
    return appointments.filter((item) => isToday(appointmentTimestamp(item)))
        .length;
}

function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => normalize(item.status) === 'pending')
        .length;
}

function countUrgentCallbacks(callbacks) {
    return callbacks.filter((item) => {
        if (normalize(item.status) !== 'pending') return false;
        const createdAt = callbackTimestamp(item);
        if (!createdAt) return false;
        const ageMinutes = Math.round((Date.now() - createdAt) / 60000);
        return ageMinutes >= CALLBACK_URGENT_THRESHOLD_MINUTES;
    }).length;
}

function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

function findNextAppointment(appointments) {
    return appointments
        .map((item) => ({
            item,
            stamp: appointmentTimestamp(item),
        }))
        .filter((entry) => entry.stamp > 0 && entry.stamp >= Date.now())
        .sort((a, b) => a.stamp - b.stamp)[0];
}

function breakdownList(entries, keyLabel, keyValue) {
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

function attentionItem(title, value, meta, tone = 'neutral') {
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

function actionItem(action, label, meta) {
    return `
        <button type="button" class="operations-action-item" data-action="${escapeHtml(action)}">
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

function heroSummary({
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

export function renderDashboard(state) {
    const appointments = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const callbacks = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const availability =
        state?.data?.availability && typeof state.data.availability === 'object'
            ? state.data.availability
            : {};
    const funnel = state?.data?.funnelMetrics || {};

    const todayAppointments = countTodayAppointments(appointments);
    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const urgentCallbacks = countUrgentCallbacks(callbacks);
    const noShows = countNoShows(appointments);
    const avgRating = averageRating(reviews);
    const recentReviews = countRecentReviews(reviews);
    const availabilityDays = countAvailabilityDays(availability);
    const nextAppointment = findNextAppointment(appointments);

    setText('#todayAppointments', todayAppointments);
    setText('#totalAppointments', appointments.length);
    setText('#pendingCallbacks', pendingCallbacks);
    setText('#totalReviewsCount', reviews.length);
    setText('#totalNoShows', noShows);
    setText('#avgRating', avgRating);
    setText('#adminAvgRating', avgRating);

    setText('#dashboardHeroRating', avgRating);
    setText('#dashboardHeroRecentReviews', recentReviews);
    setText('#dashboardHeroUrgentCallbacks', urgentCallbacks);
    setText('#dashboardHeroPendingTransfers', pendingTransfers);
    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingTransfers,
            urgentCallbacks,
            noShows,
            nextAppointment,
        })
    );

    const liveStatus =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'Atencion'
            : todayAppointments > 0
              ? 'Activo'
              : 'Estable';
    const liveTone =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'warning'
            : todayAppointments > 0
              ? 'neutral'
              : 'success';
    const liveMeta =
        pendingTransfers > 0
            ? 'Transferencias detenidas hasta validar comprobante.'
            : urgentCallbacks > 0
              ? 'Callbacks fuera de SLA requieren llamada inmediata.'
              : nextAppointment?.item
                ? `Siguiente ingreso: ${nextAppointment.item.name || 'Paciente'} el ${formatDate(nextAppointment.item.date)} a las ${nextAppointment.item.time || '--:--'}.`
                : 'Sin alertas criticas en la operacion actual.';

    setText('#dashboardLiveStatus', liveStatus);
    document
        .getElementById('dashboardLiveStatus')
        ?.setAttribute('data-state', liveTone);
    setText('#dashboardLiveMeta', liveMeta);

    setText(
        '#dashboardQueueHealth',
        urgentCallbacks > 0
            ? 'Cola: SLA comprometido'
            : pendingCallbacks > 0
              ? 'Cola: pendiente por drenar'
              : 'Cola: estable'
    );
    setText(
        '#dashboardFlowStatus',
        nextAppointment?.item
            ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
            : availabilityDays > 0
              ? `${availabilityDays} dia(s) con slots publicados`
              : 'Sin citas inmediatas'
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'La prioridad ya esta definida'
            : nextAppointment?.item
              ? 'Siguiente accion lista'
              : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        nextAppointment?.item
            ? `Siguiente hito: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
            : 'Sin citas inmediatas en cola'
    );

    const operations = [
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
    ];
    setHtml('#operationActionList', operations.join(''));

    const attentionItems = [
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
    ];
    setHtml('#dashboardAttentionList', attentionItems.join(''));

    const summary = funnel.summary || {};
    setText('#funnelViewBooking', formatNumber(summary.viewBooking || 0));
    setText('#funnelStartCheckout', formatNumber(summary.startCheckout || 0));
    setText(
        '#funnelBookingConfirmed',
        formatNumber(summary.bookingConfirmed || 0)
    );
    setText(
        '#funnelAbandonRate',
        `${Number(summary.abandonRatePct || 0).toFixed(1)}%`
    );

    setHtml(
        '#funnelEntryList',
        breakdownList(funnel.checkoutEntryBreakdown, 'entry', 'count')
    );
    setHtml(
        '#funnelSourceList',
        breakdownList(funnel.sourceBreakdown, 'source', 'count')
    );
    setHtml(
        '#funnelPaymentMethodList',
        breakdownList(funnel.paymentMethodBreakdown, 'method', 'count')
    );
    setHtml(
        '#funnelAbandonList',
        breakdownList(funnel.checkoutAbandonByStep, 'step', 'count')
    );
    setHtml(
        '#funnelAbandonReasonList',
        breakdownList(funnel.abandonReasonBreakdown, 'reason', 'count')
    );
    setHtml(
        '#funnelStepList',
        breakdownList(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        breakdownList(funnel.errorCodeBreakdown, 'code', 'count')
    );
}
