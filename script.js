/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */
let currentLang = localStorage.getItem('language') || 'es';
let currentThemeMode = localStorage.getItem('themeMode') || 'system';
let currentAppointment = null;
let checkoutSession = {
    active: false,
    completed: false,
    startedAt: 0,
    service: '',
    doctor: '',
};
let apiSlowNoticeLastAt = 0;
const bookedSlotsCache = new Map();
let reviewsCache = [];
let paymentConfig = {
    enabled: false,
    provider: 'stripe',
    publishableKey: '',
    currency: 'USD',
};
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeSdkPromise = null;
let chatbotOpen = false;
let conversationContext = [];

function getCurrentLang() {
    return currentLang;
}
function setCurrentLang(lang) {
    currentLang = lang;
}

function getCurrentThemeMode() {
    return currentThemeMode;
}
function setCurrentThemeMode(mode) {
    currentThemeMode = mode;
}

function getCurrentAppointment() {
    return currentAppointment;
}
function setCurrentAppointment(appt) {
    currentAppointment = appt;
}

function getCheckoutSession() {
    return checkoutSession;
}
function setCheckoutSession(session) {
    checkoutSession = session;
}

function getApiSlowNoticeLastAt() {
    return apiSlowNoticeLastAt;
}
function setApiSlowNoticeLastAt(val) {
    apiSlowNoticeLastAt = val;
}

function getReviewsCache() {
    return reviewsCache;
}
function setReviewsCache(val) {
    reviewsCache = val;
}

function getPaymentConfig() {
    return paymentConfig;
}
function setPaymentConfig(val) {
    paymentConfig = val;
}

function getPaymentConfigLoaded() {
    return paymentConfigLoaded;
}
function setPaymentConfigLoaded(val) {
    paymentConfigLoaded = val;
}

function getPaymentConfigLoadedAt() {
    return paymentConfigLoadedAt;
}
function setPaymentConfigLoadedAt(val) {
    paymentConfigLoadedAt = val;
}

function getStripeSdkPromise() {
    return stripeSdkPromise;
}
function setStripeSdkPromise(val) {
    stripeSdkPromise = val;
}

function getChatbotOpen() {
    return chatbotOpen;
}
function setChatbotOpen(val) {
    chatbotOpen = val;
}

function getConversationContext() {
    return conversationContext;
}
function setConversationContext(val) {
    conversationContext = val;
}

function getChatHistory() {
    try {
        const raw = localStorage.getItem('chatHistory');
        const saved = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const valid = saved.filter(
            (m) => m.time && new Date(m.time).getTime() > cutoff
        );
        if (valid.length !== saved.length) {
            try {
                localStorage.setItem('chatHistory', JSON.stringify(valid));
            } catch {
                // noop
            }
        }
        return valid;
    } catch {
        return [];
    }
}
function setChatHistory(history) {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(history));
    } catch {
        // noop
    }
}

const stateAccessors = {
    currentLang: [getCurrentLang, setCurrentLang],
    currentThemeMode: [getCurrentThemeMode, setCurrentThemeMode],
    currentAppointment: [getCurrentAppointment, setCurrentAppointment],
    checkoutSession: [getCheckoutSession, setCheckoutSession],
    reviewsCache: [getReviewsCache, setReviewsCache],
    chatbotOpen: [getChatbotOpen, setChatbotOpen],
    conversationContext: [getConversationContext, setConversationContext],
};

const internalState = {
    bookedSlotsCache,
};

const handler = {
    get(target, prop, receiver) {
        if (prop === 'chatHistory') {
            return getChatHistory();
        }
        if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
            return stateAccessors[prop][0]();
        }
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (prop === 'chatHistory') {
            setChatHistory(value);
            return true;
        }
        if (prop === 'bookedSlotsCache') {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
            stateAccessors[prop][1](value);
            return true;
        }
        return Reflect.set(target, prop, value, receiver);
    },
};

const state = new Proxy(internalState, handler);

const API_ENDPOINT = '/api.php';
const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
const CLINIC_MAP_URL =
    'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
const API_REQUEST_TIMEOUT_MS = 9000;
const API_RETRY_BASE_DELAY_MS = 450;
const API_DEFAULT_RETRIES = 1;
const API_SLOW_NOTICE_MS = 1200;
const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
const THEME_STORAGE_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);

