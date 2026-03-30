(function () {
    'use strict';

    var LOADER_ID = 'aurora-loader';
    var STYLE_ID = 'aurora-loader-styles';
    var PENDING_NAV_KEY = 'aurora_loader_pending_nav';
    var COMPLETE_DELAY_MS = 140;
    var HIDE_DELAY_MS = 220;
    var startedAt = 0;
    var finishing = false;

    function hasDocument() {
        return typeof document !== 'undefined' && !!document.documentElement;
    }

    function ensureStyles() {
        if (!hasDocument() || document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '#aurora-loader{' +
            'position:fixed;' +
            'inset:0 auto auto 0;' +
            'width:100%;' +
            'height:3px;' +
            'transform:scaleX(0);' +
            'transform-origin:left center;' +
            'opacity:0;' +
            'pointer-events:none;' +
            'z-index:9999;' +
            'background:linear-gradient(90deg,var(--color-aurora-400,#c98a5b) 0%,color-mix(in srgb, var(--color-aurora-400,#c98a5b) 70%, white 30%) 100%);' +
            'box-shadow:0 0 18px color-mix(in srgb, var(--color-aurora-400,#c98a5b) 42%, transparent 58%);' +
            'transition:transform .28s ease, opacity .2s ease;' +
            '}' +
            '#aurora-loader[data-state="active"]{opacity:1;}' +
            '#aurora-loader[data-state="complete"]{' +
            'opacity:0;' +
            'transform:scaleX(1);' +
            'transition:transform .18s ease-out, opacity .22s ease-out;' +
            '}';
        document.head.appendChild(style);
    }

    function ensureLoader() {
        if (!hasDocument()) {
            return null;
        }

        var existing = document.getElementById(LOADER_ID);
        if (existing) {
            return existing;
        }

        var loader = document.createElement('div');
        loader.id = LOADER_ID;
        loader.setAttribute('aria-hidden', 'true');
        loader.setAttribute('data-state', 'idle');
        loader.hidden = true;

        if (document.body) {
            document.body.appendChild(loader);
        } else {
            document.documentElement.appendChild(loader);
        }

        return loader;
    }

    function setPendingNavigation(value) {
        try {
            if (value) {
                window.sessionStorage.setItem(PENDING_NAV_KEY, '1');
            } else {
                window.sessionStorage.removeItem(PENDING_NAV_KEY);
            }
        } catch (_error) {
            // Keep the loader resilient when sessionStorage is unavailable.
        }
    }

    function hasPendingNavigation() {
        try {
            return window.sessionStorage.getItem(PENDING_NAV_KEY) === '1';
        } catch (_error) {
            return false;
        }
    }

    function start(reason) {
        ensureStyles();
        var loader = ensureLoader();
        if (!loader) {
            return;
        }

        startedAt = Date.now();
        finishing = false;
        loader.hidden = false;
        loader.setAttribute('data-state', 'active');
        loader.setAttribute('data-reason', String(reason || 'navigation'));
        loader.style.opacity = '1';
        loader.style.height = '3px';
        loader.style.transform = 'scaleX(0.12)';

        window.requestAnimationFrame(function () {
            loader.style.transform = 'scaleX(0.68)';
        });
    }

    function finish() {
        var loader = ensureLoader();
        if (!loader || loader.hidden || finishing) {
            setPendingNavigation(false);
            return;
        }

        finishing = true;
        var elapsed = Date.now() - startedAt;
        var delay = elapsed < COMPLETE_DELAY_MS ? COMPLETE_DELAY_MS - elapsed : 0;

        window.setTimeout(function () {
            loader.setAttribute('data-state', 'complete');
            loader.style.transform = 'scaleX(1)';
            loader.style.opacity = '0';
            setPendingNavigation(false);

            window.setTimeout(function () {
                loader.hidden = true;
                loader.setAttribute('data-state', 'idle');
                loader.style.transform = 'scaleX(0)';
                loader.style.opacity = '0';
                finishing = false;
            }, HIDE_DELAY_MS);
        }, delay);
    }

    function isInternalNavigationLink(anchor) {
        if (!anchor || !anchor.getAttribute) {
            return false;
        }

        var href = String(anchor.getAttribute('href') || '').trim();
        if (!href || href.charAt(0) === '#') {
            return false;
        }
        if (anchor.hasAttribute('download')) {
            return false;
        }
        if ((anchor.getAttribute('target') || '').toLowerCase() === '_blank') {
            return false;
        }

        var url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch (_error) {
            return false;
        }

        if (url.origin !== window.location.origin) {
            return false;
        }

        var current = new URL(window.location.href);
        if (
            url.pathname === current.pathname &&
            url.search === current.search &&
            url.hash !== current.hash
        ) {
            return false;
        }

        return true;
    }

    function bindNavigationStart() {
        if (!hasDocument()) {
            return;
        }

        document.addEventListener(
            'click',
            function (event) {
                if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                ) {
                    return;
                }

                var anchor =
                    event.target && event.target.closest
                        ? event.target.closest('a[href]')
                        : null;

                if (!isInternalNavigationLink(anchor)) {
                    return;
                }

                setPendingNavigation(true);
                start('navigation');
            },
            true
        );
    }

    ensureStyles();
    ensureLoader();

    if (hasPendingNavigation()) {
        start('restore');
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            function () {
                start('domcontentloaded');
            },
            { once: true }
        );
        window.addEventListener('load', finish, { once: true });
    } else {
        start('domcontentloaded');
        if (document.readyState === 'complete') {
            finish();
        } else {
            window.addEventListener('load', finish, { once: true });
        }
    }

    window.addEventListener('pageshow', finish);
    bindNavigationStart();

    window.__auroraPageLoader = {
        finish: finish,
        start: start,
    };
})();
