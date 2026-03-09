import {
    appointmentTimestamp,
    isToday,
    isTriageAttention,
    isUpcoming48h,
    normalize,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
    relativeWindow,
} from './utils.js';

export function applyFilter(items, filter) {
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

export function applySearch(items, searchTerm) {
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

export function sortItems(items, sort) {
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

export function appointmentPriority(item) {
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

export function buildFocusAppointment(items) {
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

export function computeOps(items) {
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

export function buildToolbarStateParts(appointmentsState, visibleCount) {
    const stateParts = [];

    if (normalize(appointmentsState.filter) !== 'all') {
        const labels = {
            pending_transfer: 'Transferencias por validar',
            triage_attention: 'Triage accionable',
            upcoming_48h: 'Proximas 48h',
            no_show: 'No show',
        };
        stateParts.push(
            labels[normalize(appointmentsState.filter)] ||
                appointmentsState.filter
        );
    }

    if (normalize(appointmentsState.search)) {
        stateParts.push(`Busqueda: ${appointmentsState.search}`);
    }

    if (normalize(appointmentsState.sort) === 'patient_az') {
        stateParts.push('Paciente (A-Z)');
    } else if (normalize(appointmentsState.sort) === 'datetime_asc') {
        stateParts.push('Fecha ascendente');
    } else {
        stateParts.push('Fecha reciente');
    }

    if (visibleCount === 0) {
        stateParts.push('Resultados: 0');
    }

    return stateParts;
}
