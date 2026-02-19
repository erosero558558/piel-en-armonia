/**
 * PIEL EN ARMONIA - Apple Design
 * Todas las funcionalidades integradas
 * 
 * Incluye:
 * - Toast notifications
 * - Loading states
 * - Exportar a calendario
 * - Validacion de disponibilidad
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
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Informacion'
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

function bindWarmupTargetsBatch(handler, bindings = []) {
    if (typeof handler !== 'function' || !Array.isArray(bindings) || bindings.length === 0) {
        return false;
    }

    let hasBoundTarget = false;
    bindings.forEach((binding) => {
        if (!binding || typeof binding.selector !== 'string' || typeof binding.eventName !== 'string') {
            return;
        }
        const passive = binding.passive !== false;
        const bound = bindWarmupTarget(binding.selector, binding.eventName, handler, passive);
        if (bound) {
            hasBoundTarget = true;
        }
    });

    return hasBoundTarget;
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

function observeWarmupForSection(sectionElement, warmup, rootMargin = '0px', threshold = 0.05) {
    return observeOnceWhenVisible(sectionElement, warmup, {
        threshold,
        rootMargin,
        onNoObserver: warmup
    });
}

function bindChatWarmupTriggers(warmup, options = {}) {
    const includeQuickAppointment = options.includeQuickAppointment === true;
    const focusPassive = options.focusPassive === true;
    const bindings = [
        { selector: '#chatbotWidget .chatbot-toggle', eventName: 'mouseenter' },
        { selector: '#chatbotWidget .chatbot-toggle', eventName: 'touchstart' },
        { selector: '#chatInput', eventName: 'focus', passive: focusPassive }
    ];

    if (includeQuickAppointment) {
        bindings.splice(2, 0,
            { selector: '#quickOptions [data-action="quick-message"][data-value="appointment"]', eventName: 'mouseenter' },
            { selector: '#quickOptions [data-action="quick-message"][data-value="appointment"]', eventName: 'touchstart' }
        );
    }

    return bindWarmupTargetsBatch(warmup, bindings);
}

function createEngineLoader(config = {}) {
    const {
        cacheKey,
        src,
        scriptDataAttribute,
        resolveModule,
        depsFactory,
        onModuleReady,
        isModuleReady = (module) => !!(module && typeof module.init === 'function'),
        missingApiError = 'Deferred engine loaded without API',
        loadError = 'No se pudo cargar el motor diferido',
        logLabel = ''
    } = config;

    return function loadEngineModule() {
        const initHandler = typeof onModuleReady === 'function'
            ? onModuleReady
            : (typeof depsFactory === 'function'
                ? (module) => module.init(depsFactory())
                : undefined);

        return loadDeferredModule({
            cacheKey,
            src,
            scriptDataAttribute,
            resolveModule,
            isModuleReady,
            onModuleReady: initHandler,
            missingApiError,
            loadError,
            logLabel
        });
    };
}

const DEFERRED_STYLESHEET_URL = '/styles-deferred.css?v=ui-20260219-deferred12-cspinline1-stateclass1';

let deferredStylesheetPromise = null;
let deferredStylesheetInitDone = false;

function resolveDeferredStylesheetUrl() {
    const preload = document.querySelector('link[rel="preload"][as="style"][href*="styles-deferred.css"]');
    if (preload) {
        const href = preload.getAttribute('href');
        if (href && href.trim() !== '') {
            return href;
        }
    }
    return DEFERRED_STYLESHEET_URL;
}

function loadDeferredStylesheet() {
    if (document.querySelector('link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]')) {
        return Promise.resolve(true);
    }

    if (deferredStylesheetPromise) {
        return deferredStylesheetPromise;
    }

    const stylesheetUrl = resolveDeferredStylesheetUrl();

    deferredStylesheetPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheetUrl;
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
const I18N_ENGINE_URL = '/i18n-engine.js?v=figo-i18n-20260219-phase1';

let currentLang = localStorage.getItem('language') || 'es';
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
let currentThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
const THEME_ENGINE_URL = '/theme-engine.js?v=figo-theme-20260219-phase1';
const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
const CLINIC_MAP_URL = 'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
const MAX_CASE_PHOTOS = 3;
const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
const CASE_PHOTO_UPLOAD_CONCURRENCY = 2;
const CASE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
const CONSENT_ENGINE_URL = '/consent-engine.js?v=figo-consent-20260219-phase1';
const ANALYTICS_ENGINE_URL = '/analytics-engine.js?v=figo-analytics-20260219-phase1';
const ANALYTICS_GATEWAY_ENGINE_URL = '/analytics-gateway-engine.js?v=figo-analytics-gateway-20260219-phase1';
const DEFAULT_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
let currentAppointment = null;
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const DATA_ENGINE_URL = '/data-engine.js?v=figo-data-20260219-phase1';
const DATA_GATEWAY_ENGINE_URL = '/data-gateway-engine.js?v=figo-data-gateway-20260219-phase1';

function getI18nEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        setCurrentLang: (lang) => {
            currentLang = lang === 'en' ? 'en' : 'es';
        },
        showToast,
        getReviewsCache,
        renderPublicReviews,
        debugLog
    };
}

const loadI18nEngine = createEngineLoader({
    cacheKey: 'i18n-engine',
    src: I18N_ENGINE_URL,
    scriptDataAttribute: 'data-i18n-engine',
    resolveModule: () => window.PielI18nEngine,
    depsFactory: getI18nEngineDeps,
    missingApiError: 'i18n-engine loaded without API',
    loadError: 'No se pudo cargar i18n-engine.js',
    logLabel: 'I18n engine'
});

function initEnglishBundleWarmup() {
    const warmup = () => {
        withDeferredModule(loadI18nEngine, (engine) => engine.ensureEnglishTranslations()).catch(() => undefined);
    };

    const enBtn = document.querySelector('.lang-btn[data-lang="en"]');
    if (enBtn) {
        enBtn.addEventListener('mouseenter', warmup, { once: true, passive: true });
        enBtn.addEventListener('touchstart', warmup, { once: true, passive: true });
        enBtn.addEventListener('focus', warmup, { once: true });
    }
}

const BOOKING_ENGINE_URL = '/booking-engine.js?v=figo-booking-20260218-phase1-analytics2-transferretry2-stateclass1';
const BOOKING_MEDIA_ENGINE_URL = '/booking-media-engine.js?v=figo-booking-media-20260219-phase1';
const PAYMENT_GATEWAY_ENGINE_URL = '/payment-gateway-engine.js?v=figo-payment-gateway-20260219-phase1';
let stripeSdkFallbackPromise = null;

function getPaymentGatewayEngineDeps() {
    return {
        apiRequest
    };
}

const loadPaymentGatewayEngine = createEngineLoader({
    cacheKey: 'payment-gateway-engine',
    src: PAYMENT_GATEWAY_ENGINE_URL,
    scriptDataAttribute: 'data-payment-gateway-engine',
    resolveModule: () => window.PielPaymentGatewayEngine,
    depsFactory: getPaymentGatewayEngineDeps,
    missingApiError: 'payment-gateway-engine loaded without API',
    loadError: 'No se pudo cargar payment-gateway-engine.js',
    logLabel: 'Payment gateway engine'
});

function getBookingMediaEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        uploadTransferProof,
        maxCasePhotos: MAX_CASE_PHOTOS,
        maxCasePhotoBytes: MAX_CASE_PHOTO_BYTES,
        uploadConcurrency: CASE_PHOTO_UPLOAD_CONCURRENCY,
        allowedCasePhotoTypes: Array.from(CASE_PHOTO_ALLOWED_TYPES)
    };
}

const loadBookingMediaEngine = createEngineLoader({
    cacheKey: 'booking-media-engine',
    src: BOOKING_MEDIA_ENGINE_URL,
    scriptDataAttribute: 'data-booking-media-engine',
    resolveModule: () => window.PielBookingMediaEngine,
    depsFactory: getBookingMediaEngineDeps,
    missingApiError: 'booking-media-engine loaded without API',
    loadError: 'No se pudo cargar booking-media-engine.js',
    logLabel: 'Booking media engine'
});

function getBookingEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        getCurrentAppointment: () => currentAppointment,
        setCurrentAppointment: (appointment) => {
            currentAppointment = appointment;
        },
        getCheckoutSession,
        setCheckoutSessionActive,
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

const loadBookingEngine = createEngineLoader({
    cacheKey: 'booking-engine',
    src: BOOKING_ENGINE_URL,
    scriptDataAttribute: 'data-booking-engine',
    resolveModule: () => window.PielBookingEngine,
    depsFactory: getBookingEngineDeps,
    missingApiError: 'Booking engine loaded without API',
    loadError: 'No se pudo cargar booking-engine.js',
    logLabel: 'Booking engine'
});

function initBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingEngine(), { markWarmOnSuccess: true });

    const selectors = [
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]'
    ];

    const bindings = selectors.flatMap((selector) => ([
        { selector, eventName: 'mouseenter' },
        { selector, eventName: 'focus', passive: false },
        { selector, eventName: 'touchstart' }
    ]));
    bindWarmupTargetsBatch(warmup, bindings);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1100
    });
}

function initBookingMediaEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingMediaEngine(), { markWarmOnSuccess: true });

    bindWarmupTargetsBatch(warmup, [
        { selector: '#appointmentForm', eventName: 'focusin', passive: false },
        { selector: '#appointmentForm', eventName: 'pointerdown' }
    ]);

    const bookingSection = document.getElementById('citas');
    observeWarmupForSection(bookingSection, warmup, '300px 0px');

    scheduleDeferredTask(warmup, {
        idleTimeout: 2200,
        fallbackDelay: 1000
    });
}

function initPaymentGatewayEngineWarmup() {
    const warmup = createWarmupRunner(() => loadPaymentGatewayEngine(), { markWarmOnSuccess: true });

    bindWarmupTargetsBatch(warmup, [
        { selector: '.payment-method[data-method="card"]', eventName: 'pointerdown' },
        { selector: '#appointmentForm button[type="submit"]', eventName: 'pointerdown' },
        { selector: '#appointmentForm button[type="submit"]', eventName: 'focus', passive: false }
    ]);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1200
    });
}

if (!VALID_THEME_MODES.has(currentThemeMode)) {
    currentThemeMode = 'system';
}

function getThemeEngineDeps() {
    return {
        getCurrentThemeMode: () => currentThemeMode,
        setCurrentThemeMode: (mode) => {
            currentThemeMode = VALID_THEME_MODES.has(mode) ? mode : 'system';
        },
        themeStorageKey: THEME_STORAGE_KEY,
        validThemeModes: Array.from(VALID_THEME_MODES),
        getSystemThemeQuery: () => systemThemeQuery
    };
}

const loadThemeEngine = createEngineLoader({
    cacheKey: 'theme-engine',
    src: THEME_ENGINE_URL,
    scriptDataAttribute: 'data-theme-engine',
    resolveModule: () => window.PielThemeEngine,
    depsFactory: getThemeEngineDeps,
    missingApiError: 'theme-engine loaded without API',
    loadError: 'No se pudo cargar theme-engine.js',
    logLabel: 'Theme engine'
});

function setThemeMode(mode) {
    runDeferredModule(loadThemeEngine, (engine) => engine.setThemeMode(mode));
}

function initThemeMode() {
    runDeferredModule(loadThemeEngine, (engine) => engine.initThemeMode());
}

function getConsentEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        showToast,
        trackEvent,
        cookieConsentKey: COOKIE_CONSENT_KEY,
        gaMeasurementId: 'G-GYY8PE5M8W'
    };
}

const loadConsentEngine = createEngineLoader({
    cacheKey: 'consent-engine',
    src: CONSENT_ENGINE_URL,
    scriptDataAttribute: 'data-consent-engine',
    resolveModule: () => window.PielConsentEngine,
    depsFactory: getConsentEngineDeps,
    missingApiError: 'consent-engine loaded without API',
    loadError: 'No se pudo cargar consent-engine.js',
    logLabel: 'Consent engine'
});

function getCookieConsent() {
    if (window.PielConsentEngine && typeof window.PielConsentEngine.getCookieConsent === 'function') {
        return window.PielConsentEngine.getCookieConsent();
    }

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
    return runDeferredModule(loadConsentEngine, (engine) => engine.setCookieConsent(status), () => {
        const normalized = status === 'accepted' ? 'accepted' : 'rejected';
        try {
            localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
                status: normalized,
                at: new Date().toISOString()
            }));
        } catch (error) {
            // noop
        }
    });
}

function getAnalyticsEngineDeps() {
    return {
        observeOnceWhenVisible,
        loadAvailabilityData,
        loadPublicReviews
    };
}

const loadAnalyticsEngine = createEngineLoader({
    cacheKey: 'analytics-engine',
    src: ANALYTICS_ENGINE_URL,
    scriptDataAttribute: 'data-analytics-engine',
    resolveModule: () => window.PielAnalyticsEngine,
    depsFactory: getAnalyticsEngineDeps,
    missingApiError: 'analytics-engine loaded without API',
    loadError: 'No se pudo cargar analytics-engine.js',
    logLabel: 'Analytics engine'
});

function trackEvent(eventName, params = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.trackEvent(eventName, params));
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
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.markBookingViewed(source));
}

function prefetchAvailabilityData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.prefetchAvailabilityData(source));
}

function prefetchReviewsData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.prefetchReviewsData(source));
}

function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.initBookingFunnelObserver());
}

function initDeferredSectionPrefetch() {
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.initDeferredSectionPrefetch());
}

function startCheckoutSession(appointment) {
    checkoutSessionFallback = {
        active: true,
        completed: false,
        startedAt: Date.now(),
        service: appointment?.service || '',
        doctor: appointment?.doctor || ''
    };

    runDeferredModule(loadAnalyticsEngine, (engine) => engine.startCheckoutSession(appointment));
}

function getCheckoutSession() {
    if (window.PielAnalyticsEngine && typeof window.PielAnalyticsEngine.getCheckoutSession === 'function') {
        const session = window.PielAnalyticsEngine.getCheckoutSession();
        if (session && typeof session === 'object') {
            checkoutSessionFallback = {
                active: session.active === true,
                completed: session.completed === true,
                startedAt: Number(session.startedAt) || 0,
                service: String(session.service || ''),
                doctor: String(session.doctor || '')
            };
        }
    }

    return checkoutSessionFallback;
}

function setCheckoutSessionActive(active) {
    checkoutSessionFallback.active = active === true;
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.setCheckoutSessionActive(active));
}

function completeCheckoutSession(method) {
    if (!checkoutSessionFallback.active) {
        return;
    }
    checkoutSessionFallback.completed = true;
    runDeferredModule(loadAnalyticsEngine, (engine) => engine.completeCheckoutSession(method));
}

function maybeTrackCheckoutAbandon(reason = 'unknown') {
    if (!checkoutSessionFallback.active || checkoutSessionFallback.completed) {
        return;
    }

    runDeferredModule(loadAnalyticsEngine, (engine) => engine.maybeTrackCheckoutAbandon(reason));
}

function getDataEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        showToast,
        storageGetJSON,
        storageSetJSON
    };
}

const loadDataEngine = createEngineLoader({
    cacheKey: 'data-engine',
    src: DATA_ENGINE_URL,
    scriptDataAttribute: 'data-data-engine',
    resolveModule: () => window.PielDataEngine,
    depsFactory: getDataEngineDeps,
    missingApiError: 'data-engine loaded without API',
    loadError: 'No se pudo cargar data-engine.js',
    logLabel: 'Data engine'
});

function getDataGatewayEngineDeps() {
    return {
        loadDataEngine,
        getDataEngine: () => window.PielDataEngine
    };
}

const loadDataGatewayEngine = createEngineLoader({
    cacheKey: 'data-gateway-engine',
    src: DATA_GATEWAY_ENGINE_URL,
    scriptDataAttribute: 'data-data-gateway-engine',
    resolveModule: () => window.PielDataGatewayEngine,
    depsFactory: getDataGatewayEngineDeps,
    missingApiError: 'data-gateway-engine loaded without API',
    loadError: 'No se pudo cargar data-gateway-engine.js',
    logLabel: 'Data gateway engine'
});

function initDataEngineWarmup() {
    const warmup = createWarmupRunner(() => loadDataEngine(), { markWarmOnSuccess: true });

    bindWarmupTargetsBatch(warmup, [
        { selector: '#appointmentForm', eventName: 'focusin', passive: false },
        { selector: '#appointmentForm', eventName: 'pointerdown' },
        { selector: '#chatbotWidget .chatbot-toggle', eventName: 'pointerdown' }
    ]);

    const bookingSection = document.getElementById('citas');
    observeWarmupForSection(bookingSection, warmup, '260px 0px');

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 900
    });
}

function initDataGatewayEngineWarmup() {
    const warmup = createWarmupRunner(() => loadDataGatewayEngine(), { markWarmOnSuccess: true });

    bindWarmupTargetsBatch(warmup, [
        { selector: '#appointmentForm', eventName: 'focusin', passive: false },
        { selector: '#appointmentForm', eventName: 'pointerdown' },
        { selector: '#chatbotWidget .chatbot-toggle', eventName: 'pointerdown' }
    ]);

    scheduleDeferredTask(warmup, {
        idleTimeout: 1900,
        fallbackDelay: 950
    });
}

function initGA4() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initGA4());
}

function initCookieBanner() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initCookieBanner());
}

function disablePlaceholderExternalLinks() {
    document.querySelectorAll('a[href^="URL_"]').forEach((anchor) => {
        anchor.removeAttribute('href');
        anchor.setAttribute('aria-disabled', 'true');
        anchor.classList.add('is-disabled-link');
    });
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

function runDataGatewayAction(actionName, args = [], onError) {
    return runDeferredModule(
        loadDataGatewayEngine,
        (engine) => {
            if (!engine || typeof engine[actionName] !== 'function') {
                throw new Error(`Data gateway action unavailable: ${actionName}`);
            }
            return engine[actionName].apply(engine, Array.isArray(args) ? args : []);
        },
        onError
    );
}

async function apiRequest(resource, options = {}) {
    return runDataGatewayAction('apiRequest', [resource, options], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.apiRequest(resource, options));
    });
}

function getPaymentGatewayEngineApi() {
    const engine = window.PielPaymentGatewayEngine;
    if (
        engine
        && typeof engine.loadPaymentConfig === 'function'
        && typeof engine.loadStripeSdk === 'function'
        && typeof engine.createPaymentIntent === 'function'
        && typeof engine.verifyPaymentIntent === 'function'
    ) {
        return engine;
    }
    return null;
}

async function loadPaymentConfig() {
    const engine = getPaymentGatewayEngineApi();
    if (engine) {
        return engine.loadPaymentConfig();
    }

    return runDeferredModule(
        loadPaymentGatewayEngine,
        (gateway) => gateway.loadPaymentConfig(),
        async () => {
            try {
                const payload = await apiRequest('payment-config');
                return {
                    enabled: payload.enabled === true,
                    provider: payload.provider || 'stripe',
                    publishableKey: payload.publishableKey || '',
                    currency: payload.currency || 'USD'
                };
            } catch (_) {
                return { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
            }
        }
    );
}

async function loadStripeSdk() {
    const engine = getPaymentGatewayEngineApi();
    if (engine) {
        return engine.loadStripeSdk();
    }

    return runDeferredModule(
        loadPaymentGatewayEngine,
        (gateway) => gateway.loadStripeSdk(),
        () => {
            if (typeof window.Stripe === 'function') {
                return true;
            }

            if (stripeSdkFallbackPromise) {
                return stripeSdkFallbackPromise;
            }

            stripeSdkFallbackPromise = new Promise((resolve, reject) => {
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
            }).catch((error) => {
                stripeSdkFallbackPromise = null;
                throw error;
            });

            return stripeSdkFallbackPromise;
        }
    );
}

async function createPaymentIntent(appointment) {
    const engine = getPaymentGatewayEngineApi();
    if (engine) {
        return engine.createPaymentIntent(appointment);
    }

    return runDeferredModule(
        loadPaymentGatewayEngine,
        (gateway) => gateway.createPaymentIntent(appointment),
        () => apiRequest('payment-intent', {
            method: 'POST',
            body: appointment
        })
    );
}

async function verifyPaymentIntent(paymentIntentId) {
    const engine = getPaymentGatewayEngineApi();
    if (engine) {
        return engine.verifyPaymentIntent(paymentIntentId);
    }

    return runDeferredModule(
        loadPaymentGatewayEngine,
        (gateway) => gateway.verifyPaymentIntent(paymentIntentId),
        () => apiRequest('payment-verify', {
            method: 'POST',
            body: { paymentIntentId }
        })
    );
}

async function uploadTransferProof(file, options = {}) {
    return runDataGatewayAction('uploadTransferProof', [file, options], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.uploadTransferProof(file, options));
    });
}

function getCasePhotoFiles(formElement) {
    const engine = getBookingMediaEngineApi();
    if (engine && typeof engine.getCasePhotoFiles === 'function') {
        return engine.getCasePhotoFiles(formElement);
    }

    const input = formElement?.querySelector('#casePhotos');
    if (!input || !input.files) return [];
    return Array.from(input.files);
}

function validateCasePhotoFiles(files) {
    const engine = getBookingMediaEngineApi();
    if (engine && typeof engine.validateCasePhotoFiles === 'function') {
        engine.validateCasePhotoFiles(files);
        return;
    }

    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            currentLang === 'es'
                ? `Puedes subir m\u00E1ximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                currentLang === 'es'
                    ? `Cada foto debe pesar m\u00E1ximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
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

function getBookingMediaEngineApi() {
    const engine = window.PielBookingMediaEngine;
    if (
        engine
        && typeof engine.buildAppointmentPayload === 'function'
        && typeof engine.stripTransientAppointmentFields === 'function'
    ) {
        return engine;
    }
    return null;
}

function stripTransientAppointmentFields(appointment) {
    const engine = getBookingMediaEngineApi();
    if (engine) {
        return engine.stripTransientAppointmentFields(appointment);
    }

    const payload = { ...(appointment || {}) };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

function mapStoredCasePhotoUploads(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { names: [], urls: [], paths: [] };
    }
    return {
        names: items.map((item) => String(item?.name || '')).filter(Boolean),
        urls: items.map((item) => String(item?.url || '')).filter(Boolean),
        paths: items.map((item) => String(item?.path || '')).filter(Boolean)
    };
}

async function buildAppointmentPayload(appointment) {
    return runDeferredModule(
        loadBookingMediaEngine,
        (engine) => engine.buildAppointmentPayload(appointment),
        () => {
            const pendingFiles = Array.isArray(appointment?.casePhotoFiles) ? appointment.casePhotoFiles : [];
            const existingUploads = Array.isArray(appointment?.casePhotoUploads) ? appointment.casePhotoUploads : [];
            if (pendingFiles.length > 0 && existingUploads.length === 0) {
                throw new Error(
                    currentLang === 'es'
                        ? 'No se pudieron preparar las imagenes adjuntas. Intenta de nuevo.'
                        : 'Unable to process attached images. Please try again.'
                );
            }

            const payload = stripTransientAppointmentFields(appointment || {});
            const uploadedPhotos = mapStoredCasePhotoUploads(existingUploads);
            payload.casePhotoCount = uploadedPhotos.urls.length;
            payload.casePhotoNames = uploadedPhotos.names;
            payload.casePhotoUrls = uploadedPhotos.urls;
            payload.casePhotoPaths = uploadedPhotos.paths;
            return payload;
        }
    );
}

function invalidateBookedSlotsCache(date = '', doctor = '') {
    runDataGatewayAction('invalidateBookedSlotsCache', [date, doctor], () => {
        if (window.PielDataEngine && typeof window.PielDataEngine.invalidateBookedSlotsCache === 'function') {
            window.PielDataEngine.invalidateBookedSlotsCache(date, doctor);
            return;
        }
        runDeferredModule(loadDataEngine, (dataEngine) => dataEngine.invalidateBookedSlotsCache(date, doctor));
    });
}

async function loadAvailabilityData(options = {}) {
    return runDataGatewayAction('loadAvailabilityData', [options], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.loadAvailabilityData(options));
    });
}

async function getBookedSlots(date, doctor = '') {
    return runDataGatewayAction('getBookedSlots', [date, doctor], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.getBookedSlots(date, doctor));
    });
}

async function createAppointmentRecord(appointment, options = {}) {
    return runDataGatewayAction('createAppointmentRecord', [appointment, options], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.createAppointmentRecord(appointment, options));
    });
}

async function createCallbackRecord(callback) {
    return runDataGatewayAction('createCallbackRecord', [callback], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.createCallbackRecord(callback));
    });
}

async function createReviewRecord(review) {
    return runDataGatewayAction('createReviewRecord', [review], () => {
        return withDeferredModule(loadDataEngine, (dataEngine) => dataEngine.createReviewRecord(review));
    });
}

const REVIEWS_ENGINE_URL = '/reviews-engine.js?v=figo-reviews-20260219-phase1';

function getReviewsEngineDeps() {
    return {
        apiRequest,
        storageGetJSON,
        escapeHtml,
        getCurrentLang: () => currentLang
    };
}

const loadReviewsEngine = createEngineLoader({
    cacheKey: 'reviews-engine',
    src: REVIEWS_ENGINE_URL,
    scriptDataAttribute: 'data-reviews-engine',
    resolveModule: () => window.PielReviewsEngine,
    depsFactory: getReviewsEngineDeps,
    missingApiError: 'reviews-engine loaded without API',
    loadError: 'No se pudo cargar reviews-engine.js',
    logLabel: 'Reviews engine'
});

function getReviewsCache() {
    if (window.PielReviewsEngine && typeof window.PielReviewsEngine.getCache === 'function') {
        return window.PielReviewsEngine.getCache();
    }
    return [];
}

function setReviewsCache(items) {
    runDeferredModule(loadReviewsEngine, (engine) => engine.setCache(items));
}

function renderPublicReviews(reviews) {
    runDeferredModule(loadReviewsEngine, (engine) => engine.renderPublicReviews(reviews));
}

function loadPublicReviews(options = {}) {
    return withDeferredModule(loadReviewsEngine, (engine) => engine.loadPublicReviews(options));
}

function initReviewsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadReviewsEngine(), { markWarmOnSuccess: true });

    const reviewSection = document.getElementById('resenas');
    observeWarmupForSection(reviewSection, warmup, '300px 0px');

    bindWarmupTargetsBatch(warmup, [
        { selector: '#resenas', eventName: 'mouseenter' },
        { selector: '#resenas', eventName: 'touchstart' },
        { selector: '#resenas [data-action="open-review-modal"]', eventName: 'focus', passive: false }
    ]);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2200,
        fallbackDelay: 1300
    });
}

async function changeLanguage(lang) {
    return withDeferredModule(loadI18nEngine, (engine) => engine.changeLanguage(lang));
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

const loadGalleryInteractions = createEngineLoader({
    cacheKey: 'gallery-interactions',
    src: GALLERY_INTERACTIONS_URL,
    scriptDataAttribute: 'data-gallery-interactions',
    resolveModule: () => window.PielGalleryInteractions,
    onModuleReady: (module) => module.init(),
    missingApiError: 'gallery-interactions loaded without API',
    loadError: 'No se pudo cargar gallery-interactions.js',
    logLabel: 'Gallery interactions'
});

function initGalleryInteractionsWarmup() {
    const warmup = createWarmupRunner(() => loadGalleryInteractions());

    const gallerySection = document.getElementById('galeria');
    observeWarmupForSection(gallerySection, warmup, '320px 0px');

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
const BOOKING_UI_URL = '/booking-ui.js?v=figo-booking-ui-20260218-phase4-stateclass1';

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

const loadBookingUiCore = createEngineLoader({
    cacheKey: 'booking-ui',
    src: BOOKING_UI_URL,
    scriptDataAttribute: 'data-booking-ui',
    resolveModule: () => window.PielBookingUi,
    depsFactory: getBookingUiDeps,
    missingApiError: 'booking-ui loaded without API',
    loadError: 'No se pudo cargar booking-ui.js',
    logLabel: 'Booking UI'
});

function loadBookingUi() {
    return withDeferredModule(loadBookingMediaEngine, () => loadBookingUiCore());
}

function initBookingUiWarmup() {
    const warmup = createWarmupRunner(() => loadBookingUi());

    const bookingSection = document.getElementById('citas');
    observeWarmupForSection(bookingSection, warmup, '320px 0px');

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
const UI_BRIDGE_ENGINE_URL = '/ui-bridge-engine.js?v=figo-ui-bridge-20260219-phase1';

function runUiBridgeAction(actionName, args = [], onError) {
    return runDeferredModule(
        loadUiBridgeEngine,
        (engine) => {
            if (!engine || typeof engine[actionName] !== 'function') {
                throw new Error(`UI bridge action unavailable: ${actionName}`);
            }
            return engine[actionName].apply(engine, Array.isArray(args) ? args : []);
        },
        onError
    );
}

function openPaymentModal(appointmentData) {
    runUiBridgeAction('openPaymentModal', [appointmentData], () => {
        showToast('No se pudo abrir el modulo de pago.', 'error');
    });
}

function closePaymentModal(options = {}) {
    runUiBridgeAction('closePaymentModal', [options], () => {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    });
}

async function processPayment() {
    return runUiBridgeAction('processPayment', [], () => {
        showToast('No se pudo procesar el pago en este momento.', 'error');
    });
}

// ========================================
// SUCCESS MODAL (DEFERRED MODULE)
// ========================================
const SUCCESS_MODAL_ENGINE_URL = '/success-modal-engine.js?v=figo-success-modal-20260218-phase1-inlineclass1';

function getSuccessModalEngineDeps() {
    return {
        getCurrentLang: () => currentLang,
        getCurrentAppointment: () => currentAppointment,
        getClinicAddress: () => CLINIC_ADDRESS,
        escapeHtml
    };
}

const loadSuccessModalEngine = createEngineLoader({
    cacheKey: 'success-modal-engine',
    src: SUCCESS_MODAL_ENGINE_URL,
    scriptDataAttribute: 'data-success-modal-engine',
    resolveModule: () => window.PielSuccessModalEngine,
    depsFactory: getSuccessModalEngineDeps,
    missingApiError: 'success-modal-engine loaded without API',
    loadError: 'No se pudo cargar success-modal-engine.js',
    logLabel: 'Success modal engine'
});

function initSuccessModalEngineWarmup() {
    const warmup = createWarmupRunner(() => loadSuccessModalEngine());

    bindWarmupTargetsBatch(warmup, [
        { selector: '#appointmentForm button[type="submit"]', eventName: 'pointerdown' },
        { selector: '#appointmentForm button[type="submit"]', eventName: 'focus', passive: false },
        { selector: '.payment-method', eventName: 'pointerdown' }
    ]);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2800,
        fallbackDelay: 1600
    });
}

function showSuccessModal(emailSent = false) {
    runUiBridgeAction('showSuccessModal', [emailSent], () => {
        showToast('No se pudo abrir la confirmacion de cita.', 'error');
    });
}

function closeSuccessModal() {
    runUiBridgeAction('closeSuccessModal', [], () => {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    });
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
        getReviewsCache,
        setReviewsCache
    };
}

const loadEngagementFormsModule = createEngineLoader({
    cacheKey: 'engagement-forms-engine',
    src: ENGAGEMENT_FORMS_ENGINE_URL,
    scriptDataAttribute: 'data-engagement-forms-engine',
    resolveModule: () => window.PielEngagementFormsEngine,
    depsFactory: getEngagementFormsEngineDeps,
    missingApiError: 'engagement-forms-engine loaded without API',
    loadError: 'No se pudo cargar engagement-forms-engine.js',
    logLabel: 'Engagement forms engine'
});

function loadEngagementFormsEngine() {
    return loadReviewsEngine().then(() => loadEngagementFormsModule());
}

function initEngagementFormsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadEngagementFormsEngine());

    bindWarmupTargetsBatch(warmup, [
        { selector: '#callbackForm', eventName: 'focusin', passive: false },
        { selector: '#callbackForm', eventName: 'pointerdown' },
        { selector: '#resenas [data-action="open-review-modal"]', eventName: 'mouseenter' },
        { selector: '#resenas [data-action="open-review-modal"]', eventName: 'touchstart' }
    ]);

    if (document.getElementById('callbackForm')) {
        setTimeout(warmup, 120);
    }

    const reviewSection = document.getElementById('resenas');
    observeWarmupForSection(reviewSection, warmup, '280px 0px');

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1500
    });
}

function openReviewModal() {
    runUiBridgeAction('openReviewModal', [], () => {
        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });
}

function closeReviewModal() {
    runUiBridgeAction('closeReviewModal', [], () => {
        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    });
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

const loadModalUxEngine = createEngineLoader({
    cacheKey: 'modal-ux-engine',
    src: MODAL_UX_ENGINE_URL,
    scriptDataAttribute: 'data-modal-ux-engine',
    resolveModule: () => window.PielModalUxEngine,
    depsFactory: getModalUxEngineDeps,
    missingApiError: 'modal-ux-engine loaded without API',
    loadError: 'No se pudo cargar modal-ux-engine.js',
    logLabel: 'Modal UX engine'
});

function initModalUxEngineWarmup() {
    const warmup = createWarmupRunner(() => loadModalUxEngine());

    bindWarmupTargetsBatch(warmup, [
        { selector: '.modal', eventName: 'pointerdown' },
        { selector: '.modal-close', eventName: 'pointerdown' }
    ]);

    if (document.querySelector('.modal')) {
        setTimeout(warmup, 180);
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 2200,
        fallbackDelay: 1200
    });
}

// ========================================
// CHATBOT CON FIGO
// ========================================
let chatbotOpen = false;
const CHAT_STATE_ENGINE_URL = '/chat-state-engine.js?v=figo-chat-state-20260219-phase1';
const CHAT_UI_ENGINE_URL = '/chat-ui-engine.js?v=figo-chat-ui-20260219-phase1';
const CHAT_WIDGET_ENGINE_URL = '/chat-widget-engine.js?v=figo-chat-widget-20260219-phase2-notification1';
const ACTION_ROUTER_ENGINE_URL = '/action-router-engine.js?v=figo-action-router-20260219-phase1';

function createChatStateFallback() {
    const historyStorageKey = 'chatHistory';
    const historyTtlMs = 24 * 60 * 60 * 1000;
    const historyMaxItems = 50;
    const contextMaxItems = 24;
    let chatHistory = [];
    let conversationContext = [];

    return {
        getChatHistory: () => chatHistory,
        setChatHistory: (nextHistory) => {
            chatHistory = Array.isArray(nextHistory) ? nextHistory : [];
        },
        getConversationContext: () => conversationContext,
        setConversationContext: (nextContext) => {
            conversationContext = Array.isArray(nextContext) ? nextContext : [];
        },
        getChatHistoryLength: () => chatHistory.length,
        getHistoryStorageKey: () => historyStorageKey,
        getHistoryTtlMs: () => historyTtlMs,
        getHistoryMaxItems: () => historyMaxItems,
        getContextMaxItems: () => contextMaxItems
    };
}

const chatStateFallback = createChatStateFallback();

function getChatStateManager() {
    const module = window.PielChatStateEngine;
    if (
        module
        && typeof module.getChatHistory === 'function'
        && typeof module.setChatHistory === 'function'
        && typeof module.getConversationContext === 'function'
        && typeof module.setConversationContext === 'function'
    ) {
        return module;
    }
    return chatStateFallback;
}

function getChatStateEngineDeps() {
    return {
        historyStorageKey: chatStateFallback.getHistoryStorageKey(),
        historyTtlMs: chatStateFallback.getHistoryTtlMs(),
        historyMaxItems: chatStateFallback.getHistoryMaxItems(),
        contextMaxItems: chatStateFallback.getContextMaxItems(),
        debugLog
    };
}

const loadChatStateEngine = createEngineLoader({
    cacheKey: 'chat-state-engine',
    src: CHAT_STATE_ENGINE_URL,
    scriptDataAttribute: 'data-chat-state-engine',
    resolveModule: () => window.PielChatStateEngine,
    depsFactory: getChatStateEngineDeps,
    missingApiError: 'chat-state-engine loaded without API',
    loadError: 'No se pudo cargar chat-state-engine.js',
    logLabel: 'Chat state engine'
});

function ensureChatStateEngine() {
    return runDeferredModule(loadChatStateEngine, (engine) => engine, () => getChatStateManager());
}

function getChatUiEngineDeps() {
    return {
        getChatHistory: () => getChatStateManager().getChatHistory(),
        setChatHistory: (nextHistory) => getChatStateManager().setChatHistory(nextHistory),
        getConversationContext: () => getChatStateManager().getConversationContext(),
        setConversationContext: (nextContext) => getChatStateManager().setConversationContext(nextContext),
        historyStorageKey: getChatStateManager().getHistoryStorageKey(),
        historyTtlMs: getChatStateManager().getHistoryTtlMs(),
        historyMaxItems: getChatStateManager().getHistoryMaxItems(),
        contextMaxItems: getChatStateManager().getContextMaxItems(),
        debugLog
    };
}

const loadChatUiEngineCore = createEngineLoader({
    cacheKey: 'chat-ui-engine',
    src: CHAT_UI_ENGINE_URL,
    scriptDataAttribute: 'data-chat-ui-engine',
    resolveModule: () => window.PielChatUiEngine,
    depsFactory: getChatUiEngineDeps,
    missingApiError: 'chat-ui-engine loaded without API',
    loadError: 'No se pudo cargar chat-ui-engine.js',
    logLabel: 'Chat UI engine'
});

function loadChatUiEngine() {
    return withDeferredModule(ensureChatStateEngine, () => loadChatUiEngineCore());
}

function initChatUiEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatUiEngine(), { markWarmOnSuccess: true });
    bindChatWarmupTriggers(warmup, { focusPassive: false });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1300
    });
}

function getChatWidgetEngineDeps() {
    return {
        getChatbotOpen: () => chatbotOpen,
        setChatbotOpen: (isOpen) => {
            chatbotOpen = isOpen === true;
        },
        getChatHistoryLength: () => getChatStateManager().getChatHistoryLength(),
        warmChatUi: () => runDeferredModule(loadChatUiEngine, () => undefined),
        scrollToBottom,
        trackEvent,
        debugLog,
        addBotMessage,
        addUserMessage,
        processWithKimi,
        startChatBooking
    };
}

const loadChatWidgetEngineCore = createEngineLoader({
    cacheKey: 'chat-widget-engine',
    src: CHAT_WIDGET_ENGINE_URL,
    scriptDataAttribute: 'data-chat-widget-engine',
    resolveModule: () => window.PielChatWidgetEngine,
    depsFactory: getChatWidgetEngineDeps,
    missingApiError: 'chat-widget-engine loaded without API',
    loadError: 'No se pudo cargar chat-widget-engine.js',
    logLabel: 'Chat widget engine'
});

function loadChatWidgetEngine() {
    return withDeferredModule(ensureChatStateEngine, () => loadChatWidgetEngineCore());
}

function initChatWidgetEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatWidgetEngine(), { markWarmOnSuccess: true });
    bindChatWarmupTriggers(warmup, { focusPassive: false });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1300
    });
}

function getActionRouterEngineDeps() {
    return {
        setThemeMode,
        changeLanguage,
        toggleMobileMenu,
        startWebVideo,
        openReviewModal,
        closeReviewModal,
        closeVideoModal,
        closePaymentModal,
        processPayment,
        closeSuccessModal,
        closeRescheduleModal,
        submitReschedule,
        toggleChatbot,
        sendChatMessage,
        handleChatBookingSelection,
        sendQuickMessage,
        minimizeChatbot,
        startChatBooking,
        handleChatDateSelect
    };
}

const loadActionRouterEngine = createEngineLoader({
    cacheKey: 'action-router-engine',
    src: ACTION_ROUTER_ENGINE_URL,
    scriptDataAttribute: 'data-action-router-engine',
    resolveModule: () => window.PielActionRouterEngine,
    depsFactory: getActionRouterEngineDeps,
    missingApiError: 'action-router-engine loaded without API',
    loadError: 'No se pudo cargar action-router-engine.js',
    logLabel: 'Action router engine'
});

function initActionRouterEngine() {
    runDeferredModule(loadActionRouterEngine, () => undefined, (error) => {
        debugLog('Action router load failed:', error);
    });
}

function toggleChatbot() {
    runDeferredModule(loadChatWidgetEngine, (engine) => engine.toggleChatbot(), () => {
        const container = document.getElementById('chatbotContainer');
        if (!container) {
            return;
        }
        chatbotOpen = !chatbotOpen;
        container.classList.toggle('active', chatbotOpen);
    });
}

function minimizeChatbot() {
    runDeferredModule(loadChatWidgetEngine, (engine) => engine.minimizeChatbot(), () => {
        const container = document.getElementById('chatbotContainer');
        if (container) {
            container.classList.remove('active');
        }
        chatbotOpen = false;
    });
}

function handleChatKeypress(event) {
    runDeferredModule(loadChatWidgetEngine, (engine) => engine.handleChatKeypress(event), () => {
        if (event && event.key === 'Enter') {
            sendChatMessage();
        }
    });
}

async function sendChatMessage() {
    return runDeferredModule(loadChatWidgetEngine, (engine) => engine.sendChatMessage(), async () => {
        const input = document.getElementById('chatInput');
        if (!input) {
            return;
        }
        const message = String(input.value || '').trim();
        if (!message) {
            return;
        }
        await Promise.resolve(addUserMessage(message)).catch(() => undefined);
        input.value = '';
        await processWithKimi(message);
    });
}

function sendQuickMessage(type) {
    runDeferredModule(loadChatWidgetEngine, (engine) => engine.sendQuickMessage(type), () => {
        if (type === 'appointment') {
            Promise.resolve(addUserMessage('Quiero agendar una cita')).catch(() => undefined);
            startChatBooking();
            return;
        }
        const quickMessages = {
            services: 'Que servicios ofrecen?',
            prices: 'Cuales son los precios?',
            telemedicine: 'Como funciona la consulta online?',
            human: 'Quiero hablar con un doctor real',
            acne: 'Tengo problemas de acne',
            laser: 'Informacion sobre tratamientos laser',
            location: 'Donde estan ubicados?'
        };
        const message = quickMessages[type] || type;
        Promise.resolve(addUserMessage(message)).catch(() => undefined);
        processWithKimi(message);
    });
}

function addUserMessage(text) {
    return withDeferredModule(loadChatUiEngine, (engine) => engine.addUserMessage(text));
}

function addBotMessage(html, showOfflineLabel = false) {
    return runDeferredModule(loadChatUiEngine, (engine) => engine.addBotMessage(html, showOfflineLabel));
}
function showTypingIndicator() {
    runDeferredModule(loadChatUiEngine, (engine) => engine.showTypingIndicator());
}

function removeTypingIndicator() {
    runDeferredModule(loadChatUiEngine, (engine) => engine.removeTypingIndicator());
}

function scrollToBottom() {
    if (window.PielChatUiEngine && typeof window.PielChatUiEngine.scrollToBottom === 'function') {
        window.PielChatUiEngine.scrollToBottom();
        return;
    }
    const container = document.getElementById('chatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(text) {
    if (window.PielChatUiEngine && typeof window.PielChatUiEngine.escapeHtml === 'function') {
        return window.PielChatUiEngine.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// BOOKING CONVERSACIONAL DESDE CHATBOT (DEFERRED MODULE)
// ========================================
const CHAT_BOOKING_ENGINE_URL = '/chat-booking-engine.js?v=figo-chat-booking-20260219-phase2-inlinefix1';

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

const loadChatBookingEngine = createEngineLoader({
    cacheKey: 'chat-booking-engine',
    src: CHAT_BOOKING_ENGINE_URL,
    scriptDataAttribute: 'data-chat-booking-engine',
    resolveModule: () => window.PielChatBookingEngine,
    depsFactory: getChatBookingEngineDeps,
    missingApiError: 'chat-booking-engine loaded without API',
    loadError: 'No se pudo cargar chat-booking-engine.js',
    logLabel: 'Chat booking engine'
});

function initChatBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatBookingEngine());
    bindChatWarmupTriggers(warmup, {
        includeQuickAppointment: true,
        focusPassive: false
    });

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

const loadFigoChatEngine = createEngineLoader({
    cacheKey: 'figo-chat-engine',
    src: '/chat-engine.js?v=figo-chat-20260219-phase3-runtimeconfig1-contextcap1',
    scriptDataAttribute: 'data-figo-chat-engine',
    resolveModule: () => window.FigoChatEngine,
    isModuleReady: (module) => !!module,
    missingApiError: 'Figo chat engine loaded without API',
    loadError: 'No se pudo cargar chat-engine.js'
});

function initChatEngineWarmup() {
    const warmup = createWarmupRunner(() => loadFigoChatEngine(), { markWarmOnSuccess: true });
    bindChatWarmupTriggers(warmup, { focusPassive: true });

    scheduleDeferredTask(warmup, {
        idleTimeout: 7000,
        fallbackDelay: 7000
    });
}

const UI_EFFECTS_URL = '/ui-effects.js?v=figo-ui-20260218-phase4';

const loadUiEffects = createEngineLoader({
    cacheKey: 'ui-effects',
    src: UI_EFFECTS_URL,
    scriptDataAttribute: 'data-ui-effects',
    resolveModule: () => window.PielUiEffects,
    onModuleReady: (module) => module.init(),
    missingApiError: 'ui-effects loaded without API',
    loadError: 'No se pudo cargar ui-effects.js',
    logLabel: 'UI effects'
});

function initUiEffectsWarmup() {
    const warmup = createWarmupRunner(() => loadUiEffects());
    bindWarmupTargetsBatch(warmup, [
        { selector: '.nav', eventName: 'mouseenter' },
        { selector: '.nav', eventName: 'touchstart' }
    ]);

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

runDeferredModule(loadChatWidgetEngine, (engine) => engine.scheduleInitialNotification(30000));
const APP_BOOTSTRAP_ENGINE_URL = '/app-bootstrap-engine.js?v=figo-bootstrap-20260219-phase2-events4';
// ========================================
// REPROGRAMACION ONLINE
// ========================================
const RESCHEDULE_GATEWAY_ENGINE_URL = '/reschedule-gateway-engine.js?v=figo-reschedule-gateway-20260219-phase1';

function getRescheduleGatewayEngineDeps() {
    return {
        loadDeferredModule,
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

const loadRescheduleGatewayEngine = createEngineLoader({
    cacheKey: 'reschedule-gateway-engine',
    src: RESCHEDULE_GATEWAY_ENGINE_URL,
    scriptDataAttribute: 'data-reschedule-gateway-engine',
    resolveModule: () => window.PielRescheduleGatewayEngine,
    depsFactory: getRescheduleGatewayEngineDeps,
    missingApiError: 'reschedule-gateway-engine loaded without API',
    loadError: 'No se pudo cargar reschedule-gateway-engine.js',
    logLabel: 'Reschedule gateway engine'
});

function getUiBridgeEngineDeps() {
    return {
        runDeferredModule,
        loadBookingEngine,
        loadSuccessModalEngine,
        loadEngagementFormsEngine,
        loadRescheduleGatewayEngine,
        maybeTrackCheckoutAbandon,
        setCheckoutSessionActive,
        showToast,
        debugLog,
        getCurrentLang: () => currentLang
    };
}

const loadUiBridgeEngine = createEngineLoader({
    cacheKey: 'ui-bridge-engine',
    src: UI_BRIDGE_ENGINE_URL,
    scriptDataAttribute: 'data-ui-bridge-engine',
    resolveModule: () => window.PielUiBridgeEngine,
    depsFactory: getUiBridgeEngineDeps,
    missingApiError: 'ui-bridge-engine loaded without API',
    loadError: 'No se pudo cargar ui-bridge-engine.js',
    logLabel: 'UI bridge engine'
});

function initRescheduleEngineWarmup() {
    runDeferredModule(
        loadRescheduleGatewayEngine,
        (engine) => engine.initRescheduleFromParam(),
        () => {
            showToast(currentLang === 'es' ? 'No se pudo cargar la reprogramacion.' : 'Unable to load reschedule flow.', 'error');
        }
    );
}

function closeRescheduleModal() {
    runUiBridgeAction('closeRescheduleModal', [], () => {
        const modal = document.getElementById('rescheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }
    });
}

function submitReschedule() {
    runUiBridgeAction('submitReschedule', [], () => {
        showToast(currentLang === 'es' ? 'No se pudo reprogramar en este momento.' : 'Unable to reschedule right now.', 'error');
    });
}

function getAppBootstrapEngineDeps() {
    return {
        disablePlaceholderExternalLinks,
        initActionRouterEngine,
        initDeferredStylesheetLoading,
        initThemeMode,
        getCurrentLang: () => currentLang,
        changeLanguage,
        initCookieBanner,
        initGA4,
        initBookingFunnelObserver,
        initDeferredSectionPrefetch,
        createOnceTask,
        scheduleDeferredTask,
        initEnglishBundleWarmup,
        initDataEngineWarmup,
        initDataGatewayEngineWarmup,
        initBookingEngineWarmup,
        initBookingMediaEngineWarmup,
        initPaymentGatewayEngineWarmup,
        initBookingUiWarmup,
        initReviewsEngineWarmup,
        initGalleryInteractionsWarmup,
        initChatUiEngineWarmup,
        initChatWidgetEngineWarmup,
        initChatEngineWarmup,
        initChatBookingEngineWarmup,
        initUiEffectsWarmup,
        initRescheduleEngineWarmup,
        initSuccessModalEngineWarmup,
        initEngagementFormsEngineWarmup,
        initModalUxEngineWarmup,
        handleChatKeypress,
        maybeTrackCheckoutAbandon,
        trackEvent,
        showToast
    };
}

const loadAppBootstrapEngine = createEngineLoader({
    cacheKey: 'app-bootstrap-engine',
    src: APP_BOOTSTRAP_ENGINE_URL,
    scriptDataAttribute: 'data-app-bootstrap-engine',
    resolveModule: () => window.PielAppBootstrapEngine,
    isModuleReady: (module) => !!(module && typeof module.init === 'function' && typeof module.start === 'function'),
    depsFactory: getAppBootstrapEngineDeps,
    missingApiError: 'app-bootstrap-engine loaded without API',
    loadError: 'No se pudo cargar app-bootstrap-engine.js',
    logLabel: 'App bootstrap engine'
});

function startAppBootstrap() {
    runDeferredModule(loadAppBootstrapEngine, (engine) => engine.start(), () => {
        const bindFallback = () => {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', handleChatKeypress);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindFallback, { once: true });
            return;
        }
        bindFallback();
    });
}

startAppBootstrap();

