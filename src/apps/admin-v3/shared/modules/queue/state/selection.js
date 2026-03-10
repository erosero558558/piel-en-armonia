import { getState, updateState } from '../../../core/store.js';
import { getVisibleTickets, normalizeSelectedQueueIds } from '../selectors.js';
import { renderQueueSection } from '../render.js';
import { appendActivity } from './activity.js';

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
