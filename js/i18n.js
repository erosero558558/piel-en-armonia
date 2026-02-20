import { withDeployAssetVersion, showToast, debugLog } from './utils.js';
import { loadDeferredModule, withDeferredModule } from './loader.js';
import { getCurrentLang, setCurrentLang, getReviewsCache } from './state.js';
import { renderPublicReviews } from './engagement.js';

const DATA_BUNDLE_URL = withDeployAssetVersion('/js/engines/data-bundle.js');

function getI18nEngineDeps() {
    return {
        getCurrentLang: getCurrentLang,
        setCurrentLang: (lang) => {
            setCurrentLang(lang === 'en' ? 'en' : 'es');
        },
        showToast,
        getReviewsCache,
        renderPublicReviews,
        debugLog
    };
}

export function loadI18nEngine() {
    return loadDeferredModule({
        cacheKey: 'data-bundle',
        src: DATA_BUNDLE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.PielI18nEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getI18nEngineDeps()),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine (data-bundle)',
        logLabel: 'I18n engine'
    });
}

export function initEnglishBundleWarmup() {
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

export async function changeLanguage(lang) {
    return withDeferredModule(loadI18nEngine, (engine) => engine.changeLanguage(lang));
}
