(function () {
    'use strict';

    if (window.PielEngagementFormsEngine) {
        return;
    }

    const existing = document.querySelector(
        'script[data-engagement-bundle-compat]'
    );
    if (existing) {
        return;
    }

    const script = document.createElement('script');
    script.src = '/js/engines/engagement-bundle.js';
    script.defer = true;
    script.dataset.engagementBundleCompat = 'true';
    document.head.appendChild(script);
})();
