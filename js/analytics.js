import { getCookieConsent } from './utils.js';

export function trackEvent(eventName, params = {}) {
    if (!eventName || typeof eventName !== 'string') {
        return;
    }

    const payload = {
        event_category: 'conversion',
        ...params
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, payload);
        return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: eventName,
        ...payload
    });
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

export function initGA4() {
    if (window._ga4Loaded) return;
    if (getCookieConsent() !== 'accepted') return;
    window._ga4Loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-GYY8PE5M8W';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', 'G-GYY8PE5M8W');
}
