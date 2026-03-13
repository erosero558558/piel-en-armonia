const e = localStorage.getItem('language'),
    t = (navigator.language || navigator.userLanguage || '').startsWith('en')
        ? 'en'
        : 'es';
let n = e || t,
    o = localStorage.getItem('themeMode') || 'system',
    r = null,
    i = { active: !1, completed: !1, startedAt: 0, service: '', doctor: '' },
    a = 0;
const c = new Map();
let s = [],
    u = {
        enabled: !1,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    },
    l = !1,
    d = 0,
    g = null,
    m = !1,
    p = [];
const f = 'chatHistory',
    h = 'clinicalHistorySession';
function y() {
    return n;
}
function w() {
    return r;
}
function b(e) {
    r = e;
}
function v() {
    return s;
}
function k(e) {
    s = e;
}
function P() {
    return u;
}
function E(e) {
    u = e;
}
function S() {
    return l;
}
function _(e) {
    l = e;
}
function C() {
    return d;
}
function M(e) {
    d = e;
}
function A() {
    return g;
}
function j(e) {
    g = e;
}
function I() {
    return m;
}
function L(e) {
    m = e;
}
function T() {
    return p;
}
function B(e) {
    p = e;
}
function D() {
    try {
        const e = localStorage.getItem(f),
            t = e ? JSON.parse(e) : [],
            n = Date.now() - 864e5,
            o = t.filter((e) => e.time && new Date(e.time).getTime() > n);
        if (o.length !== t.length)
            try {
                localStorage.setItem(f, JSON.stringify(o));
            } catch {}
        return o;
    } catch {
        return [];
    }
}
function O(e) {
    try {
        localStorage.setItem(f, JSON.stringify(e));
    } catch {}
}
function R() {
    try {
        const e = localStorage.getItem(h),
            t = e ? JSON.parse(e) : null;
        if (!t || 'object' != typeof t) return null;
        const n = t.session && 'object' == typeof t.session ? t.session : t;
        if (!n || 'object' != typeof n) return null;
        if (
            'string' != typeof n.sessionId &&
            'string' != typeof n.caseId &&
            'string' != typeof n?.metadata?.patientIntake?.sessionId &&
            'string' != typeof n?.metadata?.patientIntake?.caseId
        )
            return null;
        if (
            (function (e, t) {
                const n = Date.now(),
                    o = [
                        e,
                        t && 'string' == typeof t.updatedAt
                            ? Date.parse(t.updatedAt)
                            : Number.NaN,
                        t && 'string' == typeof t.createdAt
                            ? Date.parse(t.createdAt)
                            : Number.NaN,
                    ].find((e) => Number.isFinite(e));
                return !!Number.isFinite(o) && n - o > 6048e5;
            })(Number(t.savedAt), n)
        ) {
            try {
                localStorage.removeItem(h);
            } catch {}
            return null;
        }
        return n;
    } catch {
        return null;
    }
}
function N(e) {
    try {
        if (!e || 'object' != typeof e) return void localStorage.removeItem(h);
        localStorage.setItem(
            h,
            JSON.stringify({ savedAt: Date.now(), session: e })
        );
    } catch {}
}
function x() {
    try {
        localStorage.removeItem(h);
    } catch {}
}
const q = {
        currentLang: [
            y,
            function (e) {
                n = e;
            },
        ],
        currentThemeMode: [
            function () {
                return o;
            },
            function (e) {
                o = e;
            },
        ],
        currentAppointment: [w, b],
        checkoutSession: [
            function () {
                return i;
            },
            function (e) {
                i = e;
            },
        ],
        reviewsCache: [v, k],
        chatbotOpen: [I, L],
        conversationContext: [T, B],
        clinicalHistorySession: [R, N],
    },
    U = new Proxy(
        { bookedSlotsCache: c },
        {
            get: (e, t, n) =>
                'chatHistory' === t
                    ? D()
                    : Object.prototype.hasOwnProperty.call(q, t)
                      ? q[t][0]()
                      : Reflect.get(e, t, n),
            set: (e, t, n, o) =>
                'chatHistory' === t
                    ? (O(n), !0)
                    : 'bookedSlotsCache' !== t &&
                      (Object.prototype.hasOwnProperty.call(q, t)
                          ? (q[t][1](n), !0)
                          : Reflect.set(e, t, n, o)),
        }
    ),
    W = '/api.php',
    K = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador',
    z =
        'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D',
    F = '+593 98 786 6885',
    $ = 'caro93narvaez@gmail.com',
    J = new Set(['light', 'dark', 'system']);
