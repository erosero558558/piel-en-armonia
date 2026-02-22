import { debugLog, withDeployAssetVersion } from '../shared/utils.js';
import {
    loadDeferredModule,
    runDeferredModule,
    scheduleDeferredTask,
    observeOnceWhenVisible,
    bindWarmupTarget,
} from '../shared/loader.js';
import { state } from '../shared/state.js';
import { API_ENDPOINT } from '../shared/config.js';

const ANALYTICS_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
);

function getAnalyticsEngineDeps() {
    return {
        getCheckoutSession: () => state.checkoutSession,
        setCheckoutSessionActive: (active) => {
            state.checkoutSession.active = active === true;
        },
        setCheckoutSession: (data) => {
            if (data && typeof data === 'object') {
                Object.assign(state.checkoutSession, data);
            }
        },
        getBookingViewTracked: () => state.bookingViewTracked,
        setBookingViewTracked: (val) => {
            state.bookingViewTracked = val;
        },
        getChatStartedTracked: () => state.chatStartedTracked,
        setChatStartedTracked: (val) => {
            state.chatStartedTracked = val;
        },
        debugLog,
        apiEndpoint: API_ENDPOINT,
        getCookieConsentStatus: () => {
            try {
                const raw = localStorage.getItem('pa_cookie_consent_v1');
                const parsed = JSON.parse(raw || '{}');
                return parsed.status || '';
            } catch {
                return '';
            }
        }
    };
}

export function loadAnalyticsEngine() {
    return loadDeferredModule({
        cacheKey: 'analytics-engine',
        src: ANALYTICS_ENGINE_URL,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getAnalyticsEngineDeps()),
        missingApiError: 'Analytics engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}

export function trackEvent(eventName, params = {}) {
    if (window.Piel && window.Piel.AnalyticsEngine) {
        window.Piel.AnalyticsEngine.trackEvent(eventName, params);
        return;
    }
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.trackEvent(eventName, params)
    );
}

export function normalizeAnalyticsLabel(text) {
    if (
        window.Piel &&
        window.Piel.AnalyticsEngine &&
        window.Piel.AnalyticsEngine.normalizeAnalyticsLabel
    ) {
        return window.Piel.AnalyticsEngine.normalizeAnalyticsLabel(text);
    }
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function markBookingViewed(source) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.markBookingViewed(source)
    );
}

export function maybeTrackCheckoutAbandon(reason) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.maybeTrackCheckoutAbandon(reason)
    );
}

export function initBookingFunnelObserver() {
    const observer = () => {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.initBookingFunnelObserver()
        );
    };

    const bookingSection = document.getElementById('citas');
    if (bookingSection) {
        observeOnceWhenVisible(bookingSection, observer, { threshold: 0.1 });
    }
}

export function initDeferredSectionPrefetch() {
    // Analytics engine handles intersection observers for tracking section views
    // and can trigger prefetch logic if needed.
    const prefetch = () => {
        runDeferredModule(loadAnalyticsEngine, (engine) =>
            engine.initSectionObservers()
        );
    };

    // Low priority init
    scheduleDeferredTask(prefetch, { idleTimeout: 3000, fallbackDelay: 2000 });
}
