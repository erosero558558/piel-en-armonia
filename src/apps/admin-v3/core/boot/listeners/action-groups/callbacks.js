import {
    acceptCallbackAiDraft,
    clearCallbacksFilters,
    clearCallbacksSelection,
    focusNextPendingCallback,
    markCallbackContacted,
    markSelectedCallbacksContacted,
    requestCallbackAiDraft,
    selectVisibleCallbacks,
    setCallbackOutcome,
    setCallbacksFilter,
} from '../../../../sections/callbacks.js';
import { getState } from '../../../../shared/core/store.js';
import { createToast } from '../../../../shared/ui/render.js';
import { navigateToSection } from '../../navigation.js';

export async function handleCallbackAction(action, element) {
    switch (action) {
        case 'callback-quick-filter':
            setCallbacksFilter(String(element.dataset.filterValue || 'all'));
            return true;
        case 'clear-callback-filters':
            clearCallbacksFilters();
            return true;
        case 'callbacks-triage-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return true;
        case 'mark-contacted':
            await markCallbackContacted(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.callbackDate || '')
            );
            createToast('Callback actualizado', 'success');
            return true;
        case 'lead-ai-request':
            await requestCallbackAiDraft(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.objective || 'whatsapp_draft')
            );
            createToast('Solicitud IA encolada', 'success');
            return true;
        case 'callback-outcome':
            await setCallbackOutcome(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.outcome || '')
            );
            createToast('Outcome actualizado', 'success');
            return true;
        case 'callback-copy-ai': {
            const callbackId = Number(element.dataset.callbackId || 0);
            const callback = (getState().data.callbacks || []).find(
                (item) => Number(item.id || 0) === callbackId
            );
            const draft = String(callback?.leadOps?.aiDraft || '').trim();
            if (!draft) {
                createToast('Aun no hay borrador IA', 'error');
                return true;
            }
            if (!navigator?.clipboard?.writeText) {
                createToast('Clipboard no disponible', 'error');
                return true;
            }
            await navigator.clipboard.writeText(draft);
            await acceptCallbackAiDraft(callbackId);
            createToast('Borrador copiado', 'success');
            return true;
        }
        case 'callbacks-bulk-select-visible':
            selectVisibleCallbacks();
            return true;
        case 'callbacks-bulk-clear':
            clearCallbacksSelection();
            return true;
        case 'callbacks-bulk-mark':
            await markSelectedCallbacksContacted();
            return true;
        case 'context-open-callbacks-pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            return true;
        case 'context-open-callbacks-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return true;
        default:
            return false;
    }
}
