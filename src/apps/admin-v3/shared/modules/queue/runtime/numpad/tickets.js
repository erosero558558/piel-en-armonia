import { createToast } from '../../../../ui/render.js';
import { runQueueTicketAction } from '../../actions.js';
import { showSensitiveConfirm } from '../../render.js';
import { getActiveCalledTicketForStation } from '../../selectors.js';
import { appendActivity } from '../../state.js';

export function completeActiveTicketPrompt(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return false;
    showSensitiveConfirm({
        ticketId: activeCalled.id,
        action: 'completar',
        consultorio: state.queue.stationConsultorio,
    });
    return true;
}

export function noShowActiveTicketPrompt(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return false;
    showSensitiveConfirm({
        ticketId: activeCalled.id,
        action: 'no_show',
        consultorio: state.queue.stationConsultorio,
    });
    return true;
}

export async function reCallActiveTicket(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return;
    await runQueueTicketAction(
        activeCalled.id,
        're-llamar',
        state.queue.stationConsultorio
    );
    appendActivity(`Re-llamar ${activeCalled.ticketCode}`);
    createToast(`Re-llamar ${activeCalled.ticketCode}`, 'info');
}
