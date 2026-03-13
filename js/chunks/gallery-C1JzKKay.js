import { c as e, J as t, d as o, l as r, h as n } from '../../script.js';
const a = n(
    '/js/engines/gallery-interactions.js?v=figo-gallery-20260218-phase4'
);
function i() {
    return r({
        cacheKey: 'gallery-interactions',
        src: a,
        scriptDataAttribute: 'data-gallery-interactions',
        resolveModule: () => window.Piel && window.Piel.GalleryInteractions,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) => e.init(),
        missingApiError: 'gallery-interactions loaded without API',
        loadError: 'No se pudo cargar gallery-interactions.js',
        logLabel: 'Gallery interactions',
    });
}
function s() {
    const r = e(() => i()),
        n = document.getElementById('galeria');
    t(n, r, { threshold: 0.05, rootMargin: '320px 0px', onNoObserver: r });
    const a = document.querySelector('.filter-btn');
    (a &&
        (a.addEventListener('mouseenter', r, { once: !0, passive: !0 }),
        a.addEventListener('touchstart', r, { once: !0, passive: !0 })),
        (n || a) && o(r, { idleTimeout: 2500, fallbackDelay: 1500 }));
}
export { s as initGalleryInteractionsWarmup, i as loadGalleryInteractions };
