import { getState, updateState } from '../../core/store.js';
import { normalizeAdminStorePayload } from './normalizers.js';

export function writeAdminDataInStore(payload) {
    updateState((state) => {
        const normalized = normalizeAdminStorePayload(
            payload,
            state.data.funnelMetrics
        );
        return {
            ...state,
            data: {
                ...state.data,
                ...normalized,
            },
            ui: {
                ...state.ui,
                lastRefreshAt: Date.now(),
            },
        };
    });
}

export function refreshStatusLabel() {
    const state = getState();
    const ts = Number(state.ui.lastRefreshAt || 0);
    if (!ts) return 'Datos: sin sincronizar';
    const deltaSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    return deltaSec < 60
        ? `Datos: hace ${deltaSec}s`
        : `Datos: hace ${Math.round(deltaSec / 60)}m`;
}