function debugLog() {
    // Debug logging removed
}

function escapeHtml(text) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        typeof window.Piel.ChatUiEngine.escapeHtml === 'function'
    ) {
        return window.Piel.ChatUiEngine.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConstrainedNetworkConnection() {
    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
    return !!(
        connection &&
        (connection.saveData === true ||
            /(^|[^0-9])2g/.test(String(connection.effectiveType || '')))
    );
}

// ASSET VERSIONING
function resolveDeployAssetVersion() {
    try {
        if (
            document.currentScript &&
            typeof document.currentScript.src === 'string' &&
            document.currentScript.src !== ''
        ) {
            const currentUrl = new URL(
                document.currentScript.src,
                window.location.href
            );
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
    } catch (_error) {
        return '';
    }

    return '';
}

function withDeployAssetVersion(url) {
    const cleanUrl = String(url || '').trim();
    if (cleanUrl === '') {
        return cleanUrl;
    }

    const deployVersion = (window.Piel && window.Piel.deployVersion) || '';
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
    } catch (_error) {
        const separator = cleanUrl.indexOf('?') >= 0 ? '&' : '?';
        return cleanUrl + separator + 'cv=' + encodeURIComponent(deployVersion);
    }
}

// TOAST NOTIFICATIONS SYSTEM
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
        info: 'fa-info-circle',
    };

    const titles = {
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Informacion',
    };

    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (_error) {
        return fallback;
    }
}

function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // Ignore storage quota errors.
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
        logLabel = '',
    } = options || {};

    if (
        !cacheKey ||
        !src ||
        !scriptDataAttribute ||
        typeof resolveModule !== 'function'
    ) {
        return Promise.reject(
            new Error('Invalid deferred module configuration')
        );
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
                if (
                    !document.querySelector(
                        'script[' + scriptDataAttribute + '="true"]'
                    )
                ) {
                    const marker = document.createElement('script');
                    marker.setAttribute(scriptDataAttribute, 'true');
                    marker.dataset.dynamicImport = 'true';
                    document.head.appendChild(marker);
                }
                handleLoad();
            })
            .catch((err) => {
                reject(new Error(loadError));
            });
    }).catch((error) => {
        deferredModulePromises.delete(cacheKey);
        throw error;
    });

    deferredModulePromises.set(cacheKey, promise);
    return promise;
}

function scheduleDeferredTask(task, options = {}) {
    const {
        idleTimeout = 2000,
        fallbackDelay = 1200,
        skipOnConstrained = true,
        constrainedDelay = fallbackDelay,
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
            Promise.resolve(loadFn())
                .then(() => {
                    warmed = true;
                })
                .catch(() => undefined);
            return;
        }

        warmed = true;
        Promise.resolve(loadFn()).catch(() => {
            warmed = false;
        });
    };
}

function observeOnceWhenVisible(element, onVisible, options = {}) {
    const { threshold = 0.05, rootMargin = '0px', onNoObserver } = options;

    if (!element) {
        return false;
    }

    if (!('IntersectionObserver' in window)) {
        if (typeof onNoObserver === 'function') {
            onNoObserver();
        }
        return false;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                onVisible(entry);
                observer.disconnect();
            });
        },
        {
            threshold,
            rootMargin,
        }
    );

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

const UI_BUNDLE_URL$1 = withDeployAssetVersion(
    '/js/engines/ui-bundle.js?v=20260220-consolidated1'
);
const systemThemeQuery = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function getThemeEngineDeps() {
    return {
        getCurrentThemeMode: () => state.currentThemeMode,
        setCurrentThemeMode: (mode) => {
            state.currentThemeMode = VALID_THEME_MODES.has(mode) ? mode : 'system';
        },
        themeStorageKey: THEME_STORAGE_KEY,
        validThemeModes: Array.from(VALID_THEME_MODES),
        getSystemThemeQuery: () => systemThemeQuery,
    };
}

function loadThemeEngine() {
    return loadDeferredModule({
        cacheKey: 'theme-engine',
        src: UI_BUNDLE_URL$1,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ThemeEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getThemeEngineDeps()),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine',
    });
}

