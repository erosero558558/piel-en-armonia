import { updateState } from '../../../core/store.js';

export function showSensitiveConfirm(actionPayload) {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const message = document.getElementById('queueSensitiveConfirmMessage');
    if (message) {
        message.textContent = `Confirmar accion sensible: ${actionPayload.action}`;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: actionPayload,
        },
    }));

    if (
        dialog instanceof HTMLDialogElement &&
        typeof dialog.showModal === 'function'
    ) {
        dialog.hidden = false;
        dialog.removeAttribute('hidden');
        if (!dialog.open) {
            try {
                dialog.showModal();
            } catch (_error) {
                dialog.setAttribute('open', '');
            }
        }
        return;
    }
    if (dialog instanceof HTMLElement) {
        dialog.setAttribute('open', '');
        dialog.hidden = false;
    }
}

export function hideSensitiveConfirm() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
        dialog.close();
    }
    if (dialog instanceof HTMLElement) {
        dialog.removeAttribute('open');
        dialog.hidden = true;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: null,
        },
    }));
}
