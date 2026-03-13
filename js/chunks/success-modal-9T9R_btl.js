import {
    r as e,
    c as o,
    b as t,
    d as s,
    l as n,
    a as i,
    h as a,
    O as c,
    j as r,
    p as d,
    y as l,
} from '../../script.js';
const u = a('/js/engines/ui-bundle.js');
function m() {
    return n({
        cacheKey: 'success-modal-engine',
        src: u,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.SuccessModalEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: l,
                getCurrentAppointment: d,
                getClinicAddress: () => r,
                escapeHtml: c,
            }),
        missingApiError: 'success-modal-engine loaded without API',
        loadError: 'No se pudo cargar success-modal-engine.js',
        logLabel: 'Success modal engine',
    });
}
function p() {
    const e = o(() => m());
    (t('#appointmentForm button[type="submit"]', 'pointerdown', e),
        t('#appointmentForm button[type="submit"]', 'focus', e, !1),
        t('.payment-method', 'pointerdown', e),
        s(e, { idleTimeout: 2800, fallbackDelay: 1600 }));
}
function g(o = !1) {
    const t = d();
    if (t)
        try {
            localStorage.setItem(
                'last_confirmed_appointment',
                JSON.stringify(t)
            );
        } catch (e) {}
    e(
        m,
        (e) => e.showSuccessModal(o),
        () => {
            i('No se pudo abrir la confirmacion de cita.', 'error');
        }
    );
}
function f() {
    const o = document.getElementById('successModal');
    (o && o.classList.remove('active'),
        (document.body.style.overflow = ''),
        e(m, (e) => e.closeSuccessModal()));
}
export {
    f as closeSuccessModal,
    p as initSuccessModalEngineWarmup,
    m as loadSuccessModalEngine,
    g as showSuccessModal,
};
