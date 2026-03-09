import { normalizeSection, setSectionHash } from '../../shared/core/router.js';
import { getState, updateState } from '../../shared/core/store.js';
import { qs } from '../../shared/ui/render.js';
import {
    hideCommandPalette,
    renderAdminChrome,
    setActiveSection,
    showCommandPalette,
} from '../../ui/frame.js';
import {
    setAppointmentFilter,
    setAppointmentSearch,
} from '../../sections/appointments.js';
import { setCallbacksFilter } from '../../sections/callbacks.js';
import { hasPendingAvailabilityChanges } from '../../sections/availability.js';
import {
    callNextForConsultorio,
    refreshQueueState,
    setQueueFilter,
    shouldRefreshQueueOnSectionEnter,
} from '../../shared/modules/queue.js';
import {
    isCompactViewport,
    persistUiPrefs,
    renderSidebarState,
} from './ui-prefs.js';

export function showSection(section) {
    const normalized = normalizeSection(section, 'dashboard');
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: normalized,
        },
    }));
    setActiveSection(normalized);
    renderAdminChrome(getState());
    setSectionHash(normalized);
    persistUiPrefs();
}

export async function navigateToSection(section, options = {}) {
    const normalized = normalizeSection(section, 'dashboard');
    const { force = false } = options;
    const previousSection = getState().ui.activeSection;

    if (
        !force &&
        getState().ui.activeSection === 'availability' &&
        normalized !== 'availability'
    ) {
        if (hasPendingAvailabilityChanges()) {
            const confirmed = window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            );
            if (!confirmed) return false;
        }
    }

    showSection(normalized);
    if (
        normalized === 'queue' &&
        previousSection !== 'queue' &&
        shouldRefreshQueueOnSectionEnter()
    ) {
        await refreshQueueState();
    }

    return true;
}

export function toggleSidebarCollapsed() {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarCollapsed: !state.ui.sidebarCollapsed,
            sidebarOpen: state.ui.sidebarOpen,
        },
    }));

    renderSidebarState();
    persistUiPrefs();
}

export function toggleSidebarOpen() {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarOpen: !state.ui.sidebarOpen,
        },
    }));

    renderSidebarState();
}

export function closeSidebar({ restoreFocus = false } = {}) {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarOpen: false,
        },
    }));

    renderSidebarState();
    hideCommandPalette();

    if (restoreFocus) {
        const toggle = qs('#adminMenuToggle');
        if (toggle instanceof HTMLElement) {
            toggle.focus();
        }
    }
}

export function focusQuickCommand() {
    showCommandPalette();
    const input = document.getElementById('adminQuickCommand');
    if (input instanceof HTMLInputElement) input.focus();
}

export function focusCurrentSearch() {
    const section = getState().ui.activeSection;
    if (section === 'appointments') {
        const input = document.getElementById('searchAppointments');
        if (input instanceof HTMLInputElement) input.focus();
        return;
    }
    if (section === 'callbacks') {
        const input = document.getElementById('searchCallbacks');
        if (input instanceof HTMLInputElement) input.focus();
        return;
    }
    if (section === 'queue') {
        const input = document.getElementById('queueSearchInput');
        if (input instanceof HTMLInputElement) input.focus();
    }
}

export async function runQuickAction(action) {
    switch (action) {
        case 'appointments_pending_transfer':
            await navigateToSection('appointments');
            setAppointmentFilter('pending_transfer');
            setAppointmentSearch('');
            break;
        case 'appointments_all':
            await navigateToSection('appointments');
            setAppointmentFilter('all');
            setAppointmentSearch('');
            break;
        case 'appointments_no_show':
            await navigateToSection('appointments');
            setAppointmentFilter('no_show');
            setAppointmentSearch('');
            break;
        case 'callbacks_pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            break;
        case 'callbacks_contacted':
            await navigateToSection('callbacks');
            setCallbacksFilter('contacted');
            break;
        case 'callbacks_sla_urgent':
            await navigateToSection('callbacks');
            setCallbacksFilter('sla_urgent');
            break;
        case 'queue_sla_risk':
            await navigateToSection('queue');
            setQueueFilter('sla_risk');
            break;
        case 'queue_waiting':
            await navigateToSection('queue');
            setQueueFilter('waiting');
            break;
        case 'queue_called':
            await navigateToSection('queue');
            setQueueFilter('called');
            break;
        case 'queue_no_show':
            await navigateToSection('queue');
            setQueueFilter('no_show');
            break;
        case 'queue_all':
            await navigateToSection('queue');
            setQueueFilter('all');
            break;
        case 'queue_call_next':
            await navigateToSection('queue');
            await callNextForConsultorio(getState().queue.stationConsultorio);
            break;
        default:
            break;
    }
}

export function parseQuickCommand(value) {
    const command = String(value || '')
        .trim()
        .toLowerCase();
    if (!command) return null;
    if (command.includes('callbacks') && command.includes('pend')) {
        return 'callbacks_pending';
    }
    if (
        command.includes('callback') &&
        (command.includes('urg') || command.includes('sla'))
    ) {
        return 'callbacks_sla_urgent';
    }
    if (command.includes('citas') && command.includes('transfer')) {
        return 'appointments_pending_transfer';
    }
    if (command.includes('queue') || command.includes('cola')) {
        return 'queue_sla_risk';
    }
    if (command.includes('no show')) {
        return 'appointments_no_show';
    }
    return null;
}

export { isCompactViewport };
