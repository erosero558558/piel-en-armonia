import { apiRequest } from '../../shared/core/api-client.js';
import { getState } from '../../shared/core/store.js';
import { mutateCallbackRecord, mutateCallbackStatus } from './state.js';
import {
    buildCallbackWhatsappMessage,
    buildCallbackWhatsappUrl,
    getCallbackWhatsappDraft,
    getCallbackWhatsappTemplateKey,
    normalizeCallbackWhatsappTemplateKey,
} from './whatsapp-templates.js';

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

function findCallbackById(id) {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return null;

    return (getState().data.callbacks || []).find(
        (item) => Number(item.id || 0) === callbackId
    );
}

async function persistCallbackLeadOps(id, leadOpsPatch) {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return null;

    const updated = await patchCallback(callbackId, {
        leadOps: leadOpsPatch,
    });

    if (updated) {
        mutateCallbackRecord(updated);
        return updated;
    }

    const current = findCallbackById(callbackId);
    if (current) {
        mutateCallbackRecord({
            ...current,
            leadOps: {
                ...(current.leadOps || {}),
                ...leadOpsPatch,
            },
        });
    }

    return current;
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

export async function applyCallbackWhatsappTemplate(id, templateKey) {
    const callback = findCallbackById(id);
    if (!callback) return null;

    const normalizedKey = normalizeCallbackWhatsappTemplateKey(templateKey);
    const messageDraft = normalizedKey
        ? buildCallbackWhatsappMessage(normalizedKey, callback)
        : '';
    const now = new Date().toISOString();

    return persistCallbackLeadOps(id, {
        whatsappTemplateKey: normalizedKey,
        whatsappMessageDraft: messageDraft,
        whatsappLastPreparedAt: messageDraft ? now : '',
    });
}

export async function setCallbackWhatsappDraft(id, draft, templateKey = '') {
    const callback = findCallbackById(id);
    if (!callback) return null;

    const normalizedKey = normalizeCallbackWhatsappTemplateKey(
        templateKey || getCallbackWhatsappTemplateKey(callback)
    );
    const nextDraft = String(draft || '').trim();
    const now = new Date().toISOString();

    return persistCallbackLeadOps(id, {
        whatsappTemplateKey: normalizedKey,
        whatsappMessageDraft: nextDraft,
        whatsappLastPreparedAt: nextDraft ? now : '',
    });
}

export async function openCallbackWhatsappComposer(
    id,
    { templateKey = '', message = '' } = {}
) {
    const callback = findCallbackById(id);
    if (!callback) {
        throw new Error('Lead no encontrado');
    }

    const normalizedKey = normalizeCallbackWhatsappTemplateKey(
        templateKey || getCallbackWhatsappTemplateKey(callback)
    );
    const draft =
        String(message || '').trim() || getCallbackWhatsappDraft(callback);
    if (!draft) {
        throw new Error('Primero prepara un mensaje');
    }

    const url = buildCallbackWhatsappUrl(callback, draft);
    if (!url) {
        throw new Error('Lead sin telefono');
    }

    const now = new Date().toISOString();
    await persistCallbackLeadOps(id, {
        whatsappTemplateKey: normalizedKey,
        whatsappMessageDraft: draft,
        whatsappLastPreparedAt: now,
        whatsappLastOpenedAt: now,
    });

    const popup = window.open(url, '_blank', 'noopener');
    if (popup && typeof popup.focus === 'function') {
        popup.focus();
    }

    return url;
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
