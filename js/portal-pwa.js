(function () {
    'use strict';

    if (typeof window === 'undefined') {
        return;
    }

    window.__portalPwa = window.__portalPwa || {
        supported: 'serviceWorker' in navigator,
        attempted: false,
        registered: false,
        scope: '',
        error: '',
    };

    if (!window.__portalPwa.supported) {
        return;
    }

    function registerPortalServiceWorker() {
        window.__portalPwa.attempted = true;
        navigator.serviceWorker
            .register('/sw.js', { updateViaCache: 'none' })
            .then(function (registration) {
                window.__portalPwa.registered = true;
                window.__portalPwa.scope = String(registration?.scope || '');
                window.__portalPwa.error = '';
            })
            .catch(function (error) {
                const message = error instanceof Error ? error.message : String(error || 'unknown_error');
                window.__portalPwa.registered = false;
                window.__portalPwa.scope = '';
                window.__portalPwa.error = message;
                console.warn('[portal-pwa] service worker registration failed', error);
            });
    }

    if (document.readyState === 'complete') {
        registerPortalServiceWorker();
        return;
    }

    window.addEventListener('load', registerPortalServiceWorker, { once: true });
})();
