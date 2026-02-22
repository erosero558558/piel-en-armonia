import { withDeployAssetVersion, showToast, escapeHtml } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { getCurrentLang } from './state.js';
import { translate } from './i18n.js';
import {
    apiRequest,
    loadAvailabilityData,
    getBookedSlots,
    invalidateBookedSlotsCache,
} from './data.js';

const BOOKING_UTILS_URL = withDeployAssetVersion(
    '/js/engines/booking-utils.js?v=figo-booking-utils-20260220-unified'
);

function getRescheduleEngineDeps() {
    return {
        translate,
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: getCurrentLang,
    };
}

export function loadRescheduleEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar booking-utils.js (reschedule)',
        logLabel: 'Reschedule engine',
    });
}

export function initRescheduleEngineWarmup() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.checkRescheduleParam(),
        () => {
            showToast(
                translate('reschedule_load_failed_toast', 'No se pudo cargar la reprogramacion.'),
                'error'
            );
        }
    );
}

export function closeRescheduleModal() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.closeRescheduleModal(),
        () => {
            const modal = document.getElementById('rescheduleModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }
    );
}

export function submitReschedule() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.submitReschedule(),
        () => {
            showToast(
                translate('reschedule_submit_failed_toast', 'No se pudo reprogramar en este momento.'),
                'error'
            );
        }
    );
}
