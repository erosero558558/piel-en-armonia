/**
 * PIEL EN ARMON�A - Apple Design
 * Todas las funcionalidades integradas
 * 
 * Incluye:
 * - Toast notifications
 * - Loading states
 * - Exportar a calendario
 * - Validaci�n de disponibilidad
 */

// ========================================
// TOAST NOTIFICATIONS SYSTEM
// ========================================
function showToast(message, type = 'info', title = '') {
    // Create container if doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    const titles = {
        success: title || '�xito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Informaci�n'
    };
    
    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button type="button" class="toast-close" data-action="toast-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

const deferredModulePromises = new Map();

function loadDeferredModule(options) {
    const {
        cacheKey,
        src,
        scriptDataAttribute,
        resolveModule,
        isModuleReady = (module) => !!module,
        onModuleReady,
        missingApiError = 'Deferred module loaded without expected API',
        loadError = 'No se pudo cargar el modulo diferido',
        logLabel = ''
    } = options || {};

    if (!cacheKey || !src || !scriptDataAttribute || typeof resolveModule !== 'function') {
        return Promise.reject(new Error('Invalid deferred module configuration'));
    }

    const getReadyModule = () => {
        const module = resolveModule();
        if (!isModuleReady(module)) {
            return null;
        }

        if (typeof onModuleReady === 'function') {
            onModuleReady(module);
        }

        return module;
    };

    const readyModule = getReadyModule();
    if (readyModule) {
        return Promise.resolve(readyModule);
    }

    if (deferredModulePromises.has(cacheKey)) {
        return deferredModulePromises.get(cacheKey);
    }

    const promise = new Promise((resolve, reject) => {
        const handleLoad = () => {
            const module = getReadyModule();
            if (module) {
                resolve(module);
                return;
            }
            reject(new Error(missingApiError));
        };

        const existing = document.querySelector('script[' + scriptDataAttribute + '="true"]');
        if (existing) {
            existing.addEventListener('load', handleLoad, { once: true });
            existing.addEventListener('error', () => reject(new Error(loadError)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.setAttribute(scriptDataAttribute, 'true');
        script.onload = handleLoad;
        script.onerror = () => reject(new Error(loadError));
        document.head.appendChild(script);
    }).catch((error) => {
        deferredModulePromises.delete(cacheKey);
        if (logLabel) {
            debugLog(logLabel + ' load failed:', error);
        }
        throw error;
    });

    deferredModulePromises.set(cacheKey, promise);
    return promise;
}

function isConstrainedNetworkConnection() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(connection && (
        connection.saveData === true
        || /(^|[^0-9])2g/.test(String(connection.effectiveType || ''))
    ));
}

function scheduleDeferredTask(task, options = {}) {
    const {
        idleTimeout = 2000,
        fallbackDelay = 1200,
        skipOnConstrained = true,
        constrainedDelay = fallbackDelay
    } = options;

    if (isConstrainedNetworkConnection()) {
        if (skipOnConstrained) {
            return false;
        }
        setTimeout(task, constrainedDelay);
        return true;
    }

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(task, { timeout: idleTimeout });
    } else {
        setTimeout(task, fallbackDelay);
    }

    return true;
}

function bindWarmupTarget(selector, eventName, handler, passive = true) {
    const element = document.querySelector(selector);
    if (!element) {
        return false;
    }

    element.addEventListener(eventName, handler, { once: true, passive });
    return true;
}

function createOnceTask(task) {
    let executed = false;

    return function runOnce() {
        if (executed) {
            return;
        }

        executed = true;
        task();
    };
}

function createWarmupRunner(loadFn, options = {}) {
    const markWarmOnSuccess = options.markWarmOnSuccess === true;
    let warmed = false;

    return function warmup() {
        if (warmed || window.location.protocol === 'file:') {
            return;
        }

        if (markWarmOnSuccess) {
            Promise.resolve(loadFn()).then(() => {
                warmed = true;
            }).catch(() => undefined);
            return;
        }

        warmed = true;
        Promise.resolve(loadFn()).catch(() => {
            warmed = false;
        });
    };
}

function observeOnceWhenVisible(element, onVisible, options = {}) {
    const {
        threshold = 0.05,
        rootMargin = '0px',
        onNoObserver
    } = options;

    if (!element) {
        return false;
    }

    if (!('IntersectionObserver' in window)) {
        if (typeof onNoObserver === 'function') {
            onNoObserver();
        }
        return false;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            onVisible(entry);
            observer.disconnect();
        });
    }, {
        threshold,
        rootMargin
    });

    observer.observe(element);
    return true;
}

function withDeferredModule(loader, onReady) {
    return Promise.resolve()
        .then(() => loader())
        .then((module) => onReady(module));
}

function runDeferredModule(loader, onReady, onError) {
    return withDeferredModule(loader, onReady).catch((error) => {
        if (typeof onError === 'function') {
            return onError(error);
        }
        return undefined;
    });
}

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

// ========================================
// TRANSLATIONS
// ========================================
const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);
const translations = {
    es: null,
    en: null
};

function captureSpanishTranslationsFromDom() {
    const bundle = {};
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = String(el.dataset.i18n || '').trim();
        if (!key) {
            return;
        }

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            bundle[key] = el.placeholder || '';
            return;
        }

        if (I18N_HTML_ALLOWED_KEYS.has(key)) {
            bundle[key] = el.innerHTML || '';
            return;
        }

        bundle[key] = el.textContent || '';
    });

    return bundle;
}

const EN_TRANSLATIONS_URL = '/translations-en.js?v=ui-20260218-i18n-en1';
let enTranslationsPromise = null;

function ensureEnglishTranslations() {
    if (translations.en && typeof translations.en === 'object') {
        return Promise.resolve(translations.en);
    }

    if (window.PIEL_EN_TRANSLATIONS && typeof window.PIEL_EN_TRANSLATIONS === 'object') {
        translations.en = window.PIEL_EN_TRANSLATIONS;
        return Promise.resolve(translations.en);
    }

    if (enTranslationsPromise) {
        return enTranslationsPromise;
    }

    enTranslationsPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-en-translations="true"]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.PIEL_EN_TRANSLATIONS && typeof window.PIEL_EN_TRANSLATIONS === 'object') {
                    translations.en = window.PIEL_EN_TRANSLATIONS;
                    resolve(translations.en);
                    return;
                }
                reject(new Error('English translations loaded without payload'));
            }, { once: true });
            existing.addEventListener('error', () => reject(new Error('No se pudo cargar translations-en.js')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = EN_TRANSLATIONS_URL;
        script.async = true;
        script.defer = true;
        script.dataset.enTranslations = 'true';
        script.onload = () => {
            if (window.PIEL_EN_TRANSLATIONS && typeof window.PIEL_EN_TRANSLATIONS === 'object') {
                translations.en = window.PIEL_EN_TRANSLATIONS;
                resolve(translations.en);
                return;
            }
            reject(new Error('English translations loaded without payload'));
        };
        script.onerror = () => reject(new Error('No se pudo cargar translations-en.js'));
        document.head.appendChild(script);
    }).catch((error) => {
        enTranslationsPromise = null;
        debugLog('English translations load failed:', error);
        throw error;
    });

    return enTranslationsPromise;
}

