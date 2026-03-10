import { asArray, toFiniteNumber } from '../../helpers.js';
import { normalizeMetaTicket, normalizeTicket } from '../normalizers.js';
import {
    getCallingByConsultorio,
    getCallingNowList,
    getQueueMetaCounts,
} from './shared.js';

function resolveCallingTicket(callingByConsultorio, callingNowList, slot) {
    return (
        callingByConsultorio[String(slot)] ||
        callingByConsultorio[slot] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === slot
        ) ||
        null
    );
}

function normalizeCallingTicket(rawTicket, index, assignedConsultorio) {
    return rawTicket
        ? normalizeMetaTicket(rawTicket, index, {
              status: 'called',
              assignedConsultorio,
          })
        : null;
}

function normalizeNextTickets(meta) {
    return asArray(meta.nextTickets)
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
}

function buildTicketFallbacks(tickets) {
    const normalizedTickets = asArray(tickets).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );
    return {
        normalizedTickets,
        waitingFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'waiting'
        ).length,
        calledFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'called'
        ).length,
        completedFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'completed'
        ).length,
        noShowFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'no_show'
        ).length,
        cancelledFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'cancelled'
        ).length,
    };
}

export function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts = getQueueMetaCounts(meta);
    const callingByConsultorio = getCallingByConsultorio(meta);
    const callingNowList = getCallingNowList(meta);
    const ticketFallbacks = buildTicketFallbacks(tickets);

    const c1 = normalizeCallingTicket(
        resolveCallingTicket(callingByConsultorio, callingNowList, 1),
        0,
        1
    );
    const c2 = normalizeCallingTicket(
        resolveCallingTicket(callingByConsultorio, callingNowList, 2),
        1,
        2
    );
    const nextTickets = normalizeNextTickets(meta);

    const calledCountFallback = Math.max(
        Number(Boolean(c1)) + Number(Boolean(c2)),
        ticketFallbacks.calledFromTickets
    );
    const waitingCount = toFiniteNumber(
        meta.waitingCount ??
            meta.waiting_count ??
            counts.waiting ??
            nextTickets.length ??
            ticketFallbacks.waitingFromTickets,
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
            ticketFallbacks.completedFromTickets,
        0
    );
    const noShowCount = toFiniteNumber(
        counts.no_show ??
            counts.noShow ??
            meta.noShowCount ??
            meta.no_show_count ??
            ticketFallbacks.noShowFromTickets,
        0
    );
    const cancelledCount = toFiniteNumber(
        counts.cancelled ??
            counts.canceled ??
            meta.cancelledCount ??
            meta.cancelled_count ??
            ticketFallbacks.cancelledFromTickets,
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
