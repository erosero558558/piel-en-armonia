export const QUEUE_STATION_MODE_STORAGE_KEY = 'queueStationMode';
export const QUEUE_STATION_CONSULTORIO_STORAGE_KEY = 'queueStationConsultorio';
export const QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY = 'queueOneTapAdvance';
export const QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY = 'queueCallKeyBindingV1';
export const QUEUE_HELP_STORAGE_KEY = 'queueNumpadHelpOpen';
export const QUEUE_SNAPSHOT_STORAGE_KEY = 'queueAdminLastSnapshot';

export const CALL_NEXT_IN_FLIGHT = new Map([
    [1, false],
    [2, false],
]);

export const SENSITIVE_QUEUE_ACTIONS = new Set(['no_show', 'cancelar']);
