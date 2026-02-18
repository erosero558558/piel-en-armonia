(function () {
    'use strict';

    let deps = null;
    let initialized = false;
    let escapeListenerBound = false;

    function closeModalElement(modal) {
        if (!modal) {
            return;
        }

        if (modal.id === 'paymentModal') {
            if (deps && typeof deps.closePaymentModal === 'function') {
                deps.closePaymentModal();
            }
            return;
        }

        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function bindBackdropClose() {
        document.querySelectorAll('.modal').forEach((modal) => {
            if (modal.dataset.modalUxBackdropBound === 'true') {
                return;
            }
            modal.dataset.modalUxBackdropBound = 'true';
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    closeModalElement(this);
                }
            });
        });
    }

    function bindEscapeClose() {
        if (escapeListenerBound) {
            return;
        }
        escapeListenerBound = true;

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') {
                return;
            }

            document.querySelectorAll('.modal').forEach((modal) => {
                if (modal.id === 'paymentModal' && modal.classList.contains('active')) {
                    if (deps && typeof deps.closePaymentModal === 'function') {
                        deps.closePaymentModal();
                    }
                    return;
                }
                modal.classList.remove('active');
            });

            document.body.style.overflow = '';
            if (deps && typeof deps.toggleMobileMenu === 'function') {
                deps.toggleMobileMenu(false);
            }
        });
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        bindBackdropClose();
        bindEscapeClose();
        initialized = true;
        return window.PielModalUxEngine;
    }

    function isInitialized() {
        return initialized;
    }

    window.PielModalUxEngine = {
        init,
        isInitialized
    };
})();
