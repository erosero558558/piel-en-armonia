(function () {
    'use strict';

    if (window.PielUiEffects) {
        return;
    }

    const existing = document.querySelector('script[data-ui-bundle-compat]');
    if (existing) {
        return;
    }

    const script = document.createElement('script');
    script.src = '/js/engines/ui-bundle.js';
    script.defer = true;
    script.dataset.uiBundleCompat = 'true';
    document.head.appendChild(script);
})();
