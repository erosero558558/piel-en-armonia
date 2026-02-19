import { loadDeferredModule, runDeferredModule, withDeferredModule } from './loader.js';
import { apiRequest } from './api.js';
import { loadAvailabilityData, getBookedSlots, invalidateBookedSlotsCache } from './booking.js';
import { showToast, escapeHtml } from './utils.js';
import { getCurrentLang } from './state.js';
import { DEFAULT_TIME_SLOTS } from './config.js';

const RESCHEDULE_ENGINE_URL = '/reschedule-engine.js?v=figo-reschedule-20260218-phase4';

function getRescheduleEngineDeps() {
    return {
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: getCurrentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice()
    };
}

export function loadRescheduleEngine() {
    return loadDeferredModule({
        cacheKey: 'reschedule-engine',
        src: RESCHEDULE_ENGINE_URL,
        scriptDataAttribute: 'data-reschedule-engine',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar reschedule-engine.js',
        logLabel: 'Reschedule engine'
    });
}

export function initRescheduleEngineWarmup() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('reschedule')) {
        return;
    }

    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.checkRescheduleParam(),
        () => {
            showToast(getCurrentLang() === 'es' ? 'No se pudo cargar la reprogramacion.' : 'Unable to load reschedule flow.', 'error');
        }
    );
}

export async function checkRescheduleParam() {
    return withDeferredModule(loadRescheduleEngine, (engine) => engine.checkRescheduleParam());
}

export function openRescheduleModal(appt) {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.openRescheduleModal(appt));
}

export function closeRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) {
        modal.classList.remove('active');
    }

    runDeferredModule(loadRescheduleEngine, (engine) => engine.closeRescheduleModal());
}

export function loadRescheduleSlots() {
    return runDeferredModule(loadRescheduleEngine, (engine) => engine.loadRescheduleSlots());
}

export function submitReschedule() {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.submitReschedule(), () => {
        showToast(getCurrentLang() === 'es' ? 'No se pudo reprogramar en este momento.' : 'Unable to reschedule right now.', 'error');
    });
}
