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
// build-sync: 20260219-sync1

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

        import(src)
            .then(() => {
                if (!document.querySelector('script[' + scriptDataAttribute + '="true"]')) {
                    const marker = document.createElement('script');
                    marker.setAttribute(scriptDataAttribute, 'true');
                    marker.dataset.dynamicImport = 'true';
                    document.head.appendChild(marker);
                }
                handleLoad();
            })
            .catch((err) => {
                debugLog(logLabel + ' dynamic import failed:', err);
                reject(new Error(loadError));
            });
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

const DEFERRED_STYLESHEET_URL = '/styles-deferred.css?v=ui-20260220-deferred13-chatmobilefix1';

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
function resolveDeployAssetVersion() {
    try {
        if (document.currentScript && typeof document.currentScript.src === 'string' && document.currentScript.src !== '') {
            const currentUrl = new URL(document.currentScript.src, window.location.href);
            const fromCurrent = currentUrl.searchParams.get('v');
            if (fromCurrent) {
                return fromCurrent;
            }
        }

        const scriptEl = document.querySelector('script[src*="script.js"]');
        if (scriptEl && typeof scriptEl.getAttribute === 'function') {
            const rawSrc = scriptEl.getAttribute('src') || '';
            if (rawSrc) {
                const parsed = new URL(rawSrc, window.location.href);
                const fromTag = parsed.searchParams.get('v');
                if (fromTag) {
                    return fromTag;
                }
            }
        }
    } catch (_) {
        return '';
    }

    return '';
}

function withDeployAssetVersion(url) {
    const cleanUrl = String(url || '').trim();
    if (cleanUrl === '') {
        return cleanUrl;
    }

    const deployVersion = window.__PA_DEPLOY_ASSET_VERSION__ || '';
    if (!deployVersion) {
        return cleanUrl;
    }

    try {
        const resolved = new URL(cleanUrl, window.location.origin);
        resolved.searchParams.set('cv', deployVersion);
        if (cleanUrl.startsWith('/')) {
            return resolved.pathname + resolved.search;
        }
        return resolved.toString();
    } catch (_) {
        const separator = cleanUrl.indexOf('?') >= 0 ? '&' : '?';
        return cleanUrl + separator + 'cv=' + encodeURIComponent(deployVersion);
    }
}

window.__PA_DEPLOY_ASSET_VERSION__ = window.__PA_DEPLOY_ASSET_VERSION__ || resolveDeployAssetVersion();
const I18N_ENGINE_URL = withDeployAssetVersion('/i18n-engine.js?v=figo-i18n-20260219-phase1-sync1');

let currentLang = localStorage.getItem('language') || 'es';
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
let currentThemeMode = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
const THEME_ENGINE_URL = withDeployAssetVersion('/theme-engine.js?v=figo-theme-20260219-phase1');
const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
const CLINIC_MAP_URL = 'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
const MAX_CASE_PHOTOS = 3;
const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
const CASE_PHOTO_UPLOAD_CONCURRENCY = 2;
const CASE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
const CONSENT_ENGINE_URL = withDeployAssetVersion('/consent-engine.js?v=figo-consent-20260219-phase1');
const ANALYTICS_ENGINE_URL = withDeployAssetVersion('/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1');
const FUNNEL_EVENT_ENDPOINT = '/api.php?resource=funnel-event';
const FUNNEL_SERVER_EVENTS = new Set([
    'view_booking',
    'start_checkout',
    'payment_method_selected',
    'payment_success',
    'booking_confirmed',
    'checkout_abandon',
    'booking_step_completed',
    'booking_error',
    'checkout_error',
    'chat_started',
    'chat_handoff_whatsapp',
    'whatsapp_click'
]);
const FUNNEL_SERVER_ALLOWED_PARAMS = new Set([
    'source',
    'step',
    'payment_method',
    'checkout_entry',
    'checkout_step',
    'reason',
    'error_code'
]);
const FUNNEL_EVENT_DEDUP_MS = 1200;
const funnelEventLastSentAt = new Map();
let checkoutSessionFallback = {
    active: false,
    completed: false,
    startedAt: 0,
    service: '',
    doctor: '',
    step: '',
    entry: '',
    paymentMethod: ''
};
const DEFAULT_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
let currentAppointment = null;
let paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeSdkPromise = null;
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const DATA_ENGINE_URL = withDeployAssetVersion('/data-engine.js?v=figo-data-20260219-phase1');

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

