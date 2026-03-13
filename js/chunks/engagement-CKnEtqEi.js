import {
    r as e,
    c as n,
    b as o,
    J as t,
    d as a,
    l as s,
    w as r,
    h as i,
    K as c,
    L as d,
    y as l,
    a as u,
    M as g,
    N as m,
    O as w,
    P as v,
    Q as f,
} from '../../script.js';
const b = i('/js/engines/engagement-bundle.js'),
    p = i('/js/engines/engagement-forms-bundle.js');
function y() {
    return s({
        cacheKey: 'engagement-reviews-bundle',
        src: b,
        scriptDataAttribute: 'data-engagement-bundle',
        resolveModule: () => window.Piel && window.Piel.ReviewsEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                apiRequest: f,
                storageGetJSON: v,
                escapeHtml: w,
                getCurrentLang: l,
            }),
        missingApiError: 'reviews-engine loaded without API',
        loadError: 'No se pudo cargar reviews-engine.js',
        logLabel: 'Reviews engine',
    });
}
function R() {
    const e = n(() => y(), { markWarmOnSuccess: !0 }),
        s = document.getElementById('resenas');
    (t(s, e, { threshold: 0.05, rootMargin: '300px 0px', onNoObserver: e }),
        o('#resenas', 'mouseenter', e),
        o('#resenas', 'touchstart', e),
        o('#resenas [data-action="open-review-modal"]', 'focus', e, !1),
        a(e, { idleTimeout: 2200, fallbackDelay: 1300 }));
}
function h(n) {
    e(y, (e) => e.renderPublicReviews(n));
}
function E(e = {}) {
    return r(y, (n) => n.loadPublicReviews(e));
}
function M() {
    return s({
        cacheKey: 'engagement-forms-engine',
        src: p,
        scriptDataAttribute: 'data-engagement-forms-bundle',
        resolveModule: () => window.Piel && window.Piel.EngagementFormsEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                createCallbackRecord: m,
                createReviewRecord: g,
                renderPublicReviews: h,
                showToast: u,
                getCurrentLang: l,
                getReviewsCache: d,
                setReviewsCache: c,
            }),
        missingApiError: 'engagement-forms-engine loaded without API',
        loadError: 'No se pudo cargar engagement-forms-engine.js',
        logLabel: 'Engagement forms engine',
    });
}
function P() {
    const e = n(() => M());
    (o('#callbackForm', 'focusin', e, !1),
        o('#callbackForm', 'pointerdown', e),
        o('#resenas [data-action="open-review-modal"]', 'mouseenter', e),
        o('#resenas [data-action="open-review-modal"]', 'touchstart', e),
        document.getElementById('callbackForm') && setTimeout(e, 120));
    const s = document.getElementById('resenas');
    (t(s, e, { threshold: 0.05, rootMargin: '280px 0px', onNoObserver: e }),
        a(e, { idleTimeout: 2600, fallbackDelay: 1500 }));
}
function j() {
    e(
        M,
        (e) => e.openReviewModal(),
        () => {
            const e = document.getElementById('reviewModal');
            e &&
                (e.classList.add('active'),
                (document.body.style.overflow = 'hidden'));
        }
    );
}
function k() {
    const n = document.getElementById('reviewModal');
    (n && n.classList.remove('active'),
        (document.body.style.overflow = ''),
        e(M, (e) => e.closeReviewModal()));
}
export {
    k as closeReviewModal,
    P as initEngagementFormsEngineWarmup,
    R as initReviewsEngineWarmup,
    M as loadEngagementFormsEngine,
    E as loadPublicReviews,
    y as loadReviewsEngine,
    j as openReviewModal,
    h as renderPublicReviews,
};
