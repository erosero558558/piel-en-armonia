import { createOnceTask, scheduleDeferredTask } from './loader.js';
import {
    resolveDeployAssetVersion,
    withDeployAssetVersion,
    debugLog,
} from './utils.js';
import { initActionRouterEngine } from './router.js';
import { initThemeMode } from './theme.js';
import { changeLanguage, initEnglishBundleWarmup } from './i18n.js';
import { state } from './state.js';
import { initCookieBanner, initGA4 } from './cookies.js';
import {
    initBookingFunnelObserver,
    initDeferredSectionPrefetch,
    maybeTrackCheckoutAbandon,
    trackEvent,
} from './analytics.js';
import { initDataEngineWarmup } from './data.js';
import {
    initBookingEngineWarmup,
    initBookingUiWarmup,
    markBookingViewed,
} from './booking.js';
import { initReviewsEngineWarmup } from './engagement.js';
import { initGalleryInteractionsWarmup } from './gallery.js';
import {
    initChatUiEngineWarmup,
    initChatWidgetEngineWarmup,
    initChatEngineWarmup,
    initChatBookingEngineWarmup,
    handleChatKeypress,
    checkServerEnvironment,
} from './chat.js';
import { initUiEffectsWarmup, initModalUxEngineWarmup } from './ui.js';
import { initRescheduleEngineWarmup } from './reschedule.js';
import { initSuccessModalEngineWarmup } from './success-modal.js';
import { initEngagementFormsEngineWarmup } from './engagement.js';

// Setup global version
window.__PA_DEPLOY_ASSET_VERSION__ =
    window.__PA_DEPLOY_ASSET_VERSION__ || resolveDeployAssetVersion();

// Deferred Stylesheet
const DEFERRED_STYLESHEET_URL = withDeployAssetVersion(
    '/styles-deferred.css?v=ui-20260220-deferred15-cookiebannerfix1'
);
let deferredStylesheetPromise = null;
let deferredStylesheetInitDone = false;

function loadDeferredStylesheet() {
    if (
        document.querySelector(
            'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
        )
    ) {
        return Promise.resolve(true);
    }
    if (deferredStylesheetPromise) {
        return deferredStylesheetPromise;
    }
    deferredStylesheetPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = DEFERRED_STYLESHEET_URL;
        link.dataset.deferredStylesheet = 'true';
        link.onload = () => resolve(true);
        link.onerror = () =>
            reject(new Error('No se pudo cargar styles-deferred.css'));
        document.head.appendChild(link);
    }).catch((error) => {
        deferredStylesheetPromise = null;
        debugLog('Deferred stylesheet load failed:', error);
        throw error;
    });
    return deferredStylesheetPromise;
}

function initDeferredStylesheetLoading() {
    if (deferredStylesheetInitDone || window.location.protocol === 'file:') {
        return;
    }
    deferredStylesheetInitDone = true;
    const startLoad = () => {
        loadDeferredStylesheet().catch(() => undefined);
    };
    scheduleDeferredTask(startLoad, {
        idleTimeout: 1200,
        fallbackDelay: 160,
        skipOnConstrained: false,
        constrainedDelay: 900,
    });
}

function disablePlaceholderExternalLinks() {
    document.querySelectorAll('a[href^="URL_"]').forEach((anchor) => {
        anchor.removeAttribute('href');
        anchor.setAttribute('aria-disabled', 'true');
        anchor.classList.add('is-disabled-link');
    });
}

function resolveWhatsappSource(waLink) {
    if (!waLink || !(waLink instanceof Element)) return 'unknown';

    const chatContext = waLink.closest('#chatbotContainer, #chatbotWidget');
    if (chatContext) return 'chatbot';

    const section = waLink.closest(
        'section[id], footer[id], footer, .quick-contact-dock'
    );
    if (!section) return 'unknown';

    const sectionId = section.getAttribute('id') || '';
    if (sectionId) return sectionId;
    if (section.classList.contains('quick-contact-dock')) return 'quick_dock';
    if (section.tagName && section.tagName.toLowerCase() === 'footer')
        return 'footer';
    return 'unknown';
}

