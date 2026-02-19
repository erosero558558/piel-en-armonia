/**
 * UI bridge engine (deferred-loaded).
 * Centralizes modal/payment/review/reschedule wrapper actions.
 */
(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielUiBridgeEngine;
    }

    function callDep(name) {
        if (!deps || typeof deps[name] !== 'function') {
            return undefined;
        }
        const args = Array.prototype.slice.call(arguments, 1);
        return deps[name].apply(null, args);
    }

    function runDeferred(loader, onReady, onError) {
        if (!deps || typeof deps.runDeferredModule !== 'function' || typeof loader !== 'function') {
            if (typeof onError === 'function') {
                return onError(new Error('Deferred runtime unavailable'));
            }
            return undefined;
        }
        return deps.runDeferredModule(loader, onReady, onError);
    }

    function getLang() {
        if (deps && typeof deps.getCurrentLang === 'function') {
            return deps.getCurrentLang() || 'es';
        }
        return 'es';
    }

    function t(esText, enText) {
        return getLang() === 'es' ? esText : enText;
    }

    function openPaymentModal(appointmentData) {
        return runDeferred(
            deps.loadBookingEngine,
            (engine) => engine.openPaymentModal(appointmentData),
            (error) => {
                callDep('debugLog', 'openPaymentModal fallback error:', error);
                callDep('showToast', 'No se pudo abrir el modulo de pago.', 'error');
            }
        );
    }

    function closePaymentModal(options) {
        const settings = options && typeof options === 'object' ? options : {};

        if (window.PielBookingEngine && typeof window.PielBookingEngine.closePaymentModal === 'function') {
            window.PielBookingEngine.closePaymentModal(settings);
            return;
        }

        const skipAbandonTrack = settings.skipAbandonTrack === true;
        const abandonReason = typeof settings.reason === 'string' ? settings.reason : 'modal_close';
        if (!skipAbandonTrack) {
            callDep('maybeTrackCheckoutAbandon', abandonReason);
        }

        callDep('setCheckoutSessionActive', false);

        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function processPayment() {
        return runDeferred(
            deps.loadBookingEngine,
            (engine) => engine.processPayment(),
            (error) => {
                callDep('debugLog', 'processPayment error:', error);
                callDep('showToast', 'No se pudo procesar el pago en este momento.', 'error');
            }
        );
    }

    function showSuccessModal(emailSent) {
        return runDeferred(
            deps.loadSuccessModalEngine,
            (engine) => engine.showSuccessModal(emailSent === true),
            () => {
                callDep('showToast', 'No se pudo abrir la confirmacion de cita.', 'error');
            }
        );
    }

    function closeSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';

        runDeferred(
            deps.loadSuccessModalEngine,
            (engine) => engine.closeSuccessModal()
        );
    }

    function openReviewModal() {
        return runDeferred(
            deps.loadEngagementFormsEngine,
            (engine) => engine.openReviewModal(),
            () => {
                const modal = document.getElementById('reviewModal');
                if (modal) {
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        );
    }

    function closeReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';

        runDeferred(
            deps.loadEngagementFormsEngine,
            (engine) => engine.closeReviewModal()
        );
    }

    function closeRescheduleModal() {
        return runDeferred(
            deps.loadRescheduleGatewayEngine,
            (engine) => engine.closeRescheduleModal(),
            () => {
                const modal = document.getElementById('rescheduleModal');
                if (modal) {
                    modal.classList.remove('active');
                }
            }
        );
    }

    function submitReschedule() {
        return runDeferred(
            deps.loadRescheduleGatewayEngine,
            (engine) => engine.submitReschedule(),
            () => {
                callDep('showToast', t('No se pudo reprogramar en este momento.', 'Unable to reschedule right now.'), 'error');
            }
        );
    }

    window.PielUiBridgeEngine = {
        init,
        openPaymentModal,
        closePaymentModal,
        processPayment,
        showSuccessModal,
        closeSuccessModal,
        openReviewModal,
        closeReviewModal,
        closeRescheduleModal,
        submitReschedule
    };
})();
