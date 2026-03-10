import { createToast } from '../../../../ui/render.js';
import { appendActivity, updateQueueUi } from '../../state.js';

function isLockedOut(target, state) {
    return (
        state.queue.stationMode === 'locked' &&
        state.queue.stationConsultorio !== target
    );
}

function notifyBlockedStationChange() {
    createToast('Cambio bloqueado por modo estación', 'warning');
    appendActivity('Cambio de estación bloqueado por lock');
}

export function stationKeyTarget(code, key) {
    if (code === 'numpad2' || key === '2') return 2;
    if (code === 'numpad1' || key === '1') return 1;
    return 0;
}

export function setStationFromNumpad(target, state) {
    if (isLockedOut(target, state)) {
        notifyBlockedStationChange();
        return true;
    }
    updateQueueUi({ stationConsultorio: target });
    appendActivity(`Numpad: estacion C${target}`);
    return true;
}