function loadI18nEngine() {
    return loadDeferredModule({
        cacheKey: 'i18n-engine',
        src: I18N_ENGINE_URL,
        scriptDataAttribute: 'data-i18n-engine',
        resolveModule: () => window.PielI18nEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getI18nEngineDeps()),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine.js',
        logLabel: 'I18n engine'
    });
}

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

const BOOKING_ENGINE_URL = withDeployAssetVersion('/booking-engine.js?v=figo-booking-20260219-mbfix1');

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
        setCheckoutStep,
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

function loadThemeEngine() {
    return loadDeferredModule({
        cacheKey: 'theme-engine',
        src: THEME_ENGINE_URL,
        scriptDataAttribute: 'data-theme-engine',
        resolveModule: () => window.PielThemeEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getThemeEngineDeps()),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine'
    });
}

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

function loadConsentEngine() {
    return loadDeferredModule({
        cacheKey: 'consent-engine',
        src: CONSENT_ENGINE_URL,
        scriptDataAttribute: 'data-consent-engine',
        resolveModule: () => window.PielConsentEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getConsentEngineDeps()),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine'
    });
}

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
        loadPublicReviews,
        trackEventToServer: sendFunnelEventToServer
    };
}

function loadAnalyticsEngine() {
    return loadDeferredModule({
        cacheKey: 'analytics-engine',
        src: ANALYTICS_ENGINE_URL,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.PielAnalyticsEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getAnalyticsEngineDeps()),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine'
    });
}

function normalizeFunnelLabelClient(value, fallback = 'unknown') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const normalized = String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);

    return normalized || fallback;
}

function buildFunnelServerParams(params = {}) {
    const sourceRaw = params && typeof params === 'object' ? params.source : undefined;
    const normalized = {
        source: normalizeFunnelLabelClient(sourceRaw, 'unknown')
    };

    if (!params || typeof params !== 'object') {
        return normalized;
    }

    FUNNEL_SERVER_ALLOWED_PARAMS.forEach((key) => {
        if (key === 'source') {
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            return;
        }
        normalized[key] = normalizeFunnelLabelClient(params[key], 'unknown');
    });

    return normalized;
}

function sendFunnelEventToServer(eventName, params = {}) {
    const normalizedEvent = normalizeFunnelLabelClient(eventName, '');
    if (!FUNNEL_SERVER_EVENTS.has(normalizedEvent)) {
        return;
    }
    if (window.location.protocol === 'file:') {
        return;
    }

    const serverParams = buildFunnelServerParams(params);
    const dedupKey = [
        normalizedEvent,
        serverParams.step || '',
        serverParams.payment_method || '',
        serverParams.checkout_step || serverParams.step || '',
        serverParams.reason || '',
        serverParams.source || ''
    ].join('|');

    const now = Date.now();
    const previousAt = funnelEventLastSentAt.get(dedupKey) || 0;
    if (now - previousAt < FUNNEL_EVENT_DEDUP_MS) {
        return;
    }
    funnelEventLastSentAt.set(dedupKey, now);

    const payload = JSON.stringify({
        event: normalizedEvent,
        params: serverParams
    });

    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const sent = navigator.sendBeacon(FUNNEL_EVENT_ENDPOINT, blob);
            if (sent) {
                return;
            }
        }
    } catch (_) {
        // Fallback to fetch below.
    }

    fetch(FUNNEL_EVENT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: payload,
        keepalive: true,
        credentials: 'same-origin'
    }).catch(() => undefined);
}

