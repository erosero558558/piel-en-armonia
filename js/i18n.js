import { getCurrentLang, setCurrentLang } from './state.js';
import { showToast, debugLog } from './utils.js';

const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);
const translations = {
    es: null,
    en: null
};

const EN_TRANSLATIONS_URL = '/translations-en.js?v=ui-20260218-i18n-en1';
let enTranslationsPromise = null;

export function captureSpanishTranslationsFromDom() {
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

export function ensureEnglishTranslations() {
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

export function initEnglishBundleWarmup() {
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

let onLanguageChangeCallbacks = [];
export function onLanguageChange(callback) {
    onLanguageChangeCallbacks.push(callback);
}

export async function changeLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'es';
    setCurrentLang(nextLang);
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

    onLanguageChangeCallbacks.forEach(cb => cb());
}