function initEnglishBundleWarmup() {
    const warmup = () => {
        ensureEnglishTranslations().catch(() => undefined);
    };

    const enBtn = document.querySelector('.lang-btn[data-lang="en"]');
    if (enBtn) {
        enBtn.addEventListener('mouseenter', warmup, { once: true, passive: true });
        enBtn.addEventListener('touchstart', warmup, { once: true, passive: true });
        enBtn.addEventListener('focus', warmup, { once: true });
    }
}

let currentLang = localStorage.getItem('language') || 'es';
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
let currentThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
const API_ENDPOINT = '/api.php';
const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
const CLINIC_MAP_URL = 'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
const MAX_CASE_PHOTOS = 3;
const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
const CASE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
const API_REQUEST_TIMEOUT_MS = 9000;
const API_RETRY_BASE_DELAY_MS = 450;
const API_DEFAULT_RETRIES = 1;
const API_SLOW_NOTICE_MS = 1200;
const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
const AVAILABILITY_CACHE_TTL_MS = 5 * 60 * 1000;
const BOOKED_SLOTS_CACHE_TTL_MS = 45 * 1000;
let apiSlowNoticeLastAt = 0;
let bookingViewTracked = false;
let chatStartedTracked = false;
let availabilityPrefetched = false;
let reviewsPrefetched = false;
let checkoutSession = {
    active: false,
    completed: false,
    startedAt: 0,
    service: '',
    doctor: ''
};
const DEFAULT_PUBLIC_REVIEWS = [
    {
        id: 'google-jose-gancino',
        name: 'Jose Gancino',
        rating: 5,
        text: 'Buena atenci�n solo falta los n�meros de la oficina y horarios de atenci�n.',
        date: '2025-10-01T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-jacqueline-ruiz-torres',
        name: 'Jacqueline Ruiz Torres',
        rating: 5,
        text: 'Exelente atenci�n y econ�mico 🙏🤗👌',
        date: '2025-04-15T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-cris-lema',
        name: 'Cris Lema',
        rating: 5,
        text: '',
        date: '2025-10-10T10:00:00-05:00',
        verified: true
    },
    {
        id: 'google-camila-escobar',
        name: 'Camila Escobar',
        rating: 5,
        text: '',
        date: '2025-02-01T10:00:00-05:00',
        verified: true
    }
];
const DEFAULT_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
let currentAppointment = null;
let availabilityCache = {};
let availabilityCacheLoadedAt = 0;
let availabilityCachePromise = null;
const bookedSlotsCache = new Map();
let reviewsCache = [];
let paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeSdkPromise = null;
const LOCAL_FALLBACK_ENABLED = window.location.protocol === 'file:';
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let themeTransitionTimer = null;

const BOOKING_ENGINE_URL = '/booking-engine.js?v=figo-booking-20260218-phase1';

function getBookingEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        getCurrentAppointment: () => currentAppointment,
        setCurrentAppointment: (appointment) => {
            currentAppointment = appointment;
        },
        getCheckoutSession: () => checkoutSession,
        setCheckoutSessionActive: (active) => {
            checkoutSession.active = active === true;
        },
        startCheckoutSession,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent,
        buildAppointmentPayload,
        stripTransientAppointmentFields,
        createAppointmentRecord,
        uploadTransferProof,
        showSuccessModal,
        showToast,
        trackEvent,
        normalizeAnalyticsLabel
    };
}

function loadBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-engine',
        src: BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.PielBookingEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingEngineDeps()),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine'
    });
}

function initBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingEngine(), { markWarmOnSuccess: true });

    const selectors = [
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]'
    ];

    selectors.forEach((selector) => {
        bindWarmupTarget(selector, 'mouseenter', warmup);
        bindWarmupTarget(selector, 'focus', warmup, false);
        bindWarmupTarget(selector, 'touchstart', warmup);
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1100
    });
}

if (!VALID_THEME_MODES.has(currentThemeMode)) {
    currentThemeMode = 'system';
}

function resolveThemeMode(mode = currentThemeMode) {
    if (mode === 'system') {
        if (systemThemeQuery && systemThemeQuery.matches) {
            return 'dark';
        }
        return 'light';
    }
    return mode;
}

function applyThemeMode(mode = currentThemeMode) {
    const resolvedTheme = resolveThemeMode(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
}

function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeMode === currentThemeMode);
    });
}

function animateThemeTransition() {
    if (!document.body) return;

    if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
    }

    document.body.classList.remove('theme-transition');
    void document.body.offsetWidth;
    document.body.classList.add('theme-transition');

    themeTransitionTimer = setTimeout(() => {
        document.body.classList.remove('theme-transition');
    }, 320);
}

function setThemeMode(mode) {
    if (!VALID_THEME_MODES.has(mode)) {
        return;
    }

    currentThemeMode = mode;
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    animateThemeTransition();
    applyThemeMode(mode);
    updateThemeButtons();
}

function initThemeMode() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    currentThemeMode = VALID_THEME_MODES.has(storedTheme) ? storedTheme : 'system';
    applyThemeMode(currentThemeMode);
    updateThemeButtons();
}

function getCookieConsent() {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return typeof parsed?.status === 'string' ? parsed.status : '';
    } catch (error) {
        return '';
    }
}

function setCookieConsent(status) {
    const normalized = status === 'accepted' ? 'accepted' : 'rejected';
    try {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            status: normalized,
            at: new Date().toISOString()
        }));
    } catch (error) {
        // noop
    }
}

function trackEvent(eventName, params = {}) {
    if (!eventName || typeof eventName !== 'string') {
        return;
    }

    const payload = {
        event_category: 'conversion',
        ...params
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, payload);
        return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: eventName,
        ...payload
    });
}

function normalizeAnalyticsLabel(value, fallback = 'unknown') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
    return normalized || fallback;
}

function markBookingViewed(source = 'unknown') {
    if (bookingViewTracked) {
        return;
    }
    bookingViewTracked = true;
    trackEvent('view_booking', {
        source
    });
}

function prefetchAvailabilityData(source = 'unknown') {
    if (availabilityPrefetched) {
        return;
    }
    availabilityPrefetched = true;
    loadAvailabilityData().catch(() => {
        availabilityPrefetched = false;
    });
    trackEvent('availability_prefetch', {
        source
    });
}

function prefetchReviewsData(source = 'unknown') {
    if (reviewsPrefetched) {
        return;
    }
    reviewsPrefetched = true;
    loadPublicReviews().catch(() => {
        reviewsPrefetched = false;
    });
    trackEvent('reviews_prefetch', {
        source
    });
}

function initBookingFunnelObserver() {
    const bookingSection = document.getElementById('citas');
    if (!bookingSection) {
        return;
    }

    observeOnceWhenVisible(bookingSection, () => {
        markBookingViewed('observer');
        prefetchAvailabilityData('booking_section_visible');
    }, {
        threshold: 0.35,
        onNoObserver: () => {
            markBookingViewed('fallback_no_observer');
            prefetchAvailabilityData('fallback_no_observer');
        }
    });
}

function initDeferredSectionPrefetch() {
    const reviewsSection = document.getElementById('resenas');
    if (!reviewsSection) {
        return;
    }

    observeOnceWhenVisible(reviewsSection, () => {
        prefetchReviewsData('reviews_section_visible');
    }, {
        threshold: 0.2,
        rootMargin: '120px 0px',
        onNoObserver: () => {
            prefetchReviewsData('fallback_no_observer');
        }
    });
}

