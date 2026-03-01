import { withDeployAssetVersion } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { observeOnceWhenVisible } from './loader.js';
import { loadAvailabilityData } from './data.js';

let engagementRuntimePromise = null;
function loadEngagementRuntime() {
    if (!engagementRuntimePromise) {
        engagementRuntimePromise = import('./engagement.js');
    }
    return engagementRuntimePromise;
}

function loadPublicReviews(options = {}) {
    return loadEngagementRuntime().then((mod) =>
        mod.loadPublicReviews(options)
    );
}

const ANALYTICS_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
);
const FUNNEL_EVENT_ENDPOINT = '/api.php?resource=funnel-event';
const FUNNEL_SERVER_EVENTS = new Set([
    'view_booking',
    'view_service_category',
    'view_service_detail',
    'start_booking_from_service',
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
    'service_slug',
    'service_category',
    'service_intent',
    'entry_point',
    'entry_surface',
    'route_profile',
    'route_id',
    'route_variant',
    'catalog_category',
    'catalog_intent',
    'booking_hint',
    'locale',
    'funnel_step',
    'intent',
    'public_surface',
]);
const FUNNEL_EVENT_DEDUP_MS = 1200;
const funnelEventLastSentAt = new Map();

function getExperimentContext() {
    if (
        !window.Piel ||
        typeof window.Piel.getExperimentContext !== 'function'
    ) {
        return null;
    }
    try {
        const context = window.Piel.getExperimentContext();
        return context && typeof context === 'object' ? context : null;
    } catch (_error) {
        return null;
    }
}

function withExperimentParams(params = {}) {
    const enriched = params && typeof params === 'object' ? { ...params } : {};
    const context = getExperimentContext();
    if (!context) {
        return enriched;
    }

    const heroVariant = normalizeFunnelLabelClient(context.heroVariant, '');
    if (
        heroVariant &&
        !Object.prototype.hasOwnProperty.call(enriched, 'ab_variant')
    ) {
        enriched.ab_variant = heroVariant;
    }

    const contextSource = normalizeFunnelLabelClient(context.source, '');
    if (
        contextSource &&
        !Object.prototype.hasOwnProperty.call(enriched, 'source')
    ) {
        enriched.source = contextSource;
    }

    return enriched;
}

function readCookie(name) {
    const key = String(name || '').trim();
    if (!key || typeof document === 'undefined') {
        return '';
    }
    const all = String(document.cookie || '');
    if (!all) return '';
    const pairs = all.split(';');
    for (const rawPair of pairs) {
        const pair = String(rawPair || '').trim();
        if (!pair) continue;
        const separator = pair.indexOf('=');
        const cookieName =
            separator >= 0 ? pair.slice(0, separator).trim() : pair;
        if (cookieName !== key) continue;
        const rawValue = separator >= 0 ? pair.slice(separator + 1).trim() : '';
        try {
            return decodeURIComponent(rawValue);
        } catch (_error) {
            return rawValue;
        }
    }
    return '';
}

function resolvePublicSurfaceFromPath(pathname) {
    const normalized = String(pathname || '')
        .trim()
        .toLowerCase();
    if (normalized === '/legacy.php' || normalized === '/legacy') {
        return 'legacy';
    }
    return 'v4';
}

function getPublicRuntimeContext() {
    const locale = (() => {
        const lang = String(
            (typeof document !== 'undefined' && document.documentElement
                ? document.documentElement.lang
                : '') || ''
        )
            .trim()
            .toLowerCase();
        if (lang.startsWith('en')) return 'en';
        if (lang.startsWith('es')) return 'es';
        return String(window.location.pathname || '').startsWith('/en/')
            ? 'en'
            : 'es';
    })();

    const cookieSurface = normalizeFunnelLabelClient(
        readCookie('pa_public_surface'),
        ''
    );
    const publicSurface =
        cookieSurface === 'legacy' || cookieSurface === 'v4'
            ? cookieSurface
            : resolvePublicSurfaceFromPath(window.location.pathname || '/');

    return {
        locale,
        publicSurface,
    };
}

