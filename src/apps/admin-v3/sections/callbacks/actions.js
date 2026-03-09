import { apiRequest } from '../../shared/core/api-client.js';
import { getState } from '../../shared/core/store.js';
import { mutateCallbackStatus } from './state.js';

export async function markCallbackContacted(id, callbackDate = '') {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return;

    await apiRequest('callbacks', {
        method: 'PATCH',
        body: {
            id: callbackId,
            status: 'contacted',
            fecha: callbackDate,
        },
    });

    mutateCallbackStatus(callbackId, 'contacted');
}

export async function markSelectedCallbacksContacted() {
    const state = getState();
    const selectedIds = (state.callbacks.selected || [])
        .map((value) => Number(value || 0))
        .filter((value) => value > 0);

    for (const id of selectedIds) {
        try {
            await markCallbackContacted(id);
        } catch (_error) {
            // no-op
        }
    }
}

export function focusNextPendingCallback() {
    const next = document.querySelector(
        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
    );
    if (next instanceof HTMLElement) next.focus();
}
