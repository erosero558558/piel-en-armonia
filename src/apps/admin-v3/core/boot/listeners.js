import { readSectionFromHash } from '../../shared/core/router.js';
import { getState } from '../../shared/core/store.js';
import { createToast, qs } from '../../shared/ui/render.js';
import {
    hideCommandPalette,
    showCommandPalette,
    showLoginView,
} from '../../ui/frame.js';
import { logoutSession } from '../../shared/modules/auth.js';
import {
    approveTransfer,
    cancelAppointment,
    clearAppointmentFilters,
    exportAppointmentsCsv,
    markNoShow,
    rejectTransfer,
    setAppointmentDensity,
    setAppointmentFilter,
    setAppointmentSearch,
    setAppointmentSort,
} from '../../sections/appointments.js';
import {
    clearCallbacksFilters,
    clearCallbacksSelection,
    focusNextPendingCallback,
    markCallbackContacted,
    markSelectedCallbacksContacted,
    selectVisibleCallbacks,
    setCallbacksFilter,
    setCallbacksSearch,
    setCallbacksSort,
} from '../../sections/callbacks.js';
import {
    addAvailabilitySlot,
    changeAvailabilityMonth,
    clearAvailabilityDay,
    clearAvailabilityWeek,
    copyAvailabilityDay,
    discardAvailabilityDraft,
    duplicateAvailabilityDay,
    hasPendingAvailabilityChanges,
    jumpAvailabilityNextWithSlots,
    jumpAvailabilityPrevWithSlots,
    jumpAvailabilityToday,
    pasteAvailabilityDay,
    prefillAvailabilityTime,
    removeAvailabilitySlot,
    saveAvailabilityDraft,
    selectAvailabilityDate,
} from '../../sections/availability.js';
import {
    beginQueueCallKeyCapture,
    callNextForConsultorio,
    cancelQueueSensitiveAction,
    clearQueueCallKeyBinding,
    clearQueueSearch,
    clearQueueSelection,
    confirmQueueSensitiveAction,
    dismissQueueSensitiveDialog,
    refreshQueueState,
    reprintQueueTicket,
    runQueueBulkAction,
    runQueueBulkReprint,
    runQueueReleaseStation,
    runQueueTicketAction,
    selectVisibleQueueTickets,
    setQueueFilter,
    setQueuePracticeMode,
    setQueueSearch,
    setQueueStationLock,
    setQueueStationMode,
    toggleQueueHelpPanel,
    toggleQueueOneTap,
    toggleQueueTicketSelection,
} from '../../shared/modules/queue.js';
import { primeLoginSurface, resetTwoFactorStage } from './auth.js';
import {
    closeSidebar,
    focusQuickCommand,
    isCompactViewport,
    navigateToSection,
    parseQuickCommand,
    runQuickAction,
    toggleSidebarCollapsed,
    toggleSidebarOpen,
} from './navigation.js';
import { refreshDataAndRender } from './rendering.js';
import {
    getCompactSidebarFocusables,
    renderSidebarState,
    setThemeMode,
} from './ui-prefs.js';

function attachQuickCommandInput(input) {
    input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const action = parseQuickCommand(input.value);
        if (action) {
            await runQuickAction(action);
        }
    });
}

