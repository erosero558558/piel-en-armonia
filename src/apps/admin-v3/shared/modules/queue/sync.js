import { apiRequest } from '../../core/api-client.js';
import { getStorageJson } from '../../core/persistence.js';
import { getState } from '../../core/store.js';
import { QUEUE_SNAPSHOT_STORAGE_KEY } from './constants.js';
import { coalesceNonEmptyString, normalize } from './helpers.js';
import {
    buildTicketsFromMeta,
    extractTicketsFromPayload,
    getQueueStateSignalFlags,
    hasExplicitQueueSignals,
    normalizeQueueMeta,
    normalizeTicket,
    reconcilePartialMetaSignals,
    ticketIdentity,
} from './model.js';
import { appendActivity, setQueueStateWithTickets } from './state.js';

export function applyQueueStateResponse(payload, options = {}) {
    const queueState =
        payload?.data?.queueState ||
        payload?.data?.queue_state ||
        payload?.data?.queueMeta ||
        payload?.data ||
        null;
    if (!queueState || typeof queueState !== 'object') return;
    const fullTickets = extractTicketsFromPayload(queueState);
    const payloadTicket = payload?.data?.ticket || null;
    if (!hasExplicitQueueSignals(queueState, fullTickets, payloadTicket)) {
        return;
    }

    const syncMode =
        normalize(options.syncMode) === 'fallback' ? 'fallback' : 'live';
    const currentTickets = (getState().data.queueTickets || []).map(
        (item, index) => normalizeTicket(item, index)
    );
    const normalizedMeta = normalizeQueueMeta(queueState, currentTickets);
    const signalFlags = getQueueStateSignalFlags(queueState);
    const partialMetaTickets = buildTicketsFromMeta(normalizedMeta);
    const hasPayloadTicket = Boolean(
        payloadTicket && typeof payloadTicket === 'object'
    );
    if (
        !fullTickets.length &&
        !partialMetaTickets.length &&
        !hasPayloadTicket &&
        !signalFlags.waiting &&
        !signalFlags.called
    ) {
        return;
    }
    const fallbackPartial =
        Number(normalizedMeta.waitingCount || 0) >
        partialMetaTickets.filter((item) => item.status === 'waiting').length;
    const byIdentity = new Map(
        currentTickets.map((ticket) => [ticketIdentity(ticket), ticket])
    );

    if (fullTickets.length) {
        setQueueStateWithTickets(fullTickets, normalizedMeta, {
            fallbackPartial: false,
            syncMode,
        });
        return;
    }

    reconcilePartialMetaSignals(byIdentity, normalizedMeta, signalFlags);

    for (const ticket of partialMetaTickets) {
        const identity = ticketIdentity(ticket);
        const existing = byIdentity.get(identity) || null;
        const mergedCreatedAt = coalesceNonEmptyString(
            ticket.createdAt,
            ticket.created_at,
            existing?.createdAt,
            existing?.created_at
        );
        const mergedPriorityClass = coalesceNonEmptyString(
            ticket.priorityClass,
            ticket.priority_class,
            existing?.priorityClass,
            existing?.priority_class,
            'walk_in'
        );
        const mergedQueueType = coalesceNonEmptyString(
            ticket.queueType,
            ticket.queue_type,
            existing?.queueType,
            existing?.queue_type,
            'walk_in'
        );
        const mergedInitials = coalesceNonEmptyString(
            ticket.patientInitials,
            ticket.patient_initials,
            existing?.patientInitials,
            existing?.patient_initials,
            '--'
        );
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...ticket,
                    status: ticket.status,
                    assignedConsultorio: ticket.assignedConsultorio,
                    createdAt: mergedCreatedAt || new Date().toISOString(),
                    priorityClass: mergedPriorityClass,
                    queueType: mergedQueueType,
                    patientInitials: mergedInitials,
                },
                byIdentity.size
            )
        );
    }

    if (hasPayloadTicket) {
        const normalizedPayloadTicket = normalizeTicket(
            payloadTicket,
            byIdentity.size
        );
        const identity = ticketIdentity(normalizedPayloadTicket);
        const existing = byIdentity.get(identity) || null;
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...normalizedPayloadTicket,
                },
                byIdentity.size
            )
        );
    }

    setQueueStateWithTickets(Array.from(byIdentity.values()), normalizedMeta, {
        fallbackPartial,
        syncMode,
    });
}

export async function refreshQueueState() {
    try {
        const payload = await apiRequest('queue-state');
        applyQueueStateResponse(payload, { syncMode: 'live' });
        appendActivity('Queue refresh realizado');
    } catch (_error) {
        appendActivity('Queue refresh con error');
        const snapshot = getStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, null);
        if (snapshot?.queueTickets) {
            setQueueStateWithTickets(
                snapshot.queueTickets,
                snapshot.queueMeta || null,
                {
                    fallbackPartial: true,
                    syncMode: 'fallback',
                }
            );
        }
    }
}

export function shouldRefreshQueueOnSectionEnter() {
    const state = getState();
    if (
        normalize(state.queue.syncMode) === 'fallback' ||
        Boolean(state.queue.fallbackPartial)
    ) {
        return false;
    }
    return true;
}

export async function hydrateQueueFromData() {
    const state = getState();
    const tickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
    const metaFromData =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, tickets)
            : null;

    if (tickets.length) {
        setQueueStateWithTickets(tickets, metaFromData || null, {
            fallbackPartial: false,
            syncMode: 'live',
        });
        return;
    }

    const derivedFromMeta = metaFromData
        ? buildTicketsFromMeta(metaFromData)
        : [];
    if (derivedFromMeta.length) {
        setQueueStateWithTickets(derivedFromMeta, metaFromData, {
            fallbackPartial: true,
            syncMode: 'fallback',
        });
        appendActivity('Queue fallback parcial desde metadata');
        return;
    }

    await refreshQueueState();
    const refreshed = getState().data.queueTickets || [];
    if (refreshed.length) return;

    const snapshot = getStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, null);
    if (snapshot?.queueTickets?.length) {
        setQueueStateWithTickets(
            snapshot.queueTickets,
            snapshot.queueMeta || null,
            {
                fallbackPartial: true,
                syncMode: 'fallback',
            }
        );
        appendActivity('Queue fallback desde snapshot local');
        return;
    }

    setQueueStateWithTickets([], null, {
        fallbackPartial: false,
        syncMode: 'live',
    });
}
