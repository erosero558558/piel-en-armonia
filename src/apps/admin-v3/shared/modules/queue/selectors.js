import { getState } from '../../core/store.js';
import { asArray, normalize, toMillis } from './helpers.js';
import {
    buildQueueMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from './model.js';

export function getQueueSource() {
    const state = getState();
    const queueTickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
    const queueMeta =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, queueTickets)
            : buildQueueMeta(queueTickets);
    return { queueTickets, queueMeta };
}

export function queueFilter(items, filter) {
    const normalized = normalize(filter);
    if (normalized === 'waiting') {
        return items.filter((item) => item.status === 'waiting');
    }
    if (normalized === 'called') {
        return items.filter((item) => item.status === 'called');
    }
    if (normalized === 'no_show') {
        return items.filter((item) => item.status === 'no_show');
    }
    if (normalized === 'sla_risk') {
        return items.filter((item) => {
            if (item.status !== 'waiting') return false;
            const ageMinutes = Math.max(
                0,
                Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
            );
            return (
                ageMinutes >= 20 ||
                normalize(item.priorityClass) === 'appt_overdue'
            );
        });
    }
    return items;
}

export function queueSearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;
    return items.filter((item) => {
        const fields = [
            item.ticketCode,
            item.patientInitials,
            item.status,
            item.queueType,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

export function getVisibleTickets() {
    const state = getState();
    const { queueTickets } = getQueueSource();
    return queueSearch(
        queueFilter(queueTickets, state.queue.filter),
        state.queue.search
    );
}

export function normalizeSelectedQueueIds(ids, tickets = null) {
    const sourceTickets = Array.isArray(tickets)
        ? tickets
        : getQueueSource().queueTickets;
    const allowedIds = new Set(
        sourceTickets
            .map((ticket) => Number(ticket.id || 0))
            .filter((id) => id > 0)
    );

    return [...new Set(asArray(ids).map((id) => Number(id || 0)))]
        .filter((id) => id > 0 && allowedIds.has(id))
        .sort((a, b) => a - b);
}

export function getSelectedQueueIds() {
    return normalizeSelectedQueueIds(getState().queue.selected || []);
}

export function getSelectedQueueTickets() {
    const selectedIds = new Set(getSelectedQueueIds());
    if (!selectedIds.size) return [];
    return getQueueSource().queueTickets.filter((ticket) =>
        selectedIds.has(Number(ticket.id || 0))
    );
}

export function getQueueTicketById(ticketId) {
    const targetId = Number(ticketId || 0);
    if (!targetId) return null;
    return (
        getQueueSource().queueTickets.find(
            (ticket) => Number(ticket.id || 0) === targetId
        ) || null
    );
}

export function getBulkTargetTickets() {
    const selectedTickets = getSelectedQueueTickets();
    if (selectedTickets.length) return selectedTickets;
    return getVisibleTickets();
}

export function getCalledTicketForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return (
        getQueueSource().queueTickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === target
        ) || null
    );
}

export function getWaitingForConsultorio(consultorio) {
    const tickets = getQueueSource().queueTickets;
    return tickets.find(
        (ticket) =>
            ticket.status === 'waiting' &&
            (!ticket.assignedConsultorio ||
                ticket.assignedConsultorio === consultorio)
    );
}

export function getActiveCalledTicketForStation() {
    const state = getState();
    const station = Number(state.queue.stationConsultorio || 1);
    const tickets = getQueueSource().queueTickets;
    return (
        tickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === station
        ) || null
    );
}