function startCheckoutSession(appointment) {
    checkoutSession = {
        active: true,
        completed: false,
        startedAt: Date.now(),
        service: appointment?.service || '',
        doctor: appointment?.doctor || ''
    };
}

function completeCheckoutSession(method) {
    if (!checkoutSession.active) {
        return;
    }
    checkoutSession.completed = true;
    trackEvent('booking_confirmed', {
        payment_method: method || 'unknown',
        service: checkoutSession.service || '',
        doctor: checkoutSession.doctor || ''
    });
}

function maybeTrackCheckoutAbandon(reason = 'unknown') {
    if (!checkoutSession.active || checkoutSession.completed) {
        return;
    }

    const startedAt = checkoutSession.startedAt || Date.now();
    const elapsedSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    trackEvent('checkout_abandon', {
        service: checkoutSession.service || '',
        doctor: checkoutSession.doctor || '',
        elapsed_sec: elapsedSec,
        reason: normalizeAnalyticsLabel(reason, 'unknown')
    });
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initGA4() {
    if (window._ga4Loaded) return;
    if (getCookieConsent() !== 'accepted') return;
    window._ga4Loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GYY8PE5M8W';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', 'G-GYY8PE5M8W');
}

function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;

    const consent = getCookieConsent();
    if (consent === 'accepted' || consent === 'rejected') {
        banner.classList.remove('active');
    } else {
        banner.classList.add('active');
    }

    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const rejectBtn = document.getElementById('cookieRejectBtn');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            setCookieConsent('accepted');
            banner.classList.remove('active');
            showToast(currentLang === 'es' ? 'Preferencias de cookies guardadas.' : 'Cookie preferences saved.', 'success');
            initGA4();
            trackEvent('cookie_consent_update', { status: 'accepted' });
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            setCookieConsent('rejected');
            banner.classList.remove('active');
            showToast(currentLang === 'es' ? 'Solo se mantendran cookies esenciales.' : 'Only essential cookies will be kept.', 'info');
            trackEvent('cookie_consent_update', { status: 'rejected' });
        });
    }
}

function handleSystemThemeChange() {
    if (currentThemeMode === 'system') {
        applyThemeMode('system');
    }
}

if (systemThemeQuery) {
    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
    } else if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(handleSystemThemeChange);
    }
}

function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Ignore storage quota errors.
    }
}

async function apiRequest(resource, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const query = new URLSearchParams({ resource: resource });
    if (options.query && typeof options.query === 'object') {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
    }
    const url = `${API_ENDPOINT}?${query.toString()}`;
    const requestInit = {
        method: method,
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    };

    if (options.body !== undefined) {
        requestInit.headers['Content-Type'] = 'application/json';
        requestInit.body = JSON.stringify(options.body);
    }

    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1500, Number(options.timeoutMs)) : API_REQUEST_TIMEOUT_MS;
    const maxRetries = Number.isInteger(options.retries)
        ? Math.max(0, Number(options.retries))
        : (method === 'GET' ? API_DEFAULT_RETRIES : 0);

    const shouldShowSlowNotice = options.silentSlowNotice !== true;
    const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

    function makeApiError(message, status = 0, retryable = false, code = '') {
        const error = new Error(message);
        error.status = status;
        error.retryable = retryable;
        error.code = code;
        return error;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let slowNoticeTimer = null;

        if (shouldShowSlowNotice) {
            slowNoticeTimer = setTimeout(() => {
                const now = Date.now();
                if ((now - apiSlowNoticeLastAt) > API_SLOW_NOTICE_COOLDOWN_MS) {
                    apiSlowNoticeLastAt = now;
                    showToast(
                        currentLang === 'es'
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    );
                }
            }, API_SLOW_NOTICE_MS);
        }

        try {
            const response = await fetch(url, {
                ...requestInit,
                signal: controller.signal
            });

            const responseText = await response.text();
            let payload = {};
            try {
                payload = responseText ? JSON.parse(responseText) : {};
            } catch (error) {
                throw makeApiError('Respuesta del servidor no es JSON valido', response.status, false, 'invalid_json');
            }

            if (!response.ok || payload.ok === false) {
                const message = payload.error || `HTTP ${response.status}`;
                throw makeApiError(message, response.status, retryableStatusCodes.has(response.status), 'http_error');
            }

            return payload;
        } catch (error) {
            const normalizedError = (() => {
                if (error && error.name === 'AbortError') {
                    return makeApiError(
                        currentLang === 'es'
                            ? 'Tiempo de espera agotado con el servidor'
                            : 'Server request timed out',
                        0,
                        true,
                        'timeout'
                    );
                }

                if (error instanceof Error) {
                    if (typeof error.retryable !== 'boolean') {
                        error.retryable = false;
                    }
                    if (typeof error.status !== 'number') {
                        error.status = 0;
                    }
                    return error;
                }

                return makeApiError('Error de conexion con el servidor', 0, true, 'network_error');
            })();

            lastError = normalizedError;

            const canRetry = attempt < maxRetries && normalizedError.retryable === true;
            if (!canRetry) {
                throw normalizedError;
            }

            const retryDelay = API_RETRY_BASE_DELAY_MS * (attempt + 1);
            await waitMs(retryDelay);
        } finally {
            clearTimeout(timeoutId);
            if (slowNoticeTimer !== null) {
                clearTimeout(slowNoticeTimer);
            }
        }
    }

    throw lastError || new Error('No se pudo completar la solicitud');
}

async function loadPaymentConfig() {
    const now = Date.now();
    if (paymentConfigLoaded && (now - paymentConfigLoadedAt) < 5 * 60 * 1000) {
        return paymentConfig;
    }

    try {
        const payload = await apiRequest('payment-config');
        paymentConfig = {
            enabled: payload.enabled === true,
            provider: payload.provider || 'stripe',
            publishableKey: payload.publishableKey || '',
            currency: payload.currency || 'USD'
        };
    } catch (error) {
        paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
    }
    paymentConfigLoaded = true;
    paymentConfigLoadedAt = now;
    return paymentConfig;
}

async function loadStripeSdk() {
    if (typeof window.Stripe === 'function') {
        return true;
    }

    if (stripeSdkPromise) {
        return stripeSdkPromise;
    }

    stripeSdkPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-stripe-sdk="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Stripe SDK')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.defer = true;
        script.dataset.stripeSdk = 'true';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('No se pudo cargar Stripe SDK'));
        document.head.appendChild(script);
    });

    return stripeSdkPromise;
}

async function createPaymentIntent(appointment) {
    const payload = await apiRequest('payment-intent', {
        method: 'POST',
        body: appointment
    });
    return payload;
}

async function verifyPaymentIntent(paymentIntentId) {
    return apiRequest('payment-verify', {
        method: 'POST',
        body: { paymentIntentId }
    });
}

async function uploadTransferProof(file) {
    const formData = new FormData();
    formData.append('proof', file);

    const query = new URLSearchParams({ resource: 'transfer-proof' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    let response;
    let text = '';
    try {
        response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
            signal: controller.signal
        });
        text = await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(
                currentLang === 'es'
                    ? 'Tiempo de espera agotado al subir el comprobante'
                    : 'Upload timed out while sending proof file'
            );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta de subida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

function getCasePhotoFiles(formElement) {
    const input = formElement?.querySelector('#casePhotos');
    if (!input || !input.files) return [];
    return Array.from(input.files);
}

function validateCasePhotoFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            currentLang === 'es'
                ? `Puedes subir maximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                currentLang === 'es'
                    ? `Cada foto debe pesar maximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                    : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
            );
        }

        const mime = String(file.type || '').toLowerCase();
        const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
        const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
        if (!validByMime && !validByExt) {
            throw new Error(
                currentLang === 'es'
                    ? 'Solo se permiten im\u00e1genes JPG, PNG o WEBP.'
                    : 'Only JPG, PNG or WEBP images are allowed.'
            );
        }
    }
}