function trackEvent(eventName, params = {}) {
    sendFunnelEventToServer(eventName, params);
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

function startCheckoutSession(appointment, metadata = {}) {
    const checkoutEntry = normalizeAnalyticsLabel(
        metadata && (metadata.checkoutEntry || metadata.entry),
        'unknown'
    );
    const initialStep = normalizeAnalyticsLabel(
        metadata && metadata.step,
        'checkout_started'
    );

    checkoutSessionFallback = {
        active: true,
        completed: false,
        startedAt: Date.now(),
        service: appointment?.service || '',
        doctor: appointment?.doctor || '',
        step: initialStep,
        entry: checkoutEntry,
        paymentMethod: ''
    };

    runDeferredModule(loadAnalyticsEngine, (engine) => engine.startCheckoutSession(appointment, metadata));
}

function setCheckoutStep(step, metadata = {}) {
    if (!checkoutSessionFallback.active || checkoutSessionFallback.completed) {
        return;
    }

    checkoutSessionFallback.step = normalizeAnalyticsLabel(step, checkoutSessionFallback.step || 'unknown');
    if (metadata && typeof metadata === 'object') {
        if (metadata.paymentMethod) {
            checkoutSessionFallback.paymentMethod = normalizeAnalyticsLabel(metadata.paymentMethod, 'unknown');
        }
        if (metadata.checkoutEntry || metadata.entry) {
            checkoutSessionFallback.entry = normalizeAnalyticsLabel(
                metadata.checkoutEntry || metadata.entry,
                checkoutSessionFallback.entry || 'unknown'
            );
        }
    }

    runDeferredModule(loadAnalyticsEngine, (engine) => engine.setCheckoutStep(step, metadata));
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
                doctor: String(session.doctor || ''),
                step: String(session.step || ''),
                entry: String(session.entry || ''),
                paymentMethod: String(session.paymentMethod || '')
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
    checkoutSessionFallback.step = 'booking_confirmed';
    checkoutSessionFallback.paymentMethod = normalizeAnalyticsLabel(method, checkoutSessionFallback.paymentMethod || 'unknown');
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

function loadDataEngine() {
    return loadDeferredModule({
        cacheKey: 'data-engine',
        src: DATA_ENGINE_URL,
        scriptDataAttribute: 'data-data-engine',
        resolveModule: () => window.PielDataEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getDataEngineDeps()),
        missingApiError: 'data-engine loaded without API',
        loadError: 'No se pudo cargar data-engine.js',
        logLabel: 'Data engine'
    });
}

function initDataEngineWarmup() {
    const warmup = createWarmupRunner(() => loadDataEngine(), { markWarmOnSuccess: true });

    bindWarmupTarget('#appointmentForm', 'focusin', warmup, false);
    bindWarmupTarget('#appointmentForm', 'pointerdown', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'pointerdown', warmup);

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '260px 0px',
        onNoObserver: warmup
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 900
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

async function apiRequest(resource, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) => engine.apiRequest(resource, options));
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

async function uploadTransferProof(file, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) => engine.uploadTransferProof(file, options));
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

    const uploads = new Array(files.length);
    const workerCount = Math.max(1, Math.min(CASE_PHOTO_UPLOAD_CONCURRENCY, files.length));
    let cursor = 0;

    // Limita concurrencia para no saturar red/servidor durante la reserva.
    const uploadWorker = async () => {
        while (cursor < files.length) {
            const index = cursor;
            cursor += 1;
            const file = files[index];
            const uploaded = await uploadTransferProof(file, { retries: 2 });
            uploads[index] = {
                name: uploaded.transferProofName || file.name || '',
                url: uploaded.transferProofUrl || '',
                path: uploaded.transferProofPath || ''
            };
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => uploadWorker()));
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

