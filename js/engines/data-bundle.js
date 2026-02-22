(function () {
    'use strict';

    // build-sync: 20260219-sync1

    let deps$1 = null;
    const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);

    const translations = {
        es: null,
        en: null
    };

    let enTranslationsPromise = null;

    function init$1(inputDeps) {
        deps$1 = inputDeps || {};

        if (window.PIEL_CONTENT && typeof window.PIEL_CONTENT === 'object') {
            translations.es = window.PIEL_CONTENT;
        }

        return window.PielI18nEngine;
    }

    function debugLogSafe() {
        if (deps$1 && typeof deps$1.debugLog === 'function') {
            deps$1.debugLog.apply(null, arguments);
        }
    }

    function setCurrentLang(lang) {
        if (deps$1 && typeof deps$1.setCurrentLang === 'function') {
            deps$1.setCurrentLang(lang);
        }
    }

    function showToastSafe(message, type) {
        if (deps$1 && typeof deps$1.showToast === 'function') {
            deps$1.showToast(message, type);
        }
    }

    function getReviewsCacheSafe() {
        if (deps$1 && typeof deps$1.getReviewsCache === 'function') {
            return deps$1.getReviewsCache();
        }
        return [];
    }

    function renderPublicReviewsSafe(reviews) {
        if (deps$1 && typeof deps$1.renderPublicReviews === 'function') {
            deps$1.renderPublicReviews(reviews);
        }
    }

    function translate(key, fallback) {
        const lang = document.documentElement.lang || 'es';
        const langPack = translations[lang] || translations.es;
        if (langPack && Object.prototype.hasOwnProperty.call(langPack, key)) {
            return langPack[key];
        }
        if (lang !== 'es' && translations.es && Object.prototype.hasOwnProperty.call(translations.es, key)) {
            return translations.es[key];
        }
        return fallback || key;
    }

    function ensureEnglishTranslations() {
        if (translations.en && typeof translations.en === 'object') {
            return Promise.resolve(translations.en);
        }

        if (enTranslationsPromise) {
            return enTranslationsPromise;
        }

        enTranslationsPromise = fetch('/api.php?resource=content&lang=en')
            .then(response => {
                if (!response.ok) throw new Error('Failed to load EN content');
                return response.json();
            })
            .then(data => {
                translations.en = data;
                return translations.en;
            })
            .catch((error) => {
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
            // Fallback: try to load ES from API if not injected
            try {
                const res = await fetch('/api.php?resource=content&lang=es');
                if (res.ok) {
                    translations.es = await res.json();
                }
            } catch (e) {
                debugLogSafe('Failed to load ES content fallback', e);
            }
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
        init: init$1,
        ensureEnglishTranslations,
        changeLanguage,
        translate
    };

    let deps = null;
    let listenersBound = false;

    function getEngineRef() {
        if (window.Piel && window.Piel.ActionRouterEngine) {
            return window.Piel.ActionRouterEngine;
        }
        return window.PielActionRouterEngine;
    }

    function init(inputDeps) {
        deps = inputDeps || {};
        bindListeners();
        return getEngineRef();
    }

    function callDep(name) {
        if (!deps || typeof deps[name] !== 'function') {
            return undefined;
        }

        const args = Array.prototype.slice.call(arguments, 1);
        return deps[name].apply(null, args);
    }

    function handleActionClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        const actionEl = target.closest('[data-action]');
        if (!actionEl) {
            return;
        }

        const action = String(actionEl.getAttribute('data-action') || '').trim();
        const value = actionEl.getAttribute('data-value') || '';
        if (!action) {
            return;
        }

        switch (action) {
            case 'toast-close':
                actionEl.closest('.toast')?.remove();
                break;
            case 'set-theme':
                callDep('setThemeMode', value || 'system');
                break;
            case 'set-language':
                callDep('changeLanguage', value || 'es');
                break;
            case 'toggle-mobile-menu':
                callDep('toggleMobileMenu');
                break;
            case 'start-web-video':
                callDep('startWebVideo');
                break;
            case 'open-review-modal':
                callDep('openReviewModal');
                break;
            case 'close-review-modal':
                callDep('closeReviewModal');
                break;
            case 'close-video-modal':
                callDep('closeVideoModal');
                break;
            case 'close-payment-modal':
                callDep('closePaymentModal');
                break;
            case 'process-payment':
                callDep('processPayment');
                break;
            case 'close-success-modal':
                callDep('closeSuccessModal');
                break;
            case 'close-reschedule-modal':
                callDep('closeRescheduleModal');
                break;
            case 'submit-reschedule':
                callDep('submitReschedule');
                break;
            case 'toggle-chatbot':
                callDep('toggleChatbot');
                break;
            case 'send-chat-message':
                callDep('sendChatMessage');
                break;
            case 'chat-booking':
                callDep('handleChatBookingSelection', value);
                break;
            case 'quick-message':
                callDep('sendQuickMessage', value);
                break;
            case 'minimize-chat':
                callDep('minimizeChatbot');
                break;
            case 'start-booking':
                callDep('startChatBooking');
                break;
            case 'select-service':
                callDep('selectService', value);
                break;
        }
    }

    function handleActionChange(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        if (target.closest('[data-action="chat-date-select"]')) {
            callDep('handleChatDateSelect', target.value);
        }
    }

    function bindListeners() {
        if (listenersBound) {
            return;
        }
        listenersBound = true;
        document.addEventListener('click', handleActionClick);
        document.addEventListener('change', handleActionChange);
    }

    window.Piel = window.Piel || {};
    window.Piel.ActionRouterEngine = {
        init
    };
    // Legacy global kept for compatibility with older loaders.
    window.PielActionRouterEngine = window.Piel.ActionRouterEngine;

})();