export function attachInputListeners() {
    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter instanceof HTMLSelectElement) {
        appointmentFilter.addEventListener('change', () => {
            setAppointmentFilter(appointmentFilter.value);
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort instanceof HTMLSelectElement) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value);
        });
    }

    const searchAppointments = document.getElementById('searchAppointments');
    if (searchAppointments instanceof HTMLInputElement) {
        searchAppointments.addEventListener('input', () => {
            setAppointmentSearch(searchAppointments.value);
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter instanceof HTMLSelectElement) {
        callbackFilter.addEventListener('change', () => {
            setCallbacksFilter(callbackFilter.value);
        });
    }

    const callbackSort = document.getElementById('callbackSort');
    if (callbackSort instanceof HTMLSelectElement) {
        callbackSort.addEventListener('change', () => {
            setCallbacksSort(callbackSort.value);
        });
    }

    const searchCallbacks = document.getElementById('searchCallbacks');
    if (searchCallbacks instanceof HTMLInputElement) {
        searchCallbacks.addEventListener('input', () => {
            setCallbacksSearch(searchCallbacks.value);
        });
    }

    const searchQueue = document.getElementById('queueSearchInput');
    if (searchQueue instanceof HTMLInputElement) {
        searchQueue.addEventListener('input', () => {
            setQueueSearch(searchQueue.value);
        });
    }

    const quickCommand = document.getElementById('adminQuickCommand');
    if (quickCommand instanceof HTMLInputElement) {
        attachQuickCommandInput(quickCommand);
    }
}

async function handleAction(action, element) {
    switch (action) {
        case 'close-toast':
            element.closest('.toast')?.remove();
            return;
        case 'set-admin-theme':
            setThemeMode(String(element.dataset.themeMode || 'system'), {
                persist: true,
            });
            return;
        case 'toggle-sidebar-collapse':
            toggleSidebarCollapsed();
            return;
        case 'refresh-admin-data':
            await refreshDataAndRender(true);
            return;
        case 'run-admin-command': {
            const input = document.getElementById('adminQuickCommand');
            if (input instanceof HTMLInputElement) {
                const parsed = parseQuickCommand(input.value);
                if (parsed) {
                    await runQuickAction(parsed);
                    input.value = '';
                    hideCommandPalette();
                }
            }
            return;
        }
        case 'open-command-palette':
            showCommandPalette();
            focusQuickCommand();
            return;
        case 'close-command-palette':
            hideCommandPalette();
            return;
        case 'logout':
            await logoutSession();
            showLoginView();
            hideCommandPalette();
            primeLoginSurface();
            createToast('Sesion cerrada', 'info');
            return;
        case 'reset-login-2fa':
            resetTwoFactorStage();
            return;
        case 'appointment-quick-filter':
            setAppointmentFilter(String(element.dataset.filterValue || 'all'));
            return;
        case 'clear-appointment-filters':
            clearAppointmentFilters();
            return;
        case 'appointment-density':
            setAppointmentDensity(
                String(element.dataset.density || 'comfortable')
            );
            return;
        case 'approve-transfer':
            await approveTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia aprobada', 'success');
            return;
        case 'reject-transfer':
            await rejectTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia rechazada', 'warning');
            return;
        case 'mark-no-show':
            await markNoShow(Number(element.dataset.id || 0));
            createToast('Marcado como no show', 'warning');
            return;
        case 'cancel-appointment':
            await cancelAppointment(Number(element.dataset.id || 0));
            createToast('Cita cancelada', 'warning');
            return;
        case 'export-csv':
            exportAppointmentsCsv();
            return;
        case 'callback-quick-filter':
            setCallbacksFilter(String(element.dataset.filterValue || 'all'));
            return;
        case 'clear-callback-filters':
            clearCallbacksFilters();
            return;
        case 'callbacks-triage-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return;
        case 'mark-contacted':
            await markCallbackContacted(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.callbackDate || '')
            );
            createToast('Callback actualizado', 'success');
            return;
        case 'change-month':
            changeAvailabilityMonth(Number(element.dataset.delta || 0));
            return;
        case 'availability-today':
        case 'context-availability-today':
            jumpAvailabilityToday();
            return;
        case 'availability-prev-with-slots':
            jumpAvailabilityPrevWithSlots();
            return;
        case 'availability-next-with-slots':
        case 'context-availability-next':
            jumpAvailabilityNextWithSlots();
            return;
        case 'select-availability-day':
            selectAvailabilityDate(String(element.dataset.date || ''));
            return;
        case 'prefill-time-slot':
            prefillAvailabilityTime(String(element.dataset.time || ''));
            return;
        case 'add-time-slot':
            addAvailabilitySlot();
            return;
        case 'remove-time-slot':
            removeAvailabilitySlot(
                decodeURIComponent(String(element.dataset.date || '')),
                decodeURIComponent(String(element.dataset.time || ''))
            );
            return;
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            copyAvailabilityDay();
            return;
        case 'paste-availability-day':
            pasteAvailabilityDay();
            return;
        case 'duplicate-availability-day-next':
            duplicateAvailabilityDay(1);
            return;
        case 'duplicate-availability-next-week':
            duplicateAvailabilityDay(7);
            return;
        case 'clear-availability-day':
            clearAvailabilityDay();
            return;
        case 'clear-availability-week':
            clearAvailabilityWeek();
            return;
        case 'save-availability-draft':
            await saveAvailabilityDraft();
            createToast('Disponibilidad guardada', 'success');
            return;
        case 'discard-availability-draft':
            discardAvailabilityDraft();
            createToast('Borrador descartado', 'info');
            return;
        case 'queue-refresh-state':
            await refreshQueueState();
            return;
        case 'queue-call-next':
            await callNextForConsultorio(
                Number(element.dataset.queueConsultorio || 0)
            );
            return;
        case 'queue-release-station':
            await runQueueReleaseStation(
                Number(element.dataset.queueConsultorio || 0)
            );
            return;
        case 'queue-toggle-ticket-select':
            toggleQueueTicketSelection(Number(element.dataset.queueId || 0));
            return;
        case 'queue-select-visible':
            selectVisibleQueueTickets();
            return;
        case 'queue-clear-selection':
            clearQueueSelection();
            return;
        case 'queue-ticket-action':
            await runQueueTicketAction(
                Number(element.dataset.queueId || 0),
                String(element.dataset.queueAction || ''),
                Number(element.dataset.queueConsultorio || 0)
            );
            return;
        case 'queue-reprint-ticket':
            await reprintQueueTicket(Number(element.dataset.queueId || 0));
            return;
        case 'queue-bulk-action':
            await runQueueBulkAction(
                String(element.dataset.queueAction || 'no_show')
            );
            return;
        case 'queue-bulk-reprint':
            await runQueueBulkReprint();
            return;
        case 'queue-clear-search':
            clearQueueSearch();
            return;
        case 'queue-toggle-shortcuts':
            toggleQueueHelpPanel();
            return;
        case 'queue-toggle-one-tap':
            toggleQueueOneTap();
            return;
        case 'queue-start-practice':
            setQueuePracticeMode(true);
            return;
        case 'queue-stop-practice':
            setQueuePracticeMode(false);
            return;
        case 'queue-lock-station':
            setQueueStationLock(Number(element.dataset.queueConsultorio || 1));
            return;
        case 'queue-set-station-mode':
            setQueueStationMode(String(element.dataset.queueMode || 'free'));
            return;
        case 'queue-sensitive-confirm':
            await confirmQueueSensitiveAction();
            return;
        case 'queue-sensitive-cancel':
            cancelQueueSensitiveAction();
            return;
        case 'queue-capture-call-key':
            beginQueueCallKeyCapture();
            return;
        case 'queue-clear-call-key':
            clearQueueCallKeyBinding();
            return;
        case 'callbacks-bulk-select-visible':
            selectVisibleCallbacks();
            return;
        case 'callbacks-bulk-clear':
            clearCallbacksSelection();
            return;
        case 'callbacks-bulk-mark':
            await markSelectedCallbacksContacted();
            return;
        case 'context-open-appointments-transfer':
            await navigateToSection('appointments');
            setAppointmentFilter('pending_transfer');
            return;
        case 'context-open-callbacks-pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            return;
        case 'context-open-callbacks-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return;
        case 'context-open-dashboard':
            await navigateToSection('dashboard');
            return;
        default:
            break;
    }
}

