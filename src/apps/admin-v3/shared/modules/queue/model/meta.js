import { asArray, toFiniteNumber } from '../helpers.js';
import { normalizeMetaTicket, normalizeTicket } from './normalizers.js';

export function buildQueueMeta(tickets) {
    const waiting = tickets.filter((item) => item.status === 'waiting');
    const called = tickets.filter((item) => item.status === 'called');

    const nowByConsultorio = {
        1: called.find((item) => item.assignedConsultorio === 1) || null,
        2: called.find((item) => item.assignedConsultorio === 2) || null,
    };

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: tickets.filter((item) => item.status === 'completed')
                .length,
            no_show: tickets.filter((item) => item.status === 'no_show').length,
            cancelled: tickets.filter((item) => item.status === 'cancelled')
                .length,
        },
        callingNowByConsultorio: nowByConsultorio,
        nextTickets: waiting.slice(0, 5).map((item, index) => ({
            id: item.id,
            ticketCode: item.ticketCode,
            patientInitials: item.patientInitials,
            position: index + 1,
        })),
    };
}

export function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts =
        meta.counts && typeof meta.counts === 'object' ? meta.counts : {};
    const callingByConsultorio =
        meta.callingNowByConsultorio &&
        typeof meta.callingNowByConsultorio === 'object'
            ? meta.callingNowByConsultorio
            : meta.calling_now_by_consultorio &&
                typeof meta.calling_now_by_consultorio === 'object'
              ? meta.calling_now_by_consultorio
              : {};
    const callingNowList = asArray(meta.callingNow).concat(
        asArray(meta.calling_now)
    );
    const fromTickets = asArray(tickets).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );

    const c1Raw =
        callingByConsultorio['1'] ||
        callingByConsultorio[1] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 1
        ) ||
        null;
    const c2Raw =
        callingByConsultorio['2'] ||
        callingByConsultorio[2] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 2
        ) ||
        null;

    const c1 = c1Raw
        ? normalizeMetaTicket(c1Raw, 0, {
              status: 'called',
              assignedConsultorio: 1,
          })
        : null;
    const c2 = c2Raw
        ? normalizeMetaTicket(c2Raw, 1, {
              status: 'called',
              assignedConsultorio: 2,
          })
        : null;

    const nextTickets = asArray(meta.nextTickets)
        .concat(asArray(meta.next_tickets))
        .map((item, index) =>
            normalizeMetaTicket(
                {
                    ...item,
                    status: item?.status || 'waiting',
                    assignedConsultorio: null,
                },
                index
            )
        );

    const waitingFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'waiting'
    ).length;
    const calledFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'called'
    ).length;
    const calledCountFallback = Math.max(
        Number(Boolean(c1)) + Number(Boolean(c2)),
        calledFromTickets
    );

    const waitingCount = toFiniteNumber(
        meta.waitingCount ??
            meta.waiting_count ??
            counts.waiting ??
            nextTickets.length ??
            waitingFromTickets,
        0
    );
    const calledCount = toFiniteNumber(
        meta.calledCount ??
            meta.called_count ??
            counts.called ??
            calledCountFallback,
        0
    );
    const completedCount = toFiniteNumber(
        counts.completed ??
            meta.completedCount ??
            meta.completed_count ??
            fromTickets.filter((ticket) => ticket.status === 'completed')
                .length,
        0
    );
    const noShowCount = toFiniteNumber(
        counts.no_show ??
            counts.noShow ??
            meta.noShowCount ??
            meta.no_show_count ??
            fromTickets.filter((ticket) => ticket.status === 'no_show').length,
        0
    );
    const cancelledCount = toFiniteNumber(
        counts.cancelled ??
            counts.canceled ??
            meta.cancelledCount ??
            meta.cancelled_count ??
            fromTickets.filter((ticket) => ticket.status === 'cancelled')
                .length,
        0
    );

    return {
        updatedAt: String(
            meta.updatedAt || meta.updated_at || new Date().toISOString()
        ),
        waitingCount,
        calledCount,
        counts: {
            waiting: waitingCount,
            called: calledCount,
            completed: completedCount,
            no_show: noShowCount,
            cancelled: cancelledCount,
        },
        callingNowByConsultorio: {
            1: c1,
            2: c2,
        },
        nextTickets,
    };
}
