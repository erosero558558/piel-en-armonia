import { normalizeQueueAction, normalizeStatus } from '../helpers.js';
import { mutateTicketLocal } from '../state.js';

export function setTicketCalledLocal(ticketId, consultorio) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status: 'called',
        assignedConsultorio: consultorio,
        calledAt: new Date().toISOString(),
    }));
}

export function setTicketStatusLocal(
    ticketId,
    status,
    consultorio = undefined
) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status,
        assignedConsultorio:
            consultorio === undefined
                ? ticket.assignedConsultorio
                : consultorio,
        calledAt:
            status === 'called'
                ? new Date().toISOString()
                : status === 'waiting'
                  ? ''
                  : ticket.calledAt,
        completedAt:
            status === 'completed' ||
            status === 'no_show' ||
            status === 'cancelled'
                ? new Date().toISOString()
                : '',
    }));
}

export function requiresSensitiveConfirm(action, ticket) {
    const normalizedAction = normalizeQueueAction(action);
    if (normalizedAction === 'cancelar') {
        return true;
    }
    if (normalizedAction !== 'no_show') {
        return false;
    }

    if (!ticket) return true;
    return (
        normalizeStatus(ticket.status) === 'called' ||
        Number(ticket.assignedConsultorio || 0) > 0
    );
}
