import { apiRequest } from '../../shared/core/api-client.js';
import { getState } from '../../shared/core/store.js';
import { mutateCallbackRecord, mutateCallbackStatus } from './state.js';

async function patchCallback(id, body) {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return null;

    const response = await apiRequest('callbacks', {
        method: 'PATCH',
        body: {
            id: callbackId,
            ...body,
        },
    });

    return response?.data || null;
}

export async function markCallbackContacted(id, callbackDate = '') {
    const updated = await patchCallback(id, {
        status: 'contacted',
        fecha: callbackDate,
        leadOps: {
            outcome: 'contactado',
        },
    });

    if (updated) {
        mutateCallbackRecord(updated);
        return updated;
    }

    mutateCallbackStatus(id, 'contacted');
    return null;
}

export async function setCallbackOutcome(id, outcome) {
    const updated = await patchCallback(id, {
        status: 'contacted',
        leadOps: {
            outcome,
        },
    });

    if (updated) {
        mutateCallbackRecord(updated);
    }

    return updated;
}

export async function requestCallbackAiDraft(id, objective = 'whatsapp_draft') {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return null;

    const response = await apiRequest('lead-ai-request', {
        method: 'POST',
        body: {
            callbackId,
            objective,
        },
    });

    if (response?.data) {
        mutateCallbackRecord(response.data);
        return response.data;
    }

    return null;
}

export async function acceptCallbackAiDraft(id) {
    const updated = await patchCallback(id, {
        leadOps: {
            aiStatus: 'accepted',
        },
    });

    if (updated) {
        mutateCallbackRecord(updated);
    }

    return updated;
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
