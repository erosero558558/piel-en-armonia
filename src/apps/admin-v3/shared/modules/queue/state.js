import { getState, updateState } from '../../core/store.js';
import {
    buildQueueMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from './model.js';
import { persistQueueUi } from './persistence.js';
import { getVisibleTickets, normalizeSelectedQueueIds } from './selectors.js';
import { renderQueueActivity, renderQueueSection } from './render.js';
import { normalize } from './helpers.js';

export function appendActivity(message) {
    updateState((state) => {
        const nextActivity = [
            {
                at: new Date().toISOString(),
                message: String(message || ''),
            },
            ...(state.queue.activity || []),
        ].slice(0, 30);

        return {
            ...state,
            queue: {
                ...state.queue,
                activity: nextActivity,
            },
        };
    });

    try {
        renderQueueActivity();
    } catch (_error) {
        // queue UI may not be mounted yet
    }
}

export function setQueueSelection(nextSelected, { render = true } = {}) {
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            selected: normalizeSelectedQueueIds(
                nextSelected,
                state.data.queueTickets || []
            ),
        },
    }));

    if (render) {
        renderQueueSection(appendActivity);
    }
}

export function toggleQueueTicketSelection(ticketId) {
    const targetId = Number(ticketId || 0);
    if (!targetId) return;
    const selectedIds = normalizeSelectedQueueIds(
        getState().queue.selected || []
    );
    const nextSelected = selectedIds.includes(targetId)
        ? selectedIds.filter((id) => id !== targetId)
        : [...selectedIds, targetId];
    setQueueSelection(nextSelected);
}

export function selectVisibleQueueTickets() {
    const visibleIds = getVisibleTickets().map((ticket) =>
        Number(ticket.id || 0)
    );
    setQueueSelection(visibleIds);
}

export function clearQueueSelection() {
    setQueueSelection([]);
}

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
    });
}

export function updateQueueUi(patch) {
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            ...patch,
        },
    }));
    persistQueueUi(getState());
    renderQueueSection(appendActivity);
}

export function setQueueFilter(filter) {
    updateQueueUi({ filter: normalize(filter) || 'all', selected: [] });
}

export function setQueueSearch(search) {
    updateQueueUi({ search: String(search || ''), selected: [] });
}

export function clearQueueSearch() {
    updateQueueUi({ search: '', selected: [] });
    const input = document.getElementById('queueSearchInput');
    if (input instanceof HTMLInputElement) input.value = '';
}
