import {
    appointmentTimestamp,
    humanizeToken,
    isToday,
    normalize,
    normalizeAppointmentStatus,
} from '../utils.js';

const TERMINAL_APPOINTMENT_STATUSES = new Set([
    'cancelled',
    'completed',
    'no_show',
]);

const ACTIVE_QUEUE_STATUSES = new Set(['waiting', 'called', 'completed']);

function ticketTimestamp(ticket) {
    const candidates = [
        ticket?.completedAt,
        ticket?.calledAt,
        ticket?.createdAt,
        ticket?.completed_at,
        ticket?.called_at,
        ticket?.created_at,
    ];

    for (const candidate of candidates) {
        const stamp = candidate ? new Date(candidate).getTime() : 0;
        if (Number.isFinite(stamp) && stamp > 0) {
            return stamp;
        }
    }

    return 0;
}

function humanizeDoctor(value) {
    const normalized = normalize(value);
    if (!normalized || normalized === 'indiferente') {
        return 'Agenda compartida';
    }
    return humanizeToken(value, 'Agenda compartida');
}

function hasCheckinData(appointment) {
    const checkinToken = String(
        appointment?.checkinToken || appointment?.checkin_token || ''
    ).trim();
    if (checkinToken !== '') {
        return true;
    }

    return (
        String(appointment?.phone || '').trim() !== '' &&
        String(appointment?.date || '').trim() !== '' &&
        String(appointment?.time || '').trim() !== ''
    );
}

function buildQueueTicketMap(queueTickets) {
    const map = new Map();
    const sorted = [...(Array.isArray(queueTickets) ? queueTickets : [])].sort(
        (left, right) =>
            ticketTimestamp(right) - ticketTimestamp(left) ||
            (Number(right?.id || 0) || 0) - (Number(left?.id || 0) || 0)
    );

    for (const ticket of sorted) {
        const appointmentId =
            Number(ticket?.appointmentId ?? ticket?.appointment_id ?? 0) || 0;
        if (appointmentId <= 0 || map.has(appointmentId)) {
            continue;
        }
        map.set(appointmentId, ticket);
    }

    return map;
}

function buildOverbookingSummary(todayAppointments) {
    const grouped = new Map();

    for (const appointment of todayAppointments) {
        const appointmentId = Number(appointment?.id || 0) || 0;
        const appointmentStatus = normalizeAppointmentStatus(
            appointment?.status
        );
        const date = String(appointment?.date || '').trim();
        const time = String(appointment?.time || '').trim() || '--:--';
        const doctorKey = normalize(appointment?.doctor);

        if (
            appointmentId <= 0 ||
            date === '' ||
            time === '' ||
            TERMINAL_APPOINTMENT_STATUSES.has(appointmentStatus)
        ) {
            continue;
        }

        const key = `${date}|${time}|${
            doctorKey && doctorKey !== 'indiferente' ? doctorKey : 'shared'
        }`;
        const current = grouped.get(key) || {
            key,
            time,
            doctorLabel: humanizeDoctor(appointment?.doctor),
            items: [],
        };
        current.items.push(appointment);
        grouped.set(key, current);
    }

    const slots = Array.from(grouped.values())
        .filter((entry) => entry.items.length > 1)
        .sort((left, right) =>
            String(left.time || '').localeCompare(String(right.time || ''), 'es')
        )
        .map((entry) => ({
            ...entry,
            count: entry.items.length,
            label: `${entry.time} · ${entry.doctorLabel}`,
            detail:
                entry.items.length === 2
                    ? '2 citas activas comparten este horario.'
                    : `${entry.items.length} citas activas comparten este horario.`,
        }));

    const byAppointmentId = new Map();
    for (const slot of slots) {
        for (const appointment of slot.items) {
            const appointmentId = Number(appointment?.id || 0) || 0;
            if (appointmentId <= 0) {
                continue;
            }
            byAppointmentId.set(appointmentId, {
                label: slot.label,
                count: slot.count,
                detail: slot.detail,
            });
        }
    }

    return {
        slots,
        byAppointmentId,
    };
}