function setThemeMode(mode) {
    runDeferredModule(loadThemeEngine, (engine) => engine.setThemeMode(mode));
}

function initThemeMode() {
    runDeferredModule(loadThemeEngine, (engine) => engine.initThemeMode());
}

const DATA_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/data-engine.js?v=figo-data-20260219-phase1'
);

function getDataEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        showToast,
        storageGetJSON,
        storageSetJSON,
    };
}

function loadDataEngine() {
    return loadDeferredModule({
        cacheKey: 'data-engine',
        src: DATA_ENGINE_URL,
        scriptDataAttribute: 'data-data-engine',
        resolveModule: () => window.Piel && window.Piel.DataEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getDataEngineDeps()),
        missingApiError: 'data-engine loaded without API',
        loadError: 'No se pudo cargar data-engine.js',
        logLabel: 'Data engine',
    });
}

function initDataEngineWarmup() {
    const warmup = createWarmupRunner(() => loadDataEngine(), {
        markWarmOnSuccess: true,
    });

    bindWarmupTarget('#appointmentForm', 'focusin', warmup, false);
    bindWarmupTarget('#appointmentForm', 'pointerdown', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'pointerdown', warmup);

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '260px 0px',
        onNoObserver: warmup,
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 900,
    });
}

async function apiRequest(resource, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.apiRequest(resource, options)
    );
}

function invalidateBookedSlotsCache(date = '', doctor = '') {
    if (
        window.Piel &&
        window.Piel.DataEngine &&
        typeof window.Piel.DataEngine.invalidateBookedSlotsCache === 'function'
    ) {
        window.Piel.DataEngine.invalidateBookedSlotsCache(date, doctor);
        return;
    }
    withDeferredModule(loadDataEngine, (engine) =>
        engine.invalidateBookedSlotsCache(date, doctor)
    ).catch(() => undefined);
}

async function loadAvailabilityData(options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.loadAvailabilityData(options)
    );
}

async function getBookedSlots(date, doctor = '') {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.getBookedSlots(date, doctor)
    );
}

async function createAppointmentRecord(appointment, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createAppointmentRecord(appointment, options)
    );
}

async function createCallbackRecord(callback) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createCallbackRecord(callback)
    );
}

async function createReviewRecord(review) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createReviewRecord(review)
    );
}

async function uploadTransferProof(file, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.uploadTransferProof(file, options)
    );
}

const ENGAGEMENT_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/engagement-bundle.js?v=20260220-consolidated1'
);

// REVIEWS ENGINE
function getReviewsEngineDeps() {
    return {
        apiRequest,
        storageGetJSON,
        escapeHtml,
        getCurrentLang: getCurrentLang,
    };
}

function loadReviewsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-bundle',
        src: ENGAGEMENT_BUNDLE_URL,
        scriptDataAttribute: 'data-engagement-bundle',
        resolveModule: () => window.Piel && window.Piel.ReviewsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getReviewsEngineDeps()),
        missingApiError: 'reviews-engine loaded without API',
        loadError: 'No se pudo cargar reviews-engine.js',
        logLabel: 'Reviews engine',
    });
}

function initReviewsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadReviewsEngine(), {
        markWarmOnSuccess: true,
    });
    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '300px 0px',
        onNoObserver: warmup,
    });
    bindWarmupTarget('#resenas', 'mouseenter', warmup);
    bindWarmupTarget('#resenas', 'touchstart', warmup);
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'focus',
        warmup,
        false
    );
    scheduleDeferredTask(warmup, { idleTimeout: 2200, fallbackDelay: 1300 });
}

function renderPublicReviews(reviews) {
    runDeferredModule(loadReviewsEngine, (engine) =>
        engine.renderPublicReviews(reviews)
    );
}

function loadPublicReviews(options = {}) {
    return withDeferredModule(loadReviewsEngine, (engine) =>
        engine.loadPublicReviews(options)
    );
}

// ENGAGEMENT FORMS ENGINE
function getEngagementFormsEngineDeps() {
    return {
        createCallbackRecord,
        createReviewRecord,
        renderPublicReviews,
        showToast,
        getCurrentLang: getCurrentLang,
        getReviewsCache,
        setReviewsCache,
    };
}

