import { withDeployAssetVersion, showToast, escapeHtml } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { getCurrentLang } from './state.js';
import { DEFAULT_TIME_SLOTS } from './config.js';
import {
    apiRequest,
    loadAvailabilityData,
    getBookedSlots,
    invalidateBookedSlotsCache,
} from './data.js';

const RESCHEDULE_GATEWAY_ENGINE_URL = withDeployAssetVersion(
    '/reschedule-gateway-engine.js?v=figo-reschedule-gateway-20260219-phase1'
);

function getRescheduleGatewayEngineDeps() {
    return {
        loadDeferredModule,
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: getCurrentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice(),
    };
}

export function loadRescheduleGatewayEngine() {
    return loadDeferredModule({
        cacheKey: 'reschedule-gateway-engine',
        src: RESCHEDULE_GATEWAY_ENGINE_URL,
        scriptDataAttribute: 'data-reschedule-gateway-engine',
        resolveModule: () => window.PielRescheduleGatewayEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) =>
            module.init(getRescheduleGatewayEngineDeps()),
        missingApiError: 'reschedule-gateway-engine loaded without API',
        loadError: 'No se pudo cargar reschedule-gateway-engine.js',
        logLabel: 'Reschedule gateway engine',
    });
}

export function initRescheduleEngineWarmup() {
    runDeferredModule(
        loadRescheduleGatewayEngine,
        (engine) => engine.initRescheduleFromParam(),
        () => {
            showToast(
                getCurrentLang() === 'es'
                    ? 'No se pudo cargar la reprogramacion.'
                    : 'Unable to load reschedule flow.',
                'error'
            );
        }
    );
}

export function closeRescheduleModal() {
    runDeferredModule(
        loadRescheduleGatewayEngine,
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
        loadRescheduleGatewayEngine,
        (engine) => engine.submitReschedule(),
        () => {
            showToast(
                getCurrentLang() === 'es'
                    ? 'No se pudo reprogramar en este momento.'
                    : 'Unable to reschedule right now.',
                'error'
            );
        }
    );
}