function resolveAgendaStatus(appointment, queueTicket) {
    const queueStatus = normalize(queueTicket?.status);
    if (queueStatus === 'waiting') {
        return {
            label: 'Llegó',
            tone: 'success',
            detail: queueTicket?.ticketCode
                ? `Ticket ${queueTicket.ticketCode} en espera.`
                : 'Paciente ya está en cola.',
        };
    }
    if (queueStatus === 'called') {
        return {
            label: 'Llamado',
            tone: 'info',
            detail:
                Number(queueTicket?.assignedConsultorio || 0) > 0
                    ? `En consultorio C${Number(
                          queueTicket.assignedConsultorio
                      )}.`
                    : 'Paciente ya fue llamado.',
        };
    }
    if (queueStatus === 'completed') {
        return {
            label: 'Atendido',
            tone: 'success',
            detail: 'La atención de esta cita ya quedó cerrada.',
        };
    }
    if (queueStatus === 'no_show') {
        return {
            label: 'No show',
            tone: 'danger',
            detail: 'La cola registró ausencia para esta cita.',
        };
    }
    if (queueStatus === 'cancelled') {
        return {
            label: 'Ticket cancelado',
            tone: 'danger',
            detail: 'La llegada quedó cancelada en la cola.',
        };
    }

    const appointmentStatus = normalizeAppointmentStatus(appointment?.status);
    if (appointmentStatus === 'pending') {
        return {
            label: 'Pendiente',
            tone: 'warning',
            detail: 'Confirma datos antes del check-in.',
        };
    }
    if (appointmentStatus === 'cancelled') {
        return {
            label: 'Cancelada',
            tone: 'danger',
            detail: 'Esta cita ya no debe pasar a cola.',
        };
    }
    if (appointmentStatus === 'completed') {
        return {
            label: 'Completada',
            tone: 'success',
            detail: 'Consulta cerrada en agenda.',
        };
    }
    if (appointmentStatus === 'no_show') {
        return {
            label: 'No show',
            tone: 'danger',
            detail: 'Requiere seguimiento o reprogramación.',
        };
    }

    return {
        label: 'Confirmada',
        tone: 'neutral',
        detail: 'Lista para marcar llegada.',
    };
}

function canMarkArrived(appointment, queueTicket) {
    const appointmentStatus = normalizeAppointmentStatus(appointment?.status);
    const queueStatus = normalize(queueTicket?.status);

    if (!['confirmed', 'pending'].includes(appointmentStatus)) {
        return false;
    }

    if (ACTIVE_QUEUE_STATUSES.has(queueStatus)) {
        return false;
    }

    return hasCheckinData(appointment);
}

export function buildDailyAgenda(appointments, queueTickets) {
    const todayAppointments = [...(Array.isArray(appointments) ? appointments : [])]
        .filter(isToday)
        .sort((left, right) => appointmentTimestamp(left) - appointmentTimestamp(right));
    const overbooking = buildOverbookingSummary(todayAppointments);
    const queueTicketMap = buildQueueTicketMap(queueTickets);

    const items = todayAppointments.map((appointment) => {
        const appointmentId = Number(appointment?.id || 0) || 0;
        const queueTicket = queueTicketMap.get(appointmentId) || null;
        const status = resolveAgendaStatus(appointment, queueTicket);
        const queueStatus = normalize(queueTicket?.status);
        const overbookingSlot = overbooking.byAppointmentId.get(appointmentId) || null;

        return {
            appointment,
            appointmentId,
            timestamp: appointmentTimestamp(appointment),
            queueTicket,
            queueStatus,
            status,
            overbooking: overbookingSlot,
            canMarkArrived: canMarkArrived(appointment, queueTicket),
        };
    });

    return {
        items,
        totalCount: items.length,
        arrivedCount: items.filter((item) =>
            ACTIVE_QUEUE_STATUSES.has(item.queueStatus)
        ).length,
        pendingArrivalCount: items.filter((item) => item.canMarkArrived).length,
        overbookingCount: overbooking.slots.length,
        overbookingSlots: overbooking.slots,
    };
}
