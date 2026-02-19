import { getCurrentLang } from './state.js';
import { showToast, getCookieConsent, setCookieConsent } from './utils.js';
import { trackEvent, initGA4 } from './analytics.js';

export function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;

    const consent = getCookieConsent();
    if (consent === 'accepted' || consent === 'rejected') {
        banner.classList.remove('active');
    } else {
        banner.classList.add('active');
    }

    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const rejectBtn = document.getElementById('cookieRejectBtn');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            setCookieConsent('accepted');
            banner.classList.remove('active');
            showToast(getCurrentLang() === 'es' ? 'Preferencias de cookies guardadas.' : 'Cookie preferences saved.', 'success');
            initGA4();
            trackEvent('cookie_consent_update', { status: 'accepted' });
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            setCookieConsent('rejected');
            banner.classList.remove('active');
            showToast(getCurrentLang() === 'es' ? 'Solo se mantendran cookies esenciales.' : 'Only essential cookies will be kept.', 'info');
            trackEvent('cookie_consent_update', { status: 'rejected' });
        });
    }
}
