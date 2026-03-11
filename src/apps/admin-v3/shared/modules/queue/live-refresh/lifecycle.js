import { getState } from '../../../core/store.js';
import { resolveQueueAutoRefreshIntervalMs } from './constants.js';
import { runQueueAutoRefreshCycle, syncQueueAutoRefresh } from './cycle.js';
import {
    getQueueAutoRefreshTimerId,
    isQueueAutoRefreshInitialized,
    setQueueAutoRefreshInFlight,
    setQueueAutoRefreshInitialized,
    setQueueAutoRefreshTimerId,
} from './runtime.js';
import { patchQueueAutoRefresh } from './state.js';

function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        void runQueueAutoRefreshCycle('visibility');
        return;
    }

    syncQueueAutoRefresh();
}

function handleWindowFocus() {
    if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
    ) {
        return;
    }

    if (getState().ui?.activeSection === 'queue') {
        void runQueueAutoRefreshCycle('focus');
    }
}

function handleWindowOnline() {
    if (getState().ui?.activeSection === 'queue') {
        void runQueueAutoRefreshCycle('online');
    }
}

export function initQueueAutoRefresh() {
    if (isQueueAutoRefreshInitialized() || typeof window === 'undefined') {
        return;
    }

    setQueueAutoRefreshInitialized(true);
    setQueueAutoRefreshTimerId(
        window.setInterval(() => {
            void runQueueAutoRefreshCycle('timer');
        }, resolveQueueAutoRefreshIntervalMs())
    );

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowOnline);

    syncQueueAutoRefresh({
        immediate:
            getState().auth?.authenticated &&
            getState().ui?.activeSection === 'queue',
        reason: 'init',
    });
}

export function stopQueueAutoRefresh() {
    if (!isQueueAutoRefreshInitialized() || typeof window === 'undefined') {
        return;
    }

    setQueueAutoRefreshInitialized(false);

    if (getQueueAutoRefreshTimerId()) {
        window.clearInterval(getQueueAutoRefreshTimerId());
        setQueueAutoRefreshTimerId(0);
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('online', handleWindowOnline);

    setQueueAutoRefreshInFlight(false);
    patchQueueAutoRefresh({
        state: 'idle',
        reason: 'Monitoreo detenido.',
        inFlight: false,
    });
}
