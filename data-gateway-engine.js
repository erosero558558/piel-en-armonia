/**
 * Data gateway engine (deferred-loaded).
 * Provides a stable facade for data-engine operations used by script.js.
 */
(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielDataGatewayEngine;
    }

    function getDirectDataEngine() {
        if (deps && typeof deps.getDataEngine === 'function') {
            const dataEngine = deps.getDataEngine();
            if (dataEngine && typeof dataEngine === 'object') {
                return dataEngine;
            }
        }
        return null;
    }

    function loadDataEngineModule() {
        if (deps && typeof deps.loadDataEngine === 'function') {
            return Promise.resolve(deps.loadDataEngine());
        }

        const direct = getDirectDataEngine();
        if (direct) {
            return Promise.resolve(direct);
        }

        return Promise.reject(new Error('DataGatewayEngine dependency missing: loadDataEngine'));
    }

    function callDataMethod(engine, methodName, args) {
        if (!engine || typeof engine[methodName] !== 'function') {
            throw new Error(`DataGatewayEngine method unavailable: ${methodName}`);
        }
        return engine[methodName].apply(engine, Array.isArray(args) ? args : []);
    }

    function withDataEngine(methodName, args) {
        return loadDataEngineModule().then((engine) => callDataMethod(engine, methodName, args));
    }

    function apiRequest(resource, options = {}) {
        return withDataEngine('apiRequest', [resource, options]);
    }

    function invalidateBookedSlotsCache(date = '', doctor = '') {
        const direct = getDirectDataEngine();
        if (direct && typeof direct.invalidateBookedSlotsCache === 'function') {
            direct.invalidateBookedSlotsCache(date, doctor);
            return;
        }

        withDataEngine('invalidateBookedSlotsCache', [date, doctor]).catch(() => undefined);
    }

    function loadAvailabilityData(options = {}) {
        return withDataEngine('loadAvailabilityData', [options]);
    }

    function getBookedSlots(date, doctor = '') {
        return withDataEngine('getBookedSlots', [date, doctor]);
    }

    function createAppointmentRecord(appointment, options = {}) {
        return withDataEngine('createAppointmentRecord', [appointment, options]);
    }

    function createCallbackRecord(callback) {
        return withDataEngine('createCallbackRecord', [callback]);
    }

    function createReviewRecord(review) {
        return withDataEngine('createReviewRecord', [review]);
    }

    function uploadTransferProof(file, options = {}) {
        return withDataEngine('uploadTransferProof', [file, options]);
    }

    window.PielDataGatewayEngine = {
        init,
        apiRequest,
        invalidateBookedSlotsCache,
        loadAvailabilityData,
        getBookedSlots,
        createAppointmentRecord,
        createCallbackRecord,
        createReviewRecord,
        uploadTransferProof
    };
})();