function loadEngagementFormsEngine() {
    return loadReviewsEngine().then(() =>
        loadDeferredModule({
            cacheKey: 'engagement-forms-engine',
            src: ENGAGEMENT_BUNDLE_URL,
            scriptDataAttribute: 'data-engagement-bundle',
            resolveModule: () => window.Piel && window.Piel.EngagementFormsEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) =>
                module.init(getEngagementFormsEngineDeps()),
            missingApiError: 'engagement-forms-engine loaded without API',
            loadError: 'No se pudo cargar engagement-forms-engine.js',
            logLabel: 'Engagement forms engine',
        })
    );
}

function initEngagementFormsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadEngagementFormsEngine());
    bindWarmupTarget('#callbackForm', 'focusin', warmup, false);
    bindWarmupTarget('#callbackForm', 'pointerdown', warmup);
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'mouseenter',
        warmup
    );
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'touchstart',
        warmup
    );
    if (document.getElementById('callbackForm')) {
        setTimeout(warmup, 120);
    }
    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '280px 0px',
        onNoObserver: warmup,
    });
    scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1500 });
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
    runDeferredModule(loadEngagementFormsEngine, (engine) =>
        engine.closeReviewModal()
    );
}

var engagement = /*#__PURE__*/Object.freeze({
    __proto__: null,
    closeReviewModal: closeReviewModal,
    initEngagementFormsEngineWarmup: initEngagementFormsEngineWarmup,
    initReviewsEngineWarmup: initReviewsEngineWarmup,
    loadEngagementFormsEngine: loadEngagementFormsEngine,
    loadPublicReviews: loadPublicReviews,
    loadReviewsEngine: loadReviewsEngine,
    openReviewModal: openReviewModal,
    renderPublicReviews: renderPublicReviews
});

const DATA_BUNDLE_URL$1 = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260221-api-fix'
);

function getI18nEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        setCurrentLang: (lang) => {
            state.currentLang = (lang === 'en' ? 'en' : 'es');
        },
        showToast,
        getReviewsCache: () => state.reviewsCache,
        renderPublicReviews,
        debugLog,
    };
}

function loadI18nEngine() {
    return loadDeferredModule({
        cacheKey: 'i18n-engine',
        src: DATA_BUNDLE_URL$1,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getI18nEngineDeps()),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine.js',
        logLabel: 'I18n engine',
    });
}

function initEnglishBundleWarmup() {
    const warmup = () => {
        withDeferredModule(loadI18nEngine, (engine) =>
            engine.ensureEnglishTranslations()
        ).catch(() => undefined);
    };

    const enBtn = document.querySelector('.lang-btn[data-lang="en"]');
    if (enBtn) {
        enBtn.addEventListener('mouseenter', warmup, {
            once: true,
            passive: true,
        });
        enBtn.addEventListener('touchstart', warmup, {
            once: true,
            passive: true,
        });
        enBtn.addEventListener('focus', warmup, { once: true });
    }
}

async function changeLanguage(lang) {
    return withDeferredModule(loadI18nEngine, (engine) =>
        engine.changeLanguage(lang)
    );
}

// LAZY LOADED IMPORTS
// import { toggleMobileMenu, startWebVideo, closeVideoModal } from './ui.js';
// import { openReviewModal, closeReviewModal } from './engagement.js';
// import {
//     closePaymentModal,
//     processPayment,
//     markBookingViewed,
// } from './booking.js';
// import { closeSuccessModal } from './success-modal.js';
// import { closeRescheduleModal, submitReschedule } from './reschedule.js';
// import {
//     toggleChatbot,
//     sendChatMessage,
//     handleChatBookingSelection,
//     sendQuickMessage,
//     minimizeChatbot,
//     startChatBooking,
//     handleChatDateSelect,
// } from '../src/apps/chat/shell.js';

const DATA_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260221-api-fix'
);

function selectService(value) {
    const select = document.getElementById('serviceSelect');
    if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change'));
        import('./js/chunks/booking-DPy72ffF.js').then(({ markBookingViewed }) => markBookingViewed('service_select'));
        const appointmentSection = document.getElementById('citas');
        if (appointmentSection) {
            const navHeight =
                document.querySelector('.nav')?.offsetHeight || 80;
            const targetPosition =
                appointmentSection.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        }
    }
}