function invalidateBookedSlotsCache(date = '', doctor = '') {
    if (window.PielDataEngine && typeof window.PielDataEngine.invalidateBookedSlotsCache === 'function') {
        window.PielDataEngine.invalidateBookedSlotsCache(date, doctor);
        return;
    }
    runDeferredModule(loadDataEngine, (engine) => engine.invalidateBookedSlotsCache(date, doctor));
}

async function loadAvailabilityData(options = {}) {
    return withDeferredModule(loadDataEngine, (engine) => engine.loadAvailabilityData(options));
}

async function getBookedSlots(date, doctor = '') {
    return withDeferredModule(loadDataEngine, (engine) => engine.getBookedSlots(date, doctor));
}

async function createAppointmentRecord(appointment, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) => engine.createAppointmentRecord(appointment, options));
}

async function createCallbackRecord(callback) {
    return withDeferredModule(loadDataEngine, (engine) => engine.createCallbackRecord(callback));
}

async function createReviewRecord(review) {
    return withDeferredModule(loadDataEngine, (engine) => engine.createReviewRecord(review));
}

const REVIEWS_ENGINE_URL = withDeployAssetVersion('/reviews-engine.js?v=figo-reviews-20260219-phase1');

function getReviewsEngineDeps() {
    return {
        apiRequest,
        storageGetJSON,
        escapeHtml,
        getCurrentLang: () => currentLang
    };
}

function loadReviewsEngine() {
    return loadDeferredModule({
        cacheKey: 'reviews-engine',
        src: REVIEWS_ENGINE_URL,
        scriptDataAttribute: 'data-reviews-engine',
        resolveModule: () => window.PielReviewsEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getReviewsEngineDeps()),
        missingApiError: 'reviews-engine loaded without API',
        loadError: 'No se pudo cargar reviews-engine.js',
        logLabel: 'Reviews engine'
    });
}

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
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '300px 0px',
        onNoObserver: warmup
    });

    bindWarmupTarget('#resenas', 'mouseenter', warmup);
    bindWarmupTarget('#resenas', 'touchstart', warmup);
    bindWarmupTarget('#resenas [data-action="open-review-modal"]', 'focus', warmup, false);

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
const GALLERY_INTERACTIONS_URL = withDeployAssetVersion('/gallery-interactions.js?v=figo-gallery-20260218-phase4');

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
const BOOKING_UI_URL = withDeployAssetVersion('/booking-ui.js?v=figo-booking-ui-20260220-sync1');

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
        setCheckoutStep,
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

    setCheckoutSessionActive(false);
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
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
const SUCCESS_MODAL_ENGINE_URL = withDeployAssetVersion('/success-modal-engine.js?v=figo-success-modal-20260218-phase1-inlineclass1-sync1');

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
const ENGAGEMENT_FORMS_ENGINE_URL = withDeployAssetVersion('/engagement-forms-engine.js?v=figo-engagement-20260218-phase1-sync1');

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

function loadEngagementFormsEngine() {
    return loadReviewsEngine().then(() => loadDeferredModule({
        cacheKey: 'engagement-forms-engine',
        src: ENGAGEMENT_FORMS_ENGINE_URL,
        scriptDataAttribute: 'data-engagement-forms-engine',
        resolveModule: () => window.PielEngagementFormsEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getEngagementFormsEngineDeps()),
        missingApiError: 'engagement-forms-engine loaded without API',
        loadError: 'No se pudo cargar engagement-forms-engine.js',
        logLabel: 'Engagement forms engine'
    }));
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
const MODAL_UX_ENGINE_URL = withDeployAssetVersion('/modal-ux-engine.js?v=figo-modal-ux-20260220-phase2-cachefix1');

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

    if (href === '#citas') {
        markBookingViewed('cta_click');
    }

    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
});

