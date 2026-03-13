import {
    r as e,
    a as o,
    y as s,
    l as a,
    h as t,
    O as i,
    S as r,
    H as n,
    I as l,
    Q as u,
} from '../../script.js';
const c = t(
    '/js/engines/booking-utils.js?v=figo-booking-utils-20260220-unified'
);
function d() {
    return a({
        cacheKey: 'booking-utils',
        src: c,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                apiRequest: u,
                loadAvailabilityData: l,
                getBookedSlots: n,
                invalidateBookedSlotsCache: r,
                showToast: o,
                escapeHtml: i,
                getCurrentLang: s,
            }),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar booking-utils.js (reschedule)',
        logLabel: 'Reschedule engine',
    });
}
function g() {
    e(
        d,
        (e) => e.checkRescheduleParam(),
        () => {
            o(
                'es' === s()
                    ? 'No se pudo cargar la reprogramacion.'
                    : 'Unable to load reschedule flow.',
                'error'
            );
        }
    );
}
function h() {
    e(
        d,
        (e) => e.closeRescheduleModal(),
        () => {
            const e = document.getElementById('rescheduleModal');
            e && e.classList.remove('active');
        }
    );
}
function m() {
    e(
        d,
        (e) => e.submitReschedule(),
        () => {
            o(
                'es' === s()
                    ? 'No se pudo reprogramar en este momento.'
                    : 'Unable to reschedule right now.',
                'error'
            );
        }
    );
}
export {
    h as closeRescheduleModal,
    g as initRescheduleEngineWarmup,
    d as loadRescheduleEngine,
    m as submitReschedule,
};
