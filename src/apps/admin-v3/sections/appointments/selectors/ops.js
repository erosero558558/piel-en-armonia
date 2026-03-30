import {
    appointmentTimestamp,
    humanizeToken,
    isToday,
    isUpcoming48h,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
    relativeWindow,
} from '../utils.js';
import { applyFilter } from './filters.js';

const DAILY_AGENDA_EXCLUDED_STATUSES = new Set(['cancelled']);
const OVERBOOKING_EXCLUDED_STATUSES = new Set([
    'cancelled',
    'completed',
    'no_show',
]);

function sortByTimestampAsc(items) {
    return [...items].sort(
        (left, right) => appointmentTimestamp(left) - appointmentTimestamp(right)
    );
}

function buildDailyAgenda(items) {
    return sortByTimestampAsc(
        items.filter((item) => {
            if (!isToday(item)) {
                return false;
            }

            return !DAILY_AGENDA_EXCLUDED_STATUSES.has(
                normalizeAppointmentStatus(item.status)
            );
        })
    );
}

function buildOverbookingAlerts(items) {
    const grouped = new Map();

    buildDailyAgenda(items).forEach((item) => {
        const status = normalizeAppointmentStatus(item.status);
        if (OVERBOOKING_EXCLUDED_STATUSES.has(status)) {
            return;
        }

        const date = String(item.date || '').trim();
        const time = String(item.time || '').trim();
        if (date === '' || time === '') {
            return;
        }

        const doctor = String(item.doctor || '').trim().toLowerCase() || 'sin_asignar';
        const key = `${date}|${time}|${doctor}`;
        const bucket = grouped.get(key) || [];
        bucket.push(item);
        grouped.set(key, bucket);
    });

    return Array.from(grouped.entries())
        .filter(([, group]) => group.length > 1)
        .map(([key, group]) => {
            const [date, time] = key.split('|');
            const first = group[0] || {};

            return {
                key,
                date,
                time,
                doctor: String(first.doctor || '').trim(),
                doctorLabel: humanizeToken(first.doctor, 'Sin asignar'),
                count: group.length,
                items: sortByTimestampAsc(group),
                patientNames: group.map((item) => String(item.name || 'Paciente')).filter(Boolean),
            };
        })
        .sort((left, right) => {
            const timeDiff =
                appointmentTimestamp({
                    date: left.date,
                    time: left.time,
                }) -
                appointmentTimestamp({
                    date: right.date,
                    time: right.time,
                });

            if (timeDiff !== 0) {
                return timeDiff;
            }

            return right.count - left.count;
        });
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

    if (status === 'arrived') {
        return {
            label: 'Recepcion',
            tone: 'success',
            note: 'Paciente listo para avanzar en el journey.',
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

    const arrived = byPriority.find(
        ({ item }) => normalizeAppointmentStatus(item.status) === 'arrived'
    );
    if (arrived) {
        return {
            item: arrived.item,
            label: 'Paciente en recepcion',
            hint: 'Confirmacion hecha; avanza el flujo clinico sin perder la ventana.',
            tags: ['Llego', 'Journey activo'],
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
    const dailyAgenda = buildDailyAgenda(items);
    const overbookingAlerts = buildOverbookingAlerts(items);
    const confirmedTodayCount = dailyAgenda.filter((item) => {
        const status = normalizeAppointmentStatus(item.status);
        return status === 'confirmed' || status === 'pending';
    }).length;
    const arrivedCount = dailyAgenda.filter(
        (item) => normalizeAppointmentStatus(item.status) === 'arrived'
    ).length;

    return {
        pendingTransferCount: pendingTransfers.length,
        upcomingCount: upcoming48h.length,
        noShowCount: noShows.length,
        todayCount: today.length,
        confirmedTodayCount,
        arrivedCount,
        triageCount: triage.length,
        dailyAgenda,
        overbookingAlerts,
        focus: buildFocusAppointment(items),
    };
}
