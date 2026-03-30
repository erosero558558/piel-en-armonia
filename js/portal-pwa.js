(function () {
    'use strict';

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    function registerPortalServiceWorker() {
        navigator.serviceWorker
            .register('/sw.js', { updateViaCache: 'none' })
            .catch(function (error) {
                console.warn('[portal-pwa] service worker registration failed', error);
            });
    }

    if (document.readyState === 'complete') {
        registerPortalServiceWorker();
        return;
    }

    window.addEventListener('load', registerPortalServiceWorker, { once: true });
})();