async function ensureCasePhotosUploaded(appointment) {
    const files = Array.isArray(appointment?.casePhotoFiles) ? appointment.casePhotoFiles : [];
    if (files.length === 0) {
        return { names: [], urls: [], paths: [] };
    }

    if (Array.isArray(appointment.casePhotoUploads) && appointment.casePhotoUploads.length > 0) {
        return {
            names: appointment.casePhotoUploads.map(item => String(item.name || '')).filter(Boolean),
            urls: appointment.casePhotoUploads.map(item => String(item.url || '')).filter(Boolean),
            paths: appointment.casePhotoUploads.map(item => String(item.path || '')).filter(Boolean)
        };
    }

    const uploads = [];
    for (const file of files) {
        const uploaded = await uploadTransferProof(file);
        uploads.push({
            name: uploaded.transferProofName || file.name || '',
            url: uploaded.transferProofUrl || '',
            path: uploaded.transferProofPath || ''
        });
    }
    appointment.casePhotoUploads = uploads;

    return {
        names: uploads.map(item => String(item.name || '')).filter(Boolean),
        urls: uploads.map(item => String(item.url || '')).filter(Boolean),
        paths: uploads.map(item => String(item.path || '')).filter(Boolean)
    };
}

function stripTransientAppointmentFields(appointment) {
    const payload = { ...appointment };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

async function buildAppointmentPayload(appointment) {
    const payload = stripTransientAppointmentFields(appointment || {});
    const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
    payload.casePhotoCount = uploadedPhotos.urls.length;
    payload.casePhotoNames = uploadedPhotos.names;
    payload.casePhotoUrls = uploadedPhotos.urls;
    payload.casePhotoPaths = uploadedPhotos.paths;
    return payload;
}

function getBookedSlotsCacheKey(date, doctor = '') {
    return `${String(date || '')}::${String(doctor || '')}`;
}

function invalidateBookedSlotsCache(date = '', doctor = '') {
    const targetDate = String(date || '').trim();
    const targetDoctor = String(doctor || '').trim();
    if (!targetDate) {
        bookedSlotsCache.clear();
        return;
    }

    for (const key of bookedSlotsCache.keys()) {
        if (!key.startsWith(`${targetDate}::`)) {
            continue;
        }
        if (targetDoctor === '' || key === getBookedSlotsCacheKey(targetDate, targetDoctor)) {
            bookedSlotsCache.delete(key);
        }
    }
}

async function loadAvailabilityData(options = {}) {
    const forceRefresh = options && options.forceRefresh === true;
    const now = Date.now();

    if (!forceRefresh && availabilityCacheLoadedAt > 0 && (now - availabilityCacheLoadedAt) < AVAILABILITY_CACHE_TTL_MS) {
        return availabilityCache;
    }

    if (!forceRefresh && availabilityCachePromise) {
        return availabilityCachePromise;
    }

    availabilityCachePromise = (async () => {
        try {
            const payload = await apiRequest('availability');
            availabilityCache = payload.data || {};
            availabilityCacheLoadedAt = Date.now();
            storageSetJSON('availability', availabilityCache);
        } catch (error) {
            availabilityCache = storageGetJSON('availability', {});
            if (availabilityCache && typeof availabilityCache === 'object' && Object.keys(availabilityCache).length > 0) {
                availabilityCacheLoadedAt = Date.now();
            }
        } finally {
            availabilityCachePromise = null;
        }

        return availabilityCache;
    })();

    return availabilityCachePromise;
}

async function getBookedSlots(date, doctor = '') {
    const cacheKey = getBookedSlotsCacheKey(date, doctor);
    const now = Date.now();
    const cachedEntry = bookedSlotsCache.get(cacheKey);
    if (cachedEntry && (now - cachedEntry.at) < BOOKED_SLOTS_CACHE_TTL_MS) {
        return cachedEntry.slots;
    }

    try {
        const query = { date: date };
        if (doctor) query.doctor = doctor;
        const payload = await apiRequest('booked-slots', { query });
        const slots = Array.isArray(payload.data) ? payload.data : [];
        bookedSlotsCache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const appointments = storageGetJSON('appointments', []);
        const slots = appointments
            .filter(a => {
                if (a.date !== date || a.status === 'cancelled') return false;
                if (doctor && doctor !== 'indiferente') {
                    const aDoc = a.doctor || '';
                    if (aDoc && aDoc !== 'indiferente' && aDoc !== doctor) return false;
                }
                return true;
            })
            .map(a => a.time);
        bookedSlotsCache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
    }
}

async function createAppointmentRecord(appointment, options = {}) {
    const allowLocalFallback = options.allowLocalFallback !== false;
    try {
        const payload = await apiRequest('appointments', {
            method: 'POST',
            body: appointment
        });
        const localAppointments = storageGetJSON('appointments', []);
        localAppointments.push(payload.data);
        storageSetJSON('appointments', localAppointments);
        if (payload && payload.data) {
            invalidateBookedSlotsCache(payload.data.date || appointment?.date || '', payload.data.doctor || appointment?.doctor || '');
        } else {
            invalidateBookedSlotsCache(appointment?.date || '', appointment?.doctor || '');
        }
        return {
            appointment: payload.data,
            emailSent: payload.emailSent === true
        };
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED || !allowLocalFallback) {
            throw error;
        }
        const localAppointments = storageGetJSON('appointments', []);
        const fallback = {
            ...appointment,
            id: Date.now(),
            status: 'confirmed',
            dateBooked: new Date().toISOString(),
            paymentStatus: appointment.paymentStatus || 'pending'
        };
        localAppointments.push(fallback);
        storageSetJSON('appointments', localAppointments);
        invalidateBookedSlotsCache(fallback.date || appointment?.date || '', fallback.doctor || appointment?.doctor || '');
        return {
            appointment: fallback,
            emailSent: false
        };
    }
}

async function createCallbackRecord(callback) {
    try {
        await apiRequest('callbacks', {
            method: 'POST',
            body: callback
        });
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const callbacks = storageGetJSON('callbacks', []);
        callbacks.push(callback);
        storageSetJSON('callbacks', callbacks);
    }
}

async function createReviewRecord(review) {
    try {
        const payload = await apiRequest('reviews', {
            method: 'POST',
            body: review
        });
        return payload.data;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const localReviews = storageGetJSON('reviews', []);
        localReviews.unshift(review);
        storageSetJSON('reviews', localReviews);
        return review;
    }
}

function mergePublicReviews(inputReviews) {
    const merged = [];
    const seen = new Set();

    const addReview = (review) => {
        if (!review || typeof review !== 'object') return;
        const name = String(review.name || '').trim().toLowerCase();
        const text = String(review.text || '').trim().toLowerCase();
        const date = String(review.date || '').trim();
        const signature = `${name}|${text}|${date}`;
        if (!name || seen.has(signature)) return;
        seen.add(signature);
        merged.push(review);
    };

    DEFAULT_PUBLIC_REVIEWS.forEach(addReview);
    if (Array.isArray(inputReviews)) {
        inputReviews.forEach(addReview);
    }

    return merged;
}

