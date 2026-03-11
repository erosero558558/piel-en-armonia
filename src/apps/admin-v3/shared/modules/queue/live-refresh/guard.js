import { getState } from '../../../core/store.js';

export function resolveQueueAutoRefreshGuard() {
    const state = getState();

    if (!state.auth?.authenticated) {
        return {
            active: false,
            state: 'idle',
            reason: 'Inicia sesión para monitorear los equipos.',
        };
    }

    if (state.ui?.activeSection !== 'queue') {
        return {
            active: false,
            state: 'paused',
            reason: 'Abre Turnero Sala para reanudar el monitoreo.',
        };
    }

    if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
    ) {
        return {
            active: false,
            state: 'paused',
            reason: 'Pestaña oculta. El monitoreo se reanuda al volver al admin.',
        };
    }

    return {
        active: true,
        state: 'active',
        reason: 'Auto-refresh activo en esta sección.',
    };
}