function inferFunnelStep(eventName, params = {}) {
    const explicit = normalizeFunnelLabelClient(params.funnel_step, '');
    if (explicit) return explicit;

    const normalizedEvent = normalizeFunnelLabelClient(eventName, '');
    switch (normalizedEvent) {
        case 'view_booking':
            return 'booking_view';
        case 'view_service_category':
            return 'service_category';
        case 'view_service_detail':
            return 'service_detail';
        case 'start_booking_from_service':
            return 'booking_intent';
        case 'start_checkout':
            return 'checkout_start';
        case 'booking_confirmed':
            return 'booking_confirmed';
        case 'checkout_abandon':
            return 'checkout_abandon';
        case 'booking_step_completed':
            return normalizeFunnelLabelClient(params.step, 'booking_step');
        case 'payment_method_selected':
            return 'payment_method_selected';
        case 'payment_success':
            return 'payment_success';
        case 'booking_error':
        case 'checkout_error':
            return normalizedEvent;
        default:
            return 'interaction';
    }
}

function inferIntent(params = {}) {
    const direct = normalizeFunnelLabelClient(params.intent, '');
    if (direct) return direct;

    const serviceIntent = normalizeFunnelLabelClient(
        params.service_intent || params.catalog_intent,
        ''
    );
    if (serviceIntent) return serviceIntent;

    const routeProfile = normalizeFunnelLabelClient(params.route_profile, '');
    if (routeProfile === 'remote') return 'remote';
    if (routeProfile === 'pediatric') return 'pediatric';
    if (routeProfile === 'diagnosis') return 'diagnosis';
    if (routeProfile === 'procedure') return 'procedures';
    return '';
}

function withPublicRuntimeParams(eventName, params = {}) {
    const enriched = params && typeof params === 'object' ? { ...params } : {};
    const context = getPublicRuntimeContext();

    if (!Object.prototype.hasOwnProperty.call(enriched, 'locale')) {
        enriched.locale = context.locale;
    }
    if (!Object.prototype.hasOwnProperty.call(enriched, 'public_surface')) {
        enriched.public_surface = context.publicSurface;
    }

    if (
        !Object.prototype.hasOwnProperty.call(enriched, 'entry_surface') &&
        Object.prototype.hasOwnProperty.call(enriched, 'entry_point')
    ) {
        enriched.entry_surface = enriched.entry_point;
    }
    if (
        !Object.prototype.hasOwnProperty.call(enriched, 'entry_point') &&
        Object.prototype.hasOwnProperty.call(enriched, 'entry_surface')
    ) {
        enriched.entry_point = enriched.entry_surface;
    }

    if (!Object.prototype.hasOwnProperty.call(enriched, 'funnel_step')) {
        enriched.funnel_step = inferFunnelStep(eventName, enriched);
    }

    if (!Object.prototype.hasOwnProperty.call(enriched, 'intent')) {
        const intent = inferIntent(enriched);
        if (intent) {
            enriched.intent = intent;
        }
    }

    return enriched;
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

    const serverParams = buildFunnelServerParams(
        withPublicRuntimeParams(eventName, withExperimentParams(params))
    );
    const dedupKey = [
        normalizedEvent,
        serverParams.step || '',
        serverParams.payment_method || '',
        serverParams.checkout_step || serverParams.step || '',
        serverParams.reason || '',
        serverParams.source || '',
        serverParams.service_slug || '',
        serverParams.entry_surface || serverParams.entry_point || '',
        serverParams.locale || '',
        serverParams.public_surface || '',
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
    } catch (_error) {
        /* noop */
    }

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

export function loadAnalyticsEngine() {
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

export function trackEvent(eventName, params = {}) {
    const enrichedParams = withExperimentParams(params);
    sendFunnelEventToServer(eventName, enrichedParams);
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.trackEvent(eventName, enrichedParams)
    );
}

export function normalizeAnalyticsLabel(value, fallback = 'unknown') {
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

export function markBookingViewed(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.markBookingViewed(source)
    );
}

export function prefetchAvailabilityData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.prefetchAvailabilityData(source)
    );
}

export function prefetchReviewsData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.prefetchReviewsData(source)
    );
}

export function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initBookingFunnelObserver()
    );
}

export function initDeferredSectionPrefetch() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initDeferredSectionPrefetch()
    );
}

export function startCheckoutSession(appointment, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.startCheckoutSession(appointment, metadata)
    );
}

export function setCheckoutStep(step, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.setCheckoutStep(step, metadata)
    );
}

export function setCheckoutSessionActive(active) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.setCheckoutSessionActive(active)
    );
}

export function completeCheckoutSession(method) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.completeCheckoutSession(method)
    );
}

export function maybeTrackCheckoutAbandon(reason = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.maybeTrackCheckoutAbandon(reason)
    );
}
