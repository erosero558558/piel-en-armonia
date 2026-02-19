/**
 * Consent and GA4 engine (deferred-loaded).
 * Handles cookie consent state and analytics bootstrap.
 */
(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielConsentEngine;
    }

    function getCurrentLang() {
        if (deps && typeof deps.getCurrentLang === 'function') {
            return deps.getCurrentLang() || 'es';
        }
        return 'es';
    }

    function showToastSafe(message, type) {
        if (deps && typeof deps.showToast === 'function') {
            deps.showToast(message, type || 'info');
        }
    }

    function trackEventSafe(eventName, payload) {
        if (deps && typeof deps.trackEvent === 'function') {
            deps.trackEvent(eventName, payload || {});
        }
    }

    function getConsentStorageKey() {
        if (deps && typeof deps.cookieConsentKey === 'string' && deps.cookieConsentKey) {
            return deps.cookieConsentKey;
        }
        return 'pa_cookie_consent_v1';
    }

    function getMeasurementId() {
        if (deps && typeof deps.gaMeasurementId === 'string' && deps.gaMeasurementId) {
            return deps.gaMeasurementId;
        }
        return 'G-GYY8PE5M8W';
    }

    function getCookieConsent() {
        try {
            const raw = localStorage.getItem(getConsentStorageKey());
            if (!raw) return '';
            const parsed = JSON.parse(raw);
            return typeof parsed?.status === 'string' ? parsed.status : '';
        } catch (error) {
            return '';
        }
    }

    function setCookieConsent(status) {
        const normalized = status === 'accepted' ? 'accepted' : 'rejected';
        try {
            localStorage.setItem(getConsentStorageKey(), JSON.stringify({
                status: normalized,
                at: new Date().toISOString()
            }));
        } catch (error) {
            // noop
        }
    }

    function initGA4() {
        if (window._ga4Loaded) return;
        if (getCookieConsent() !== 'accepted') return;

        window._ga4Loaded = true;

        const measurementId = getMeasurementId();
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('config', measurementId);
    }

    function bindCookieButtons(acceptBtn, rejectBtn, banner) {
        if (acceptBtn && !acceptBtn.dataset.cookieBound) {
            acceptBtn.dataset.cookieBound = 'true';
            acceptBtn.addEventListener('click', () => {
                setCookieConsent('accepted');
                banner.classList.remove('active');
                showToastSafe(
                    getCurrentLang() === 'es'
                        ? 'Preferencias de cookies guardadas.'
                        : 'Cookie preferences saved.',
                    'success'
                );
                initGA4();
                trackEventSafe('cookie_consent_update', { status: 'accepted' });
            });
        }

        if (rejectBtn && !rejectBtn.dataset.cookieBound) {
            rejectBtn.dataset.cookieBound = 'true';
            rejectBtn.addEventListener('click', () => {
                setCookieConsent('rejected');
                banner.classList.remove('active');
                showToastSafe(
                    getCurrentLang() === 'es'
                        ? 'Solo se mantendran cookies esenciales.'
                        : 'Only essential cookies will be kept.',
                    'info'
                );
                trackEventSafe('cookie_consent_update', { status: 'rejected' });
            });
        }
    }

    function initCookieBanner() {
        const banner = document.getElementById('cookieBanner');
        if (!banner) return false;

        const consent = getCookieConsent();
        if (consent === 'accepted' || consent === 'rejected') {
            banner.classList.remove('active');
        } else {
            banner.classList.add('active');
        }

        const acceptBtn = document.getElementById('cookieAcceptBtn');
        const rejectBtn = document.getElementById('cookieRejectBtn');
        bindCookieButtons(acceptBtn, rejectBtn, banner);
        return true;
    }

    window.PielConsentEngine = {
        init,
        getCookieConsent,
        setCookieConsent,
        initGA4,
        initCookieBanner
    };
})();