export function attachActionListeners() {
    document.addEventListener('click', async (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!target) return;
        const action = String(target.getAttribute('data-action') || '');
        if (!action) return;

        event.preventDefault();

        try {
            await handleAction(action, target);
        } catch (error) {
            createToast(error?.message || 'Error ejecutando accion', 'error');
        }
    });

    document.addEventListener('click', async (event) => {
        const nav =
            event.target instanceof Element
                ? event.target.closest('[data-section]')
                : null;
        if (!nav) return;

        const isQuickNav = nav.classList.contains('admin-quick-nav-item');
        const isSidebarNav = nav.classList.contains('nav-item');
        if (!isQuickNav && !isSidebarNav) return;

        event.preventDefault();
        const navigated = await navigateToSection(
            String(nav.getAttribute('data-section') || 'dashboard')
        );

        if (isCompactViewport() && navigated !== false) {
            closeSidebar();
        }
    });

    document.addEventListener('click', (event) => {
        const queueFilterBtn =
            event.target instanceof Element
                ? event.target.closest('[data-queue-filter]')
                : null;
        if (!queueFilterBtn) return;
        event.preventDefault();
        setQueueFilter(
            String(queueFilterBtn.getAttribute('data-queue-filter') || 'all')
        );
    });

    const callbacksBulkSelect = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (callbacksBulkSelect) {
        callbacksBulkSelect.setAttribute(
            'data-action',
            'callbacks-bulk-select-visible'
        );
    }

    const callbacksBulkClear = document.getElementById('callbacksBulkClearBtn');
    if (callbacksBulkClear) {
        callbacksBulkClear.setAttribute('data-action', 'callbacks-bulk-clear');
    }

    const callbacksBulkMark = document.getElementById('callbacksBulkMarkBtn');
    if (callbacksBulkMark) {
        callbacksBulkMark.setAttribute('data-action', 'callbacks-bulk-mark');
    }
}

export function attachLayoutListeners() {
    const menuToggle = qs('#adminMenuToggle');
    const menuClose = qs('#adminMenuClose');
    const backdrop = qs('#adminSidebarBackdrop');

    menuToggle?.addEventListener('click', () => {
        if (isCompactViewport()) {
            toggleSidebarOpen();
            return;
        }
        toggleSidebarCollapsed();
    });

    menuClose?.addEventListener('click', () =>
        closeSidebar({ restoreFocus: true })
    );
    backdrop?.addEventListener('click', () =>
        closeSidebar({ restoreFocus: true })
    );

    window.addEventListener('resize', () => {
        if (!isCompactViewport()) {
            closeSidebar();
            return;
        }
        renderSidebarState();
    });

    document.addEventListener('keydown', (event) => {
        if (!isCompactViewport() || !getState().ui.sidebarOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeSidebar({ restoreFocus: true });
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = getCompactSidebarFocusables();
        if (!focusables.length) return;

        const currentIndex = focusables.indexOf(document.activeElement);
        if (event.shiftKey) {
            if (currentIndex === 0) {
                event.preventDefault();
                focusables[focusables.length - 1].focus();
            }
            return;
        }

        if (currentIndex === -1 || currentIndex === focusables.length - 1) {
            event.preventDefault();
            focusables[0].focus();
        }
    });

    window.addEventListener('hashchange', async () => {
        const section = readSectionFromHash(getState().ui.activeSection);
        await navigateToSection(section, { force: true });
    });

    window.addEventListener('storage', (event) => {
        if (event.key === 'themeMode') {
            setThemeMode(String(event.newValue || 'system'));
        }
    });
}

export function attachExitGuards() {
    window.addEventListener('beforeunload', (event) => {
        if (!hasPendingAvailabilityChanges()) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

export { dismissQueueSensitiveDialog };
