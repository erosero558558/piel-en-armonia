import { withDeployAssetVersion, showToast } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { getCurrentLang } from './state.js';
import { trackEvent } from './analytics.js';
import { COOKIE_CONSENT_KEY } from './config.js';

const CONSENT_ENGINE_URL = withDeployAssetVersion('/consent-engine.js?v=figo-consent-20260219-phase1');

function getConsentEngineDeps() {
    return {
        getCurrentLang: getCurrentLang,
        showToast,
        trackEvent,
        cookieConsentKey: COOKIE_CONSENT_KEY,
        gaMeasurementId: 'G-GYY8PE5M8W'
    };
}

export function loadConsentEngine() {
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

export function getCookieConsent() {
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

export function setCookieConsent(status) {
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

export function initGA4() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initGA4());
}

export function initCookieBanner() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initCookieBanner());
}