function V() {}
function G(e) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        'function' == typeof window.Piel.ChatUiEngine.escapeHtml
    )
        return window.Piel.ChatUiEngine.escapeHtml(e);
    const t = document.createElement('div');
    return ((t.textContent = String(e || '')), t.innerHTML);
}
function H(e) {
    return new Promise((t) => setTimeout(t, e));
}
function Q(e) {
    const t = String(e || '').trim();
    if ('' === t) return t;
    const n = (window.Piel && window.Piel.deployVersion) || '';
    if (!n) return t;
    try {
        const e = new URL(t, window.location.origin);
        return (
            e.searchParams.set('cv', n),
            t.startsWith('/') ? e.pathname + e.search : e.toString()
        );
    } catch (e) {
        const o = t.indexOf('?') >= 0 ? '&' : '?';
        return t + o + 'cv=' + encodeURIComponent(n);
    }
}
function Y(e, t = 'info', n = '') {
    let o = document.getElementById('toastContainer');
    o ||
        ((o = document.createElement('div')),
        (o.id = 'toastContainer'),
        (o.className = 'toast-container'),
        document.body.appendChild(o));
    const r = document.createElement('div');
    r.className = `toast ${t}`;
    const i = {
            success: n || 'Exito',
            error: n || 'Error',
            warning: n || 'Advertencia',
            info: n || 'Informacion',
        },
        a = String(e)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    ((r.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${i[t]}</div>\n            <div class="toast-message">${a}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="toast-close">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        o.appendChild(r),
        setTimeout(() => {
            r.parentElement &&
                ((r.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => r.remove(), 300));
        }, 5e3));
}
function X(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function Z(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
const ee = new Map();
function te(e) {
    const {
        cacheKey: t,
        src: n,
        scriptDataAttribute: o,
        resolveModule: r,
        isModuleReady: i = (e) => !!e,
        onModuleReady: a,
        missingApiError: c = 'Deferred module loaded without expected API',
        loadError: s = 'No se pudo cargar el modulo diferido',
        logLabel: u = '',
    } = e || {};
    if (!t || !n || !o || 'function' != typeof r)
        return Promise.reject(
            new Error('Invalid deferred module configuration')
        );
    const l = () => {
            const e = r();
            return i(e) ? ('function' == typeof a && a(e), e) : null;
        },
        d = l();
    if (d) return Promise.resolve(d);
    if (ee.has(t)) return ee.get(t);
    const g = new Promise((e, t) => {
        import(n)
            .then(() => {
                if (!document.querySelector('script[' + o + '="true"]')) {
                    const e = document.createElement('script');
                    (e.setAttribute(o, 'true'),
                        (e.dataset.dynamicImport = 'true'),
                        document.head.appendChild(e));
                }
                (() => {
                    const n = l();
                    n ? e(n) : t(new Error(c));
                })();
            })
            .catch((e) => {
                t(new Error(s));
            });
    }).catch((e) => {
        throw (ee.delete(t), e);
    });
    return (ee.set(t, g), g);
}
function ne(e, t = {}) {
    const {
        idleTimeout: n = 2e3,
        fallbackDelay: o = 1200,
        skipOnConstrained: r = !0,
        constrainedDelay: i = o,
    } = t;
    return (function () {
        const e =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;
        return !(
            !e ||
            (!0 !== e.saveData &&
                !/(^|[^0-9])2g/.test(String(e.effectiveType || '')))
        );
    })()
        ? !r && (setTimeout(e, i), !0)
        : ('function' == typeof window.requestIdleCallback
              ? window.requestIdleCallback(e, { timeout: n })
              : setTimeout(e, o),
          !0);
}
function oe(e, t, n, o = !0) {
    const r = document.querySelector(e);
    return !!r && (r.addEventListener(t, n, { once: !0, passive: o }), !0);
}
function re(e) {
    let t = !1;
    return function () {
        t || ((t = !0), e());
    };
}
function ie(e, t = {}) {
    const n = !0 === t.markWarmOnSuccess;
    let o = !1;
    return function () {
        o ||
            'file:' === window.location.protocol ||
            (n
                ? Promise.resolve(e())
                      .then(() => {
                          o = !0;
                      })
                      .catch(() => {})
                : ((o = !0),
                  Promise.resolve(e()).catch(() => {
                      o = !1;
                  })));
    };
}
function ae(e, t, n = {}) {
    const { threshold: o = 0.05, rootMargin: r = '0px', onNoObserver: i } = n;
    if (!e) return !1;
    if (!('IntersectionObserver' in window))
        return ('function' == typeof i && i(), !1);
    const a = new IntersectionObserver(
        (e) => {
            e.forEach((e) => {
                e.isIntersecting && (t(e), a.disconnect());
            });
        },
        { threshold: o, rootMargin: r }
    );
    return (a.observe(e), !0);
}
function ce(e, t) {
    return Promise.resolve()
        .then(() => e())
        .then((e) => t(e));
}
function se(e, t, n) {
    return ce(e, t).catch((e) => {
        if ('function' == typeof n) return n(e);
    });
}
const ue = Q('/js/engines/ui-bundle.js'),
    le = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
function de() {
    return te({
        cacheKey: 'theme-engine',
        src: ue,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ThemeEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentThemeMode: () => U.currentThemeMode,
                setCurrentThemeMode: (e) => {
                    U.currentThemeMode = J.has(e) ? e : 'system';
                },
                themeStorageKey: 'themeMode',
                validThemeModes: Array.from(J),
                getSystemThemeQuery: () => le,
            }),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine',
    });
}
function ge(e) {
    se(de, (t) => t.setThemeMode(e));
}
let me = null;
function pe(e) {
    (me || (me = import('./js/chunks/engagement-CKnEtqEi.js')), me)
        .then((t) => t.renderPublicReviews(e))
        .catch(() => {});
}
const fe = Q('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function he() {
    return te({
        cacheKey: 'i18n-engine',
        src: fe,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => U.currentLang,
                setCurrentLang: (e) => {
                    U.currentLang = 'en' === e ? 'en' : 'es';
                },
                showToast: Y,
                getReviewsCache: () => U.reviewsCache,
                renderPublicReviews: pe,
                debugLog: V,
            }),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine.js',
        logLabel: 'I18n engine',
    });
}
async function ye(e) {
    return ce(he, (t) => t.changeLanguage(e));
}
async function we(e, t = {}) {
    const n = String(t.method || 'GET').toUpperCase(),
        o = new URLSearchParams({ resource: e });
    t.query &&
        'object' == typeof t.query &&
        Object.entries(t.query).forEach(([e, t]) => {
            null != t && '' !== t && o.set(e, String(t));
        });
    const r = `${W}?${o.toString()}`,
        i = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        };
    void 0 !== t.body &&
        ((i.headers['Content-Type'] = 'application/json'),
        (i.body = JSON.stringify(t.body)));
    const c = Number.isFinite(t.timeoutMs)
            ? Math.max(1500, Number(t.timeoutMs))
            : 9e3,
        s = Number.isInteger(t.retries)
            ? Math.max(0, Number(t.retries))
            : 'GET' === n
              ? 1
              : 0,
        u = !0 !== t.silentSlowNotice,
        l = new Set([408, 425, 429, 500, 502, 503, 504]);
    function d(e, t = 0, n = !1, o = '') {
        const r = new Error(e);
        return ((r.status = t), (r.retryable = n), (r.code = o), r);
    }
    let g = null;
    for (let e = 0; e <= s; e += 1) {
        const t = new AbortController(),
            n = setTimeout(() => t.abort(), c);
        let o = null;
        u &&
            (o = setTimeout(() => {
                const e = Date.now();
                e - a > 25e3 &&
                    ((a = e),
                    Y(
                        'es' === U.currentLang
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    ));
            }, 1200));
        try {
            const e = await fetch(r, { ...i, signal: t.signal }),
                n = await e.text();
            let o = {};
            try {
                o = n ? JSON.parse(n) : {};
            } catch (t) {
                throw d(
                    'Respuesta del servidor no es JSON valido',
                    e.status,
                    !1,
                    'invalid_json'
                );
            }
            if (!e.ok || !1 === o.ok)
                throw d(
                    o.error || `HTTP ${e.status}`,
                    e.status,
                    l.has(e.status),
                    'http_error'
                );
            return o;
        } catch (t) {
            const n = (() =>
                t && 'AbortError' === t.name
                    ? d(
                          'es' === U.currentLang
                              ? 'Tiempo de espera agotado con el servidor'
                              : 'Server request timed out',
                          0,
                          !0,
                          'timeout'
                      )
                    : t instanceof Error
                      ? ('boolean' != typeof t.retryable && (t.retryable = !1),
                        'number' != typeof t.status && (t.status = 0),
                        t)
                      : d(
                            'Error de conexion con el servidor',
                            0,
                            !0,
                            'network_error'
                        ))();
            if (((g = n), !(e < s && !0 === n.retryable))) throw n;
            const o = 450 * (e + 1);
            await H(o);
        } finally {
            (clearTimeout(n), null !== o && clearTimeout(o));
        }
    }
    throw g || new Error('No se pudo completar la solicitud');
}
const be = Q('/js/engines/booking-utils.js');
function ve() {
    return te({
        cacheKey: 'booking-utils',
        src: be,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                apiRequest: we,
                getCurrentLang: y,
                getPaymentConfig: P,
                setPaymentConfig: E,
                getPaymentConfigLoaded: S,
                setPaymentConfigLoaded: _,
                getPaymentConfigLoadedAt: C,
                setPaymentConfigLoadedAt: M,
                getStripeSdkPromise: A,
                setStripeSdkPromise: j,
                apiEndpoint: W,
                apiRequestTimeoutMs: 9e3,
            }),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine',
    });
}
async function ke() {
    return se(ve, (e) => e.loadPaymentConfig());
}
async function Pe() {
    return se(ve, (e) => e.loadStripeSdk());
}
async function Ee(e) {
    return se(ve, (t) => t.createPaymentIntent(e));
}
async function Se(e) {
    return se(ve, (t) => t.verifyPaymentIntent(e));
}
let _e = null;
function Ce() {
    const e = ((window.Piel || {}).config || {}).captcha || {};
    return {
        provider: String(e.provider || '')
            .trim()
            .toLowerCase(),
        siteKey: String(e.siteKey || '').trim(),
        scriptUrl: String(e.scriptUrl || '').trim(),
    };
}
async function Me(e) {
    const t = String(e || '').trim() || 'submit';
    try {
        const e = await (function () {
            if (_e) return _e;
            const e = Ce();
            return e.provider && e.siteKey && e.scriptUrl
                ? ((_e = new Promise((t) => {
                      const n = document.createElement('script');
                      ((n.src = e.scriptUrl),
                          (n.async = !0),
                          (n.defer = !0),
                          (n.onload = () => t(e.provider)),
                          (n.onerror = () => t(null)),
                          document.head.appendChild(n));
                  })),
                  _e)
                : Promise.resolve(null);
        })();
        if (!e) return null;
        const n = Ce().siteKey;
        if ('recaptcha' === e)
            return window.grecaptcha &&
                'function' == typeof window.grecaptcha.ready
                ? new Promise((e) => {
                      window.grecaptcha.ready(async () => {
                          try {
                              const o = await window.grecaptcha.execute(n, {
                                  action: t,
                              });
                              e(o || null);
                          } catch (t) {
                              e(null);
                          }
                      });
                  })
                : null;
        if ('turnstile' === e) {
            if (
                !window.turnstile ||
                'function' != typeof window.turnstile.render
            )
                return null;
            const e = document.createElement('div');
            return (
                (e.style.display = 'none'),
                document.body.appendChild(e),
                new Promise((o) => {
                    let r = null;
                    const i = () => {
                        try {
                            null !== r &&
                                window.turnstile &&
                                'function' == typeof window.turnstile.remove &&
                                window.turnstile.remove(r);
                        } catch (e) {}
                        e.remove();
                    };
                    try {
                        r = window.turnstile.render(e, {
                            sitekey: n,
                            action: t,
                            callback: (e) => {
                                (i(), o(e || null));
                            },
                            'error-callback': () => {
                                (i(), o(null));
                            },
                        });
                    } catch (e) {
                        (i(), o(null));
                    }
                })
            );
        }
    } catch (e) {
        return null;
    }
    return null;
}
const Ae = Q('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function je() {
    return te({
        cacheKey: 'data-engine',
        src: Ae,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.DataEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => U.currentLang,
                getCaptchaToken: Me,
                showToast: Y,
                storageGetJSON: X,
                storageSetJSON: Z,
            }),
        missingApiError: 'data-engine loaded without API',
        loadError: 'No se pudo cargar data-bundle.js (data-engine)',
        logLabel: 'Data engine',
    });
}
function Ie() {
    const e = ie(() => je(), { markWarmOnSuccess: !0 });
    (oe('#v5-booking-form', 'focusin', e, !1),
        oe('#v5-booking-form', 'pointerdown', e),
        oe('#appointmentForm', 'focusin', e, !1),
        oe('#appointmentForm', 'pointerdown', e),
        oe('#chatbotWidget .chatbot-toggle', 'pointerdown', e),
        ae(
            document.getElementById('v5-booking') ||
                document.getElementById('citas'),
            e,
            { threshold: 0.05, rootMargin: '260px 0px', onNoObserver: e }
        ),
        ne(e, { idleTimeout: 1800, fallbackDelay: 900 }));
}
async function Le(e, t = {}) {
    return ce(je, (n) => n.apiRequest(e, t));
}
function Te(e = '', t = '', n = '') {
    window.Piel &&
    window.Piel.DataEngine &&
    'function' == typeof window.Piel.DataEngine.invalidateBookedSlotsCache
        ? window.Piel.DataEngine.invalidateBookedSlotsCache(e, t, n)
        : ce(je, (o) => o.invalidateBookedSlotsCache(e, t, n)).catch(() => {});
}
async function Be(e = {}) {
    return ce(je, (t) => t.loadAvailabilityData(e));
}
async function De(e, t = '', n = '') {
    return ce(je, (o) => o.getBookedSlots(e, t, n));
}
async function Oe(e, t = {}) {
    return ce(je, (n) => n.createAppointmentRecord(e, t));
}
async function Re(e) {
    return ce(je, (t) => t.createCallbackRecord(e));
}
async function Ne(e) {
    return ce(je, (t) => t.createReviewRecord(e));
}
async function xe(e, t = {}) {
    return ce(je, (n) => n.uploadTransferProof(e, t));
}
let qe = null;
function Ue(e = {}) {
    return (qe || (qe = import('./js/chunks/engagement-CKnEtqEi.js')), qe).then(
        (t) => t.loadPublicReviews(e)
    );
}
const We = Q(
        '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
    ),
    Ke = '/api.php?resource=funnel-event',
    ze = new Set([
        'view_booking',
        'view_service_category',
        'view_service_detail',
        'start_booking_from_service',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click',
    ]),
    Fe = new Set([
        'source',
        'step',
        'payment_method',
        'checkout_entry',
        'checkout_step',
        'reason',
        'error_code',
        'service_slug',
        'service_category',
        'service_intent',
        'entry_point',
        'entry_surface',
        'route_profile',
        'route_id',
        'route_variant',
        'catalog_category',
        'catalog_intent',
        'booking_hint',
        'locale',
        'funnel_step',
        'intent',
        'public_surface',
    ]),
    $e = new Map();
