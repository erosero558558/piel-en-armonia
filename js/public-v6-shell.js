(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeList(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeIndex(index, total) {
        if (!total) return 0;
        if (index < 0) return total - 1;
        if (index >= total) return 0;
        return index;
    }

    var WHATSAPP_PHONE = '593982453672';
    var GA4_MEASUREMENT_ID = 'G-2DWZ5PJ4MC';
    var COOKIE_CONSENT_STORAGE_KEY = 'pa_cookie_consent_v1';
    var COOKIE_BANNER_STYLE_ID = 'aurora-cookie-banner-styles';
    var PUBLIC_RUNTIME_CONFIG_URL = '/api.php?resource=public-runtime-config';
    var WHATSAPP_MESSAGE_MAP = {
        es: {
            home: 'Hola, me gustaria agendar una evaluacion dermatologica',
            hub: 'Hola, necesito ayuda para elegir la especialidad dermatologica adecuada',
            telemedicine:
                'Hola, me interesa una orientacion por teledermatologia',
            software:
                'Hola, quiero evaluar Flow OS para una clinica dermatologica',
            legal: 'Hola, tengo una consulta sobre Aurora Derm',
            service: {
                'diagnostico-integral':
                    'Hola, me gustaria agendar una evaluacion dermatologica',
                'acne-rosacea': 'Hola, me interesa una consulta sobre acne',
                verrugas: 'Hola, quiero una consulta por verrugas',
                'granitos-brazos-piernas':
                    'Hola, quiero una consulta por granitos en brazos y piernas',
                cicatrices:
                    'Hola, quiero informacion sobre tratamiento para cicatrices',
                'cancer-piel':
                    'Hola, quiero agendar una revision de lesiones o lunares',
                'peeling-quimico':
                    'Hola, quiero informacion sobre peeling quimico',
                mesoterapia: 'Hola, quiero informacion sobre mesoterapia',
                'laser-dermatologico':
                    'Hola, quiero informacion sobre tratamiento laser',
                botox: 'Hola, quiero informacion sobre botox medico',
                'bioestimuladores-colageno':
                    'Hola, quiero informacion sobre bioestimuladores de colageno',
                'piel-cabello-unas':
                    'Hola, quiero una consulta por piel, cabello y unas',
                'dermatologia-pediatrica':
                    'Hola, quiero una consulta de dermatologia pediatrica',
                'depilacion-laser':
                    'Hola, quiero informacion sobre depilacion laser',
                manchas: 'Hola, quiero una consulta por manchas en la piel',
                microdermoabrasion:
                    'Hola, quiero informacion sobre microdermoabrasion',
                'rellenos-hialuronico':
                    'Hola, quiero informacion sobre rellenos de acido hialuronico',
                'tamizaje-oncologico':
                    'Hola, quiero agendar un tamizaje oncologico de piel',
                teledermatologia:
                    'Hola, me interesa una orientacion por teledermatologia',
            },
        },
        en: {
            home: "Hello, I'd like to book a dermatology evaluation",
            hub: 'Hello, I need help choosing the right dermatology specialty',
            telemedicine:
                "Hello, I'm interested in a teledermatology consultation",
            software:
                'Hello, I want to evaluate Flow OS for a dermatology clinic',
            legal: 'Hello, I have a question about Aurora Derm',
            service: {
                'diagnostico-integral':
                    "Hello, I'd like to book a dermatology evaluation",
                'acne-rosacea': "Hello, I'm interested in an acne consultation",
                verrugas: "Hello, I'd like a consultation about warts",
                'granitos-brazos-piernas':
                    "Hello, I'd like a consultation about bumps on my arms and legs",
                cicatrices: "Hello, I'd like information about scar treatment",
                'cancer-piel':
                    "Hello, I'd like to schedule a skin lesion review",
                'peeling-quimico':
                    "Hello, I'd like information about a chemical peel",
                mesoterapia: "Hello, I'd like information about mesotherapy",
                'laser-dermatologico':
                    "Hello, I'd like information about laser treatment",
                botox: "Hello, I'd like information about medical botox",
                'bioestimuladores-colageno':
                    "Hello, I'd like information about collagen biostimulators",
                'piel-cabello-unas':
                    "Hello, I'd like a consultation for skin, hair, and nails",
                'dermatologia-pediatrica':
                    "Hello, I'd like a pediatric dermatology consultation",
                teledermatologia:
                    "Hello, I'm interested in a teledermatology consultation",
            },
        },
    };
    var COOKIE_BANNER_COPY = {
        es: {
            title: 'Preferencias de cookies',
            body: 'Usamos cookies esenciales para seguridad y funcionamiento. Puede aceptar o rechazar cookies opcionales.',
            reject: 'Rechazar',
            accept: 'Aceptar',
            more: 'Politica de cookies',
        },
        en: {
            title: 'Cookie preferences',
            body: 'We use essential cookies for security and site operation. You can accept or reject optional cookies.',
            reject: 'Reject',
            accept: 'Accept',
            more: 'Cookie policy',
        },
    };

    function normalizePublicPath(value) {
        var raw = String(value || '/').trim();
        if (!raw) return '/';
        return raw.endsWith('/') ? raw : raw + '/';
    }

    function getPublicRuntimeConfigPromise() {
        if (window.__auroraPublicRuntimeConfigPromise) {
            return window.__auroraPublicRuntimeConfigPromise;
        }

        window.__auroraPublicRuntimeConfigPromise = window
            .fetch(PUBLIC_RUNTIME_CONFIG_URL, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                },
            })
            .then(function (response) {
                if (!response || !response.ok) {
                    return null;
                }
                return response.json().catch(function () {
                    return null;
                });
            })
            .then(function (payload) {
                if (!payload || typeof payload !== 'object') {
                    return null;
                }

                if (
                    payload.data &&
                    typeof payload.data === 'object' &&
                    !Array.isArray(payload.data)
                ) {
                    return payload.data;
                }

                return payload;
            })
            .catch(function () {
                return null;
            });

        return window.__auroraPublicRuntimeConfigPromise;
    }

    function resolveClarityProjectId(runtimeConfig) {
        var source =
            runtimeConfig && typeof runtimeConfig === 'object'
                ? runtimeConfig
                : null;
        var analytics =
            source &&
            source.analytics &&
            typeof source.analytics === 'object' &&
            !Array.isArray(source.analytics)
                ? source.analytics
                : null;
        return String(
            analytics && typeof analytics.clarityProjectId === 'string'
                ? analytics.clarityProjectId
                : ''
        ).trim();
    }

    function ensureClarityQueue() {
        if (typeof window.clarity === 'function') {
            return;
        }

        var clarity = function () {
            clarity.q = clarity.q || [];
            clarity.q.push(arguments);
        };
        window.clarity = clarity;
    }

    function applyClarityConsentStatus(status) {
        if (typeof window.clarity !== 'function') {
            return;
        }

        try {
            if (status === 'accepted') {
                window.clarity('consent');
                return;
            }
            window.clarity('consent', false);
        } catch (_error) {
            // Ignore vendor-side failures to keep the public shell resilient.
        }
    }

    function loadClarity() {
        if (getCookieConsent() !== 'accepted') {
            return Promise.resolve(false);
        }

        return getPublicRuntimeConfigPromise().then(function (runtimeConfig) {
            var projectId = resolveClarityProjectId(runtimeConfig);
            if (!projectId) {
                return false;
            }

            ensureClarityQueue();
            if (
                !document.querySelector(
                    'script[data-public-clarity-project-id="' + projectId + '"]'
                )
            ) {
                var script = document.createElement('script');
                script.async = true;
                script.src =
                    'https://www.clarity.ms/tag/' +
                    encodeURIComponent(projectId);
                script.dataset.publicClarityProjectId = projectId;
                document.head.appendChild(script);
            }

            window.__clarityLoaded = true;
            applyClarityConsentStatus('accepted');
            return true;
        });
    }

    function getPageLocale() {
        return document.documentElement.lang === 'en' ? 'en' : 'es';
    }

    function getCookieConsent() {
        try {
            var raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
            if (!raw) return '';
            var payload = JSON.parse(raw);
            return typeof payload.status === 'string' ? payload.status : '';
        } catch (_error) {
            return '';
        }
    }

    function setCookieConsent(status) {
        var normalized = status === 'accepted' ? 'accepted' : 'rejected';
        try {
            window.localStorage.setItem(
                COOKIE_CONSENT_STORAGE_KEY,
                JSON.stringify({
                    status: normalized,
                    at: new Date().toISOString(),
                })
            );
        } catch (_error) {
            // Ignore storage failures and keep the page usable.
        }
    }

    function ensureAnalyticsBridge() {
        window.dataLayer = window.dataLayer || [];
        if (typeof window.gtag !== 'function') {
            window.gtag = function () {
                window.dataLayer.push(arguments);
            };
        }
    }

    function gtagCall() {
        ensureAnalyticsBridge();
        window.gtag.apply(null, arguments);
    }

    function ensureGa4ScriptTag() {
        var selector = 'script[data-aurora-ga4="' + GA4_MEASUREMENT_ID + '"]';
        if (document.querySelector(selector)) {
            return;
        }

        var script = document.createElement('script');
        script.async = true;
        script.src =
            'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
        script.dataset.auroraGa4 = GA4_MEASUREMENT_ID;
        document.head.appendChild(script);
    }

    function ensureConsentDefaults() {
        if (window.__auroraConsentDefaultReady === true) return;
        window.__auroraConsentDefaultReady = true;
        gtagCall('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
    }

    function updateAnalyticsConsent(status) {
        gtagCall('consent', 'update', {
            analytics_storage: status === 'accepted' ? 'granted' : 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
    }

    function loadGa4() {
        if (getCookieConsent() !== 'accepted') return;

        ensureAnalyticsBridge();
        ensureGa4ScriptTag();
        if (window._ga4Loaded) {
            updateAnalyticsConsent('accepted');
            return;
        }

        window._ga4Loaded = true;

        gtagCall('js', new Date());
        updateAnalyticsConsent('accepted');
        gtagCall('config', GA4_MEASUREMENT_ID);
    }

    function getCookieBannerCopy(locale) {
        return locale === 'en' ? COOKIE_BANNER_COPY.en : COOKIE_BANNER_COPY.es;
    }

    function getCookiesHref(locale) {
        return locale === 'en' ? '/en/legal/cookies/' : '/es/legal/cookies/';
    }

    function ensureCookieBannerStyles() {
        if (document.getElementById(COOKIE_BANNER_STYLE_ID)) return;

        var style = document.createElement('style');
        style.id = COOKIE_BANNER_STYLE_ID;
        style.textContent =
            '.cookie-banner{' +
            'position:fixed;left:20px;right:20px;bottom:20px;z-index:1200;' +
            'display:flex;align-items:flex-end;justify-content:space-between;gap:16px;' +
            'padding:18px 20px;border:1px solid rgba(255,255,255,.14);border-radius:18px;' +
            'background:rgba(9,13,19,.94);color:#f5f0e6;box-shadow:0 20px 50px rgba(0,0,0,.35);' +
            'backdrop-filter:blur(18px);visibility:hidden;transform:translateY(18px);opacity:0;pointer-events:none;' +
            'transition:opacity .25s ease,transform .25s ease;' +
            '}' +
            '.cookie-banner.active{visibility:visible;opacity:1;transform:translateY(0);pointer-events:auto;}' +
            '.cookie-text{margin:0;max-width:700px;font-size:.95rem;line-height:1.6;color:rgba(245,240,230,.9);}' +
            '.cookie-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}' +
            '.cookie-btn{appearance:none;border:1px solid rgba(255,255,255,.18);border-radius:999px;' +
            'padding:10px 16px;font:inherit;font-size:.9rem;font-weight:600;cursor:pointer;' +
            'transition:transform .2s ease,background .2s ease,border-color .2s ease,color .2s ease;}' +
            '.cookie-btn:hover{transform:translateY(-1px);}' +
            '.cookie-btn.btn-primary{background:#d3b072;color:#090d13;border-color:#d3b072;}' +
            '.cookie-btn.btn-secondary{background:transparent;color:#f5f0e6;}' +
            '.cookie-link{color:#d3b072;font-weight:600;text-decoration:none;}' +
            '.cookie-link:hover{text-decoration:underline;}' +
            '.cookie-btn:focus-visible,.cookie-link:focus-visible{outline:2px solid #d3b072;outline-offset:3px;}' +
            '@media (max-width: 768px){' +
            '.cookie-banner{left:12px;right:12px;bottom:12px;align-items:flex-start;flex-direction:column;}' +
            '.cookie-actions{justify-content:flex-start;}' +
            '.cookie-btn{width:100%;}' +
            '}';
        document.head.appendChild(style);
    }

    function ensureCookieBanner() {
        ensureCookieBannerStyles();

        var existingBanner = document.getElementById('cookieBanner');
        if (existingBanner instanceof HTMLElement) {
            return existingBanner;
        }

        var locale = getPageLocale();
        var copy = getCookieBannerCopy(locale);
        var banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-modal', 'true');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', copy.title);
        banner.innerHTML =
            '<p class="cookie-text">' +
            escapeHtml(copy.body) +
            '</p>' +
            '<div class="cookie-actions">' +
            '<button type="button" class="btn btn-secondary cookie-btn" id="cookieRejectBtn">' +
            escapeHtml(copy.reject) +
            '</button>' +
            '<button type="button" class="btn btn-primary cookie-btn" id="cookieAcceptBtn">' +
            escapeHtml(copy.accept) +
            '</button>' +
            '<a href="' +
            escapeHtml(getCookiesHref(locale)) +
            '" class="cookie-link">' +
            escapeHtml(copy.more) +
            '</a>' +
            '</div>';
        document.body.appendChild(banner);
        return banner;
    }

    function syncCookieBannerVisibility() {
        var banner = ensureCookieBanner();
        var consent = getCookieConsent();
        var isActive = consent !== 'accepted' && consent !== 'rejected';
        banner.classList.toggle('active', isActive);
        banner.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    }

    function bootCookieConsent() {
        ensureCookieBanner();
        ensureConsentDefaults();

        if (document.documentElement.dataset.v6CookieConsentReady === 'true') {
            syncCookieBannerVisibility();
            if (getCookieConsent() === 'accepted') {
                loadGa4();
                loadClarity();
            }
            return;
        }

        document.documentElement.dataset.v6CookieConsentReady = 'true';
        syncCookieBannerVisibility();
        if (getCookieConsent() === 'accepted') {
            loadGa4();
            loadClarity();
        }

        document.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            if (target.closest('#cookieAcceptBtn')) {
                event.preventDefault();
                setCookieConsent('accepted');
                updateAnalyticsConsent('accepted');
                loadGa4();
                loadClarity();
                syncCookieBannerVisibility();
                return;
            }

            if (target.closest('#cookieRejectBtn')) {
                event.preventDefault();
                setCookieConsent('rejected');
                updateAnalyticsConsent('rejected');
                applyClarityConsentStatus('rejected');
                syncCookieBannerVisibility();
            }
        });
    }

    function resolveServiceSlug(pathname, locale) {
        if (locale === 'en') {
            if (!pathname.startsWith('/en/services/')) return '';
            return pathname.slice('/en/services/'.length).replace(/\/$/, '');
        }
        if (!pathname.startsWith('/es/servicios/')) return '';
        return pathname.slice('/es/servicios/'.length).replace(/\/$/, '');
    }

    function resolveWhatsAppMessage(pathname, locale) {
        var safeLocale = locale === 'en' ? 'en' : 'es';
        var messages = WHATSAPP_MESSAGE_MAP[safeLocale];
        var safePath = normalizePublicPath(pathname);

        if (safePath === '/es/' || safePath === '/en/' || safePath === '/') {
            return messages.home;
        }

        if (safePath === '/es/servicios/' || safePath === '/en/services/') {
            return messages.hub;
        }

        if (
            safePath === '/es/telemedicina/' ||
            safePath === '/en/telemedicine/' ||
            safePath === '/es/servicios/teledermatologia/'
        ) {
            return messages.telemedicine;
        }

        if (
            safePath.indexOf('/es/software/turnero-clinicas/') === 0 ||
            safePath.indexOf('/en/software/clinic-flow-suite/') === 0
        ) {
            return messages.software;
        }

        if (
            safePath.indexOf('/es/legal/') === 0 ||
            safePath.indexOf('/en/legal/') === 0
        ) {
            return messages.legal;
        }

        var serviceSlug = resolveServiceSlug(safePath, safeLocale);
        if (serviceSlug && messages.service[serviceSlug]) {
            return messages.service[serviceSlug];
        }

        return messages.home;
    }

    function isClinicWhatsAppUrl(url) {
        if (!(url instanceof URL)) return false;
        var hostname = String(url.hostname || '')
            .replace(/^www\./, '')
            .toLowerCase();
        if (hostname === 'wa.me') {
            return url.pathname.replace(/\//g, '') === WHATSAPP_PHONE;
        }
        if (
            hostname === 'api.whatsapp.com' ||
            hostname === 'web.whatsapp.com'
        ) {
            return (
                String(url.searchParams.get('phone') || '').replace(
                    /\D/g,
                    ''
                ) === WHATSAPP_PHONE
            );
        }
        return false;
    }

    function contextualizeWhatsAppLinks() {
        var links = Array.from(
            document.querySelectorAll(
                'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
            )
        );
        if (!links.length) return;

        var message = resolveWhatsAppMessage(
            window.location.pathname,
            getPageLocale()
        );
        if (!message) return;

        links.forEach(function (link) {
            if (!(link instanceof HTMLAnchorElement)) return;
            var rawHref = String(link.getAttribute('href') || '').trim();
            if (!rawHref) return;

            try {
                var url = new URL(rawHref, window.location.origin);
                if (!isClinicWhatsAppUrl(url)) return;
                if (String(url.searchParams.get('text') || '').trim()) return;
                url.searchParams.set('text', message);
                link.setAttribute('href', url.toString());
            } catch (_error) {
                // Ignore malformed links and leave authored hrefs untouched.
            }
        });
    }

    function normalizeWhatsAppTrackingValue(value, fallback) {
        var normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return normalized || fallback;
    }

    function resolveWhatsAppTrackingService(pathname, locale) {
        var safeLocale = locale === 'en' ? 'en' : 'es';
        var safePath = normalizePublicPath(pathname);

        if (safePath === '/es/' || safePath === '/en/' || safePath === '/') {
            return 'home';
        }

        if (safePath === '/es/servicios/' || safePath === '/en/services/') {
            return 'service-hub';
        }

        if (
            safePath === '/es/telemedicina/' ||
            safePath === '/en/telemedicine/' ||
            safePath === '/es/servicios/teledermatologia/' ||
            safePath === '/en/services/teledermatologia/'
        ) {
            return 'teledermatologia';
        }

        if (
            safePath.indexOf('/es/software/turnero-clinicas/') === 0 ||
            safePath.indexOf('/en/software/clinic-flow-suite/') === 0
        ) {
            return 'flow-os';
        }

        if (
            safePath.indexOf('/es/legal/') === 0 ||
            safePath.indexOf('/en/legal/') === 0
        ) {
            return 'legal';
        }

        var serviceSlug = resolveServiceSlug(safePath, safeLocale);
        if (serviceSlug) {
            return normalizeWhatsAppTrackingValue(
                serviceSlug,
                'service-detail'
            );
        }

        var segments = safePath.split('/').filter(Boolean);
        return normalizeWhatsAppTrackingValue(segments.pop() || '', 'general');
    }

    function pushAnalyticsEvent(eventName, payload) {
        var safePayload = payload && typeof payload === 'object' ? payload : {};
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, safePayload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(
            Object.assign(
                {
                    event: eventName,
                },
                safePayload
            )
        );
    }

    function bindWhatsAppTracking() {
        var root = document.documentElement;
        if (!root || root.dataset.v6WhatsappTrackingReady === 'true') return;
        root.dataset.v6WhatsappTrackingReady = 'true';

        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;

                var link = target.closest(
                    'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
                );
                if (!(link instanceof HTMLAnchorElement)) return;

                var rawHref = String(link.getAttribute('href') || '').trim();
                if (!rawHref) return;

                try {
                    var url = new URL(rawHref, window.location.origin);
                    if (!isClinicWhatsAppUrl(url)) return;

                    pushAnalyticsEvent('whatsapp_click', {
                        service: resolveWhatsAppTrackingService(
                            window.location.pathname,
                            getPageLocale()
                        ),
                        page: window.location.pathname || '/',
                    });
                } catch (_error) {
                    // Ignore malformed links and keep navigation untouched.
                }
            },
            true
        );
    }

    function bootMegaMenu() {
        var header = document.querySelector('[data-v6-header]');
        if (!header || header.dataset.v6MegaReady === 'true') return;
        header.dataset.v6MegaReady = 'true';

        var trigger = header.querySelector('[data-v6-mega-trigger]');
        var panel = header.querySelector('[data-v6-mega]');
        var backdrop = header.querySelector('[data-v6-mega-backdrop]');
        var closeButton = header.querySelector('[data-v6-mega-close]');
        var tabs = panel
            ? Array.from(panel.querySelectorAll('[data-v6-mega-tab]'))
            : [];
        var details = panel
            ? Array.from(panel.querySelectorAll('[data-v6-mega-detail]'))
            : [];
        var focusables = [];
        var hoverIntent = null;
        if (!trigger || !panel) return;

        function syncFocusables() {
            focusables = panel
                ? Array.from(panel.querySelectorAll('[data-v6-mega-focusable]'))
                : [];
        }

        function activateTab(targetId, focusDetail) {
            if (!targetId) return;
            tabs.forEach(function (tab) {
                var isActive = tab.getAttribute('data-v6-target') === targetId;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            details.forEach(function (detail) {
                var isActive = detail.id === targetId;
                detail.classList.toggle('is-active', isActive);
                detail.hidden = !isActive;
            });
            if (focusDetail) {
                var detailNode = document.getElementById(targetId);
                if (detailNode) {
                    var detailFocusable = detailNode.querySelector(
                        '[data-v6-mega-focusable]'
                    );
                    if (detailFocusable) {
                        detailFocusable.focus();
                    }
                }
            }
        }

        syncFocusables();
        syncHeaderOffset();
        if (tabs.length) {
            activateTab(tabs[0].getAttribute('data-v6-target') || '', false);
        }

        function isDesktop() {
            return window.matchMedia('(min-width: 901px)').matches;
        }

        function alignPointer() {
            if (panel.hidden) return;
            var triggerRect = trigger.getBoundingClientRect();
            var panelRect = panel.getBoundingClientRect();
            if (!triggerRect.width || !panelRect.width) return;
            var desiredLeft =
                triggerRect.left + triggerRect.width / 2 - panelRect.left;
            var clampedLeft = Math.max(
                18,
                Math.min(panelRect.width - 30, desiredLeft)
            );
            panel.style.setProperty(
                '--v6-mega-pointer-left',
                clampedLeft + 'px'
            );
        }

        function syncHeaderOffset() {
            var headerHeight = Math.round(
                header.getBoundingClientRect().height
            );
            if (!headerHeight) return;
            header.style.setProperty('--v6-header-offset', headerHeight + 'px');
        }

        function openPanel() {
            if (!panel.hidden) return;
            if (hoverIntent) {
                window.clearTimeout(hoverIntent);
                hoverIntent = null;
            }
            syncHeaderOffset();
            panel.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            panel.classList.add('is-open');
            header.classList.add('is-mega-open');
            if (backdrop) {
                backdrop.hidden = false;
                backdrop.classList.add('is-visible');
            }
            syncFocusables();
            window.requestAnimationFrame(alignPointer);
        }

        function closePanel() {
            if (panel.hidden) return;
            if (hoverIntent) {
                window.clearTimeout(hoverIntent);
                hoverIntent = null;
            }
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            panel.classList.remove('is-open');
            header.classList.remove('is-mega-open');
            if (backdrop) {
                backdrop.classList.remove('is-visible');
                backdrop.hidden = true;
            }
        }

        trigger.addEventListener('click', function () {
            if (panel.hidden) {
                openPanel();
            } else {
                closePanel();
            }
        });

        trigger.addEventListener('mouseenter', function () {
            if (!isDesktop()) return;
            if (hoverIntent) window.clearTimeout(hoverIntent);
            hoverIntent = window.setTimeout(openPanel, 70);
        });

        trigger.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (panel.hidden) {
                    openPanel();
                }
                if (tabs[0]) {
                    tabs[0].focus();
                }
            } else if (event.key === 'Escape') {
                closePanel();
            }
        });

        panel.addEventListener('mouseenter', function () {
            if (hoverIntent) window.clearTimeout(hoverIntent);
        });

        panel.addEventListener('mouseleave', function () {
            if (!isDesktop()) return;
            hoverIntent = window.setTimeout(function () {
                if (!panel.contains(document.activeElement)) {
                    closePanel();
                }
            }, 120);
        });

        panel.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePanel();
                trigger.focus();
                return;
            }

            var activeElement = document.activeElement;
            if (
                activeElement &&
                activeElement.closest('[data-v6-mega-categories]')
            ) {
                return;
            }

            if (
                event.key !== 'ArrowDown' &&
                event.key !== 'ArrowUp' &&
                event.key !== 'Home' &&
                event.key !== 'End'
            ) {
                return;
            }
            if (!focusables.length) return;
            var currentIndex = focusables.indexOf(activeElement);
            if (currentIndex === -1) return;

            event.preventDefault();
            var nextIndex = currentIndex;
            if (event.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % focusables.length;
            } else if (event.key === 'ArrowUp') {
                nextIndex =
                    (currentIndex - 1 + focusables.length) % focusables.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = focusables.length - 1;
            }
            focusables[nextIndex].focus();
        });

        tabs.forEach(function (tab, tabIndex) {
            if (tab.dataset.v6MegaTabReady === 'true') return;
            tab.dataset.v6MegaTabReady = 'true';

            var targetId = tab.getAttribute('data-v6-target') || '';
            if (!targetId) return;

            tab.addEventListener('mouseenter', function () {
                if (!isDesktop()) return;
                activateTab(targetId, false);
            });

            tab.addEventListener('focus', function () {
                activateTab(targetId, false);
            });

            tab.addEventListener('click', function () {
                activateTab(targetId, true);
            });

            tab.addEventListener('keydown', function (event) {
                var key = event.key;
                if (
                    key !== 'ArrowDown' &&
                    key !== 'ArrowUp' &&
                    key !== 'ArrowLeft' &&
                    key !== 'ArrowRight' &&
                    key !== 'Home' &&
                    key !== 'End' &&
                    key !== 'Enter' &&
                    key !== ' '
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                if (key === 'Enter' || key === ' ') {
                    activateTab(targetId, true);
                    return;
                }

                var nextIndex = tabIndex;
                if (key === 'ArrowDown' || key === 'ArrowRight') {
                    nextIndex = (tabIndex + 1) % tabs.length;
                } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
                    nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
                } else if (key === 'Home') {
                    nextIndex = 0;
                } else if (key === 'End') {
                    nextIndex = tabs.length - 1;
                }

                var nextTab = tabs[nextIndex];
                if (!nextTab) return;
                var nextTargetId = nextTab.getAttribute('data-v6-target') || '';
                activateTab(nextTargetId, false);
                nextTab.focus();
            });
        });

        if (closeButton) {
            closeButton.addEventListener('click', function () {
                closePanel();
                trigger.focus();
            });
        }

        document.addEventListener('click', function (event) {
            if (panel.hidden) return;
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (
                !target.closest('[data-v6-mega]') &&
                !target.closest('[data-v6-mega-trigger]')
            ) {
                closePanel();
            }
        });

        if (backdrop) {
            backdrop.addEventListener('click', function () {
                closePanel();
                trigger.focus();
            });
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closePanel();
            }
        });

        window.addEventListener('resize', function () {
            syncHeaderOffset();
            alignPointer();
        });
    }

    function bootHeaderSearch() {
        var header = document.querySelector('[data-v6-header]');
        if (!header || header.dataset.v6SearchReady === 'true') return;
        header.dataset.v6SearchReady = 'true';

        var openButton = header.querySelector('[data-v6-search-open]');
        var panel = header.querySelector('[data-v6-search]');
        var input = panel
            ? panel.querySelector('[data-v6-search-input]')
            : null;
        var results = panel
            ? panel.querySelector('[data-v6-search-results]')
            : null;
        var closeButtons = panel
            ? Array.from(panel.querySelectorAll('[data-v6-search-close]'))
            : [];
        if (!openButton || !panel || !input || !results) return;

        var searchIndex = null;

        var emptyTitle = panel.getAttribute('data-v6-search-empty-title') || '';
        var emptyBody = panel.getAttribute('data-v6-search-empty-body') || '';
        var limit = Number(
            panel.getAttribute('data-v6-search-results-limit') || 8
        );
        if (!Number.isFinite(limit) || limit < 1) {
            limit = 8;
        }

        var lastFocused = null;

        function ensureSearchIndex() {
            if (searchIndex !== null) {
                return searchIndex;
            }

            try {
                searchIndex = JSON.parse(
                    panel.getAttribute('data-v6-search-index') || '[]'
                );
            } catch (_error) {
                searchIndex = [];
            }

            return searchIndex;
        }

        function closeMegaIfOpen() {
            var megaTrigger = header.querySelector('[data-v6-mega-trigger]');
            var megaPanel = header.querySelector('[data-v6-mega]');
            var megaBackdrop = header.querySelector('[data-v6-mega-backdrop]');
            if (!megaTrigger || !megaPanel || megaPanel.hidden) return;
            megaPanel.hidden = true;
            megaPanel.classList.remove('is-open');
            header.classList.remove('is-mega-open');
            megaTrigger.setAttribute('aria-expanded', 'false');
            if (megaBackdrop) {
                megaBackdrop.hidden = true;
                megaBackdrop.classList.remove('is-visible');
            }
        }

        function renderEmptyState() {
            results.innerHTML = '';
            var emptyNode = document.createElement('li');
            emptyNode.className = 'v6-search__empty';
            emptyNode.setAttribute('data-v6-search-empty', 'true');

            var titleNode = document.createElement('strong');
            titleNode.textContent = emptyTitle;
            emptyNode.appendChild(titleNode);

            if (emptyBody) {
                var copyNode = document.createElement('p');
                copyNode.textContent = emptyBody;
                emptyNode.appendChild(copyNode);
            }

            results.appendChild(emptyNode);
        }

        function renderResults(query) {
            var safeSearchIndex = ensureSearchIndex();
            var searchValue = String(query || '')
                .trim()
                .toLowerCase();
            var terms = searchValue.split(/\s+/).filter(Boolean);
            var matches = safeSearchIndex.filter(function (entry) {
                if (!terms.length) return true;
                var haystack = [
                    entry.label,
                    entry.eyebrow,
                    entry.deck,
                    entry.href,
                ]
                    .join(' ')
                    .toLowerCase();
                return terms.every(function (term) {
                    return haystack.indexOf(term) !== -1;
                });
            });

            results.innerHTML = '';

            matches.slice(0, limit).forEach(function (entry) {
                var item = document.createElement('li');
                item.className = 'v6-search__result';
                item.setAttribute('data-v6-search-result', 'true');

                var anchor = document.createElement('a');
                anchor.href = entry.href || '#';

                if (entry.eyebrow) {
                    var eyebrow = document.createElement('span');
                    eyebrow.className = 'v6-search__result-eyebrow';
                    eyebrow.textContent = entry.eyebrow;
                    anchor.appendChild(eyebrow);
                }

                var title = document.createElement('strong');
                title.textContent = entry.label || '';
                anchor.appendChild(title);

                if (entry.deck) {
                    var deck = document.createElement('p');
                    deck.textContent = entry.deck;
                    anchor.appendChild(deck);
                }

                anchor.addEventListener('click', function () {
                    closePanel(false);
                });

                item.appendChild(anchor);
                results.appendChild(item);
            });

            if (!results.children.length) {
                renderEmptyState();
            }
        }

        function openPanel() {
            if (!panel.hidden) return;
            closeMegaIfOpen();
            lastFocused = document.activeElement;
            panel.hidden = false;
            panel.classList.add('is-open');
            openButton.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            input.value = '';
            ensureSearchIndex();
            renderResults('');
            window.requestAnimationFrame(function () {
                input.focus();
            });
        }

        function closePanel(returnFocus) {
            if (panel.hidden) {
                openButton.setAttribute('aria-expanded', 'false');
                return;
            }
            panel.hidden = true;
            panel.classList.remove('is-open');
            openButton.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            if (returnFocus) {
                if (lastFocused && typeof lastFocused.focus === 'function') {
                    lastFocused.focus();
                } else {
                    openButton.focus();
                }
            }
        }

        function handleTabKey(event) {
            if (event.key !== 'Tab') return;
            var focusables = Array.from(
                panel.querySelectorAll(
                    'button:not([hidden]), input:not([hidden]), a[href]:not([hidden])'
                )
            ).filter(function (node) {
                return (
                    !node.hasAttribute('disabled') &&
                    node.getAttribute('tabindex') !== '-1'
                );
            });
            if (!focusables.length) return;
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        openButton.addEventListener('click', function () {
            if (panel.hidden) {
                openPanel();
            } else {
                closePanel(true);
            }
        });

        openButton.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            openPanel();
        });

        input.addEventListener('input', function () {
            renderResults(input.value);
        });

        closeButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                closePanel(true);
            });
        });

        panel.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePanel(true);
                return;
            }
            handleTabKey(event);
        });
    }

    function bootNewsStrip() {
        var strip = document.querySelector('[data-v6-news-strip]');
        if (!strip || strip.dataset.v6NewsReady === 'true') return;
        strip.dataset.v6NewsReady = 'true';

        var toggle = strip.querySelector('[data-v6-news-toggle]');
        var panel = strip.querySelector('[data-v6-news-panel]');
        if (!toggle || !panel) return;

        var expandLabel = strip.getAttribute('data-v6-expand-label') || '';
        var collapseLabel =
            strip.getAttribute('data-v6-collapse-label') || expandLabel;

        function sync(expanded) {
            strip.dataset.v6Expanded = expanded ? 'true' : 'false';
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            toggle.setAttribute(
                'aria-label',
                expanded ? collapseLabel : expandLabel
            );
            panel.hidden = !expanded;
        }

        toggle.addEventListener('click', function () {
            sync(toggle.getAttribute('aria-expanded') !== 'true');
        });

        sync(false);
    }

    function bootPageMenus() {
        var menuButtons = Array.from(
            document.querySelectorAll('[data-v6-page-menu]')
        );
        if (!menuButtons.length) return;

        function getPanel(button) {
            var panelId = button.getAttribute('aria-controls');
            if (!panelId) return null;
            return document.getElementById(panelId);
        }

        function getLinks(panel) {
            if (!panel) return [];
            return Array.from(
                panel.querySelectorAll('[data-v6-page-menu-link]')
            );
        }

        function setButtonOpen(button, isOpen) {
            button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            button.classList.toggle('is-open', Boolean(isOpen));
        }

        function closeButton(button, returnFocus) {
            var panel = getPanel(button);
            if (!panel || panel.hidden) {
                setButtonOpen(button, false);
                return;
            }
            panel.hidden = true;
            setButtonOpen(button, false);
            if (returnFocus) {
                button.focus();
            }
        }

        function closeAll(exceptButton, returnFocus) {
            menuButtons.forEach(function (button) {
                if (exceptButton && button === exceptButton) return;
                closeButton(button, returnFocus);
            });
        }

        function openButton(button, focusTarget) {
            var panel = getPanel(button);
            if (!panel) return;
            closeAll(button, false);
            panel.hidden = false;
            setButtonOpen(button, true);

            if (!focusTarget) return;
            var links = getLinks(panel);
            if (!links.length) return;
            if (focusTarget === 'last') {
                links[links.length - 1].focus();
                return;
            }
            links[0].focus();
        }

        menuButtons.forEach(function (button) {
            if (button.dataset.v6PageMenuReady === 'true') return;
            button.dataset.v6PageMenuReady = 'true';
            var panel = getPanel(button);
            if (!panel) return;

            button.addEventListener('click', function () {
                var open = !panel.hidden;
                if (open) {
                    closeButton(button, false);
                    return;
                }
                openButton(button, null);
            });

            button.addEventListener('keydown', function (event) {
                if (
                    event.key !== 'ArrowDown' &&
                    event.key !== 'ArrowUp' &&
                    event.key !== 'Enter' &&
                    event.key !== ' '
                ) {
                    return;
                }
                event.preventDefault();
                if (event.key === 'ArrowUp') {
                    openButton(button, 'last');
                    return;
                }
                openButton(button, 'first');
            });

            getLinks(panel).forEach(function (link, index, links) {
                link.addEventListener('click', function () {
                    closeButton(button, false);
                });

                link.addEventListener('keydown', function (event) {
                    if (
                        event.key !== 'ArrowDown' &&
                        event.key !== 'ArrowUp' &&
                        event.key !== 'Home' &&
                        event.key !== 'End' &&
                        event.key !== 'Escape'
                    ) {
                        return;
                    }

                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeButton(button, true);
                        return;
                    }

                    event.preventDefault();
                    if (!links.length) return;
                    if (event.key === 'Home') {
                        links[0].focus();
                        return;
                    }
                    if (event.key === 'End') {
                        links[links.length - 1].focus();
                        return;
                    }
                    if (event.key === 'ArrowDown') {
                        links[(index + 1) % links.length].focus();
                        return;
                    }
                    links[(index - 1 + links.length) % links.length].focus();
                });
            });

            panel.addEventListener('keydown', function (event) {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                closeButton(button, true);
            });
        });

        document.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            var insideMenu =
                target.closest('[data-v6-page-menu]') ||
                target.closest('[data-v6-page-menu-panel]');
            if (!insideMenu) {
                closeAll(null, false);
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeAll(null, true);
            }
        });

        window.addEventListener('resize', function () {
            closeAll(null, false);
        });
    }

    function bootSectionNavigation() {
        if (document.documentElement.dataset.v6SectionNavReady === 'true') {
            return;
        }

        var links = Array.from(
            document.querySelectorAll('[data-v6-section-link]')
        ).filter(function (link) {
            var href = link.getAttribute('href') || '';
            return href.indexOf('#') === 0 && href.length > 1;
        });
        if (!links.length) return;

        var groups = new Map();
        links.forEach(function (link) {
            var targetId = (link.getAttribute('href') || '').slice(1);
            if (!targetId) return;
            var target = document.getElementById(targetId);
            if (!target) return;
            if (!groups.has(targetId)) {
                groups.set(targetId, {
                    id: targetId,
                    target: target,
                    links: [],
                });
            }
            groups.get(targetId).links.push(link);
        });

        var sections = Array.from(groups.values());
        if (!sections.length) return;
        document.documentElement.dataset.v6SectionNavReady = 'true';
        var currentActiveId = '';
        var lastMeasuredOffset = 0;

        function setActive(activeId) {
            if (!activeId || activeId === currentActiveId) {
                return;
            }
            currentActiveId = activeId;
            sections.forEach(function (entry) {
                var isActive = entry.id === activeId;
                entry.links.forEach(function (link) {
                    link.classList.toggle('is-active', isActive);
                    if (isActive) {
                        link.setAttribute('aria-current', 'location');
                    } else {
                        link.removeAttribute('aria-current');
                    }
                });
            });
        }

        function getAnchorOffset() {
            var header = document.querySelector('[data-v6-header]');
            var headerHeight = header
                ? header.getBoundingClientRect().height
                : 0;
            return Math.max(112, Math.min(220, headerHeight + 72));
        }

        function measureSections() {
            lastMeasuredOffset = getAnchorOffset();
            sections.forEach(function (entry) {
                var rect = entry.target.getBoundingClientRect();
                entry.top = rect.top + window.scrollY;
            });
        }

        function resolveActiveId() {
            var offset = lastMeasuredOffset || getAnchorOffset();
            var scrollTop = window.scrollY + offset;
            var hashId = window.location.hash
                ? window.location.hash.replace(/^#/, '')
                : '';
            if (hashId && groups.has(hashId)) {
                var hashTop = Number(groups.get(hashId).top || 0);
                if (hashTop <= scrollTop + 48) {
                    return hashId;
                }
            }

            var activeId = sections[0].id;
            var viewportFloor = window.innerHeight + window.scrollY;
            var documentHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            if (viewportFloor >= documentHeight - 24) {
                return sections[sections.length - 1].id;
            }

            sections.forEach(function (entry) {
                if (Number(entry.top || 0) <= scrollTop) {
                    activeId = entry.id;
                }
            });
            return activeId;
        }

        var frameId = 0;
        function scheduleSync() {
            if (frameId) return;
            frameId = window.requestAnimationFrame(function () {
                frameId = 0;
                setActive(resolveActiveId());
            });
        }

        var measureFrameId = 0;
        function scheduleMeasureAndSync() {
            if (measureFrameId) return;
            measureFrameId = window.requestAnimationFrame(function () {
                measureFrameId = 0;
                measureSections();
                setActive(resolveActiveId());
            });
        }

        links.forEach(function (link) {
            link.addEventListener('click', function () {
                var targetId = (link.getAttribute('href') || '').slice(1);
                if (groups.has(targetId)) {
                    setActive(targetId);
                }
                window.setTimeout(scheduleSync, 80);
                window.setTimeout(scheduleMeasureAndSync, 180);
            });
        });

        window.addEventListener('scroll', scheduleSync, { passive: true });
        window.addEventListener('resize', scheduleMeasureAndSync);
        window.addEventListener('load', scheduleMeasureAndSync, { once: true });
        window.addEventListener('hashchange', scheduleMeasureAndSync);
        scheduleMeasureAndSync();
    }

    function bootDrawer() {
        var header = document.querySelector('[data-v6-header]');
        if (!header || header.dataset.v6DrawerReady === 'true') return;
        header.dataset.v6DrawerReady = 'true';

        var drawer = header.querySelector('[data-v6-drawer]');
        var openButton = header.querySelector('[data-v6-drawer-open]');
        var panel = drawer
            ? drawer.querySelector('[data-v6-drawer-panel]')
            : null;
        var searchTrigger = drawer
            ? drawer.querySelector('[data-v6-drawer-search-open]')
            : null;
        var desktopSearchButton = header.querySelector(
            '.v6-header__actions [data-v6-search-open]'
        );
        var groupToggles = drawer
            ? Array.from(
                  drawer.querySelectorAll('[data-v6-drawer-group-toggle]')
              )
            : [];
        if (!drawer || !openButton) return;
        var lastFocused = null;

        function setOpenState(isOpen) {
            openButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            header.classList.toggle('is-drawer-open', Boolean(isOpen));
        }

        function syncIndicator(toggle, expanded) {
            if (!toggle) return;
            var indicator = toggle.querySelector('[data-v6-drawer-indicator]');
            if (indicator) {
                indicator.textContent = expanded ? '-' : '+';
            }
        }

        function getFocusableNodes() {
            var root = panel || drawer;
            return Array.from(
                root.querySelectorAll(
                    '[data-v6-drawer-focusable], [data-v6-drawer-group-toggle], [data-v6-drawer-close], [data-v6-drawer-search-open]'
                )
            ).filter(function (node) {
                return (
                    !node.hasAttribute('disabled') &&
                    !node.closest('[hidden]') &&
                    node.getAttribute('tabindex') !== '-1'
                );
            });
        }

        function focusFirstNode() {
            var focusables = getFocusableNodes();
            if (!focusables.length) return;
            focusables[0].focus();
        }

        function openDrawer() {
            if (!drawer.hidden) return;
            lastFocused = document.activeElement;
            drawer.hidden = false;
            setOpenState(true);
            document.body.style.overflow = 'hidden';
            window.requestAnimationFrame(focusFirstNode);
        }

        function closeDrawer(returnFocus) {
            if (drawer.hidden) {
                setOpenState(false);
                return;
            }
            drawer.hidden = true;
            setOpenState(false);
            document.body.style.overflow = '';
            if (returnFocus) {
                if (lastFocused && typeof lastFocused.focus === 'function') {
                    lastFocused.focus();
                } else {
                    openButton.focus();
                }
            }
        }

        function setGroup(targetId, expand) {
            groupToggles.forEach(function (toggle) {
                var panelId = toggle.getAttribute('data-v6-target');
                var isTarget = panelId === targetId;
                var isExpanded = isTarget && expand;
                toggle.setAttribute(
                    'aria-expanded',
                    isExpanded ? 'true' : 'false'
                );
                toggle.classList.toggle('is-active', isExpanded);
                syncIndicator(toggle, isExpanded);
                if (!panelId) return;
                var content = drawer.querySelector('#' + panelId);
                if (content) {
                    content.hidden = !isExpanded;
                }
            });
        }

        if (groupToggles.length) {
            var initiallyExpanded = groupToggles.find(function (toggle) {
                return toggle.getAttribute('aria-expanded') === 'true';
            });
            if (initiallyExpanded) {
                setGroup(
                    initiallyExpanded.getAttribute('data-v6-target'),
                    true
                );
            } else {
                setGroup(groupToggles[0].getAttribute('data-v6-target'), true);
            }
        }

        setOpenState(false);

        openButton.addEventListener('click', function () {
            if (drawer.hidden) {
                openDrawer();
            } else {
                closeDrawer(true);
            }
        });

        openButton.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            openDrawer();
        });

        drawer
            .querySelectorAll('[data-v6-drawer-close]')
            .forEach(function (node) {
                node.addEventListener('click', function () {
                    closeDrawer(true);
                });
            });

        groupToggles.forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                var targetId = toggle.getAttribute('data-v6-target');
                if (!targetId) return;
                var willExpand =
                    toggle.getAttribute('aria-expanded') !== 'true';
                setGroup(targetId, willExpand);
            });
        });

        if (searchTrigger && desktopSearchButton) {
            searchTrigger.addEventListener('click', function () {
                closeDrawer(false);
                desktopSearchButton.focus();
                desktopSearchButton.click();
            });
        }

        drawer.querySelectorAll('a').forEach(function (anchor) {
            anchor.addEventListener('click', function () {
                closeDrawer(false);
            });
        });

        function handleTabKey(event) {
            if (event.key !== 'Tab') return;
            var focusables = getFocusableNodes();
            if (!focusables.length) return;
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        drawer.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDrawer(true);
            }
            handleTabKey(event);
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 900 && !drawer.hidden) {
                closeDrawer(false);
            }
        });
    }

    function bootHero() {
        var roots = Array.from(document.querySelectorAll('[data-v6-hero]'));
        roots.forEach(function (root) {
            if (!root || root.dataset.v6HeroReady === 'true') return;
            root.dataset.v6HeroReady = 'true';

            var slides = Array.from(root.querySelectorAll('[data-v6-slide]'));
            var indicators = Array.from(
                root.querySelectorAll('[data-v6-indicator]')
            );
            if (!slides.length) return;

            var prev = root.querySelector('[data-v6-prev]');
            var next = root.querySelector('[data-v6-next]');
            var toggle = root.querySelector('[data-v6-toggle]');
            var bandCategory = root.querySelector('[data-v6-band-category]');
            var bandTitle = root.querySelector('[data-v6-band-title]');
            var bandDescription = root.querySelector(
                '[data-v6-band-description]'
            );

            var autoplayMs = Number(
                root.getAttribute('data-v6-autoplay-ms') || 7000
            );
            if (!Number.isFinite(autoplayMs) || autoplayMs < 2000) {
                autoplayMs = 7000;
            }
            var playLabel = root.getAttribute('data-v6-label-play') || 'Play';
            var pauseLabel =
                root.getAttribute('data-v6-label-pause') || 'Pause';

            var current = 0;
            var paused = false;
            var timer = null;
            var autoplayDelay = Math.max(6500, autoplayMs - 200);
            var prefersReducedMotion =
                Boolean(window.matchMedia) &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            function updateBand(activeSlide) {
                if (!activeSlide) return;
                if (bandCategory) {
                    bandCategory.textContent =
                        activeSlide.getAttribute('data-v6-category') || '';
                }
                if (bandTitle) {
                    bandTitle.textContent =
                        activeSlide.getAttribute('data-v6-title') || '';
                }
                if (bandDescription) {
                    bandDescription.textContent =
                        activeSlide.getAttribute('data-v6-description') || '';
                }
            }

            function syncToggle() {
                if (!toggle) return;
                toggle.textContent = paused ? playLabel : pauseLabel;
                toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
                root.setAttribute(
                    'data-v6-state',
                    paused ? 'paused' : 'playing'
                );
                syncIndicatorProgress();
            }

            function syncIndicatorProgress() {
                var shouldAnimate =
                    !paused &&
                    !document.hidden &&
                    !prefersReducedMotion &&
                    slides.length > 1;
                indicators.forEach(function (indicator, indicatorIndex) {
                    indicator.style.setProperty(
                        '--v6-progress-duration',
                        autoplayDelay + 'ms'
                    );
                    indicator.classList.remove('is-progressing');
                    var fill = indicator.querySelector(
                        '[data-v6-indicator-fill]'
                    );
                    if (fill) {
                        fill.style.animation = 'none';
                        void fill.offsetWidth;
                        fill.style.animation = '';
                    }
                    if (indicatorIndex === current && shouldAnimate) {
                        indicator.classList.add('is-progressing');
                    }
                });
            }

            function render(index) {
                current = normalizeIndex(index, slides.length);
                var prevIndex = normalizeIndex(current - 1, slides.length);
                var nextIndex = normalizeIndex(current + 1, slides.length);

                slides.forEach(function (slide, slideIndex) {
                    slide.classList.toggle('is-active', slideIndex === current);
                    slide.classList.toggle('is-prev', slideIndex === prevIndex);
                    slide.classList.toggle('is-next', slideIndex === nextIndex);
                    slide.setAttribute(
                        'aria-hidden',
                        slideIndex === current ? 'false' : 'true'
                    );
                });

                indicators.forEach(function (indicator, indicatorIndex) {
                    var isActive = indicatorIndex === current;
                    indicator.classList.toggle('is-active', isActive);
                    indicator.setAttribute(
                        'aria-selected',
                        isActive ? 'true' : 'false'
                    );
                });

                updateBand(slides[current]);
                syncIndicatorProgress();
            }

            function stopAutoplay() {
                if (timer !== null) {
                    window.clearTimeout(timer);
                    timer = null;
                }
                syncIndicatorProgress();
            }

            function startAutoplay() {
                stopAutoplay();
                if (paused || slides.length < 2 || document.hidden) return;
                syncIndicatorProgress();

                timer = window.setTimeout(function tick() {
                    render(current + 1);
                    if (paused || slides.length < 2 || document.hidden) {
                        timer = null;
                        return;
                    }
                    timer = window.setTimeout(tick, autoplayDelay);
                }, autoplayDelay);
            }

            if (prev) {
                prev.addEventListener('click', function () {
                    render(current - 1);
                    startAutoplay();
                });
            }

            if (next) {
                next.addEventListener('click', function () {
                    render(current + 1);
                    startAutoplay();
                });
            }

            if (toggle) {
                toggle.addEventListener('click', function () {
                    paused = !paused;
                    syncToggle();
                    if (paused) {
                        stopAutoplay();
                    } else {
                        startAutoplay();
                    }
                });
            }

            indicators.forEach(function (indicator) {
                indicator.addEventListener('click', function () {
                    var target = Number(
                        indicator.getAttribute('data-v6-target') || 0
                    );
                    render(target);
                    startAutoplay();
                });
            });

            root.addEventListener('keydown', function (event) {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    render(current - 1);
                    startAutoplay();
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    render(current + 1);
                    startAutoplay();
                }
                if (event.key === 'Home') {
                    event.preventDefault();
                    render(0);
                    startAutoplay();
                }
                if (event.key === 'End') {
                    event.preventDefault();
                    render(slides.length - 1);
                    startAutoplay();
                }
            });

            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    stopAutoplay();
                } else {
                    startAutoplay();
                }
            });

            render(0);
            syncToggle();
            startAutoplay();
        });
    }

    function bootRevealElements() {
        var items = Array.from(document.querySelectorAll('[data-v6-reveal]'));
        if (!items.length) return;

        function reveal(element) {
            if (!(element instanceof HTMLElement)) return;
            element.setAttribute('data-v6-reveal-state', 'visible');
        }

        var prefersReducedMotion =
            Boolean(window.matchMedia) &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (
            prefersReducedMotion ||
            typeof window.IntersectionObserver !== 'function'
        ) {
            items.forEach(reveal);
            return;
        }

        var observer = new IntersectionObserver(
            function (entries, obs) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    reveal(entry.target);
                    obs.unobserve(entry.target);
                });
            },
            {
                threshold: 0.16,
                rootMargin: '0px 0px -24px 0px',
            }
        );

        items.forEach(function (item) {
            if (!(item instanceof HTMLElement)) return;
            if (item.dataset.v6RevealReady === 'true') return;
            item.dataset.v6RevealReady = 'true';
            item.setAttribute(
                'data-v6-reveal-state',
                item.getAttribute('data-v6-reveal-state') || 'hidden'
            );
            observer.observe(item);
        });
    }

    function bootBackTop() {
        var button = document.querySelector('[data-v6-back-top]');
        if (!button || button.dataset.v6TopReady === 'true') return;
        button.dataset.v6TopReady = 'true';
        var frameId = 0;
        var isVisible = false;

        function sync() {
            frameId = 0;
            var nextVisible = window.scrollY > 520;
            if (nextVisible === isVisible) {
                return;
            }
            isVisible = nextVisible;
            button.classList.toggle('is-visible', nextVisible);
        }

        function scheduleSync() {
            if (frameId) return;
            frameId = window.requestAnimationFrame(sync);
        }

        button.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', scheduleSync, { passive: true });
        sync();
    }

    function renderCaseStoryCard(item) {
        var cover =
            item && typeof item === 'object' && item.cover ? item.cover : {};
        var tags = normalizeList(item.tags)
            .map(function (tag) {
                return '<span>' + escapeHtml(tag) + '</span>';
            })
            .join('');
        var comparePairs = normalizeList(item.comparePairs);
        var compareMarkup = '';
        if (comparePairs.length) {
            compareMarkup =
                '<div class="v6-case-stories__compare">' +
                comparePairs
                    .slice(0, 1)
                    .map(function (pair) {
                        var before =
                            pair && typeof pair === 'object'
                                ? pair.before || {}
                                : {};
                        var after =
                            pair && typeof pair === 'object'
                                ? pair.after || {}
                                : {};
                        return (
                            '<figure>' +
                            '<img src="' +
                            escapeHtml(before.url || '') +
                            '" alt="' +
                            escapeHtml(before.alt || '') +
                            '" loading="lazy" decoding="async" />' +
                            '<figcaption>Before</figcaption>' +
                            '</figure>' +
                            '<figure>' +
                            '<img src="' +
                            escapeHtml(after.url || '') +
                            '" alt="' +
                            escapeHtml(after.alt || '') +
                            '" loading="lazy" decoding="async" />' +
                            '<figcaption>After</figcaption>' +
                            '</figure>'
                        );
                    })
                    .join('') +
                '</div>';
        }

        return (
            '<article class="v6-case-stories__card" data-v6-case-story="' +
            escapeHtml(item.slug || item.storyId || '') +
            '">' +
            '<figure class="v6-case-stories__cover">' +
            '<img src="' +
            escapeHtml(cover.url || '') +
            '" alt="' +
            escapeHtml(cover.alt || item.title || '') +
            '" loading="lazy" decoding="async" />' +
            '</figure>' +
            '<div class="v6-case-stories__meta">' +
            '<p>' +
            escapeHtml(item.category || '') +
            '</p>' +
            '<h3>' +
            escapeHtml(item.title || '') +
            '</h3>' +
            '<p>' +
            escapeHtml(item.summary || item.deck || '') +
            '</p>' +
            (tags
                ? '<div class="v6-case-stories__tags">' + tags + '</div>'
                : '') +
            compareMarkup +
            (item.disclaimer
                ? '<small>' + escapeHtml(item.disclaimer) + '</small>'
                : '') +
            '</div>' +
            '</article>'
        );
    }

    function bootCaseStories() {
        var roots = Array.from(
            document.querySelectorAll('[data-v6-case-stories]')
        );
        if (!roots.length) return;

        roots.forEach(function (root) {
            if (!(root instanceof HTMLElement)) return;
            if (root.dataset.v6CaseStoriesReady === 'loading') return;

            var locale = root.getAttribute('data-v6-locale') || 'es';
            var state = root.querySelector('[data-v6-case-stories-state]');
            var grid = root.querySelector('[data-v6-case-stories-grid]');
            if (
                !(grid instanceof HTMLElement) ||
                !(state instanceof HTMLElement)
            )
                return;

            root.dataset.v6CaseStoriesReady = 'loading';
            root.hidden = true;
            fetch(
                '/api.php?resource=public-case-stories&locale=' +
                    encodeURIComponent(locale),
                {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                }
            )
                .then(function (response) {
                    return response.ok ? response.json() : Promise.reject();
                })
                .then(function (payload) {
                    var data =
                        payload && typeof payload === 'object' && payload.data
                            ? payload.data
                            : {};
                    var items = normalizeList(data.items);
                    if (!items.length) {
                        root.dataset.v6CaseStoriesReady = 'empty';
                        root.hidden = true;
                        grid.hidden = true;
                        state.hidden = true;
                        return;
                    }

                    grid.innerHTML = items
                        .map(function (item) {
                            return renderCaseStoryCard(
                                item && typeof item === 'object' ? item : {}
                            );
                        })
                        .join('');
                    root.hidden = false;
                    state.hidden = true;
                    grid.hidden = false;
                    root.dataset.v6CaseStoriesReady = 'true';
                })
                .catch(function () {
                    root.dataset.v6CaseStoriesReady = 'empty';
                    root.hidden = true;
                    grid.hidden = true;
                    state.hidden = true;
                });
        });
    }

    function bootCommercialHydration() {
        if (!document.querySelector('[data-commercial-cta], [data-commercial-price]')) {
            return;
        }
        getPublicRuntimeConfigPromise().then(function (config) {
            var commercial = config && config.commercialConfig ? config.commercialConfig : null;
            if (!commercial) return;

            if (commercial.cta_targets) {
                document.querySelectorAll('[data-commercial-cta]').forEach(function (el) {
                    var key = el.getAttribute('data-commercial-cta') || '';
                    if (commercial.cta_targets[key]) {
                        el.setAttribute('href', commercial.cta_targets[key]);
                    }
                });
            }

            if (commercial.pricing) {
                document.querySelectorAll('[data-commercial-price]').forEach(function (el) {
                    var key = el.getAttribute('data-commercial-price') || '';
                    if (commercial.pricing[key] !== undefined) {
                        el.textContent = commercial.pricing[key];
                    }
                });
            }
        });
    }

    function bootstrap() {
        bootCookieConsent();
        bootCommercialHydration();
        contextualizeWhatsAppLinks();
        bindWhatsAppTracking();
        bootMegaMenu();
        bootHeaderSearch();
        bootNewsStrip();
        bootPageMenus();
        bootDrawer();
        bootHero();
        bootRevealElements();

        function runDeferredBoot() {
            bootSectionNavigation();
            bootCaseStories();
            bootBackTop();
        }

        function scheduleDeferredBoot() {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(runDeferredBoot, { timeout: 1200 });
                return;
            }
            window.setTimeout(runDeferredBoot, 120);
        }

        if (document.readyState === 'complete') {
            scheduleDeferredBoot();
        } else {
            window.addEventListener('load', scheduleDeferredBoot, {
                once: true,
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, {
            once: true,
        });
    } else {
        bootstrap();
    }
})();
