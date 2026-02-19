/**
 * App bootstrap engine (deferred-loaded).
 * Centralizes DOMContentLoaded initialization and warmup wiring.
 */
(function () {
    'use strict';

    let deps = null;
    let started = false;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielAppBootstrapEngine;
    }

    function callDep(name) {
        if (!deps) {
            return undefined;
        }
        const fn = deps[name];
        if (typeof fn !== 'function') {
            return undefined;
        }
        const args = Array.prototype.slice.call(arguments, 1);
        return fn.apply(null, args);
    }

    function bindSmoothScroll() {
        const nav = document.querySelector('.nav');

        document.addEventListener('click', (event) => {
            const targetEl = event.target instanceof Element ? event.target : null;
            if (!targetEl) return;

            const anchor = targetEl.closest('a[href^="#"]');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            event.preventDefault();
            const navHeight = nav ? nav.offsetHeight : 0;
            const targetPosition = target.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    }

    function bindChatHandoffTracking() {
        document.addEventListener('click', (event) => {
            const targetEl = event.target instanceof Element ? event.target : null;
            if (!targetEl) return;

            const waLink = targetEl.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
            if (!waLink) return;

            const inChatContext = !!waLink.closest('#chatbotContainer') || !!waLink.closest('#chatbotWidget');
            if (!inChatContext) return;

            callDep('trackEvent', 'chat_handoff_whatsapp', {
                source: 'chatbot'
            });
        });
    }

    function onReady() {
        callDep('disablePlaceholderExternalLinks');
        callDep('initActionRouterEngine');
        callDep('initDeferredStylesheetLoading');
        callDep('initThemeMode');

        const lang = callDep('getCurrentLang') || 'es';
        callDep('changeLanguage', lang);
        callDep('initCookieBanner');
        callDep('initGA4');
        callDep('initBookingFunnelObserver');
        callDep('initDeferredSectionPrefetch');
        bindSmoothScroll();
        bindChatHandoffTracking();

        const initDeferredWarmups = callDep('createOnceTask', () => {
            callDep('initEnglishBundleWarmup');
            callDep('initStorageGatewayEngineWarmup');
            callDep('initDataEngineWarmup');
            callDep('initDataGatewayEngineWarmup');
            callDep('initAnalyticsGatewayEngineWarmup');
            callDep('initBookingEngineWarmup');
            callDep('initBookingMediaEngineWarmup');
            callDep('initPaymentGatewayEngineWarmup');
            callDep('initBookingUiWarmup');
            callDep('initReviewsEngineWarmup');
            callDep('initGalleryInteractionsWarmup');
            callDep('initChatUiEngineWarmup');
            callDep('initChatWidgetEngineWarmup');
            callDep('initChatEngineWarmup');
            callDep('initChatBookingEngineWarmup');
            callDep('initUiEffectsWarmup');
            callDep('initRescheduleEngineWarmup');
            callDep('initSuccessModalEngineWarmup');
            callDep('initEngagementFormsEngineWarmup');
            callDep('initModalUxEngineWarmup');
        });

        if (typeof initDeferredWarmups === 'function') {
            window.addEventListener('pointerdown', initDeferredWarmups, { once: true, passive: true });
            window.addEventListener('keydown', initDeferredWarmups, { once: true });

            callDep('scheduleDeferredTask', initDeferredWarmups, {
                idleTimeout: 1100,
                fallbackDelay: 320,
                skipOnConstrained: false,
                constrainedDelay: 900
            });
        }

        const chatInput = document.getElementById('chatInput');
        if (chatInput && deps && typeof deps.handleChatKeypress === 'function') {
            chatInput.addEventListener('keypress', deps.handleChatKeypress);
        }

        if (deps && typeof deps.maybeTrackCheckoutAbandon === 'function') {
            window.addEventListener('pagehide', () => {
                deps.maybeTrackCheckoutAbandon('page_hide');
            });
        }

        if (window.location.protocol === 'file:') {
            setTimeout(() => {
                callDep(
                    'showToast',
                    'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                    'warning',
                    'Servidor requerido'
                );
            }, 2000);
            console.warn('Chatbot en modo offline: abre el sitio desde servidor para usar IA real.');
        }
    }

    function start() {
        if (started) {
            return;
        }
        started = true;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady, { once: true });
            return;
        }

        onReady();
    }

    window.PielAppBootstrapEngine = {
        init,
        start
    };
})();
