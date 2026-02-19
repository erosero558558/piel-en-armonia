/**
 * Internationalization engine (deferred-loaded).
 * Handles language bundles and DOM translation updates.
 */
(function () {
    'use strict';

    let deps = null;
    const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);
    const EN_TRANSLATIONS_URL = '/translations-en.js?v=ui-20260218-i18n-en1';

    const translations = {
        es: null,
        en: null
    };

    let enTranslationsPromise = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielI18nEngine;
    }

    function debugLogSafe() {
        if (deps && typeof deps.debugLog === 'function') {
            deps.debugLog.apply(null, arguments);
        }
    }

    function setCurrentLang(lang) {
        if (deps && typeof deps.setCurrentLang === 'function') {
            deps.setCurrentLang(lang);
        }
    }

    function showToastSafe(message, type) {
        if (deps && typeof deps.showToast === 'function') {
            deps.showToast(message, type || 'info');
        }
    }

    function getReviewsCacheSafe() {
        if (deps && typeof deps.getReviewsCache === 'function') {
            return deps.getReviewsCache();
        }
        return [];
    }

    function renderPublicReviewsSafe(reviews) {
        if (deps && typeof deps.renderPublicReviews === 'function') {
            deps.renderPublicReviews(reviews);
        }
    }

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
            debugLogSafe('English translations load failed:', error);
            throw error;
        });

        return enTranslationsPromise;
    }

    async function changeLanguage(lang) {
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
                showToastSafe('No se pudo cargar el paquete de idioma EN. Se mantiene Espanol.', 'warning');
            }
        }

        const langPack = translations[nextLang] || translations.es || {};

        document.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.lang === nextLang);
        });

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = String(el.dataset.i18n || '').trim();
            if (!Object.prototype.hasOwnProperty.call(langPack, key)) {
                return;
            }
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = langPack[key];
                return;
            }
            if (I18N_HTML_ALLOWED_KEYS.has(key)) {
                el.innerHTML = langPack[key];
                return;
            }
            el.textContent = langPack[key];
        });

        const cachedReviews = getReviewsCacheSafe();
        if (Array.isArray(cachedReviews) && cachedReviews.length > 0) {
            renderPublicReviewsSafe(cachedReviews);
        }

        return nextLang;
    }

    window.PielI18nEngine = {
        init,
        ensureEnglishTranslations,
        changeLanguage
    };
})();