async function loadPublicReviews() {
    try {
        const payload = await apiRequest('reviews');
        const fetchedReviews = Array.isArray(payload.data) ? payload.data : [];
        reviewsCache = mergePublicReviews(fetchedReviews);
    } catch (error) {
        const localReviews = storageGetJSON('reviews', []);
        reviewsCache = mergePublicReviews(localReviews);
    }
    renderPublicReviews(reviewsCache);
}

function getInitials(name) {
    const parts = String(name || 'Paciente')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'PA';
    return parts.map(part => part[0].toUpperCase()).join('');
}

function getRelativeDateLabel(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
        return currentLang === 'es' ? 'Reciente' : 'Recent';
    }
    const now = new Date();
    const days = Math.max(0, Math.floor((now - date) / (1000 * 60 * 60 * 24)));
    if (currentLang === 'es') {
        if (days <= 1) return 'Hoy';
        if (days < 7) return `Hace ${days} d${days === 1 ? 'ia' : 'ias'}`;
        if (days < 30) return `Hace ${Math.floor(days / 7)} semana(s)`;
        return date.toLocaleDateString('es-EC');
    }
    if (days <= 1) return 'Today';
    if (days < 7) return `${days} day(s) ago`;
    if (days < 30) return `${Math.floor(days / 7)} week(s) ago`;
    return date.toLocaleDateString('en-US');
}

function renderStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
        html += `<i class="${i <= value ? 'fas' : 'far'} fa-star"></i>`;
    }
    return html;
}

function renderPublicReviews(reviews) {
    const grid = document.querySelector('.reviews-grid');
    if (!grid || !Array.isArray(reviews) || reviews.length === 0) return;

    const topReviews = reviews.slice(0, 6);
    grid.innerHTML = topReviews.map(review => {
        const text = String(review.text || '').trim();
        const textHtml = text !== ''
            ? `<p class="review-text">"${escapeHtml(text)}"</p>`
            : '';
        return `
        <div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${escapeHtml(getInitials(review.name))}</div>
                <div class="review-meta">
                    <h4>${escapeHtml(review.name || (currentLang === 'es' ? 'Paciente' : 'Patient'))}</h4>
                    <div class="review-stars">${renderStars(review.rating)}</div>
                </div>
            </div>
            ${textHtml}
            <span class="review-date">${getRelativeDateLabel(review.date)}</span>
        </div>
    `;
    }).join('');

    // Actualizar promedio dinamico en hero + seccion de resenas
    if (reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length;
        const starsHtml = renderStars(Math.round(avg));

        document.querySelectorAll('.rating-number').forEach(el => {
            el.textContent = avg.toFixed(1);
        });

        document.querySelectorAll('.rating-stars').forEach(el => {
            el.innerHTML = starsHtml;
        });
    }

    const countText = currentLang === 'es'
        ? `${reviews.length} rese\u00f1as verificadas`
        : `${reviews.length} verified reviews`;

    document.querySelectorAll('.rating-count').forEach(el => {
        el.textContent = countText;
    });
}

async function changeLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'es';
    currentLang = nextLang;
    localStorage.setItem('language', nextLang);
    document.documentElement.lang = nextLang;

    if (!translations.es || typeof translations.es !== 'object') {
        translations.es = captureSpanishTranslationsFromDom();
    }

    if (nextLang === 'en' && !translations.en) {
        try {
            await ensureEnglishTranslations();
        } catch (error) {
            showToast('No se pudo cargar el paquete de idioma EN. Se mantiene Espanol.', 'warning');
        }
    }

    const langPack = translations[nextLang] || translations.es || {};

    // Update buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === nextLang);
    });
    
    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (Object.prototype.hasOwnProperty.call(langPack, key)) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = langPack[key];
            } else if (I18N_HTML_ALLOWED_KEYS.has(key)) {
                el.innerHTML = langPack[key];
            } else {
                el.textContent = langPack[key];
            }
        }
    });

    if (reviewsCache.length > 0) {
        renderPublicReviews(reviewsCache);
    }
}

// ========================================
// MOBILE MENU
// ========================================
function toggleMobileMenu(forceClose) {
    const menu = document.getElementById('mobileMenu');
    if (forceClose === false) {
        menu.classList.remove('active');
        document.body.style.overflow = '';
        return;
    }
    menu.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
}

// ========================================
// VIDEO MODAL
// ========================================
function startWebVideo() {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// GALLERY INTERACTIONS (DEFERRED MODULE)
// ========================================
const GALLERY_INTERACTIONS_URL = '/gallery-interactions.js?v=figo-gallery-20260218-phase4';

function loadGalleryInteractions() {
    return loadDeferredModule({
        cacheKey: 'gallery-interactions',
        src: GALLERY_INTERACTIONS_URL,
        scriptDataAttribute: 'data-gallery-interactions',
        resolveModule: () => window.PielGalleryInteractions,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(),
        missingApiError: 'gallery-interactions loaded without API',
        loadError: 'No se pudo cargar gallery-interactions.js',
        logLabel: 'Gallery interactions'
    });
}

function initGalleryInteractionsWarmup() {
    const warmup = createWarmupRunner(() => loadGalleryInteractions());

    const gallerySection = document.getElementById('galeria');
    observeOnceWhenVisible(gallerySection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup
    });

    const firstFilterBtn = document.querySelector('.filter-btn');
    if (firstFilterBtn) {
        firstFilterBtn.addEventListener('mouseenter', warmup, { once: true, passive: true });
        firstFilterBtn.addEventListener('touchstart', warmup, { once: true, passive: true });
    }

    if (!gallerySection && !firstFilterBtn) {
        return;
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1500
    });
}

// ========================================
// APPOINTMENT FORM (DEFERRED MODULE)
// ========================================
const BOOKING_UI_URL = '/booking-ui.js?v=figo-booking-ui-20260218-phase4';

function getBookingUiDeps() {
    return {
        loadAvailabilityData,
        getBookedSlots,
        showToast,
        getCurrentLang: () => currentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice(),
        getCasePhotoFiles,
        validateCasePhotoFiles,
        markBookingViewed,
        startCheckoutSession,
        trackEvent,
        normalizeAnalyticsLabel,
        openPaymentModal,
        setCurrentAppointment: (appointment) => {
            currentAppointment = appointment;
        }
    };
}

function loadBookingUi() {
    return loadDeferredModule({
        cacheKey: 'booking-ui',
        src: BOOKING_UI_URL,
        scriptDataAttribute: 'data-booking-ui',
        resolveModule: () => window.PielBookingUi,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingUiDeps()),
        missingApiError: 'booking-ui loaded without API',
        loadError: 'No se pudo cargar booking-ui.js',
        logLabel: 'Booking UI'
    });
}

function initBookingUiWarmup() {
    const warmup = createWarmupRunner(() => loadBookingUi());

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup
    });

    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('focusin', warmup, { once: true });
        appointmentForm.addEventListener('pointerdown', warmup, { once: true, passive: true });
        setTimeout(warmup, 120);
    }

    if (!bookingSection && !appointmentForm) {
        return;
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 1100
    });
}

