import { getQueryParam } from '../../core/persistence.js';
import { getState, updateState } from '../../core/store.js';
import { createToast } from '../../ui/render.js';
import { normalize } from './helpers.js';
import { persistQueueUi, readQueueUiDefaults } from './persistence.js';
import { getActiveCalledTicketForStation } from './selectors.js';
import { appendActivity, updateQueueUi } from './state.js';
import { showSensitiveConfirm } from './render.js';
import {
    callNextForConsultorio,
    confirmQueueSensitiveAction,
    runQueueTicketAction,
} from './actions.js';

function eventMatchesBinding(eventInfo, binding) {
    if (!binding || typeof binding !== 'object') return false;
    return (
        normalize(binding.code) === normalize(eventInfo.code) &&
        String(binding.key || '') === String(eventInfo.key || '') &&
        Number(binding.location || 0) === Number(eventInfo.location || 0)
    );
}

export function toggleQueueHelpPanel() {
    updateQueueUi({ helpOpen: !getState().queue.helpOpen });
}

export function toggleQueueOneTap() {
    updateQueueUi({ oneTap: !getState().queue.oneTap });
}

export function setQueuePracticeMode(enabled) {
    const practiceMode = Boolean(enabled);
    updateQueueUi({ practiceMode, pendingSensitiveAction: null });
    appendActivity(
        practiceMode ? 'Modo practica activo' : 'Modo practica desactivado'
    );
}

export function setQueueStationLock(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    updateQueueUi({ stationMode: 'locked', stationConsultorio: target });
    appendActivity(`Estacion bloqueada en C${target}`);
}

export function setQueueStationMode(mode) {
    const normalizedMode = normalize(mode);
    if (normalizedMode === 'free') {
        updateQueueUi({ stationMode: 'free' });
        appendActivity('Estacion en modo libre');
        return;
    }
    updateQueueUi({ stationMode: 'locked' });
}

export function beginQueueCallKeyCapture() {
    updateQueueUi({ captureCallKeyMode: true });
    createToast('Calibración activa: presiona la tecla externa', 'info');
}

export function clearQueueCallKeyBinding() {
    const confirmed = window.confirm('¿Quitar tecla externa calibrada?');
    if (!confirmed) return;
    updateQueueUi({ customCallKey: null, captureCallKeyMode: false });
    createToast('Tecla externa eliminada', 'success');
}

export async function queueNumpadAction(eventInfo) {
    const state = getState();

    if (state.queue.captureCallKeyMode) {
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
        return;
    }

    if (eventMatchesBinding(eventInfo, state.queue.customCallKey)) {
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const code = normalize(eventInfo.code);
    const key = normalize(eventInfo.key);
    const isEnter =
        code === 'numpadenter' ||
        code === 'kpenter' ||
        (key === 'enter' && Number(eventInfo.location || 0) === 3);

    if (isEnter && state.queue.pendingSensitiveAction) {
        await confirmQueueSensitiveAction();
        return;
    }

    if (code === 'numpad2' || key === '2') {
        if (
            state.queue.stationMode === 'locked' &&
            state.queue.stationConsultorio !== 2
        ) {
            createToast('Cambio bloqueado por modo estación', 'warning');
            appendActivity('Cambio de estación bloqueado por lock');
            return;
        }
        updateQueueUi({ stationConsultorio: 2 });
        appendActivity('Numpad: estacion C2');
        return;
    }

    if (code === 'numpad1' || key === '1') {
        if (
            state.queue.stationMode === 'locked' &&
            state.queue.stationConsultorio !== 1
        ) {
            createToast('Cambio bloqueado por modo estación', 'warning');
            appendActivity('Cambio de estación bloqueado por lock');
            return;
        }
        updateQueueUi({ stationConsultorio: 1 });
        appendActivity('Numpad: estacion C1');
        return;
    }

    if (isEnter) {
        if (state.queue.oneTap) {
            const activeCalled = getActiveCalledTicketForStation();
            if (activeCalled) {
                showSensitiveConfirm({
                    ticketId: activeCalled.id,
                    action: 'completar',
                    consultorio: state.queue.stationConsultorio,
                });
                await confirmQueueSensitiveAction();
            }
        }
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const isDecimal =
        code === 'numpaddecimal' ||
        code === 'kpdecimal' ||
        key === 'decimal' ||
        key === ',' ||
        key === '.';
    if (isDecimal) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            showSensitiveConfirm({
                ticketId: activeCalled.id,
                action: 'completar',
                consultorio: state.queue.stationConsultorio,
            });
        }
        return;
    }

    const isSubtract =
        code === 'numpadsubtract' || code === 'kpsubtract' || key === '-';
    if (isSubtract) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            showSensitiveConfirm({
                ticketId: activeCalled.id,
                action: 'no_show',
                consultorio: state.queue.stationConsultorio,
            });
        }
        return;
    }

    const isAdd = code === 'numpadadd' || code === 'kpadd' || key === '+';
    if (isAdd) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            await runQueueTicketAction(
                activeCalled.id,
                're-llamar',
                state.queue.stationConsultorio
            );
            appendActivity(`Re-llamar ${activeCalled.ticketCode}`);
            createToast(`Re-llamar ${activeCalled.ticketCode}`, 'info');
        }
    }
}

export function applyQueueRuntimeDefaults() {
    const defaults = readQueueUiDefaults();

    const stationQuery = normalize(getQueryParam('station'));
    const lockQuery = normalize(getQueryParam('lock'));
    const oneTapQuery = normalize(getQueryParam('one_tap'));

    const fromQueryConsultorio =
        stationQuery === 'c2' || stationQuery === '2'
            ? 2
            : stationQuery === 'c1' || stationQuery === '1'
              ? 1
              : defaults.stationConsultorio;

    const stationMode =
        lockQuery === '1' || lockQuery === 'true'
            ? 'locked'
            : defaults.stationMode;

    const oneTap =
        oneTapQuery === '1' || oneTapQuery === 'true'
            ? true
            : oneTapQuery === '0' || oneTapQuery === 'false'
              ? false
              : defaults.oneTap;

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            stationMode,
            stationConsultorio: fromQueryConsultorio,
            oneTap,
            helpOpen: defaults.helpOpen,
            customCallKey:
                defaults.customCallKey &&
                typeof defaults.customCallKey === 'object'
                    ? defaults.customCallKey
                    : null,
        },
    }));

    persistQueueUi(getState());
}
