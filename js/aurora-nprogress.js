(function () {
    'use strict';

    var LOADER_ID = 'aurora-loader';
    var STYLE_ID = 'aurora-loader-styles';
    var BAR_CLASS = 'page-loader__bar';
    var progressValue = 0;
    var trickleTimer = 0;
    var hideTimer = 0;
    var completeTimer = 0;

    function prefersReducedMotion() {
        return !!(
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' +
                LOADER_ID +
                '{position:fixed;inset:0 auto auto 0;width:100%;height:3px;pointer-events:none;opacity:0;z-index:2147483647;transition:opacity 180ms ease;}',
            '#' + LOADER_ID + '[data-visible="true"]{opacity:1;}',
            '#' +
                LOADER_ID +
                ' .' +
                BAR_CLASS +
                '{display:block;width:100%;height:100%;transform-origin:left center;transform:scaleX(0);background:var(--color-aurora-400,#35c491);box-shadow:0 0 14px rgba(53,196,145,0.55);transition:transform 220ms ease-out;}',
            '@media (prefers-reduced-motion: reduce){#' +
                LOADER_ID +
                '{transition:none;}#' +
                LOADER_ID +
                ' .' +
                BAR_CLASS +
                '{transition:none;}}',
        ].join('');
        document.head.appendChild(style);
    }

    function ensureLoader() {
        ensureStyles();

        var loader = document.getElementById(LOADER_ID);
        if (loader) {
            return loader;
        }

        loader = document.createElement('div');
        loader.id = LOADER_ID;
        loader.className = 'page-loader';
        loader.setAttribute('aria-hidden', 'true');
        loader.innerHTML = '<span class="' + BAR_CLASS + '"></span>';
        document.body.appendChild(loader);
        return loader;
    }

    function barElement() {
        return ensureLoader().querySelector('.' + BAR_CLASS);
    }

    function showLoader() {
        ensureLoader().setAttribute('data-visible', 'true');
    }

    function hideLoader() {
        ensureLoader().setAttribute('data-visible', 'false');
    }

    function resetBar() {
        clearInterval(trickleTimer);
        trickleTimer = 0;
        progressValue = 0;

        var bar = barElement();
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
        bar.getBoundingClientRect();
        if (!prefersReducedMotion()) {
            bar.style.removeProperty('transition');
        }
    }

    function setProgress(nextValue) {
        progressValue = Math.max(0, Math.min(1, Number(nextValue) || 0));
        barElement().style.transform = 'scaleX(' + progressValue.toFixed(4) + ')';
    }

    function beginTrickle() {
        clearInterval(trickleTimer);
        trickleTimer = window.setInterval(function () {
            if (progressValue >= 0.92) {
                clearInterval(trickleTimer);
                trickleTimer = 0;
                return;
            }

            var step = 0.02;
            if (progressValue < 0.35) {
                step = 0.12;
            } else if (progressValue < 0.7) {
                step = 0.07;
            } else if (progressValue < 0.85) {
                step = 0.04;
            }

            setProgress(Math.min(0.92, progressValue + step));
        }, 260);
    }

    function startLoader() {
        clearTimeout(hideTimer);
        clearTimeout(completeTimer);
        showLoader();

        if (progressValue <= 0 || progressValue >= 1) {
            resetBar();
            setProgress(0.12);
        } else {
            setProgress(Math.max(progressValue, 0.12));
        }

        beginTrickle();
    }

    function advanceLoader(target) {
        startLoader();
        if (progressValue < target) {
            setProgress(target);
        }
    }

    function completeLoader() {
        clearInterval(trickleTimer);
        trickleTimer = 0;
        clearTimeout(hideTimer);
        clearTimeout(completeTimer);
        showLoader();
        setProgress(1);

        completeTimer = window.setTimeout(function () {
            hideLoader();
            hideTimer = window.setTimeout(resetBar, prefersReducedMotion() ? 0 : 180);
        }, prefersReducedMotion() ? 40 : 220);
    }

    function isSameDocumentNavigation(targetUrl) {
        return (
            targetUrl.origin === window.location.origin &&
            targetUrl.pathname === window.location.pathname &&
            targetUrl.search === window.location.search &&
            targetUrl.hash
        );
    }

    function shouldTrackAnchor(anchor) {
        if (!anchor || anchor.target && anchor.target !== '_self') {
            return false;
        }
        if (anchor.hasAttribute('download')) {
            return false;
        }

        var href = String(anchor.getAttribute('href') || '').trim();
        if (!href) {
            return false;
        }
        if (
            href.charAt(0) === '#' ||
            href.indexOf('mailto:') === 0 ||
            href.indexOf('tel:') === 0 ||
            href.indexOf('javascript:') === 0
        ) {
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

        return !isSameDocumentNavigation(url);
    }

    document.addEventListener(
        'click',
        function (event) {
            if (event.defaultPrevented || event.button !== 0) {
                return;
            }
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }
            if (!event.target || typeof event.target.closest !== 'function') {
                return;
            }

            var anchor = event.target.closest('a[href]');
            if (!shouldTrackAnchor(anchor)) {
                return;
            }

            advanceLoader(0.2);
        },
        true
    );

    document.addEventListener(
        'submit',
        function (event) {
            if (event.defaultPrevented) {
                return;
            }
            if (!event.target || event.target.target === '_blank') {
                return;
            }

            advanceLoader(0.2);
        },
        true
    );

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            completeLoader();
        }
    });

    if (document.readyState === 'complete') {
        completeLoader();
        return;
    }

    startLoader();

    if (document.readyState === 'interactive') {
        advanceLoader(0.6);
    } else {
        document.addEventListener(
            'DOMContentLoaded',
            function () {
                advanceLoader(0.6);
            },
            { once: true }
        );
    }

    window.addEventListener(
        'load',
        function () {
            completeLoader();
        },
        { once: true }
    );
})();
