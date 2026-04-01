import { attachKeyboardShortcuts } from '../shared/core/keyboard.js';
import { getState } from '../shared/core/store.js';
import { checkAuthStatus } from '../shared/modules/auth.js';
import {
    hideCommandPalette,
    renderV3Frame,
    setActiveSection,
    showLoginView,
} from '../ui/frame.js';
import { bindFrameHooks } from '../ui/dom.js';
import { hydrateAppointmentPreferences } from '../sections/appointments.js';
import { hydrateCallbacksPreferences } from '../sections/callbacks.js';
import { hydrateAvailabilityPreferences } from '../sections/availability.js';
import { bootStaffSection } from '../sections/staff.js';
import { bootServicesSection } from '../sections/services.js';
import { bootBrandingSection } from '../sections/branding.js';
import { bootDomainSection } from '../sections/domain.js';
import { initSessionInactivityTimer } from '../shared/modules/inactivity.js';
import { initPushModule } from '../shared/modules/push.js';
import { focusAgentPrompt } from '../shared/modules/agent.js';
import {
    applyQueueRuntimeDefaults,
    initQueueAutoRefresh,
    queueNumpadAction,
    toggleQueueHelpPanel,
} from '../shared/modules/queue.js';
import {
    bootAuthenticatedUi,
    handleLoginSubmit,
    primeLoginSurface,
    resumeOpenClawPolling,
} from './boot/auth.js';
import {
    attachActionListeners,
    attachExitGuards,
    attachInputListeners,
    attachLayoutListeners,
    dismissQueueSensitiveDialog,
} from './boot/listeners.js';
import {
    closeSidebar,
    focusCurrentSearch,
    focusQuickCommand,
    isCompactViewport,
    navigateToSection,
    runQuickAction,
    toggleSidebarCollapsed,
    toggleSidebarOpen,
} from './boot/navigation.js';
import { refreshHeaderStatus } from './boot/rendering.js';
import {
    readInitialThemeMode,
    restoreUiPrefs,
    setThemeMode,
} from './boot/ui-prefs.js';

const ADMIN_PENDING_QUICK_ACTION_STORAGE_KEY = 'adminPendingQuickAction';

function consumePendingQuickAction() {
    try {
        const action =
            window.sessionStorage.getItem(
                ADMIN_PENDING_QUICK_ACTION_STORAGE_KEY
            ) || '';
        if (action) {
            window.sessionStorage.removeItem(
                ADMIN_PENDING_QUICK_ACTION_STORAGE_KEY
            );
        }
        return action;
    } catch (_error) {
        return '';
    }
}

export async function bootAdminV3() {
    try {
        renderV3Frame();
        bindFrameHooks();
        document.body.classList.add('admin-v3-mode');
        document.body.classList.remove('admin-v2-mode');
        document.body.dataset.opsFamily = 'command';
        attachActionListeners();
        hydrateAppointmentPreferences();
        hydrateCallbacksPreferences();
        hydrateAvailabilityPreferences();
        restoreUiPrefs();
        applyQueueRuntimeDefaults();
        bootStaffSection();
        bootServicesSection();
        bootBrandingSection();
        bootDomainSection();

        if (
            window.PielOpsTheme &&
            typeof window.PielOpsTheme.initAutoOpsTheme === 'function'
        ) {
            window.PielOpsTheme.initAutoOpsTheme({
                surface: 'admin',
                family: 'command',
            });
        }

        const initialTheme =
            window.PielOpsTheme &&
            typeof window.PielOpsTheme.isAdminQueueSurface === 'function' &&
            window.PielOpsTheme.isAdminQueueSurface()
                ? 'system'
                : readInitialThemeMode();
        setThemeMode(initialTheme, { persist: false });
        primeLoginSurface();

        attachInputListeners();
        attachLayoutListeners();
        attachExitGuards();

        const loginForm = document.getElementById('loginForm');
        if (loginForm instanceof HTMLFormElement) {
            loginForm.addEventListener('submit', handleLoginSubmit);
        }

        attachKeyboardShortcuts({
            navigateToSection,
            focusQuickCommand,
            focusAgentPrompt,
            focusCurrentSearch,
            runQuickAction,
            closeSidebar: () => closeSidebar({ restoreFocus: true }),
            toggleMenu: () => {
                if (isCompactViewport()) {
                    toggleSidebarOpen();
                    return;
                }
                toggleSidebarCollapsed();
            },
            dismissQueueSensitiveDialog,
            queueNumpadAction,
            toggleQueueHelp: toggleQueueHelpPanel,
        });

        await checkAuthStatus();
        if (getState().auth.authenticated) {
            await bootAuthenticatedUi();
            setActiveSection(getState().ui.activeSection);
            const pendingQuickAction = consumePendingQuickAction();
            if (pendingQuickAction) {
                await runQuickAction(pendingQuickAction);
            }
        } else {
            showLoginView();
            hideCommandPalette();
            primeLoginSurface();
            resumeOpenClawPolling();
        }

        initPushModule();
        initQueueAutoRefresh();
        initSessionInactivityTimer();

        window.setInterval(() => {
            refreshHeaderStatus();
        }, 30000);
        
        document.documentElement.setAttribute('data-admin-ready', 'true');
    } catch (err) {
        console.error('FATAL BOOT ERROR:', err);
        // Ensure the timeout fallback triggers but we can see the error
        document.documentElement.setAttribute('data-admin-ready', 'true');
    }
}
