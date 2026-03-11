import { getState, updateState } from '../../core/store.js';
import { normalizeAdminStorePayload } from './normalizers.js';

function toMillis(value) {
    const timestamp = new Date(value || '').getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldPreserveQueueData(state, normalized, options = {}) {
    const expectedRuntimeRevision = Number(options.queueRuntimeRevision ?? -1);
    const currentRuntimeRevision = Number(state.queue?.runtimeRevision || 0);
    if (
        expectedRuntimeRevision >= 0 &&
        currentRuntimeRevision !== expectedRuntimeRevision
    ) {
        return true;
    }

    const currentUpdatedAt = toMillis(
        state.data?.queueMeta?.updatedAt || state.data?.queueMeta?.updated_at
    );
    const incomingUpdatedAt = toMillis(
        normalized.queueMeta?.updatedAt || normalized.queueMeta?.updated_at
    );

    return (
        currentUpdatedAt > 0 &&
        incomingUpdatedAt > 0 &&
        currentUpdatedAt > incomingUpdatedAt
    );
}

export function writeAdminDataInStore(payload, options = {}) {
    let preservedQueueData = false;
    updateState((state) => {
        const normalized = normalizeAdminStorePayload(
            payload,
            state.data.funnelMetrics
        );
        preservedQueueData = shouldPreserveQueueData(
            state,
            normalized,
            options
        );
        return {
            ...state,
            data: {
                ...state.data,
                ...normalized,
                queueTickets: preservedQueueData
                    ? state.data.queueTickets
                    : normalized.queueTickets,
                queueMeta: preservedQueueData
                    ? state.data.queueMeta
                    : normalized.queueMeta,
            },
            ui: {
                ...state.ui,
                lastRefreshAt: Date.now(),
            },
        };
    });

    return {
        preservedQueueData,
    };
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
