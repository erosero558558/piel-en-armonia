import { getState, updateState } from '../../../core/store.js';
import {
    buildQueueMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from '../model.js';
import { persistQueueUi } from '../persistence.js';
import { normalizeSelectedQueueIds } from '../selectors.js';
import { renderQueueSection } from '../render.js';
import { normalize } from '../helpers.js';
import { appendActivity } from './activity.js';

export function setQueueStateWithTickets(
    tickets,
    queueMeta = null,
    options = {}
) {
    const normalized = (Array.isArray(tickets) ? tickets : []).map(
        (item, index) => normalizeTicket(item, index)
    );
    const meta = normalizeQueueMeta(
        queueMeta && typeof queueMeta === 'object'
            ? queueMeta
            : buildQueueMeta(normalized),
        normalized
    );
    const waitingVisible = normalized.filter(
        (ticket) => ticket.status === 'waiting'
    ).length;
    const fallbackPartial =
        typeof options.fallbackPartial === 'boolean'
            ? options.fallbackPartial
            : Number(meta.waitingCount || 0) > waitingVisible;
    const syncMode =
        normalize(options.syncMode) === 'fallback'
            ? 'fallback'
            : fallbackPartial
              ? normalize(options.syncMode) === 'live'
                  ? 'live'
                  : 'fallback'
              : 'live';
    const bumpRuntimeRevision = Boolean(options.bumpRuntimeRevision);
    const runtimeMutationAt = bumpRuntimeRevision ? Date.now() : 0;

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            queueTickets: normalized,
            queueMeta: meta,
        },
        queue: {
            ...state.queue,
            selected: normalizeSelectedQueueIds(
                state.queue.selected || [],
                normalized
            ),
            runtimeRevision: bumpRuntimeRevision
                ? Number(state.queue.runtimeRevision || 0) + 1
                : Number(state.queue.runtimeRevision || 0),
            lastRuntimeMutationAt: bumpRuntimeRevision
                ? runtimeMutationAt
                : Number(state.queue.lastRuntimeMutationAt || 0),
            fallbackPartial,
            syncMode,
        },
    }));

    persistQueueUi(getState());
    renderQueueSection(appendActivity);
}

export function mutateTicketLocal(ticketId, updater) {
    const targetId = Number(ticketId || 0);
    const nextTickets = (getState().data.queueTickets || []).map(
        (ticket, index) => {
            const normalizedTicket = normalizeTicket(ticket, index);
            if (normalizedTicket.id !== targetId) return normalizedTicket;
            return normalizeTicket(
                typeof updater === 'function'
                    ? updater(normalizedTicket)
                    : { ...normalizedTicket },
                index
            );
        }
    );
    setQueueStateWithTickets(nextTickets, buildQueueMeta(nextTickets), {
        fallbackPartial: false,
        syncMode: 'live',
        bumpRuntimeRevision: true,
    });
}