function Je(e = {}) {
    const t = e && 'object' == typeof e ? { ...e } : {},
        n = (function () {
            if (
                !window.Piel ||
                'function' != typeof window.Piel.getExperimentContext
            )
                return null;
            try {
                const e = window.Piel.getExperimentContext();
                return e && 'object' == typeof e ? e : null;
            } catch (e) {
                return null;
            }
        })();
    if (!n) return t;
    const o = Ge(n.heroVariant, '');
    o &&
        !Object.prototype.hasOwnProperty.call(t, 'ab_variant') &&
        (t.ab_variant = o);
    const r = Ge(n.source, '');
    return (
        r &&
            !Object.prototype.hasOwnProperty.call(t, 'source') &&
            (t.source = r),
        t
    );
}
function Ve(e, t = {}) {
    const n = t && 'object' == typeof t ? { ...t } : {},
        o = (function () {
            const e = (() => {
                    const e = String(
                        ('undefined' != typeof document &&
                        document.documentElement
                            ? document.documentElement.lang
                            : '') || ''
                    )
                        .trim()
                        .toLowerCase();
                    return e.startsWith('en')
                        ? 'en'
                        : e.startsWith('es')
                          ? 'es'
                          : String(window.location.pathname || '').startsWith(
                                  '/en/'
                              )
                            ? 'en'
                            : 'es';
                })(),
                t = Ge(
                    (function () {
                        const e = String('pa_public_surface').trim();
                        if (!e || 'undefined' == typeof document) return '';
                        const t = String(document.cookie || '');
                        if (!t) return '';
                        const n = t.split(';');
                        for (const t of n) {
                            const n = String(t || '').trim();
                            if (!n) continue;
                            const o = n.indexOf('=');
                            if ((o >= 0 ? n.slice(0, o).trim() : n) !== e)
                                continue;
                            const r = o >= 0 ? n.slice(o + 1).trim() : '';
                            try {
                                return decodeURIComponent(r);
                            } catch (e) {
                                return r;
                            }
                        }
                        return '';
                    })(),
                    ''
                );
            return {
                locale: e,
                publicSurface:
                    'legacy' === t || 'v4' === t
                        ? t
                        : (function (e) {
                              const t = String(e).trim().toLowerCase();
                              return '/legacy.php' === t || '/legacy' === t
                                  ? 'legacy'
                                  : 'v4';
                          })(window.location.pathname || '/'),
            };
        })();
    if (
        (Object.prototype.hasOwnProperty.call(n, 'locale') ||
            (n.locale = o.locale),
        Object.prototype.hasOwnProperty.call(n, 'public_surface') ||
            (n.public_surface = o.publicSurface),
        !Object.prototype.hasOwnProperty.call(n, 'entry_surface') &&
            Object.prototype.hasOwnProperty.call(n, 'entry_point') &&
            (n.entry_surface = n.entry_point),
        !Object.prototype.hasOwnProperty.call(n, 'entry_point') &&
            Object.prototype.hasOwnProperty.call(n, 'entry_surface') &&
            (n.entry_point = n.entry_surface),
        Object.prototype.hasOwnProperty.call(n, 'funnel_step') ||
            (n.funnel_step = (function (e, t = {}) {
                const n = Ge(t.funnel_step, '');
                if (n) return n;
                const o = Ge(e, '');
                switch (o) {
                    case 'view_booking':
                        return 'booking_view';
                    case 'view_service_category':
                        return 'service_category';
                    case 'view_service_detail':
                        return 'service_detail';
                    case 'start_booking_from_service':
                        return 'booking_intent';
                    case 'start_checkout':
                        return 'checkout_start';
                    case 'booking_confirmed':
                        return 'booking_confirmed';
                    case 'checkout_abandon':
                        return 'checkout_abandon';
                    case 'booking_step_completed':
                        return Ge(t.step, 'booking_step');
                    case 'payment_method_selected':
                        return 'payment_method_selected';
                    case 'payment_success':
                        return 'payment_success';
                    case 'booking_error':
                    case 'checkout_error':
                        return o;
                    default:
                        return 'interaction';
                }
            })(e, n)),
        !Object.prototype.hasOwnProperty.call(n, 'intent'))
    ) {
        const e = (function (e = {}) {
            const t = Ge(e.intent, '');
            if (t) return t;
            const n = Ge(e.service_intent || e.catalog_intent, '');
            if (n) return n;
            const o = Ge(e.route_profile, '');
            return 'remote' === o
                ? 'remote'
                : 'pediatric' === o
                  ? 'pediatric'
                  : 'diagnosis' === o
                    ? 'diagnosis'
                    : 'procedure' === o
                      ? 'procedures'
                      : '';
        })(n);
        e && (n.intent = e);
    }
    return n;
}
function Ge(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9_]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 48) || t;
}
function He(e, t = {}) {
    const n = Ge(e, '');
    if (!ze.has(n)) return;
    if ('file:' === window.location.protocol) return;
    const o = (function (e = {}) {
            const t = {
                source: Ge(
                    e && 'object' == typeof e ? e.source : void 0,
                    'unknown'
                ),
            };
            return e && 'object' == typeof e
                ? (Fe.forEach((n) => {
                      'source' !== n &&
                          Object.prototype.hasOwnProperty.call(e, n) &&
                          (t[n] = Ge(e[n], 'unknown'));
                  }),
                  t)
                : t;
        })(Ve(e, Je(t))),
        r = [
            n,
            o.step || '',
            o.payment_method || '',
            o.checkout_step || o.step || '',
            o.reason || '',
            o.source || '',
            o.service_slug || '',
            o.entry_surface || o.entry_point || '',
            o.locale || '',
            o.public_surface || '',
        ].join('|'),
        i = Date.now();
    if (i - ($e.get(r) || 0) < 1200) return;
    $e.set(r, i);
    const a = JSON.stringify({ event: n, params: o });
    try {
        if (navigator.sendBeacon) {
            const e = new Blob([a], { type: 'application/json' });
            if (navigator.sendBeacon(Ke, e)) return;
        }
    } catch (e) {}
    fetch(Ke, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: a,
        keepalive: !0,
        credentials: 'same-origin',
    }).catch(() => {});
}
function Qe() {
    return te({
        cacheKey: 'analytics-engine',
        src: We,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                observeOnceWhenVisible: ae,
                loadAvailabilityData: Be,
                loadPublicReviews: Ue,
                trackEventToServer: He,
            }),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}