// ========================================
// PAYMENT MODAL
// ========================================
function openPaymentModal(appointmentData) {
    runDeferredModule(
        loadBookingEngine,
        (engine) => engine.openPaymentModal(appointmentData),
        (error) => {
            debugLog('openPaymentModal fallback error:', error);
            showToast('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}

function closePaymentModal(options = {}) {
    if (window.PielBookingEngine && typeof window.PielBookingEngine.closePaymentModal === 'function') {
        window.PielBookingEngine.closePaymentModal(options);
        return;
    }

    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason = options && typeof options.reason === 'string' ? options.reason : 'modal_close';
    if (!skipAbandonTrack) {
        maybeTrackCheckoutAbandon(abandonReason);
    }

    checkoutSession.active = false;
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

function getActivePaymentMethod() {
    if (window.PielBookingEngine && typeof window.PielBookingEngine.getActivePaymentMethod === 'function') {
        return window.PielBookingEngine.getActivePaymentMethod();
    }
    const activeMethod = document.querySelector('.payment-method.active');
    return activeMethod?.dataset.method || 'cash';
}

async function processPayment() {
    return runDeferredModule(
        loadBookingEngine,
        (engine) => engine.processPayment(),
        (error) => {
            debugLog('processPayment error:', error);
            showToast('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}

// ========================================
// SUCCESS MODAL (DEFERRED MODULE)
// ========================================
const SUCCESS_MODAL_ENGINE_URL = '/success-modal-engine.js?v=figo-success-modal-20260218-phase1';

function getSuccessModalEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        getCurrentAppointment: () => currentAppointment,
        getClinicAddress: () => CLINIC_ADDRESS,
        escapeHtml
    };
}

function loadSuccessModalEngine() {
    return loadDeferredModule({
        cacheKey: 'success-modal-engine',
        src: SUCCESS_MODAL_ENGINE_URL,
        scriptDataAttribute: 'data-success-modal-engine',
        resolveModule: () => window.PielSuccessModalEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getSuccessModalEngineDeps()),
        missingApiError: 'success-modal-engine loaded without API',
        loadError: 'No se pudo cargar success-modal-engine.js',
        logLabel: 'Success modal engine'
    });
}

function initSuccessModalEngineWarmup() {
    const warmup = createWarmupRunner(() => loadSuccessModalEngine());

    bindWarmupTarget('#appointmentForm button[type="submit"]', 'pointerdown', warmup);
    bindWarmupTarget('#appointmentForm button[type="submit"]', 'focus', warmup, false);
    bindWarmupTarget('.payment-method', 'pointerdown', warmup);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2800,
        fallbackDelay: 1600
    });
}

function showSuccessModal(emailSent = false) {
    runDeferredModule(
        loadSuccessModalEngine,
        (engine) => engine.showSuccessModal(emailSent),
        () => {
            showToast('No se pudo abrir la confirmacion de cita.', 'error');
        }
    );
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';

    runDeferredModule(loadSuccessModalEngine, (engine) => engine.closeSuccessModal());
}

// ========================================
// CALLBACK + REVIEW FORMS (DEFERRED MODULE)
// ========================================
const ENGAGEMENT_FORMS_ENGINE_URL = '/engagement-forms-engine.js?v=figo-engagement-20260218-phase1';

function getEngagementFormsEngineDeps() {
    return {
        createCallbackRecord,
        createReviewRecord,
        renderPublicReviews,
        showToast,
        getCurrentLang: () => currentLang,
        getReviewsCache: () => Array.isArray(reviewsCache) ? reviewsCache.slice() : [],
        setReviewsCache: (items) => {
            reviewsCache = Array.isArray(items) ? items.slice() : [];
        }
    };
}

function loadEngagementFormsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-forms-engine',
        src: ENGAGEMENT_FORMS_ENGINE_URL,
        scriptDataAttribute: 'data-engagement-forms-engine',
        resolveModule: () => window.PielEngagementFormsEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getEngagementFormsEngineDeps()),
        missingApiError: 'engagement-forms-engine loaded without API',
        loadError: 'No se pudo cargar engagement-forms-engine.js',
        logLabel: 'Engagement forms engine'
    });
}

function initEngagementFormsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadEngagementFormsEngine());

    bindWarmupTarget('#callbackForm', 'focusin', warmup, false);
    bindWarmupTarget('#callbackForm', 'pointerdown', warmup);
    bindWarmupTarget('#resenas [data-action="open-review-modal"]', 'mouseenter', warmup);
    bindWarmupTarget('#resenas [data-action="open-review-modal"]', 'touchstart', warmup);

    if (document.getElementById('callbackForm')) {
        setTimeout(warmup, 120);
    }

    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '280px 0px',
        onNoObserver: warmup
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1500
    });
}

function openReviewModal() {
    runDeferredModule(
        loadEngagementFormsEngine,
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

    runDeferredModule(loadEngagementFormsEngine, (engine) => engine.closeReviewModal());
}

// MODAL CLOSE HANDLERS (DEFERRED MODULE)
// ========================================
const MODAL_UX_ENGINE_URL = '/modal-ux-engine.js?v=figo-modal-ux-20260218-phase1';

function getModalUxEngineDeps() {
    return {
        closePaymentModal,
        toggleMobileMenu
    };
}

function loadModalUxEngine() {
    return loadDeferredModule({
        cacheKey: 'modal-ux-engine',
        src: MODAL_UX_ENGINE_URL,
        scriptDataAttribute: 'data-modal-ux-engine',
        resolveModule: () => window.PielModalUxEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getModalUxEngineDeps()),
        missingApiError: 'modal-ux-engine loaded without API',
        loadError: 'No se pudo cargar modal-ux-engine.js',
        logLabel: 'Modal UX engine'
    });
}

function initModalUxEngineWarmup() {
    const warmup = createWarmupRunner(() => loadModalUxEngine());

    bindWarmupTarget('.modal', 'pointerdown', warmup);
    bindWarmupTarget('.modal-close', 'pointerdown', warmup);

    if (document.querySelector('.modal')) {
        setTimeout(warmup, 180);
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 2200,
        fallbackDelay: 1200
    });
}

// ========================================
// SMOOTH SCROLL
// ========================================
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

// ========================================
// CHATBOT CON FIGO
// ========================================
let chatbotOpen = false;
let chatHistory = (function() {
    try {
        const raw = localStorage.getItem('chatHistory');
        const saved = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const valid = saved.filter(m => m.time && new Date(m.time).getTime() > cutoff);
        if (valid.length !== saved.length) {
            try { localStorage.setItem('chatHistory', JSON.stringify(valid)); } catch(e) {}
        }
        return valid;
    } catch(e) { return []; }
})();
let conversationContext = [];

// CONFIGURACI�N DE CHAT
const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    maxTokens: 1000,
    temperature: 0.7
};

// Funcion simple para detectar si usar IA real
function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }
    
    var protocol = window.location.protocol;
    
    if (protocol === 'file:') {
        return false;
    }

    return true;
}

// Contexto del sistema para el asistente
const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la cl�nica dermatol�gica "Piel en Armon�a" en Quito, Ecuador.

