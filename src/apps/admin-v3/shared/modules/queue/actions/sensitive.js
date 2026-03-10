import { getState } from '../../../core/store.js';
import { appendActivity } from '../state.js';
import { hideSensitiveConfirm } from '../render.js';
import { executeTicketAction } from './execute.js';

export async function confirmQueueSensitiveAction() {
    const pending = getState().queue.pendingSensitiveAction;
    if (!pending) {
        hideSensitiveConfirm();
        return;
    }
    hideSensitiveConfirm();
    await executeTicketAction(pending);
}

export function cancelQueueSensitiveAction() {
    hideSensitiveConfirm();
    appendActivity('Accion sensible cancelada');
}

export function dismissQueueSensitiveDialog() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const pending = getState().queue.pendingSensitiveAction;
    const isOpen =
        Boolean(pending) ||
        (dialog instanceof HTMLDialogElement
            ? dialog.open
            : dialog instanceof HTMLElement
              ? !dialog.hidden || dialog.hasAttribute('open')
              : false);
    if (!isOpen) return false;
    cancelQueueSensitiveAction();
    return true;
}