function getActionRouterEngineDeps() {
    return {
        setThemeMode,
        changeLanguage,
        toggleMobileMenu: () => import('./js/chunks/ui-CiAF08qy.js').then(m => m.toggleMobileMenu()),
        startWebVideo: (id) => import('./js/chunks/ui-CiAF08qy.js').then(m => m.startWebVideo(id)),
        closeVideoModal: () => import('./js/chunks/ui-CiAF08qy.js').then(m => m.closeVideoModal()),
        openReviewModal: () => Promise.resolve().then(function () { return engagement; }).then(m => m.openReviewModal()),
        closeReviewModal: () => Promise.resolve().then(function () { return engagement; }).then(m => m.closeReviewModal()),
        closePaymentModal: (opts) => import('./js/chunks/booking-DPy72ffF.js').then(m => m.closePaymentModal(opts)),
        processPayment: () => import('./js/chunks/booking-DPy72ffF.js').then(m => m.processPayment()),
        closeSuccessModal: () => import('./js/chunks/success-modal-D5Mn68in.js').then(m => m.closeSuccessModal()),
        closeRescheduleModal: () => import('./js/chunks/reschedule-DUxBQrhU.js').then(m => m.closeRescheduleModal()),
        submitReschedule: (id) => import('./js/chunks/reschedule-DUxBQrhU.js').then(m => m.submitReschedule(id)),
        toggleChatbot: () => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.toggleChatbot()),
        sendChatMessage: () => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.sendChatMessage()),
        handleChatBookingSelection: (val) => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.handleChatBookingSelection(val)),
        sendQuickMessage: (val) => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.sendQuickMessage(val)),
        minimizeChatbot: () => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.minimizeChatbot()),
        startChatBooking: () => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.startChatBooking()),
        handleChatDateSelect: (val) => import('./js/chunks/shell-Bsdgf8JH.js').then(m => m.handleChatDateSelect(val)),
        selectService,
    };
}

function loadActionRouterEngine() {
    return loadDeferredModule({
        cacheKey: 'action-router-engine',
        src: DATA_BUNDLE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.ActionRouterEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getActionRouterEngineDeps()),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine',
    });
}

function initActionRouterEngine() {
    runDeferredModule(
        loadActionRouterEngine,
        () => undefined,
        (error) => {
        }
    );
}

const ANALYTICS_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
);
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
    'whatsapp_click',
]);
const FUNNEL_SERVER_ALLOWED_PARAMS = new Set([
    'source',
    'step',
    'payment_method',
    'checkout_entry',
    'checkout_step',
    'reason',
    'error_code',
]);
const FUNNEL_EVENT_DEDUP_MS = 1200;
const funnelEventLastSentAt = new Map();

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
    const sourceRaw =
        params && typeof params === 'object' ? params.source : undefined;
    const normalized = {
        source: normalizeFunnelLabelClient(sourceRaw, 'unknown'),
    };

    if (!params || typeof params !== 'object') {
        return normalized;
    }

    FUNNEL_SERVER_ALLOWED_PARAMS.forEach((key) => {
        if (key === 'source') {
            return;
        }
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            normalized[key] = normalizeFunnelLabelClient(
                params[key],
                'unknown'
            );
        }
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
        serverParams.source || '',
    ].join('|');

    const now = Date.now();
    const previousAt = funnelEventLastSentAt.get(dedupKey) || 0;
    if (now - previousAt < FUNNEL_EVENT_DEDUP_MS) {
        return;
    }
    funnelEventLastSentAt.set(dedupKey, now);

    const payload = JSON.stringify({
        event: normalizedEvent,
        params: serverParams,
    });

    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const sent = navigator.sendBeacon(FUNNEL_EVENT_ENDPOINT, blob);
            if (sent) {
                return;
            }
        }
    } catch (_error) {}

    fetch(FUNNEL_EVENT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
    }).catch(() => undefined);
}

