import { asArray, coalesceNonEmptyString, normalize } from '../helpers.js';
import { normalizeQueueMeta } from './meta.js';
import { normalizeTicket } from './normalizers.js';

export function ticketIdentity(ticket) {
    const normalized = normalizeTicket(ticket, 0);
    if (normalized.id > 0) return `id:${normalized.id}`;
    return `code:${normalize(normalized.ticketCode || '')}`;
}

export function buildTicketsFromMeta(queueMeta) {
    const meta = normalizeQueueMeta(queueMeta);
    const byIdentity = new Map();

    const addTicket = (ticket) => {
        if (!ticket) return;
        const normalized = normalizeTicket(ticket, byIdentity.size);
        if (!coalesceNonEmptyString(ticket?.createdAt, ticket?.created_at)) {
            normalized.createdAt = '';
        }
        if (
            !coalesceNonEmptyString(
                ticket?.priorityClass,
                ticket?.priority_class
            )
        ) {
            normalized.priorityClass = '';
        }
        if (!coalesceNonEmptyString(ticket?.queueType, ticket?.queue_type)) {
            normalized.queueType = '';
        }
        byIdentity.set(ticketIdentity(normalized), normalized);
    };

    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;
    if (c1) addTicket({ ...c1, status: 'called', assignedConsultorio: 1 });
    if (c2) addTicket({ ...c2, status: 'called', assignedConsultorio: 2 });

    for (const nextTicket of asArray(meta.nextTickets)) {
        addTicket({
            ...nextTicket,
            status: 'waiting',
            assignedConsultorio: null,
        });
    }

    return Array.from(byIdentity.values());
}

export function extractTicketsFromPayload(queueState) {
    if (!queueState || typeof queueState !== 'object') return [];
    if (Array.isArray(queueState.queue_tickets))
        return queueState.queue_tickets;
    if (Array.isArray(queueState.queueTickets)) return queueState.queueTickets;
    if (Array.isArray(queueState.tickets)) return queueState.tickets;
    return [];
}