function resolveWhatsappSource(waLink) {
    if (!waLink || !(waLink instanceof Element)) return 'unknown';

    const chatContext = waLink.closest('#chatbotContainer, #chatbotWidget');
    if (chatContext) return 'chatbot';

    const section = waLink.closest('section[id], footer[id], footer, .quick-contact-dock');
    if (!section) return 'unknown';

    const sectionId = section.getAttribute('id') || '';
    if (sectionId) return sectionId;
    if (section.classList.contains('quick-contact-dock')) return 'quick_dock';
    if (section.tagName && section.tagName.toLowerCase() === 'footer') return 'footer';
    return 'unknown';
}

document.addEventListener('click', function(e) {
    const targetEl = e.target instanceof Element ? e.target : null;
    if (!targetEl) return;

    const waLink = targetEl.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!waLink) return;

    const source = resolveWhatsappSource(waLink);
    trackEvent('whatsapp_click', { source });

    const inChatContext = !!waLink.closest('#chatbotContainer') || !!waLink.closest('#chatbotWidget');
    if (!inChatContext) return;

    trackEvent('chat_handoff_whatsapp', {
        source
    });
});

// ========================================
// CHATBOT CON FIGO
// ========================================
let chatbotOpen = false;
const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
const CHAT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_MAX_ITEMS = 50;
const CHAT_CONTEXT_MAX_ITEMS = 24;
const CHAT_UI_ENGINE_URL = withDeployAssetVersion('/chat-ui-engine.js?v=figo-chat-ui-20260219-phase1-sync1');
const CHAT_WIDGET_ENGINE_URL = withDeployAssetVersion('/chat-widget-engine.js?v=figo-chat-widget-20260219-phase2-notification2-funnel1-sync1');
const ACTION_ROUTER_ENGINE_URL = withDeployAssetVersion('/action-router-engine.js?v=figo-action-router-20260219-phase1');

function getChatUiEngineDeps() {
    return {
        getChatHistory: () => chatHistory,
        setChatHistory: (nextHistory) => {
            chatHistory = Array.isArray(nextHistory) ? nextHistory : [];
        },
        getConversationContext: () => conversationContext,
        setConversationContext: (nextContext) => {
            conversationContext = Array.isArray(nextContext) ? nextContext : [];
        },
        historyStorageKey: CHAT_HISTORY_STORAGE_KEY,
        historyTtlMs: CHAT_HISTORY_TTL_MS,
        historyMaxItems: CHAT_HISTORY_MAX_ITEMS,
        contextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
        debugLog
    };
}

function loadChatUiEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-ui-engine',
        src: CHAT_UI_ENGINE_URL,
        scriptDataAttribute: 'data-chat-ui-engine',
        resolveModule: () => window.PielChatUiEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatUiEngineDeps()),
        missingApiError: 'chat-ui-engine loaded without API',
        loadError: 'No se pudo cargar chat-ui-engine.js',
        logLabel: 'Chat UI engine'
    });
}

function initChatUiEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatUiEngine(), { markWarmOnSuccess: true });

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);

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
        getChatHistoryLength: () => chatHistory.length,
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

function loadChatWidgetEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-widget-engine',
        src: CHAT_WIDGET_ENGINE_URL,
        scriptDataAttribute: 'data-chat-widget-engine',
        resolveModule: () => window.PielChatWidgetEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatWidgetEngineDeps()),
        missingApiError: 'chat-widget-engine loaded without API',
        loadError: 'No se pudo cargar chat-widget-engine.js',
        logLabel: 'Chat widget engine'
    });
}

function initChatWidgetEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatWidgetEngine(), { markWarmOnSuccess: true });

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);

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
        handleChatDateSelect,
        selectService: (value) => {
            const select = document.getElementById('serviceSelect');
            if (select) {
                select.value = value;
                select.dispatchEvent(new Event('change'));
                markBookingViewed('service_select');
                const appointmentSection = document.getElementById('citas');
                if (appointmentSection) {
                    const navHeight = document.querySelector('.nav')?.offsetHeight || 80;
                    const targetPosition = appointmentSection.offsetTop - navHeight - 20;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        }
    };
}

