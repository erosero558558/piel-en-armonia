import { withDeployAssetVersion, showToast, escapeHtml } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { state } from './state.js';
import { DEFAULT_TIME_SLOTS } from './config.js';
import { apiRequest, loadAvailabilityData, getBookedSlots, invalidateBookedSlotsCache } from './data.js';

const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');

function getRescheduleEngineDeps() {
    return {
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: () => state.currentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice()
    };
}

export function loadRescheduleEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar reschedule-engine (booking-utils)',
        logLabel: 'Reschedule engine'
    });
}

export function initRescheduleEngineWarmup() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.initRescheduleFromParam(),
        () => {
            showToast(state.currentLang === 'es' ? 'No se pudo cargar la reprogramacion.' : 'Unable to load reschedule flow.', 'error');
        }
    );
}

export function closeRescheduleModal() {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.closeRescheduleModal(), () => {
        const modal = document.getElementById('rescheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }
    });
}

export function submitReschedule() {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.submitReschedule(), () => {
        showToast(getCurrentLang() === 'es' ? 'No se pudo reprogramar en este momento.' : 'Unable to reschedule right now.', 'error');
    });
}
