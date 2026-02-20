/**
 * Reschedule gateway engine (deferred-loaded).
 * Orchestrates lazy loading and safe execution of reschedule-engine actions.
 */
(function () {
    'use strict';

    const RESCHEDULE_ENGINE_URL =
        '/reschedule-engine.js?v=figo-reschedule-20260219-phase4-stateclass3';
    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielRescheduleGatewayEngine;
    }

    function getLang() {
        if (deps && typeof deps.getCurrentLang === 'function') {
            return deps.getCurrentLang() || 'es';
        }
        return 'es';
    }

    function showToastSafe(message, type) {
        if (deps && typeof deps.showToast === 'function') {
            deps.showToast(message, type || 'info');
        }
    }

    function loadDeferredModuleSafe(options) {
        if (!deps || typeof deps.loadDeferredModule !== 'function') {
            return Promise.reject(
                new Error('Missing dependency: loadDeferredModule')
            );
        }
        return deps.loadDeferredModule(options || {});
    }

    function getRescheduleEngineDeps() {
        return {
            apiRequest: deps.apiRequest,
            loadAvailabilityData: deps.loadAvailabilityData,
            getBookedSlots: deps.getBookedSlots,
            invalidateBookedSlotsCache: deps.invalidateBookedSlotsCache,
            showToast: deps.showToast,
            escapeHtml: deps.escapeHtml,
            getCurrentLang: deps.getCurrentLang,
            getDefaultTimeSlots: deps.getDefaultTimeSlots,
        };
    }

    function loadRescheduleEngine() {
        return loadDeferredModuleSafe({
            cacheKey: 'reschedule-engine',
            src: RESCHEDULE_ENGINE_URL,
            scriptDataAttribute: 'data-reschedule-engine',
            resolveModule: () => window.PielRescheduleEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
            missingApiError: 'reschedule-engine loaded without API',
            loadError: 'No se pudo cargar reschedule-engine.js',
            logLabel: 'Reschedule engine',
        });
    }

    function runRescheduleAction(actionName, onError) {
        return Promise.resolve(loadRescheduleEngine())
            .then((engine) => {
                if (!engine || typeof engine[actionName] !== 'function') {
                    throw new Error(`Invalid reschedule action: ${actionName}`);
                }
                return engine[actionName]();
            })
            .catch((error) => {
                if (typeof onError === 'function') {
                    onError(error);
                }
                return undefined;
            });
    }

    function initRescheduleFromParam() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('reschedule')) {
            return;
        }

        runRescheduleAction('checkRescheduleParam', () => {
            showToastSafe(
                getLang() === 'es'
                    ? 'No se pudo cargar la reprogramacion.'
                    : 'Unable to load reschedule flow.',
                'error'
            );
        });
    }

    function closeRescheduleModal() {
        const modal = document.getElementById('rescheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }

        runRescheduleAction('closeRescheduleModal');
    }

    function submitReschedule() {
        runRescheduleAction('submitReschedule', () => {
            showToastSafe(
                getLang() === 'es'
                    ? 'No se pudo reprogramar en este momento.'
                    : 'Unable to reschedule right now.',
                'error'
            );
        });
    }

    window.PielRescheduleGatewayEngine = {
        init,
        initRescheduleFromParam,
        closeRescheduleModal,
        submitReschedule,
    };
})();