function loadActionRouterEngine() {
    return loadDeferredModule({
        cacheKey: 'action-router-engine',
        src: ACTION_ROUTER_ENGINE_URL,
        scriptDataAttribute: 'data-action-router-engine',
        resolveModule: () => window.PielActionRouterEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getActionRouterEngineDeps()),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine'
    });
}

function initActionRouterEngine() {
    runDeferredModule(loadActionRouterEngine, () => undefined, (error) => {
        debugLog('Action router load failed:', error);
    });
}

let chatHistory = (function () {
    try {
        const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
        const saved = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(saved) || saved.length === 0) {
            return [];
        }

        const cutoff = Date.now() - CHAT_HISTORY_TTL_MS;
        const filtered = saved.filter((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const ts = entry.time ? new Date(entry.time).getTime() : Number.NaN;
            return Number.isFinite(ts) && ts > cutoff;
        });

        const valid = filtered.length <= CHAT_HISTORY_MAX_ITEMS
            ? filtered
            : filtered.slice(-CHAT_HISTORY_MAX_ITEMS);

        if (valid.length !== saved.length) {
            try {
                localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(valid));
            } catch (error) {
                // noop
            }
        }
        return valid;
    } catch (error) {
        return [];
    }
})();
let conversationContext = [];

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

function scheduleChatNotification() {
    runDeferredModule(loadChatWidgetEngine, (engine) => engine.scheduleInitialNotification(30000));
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
const CHAT_BOOKING_ENGINE_URL = withDeployAssetVersion('/chat-booking-engine.js?v=figo-chat-booking-20260219-mbfix1');

function getChatBookingEngineDeps() {
    return {
        addBotMessage,
        addUserMessage,
        showTypingIndicator,
        removeTypingIndicator,
        loadAvailabilityData,
        getBookedSlots,
        startCheckoutSession,
        setCheckoutStep,
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
        src: '/chat-engine.js?v=figo-chat-20260219-phase3-runtimeconfig1-contextcap1-sync1',
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

const UI_EFFECTS_URL = withDeployAssetVersion('/ui-effects.js?v=figo-ui-20260220-sync2');

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

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}

scheduleChatNotification();
// ========================================
// REPROGRAMACION ONLINE
// ========================================
const RESCHEDULE_GATEWAY_ENGINE_URL = withDeployAssetVersion('/reschedule-gateway-engine.js?v=figo-reschedule-gateway-20260219-phase1');

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

function loadRescheduleGatewayEngine() {
    return loadDeferredModule({
        cacheKey: 'reschedule-gateway-engine',
        src: RESCHEDULE_GATEWAY_ENGINE_URL,
        scriptDataAttribute: 'data-reschedule-gateway-engine',
        resolveModule: () => window.PielRescheduleGatewayEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleGatewayEngineDeps()),
        missingApiError: 'reschedule-gateway-engine loaded without API',
        loadError: 'No se pudo cargar reschedule-gateway-engine.js',
        logLabel: 'Reschedule gateway engine'
    });
}

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
    runDeferredModule(loadRescheduleGatewayEngine, (engine) => engine.closeRescheduleModal(), () => {
        const modal = document.getElementById('rescheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }
    });
}

function submitReschedule() {
    runDeferredModule(loadRescheduleGatewayEngine, (engine) => engine.submitReschedule(), () => {
        showToast(currentLang === 'es' ? 'No se pudo reprogramar en este momento.' : 'Unable to reschedule right now.', 'error');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    disablePlaceholderExternalLinks();
    initActionRouterEngine();
    initDeferredStylesheetLoading();
    initThemeMode();
    changeLanguage(currentLang);
    initCookieBanner();
    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();

    const initDeferredWarmups = createOnceTask(() => {
        initEnglishBundleWarmup();
        initDataEngineWarmup();
        initBookingEngineWarmup();
        initBookingUiWarmup();
        initReviewsEngineWarmup();
        initGalleryInteractionsWarmup();
        initChatUiEngineWarmup();
        initChatWidgetEngineWarmup();
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