function Ye(e, t = {}) {
    const n = Je(t);
    (He(e, n), se(Qe, (t) => t.trackEvent(e, n)));
}
function Xe(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 64) || t;
}
function Ze(e = 'unknown') {
    se(Qe, (t) => t.markBookingViewed(e));
}
const et = Q('/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'),
    tt = Q(
        '/js/engines/booking-ui.js?v=figo-booking-ui-20260222-slotservicefix1'
    ),
    nt = Q('/js/engines/booking-utils.js');
let ot = null;
function rt(e = !1) {
    (ot || (ot = import('./js/chunks/success-modal-9T9R_btl.js')), ot)
        .then((t) => t.showSuccessModal(e))
        .catch(() => Y('No se pudo abrir la confirmacion de cita.', 'error'));
}
function it(e) {
    const t = { ...e };
    return (delete t.casePhotoFiles, delete t.casePhotoUploads, t);
}
async function at(e) {
    const t = it(e || {}),
        n = await (async function (e) {
            const t = Array.isArray(e?.casePhotoFiles) ? e.casePhotoFiles : [];
            if (0 === t.length) return { names: [], urls: [], paths: [] };
            if (
                Array.isArray(e.casePhotoUploads) &&
                e.casePhotoUploads.length > 0
            )
                return {
                    names: e.casePhotoUploads
                        .map((e) => String(e.name || ''))
                        .filter(Boolean),
                    urls: e.casePhotoUploads
                        .map((e) => String(e.url || ''))
                        .filter(Boolean),
                    paths: e.casePhotoUploads
                        .map((e) => String(e.path || ''))
                        .filter(Boolean),
                };
            const n = new Array(t.length),
                o = Math.max(1, Math.min(2, t.length));
            let r = 0;
            return (
                await Promise.all(
                    Array.from({ length: o }, () =>
                        (async () => {
                            for (; r < t.length; ) {
                                const e = r;
                                r += 1;
                                const o = t[e],
                                    i = await xe(o, { retries: 2 });
                                n[e] = {
                                    name: i.transferProofName || o.name || '',
                                    url: i.transferProofUrl || '',
                                    path: i.transferProofPath || '',
                                };
                            }
                        })()
                    )
                ),
                (e.casePhotoUploads = n),
                {
                    names: n.map((e) => String(e.name || '')).filter(Boolean),
                    urls: n.map((e) => String(e.url || '')).filter(Boolean),
                    paths: n.map((e) => String(e.path || '')).filter(Boolean),
                }
            );
        })(e || {});
    return (
        (t.casePhotoCount = n.urls.length),
        (t.casePhotoNames = n.names),
        (t.casePhotoUrls = n.urls),
        (t.casePhotoPaths = n.paths),
        t
    );
}
function ct() {
    return te({
        cacheKey: 'booking-engine',
        src: et,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.Piel && window.Piel.BookingEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => U.currentLang,
                getCurrentAppointment: () => U.currentAppointment,
                setCurrentAppointment: (e) => {
                    U.currentAppointment = e;
                },
                getCheckoutSession: () => U.checkoutSession,
                setCheckoutSessionActive: (e) => {
                    U.checkoutSession.active = !0 === e;
                },
                startCheckoutSession: ut,
                setCheckoutStep: lt,
                completeCheckoutSession: dt,
                maybeTrackCheckoutAbandon: gt,
                loadPaymentConfig: ke,
                loadStripeSdk: Pe,
                createPaymentIntent: Ee,
                verifyPaymentIntent: Se,
                buildAppointmentPayload: at,
                stripTransientAppointmentFields: it,
                createAppointmentRecord: Oe,
                uploadTransferProof: xe,
                getCaptchaToken: Me,
                showSuccessModal: rt,
                showToast: Y,
                debugLog: V,
                trackEvent: Ye,
                normalizeAnalyticsLabel: Xe,
            }),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine',
    });
}
function st() {
    const e = ie(() => ct(), { markWarmOnSuccess: !0 });
    ([
        '.nav-cta[href="#v5-booking"]',
        '.quick-dock-item[href="#v5-booking"]',
        '.hero-actions a[href="#v5-booking"]',
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]',
    ].forEach((t) => {
        (oe(t, 'mouseenter', e), oe(t, 'focus', e, !1), oe(t, 'touchstart', e));
    }),
        ne(e, { idleTimeout: 2500, fallbackDelay: 1100 }));
}
function ut(e, t = {}) {
    se(Qe, (n) => n.startCheckoutSession(e, t));
}
function lt(e, t = {}) {
    se(Qe, (n) => n.setCheckoutStep(e, t));
}
function dt(e) {
    se(Qe, (t) => t.completeCheckoutSession(e));
}
function gt(e = 'unknown') {
    se(Qe, (t) => t.maybeTrackCheckoutAbandon(e));
}
function mt() {
    return te({
        cacheKey: 'booking-utils-calendar',
        src: nt,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.initCalendar),
        missingApiError: 'booking-calendar-engine loaded without API',
        loadError: 'No se pudo cargar booking-calendar-engine',
        logLabel: 'Booking Calendar engine',
    });
}
async function pt(e) {
    return se(mt, (t) => t.updateAvailableTimes(ht(), e));
}
function ft() {
    return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
}
function ht() {
    return {
        loadAvailabilityData: Be,
        getBookedSlots: De,
        updateAvailableTimes: pt,
        getDefaultTimeSlots: ft,
        showToast: Y,
        getCurrentLang: () => U.currentLang,
        getCasePhotoFiles: (e) => {
            const t = e?.querySelector('#casePhotos');
            return t && t.files ? Array.from(t.files) : [];
        },
        validateCasePhotoFiles: yt,
        markBookingViewed: Ze,
        startCheckoutSession: ut,
        setCheckoutStep: lt,
        trackEvent: Ye,
        normalizeAnalyticsLabel: Xe,
        openPaymentModal: bt,
        debugLog: V,
        setCurrentAppointment: b,
    };
}
function yt(e) {
    const t = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (Array.isArray(e) && 0 !== e.length) {
        if (e.length > 3)
            throw new Error(
                'es' === U.currentLang
                    ? 'Puedes subir máximo 3 fotos.'
                    : 'You can upload up to 3 photos.'
            );
        for (const n of e) {
            if (!n) continue;
            if (n.size > 5242880)
                throw new Error(
                    'es' === U.currentLang
                        ? `Cada foto debe pesar máximo ${Math.round(5)} MB.`
                        : `Each photo must be at most ${Math.round(5)} MB.`
                );
            const e = String(n.type || '').toLowerCase(),
                o = t.has(e),
                r = /\.(jpe?g|png|webp)$/i.test(String(n.name || ''));
            if (!o && !r)
                throw new Error(
                    'es' === U.currentLang
                        ? 'Solo se permiten imágenes JPG, PNG o WEBP.'
                        : 'Only JPG, PNG or WEBP images are allowed.'
                );
        }
    }
}
function wt() {
    const e = ie(() =>
            te({
                cacheKey: 'booking-ui',
                src: tt,
                scriptDataAttribute: 'data-booking-ui',
                resolveModule: () => window.Piel && window.Piel.BookingUi,
                isModuleReady: (e) => !(!e || 'function' != typeof e.init),
                onModuleReady: (e) => {
                    (e.init(ht()), (window.PielBookingUiReady = !0));
                },
                missingApiError: 'booking-ui loaded without API',
                loadError: 'No se pudo cargar booking-ui.js',
                logLabel: 'Booking UI',
            })
        ),
        t =
            document.getElementById('v5-booking') ||
            document.getElementById('citas');
    ae(t, e, { threshold: 0.05, rootMargin: '320px 0px', onNoObserver: e });
    const n =
        document.getElementById('v5-booking-form') ||
        document.getElementById('appointmentForm');
    (n &&
        (n.addEventListener('focusin', e, { once: !0 }),
        n.addEventListener('pointerdown', e, { once: !0, passive: !0 }),
        setTimeout(e, 120)),
        (t || n) && ne(e, { idleTimeout: 1800, fallbackDelay: 1100 }));
}
function bt(e) {
    se(
        ct,
        (t) => t.openPaymentModal(e),
        (e) => {
            Y('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}
function vt(e = {}) {
    if (
        window.Piel &&
        window.Piel.BookingEngine &&
        'function' == typeof window.Piel.BookingEngine.closePaymentModal
    )
        return void window.Piel.BookingEngine.closePaymentModal(e);
    const t = e && !0 === e.skipAbandonTrack,
        n = e && 'string' == typeof e.reason ? e.reason : 'modal_close';
    (t || gt(n), (U.checkoutSession.active = !1));
    const o =
        document.getElementById('v5-payment-modal') ||
        document.getElementById('paymentModal');
    (o && o.classList.remove('active'), (document.body.style.overflow = ''));
}
async function kt() {
    return se(
        ct,
        (e) => e.processPayment(),
        (e) => {
            Y('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}
let Pt = null;
function Et() {
    return (Pt || (Pt = import('./js/chunks/ui-CHKgNf3E.js')), Pt);
}
let St = null;
function _t() {
    return (St || (St = import('./js/chunks/engagement-CKnEtqEi.js')), St);
}
let Ct = null,
    Mt = null;
function At() {
    return (Mt || (Mt = import('./js/chunks/reschedule-dVDIe1ab.js')), Mt);
}
function jt(e) {
    Et()
        .then((t) => t.toggleMobileMenu(e))
        .catch(() => {});
}
function It() {
    Et()
        .then((e) => e.startWebVideo())
        .catch(() => {});
}
function Lt() {
    Et()
        .then((e) => e.closeVideoModal())
        .catch(() => {});
}
function Tt() {
    _t()
        .then((e) => e.openReviewModal())
        .catch(() => {});
}
function Bt() {
    _t()
        .then((e) => e.closeReviewModal())
        .catch(() => {});
}
function Dt() {
    (Ct || (Ct = import('./js/chunks/success-modal-9T9R_btl.js')), Ct)
        .then((e) => e.closeSuccessModal())
        .catch(() => {});
}
function Ot() {
    At()
        .then((e) => e.closeRescheduleModal())
        .catch(() => {});
}
function Rt() {
    At()
        .then((e) => e.submitReschedule())
        .catch(() => {});
}
function Nt(e) {
    return async (...t) =>
        (await import('./js/chunks/shell-Ce-cs101.js'))[e](...t);
}
const xt = Q('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function qt(e) {
    const t =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    if (t) {
        ((t.value = e),
            t.dispatchEvent(new Event('change')),
            Ze('service_select'));
        const n =
            document.getElementById('v5-booking') ||
            document.getElementById('citas');
        if (n) {
            const e = document.querySelector('.nav')?.offsetHeight || 80,
                t = n.offsetTop - e - 20;
            window.scrollTo({ top: t, behavior: 'smooth' });
        }
    }
}
function Ut() {
    return te({
        cacheKey: 'action-router-engine',
        src: xt,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.ActionRouterEngine) ||
            window.PielActionRouterEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                setThemeMode: ge,
                changeLanguage: ye,
                toggleMobileMenu: jt,
                startWebVideo: It,
                openReviewModal: Tt,
                closeReviewModal: Bt,
                closeVideoModal: Lt,
                closePaymentModal: vt,
                processPayment: kt,
                closeSuccessModal: Dt,
                closeRescheduleModal: Ot,
                submitReschedule: Rt,
                toggleChatbot: Nt('toggleChatbot'),
                sendChatMessage: Nt('sendChatMessage'),
                handleChatBookingSelection: Nt('handleChatBookingSelection'),
                sendQuickMessage: Nt('sendQuickMessage'),
                minimizeChatbot: Nt('minimizeChatbot'),
                startChatBooking: Nt('startChatBooking'),
                handleChatDateSelect: Nt('handleChatDateSelect'),
                selectService: qt,
            }),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine',
    });
}
const Wt = Q('/js/engines/ui-bundle.js');
function Kt() {
    return te({
        cacheKey: 'consent-engine',
        src: Wt,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ConsentEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => U.currentLang,
                showToast: Y,
                trackEvent: Ye,
                cookieConsentKey: 'pa_cookie_consent_v1',
                gaMeasurementId: 'G-GYY8PE5M8W',
            }),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine',
    });
}
let zt = null,
    Ft = null,
    $t = null;
function Jt() {
    return ($t || ($t = import('./js/chunks/shell-Ce-cs101.js')), $t);
}
let Vt = null,
    Gt = null,
    Ht = null,
    Qt = null,
    Yt = null,
    Xt = !1;
const Zt = import('./js/chunks/content-loader-DGkvNYqV.js');
((window.Piel = window.Piel || {}),
    (window.Piel.deployVersion =
        window.Piel.deployVersion ||
        (function () {
            try {
                if (
                    document.currentScript &&
                    'string' == typeof document.currentScript.src &&
                    '' !== document.currentScript.src
                ) {
                    const e = new URL(
                        document.currentScript.src,
                        window.location.href
                    ).searchParams.get('v');
                    if (e) return e;
                }
                const e = document.querySelector('script[src*="script.js"]');
                if (e && 'function' == typeof e.getAttribute) {
                    const t = e.getAttribute('src') || '';
                    if (t) {
                        const e = new URL(
                            t,
                            window.location.href
                        ).searchParams.get('v');
                        if (e) return e;
                    }
                }
            } catch (e) {
                return '';
            }
            return '';
        })()));
const en = 'pa_hero_variant_v1',
    tn = 'control',
    nn = 'focus_agenda',
    on = [tn, nn],
    rn = {
        [tn]: {
            es: {
                subtitle:
                    'Dermatologia especializada con tecnologia de vanguardia. Tratamientos personalizados para que tu piel luzca saludable y radiante.',
                primaryCta: 'Reservar Consulta',
            },
            en: {
                subtitle:
                    'Specialized dermatology with cutting-edge technology. Personalized treatments to keep your skin healthy and radiant.',
                primaryCta: 'Book Consultation',
            },
        },
        [nn]: {
            es: {
                subtitle:
                    'Agenda tu valoracion dermatologica en minutos, con atencion humana y seguimiento real.',
                primaryCta: 'Agenda tu cita hoy',
            },
            en: {
                subtitle:
                    'Schedule your dermatology assessment in minutes with real specialist follow-up.',
                primaryCta: 'Book Your Visit Today',
            },
        },
    };
let an = null,
    cn = !1;
function sn() {
    return (function () {
        try {
            return !!window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches;
        } catch (e) {
            return !1;
        }
    })()
        ? 'auto'
        : 'smooth';
}
function un() {
    return (
        an ||
            (an =
                (function () {
                    try {
                        const e = (function (e) {
                            const t = String(e || '')
                                .trim()
                                .toLowerCase();
                            return on.includes(t) ? t : '';
                        })(localStorage.getItem(en));
                        if (on.includes(e)) return e;
                    } catch (e) {}
                    let e;
                    try {
                        const t = new Uint32Array(1);
                        (window.crypto &&
                        'function' == typeof window.crypto.getRandomValues
                            ? (window.crypto.getRandomValues(t),
                              (e = t[0] % 2 == 0 ? tn : nn))
                            : (e = Math.random() < 0.5 ? tn : nn),
                            localStorage.setItem(en, e));
                    } catch (t) {
                        e = Math.random() < 0.5 ? tn : nn;
                    }
                    return e || tn;
                })() || tn),
        an
    );
}
function ln() {
    const e = un(),
        t = 'en' === U.currentLang ? 'en' : 'es',
        n = rn[e] || rn[tn],
        o = n[t] || n.es,
        r = document.querySelector('.hero-subtitle[data-i18n="hero_subtitle"]');
    r && o.subtitle && (r.textContent = o.subtitle);
    const i = document.querySelector(
        '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]'
    );
    (i && o.primaryCta && (i.textContent = o.primaryCta),
        document.documentElement.setAttribute('data-hero-variant', e));
}
((window.Piel.getExperimentContext = function () {
    const e = un();
    return {
        heroVariant: e,
        source: `hero_${e}`,
        checkoutEntry: e === tn ? 'booking_form' : `booking_form_${e}`,
    };
}),
    (async function () {
        return null !== zt
            ? zt
            : Ft ||
                  ((Ft = fetch('/api.php?action=features', {
                      method: 'GET',
                      headers: { 'Cache-Control': 'no-cache' },
                  })
                      .then((e) => (e.ok ? e.json() : null))
                      .then(
                          (e) => ((zt = e && e.ok && e.data ? e.data : {}), zt)
                      )
                      .catch(() => ((zt = {}), zt))),
                  Ft);
    })().then((e) => {
        window.Piel.features = e;
    }),
    (window.Piel.isFeatureEnabled = function (e) {
        return !!zt && Boolean(zt[e]);
    }));
const dn = Q('/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1');
let gn = null,
    mn = !1;
let pn = '',
    fn = null,
    hn = 0;
function yn(e) {
    const t = String(e || '').trim();
    if (!t) return !1;
    const n =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    return (
        !!n &&
        !!Array.from(n.options || []).some(function (e) {
            return String(e.value || '').trim() === t;
        }) &&
        (n.value !== t &&
            ((n.value = t),
            n.dispatchEvent(new Event('change', { bubbles: !0 })),
            Ze('service_select')),
        !0)
    );
}
function wn() {
    if (!pn || null !== fn) return;
    const e = function () {
        if (((fn = null), pn)) {
            if (((hn += 1), yn(pn), hn >= 60))
                return (
                    (pn = ''),
                    (hn = 0),
                    void (fn && (window.clearTimeout(fn), (fn = null)))
                );
            fn = window.setTimeout(e, 250);
        }
    };
    fn = window.setTimeout(e, 0);
}
let bn = !1;
(document.addEventListener('DOMContentLoaded', function () {
    (document.querySelectorAll('a[href^="URL_"]').forEach((e) => {
        (e.removeAttribute('href'),
            e.setAttribute('aria-disabled', 'true'),
            e.classList.add('is-disabled-link'));
    }),
        Kt(),
        bn ||
            ((bn = !0),
            document.addEventListener('click', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                if (!t) return;
                const n = t.closest('[data-action]');
                if (!n) return;
                const o = String(n.getAttribute('data-action') || '').trim(),
                    r = n.getAttribute('data-value') || '';
                switch (o) {
                    case 'toggle-chatbot':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).toggleChatbot());
                        break;
                    case 'minimize-chat':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).minimizeChatbot());
                        break;
                    case 'send-chat-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).sendChatMessage());
                        break;
                    case 'quick-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).sendQuickMessage(r));
                        break;
                    case 'chat-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).handleChatBookingSelection(r));
                        break;
                    case 'start-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Jt()).startChatBooking());
                        break;
                    case 'select-service':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (function (e) {
                                const t = String(e || '').trim();
                                (t && ((pn = t), (hn = 0)),
                                    (function () {
                                        const e =
                                            document.getElementById(
                                                'v5-booking'
                                            ) ||
                                            document.getElementById('citas');
                                        if (!e) return;
                                        const t =
                                                document.querySelector('.nav')
                                                    ?.offsetHeight || 80,
                                            n = e.offsetTop - t - 20;
                                        window.scrollTo({
                                            top: n,
                                            behavior: sn(),
                                        });
                                    })(),
                                    yn(t),
                                    wn());
                            })(r));
                }
            }),
            document.addEventListener('change', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                t &&
                    t.closest('[data-action="chat-date-select"]') &&
                    (await Jt()).handleChatDateSelect(t.value);
            })),
        Xt ||
            ((Xt = !0),
            document.addEventListener('click', (e) => {
                const t = e.target instanceof Element ? e.target : null;
                if (!t) return;
                const n = t.closest('.theme-btn[data-theme-mode]');
                if (!n) return;
                const o =
                    n.getAttribute('data-theme-mode') ||
                    n.getAttribute('data-value') ||
                    'system';
                (e.preventDefault(), e.stopImmediatePropagation(), ge(o));
            })),
        se(
            Ut,
            () => {},
            (e) => {}
        ),
        mn ||
            'file:' === window.location.protocol ||
            ((mn = !0),
            ne(
                () => {
                    (document.querySelector(
                        'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
                    )
                        ? Promise.resolve(!0)
                        : gn ||
                          ((gn = new Promise((e, t) => {
                              const n = document.createElement('link');
                              ((n.rel = 'stylesheet'),
                                  (n.href = dn),
                                  (n.dataset.deferredStylesheet = 'true'),
                                  (n.onload = () => e(!0)),
                                  (n.onerror = () =>
                                      t(
                                          new Error(
                                              'No se pudo cargar styles-deferred.css'
                                          )
                                      )),
                                  document.head.appendChild(n));
                          }).catch((e) => {
                              throw ((gn = null), e);
                          })),
                          gn)
                    ).catch(() => {});
                },
                {
                    idleTimeout: 1200,
                    fallbackDelay: 160,
                    skipOnConstrained: !1,
                    constrainedDelay: 900,
                }
            )),
        se(de, (e) => e.initThemeMode()),
        ye(U.currentLang)
            .then(() => ln())
            .catch(() => ln()),
        un(),
        ln(),
        (function () {
            const e = (e, t) => {
                const n = document.querySelector(e);
                n &&
                    'true' !== n.dataset.heroExperimentBound &&
                    ((n.dataset.heroExperimentBound = 'true'),
                    n.addEventListener('click', () => {
                        Ye('booking_step_completed', {
                            source: `hero_${un()}`,
                            step: t,
                        });
                    }));
            };
            (e(
                '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]',
                'hero_primary_cta_click'
            ),
                e(
                    '.hero-actions .btn-secondary[data-i18n="hero_cta_secondary"]',
                    'hero_secondary_cta_click'
                ),
                cn ||
                    ((cn = !0),
                    Ye('booking_step_completed', {
                        source: `hero_${un()}`,
                        step: 'hero_variant_assigned',
                    })));
        })(),
        document.addEventListener('piel:language-changed', ln),
        se(Kt, (e) => e.initGA4()),
        se(Qe, (e) => e.initBookingFunnelObserver()),
        se(Qe, (e) => e.initDeferredSectionPrefetch()),
        Zt.then(({ loadDeferredContent: e }) => e())
            .catch(() => !1)
            .then(() => {
                (wn(), se(Kt, (e) => e.initCookieBanner()));
                const e = re(() => {
                        (!(function () {
                            const e = () => {
                                    ce(he, (e) =>
                                        e.ensureEnglishTranslations()
                                    ).catch(() => {});
                                },
                                t = document.querySelector(
                                    '.lang-btn[data-lang="en"]'
                                );
                            t &&
                                (t.addEventListener('mouseenter', e, {
                                    once: !0,
                                    passive: !0,
                                }),
                                t.addEventListener('touchstart', e, {
                                    once: !0,
                                    passive: !0,
                                }),
                                t.addEventListener('focus', e, { once: !0 }));
                        })(),
                            Ie(),
                            st(),
                            wt(),
                            Jt()
                                .then((e) => {
                                    (e.initChatUiEngineWarmup(),
                                        e.initChatWidgetEngineWarmup());
                                })
                                .catch(() => {}));
                    }),
                    t = re(() => {
                        ((Vt ||
                            (Vt = import('./js/chunks/engagement-CKnEtqEi.js')),
                        Vt)
                            .then((e) => {
                                (e.initReviewsEngineWarmup(),
                                    e.initEngagementFormsEngineWarmup());
                            })
                            .catch(() => {}),
                            (Gt ||
                                (Gt =
                                    import('./js/chunks/gallery-C1JzKKay.js')),
                            Gt)
                                .then((e) => e.initGalleryInteractionsWarmup())
                                .catch(() => {}),
                            Jt()
                                .then((e) => {
                                    (e.initChatEngineWarmup(),
                                        e.initChatBookingEngineWarmup());
                                })
                                .catch(() => {}),
                            (Ht || (Ht = import('./js/chunks/ui-CHKgNf3E.js')),
                            Ht)
                                .then((e) => {
                                    (e.initUiEffectsWarmup(),
                                        e.initModalUxEngineWarmup());
                                })
                                .catch(() => {}),
                            (Qt ||
                                (Qt =
                                    import('./js/chunks/reschedule-dVDIe1ab.js')),
                            Qt)
                                .then((e) => e.initRescheduleEngineWarmup())
                                .catch(() => {}),
                            (Yt ||
                                (Yt =
                                    import('./js/chunks/success-modal-9T9R_btl.js')),
                            Yt)
                                .then((e) => e.initSuccessModalEngineWarmup())
                                .catch(() => {}));
                    }),
                    n = re(() => {
                        (e(), t(), wt());
                    });
                (window.addEventListener('pointerdown', n, {
                    once: !0,
                    passive: !0,
                }),
                    window.addEventListener('keydown', n, { once: !0 }),
                    ne(e, {
                        idleTimeout: 1400,
                        fallbackDelay: 500,
                        skipOnConstrained: !1,
                        constrainedDelay: 900,
                    }));
                const o = document.getElementById('chatInput');
                (o &&
                    o.addEventListener('keypress', async (e) => {
                        (await Jt()).handleChatKeypress(e);
                    }),
                    (function () {
                        function e(e) {
                            e &&
                                e.addEventListener('click', function () {
                                    te({
                                        cacheKey: 'booking-utils-calendar',
                                        src: Q('/js/engines/booking-utils.js'),
                                        scriptDataAttribute:
                                            'data-booking-utils',
                                        resolveModule: () =>
                                            window.PielBookingCalendarEngine ||
                                            (window.Piel &&
                                                window.Piel
                                                    .BookingCalendarEngine),
                                    })
                                        .then(function (e) {
                                            e &&
                                                'function' ==
                                                    typeof e.initCalendar &&
                                                e.initCalendar();
                                        })
                                        .catch(function () {});
                                });
                        }
                        (e(document.getElementById('booking-btn')),
                            document
                                .querySelectorAll(
                                    'a[href="#v5-booking"], a[href="#citas"]'
                                )
                                .forEach(function (t) {
                                    'booking-btn' !== t.id && e(t);
                                }));
                    })());
            }),
        window.addEventListener('pagehide', () => {
            !(function (e = 'unknown') {
                se(Qe, (t) => t.maybeTrackCheckoutAbandon(e));
            })('page_hide');
        }));
    const e = document.querySelector('.nav');
    (document.addEventListener('click', function (t) {
        const n = t.target instanceof Element ? t.target : null;
        if (!n) return;
        const o = n.closest('a[href^="#"]');
        if (!o) return;
        const r = o.getAttribute('href');
        if (!r || '#' === r) return;
        const i = document.querySelector(r);
        if (!i) return;
        t.preventDefault();
        const a = e ? e.offsetHeight : 0,
            c = i.offsetTop - a - 20;
        (('#v5-booking' !== r && '#citas' !== r) || Ze(`cta_click_${un()}`),
            window.scrollTo({ top: c, behavior: sn() }));
    }),
        document.addEventListener('click', function (e) {
            const t = e.target instanceof Element ? e.target : null;
            if (!t) return;
            const n = t.closest(
                'a[href*="wa.me"], a[href*="api.whatsapp.com"]'
            );
            if (!n) return;
            const o = (function (e) {
                if (!(e && e instanceof Element)) return 'unknown';
                if (e.closest('#chatbotContainer, #chatbotWidget'))
                    return 'chatbot';
                const t = e.closest(
                    'section[id], footer[id], footer, .quick-contact-dock'
                );
                return t
                    ? t.getAttribute('id') ||
                          (t.classList.contains('quick-contact-dock')
                              ? 'quick_dock'
                              : t.tagName &&
                                  'footer' === t.tagName.toLowerCase()
                                ? 'footer'
                                : 'unknown')
                    : 'unknown';
            })(n);
            (Ye('whatsapp_click', { source: o }),
                (n.closest('#chatbotContainer') ||
                    n.closest('#chatbotWidget')) &&
                    Ye('chat_handoff_whatsapp', { source: o }));
        }));
}),
    (function () {
        const e = document.querySelectorAll('.gallery-img[data-src]');
        if (!e.length) return;
        const t = new IntersectionObserver(
            (e) => {
                e.forEach((e) => {
                    if (e.isIntersecting) {
                        const n = e.target,
                            o = n.dataset.src,
                            r = n.dataset.srcset;
                        (r && (n.srcset = r),
                            (n.src = o),
                            n.classList.add('loaded'),
                            t.unobserve(n));
                    }
                });
            },
            { rootMargin: '200px' }
        );
        e.forEach((e) => {
            t.observe(e);
        });
    })(),
    window.addEventListener('online', () => {
        (st(), Ie());
    }),
    (window.subscribeToPushNotifications = async function () {
        if ('serviceWorker' in navigator && 'PushManager' in window)
            try {
                const e = await navigator.serviceWorker.ready,
                    t = 'B...';
                await e.pushManager.subscribe({
                    userVisibleOnly: !0,
                    applicationServerKey: t,
                });
            } catch (e) {}
    }));
export {
    Me as A,
    Oe as B,
    z as C,
    $ as D,
    dt as E,
    lt as F,
    ut as G,
    De as H,
    Be as I,
    ae as J,
    k as K,
    v as L,
    Ne as M,
    Re as N,
    G as O,
    X as P,
    Le as Q,
    vt as R,
    Te as S,
    Y as a,
    oe as b,
    ie as c,
    ne as d,
    L as e,
    I as f,
    R as g,
    Q as h,
    F as i,
    K as j,
    x as k,
    te as l,
    N as m,
    O as n,
    D as o,
    w as p,
    B as q,
    se as r,
    U as s,
    T as t,
    V as u,
    Ye as v,
    ce as w,
    b as x,
    y,
    bt as z,
};
