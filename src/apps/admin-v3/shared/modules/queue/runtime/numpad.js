import { getState } from '../../../core/store.js';
import {
    callNextForConsultorio,
    confirmQueueSensitiveAction,
} from '../actions.js';
import { normalize } from '../helpers.js';
import {
    captureExternalCallKey,
    eventMatchesBinding,
    isNumpadAddEvent,
    isNumpadDecimalEvent,
    isNumpadEnterEvent,
    isNumpadSubtractEvent,
    noShowActiveTicketPrompt,
    reCallActiveTicket,
    setStationFromNumpad,
    stationKeyTarget,
} from './numpad/index.js';
import { completeActiveTicketPrompt } from './numpad/tickets.js';

export async function queueNumpadAction(eventInfo) {
    const state = getState();

    if (state.queue.captureCallKeyMode) {
        captureExternalCallKey(eventInfo);
        return;
    }

    if (eventMatchesBinding(eventInfo, state.queue.customCallKey)) {
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const code = normalize(eventInfo.code);
    const key = normalize(eventInfo.key);
    const isEnter = isNumpadEnterEvent(eventInfo, code, key);

    if (isEnter && state.queue.pendingSensitiveAction) {
        await confirmQueueSensitiveAction();
        return;
    }

    const target = stationKeyTarget(code, key);
    if (target) {
        setStationFromNumpad(target, state);
        return;
    }

    if (isEnter) {
        if (state.queue.oneTap && completeActiveTicketPrompt(state)) {
            await confirmQueueSensitiveAction();
        }
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    if (isNumpadDecimalEvent(code, key)) {
        completeActiveTicketPrompt(state);
        return;
    }

    if (isNumpadSubtractEvent(code, key)) {
        noShowActiveTicketPrompt(state);
        return;
    }

    if (isNumpadAddEvent(code, key)) {
        await reCallActiveTicket(state);
    }
}
