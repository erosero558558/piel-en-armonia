import { getState } from '../../../core/store.js';
import { refreshAdminData } from '../../data.js';
import { renderQueueSection } from '../render.js';
import { hydrateQueueFromData } from '../sync.js';
import { resolveQueueAutoRefreshIntervalMs } from './constants.js';
import { resolveQueueAutoRefreshGuard } from './guard.js';
import {
    isQueueAutoRefreshInFlight,
    setQueueAutoRefreshInFlight,
} from './runtime.js';
import { patchQueueAutoRefresh, syncHeaderStatusLabel } from './state.js';

function resolveRefreshReasonLabel(reason) {
    return reason === 'visibility' || reason === 'focus' || reason === 'online'
        ? 'Actualizando al volver a primer plano.'
        : 'Actualizando Equipos en vivo.';
}

export async function runQueueAutoRefreshCycle(reason = 'timer') {
    const guard = resolveQueueAutoRefreshGuard();
    const intervalMs = resolveQueueAutoRefreshIntervalMs();

    if (!guard.active) {
        patchQueueAutoRefresh({
            state: guard.state,
            reason: guard.reason,
            intervalMs,
            inFlight: false,
        });
        return false;
    }

    if (isQueueAutoRefreshInFlight()) {
        return false;
    }

    setQueueAutoRefreshInFlight(true);
    patchQueueAutoRefresh({
        state: 'refreshing',
        reason: resolveRefreshReasonLabel(reason),
        intervalMs,
        lastAttemptAt: Date.now(),
        inFlight: true,
        lastError: '',
    });

    try {
        const ok = await refreshAdminData();
        await hydrateQueueFromData();
        patchQueueAutoRefresh({
            state: ok ? 'active' : 'warning',
            reason: ok
                ? 'Auto-refresh activo en esta sección.'
                : 'Sincronización degradada: usando cache local.',
            intervalMs,
            lastSuccessAt: Date.now(),
            inFlight: false,
            lastError: ok ? '' : 'cache_local',
        });
        renderQueueSection();
        syncHeaderStatusLabel();
        return ok;
    } catch (error) {
        patchQueueAutoRefresh({
            state: 'warning',
            reason: 'No se pudo refrescar Equipos en vivo. Revisa red local o fuerza una actualización manual.',
            intervalMs,
            inFlight: false,
            lastError: error?.message || 'refresh_failed',
        });
        if (getState().ui?.activeSection === 'queue') {
            renderQueueSection();
        }
        return false;
    } finally {
        setQueueAutoRefreshInFlight(false);
    }
}

export function syncQueueAutoRefresh(options = {}) {
    const { immediate = false, reason = 'sync' } = options;
    const guard = resolveQueueAutoRefreshGuard();
    const intervalMs = resolveQueueAutoRefreshIntervalMs();

    patchQueueAutoRefresh({
        state: guard.state,
        reason: guard.reason,
        intervalMs,
        inFlight: isQueueAutoRefreshInFlight(),
    });

    if (getState().ui?.activeSection === 'queue') {
        renderQueueSection();
    }

    if (immediate && guard.active) {
        void runQueueAutoRefreshCycle(reason);
        return true;
    }

    return guard.active;
}
