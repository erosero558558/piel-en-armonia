import { getState } from '../core/store.js';
import { logoutSession } from './auth.js';
import { showLoginView } from '../../ui/frame.js';
import { primeLoginSurface } from '../../core/boot/auth.js';

let inactivityTimer = null;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins

export function initSessionInactivityTimer() {
    function resetTimer() {
        if (inactivityTimer) {
            window.clearTimeout(inactivityTimer);
        }
        
        const state = getState();
        if (!state.auth.authenticated) {
            return;
        }

        const profileTimeout = state.clinicProfile?.sessionTimeoutMinutes;
        const timeoutMs = typeof profileTimeout === 'number' && profileTimeout > 0 
            ? profileTimeout * 60 * 1000 
            : DEFAULT_TIMEOUT_MS;

        inactivityTimer = window.setTimeout(async () => {
            // session expire inactivity
            await logoutSession();
            showLoginView();
            primeLoginSurface();
            document.body.dispatchEvent(new CustomEvent('admin-toast', {
                detail: { message: 'Sesión expirada por inactividad', type: 'error' }
            }));
        }, timeoutMs);
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(eventName => {
        window.addEventListener(eventName, () => {
            if (getState().auth.authenticated) {
                resetTimer();
            }
        }, { passive: true });
    });

    // Initial start
    resetTimer();
}
