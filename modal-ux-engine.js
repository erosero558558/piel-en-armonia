(function () {
    'use strict';

    let deps = null;
    let initialized = false;
    let escapeListenerBound = false;
    let backGestureBound = false;
    let isClosingViaBack = false;

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

    function setupBackGesture() {
        if (backGestureBound) {
            return;
        }
        backGestureBound = true;

        window.addEventListener('popstate', function () {
            isClosingViaBack = true;
            let closedAny = false;

            document.querySelectorAll('.modal.active').forEach((modal) => {
                closedAny = true;
                if (modal.id === 'paymentModal') {
                    if (deps && typeof deps.closePaymentModal === 'function') {
                        deps.closePaymentModal({ skipAbandonTrack: false, reason: 'back_gesture' });
                    }
                } else {
                    modal.classList.remove('active');
                }
            });

            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                closedAny = true;
                if (deps && typeof deps.toggleMobileMenu === 'function') {
                    deps.toggleMobileMenu(false);
                } else {
                    mobileMenu.classList.remove('active');
                }
            }

            if (closedAny) {
                document.body.style.overflow = '';
            }

            setTimeout(() => {
                isClosingViaBack = false;
            }, 50);
        });

        const observer = new MutationObserver((mutations) => {
            let opened = false;
            let closed = false;

            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active')) {
                        opened = true;
                    } else {
                        closed = true;
                    }
                }
            });

            if (opened) {
                if (!history.state || !history.state.modalOpen) {
                    history.pushState({ modalOpen: true }, '');
                }
            } else if (closed) {
                if (!isClosingViaBack && history.state && history.state.modalOpen) {
                    history.back();
                }
            }
        });

        document.querySelectorAll('.modal, #mobileMenu').forEach((el) => {
            observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        bindBackdropClose();
        bindEscapeClose();
        setupBackGesture();
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