function getAnalyticsEngineDeps() {
    return {
        observeOnceWhenVisible,
        loadAvailabilityData,
        loadPublicReviews,
        trackEventToServer: sendFunnelEventToServer,
    };
}

function loadAnalyticsEngine() {
    return loadDeferredModule({
        cacheKey: 'analytics-engine',
        src: ANALYTICS_ENGINE_URL,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getAnalyticsEngineDeps()),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}

function trackEvent(eventName, params = {}) {
    sendFunnelEventToServer(eventName, params);
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.trackEvent(eventName, params)
    );
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
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.markBookingViewed(source)
    );
}

function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initBookingFunnelObserver()
    );
}

function initDeferredSectionPrefetch() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initDeferredSectionPrefetch()
    );
}

function maybeTrackCheckoutAbandon(reason = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.maybeTrackCheckoutAbandon(reason)
    );
}

const UI_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/ui-bundle.js?v=20260220-consolidated1'
);

function getConsentEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        showToast,
        trackEvent,
        cookieConsentKey: COOKIE_CONSENT_KEY,
        gaMeasurementId: 'G-GYY8PE5M8W',
    };
}

function loadConsentEngine() {
    return loadDeferredModule({
        cacheKey: 'consent-engine',
        src: UI_BUNDLE_URL,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ConsentEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getConsentEngineDeps()),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine',
    });
}

function initGA4() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initGA4());
}

function bootstrapConsent() {
    loadConsentEngine(); // Loads bundle and binds delegated listeners via init()
}

function showConsentBanner() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initCookieBanner()); // Only shows banner
}

const CONTENT_JSON_URL = withDeployAssetVersion('/content/index.json');
const REQUIRED_SECTION_IDS = [
    'showcase',
    'servicios',
    'telemedicina',
    'tarifario',
    'equipo',
    'galeria',
    'consultorio',
    'resenas',
    'citas',
    'chatbotWidget',
];

const FALLBACK_SECTION_TITLES = {
    showcase: 'Presentacion',
    servicios: 'Servicios',
    telemedicina: 'Telemedicina',
    tarifario: 'Tarifario',
    equipo: 'Equipo medico',
    galeria: 'Resultados',
    consultorio: 'Consultorio',
    resenas: 'Resenas',
    citas: 'Reserva de cita',
    chatbotWidget: 'Asistente virtual',
};

function hydrateDeferredText(container) {
    if (!window.PIEL_CONTENT) return;
    const nodes = container.querySelectorAll('[data-i18n]');
    nodes.forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (window.PIEL_CONTENT[key]) {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                node.placeholder = window.PIEL_CONTENT[key];
            } else {
                node.innerHTML = window.PIEL_CONTENT[key];
            }
        }
    });
}

function normalizeDeferredAssetPath(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    if (raw.startsWith('images/')) return `/${raw}`;
    if (raw.startsWith('./images/')) return raw.replace('./images/', '/images/');
    return raw;
}

function normalizeDeferredSrcset(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    return raw
        .split(',')
        .map((chunk) => {
            const trimmed = chunk.trim();
            if (!trimmed) return trimmed;
            const parts = trimmed.split(/\s+/);
            parts[0] = normalizeDeferredAssetPath(parts[0]);
            return parts.join(' ');
        })
        .join(', ');
}

