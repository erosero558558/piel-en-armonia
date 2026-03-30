(function () {
    'use strict';

    var V6_HEADER_SELECTOR = '[data-v6-header]';
    var LEGACY_HEADER_SELECTOR = '.navbar-glass';
    var HEADER_SELECTOR =
        V6_HEADER_SELECTOR + ', ' + LEGACY_HEADER_SELECTOR;
    var STYLE_ID = 'aurora-header-styles';
    var READY_CLASS = 'aurora-header-ready';
    var SCROLLED_CLASS = 'aurora-header--scrolled';
    var HIDDEN_CLASS = 'aurora-header--hidden';
    var UP_CLASS = 'aurora-header--up';
    var DOWN_CLASS = 'aurora-header--down';
    var TOP_THRESHOLD = 80;
    var DIRECTION_THRESHOLD = 12;

    function prefersReducedMotion() {
        return !!(
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
    }

    function normalizePath(pathname) {
        var value = String(pathname || '/').trim();
        if (!value) {
            return '/';
        }

        value = value.replace(/\\/g, '/');
        value = value.replace(/\/index\.html?$/i, '/');

        if (value.charAt(0) !== '/') {
            value = '/' + value;
        }

        value = value.replace(/\/{2,}/g, '/');
        if (!/\/$/.test(value)) {
            value += '/';
        }

        return value;
    }

    function shouldActivate(pathname) {
        var normalized = normalizePath(pathname);

        if (
            normalized === '/' ||
            normalized === '/en/' ||
            normalized === '/es/'
        ) {
            return true;
        }

        if (
            normalized === '/en/services/' ||
            normalized.indexOf('/en/services/') === 0
        ) {
            return true;
        }

        if (
            normalized === '/es/servicios/' ||
            normalized.indexOf('/es/servicios/') === 0
        ) {
            return true;
        }

        return normalized === '/es/software/turnero-clinicas/precios/';
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '{background:transparent;border-bottom-color:transparent;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);box-shadow:none;transform:translateY(0);transition:background 0.3s ease,border-color 0.3s ease,backdrop-filter 0.3s ease,-webkit-backdrop-filter 0.3s ease,box-shadow 0.3s ease,transform 0.3s ease;will-change:transform,background,backdrop-filter;}',
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.is-mega-open,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.is-drawer-open,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                SCROLLED_CLASS +
                '{background:var(--color-midnight-900,var(--v6-color-carbon,#090d13));border-bottom-color:rgba(255,255,255,0.1);backdrop-filter:blur(12px) saturate(120%);-webkit-backdrop-filter:blur(12px) saturate(120%);box-shadow:0 18px 36px rgba(5,7,11,0.16);}',
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                HIDDEN_CLASS +
                '{transform:translateY(calc(-100% - 12px));}',
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo-mark,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo-tag{transform-origin:left center;transition:transform 0.24s ease,opacity 0.24s ease;}',
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                UP_CLASS +
                ' .v6-header__logo{transform:translateY(-1px) scale(1.03);}',
            V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                UP_CLASS +
                ' .v6-header__logo-tag{transform:translateY(-1px);}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '{background:transparent;border-bottom-color:transparent;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);box-shadow:none;transform:translateY(0);transition:background 0.3s ease,border-color 0.3s ease,backdrop-filter 0.3s ease,-webkit-backdrop-filter 0.3s ease,box-shadow 0.3s ease,transform 0.3s ease;will-change:transform,background,backdrop-filter;}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                SCROLLED_CLASS +
                '{background:linear-gradient(180deg, rgba(7, 10, 15, 0.96) 0%, rgba(11, 17, 27, 0.92) 100%);border-bottom-color:rgba(255,255,255,0.12);backdrop-filter:blur(12px) saturate(120%);-webkit-backdrop-filter:blur(12px) saturate(120%);box-shadow:0 18px 36px rgba(5,7,11,0.16);}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                HIDDEN_CLASS +
                '{transform:translateY(calc(-100% - 12px));}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .brand-clinical,' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .nav-desktop-links a,' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .btn-ghost{color:rgba(244,247,251,0.92);transition:color 0.3s ease,background-color 0.3s ease,border-color 0.3s ease,transform 0.24s ease,opacity 0.24s ease;}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .brand-clinical{transform-origin:left center;}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .menu-toggle span{background-color:rgba(244,247,251,0.92);transition:background-color 0.3s ease,transform 0.24s ease,opacity 0.24s ease;}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .btn-ghost{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.18);}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .btn-ghost:hover,' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .btn-ghost:focus-visible{background:rgba(255,255,255,0.12);color:#f9fbff;border-color:rgba(199,163,109,0.54);}',
            LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                UP_CLASS +
                ' .brand-clinical{transform:translateY(-1px) scale(1.04);}',
            '@media (prefers-reduced-motion: reduce){' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '{transition:none;}' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                HIDDEN_CLASS +
                '{transform:translateY(0);}' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo-mark,' +
                V6_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .v6-header__logo-tag{' +
                'transition:none;transform:none;}' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '{transition:none;}' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                '.' +
                HIDDEN_CLASS +
                '{transform:translateY(0);}' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .brand-clinical,' +
                LEGACY_HEADER_SELECTOR +
                '.' +
                READY_CLASS +
                ' .menu-toggle span{' +
                'transition:none;transform:none;}}',
        ].join('');
        document.head.appendChild(style);
    }

    var header = document.querySelector(HEADER_SELECTOR);
    if (!header) {
        return;
    }

    if (!shouldActivate(window.location && window.location.pathname)) {
        return;
    }

    if (header.dataset.auroraHeaderReady === 'true') {
        return;
    }

    header.dataset.auroraHeaderReady = 'true';
    header.classList.add(READY_CLASS);
    ensureStyles();

    var isV6Header = header.matches(V6_HEADER_SELECTOR);
    var lastScrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
    var frameId = 0;

    function overlayIsOpen() {
        if (!isV6Header) {
            var legacyToggle = document.getElementById('navHamburger');
            var legacyDrawer = document.getElementById('mobileDrawer');
            var legacyOverlay = document.getElementById('menuOverlay');
            return Boolean(
                (legacyToggle &&
                    legacyToggle.getAttribute('aria-expanded') === 'true') ||
                    (legacyDrawer &&
                        legacyDrawer.classList.contains('open')) ||
                    (legacyOverlay &&
                        legacyOverlay.classList.contains('active'))
            );
        }

        return (
            header.classList.contains('is-mega-open') ||
            header.classList.contains('is-drawer-open')
        );
    }

    function revealHeader(scrollingUp) {
        header.classList.remove(HIDDEN_CLASS);
        header.classList.toggle(UP_CLASS, Boolean(scrollingUp));
        header.classList.remove(DOWN_CLASS);
    }

    function concealHeader() {
        if (prefersReducedMotion()) {
            return;
        }

        header.classList.add(HIDDEN_CLASS);
        header.classList.remove(UP_CLASS);
        header.classList.add(DOWN_CLASS);
    }

    function syncHeader(initial) {
        frameId = 0;

        var currentScrollY = Math.max(
            0,
            window.scrollY || window.pageYOffset || 0
        );
        var overlayOpen = overlayIsOpen();
        var hasScrolled = currentScrollY > TOP_THRESHOLD;

        header.classList.toggle(
            SCROLLED_CLASS,
            Boolean(hasScrolled || overlayOpen)
        );

        if (overlayOpen || !hasScrolled) {
            header.classList.remove(HIDDEN_CLASS);
            header.classList.remove(UP_CLASS);
            header.classList.remove(DOWN_CLASS);
            lastScrollY = currentScrollY;
            return;
        }

        var delta = currentScrollY - lastScrollY;
        if (initial || Math.abs(delta) < DIRECTION_THRESHOLD) {
            lastScrollY = currentScrollY;
            return;
        }

        if (delta > 0) {
            concealHeader();
        } else {
            revealHeader(true);
        }

        lastScrollY = currentScrollY;
    }

    function scheduleSync(initial) {
        if (frameId) {
            return;
        }

        frameId = window.requestAnimationFrame(function () {
            syncHeader(initial);
        });
    }

    window.addEventListener(
        'scroll',
        function () {
            scheduleSync(false);
        },
        { passive: true }
    );
    window.addEventListener('resize', function () {
        scheduleSync(true);
    });
    window.addEventListener('hashchange', function () {
        scheduleSync(true);
    });
    window.addEventListener(
        'pageshow',
        function () {
            scheduleSync(true);
        },
        { once: true }
    );
    window.addEventListener(
        'load',
        function () {
            scheduleSync(true);
        },
        { once: true }
    );

    header.addEventListener('focusin', function () {
        revealHeader(true);
    });
    header.addEventListener('pointerenter', function () {
        revealHeader(true);
    });

    if (typeof MutationObserver === 'function') {
        var observer = new MutationObserver(function () {
            scheduleSync(true);
        });
        observer.observe(header, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }

    syncHeader(true);
})();