document.addEventListener('DOMContentLoaded', function () {
    disablePlaceholderExternalLinks();
    initActionRouterEngine();
    initDeferredStylesheetLoading();
    initThemeMode();
    changeLanguage(state.currentLang);
    initCookieBanner();
    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();

    const initHighPriorityWarmups = createOnceTask(() => {
        initEnglishBundleWarmup();
        initDataEngineWarmup();
        initBookingEngineWarmup();
        initBookingUiWarmup();
        initChatUiEngineWarmup();
        initChatWidgetEngineWarmup();
    });

    const initLowPriorityWarmups = createOnceTask(() => {
        initReviewsEngineWarmup();
        initGalleryInteractionsWarmup();
        initChatEngineWarmup();
        initChatBookingEngineWarmup();
        initUiEffectsWarmup();
        initRescheduleEngineWarmup();
        initSuccessModalEngineWarmup();
        initEngagementFormsEngineWarmup();
        initModalUxEngineWarmup();
    });

    window.addEventListener('pointerdown', initLowPriorityWarmups, {
        once: true,
        passive: true,
    });
    window.addEventListener('keydown', initLowPriorityWarmups, { once: true });

    scheduleDeferredTask(initHighPriorityWarmups, {
        idleTimeout: 1400,
        fallbackDelay: 500,
        skipOnConstrained: false,
        constrainedDelay: 900,
    });

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', handleChatKeypress);
    }

    window.addEventListener('pagehide', () => {
        maybeTrackCheckoutAbandon('page_hide');
    });

    const isServer = checkServerEnvironment();
    if (!isServer) {
        console.warn(
            'Chatbot en modo offline: abre el sitio desde servidor para usar IA real.'
        );
    }

    // Smooth Scroll
    const nav = document.querySelector('.nav');
    document.addEventListener('click', function (e) {
        const targetEl = e.target instanceof Element ? e.target : null;
        if (!targetEl) return;

        const anchor = targetEl.closest('a[href^="#"]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        const navHeight = nav ? nav.offsetHeight : 0;
        const targetPosition = target.offsetTop - navHeight - 20;

        if (href === '#citas') {
            markBookingViewed('cta_click');
        }

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
        });
    });

    // WhatsApp Analytics
    document.addEventListener('click', function (e) {
        const targetEl = e.target instanceof Element ? e.target : null;
        if (!targetEl) return;

        const waLink = targetEl.closest(
            'a[href*="wa.me"], a[href*="api.whatsapp.com"]'
        );
        if (!waLink) return;

        const source = resolveWhatsappSource(waLink);
        trackEvent('whatsapp_click', { source });

        const inChatContext =
            !!waLink.closest('#chatbotContainer') ||
            !!waLink.closest('#chatbotWidget');
        if (!inChatContext) return;

        trackEvent('chat_handoff_whatsapp', {
            source,
        });
    });
});

// Legacy: Gallery Lazy Loading
(function() {
    const galleryObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                const srcset = img.dataset.srcset;

                if (srcset) img.srcset = srcset;
                img.src = src;
                img.classList.add('loaded');

                galleryObserver.unobserve(img);
            }
        });
    }, { rootMargin: '200px' });

    document.querySelectorAll('.gallery-img[data-src]').forEach(img => {
        galleryObserver.observe(img);
    });
})();

// Booking Calendar Lazy Init
(function () {
    'use strict';

    function wireBookingCalendarLazyLoad(element) {
        if (!element) {
            return;
        }

        element.addEventListener('click', function () {
            const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');
            loadDeferredModule({
                cacheKey: 'booking-utils-calendar',
                src: BOOKING_UTILS_URL,
                scriptDataAttribute: 'data-booking-utils',
                resolveModule: () => window.PielBookingCalendarEngine
            }).then(function (moduleRef) {
                if (moduleRef && typeof moduleRef.initCalendar === 'function') {
                    moduleRef.initCalendar();
                }
            }).catch(function () {
                // noop
            });
        });
    }

    const bookingBtn = document.getElementById('booking-btn');
    wireBookingCalendarLazyLoad(bookingBtn);

    document.querySelectorAll('a[href="#citas"]').forEach(function (button) {
        if (button.id !== 'booking-btn') {
            wireBookingCalendarLazyLoad(button);
        }
    });
})();
