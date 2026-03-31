import {
    normalizeSection,
    setSectionHash,
} from '../../../shared/core/router.js';
import { getState, updateState } from '../../../shared/core/store.js';
import {
    applyQueueRuntimeDefaults,
    hydrateQueueFromData,
    refreshQueueState,
    shouldRefreshQueueOnSectionEnter,
    syncQueueAutoRefresh,
} from '../../../shared/modules/queue.js';
import { renderAdminChrome, setActiveSection } from '../../../ui/frame.js';
import { renderAppointmentsSection } from '../../../sections/appointments.js';
import { hasPendingAvailabilityChanges } from '../../../sections/availability.js';
import { openClinicalHistorySession } from '../../../sections/clinical-history.js';
import { renderGiftCardsSection } from '../../../sections/gift-cards.js';
import { renderSettingsSection } from '../../../sections/settings.js';
import { renderMultiClinicDashboard } from '../../../sections/multi-clinic.js';
import { renderWhatsappOpsDashboard } from '../../../sections/whatsapp-ops.js';
import {
    persistUiPrefs,
    readInitialThemeMode,
    setThemeMode,
} from '../ui-prefs.js';

function syncAdminThemeForSection(section) {
    const normalized = normalizeSection(section, 'queue');
    const nextTheme =
        normalized === 'queue' ? 'system' : readInitialThemeMode();
    setThemeMode(nextTheme, { persist: false });
}

export function showSection(section) {
    const normalized = normalizeSection(section, 'queue');
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: normalized,
        },
    }));
    setActiveSection(normalized);
    syncAdminThemeForSection(normalized);
    renderAdminChrome(getState());
    setSectionHash(normalized);
    persistUiPrefs();
}

function shouldConfirmAvailabilityExit(targetSection, force) {
    return (
        !force &&
        getState().ui.activeSection === 'availability' &&
        targetSection !== 'availability' &&
        hasPendingAvailabilityChanges()
    );
}

export async function navigateToSection(section, options = {}) {
    const normalized = normalizeSection(section, 'queue');
    const { force = false } = options;
    const previousSection = getState().ui.activeSection;

    if (shouldConfirmAvailabilityExit(normalized, force)) {
        const confirmed = window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        );
        if (!confirmed) return false;
    }

    showSection(normalized);
    syncQueueAutoRefresh({
        immediate: normalized === 'queue',
        reason: normalized === 'queue' ? 'section-enter' : 'section-exit',
    });
    if (
        normalized === 'queue' &&
        previousSection !== 'queue' &&
        shouldRefreshQueueOnSectionEnter()
    ) {
        await refreshQueueState();
    }
    if (normalized === 'clinical-history') {
        await openClinicalHistorySession();
    }
    if (normalized === 'appointments') {
        renderAppointmentsSection();
    }
    if (normalized === 'gift-cards') {
        renderGiftCardsSection();
    }
    if (normalized === 'multi-clinic') {
        renderMultiClinicDashboard(getState());
        focusFirstElement('multiClinicTableContainer');
        return;
    }
    if (normalized === 'whatsapp-ops') {
        renderWhatsappOpsDashboard();
        focusFirstElement('whatsappOpsContainer');
        return;
    }
    if (normalized === 'queue') {
        applyQueueRuntimeDefaults();
        await hydrateQueueFromData();
    }

    syncQueueAutoRefresh({
        immediate: normalized === 'queue' && shouldRefreshQueueOnSectionEnter(),
        reason:
            normalized === 'queue'
                ? previousSection === 'queue'
                    ? 'queue-section-refresh'
                    : 'queue-section-enter'
                : 'queue-section-leave',
    });

    return true;
}
