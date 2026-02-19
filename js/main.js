import {
    initThemeMode, setThemeMode
} from './theme.js';
import {
    changeLanguage, initEnglishBundleWarmup, onLanguageChange
} from './i18n.js';
import {
    initCookieBanner
} from './cookies.js';
import {
    initGA4, trackEvent, normalizeAnalyticsLabel
} from './analytics.js';
import {
    initBookingFunnelObserver, initBookingEngineWarmup, initBookingUiWarmup,
    openPaymentModal, closePaymentModal, processPayment, maybeTrackCheckoutAbandon
} from './booking.js';
import {
    initGalleryInteractionsWarmup
} from './gallery.js';
import {
    initChatEngineWarmup, initChatBookingEngineWarmup, toggleChatbot, minimizeChatbot,
    sendChatMessage, sendQuickMessage, handleChatKeypress, handleChatBookingSelection,
    handleChatDateSelect, startChatBooking, checkServerEnvironment, getChatHistory, getChatbotOpen
} from './chat.js';
import {
    initUiEffectsWarmup, toggleMobileMenu, startWebVideo, closeVideoModal,
    loadModalUxEngine, initModalUxEngineWarmup
} from './ui.js';
import {
    initRescheduleEngineWarmup, closeRescheduleModal, submitReschedule
} from './reschedule.js';
import {
    initSuccessModalEngineWarmup, closeSuccessModal
} from './success-modal.js';
import {
    initEngagementFormsEngineWarmup, initDeferredSectionPrefetch, openReviewModal, closeReviewModal, renderPublicReviews
} from './engagement.js';
import {
    scheduleDeferredTask, createOnceTask, debugLog
} from './loader.js';
import {
    showToast
} from './utils.js';
import {
    getCurrentLang, getReviewsCache
} from './state.js';

// Deferred Stylesheet Loading
const DEFERRED_STYLESHEET_URL = '/styles-deferred.css?v=ui-20260218-deferred2';
let deferredStylesheetPromise = null;
let deferredStylesheetInitDone = false;

function loadDeferredStylesheet() {
    if (document.querySelector('link[data-deferred-stylesheet="true"]')) {
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
        link.onerror = () => reject(new Error('No se pudo cargar styles-deferred.css'));
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
        constrainedDelay: 900
    });
}

// Smooth Scroll
const nav = document.querySelector('.nav');
document.addEventListener('click', function(e) {
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
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
});

document.addEventListener('click', function(e) {
    const targetEl = e.target instanceof Element ? e.target : null;
    if (!targetEl) return;

    const waLink = targetEl.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!waLink) return;

    const inChatContext = !!waLink.closest('#chatbotContainer') || !!waLink.closest('#chatbotWidget');
    if (!inChatContext) return;

    trackEvent('chat_handoff_whatsapp', {
        source: 'chatbot'
    });
});

// Delegated Event Handler
document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const value = actionEl.getAttribute('data-value') || '';
    switch (action) {
        case 'toast-close':
            actionEl.closest('.toast')?.remove();
            break;
        case 'set-theme':
            setThemeMode(value || 'system');
            break;
        case 'set-language':
            changeLanguage(value || 'es');
            break;
        case 'toggle-mobile-menu':
            toggleMobileMenu();
            break;
        case 'start-web-video':
            startWebVideo();
            break;
        case 'open-review-modal':
            openReviewModal();
            break;
        case 'close-review-modal':
            closeReviewModal();
            break;
        case 'close-video-modal':
            closeVideoModal();
            break;
        case 'close-payment-modal':
            closePaymentModal();
            break;
        case 'process-payment':
            processPayment();
            break;
        case 'close-success-modal':
            closeSuccessModal();
            break;
        case 'close-reschedule-modal':
            closeRescheduleModal();
            break;
        case 'submit-reschedule':
            submitReschedule();
            break;
        case 'toggle-chatbot':
            toggleChatbot();
            break;
        case 'send-chat-message':
            sendChatMessage();
            break;
        case 'chat-booking':
            handleChatBookingSelection(value);
            break;
        case 'quick-message':
            sendQuickMessage(value);
            break;
        case 'minimize-chat':
            minimizeChatbot();
            break;
        case 'start-booking':
            startChatBooking();
            break;
    }
});

document.addEventListener('change', function(e) {
    if (e.target.closest('[data-action="chat-date-select"]')) {
        handleChatDateSelect(e.target.value);
    }
});

// Setup language change listener
onLanguageChange(() => {
    const reviews = getReviewsCache();
    if (reviews && reviews.length > 0) {
        renderPublicReviews(reviews);
    }
});

// Initialization
function init() {
    initDeferredStylesheetLoading();
    try {
        initThemeMode();
    } catch (e) {
        console.error('Theme init error:', e);
    }

    changeLanguage(getCurrentLang()).catch(e => console.error('Lang init error:', e));

    try {
        initCookieBanner();
    } catch (e) {
        console.error('Cookie init error:', e);
    }

    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();

    const initDeferredWarmups = createOnceTask(() => {
        initEnglishBundleWarmup();
        initBookingEngineWarmup();
        initBookingUiWarmup();
        initGalleryInteractionsWarmup();
        initChatEngineWarmup();
        initChatBookingEngineWarmup();
        initUiEffectsWarmup();
        initRescheduleEngineWarmup();
        initSuccessModalEngineWarmup();
        initEngagementFormsEngineWarmup();
        initModalUxEngineWarmup();
    });

    window.addEventListener('pointerdown', initDeferredWarmups, { once: true, passive: true });
    window.addEventListener('keydown', initDeferredWarmups, { once: true });

    scheduleDeferredTask(initDeferredWarmups, {
        idleTimeout: 1100,
        fallbackDelay: 320,
        skipOnConstrained: false,
        constrainedDelay: 900
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
        console.warn('Chatbot en modo offline: abre el sitio desde servidor para usar IA real.');
    }

    // Chat notification
    setTimeout(() => {
        const notification = document.getElementById('chatNotification');
        if (notification && !getChatbotOpen() && getChatHistory().length === 0) {
            notification.style.display = 'flex';
        }
    }, 30000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.PielInit = init; // Expose for debugging/tests if needed