INFORMACI�N DE LA CL�NICA:
- Nombre: Piel en Armon�a
- Doctores: Dr. Javier Rosero (Dermat�logo Cl�nico) y Dra. Carolina Narv�ez (Dermat�loga Est�tica)
- Direcci�n: ${CLINIC_ADDRESS}
- Tel�fono/WhatsApp: +593 98 245 3672
- Contacto Dra. Carolina: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}
- Horario: Lunes-Viernes 9:00-18:00, S�bados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS:
- Consulta Dermatol�gica: $40 (incluye IVA)
- Consulta Telef�nica: $25
- Video Consulta: $30
- Tratamiento L�ser: desde $150
- Rejuvenecimiento: desde $120
- Tratamiento de Acn�: desde $80
- Detecci�n de C�ncer de Piel: desde $70

OPCIONES DE CONSULTA ONLINE:
1. Llamada telef�nica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- S� profesional, amable y emp�tico
- Responde en espa�ol (o en el idioma que use el paciente)
- Si el paciente tiene s�ntomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telef�nica
- Si no sabes algo espec�fico, ofrece transferir al doctor real
- No hagas diagn�sticos m�dicos definitivos, solo orientaci�n general
- Usa emojis ocasionalmente para ser amigable
- Mant�n respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la cl�nica
2. Entender los precios
3. Agendar citas
4. Resolver dudas b�sicas sobre dermatolog�a
5. Conectar con un doctor real cuando sea necesario`;

function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    chatbotOpen = !chatbotOpen;
    
    if (chatbotOpen) {
        container.classList.add('active');
        document.getElementById('chatNotification').style.display = 'none';
        scrollToBottom();
        if (!chatStartedTracked) {
            chatStartedTracked = true;
            trackEvent('chat_started', {
                source: 'widget'
            });
        }
        
        // Si es la primera vez, mostrar mensaje inicial
        if (chatHistory.length === 0) {
            // Verificar si estamos usando IA real
            const usandoIA = shouldUseRealAI();
            
            debugLog('?? Estado del chatbot:', usandoIA ? 'IA REAL' : 'Respuestas locales');
            
            var welcomeMsg;
            
            if (usandoIA) {
                welcomeMsg = '�Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armon�a</strong>.<br><br>';
                welcomeMsg += '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
                welcomeMsg += 'Puedo ayudarte con informaci�n detallada sobre:<br>';
                welcomeMsg += '� Nuestros servicios dermatologicos<br>';
                welcomeMsg += '� Precios de consultas y tratamientos<br>';
                welcomeMsg += '� Agendar citas presenciales o online<br>';
                welcomeMsg += '� Ubicacion y horarios de atencion<br>';
                welcomeMsg += '� Resolver tus dudas sobre cuidado de la piel<br><br>';
                welcomeMsg += '�En que puedo ayudarte hoy?';
            } else {
                welcomeMsg = '�Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armon�a</strong>.<br><br>';
                welcomeMsg += 'Puedo ayudarte con informaci�n sobre:<br>';
                welcomeMsg += '� Nuestros servicios dermatologicos<br>';
                welcomeMsg += '� Precios de consultas y tratamientos<br>';
                welcomeMsg += '� Agendar citas presenciales o online<br>';
                welcomeMsg += '� Ubicacion y horarios de atencion<br><br>';
                welcomeMsg += '�En que puedo ayudarte hoy?';
            }
            
            addBotMessage(welcomeMsg);
            
            // Sugerir opciones rapidas
            setTimeout(function() {
                var quickOptions = '<div class="chat-suggestions">';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
                quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
                quickOptions += '<i class="fas fa-calendar-check"></i> Agendar cita';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
                quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
                quickOptions += '</button>';
                quickOptions += '</div>';
                addBotMessage(quickOptions);
            }, 500);
        }
    } else {
        container.classList.remove('active');
    }
}

function minimizeChatbot() {
    document.getElementById('chatbotContainer').classList.remove('active');
    chatbotOpen = false;
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    input.value = '';

    await processWithKimi(message);
}

function sendQuickMessage(type) {
    if (type === 'appointment') {
        addUserMessage('Quiero agendar una cita');
        startChatBooking();
        return;
    }

    const messages = {
        services: '�Qu� servicios ofrecen?',
        prices: '�Cu�les son los precios?',
        telemedicine: '�C�mo funciona la consulta online?',
        human: 'Quiero hablar con un doctor real',
        acne: 'Tengo problemas de acn�',
        laser: 'Informaci�n sobre tratamientos l�ser',
        location: '�D�nde est�n ubicados?'
    };

    const message = messages[type] || type;
    addUserMessage(message);

    processWithKimi(message);
}

function addUserMessage(text) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user"></i></div>
        <div class="message-content"><p>${escapeHtml(text)}</p></div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    chatHistory.push({ type: 'user', text, time: new Date().toISOString() });
    try { localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); } catch(e) {}

    // Agregar al contexto de conversaci�n (evitar duplicados)
    const lastMsg = conversationContext[conversationContext.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
        conversationContext.push({ role: 'user', content: text });
    }
}

function sanitizeBotHtml(html) {
    const allowed = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'button', 'input', 'span', 'small'];
    const allowedAttrs = {
        'a': ['href', 'target', 'rel'],
        'button': ['class', 'data-action'],
        'div': ['class', 'style'],
        'input': ['type', 'id', 'min', 'style', 'value'],
        'i': ['class'],
        'span': ['class', 'style'],
        'small': ['class']
    };

    // Convertir onclick inline a data-action antes de sanitizar
    const safeHtml = html
        .replace(/onclick="handleChatBookingSelection\('([^']+)'\)"/g, 'data-action="chat-booking" data-value="$1"')
        .replace(/onclick="sendQuickMessage\('([^']+)'\)"/g, 'data-action="quick-message" data-value="$1"')
        .replace(/onclick="handleChatDateSelect\(this\.value\)"/g, 'data-action="chat-date-select"')
        .replace(/onclick="minimizeChatbot\(\)"/g, 'data-action="minimize-chat"')
        .replace(/onclick="startChatBooking\(\)"/g, 'data-action="start-booking"');

    const div = document.createElement('div');
    div.innerHTML = safeHtml;
    div.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (!allowed.includes(tag)) {
            el.replaceWith(document.createTextNode(el.textContent));
        } else {
            const keep = [...(allowedAttrs[tag] || []), 'data-action', 'data-value'];
            Array.from(el.attributes).forEach(attr => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) el.removeAttribute('href');
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
            // Eliminar cualquier atributo on* que haya pasado
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        }
    });
    return div.innerHTML;
}

function addBotMessage(html, showOfflineLabel = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const safeHtml = sanitizeBotHtml(html);

    // Verificar si el ultimo mensaje es identico (evitar duplicados en UI)
    const lastMessage = messagesContainer.querySelector('.chat-message.bot:last-child');
    if (lastMessage) {
        const lastContent = lastMessage.querySelector('.message-content');
        if (lastContent && lastContent.innerHTML === safeHtml) {
            debugLog('⚠️ Mensaje duplicado detectado, no se muestra');
            return;
        }
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';
    
    // Solo mostrar indicador offline si se solicita expl�citamente (para debug)
    const offlineIndicator = showOfflineLabel ? 
        `<div style="font-size: 0.7rem; color: #86868b; margin-bottom: 4px; opacity: 0.7;">
            <i class="fas fa-robot"></i> Asistente Virtual
        </div>` : '';
    
    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="message-content">${offlineIndicator}${safeHtml}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Guardar en historial
    chatHistory.push({ type: 'bot', text: safeHtml, time: new Date().toISOString() });
    try { localStorage.setItem('chatHistory', JSON.stringify(chatHistory)); } catch(e) {}
}

// Delegated event handler for sanitized chat actions (replaces inline onclick)
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

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot typing';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// BOOKING CONVERSACIONAL DESDE CHATBOT (DEFERRED MODULE)
// ========================================
const CHAT_BOOKING_ENGINE_URL = '/chat-booking-engine.js?v=figo-chat-booking-20260218-phase1';

function getChatBookingEngineDeps() {
    return {
        addBotMessage,
        addUserMessage,
        showTypingIndicator,
        removeTypingIndicator,
        loadAvailabilityData,
        getBookedSlots,
        startCheckoutSession,
        completeCheckoutSession,
        createAppointmentRecord,
        showToast,
        trackEvent,
        escapeHtml,
        minimizeChatbot,
        openPaymentModal,
        getCurrentLang: () => currentLang,
        setCurrentAppointment: (appointment) => {
            currentAppointment = appointment;
        }
    };
}

function loadChatBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-booking-engine',
        src: CHAT_BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-chat-booking-engine',
        resolveModule: () => window.PielChatBookingEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatBookingEngineDeps()),
        missingApiError: 'chat-booking-engine loaded without API',
        loadError: 'No se pudo cargar chat-booking-engine.js',
        logLabel: 'Chat booking engine'
    });
}

function initChatBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatBookingEngine());

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#quickOptions [data-action="quick-message"][data-value="appointment"]', 'mouseenter', warmup);
    bindWarmupTarget('#quickOptions [data-action="quick-message"][data-value="appointment"]', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1700
    });
}

function startChatBooking() {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.startChatBooking(),
        () => {
            addBotMessage('No pude iniciar la reserva por chat. Puedes continuar desde <a href="#citas" data-action="minimize-chat">el formulario</a>.');
        }
    );
}

function cancelChatBooking() {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.cancelChatBooking(),
        () => {
            addBotMessage('No se pudo cancelar la reserva en este momento.');
        }
    );
}

function handleChatBookingSelection(value) {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatBookingSelection(value),
        () => {
            addBotMessage('No pude procesar esa opcion. Intenta nuevamente.');
        }
    );
}

function handleChatDateSelect(value) {
    if (!value) {
        return;
    }

    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatDateSelect(value),
        () => {
            addBotMessage('No pude procesar esa fecha. Intenta nuevamente.');
        }
    );
}

function processChatBookingStep(userInput) {
    return withDeferredModule(loadChatBookingEngine, (engine) => engine.processChatBookingStep(userInput));
}

function finalizeChatBooking() {
    return withDeferredModule(loadChatBookingEngine, (engine) => engine.finalizeChatBooking());
}

function isChatBookingActive() {
    if (window.PielChatBookingEngine && typeof window.PielChatBookingEngine.isActive === 'function') {
        return window.PielChatBookingEngine.isActive();
    }
    return false;
}

// ========================================
// INTEGRACION CON BOT DEL SERVIDOR (DEFERRED)
// ========================================

function loadFigoChatEngine() {
    return loadDeferredModule({
        cacheKey: 'figo-chat-engine',
        src: '/chat-engine.js?v=figo-chat-20260218-phase2',
        scriptDataAttribute: 'data-figo-chat-engine',
        resolveModule: () => window.FigoChatEngine,
        isModuleReady: (module) => !!module,
        missingApiError: 'Figo chat engine loaded without API',
        loadError: 'No se pudo cargar chat-engine.js'
    });
}

function initChatEngineWarmup() {
    const warmup = createWarmupRunner(() => loadFigoChatEngine(), { markWarmOnSuccess: true });

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup);

    scheduleDeferredTask(warmup, {
        idleTimeout: 7000,
        fallbackDelay: 7000
    });
}

const UI_EFFECTS_URL = '/ui-effects.js?v=figo-ui-20260218-phase4';

function loadUiEffects() {
    return loadDeferredModule({
        cacheKey: 'ui-effects',
        src: UI_EFFECTS_URL,
        scriptDataAttribute: 'data-ui-effects',
        resolveModule: () => window.PielUiEffects,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(),
        missingApiError: 'ui-effects loaded without API',
        loadError: 'No se pudo cargar ui-effects.js',
        logLabel: 'UI effects'
    });
}

function initUiEffectsWarmup() {
    const warmup = createWarmupRunner(() => loadUiEffects());

    bindWarmupTarget('.nav', 'mouseenter', warmup);
    bindWarmupTarget('.nav', 'touchstart', warmup);

    const triggerOnce = () => warmup();
    window.addEventListener('scroll', triggerOnce, { once: true, passive: true });
    window.addEventListener('pointerdown', triggerOnce, { once: true, passive: true });

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 1200
    });
}
async function processWithKimi(message) {
    return runDeferredModule(
        loadFigoChatEngine,
        (engine) => engine.processWithKimi(message),
        (error) => {
            console.error('Error cargando motor de chat:', error);
            removeTypingIndicator();
            addBotMessage('No se pudo iniciar el asistente en este momento. Intenta de nuevo o escribenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.', false);
        }
    );
}

function resetConversation() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.resetConversation(), () => {
        showToast('No se pudo reiniciar la conversacion.', 'warning');
    });
}

function forzarModoIA() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.forzarModoIA(), () => {
        showToast('No se pudo activar modo IA.', 'warning');
    });
}

function mostrarInfoDebug() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.mostrarInfoDebug(), () => {
        showToast('No se pudo mostrar informacion de debug.', 'warning');
    });
}

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}

setTimeout(() => {
    const notification = document.getElementById('chatNotification');
    if (notification && !chatbotOpen && chatHistory.length === 0) {
        notification.style.display = 'flex';
    }
}, 30000);
// ========================================
// REPROGRAMACION ONLINE
// ========================================
const RESCHEDULE_ENGINE_URL = '/reschedule-engine.js?v=figo-reschedule-20260218-phase4';

function getRescheduleEngineDeps() {
    return {
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: () => currentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice()
    };
}

function loadRescheduleEngine() {
    return loadDeferredModule({
        cacheKey: 'reschedule-engine',
        src: RESCHEDULE_ENGINE_URL,
        scriptDataAttribute: 'data-reschedule-engine',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar reschedule-engine.js',
        logLabel: 'Reschedule engine'
    });
}

function initRescheduleEngineWarmup() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('reschedule')) {
        return;
    }

    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.checkRescheduleParam(),
        () => {
            showToast(currentLang === 'es' ? 'No se pudo cargar la reprogramacion.' : 'Unable to load reschedule flow.', 'error');
        }
    );
}

async function checkRescheduleParam() {
    return withDeferredModule(loadRescheduleEngine, (engine) => engine.checkRescheduleParam());
}

function openRescheduleModal(appt) {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.openRescheduleModal(appt));
}

function closeRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) {
        modal.classList.remove('active');
    }

    runDeferredModule(loadRescheduleEngine, (engine) => engine.closeRescheduleModal());
}

function loadRescheduleSlots() {
    return runDeferredModule(loadRescheduleEngine, (engine) => engine.loadRescheduleSlots());
}

function submitReschedule() {
    runDeferredModule(loadRescheduleEngine, (engine) => engine.submitReschedule(), () => {
        showToast(currentLang === 'es' ? 'No se pudo reprogramar en este momento.' : 'Unable to reschedule right now.', 'error');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initDeferredStylesheetLoading();
    initThemeMode();
    changeLanguage(currentLang);
    initCookieBanner();
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
});
