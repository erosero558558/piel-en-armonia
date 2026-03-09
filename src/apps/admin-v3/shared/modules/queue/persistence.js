import {
    getStorageItem,
    setStorageItem,
    setStorageJson,
    getStorageJson,
    removeStorageItem,
} from '../../core/persistence.js';
import {
    QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
    QUEUE_HELP_STORAGE_KEY,
    QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
    QUEUE_SNAPSHOT_STORAGE_KEY,
    QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
    QUEUE_STATION_MODE_STORAGE_KEY,
} from './constants.js';
import { normalize } from './helpers.js';

export function persistQueueUi(state) {
    setStorageItem(
        QUEUE_STATION_MODE_STORAGE_KEY,
        state.queue.stationMode || 'free'
    );
    setStorageItem(
        QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
        state.queue.stationConsultorio || 1
    );
    setStorageItem(
        QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
        state.queue.oneTap ? '1' : '0'
    );
    setStorageItem(QUEUE_HELP_STORAGE_KEY, state.queue.helpOpen ? '1' : '0');

    if (state.queue.customCallKey) {
        setStorageJson(
            QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
            state.queue.customCallKey
        );
    } else {
        removeStorageItem(QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY);
    }

    setStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, {
        queueMeta: state.data.queueMeta,
        queueTickets: state.data.queueTickets,
        updatedAt: new Date().toISOString(),
    });
}

export function readQueueUiDefaults() {
    const stationMode =
        normalize(getStorageItem(QUEUE_STATION_MODE_STORAGE_KEY, 'free')) ===
        'locked'
            ? 'locked'
            : 'free';
    const stationConsultorio =
        Number(getStorageItem(QUEUE_STATION_CONSULTORIO_STORAGE_KEY, '1')) === 2
            ? 2
            : 1;
    const oneTap =
        getStorageItem(QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY, '0') === '1';
    const helpOpen = getStorageItem(QUEUE_HELP_STORAGE_KEY, '0') === '1';
    const customCallKey = getStorageJson(
        QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
        null
    );

    return {
        stationMode,
        stationConsultorio,
        oneTap,
        helpOpen,
        customCallKey,
    };
}
