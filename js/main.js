import { createOnceTask, scheduleDeferredTask, loadDeferredModule } from './loader.js';
import {
    resolveDeployAssetVersion,
    withDeployAssetVersion,
    debugLog,
} from '../src/apps/shared/utils.js';
import { initActionRouterEngine } from './router.js';
import { initThemeMode } from './theme.js';
import { changeLanguage, initEnglishBundleWarmup } from './i18n.js';
import { state } from './state.js';
import { bootstrapConsent, showConsentBanner, initGA4 } from './cookies.js';
import {
    initBookingFunnelObserver,
    initDeferredSectionPrefetch,
    maybeTrackCheckoutAbandon,
    trackEvent,
} from './analytics.js';
import { initDataEngineWarmup } from './data.js';
// LAZY LOADED MODULES
// import { initBookingEngineWarmup, initBookingUiWarmup, markBookingViewed } from './booking.js';
// import { initReviewsEngineWarmup, initEngagementFormsEngineWarmup } from './engagement.js';
// import { initGalleryInteractionsWarmup } from './gallery.js';
// import { ... } from '../src/apps/chat/shell.js';
// import { initUiEffectsWarmup, initModalUxEngineWarmup } from './ui.js';
// import { initRescheduleEngineWarmup } from './reschedule.js';
// import { initSuccessModalEngineWarmup } from './success-modal.js';
import { loadDeferredContent } from './content-loader.js';

// Setup global version
window.Piel = window.Piel || {};
window.Piel.deployVersion =
    window.Piel.deployVersion || resolveDeployAssetVersion();

// Deferred Stylesheet
const DEFERRED_STYLESHEET_URL = withDeployAssetVersion(
    '/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1'
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

function initBookingCalendarLazyInit() {
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
}

function fallbackSelectService(value) {
    const select = document.getElementById('serviceSelect');
    if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change'));
        import('./booking.js').then(({ markBookingViewed }) => {
             markBookingViewed('service_select');
        });
        const appointmentSection = document.getElementById('citas');
        if (appointmentSection) {
            const navHeight = document.querySelector('.nav')?.offsetHeight || 80;
            const targetPosition = appointmentSection.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        }
    }
}

let chatActionFallbackBridgeBound = false;
function initChatActionFallbackBridge() {
    if (chatActionFallbackBridgeBound) {
        return;
    }
    chatActionFallbackBridgeBound = true;

    document.addEventListener('click', async function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = String(actionEl.getAttribute('data-action') || '').trim();
        const value = actionEl.getAttribute('data-value') || '';

        if ([
            'toggle-chatbot', 'minimize-chat', 'send-chat-message', 'quick-message',
            'chat-booking', 'start-booking'
        ].includes(action)) {
             event.preventDefault();
             event.stopImmediatePropagation();

             const chatShell = await import('../src/apps/chat/shell.js');
             switch (action) {
                case 'toggle-chatbot':
                    chatShell.toggleChatbot();
                    break;
                case 'minimize-chat':
                    chatShell.minimizeChatbot();
                    break;
                case 'send-chat-message':
                    chatShell.sendChatMessage();
                    break;
                case 'quick-message':
                    chatShell.sendQuickMessage(value);
                    break;
                case 'chat-booking':
                    chatShell.handleChatBookingSelection(value);
                    break;
                case 'start-booking':
                    chatShell.startChatBooking();
                    break;
            }
        } else if (action === 'select-service') {
            event.preventDefault();
            event.stopImmediatePropagation();
            fallbackSelectService(value);
        }
    });

    document.addEventListener('change', async function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('[data-action="chat-date-select"]')) {
            const { handleChatDateSelect } = await import('../src/apps/chat/shell.js');
            handleChatDateSelect(target.value);
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    disablePlaceholderExternalLinks();
    bootstrapConsent();
    initChatActionFallbackBridge();
    initActionRouterEngine();
    initDeferredStylesheetLoading();
    initThemeMode();
    changeLanguage(state.currentLang);
    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();

    loadDeferredContent().then(() => {
        showConsentBanner();

        const initHighPriorityWarmups = createOnceTask(async () => {
            initEnglishBundleWarmup();
            initDataEngineWarmup();

            const { initBookingEngineWarmup, initBookingUiWarmup } = await import('./booking.js');
            initBookingEngineWarmup();
            initBookingUiWarmup();

            const { initChatUiEngineWarmup, initChatWidgetEngineWarmup } = await import('../src/apps/chat/shell.js');
            initChatUiEngineWarmup();
            initChatWidgetEngineWarmup();
        });

        const initLowPriorityWarmups = createOnceTask(async () => {
            const { initReviewsEngineWarmup, initEngagementFormsEngineWarmup } = await import('./engagement.js');
            initReviewsEngineWarmup();
            initEngagementFormsEngineWarmup();

            const { initGalleryInteractionsWarmup } = await import('./gallery.js');
            initGalleryInteractionsWarmup();

            const { initChatEngineWarmup, initChatBookingEngineWarmup } = await import('../src/apps/chat/shell.js');
            initChatEngineWarmup();
            initChatBookingEngineWarmup();

            const { initUiEffectsWarmup, initModalUxEngineWarmup } = await import('./ui.js');
            initUiEffectsWarmup();
            initModalUxEngineWarmup();

            const { initRescheduleEngineWarmup } = await import('./reschedule.js');
            initRescheduleEngineWarmup();

            const { initSuccessModalEngineWarmup } = await import('./success-modal.js');
            initSuccessModalEngineWarmup();
        });

        const initDeferredWarmups = createOnceTask(() => {
            initHighPriorityWarmups();
            initLowPriorityWarmups();
            import('./booking.js').then(({ initBookingUiWarmup }) => {
                 initBookingUiWarmup();
            });
        });

        window.addEventListener('pointerdown', initDeferredWarmups, {
            once: true,
            passive: true,
        });
        window.addEventListener('keydown', initDeferredWarmups, { once: true });

        scheduleDeferredTask(initHighPriorityWarmups, {
            idleTimeout: 1400,
            fallbackDelay: 500,
            skipOnConstrained: false,
            constrainedDelay: 900,
        });

        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            import('../src/apps/chat/shell.js').then(({ handleChatKeypress }) => {
                chatInput.addEventListener('keypress', handleChatKeypress);
            });
        }

        // Gallery lazy load is already initialized below in the legacy fallback block.
        initBookingCalendarLazyInit();
    });

    window.addEventListener('pagehide', () => {
        maybeTrackCheckoutAbandon('page_hide');
    });

    import('../src/apps/chat/shell.js').then(({ checkServerEnvironment }) => {
        const isServer = checkServerEnvironment();
        if (!isServer) {
            console.warn(
                'Chatbot en modo offline: abre el sitio desde servidor para usar IA real.'
            );
        }
    });

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
             import('./booking.js').then(({ markBookingViewed }) => {
                 markBookingViewed('cta_click');
             });
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

// Offline/Online Sync
window.addEventListener('online', () => {
    // Refresh availability when connection returns
    import('./booking.js').then(({ initBookingEngineWarmup }) => {
        initBookingEngineWarmup();
    });
    initDataEngineWarmup();
});

// Push Notifications (Stub)
window.subscribeToPushNotifications = async function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push not supported');
        return;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        // VAPID public key required here
        const publicVapidKey = 'B...';
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey
        });
    } catch (error) {
        console.error('Push subscription error:', error);
    }
};

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
                resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine
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
