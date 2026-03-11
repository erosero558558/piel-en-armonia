import { getState, updateState } from '../../../core/store.js';
import { setText } from '../../../ui/render.js';
import { refreshStatusLabel } from '../../data.js';
import { resolveQueueAutoRefreshIntervalMs } from './constants.js';

export function getDefaultQueueAutoRefreshState() {
    return {
        state: 'idle',
        reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
        intervalMs: resolveQueueAutoRefreshIntervalMs(),
        lastAttemptAt: 0,
        lastSuccessAt: 0,
        lastError: '',
        inFlight: false,
    };
}

export function getQueueAutoRefreshMeta() {
    return {
        ...getDefaultQueueAutoRefreshState(),
        ...(getState().ui?.queueAutoRefresh || {}),
    };
}

export function patchQueueAutoRefresh(patch) {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            queueAutoRefresh: {
                ...getDefaultQueueAutoRefreshState(),
                ...(state.ui?.queueAutoRefresh || {}),
                ...patch,
            },
        },
    }));
}

export function syncHeaderStatusLabel() {
    const label = refreshStatusLabel();
    setText('#adminRefreshStatus', label);
    setText(
        '#adminSyncState',
        label === 'Datos: sin sincronizar'
            ? 'Listo para primera sincronizacion'
            : label.replace('Datos: ', 'Estado: ')
    );
}
