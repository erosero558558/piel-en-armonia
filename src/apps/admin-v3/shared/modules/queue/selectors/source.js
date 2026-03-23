import { getState } from '../../../core/store.js';
import { loadLocalAdminFallback } from '../../data/local.js';
import {
    buildQueueMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from '../model.js';

function normalizeTicketList(tickets) {
    return Array.isArray(tickets)
        ? tickets.map((item, index) => normalizeTicket(item, index))
        : [];
}

function buildTicketIdentitySet(tickets) {
    return new Set(
        tickets.map((ticket) => `${ticket.status}:${ticket.id}:${ticket.ticketCode}`)
    );
}

function hasSameTicketIdentities(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    const leftIds = buildTicketIdentitySet(left);
    const rightIds = buildTicketIdentitySet(right);
    if (leftIds.size !== rightIds.size) {
        return false;
    }
    for (const identity of leftIds) {
        if (!rightIds.has(identity)) {
            return false;
        }
    }
    return true;
}

function computeTicketRichnessScore(tickets) {
    return tickets.reduce((score, ticket) => {
        let nextScore = score;
        if (ticket.assignedConsultorio) {
            nextScore += 4;
        }
        if (ticket.queueType && ticket.queueType !== 'walk_in') {
            nextScore += 3;
        }
        if (ticket.priorityClass && ticket.priorityClass !== 'walk_in') {
            nextScore += 2;
        }
        if (ticket.createdAt) {
            nextScore += 1;
        }
        return nextScore;
    }, 0);
}

function preferRicherCachedTickets(queueTickets) {
    const cachedTickets = normalizeTicketList(
        loadLocalAdminFallback()?.queueTickets || []
    );
    if (!cachedTickets.length) {
        return queueTickets;
    }
    if (!queueTickets.length) {
        return cachedTickets;
    }
    if (!hasSameTicketIdentities(queueTickets, cachedTickets)) {
        return queueTickets;
    }
    return computeTicketRichnessScore(cachedTickets) >
        computeTicketRichnessScore(queueTickets)
        ? cachedTickets
        : queueTickets;
}

export function getQueueSource() {
    const state = getState();
    const queueTickets = preferRicherCachedTickets(
        normalizeTicketList(state.data.queueTickets)
    );
    const queueMeta =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, queueTickets)
            : buildQueueMeta(queueTickets);
    return { queueTickets, queueMeta };
}