function normalizeDeferredInlineStyle(value) {
    const raw = String(value || '');
    if (!raw) return raw;
    return raw
        .replace(/url\((['"]?)\.?\/?images\//g, "url($1/images/")
        .replace(/url\((['"]?)images\//g, "url($1/images/");
}

function normalizeDeferredAssetUrls(container) {
    if (!container) return;

    container.querySelectorAll('[src]').forEach((node) => {
        const current = node.getAttribute('src');
        const next = normalizeDeferredAssetPath(current);
        if (next && next !== current) {
            node.setAttribute('src', next);
        }
    });

    container.querySelectorAll('[data-src]').forEach((node) => {
        const current = node.getAttribute('data-src');
        const next = normalizeDeferredAssetPath(current);
        if (next && next !== current) {
            node.setAttribute('data-src', next);
        }
    });

    container.querySelectorAll('[srcset]').forEach((node) => {
        const current = node.getAttribute('srcset');
        const next = normalizeDeferredSrcset(current);
        if (next && next !== current) {
            node.setAttribute('srcset', next);
        }
    });

    container.querySelectorAll('[data-srcset]').forEach((node) => {
        const current = node.getAttribute('data-srcset');
        const next = normalizeDeferredSrcset(current);
        if (next && next !== current) {
            node.setAttribute('data-srcset', next);
        }
    });

    container.querySelectorAll('[style*="url("]').forEach((node) => {
        const current = node.getAttribute('style');
        const next = normalizeDeferredInlineStyle(current);
        if (next && next !== current) {
            node.setAttribute('style', next);
        }
    });
}

function forceDeferredSectionPaint(container) {
    if (!container || !(container instanceof HTMLElement)) return;
    container.style.contentVisibility = 'visible';
    container.style.containIntrinsicSize = 'auto';
}

function isValidDeferredPayload(data) {
    if (!data || typeof data !== 'object') return false;
    return REQUIRED_SECTION_IDS.some(
        (id) => typeof data[id] === 'string' && data[id].trim() !== ''
    );
}

async function tryFetchDeferredPayload(url, useCacheBuster = false) {
    const parsedUrl = new URL(url, window.location.origin);
    if (useCacheBuster) {
        parsedUrl.searchParams.set('_ts', String(Date.now()));
    }

    const response = await fetch(parsedUrl.toString(), {
        cache: 'no-store',
        credentials: 'same-origin',
    });
    if (!response.ok) {
        throw new Error(`Deferred content fetch failed (${response.status})`);
    }

    const data = await response.json();
    if (!isValidDeferredPayload(data)) {
        throw new Error('Deferred content payload is invalid');
    }

    return data;
}

async function fetchDeferredPayload() {
    const candidateUrls = [
        CONTENT_JSON_URL,
        '/content/index.json',
        'content/index.json',
        './content/index.json',
    ];
    const uniqueUrls = [...new Set(candidateUrls.filter(Boolean))];

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const useCacheBuster = attempt > 0;
        for (const url of uniqueUrls) {
            try {
                return await tryFetchDeferredPayload(url, useCacheBuster);
            } catch (error) {
                lastError = error;
            }
        }
    }

    throw lastError || new Error('Deferred content unavailable');
}

function renderDeferredFallbackState() {
    const refreshHref = encodeURI(window.location.pathname || '/');
    document.querySelectorAll('.section.deferred-content').forEach((section) => {
        const title =
            FALLBACK_SECTION_TITLES[section.id] || 'Contenido temporalmente no disponible';
        section.innerHTML = `
            <div class="section-header" style="text-align:center;">
                <h2 class="section-title">${title}</h2>
                <p class="section-subtitle">
                    Estamos recargando esta seccion. Si no aparece en unos segundos, recarga la pagina.
                </p>
                <a href="${refreshHref}" class="btn btn-secondary">
                    Recargar ahora
                </a>
            </div>
        `;
        section.classList.remove('deferred-content');
        forceDeferredSectionPaint(section);
    });
}

async function loadDeferredContent() {
    try {
        const data = await fetchDeferredPayload();

        Object.keys(data).forEach((id) => {
            const container = document.getElementById(id);
            if (container && container.classList.contains('deferred-content')) {
                container.innerHTML = data[id];
                normalizeDeferredAssetUrls(container);
                container.classList.remove('deferred-content'); // Optional cleanup
                forceDeferredSectionPaint(container);
                hydrateDeferredText(container);
            } else if (!container) {
                debugLog(`Warning: Container #${id} not found for deferred content.`);
            }
        });

        debugLog('Deferred content loaded and hydrated.');
        return true;
    } catch (error) {
        console.error('Error loading deferred content:', error);
        renderDeferredFallbackState();
        return false;
    }
}

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
        import('./js/chunks/booking-DPy72ffF.js').then(({ markBookingViewed }) => {
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

             const chatShell = await import('./js/chunks/shell-Bsdgf8JH.js');
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
            const { handleChatDateSelect } = await import('./js/chunks/shell-Bsdgf8JH.js');
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

            const { initBookingEngineWarmup, initBookingUiWarmup } = await import('./js/chunks/booking-DPy72ffF.js');
            initBookingEngineWarmup();
            initBookingUiWarmup();

            const { initChatUiEngineWarmup, initChatWidgetEngineWarmup } = await import('./js/chunks/shell-Bsdgf8JH.js');
            initChatUiEngineWarmup();
            initChatWidgetEngineWarmup();
        });

        const initLowPriorityWarmups = createOnceTask(async () => {
            const { initReviewsEngineWarmup, initEngagementFormsEngineWarmup } = await Promise.resolve().then(function () { return engagement; });
            initReviewsEngineWarmup();
            initEngagementFormsEngineWarmup();

            const { initGalleryInteractionsWarmup } = await import('./js/chunks/gallery-DX_OiKH7.js');
            initGalleryInteractionsWarmup();

            const { initChatEngineWarmup, initChatBookingEngineWarmup } = await import('./js/chunks/shell-Bsdgf8JH.js');
            initChatEngineWarmup();
            initChatBookingEngineWarmup();

            const { initUiEffectsWarmup, initModalUxEngineWarmup } = await import('./js/chunks/ui-CiAF08qy.js');
            initUiEffectsWarmup();
            initModalUxEngineWarmup();

            const { initRescheduleEngineWarmup } = await import('./js/chunks/reschedule-DUxBQrhU.js');
            initRescheduleEngineWarmup();

            const { initSuccessModalEngineWarmup } = await import('./js/chunks/success-modal-D5Mn68in.js');
            initSuccessModalEngineWarmup();
        });

        const initDeferredWarmups = createOnceTask(() => {
            initHighPriorityWarmups();
            initLowPriorityWarmups();
            import('./js/chunks/booking-DPy72ffF.js').then(({ initBookingUiWarmup }) => {
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
            import('./js/chunks/shell-Bsdgf8JH.js').then(({ handleChatKeypress }) => {
                chatInput.addEventListener('keypress', handleChatKeypress);
            });
        }

        // Gallery lazy load is already initialized below in the legacy fallback block.
        initBookingCalendarLazyInit();
    });

    window.addEventListener('pagehide', () => {
        maybeTrackCheckoutAbandon('page_hide');
    });

    import('./js/chunks/shell-Bsdgf8JH.js').then(({ checkServerEnvironment }) => {
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
             import('./js/chunks/booking-DPy72ffF.js').then(({ markBookingViewed }) => {
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
    import('./js/chunks/booking-DPy72ffF.js').then(({ initBookingEngineWarmup }) => {
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

export { API_ENDPOINT as A, API_REQUEST_TIMEOUT_MS as B, CLINIC_MAP_URL as C, DOCTOR_CAROLINA_EMAIL as D, API_DEFAULT_RETRIES as E, getApiSlowNoticeLastAt as F, API_SLOW_NOTICE_COOLDOWN_MS as G, API_SLOW_NOTICE_MS as H, waitMs as I, setApiSlowNoticeLastAt as J, API_RETRY_BASE_DELAY_MS as K, setStripeSdkPromise as L, getStripeSdkPromise as M, setPaymentConfigLoadedAt as N, getPaymentConfigLoadedAt as O, setPaymentConfigLoaded as P, getPaymentConfigLoaded as Q, setPaymentConfig as R, getPaymentConfig as S, markBookingViewed as T, normalizeAnalyticsLabel as U, uploadTransferProof as V, loadAnalyticsEngine as W, escapeHtml as X, invalidateBookedSlotsCache as Y, apiRequest as Z, scheduleDeferredTask as a, bindWarmupTarget as b, createWarmupRunner as c, withDeployAssetVersion as d, setChatbotOpen as e, DOCTOR_CAROLINA_PHONE as f, getChatbotOpen as g, CLINIC_ADDRESS as h, setChatHistory as i, getChatHistory as j, getCurrentAppointment as k, loadDeferredModule as l, setConversationContext as m, getConversationContext as n, debugLog as o, state as p, setCurrentAppointment as q, runDeferredModule as r, showToast as s, trackEvent as t, getCurrentLang as u, createAppointmentRecord as v, withDeferredModule as w, getBookedSlots as x, loadAvailabilityData as y, observeOnceWhenVisible as z };
