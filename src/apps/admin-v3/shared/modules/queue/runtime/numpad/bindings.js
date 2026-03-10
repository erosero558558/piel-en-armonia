import { createToast } from '../../../../ui/render.js';
import { normalize } from '../../helpers.js';
import { appendActivity, updateQueueUi } from '../../state.js';

export function eventMatchesBinding(eventInfo, binding) {
    if (!binding || typeof binding !== 'object') return false;
    return (
        normalize(binding.code) === normalize(eventInfo.code) &&
        String(binding.key || '') === String(eventInfo.key || '') &&
        Number(binding.location || 0) === Number(eventInfo.location || 0)
    );
}

export function captureExternalCallKey(eventInfo) {
    const binding = {
        key: String(eventInfo.key || ''),
        code: String(eventInfo.code || ''),
        location: Number(eventInfo.location || 0),
    };
    updateQueueUi({
        customCallKey: binding,
        captureCallKeyMode: false,
    });
    createToast('Tecla externa guardada', 'success');
    appendActivity(`Tecla externa calibrada: ${binding.code}`);
}
