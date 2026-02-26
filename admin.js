let e = [],
    t = [],
    n = [],
    a = {},
    o = {},
    i = null,
    r = null,
    s = '';
function c(t) {
    e = t || [];
}
function l(e) {
    t = e || [];
}
function d(e) {
    n = e || [];
}
function u(e) {
    a = e || {};
}
function m(e) {
    o = e || {};
}
function p(e) {
    i = e;
}
function f(e) {
    r = e || null;
}
function g(e) {
    s = e;
}
async function h(e, t = {}) {
    const n = {
        method: t.method || 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    };
    (s && t.method && 'GET' !== t.method && (n.headers['X-CSRF-Token'] = s),
        void 0 !== t.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(t.body))));
    const a = await fetch(e, n),
        o = await a.text();
    let i;
    try {
        i = o ? JSON.parse(o) : {};
    } catch (e) {
        throw new Error('Respuesta no valida del servidor');
    }
    if (!a.ok || !1 === i.ok) throw new Error(i.error || `HTTP ${a.status}`);
    return i;
}
async function b(e, t = {}) {
    return h(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function y(e, t = {}) {
    return h(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
function v(e) {
    return null == e
        ? ''
        : String(e)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
function S(e, t = 'info', n = '') {
    const a = document.getElementById('toastContainer');
    if (!a) return;
    const o = document.createElement('div');
    o.className = `toast ${t}`;
    const i = 'error' === t;
    (o.setAttribute('role', i ? 'alert' : 'status'),
        o.setAttribute('aria-live', i ? 'assertive' : 'polite'),
        o.setAttribute('aria-atomic', 'true'));
    const r = {
        success: n || 'Éxito',
        error: n || 'Error',
        warning: n || 'Advertencia',
        info: n || 'Información',
    };
    ((o.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${v(r[t])}</div>\n            <div class="toast-message">${v(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificación">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        a.appendChild(o),
        setTimeout(() => {
            o.parentElement &&
                ((o.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => o.remove(), 300));
        }, 5e3));
}
function w(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function k(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function E(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0 ? 0 : t;
}
function B(e) {
    return (
        {
            consulta: 'Consulta Dermatológica',
            telefono: 'Consulta Telefónica',
            video: 'Video Consulta',
            laser: 'Tratamiento Láser',
            rejuvenecimiento: 'Rejuvenecimiento',
            acne: 'Tratamiento de Acné',
            cancer: 'Detección de Cáncer de Piel',
        }[e] || e
    );
}
function C(e) {
    return (
        {
            rosero: 'Dr. Rosero',
            narvaez: 'Dra. Narváez',
            indiferente: 'Cualquiera disponible',
        }[e] || e
    );
}
function L(e) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            cancelled: 'Cancelada',
            completed: 'Completada',
            no_show: 'No asistió',
            noshow: 'No asistió',
        }[e] || e
    );
}
function $(e) {
    return (
        {
            card: 'Tarjeta',
            transfer: 'Transferencia',
            cash: 'Efectivo',
            unpaid: 'Sin definir',
        }[
            String(e || '')
                .toLowerCase()
                .trim()
        ] ||
        e ||
        'Sin definir'
    );
}
function I(e) {
    return (
        {
            paid: 'Pagado',
            pending_cash: 'Pago en consultorio',
            pending_transfer: 'Transferencia pendiente',
            pending_transfer_review: 'Comprobante por validar',
            pending_gateway: 'Pago en proceso',
            pending: 'Pendiente',
            failed: 'Pago fallido',
        }[
            String(e || '')
                .toLowerCase()
                .trim()
        ] ||
        e ||
        'Pendiente'
    );
}
function D(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function T(e) {
    const t = String(e || '')
        .toLowerCase()
        .trim();
    return 'pending' === t
        ? 'pendiente'
        : 'contacted' === t || 'contactado' === t
          ? 'contactado'
          : 'pendiente';
}
function A(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function M(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
async function N() {
    try {
        const [e, t] = await Promise.all([
                b('data'),
                b('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (c(a), M('appointments', a));
        const o = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: T(e.status) }))
            : [];
        (l(o), M('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (d(i), M('reviews', i));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (u(r), M('availability', r));
        const s =
            n.availabilityMeta && 'object' == typeof n.availabilityMeta
                ? n.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        if (
            (m(s),
            M('availability-meta', s),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            p(n.funnelMetrics);
        else {
            const e = await b('funnel-metrics').catch(() => null);
            e && e.data && 'object' == typeof e.data
                ? p(e.data)
                : p({
                      summary: {
                          viewBooking: 0,
                          startCheckout: 0,
                          bookingConfirmed: 0,
                          checkoutAbandon: 0,
                          startRatePct: 0,
                          confirmedRatePct: 0,
                          abandonRatePct: 0,
                      },
                      checkoutAbandonByStep: [],
                      checkoutAbandonByReason: [],
                      checkoutEntryBreakdown: [],
                      eventSourceBreakdown: [],
                      paymentMethodBreakdown: [],
                      bookingStepBreakdown: [],
                      errorCodeBreakdown: [],
                      retention: {
                          appointmentsTotal: 0,
                          appointmentsNonCancelled: 0,
                          statusCounts: {
                              confirmed: 0,
                              completed: 0,
                              noShow: 0,
                              cancelled: 0,
                          },
                          noShowRatePct: 0,
                          completionRatePct: 0,
                          uniquePatients: 0,
                          recurrentPatients: 0,
                          recurrenceRatePct: 0,
                      },
                  });
        }
        t && t.ok ? (f(t), M('health-status', t)) : f(null);
    } catch (e) {
        (c(A('appointments', [])),
            l(A('callbacks', []).map((e) => ({ ...e, status: T(e.status) }))),
            d(A('reviews', [])),
            u(A('availability', {})),
            m(A('availability-meta', {})),
            p({
                summary: {
                    viewBooking: 0,
                    startCheckout: 0,
                    bookingConfirmed: 0,
                    checkoutAbandon: 0,
                    startRatePct: 0,
                    confirmedRatePct: 0,
                    abandonRatePct: 0,
                },
                checkoutAbandonByStep: [],
                checkoutAbandonByReason: [],
                checkoutEntryBreakdown: [],
                eventSourceBreakdown: [],
                paymentMethodBreakdown: [],
                bookingStepBreakdown: [],
                errorCodeBreakdown: [],
                retention: {
                    appointmentsTotal: 0,
                    appointmentsNonCancelled: 0,
                    statusCounts: {
                        confirmed: 0,
                        completed: 0,
                        noShow: 0,
                        cancelled: 0,
                    },
                    noShowRatePct: 0,
                    completionRatePct: 0,
                    uniquePatients: 0,
                    recurrentPatients: 0,
                    recurrenceRatePct: 0,
                },
            }),
            f(A('health-status', null)),
            S(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function x(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            service_selected: 'Servicio seleccionado',
            doctor_selected: 'Doctor seleccionado',
            date_selected: 'Fecha seleccionada',
            time_selected: 'Hora seleccionada',
            name_added: 'Nombre ingresado',
            email_added: 'Email ingresado',
            phone_added: 'Telefono ingresado',
            contact_info_completed: 'Datos de contacto completados',
            clinical_context_added: 'Contexto clinico agregado',
            privacy_consent_checked: 'Consentimiento de privacidad',
            form_submitted: 'Formulario enviado',
            chat_booking_started: 'Reserva iniciada en chat',
            payment_modal_open: 'Modal de pago abierto',
            payment_modal_closed: 'Modal de pago cerrado',
            payment_processing: 'Pago en proceso',
            payment_error: 'Error de pago',
            patient_data: 'Datos del paciente',
            reason: 'Motivo de consulta',
            photos: 'Fotos clinicas',
            slot: 'Fecha y hora',
            payment: 'Metodo de pago',
            confirmation: 'Confirmacion',
            payment_method_selected: 'Metodo de pago',
            unknown: 'Paso no identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function _(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            booking_form: 'Formulario web',
            chatbot: 'Chatbot',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function H(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            card: 'Tarjeta',
            transfer: 'Transferencia',
            cash: 'Efectivo',
            unpaid: 'Sin definir',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function P(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            web: 'Web',
            booking_form: 'Formulario web',
            chatbot: 'Chatbot',
            admin: 'Panel admin',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function R(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            user_closed: 'Usuario cerro el flujo',
            chat_cancel: 'Usuario cancelo en chat',
            timeout: 'Tiempo de espera agotado',
            payment_failed: 'Pago fallido',
            calendar_unreachable: 'Agenda Google no disponible',
            slot_conflict: 'Horario ya ocupado',
            slot_unavailable: 'Horario ya ocupado',
            availability_error: 'Error consultando horarios',
            appointment_create_failed: 'Error registrando cita',
            validation_error: 'Error de validacion',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function q(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            calendar_unreachable: 'Agenda Google no disponible',
            calendar_auth_failed: 'Token Google invalido',
            calendar_token_rejected: 'Token Google rechazado',
            slot_conflict: 'Horario ocupado',
            slot_unavailable: 'Horario ocupado',
            appointment_create_failed: 'Error registrando cita',
            availability_error: 'Error consultando horarios',
            payment_failed: 'Fallo de pago',
            validation_error: 'Error de validacion',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    if ('' === t) return n.unknown;
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function F(e, t, n, a) {
    const o = document.getElementById(e);
    if (!o) return;
    const i = (function (e) {
        return Array.isArray(e)
            ? e
                  .map((e) => ({
                      label: String(e && e.label ? e.label : 'unknown'),
                      count: E(e && e.count ? e.count : 0),
                  }))
                  .filter((e) => e.count > 0)
                  .sort((e, t) => t.count - e.count)
            : [];
    })(t).slice(0, 6);
    if (0 === i.length)
        return void (o.innerHTML = `<p class="empty-message">${v(a)}</p>`);
    const r = i.reduce((e, t) => e + t.count, 0);
    o.innerHTML = i
        .map((e) => {
            const t = r > 0 ? w((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${v(n(e.label))}</span>\n                <span class="funnel-row-count">${v(k(e.count))} (${v(t)})</span>\n            </div>\n        `;
        })
        .join('');
}
function j(e, t, n = 'muted') {
    e &&
        ((e.className = 'toolbar-chip'),
        'accent' === n
            ? e.classList.add('is-accent')
            : 'warning' === n && e.classList.add('is-warning'),
        (e.textContent = t));
}
function O(e) {
    return `\n        <div class="operations-action-item">\n            <span class="operations-action-icon">\n                <i class="fas ${v(e.icon)}" aria-hidden="true"></i>\n            </span>\n            <div class="operations-action-copy">\n                <span class="operations-action-title">${v(e.title)}</span>\n                <span class="operations-action-meta">${v(e.meta)}</span>\n            </div>\n            <button type="button" class="btn btn-secondary btn-sm" data-action="${v(e.action)}">\n                ${v(e.cta)}\n            </button>\n        </div>\n    `;
}
function U() {
    document.getElementById('totalAppointments').textContent = e.length;
    const a = new Date().toISOString().split('T')[0],
        o = [];
    let s = 0,
        c = 0,
        l = 0;
    for (const t of e) {
        (t.date === a && 'cancelled' !== t.status && o.push(t),
            'pending_transfer_review' === t.paymentStatus && s++);
        const e = t.status || 'confirmed';
        ('confirmed' === e && c++, 'no_show' === e && l++);
    }
    document.getElementById('todayAppointments').textContent = o.length;
    const d = document.getElementById('totalNoShows');
    d && (d.textContent = k(l));
    const u = [];
    for (const e of t) 'pendiente' === T(e.status) && u.push(e);
    document.getElementById('pendingCallbacks').textContent = u.length;
    let m = 0;
    (n.length > 0 &&
        (m = (
            n.reduce((e, t) => e + (Number(t.rating) || 0), 0) / n.length
        ).toFixed(1)),
        (document.getElementById('avgRating').textContent = m),
        (document.getElementById('appointmentsBadge').textContent =
            s > 0 ? `${c} (${s} por validar)` : c),
        (document.getElementById('callbacksBadge').textContent = u.length),
        (document.getElementById('reviewsBadge').textContent = n.length));
    const p = document.getElementById('todayAppointmentsList');
    0 === o.length
        ? (p.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (p.innerHTML = o
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${v(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${v(e.name)}</span>\n                    <span class="service">${v(B(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join(''));
    const f = document.getElementById('recentCallbacksList'),
        g = t.slice(-5).reverse();
    (0 === g.length
        ? (f.innerHTML =
              '<p class="empty-message">No hay callbacks pendientes</p>')
        : (f.innerHTML = g
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${v(e.telefono)}</span>\n                    <span class="service">${v(D(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join('')),
        (function ({
            pendingTransfers: e = 0,
            pendingCallbacks: t = 0,
            todayAppointmentsCount: n = 0,
            confirmedCount: a = 0,
            totalNoShows: o = 0,
        }) {
            const i = document.getElementById('operationPendingReviewCount'),
                r = document.getElementById('operationPendingCallbacksCount'),
                s = document.getElementById('operationTodayLoadCount'),
                c = document.getElementById('operationQueueHealth'),
                l = document.getElementById('operationRefreshSignal'),
                d = document.getElementById('operationActionList');
            if (!(i && r && s && c && l && d)) return;
            ((i.textContent = k(e)),
                (r.textContent = k(t)),
                (s.textContent = k(n)));
            const u = 3 * e + 2 * t + Math.max(0, n - 6) + o;
            (u >= 9
                ? j(c, 'Cola: prioridad alta', 'warning')
                : u >= 4
                  ? j(c, 'Cola: atención recomendada', 'accent')
                  : j(c, 'Cola: estable', 'muted'),
                a <= 0
                    ? j(l, 'Agenda: sin citas confirmadas', 'warning')
                    : n >= 6
                      ? j(l, 'Agenda: demanda alta hoy', 'accent')
                      : j(l, 'Agenda: operación normal', 'muted'));
            const m = [];
            (e > 0 &&
                m.push({
                    icon: 'fa-money-check-dollar',
                    title: 'Transferencias pendientes',
                    meta: `${k(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${k(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${k(n)} cita(s) activas para seguimiento inmediato`,
                        action: 'context-open-appointments-today',
                        cta: 'Abrir',
                    }),
                0 === m.length &&
                    m.push({
                        icon: 'fa-rotate-right',
                        title: 'Sin alertas operativas',
                        meta: 'No hay pendientes críticos en este momento',
                        action: 'refresh-admin-data',
                        cta: 'Actualizar',
                    }),
                (d.innerHTML = m.map(O).join('')));
        })({
            pendingTransfers: s,
            pendingCallbacks: u.length,
            todayAppointmentsCount: o.length,
            confirmedCount: c,
            totalNoShows: l,
        }),
        (function () {
            const e =
                    i && 'object' == typeof i
                        ? i
                        : {
                              summary: {
                                  viewBooking: 0,
                                  startCheckout: 0,
                                  bookingConfirmed: 0,
                                  checkoutAbandon: 0,
                                  startRatePct: 0,
                                  confirmedRatePct: 0,
                                  abandonRatePct: 0,
                              },
                              checkoutAbandonByStep: [],
                              checkoutAbandonByReason: [],
                              checkoutEntryBreakdown: [],
                              eventSourceBreakdown: [],
                              paymentMethodBreakdown: [],
                              bookingStepBreakdown: [],
                              errorCodeBreakdown: [],
                              retention: {
                                  appointmentsTotal: 0,
                                  appointmentsNonCancelled: 0,
                                  statusCounts: {
                                      confirmed: 0,
                                      completed: 0,
                                      noShow: 0,
                                      cancelled: 0,
                                  },
                                  noShowRatePct: 0,
                                  completionRatePct: 0,
                                  uniquePatients: 0,
                                  recurrentPatients: 0,
                                  recurrenceRatePct: 0,
                              },
                          },
                t = e.summary && 'object' == typeof e.summary ? e.summary : {},
                n = E(t.viewBooking),
                a = E(t.startCheckout),
                o = E(t.bookingConfirmed),
                s = E(t.checkoutAbandon);
            E(t.startRatePct);
            const c = E(t.confirmedRatePct) || (a > 0 ? (o / a) * 100 : 0),
                l = E(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                d = document.getElementById('funnelViewBooking');
            d && (d.textContent = k(n));
            const u = document.getElementById('funnelStartCheckout');
            u && (u.textContent = k(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = k(o));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = w(l));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = w(c));
            const g = E(e.events && e.events.booking_error),
                h = E(e.events && e.events.checkout_error),
                b = a > 0 ? ((g + h) / a) * 100 : 0,
                y = document.getElementById('bookingErrorRate');
            y && (y.textContent = w(b));
            const v = document.getElementById('calendarHealthStatus');
            if (v) {
                const e = r && 'object' == typeof r ? r : null,
                    t =
                        e && e.calendarSource
                            ? String(e.calendarSource)
                            : 'desconocido',
                    n =
                        e && e.calendarMode
                            ? String(e.calendarMode)
                            : 'desconocido',
                    a = !!e && Boolean(e.calendarReachable),
                    o = !!e && Boolean(e.calendarTokenHealthy);
                let i = `Agenda ${t}: ${n}`;
                ('google' === t && (i += a && o ? ' (OK)' : ' (revisar)'),
                    (v.textContent = i));
            }
            document.getElementById('funnelAbandonList') &&
                (F(
                    'funnelAbandonList',
                    e.checkoutAbandonByStep,
                    x,
                    'Sin datos de abandono'
                ),
                F(
                    'funnelEntryList',
                    e.checkoutEntryBreakdown,
                    _,
                    'Sin datos de entrada'
                ),
                F(
                    'funnelPaymentMethodList',
                    e.paymentMethodBreakdown,
                    H,
                    'Sin datos de pago'
                ),
                F(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    P,
                    'Sin datos de origen'
                ),
                F(
                    'funnelAbandonReasonList',
                    e.checkoutAbandonByReason,
                    R,
                    'Sin datos de motivo'
                ),
                F(
                    'funnelStepList',
                    e.bookingStepBreakdown,
                    x,
                    'Sin datos de pasos'
                ),
                F(
                    'funnelErrorCodeList',
                    e.errorCodeBreakdown,
                    q,
                    'Sin datos de error'
                ));
        })());
}
const z = 'all',
    V = 'recent_desc',
    G = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    K = new Set(['recent_desc', 'waiting_desc']),
    W = { filter: z, search: '', sort: V },
    J = {
        all: 'Todos',
        pending: 'Pendientes',
        contacted: 'Contactados',
        today: 'Hoy',
        sla_urgent: 'Urgentes SLA',
    },
    Y = { recent_desc: 'Más recientes', waiting_desc: 'Mayor espera (SLA)' };
let Q = [];
const Z = new Set();
let X = !1,
    ee = !1;
function te() {
    return {
        filterSelect: document.getElementById('callbackFilter'),
        sortSelect: document.getElementById('callbackSort'),
        searchInput: document.getElementById('searchCallbacks'),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="callback-quick-filter"][data-filter-value]'
            )
        ),
        toolbarMeta: document.getElementById('callbacksToolbarMeta'),
        toolbarState: document.getElementById('callbacksToolbarState'),
        clearFiltersBtn: document.getElementById('clearCallbacksFiltersBtn'),
        selectVisibleBtn: document.getElementById(
            'callbacksBulkSelectVisibleBtn'
        ),
        clearSelectionBtn: document.getElementById('callbacksBulkClearBtn'),
        markSelectedBtn: document.getElementById('callbacksBulkMarkBtn'),
        selectedCountEl: document.getElementById('callbacksSelectedCount'),
        selectionChipEl: document.getElementById('callbacksSelectionChip'),
    };
}
function ne(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return G.has(t) ? t : z;
}
function ae(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return K.has(t) ? t : V;
}
function oe(e) {
    const t = Number(e?.id || 0);
    return t > 0
        ? `id:${t}`
        : `fallback:${String(e?.fecha || '').trim()}|${String(e?.telefono || '').trim()}|${String(e?.preferencia || '').trim()}`;
}
function ie(e) {
    return 'pendiente' === T(e?.status);
}
function re() {
    return (
        !!X ||
        ((X = (function () {
            const e = document.getElementById('callbacks');
            if (!e) return !1;
            const t = e.querySelector('.section-toolbar-callbacks');
            if (!t) return !1;
            const n = document.getElementById('callbackFilter');
            if (
                n instanceof HTMLSelectElement &&
                !n.querySelector('option[value="sla_urgent"]')
            ) {
                const e = document.createElement('option');
                ((e.value = 'sla_urgent'),
                    (e.textContent = 'Urgentes SLA'),
                    n.appendChild(e));
            }
            let a = document.getElementById('callbackSort');
            if (a instanceof HTMLSelectElement)
                0 === a.options.length &&
                    Object.entries(Y).forEach(([e, t]) => {
                        const n = document.createElement('option');
                        ((n.value = e), (n.textContent = t), a.appendChild(n));
                    });
            else {
                const e = document.createElement('div');
                e.className = 'filter-group callbacks-sort-group';
                const n = document.createElement('label');
                ((n.className = 'sr-only'),
                    (n.htmlFor = 'callbackSort'),
                    (n.textContent = 'Orden de callbacks'),
                    (a = document.createElement('select')),
                    (a.id = 'callbackSort'),
                    Object.entries(Y).forEach(([e, t]) => {
                        const n = document.createElement('option');
                        ((n.value = e), (n.textContent = t), a.appendChild(n));
                    }),
                    (a.value = W.sort),
                    e.appendChild(n),
                    e.appendChild(a));
                const o = t.querySelector('.callbacks-quick-filters');
                o ? t.insertBefore(e, o) : t.appendChild(e);
            }
            const o = t.querySelector('.callbacks-quick-filters');
            if (o && !o.querySelector('[data-filter-value="sla_urgent"]')) {
                const e = document.createElement('button');
                ((e.type = 'button'),
                    (e.className = 'callback-quick-filter-btn'),
                    (e.dataset.action = 'callback-quick-filter'),
                    (e.dataset.filterValue = 'sla_urgent'),
                    e.setAttribute('aria-pressed', 'false'),
                    (e.title = 'Pendientes con espera mayor a 2 horas'),
                    (e.textContent = 'Urgentes SLA'),
                    o.appendChild(e));
            }
            const i = e.querySelector('.callbacks-ops-actions');
            if (i) {
                if (!document.getElementById('callbacksBulkSelectVisibleBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkSelectVisibleBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-list-check"></i> Seleccionar visibles'),
                        i.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkClearBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkClearBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-eraser"></i> Limpiar selección'),
                        i.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkMarkBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-primary btn-sm'),
                        (e.id = 'callbacksBulkMarkBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-check-double"></i> Marcar seleccionados'),
                        i.appendChild(e));
                }
            }
            return !0;
        })()),
        X)
    );
}
function se(e) {
    const t = te(),
        n = e.filter((e) => ie(e)).length,
        a = e.filter((e) => ie(e) && Z.has(oe(e))).length,
        o = a > 0;
    (t.selectedCountEl && (t.selectedCountEl.textContent = String(a)),
        t.selectionChipEl &&
            t.selectionChipEl.classList.toggle('is-hidden', !o),
        t.selectVisibleBtn instanceof HTMLButtonElement &&
            (t.selectVisibleBtn.disabled = 0 === n),
        t.clearSelectionBtn instanceof HTMLButtonElement &&
            (t.clearSelectionBtn.disabled = !o),
        t.markSelectedBtn instanceof HTMLButtonElement &&
            (t.markSelectedBtn.disabled = !o));
}
function ce(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function le(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t;
}
function de(e) {
    const t = le(e);
    if (!t) return 0;
    const n = Date.now() - t.getTime();
    return Number.isFinite(n) ? Math.max(0, Math.round(n / 6e4)) : 0;
}
function ue(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 'recién';
    if (t < 60) return `${t} min`;
    const n = Math.floor(t / 60),
        a = t % 60;
    return 0 === a ? `${n} h` : `${n} h ${a} min`;
}
function me(e, t = V) {
    const n = [...e];
    return 'waiting_desc' === ae(t)
        ? n.sort((e, t) => {
              const n = ie(e),
                  a = ie(t);
              if (n !== a) return n ? -1 : 1;
              const o = n ? de(e.fecha) : 0,
                  i = a ? de(t.fecha) : 0;
              if (i !== o) return i - o;
              const r = le(e.fecha),
                  s = le(t.fecha);
              return (r ? r.getTime() : 0) - (s ? s.getTime() : 0);
          })
        : n.sort((e, t) => {
              const n = le(e.fecha),
                  a = le(t.fecha),
                  o = n ? n.getTime() : 0;
              return (a ? a.getTime() : 0) - o;
          });
}
function pe() {
    if (ee) return;
    const e = document.getElementById('callbacksGrid');
    if (!e) return;
    const n = te();
    (n.sortSelect instanceof HTMLSelectElement &&
        n.sortSelect.addEventListener('change', () => {
            ge({
                filter: W.filter,
                search: W.search,
                sort: n.sortSelect.value || V,
            });
        }),
        n.selectVisibleBtn instanceof HTMLButtonElement &&
            n.selectVisibleBtn.addEventListener('click', () => {
                !(function () {
                    const e = Q.filter((e) => ie(e));
                    0 !== e.length
                        ? (e.forEach((e) => {
                              Z.add(oe(e));
                          }),
                          ge({
                              filter: W.filter,
                              search: W.search,
                              sort: W.sort,
                          }))
                        : S(
                              'No hay callbacks pendientes visibles para seleccionar.',
                              'info'
                          );
                })();
            }),
        n.clearSelectionBtn instanceof HTMLButtonElement &&
            n.clearSelectionBtn.addEventListener('click', () => {
                (Z.clear(),
                    se(Q),
                    ge({ filter: W.filter, search: W.search, sort: W.sort }));
            }),
        n.markSelectedBtn instanceof HTMLButtonElement &&
            n.markSelectedBtn.addEventListener('click', () => {
                !(async function () {
                    const e =
                        0 === Z.size
                            ? []
                            : t.filter((e) => ie(e) && Z.has(oe(e)));
                    if (0 === e.length)
                        return void S(
                            'No hay callbacks seleccionados para actualizar.',
                            'info'
                        );
                    let n = 0,
                        a = 0;
                    for (const t of e)
                        try {
                            let e = Number(t.id || 0);
                            (e <= 0 && ((e = Date.now() + n), (t.id = e)),
                                await b('callbacks', {
                                    method: 'PATCH',
                                    body: {
                                        id: Number(e),
                                        status: 'contactado',
                                    },
                                }),
                                (n += 1));
                        } catch (e) {
                            a += 1;
                        }
                    n <= 0
                        ? S(
                              'No se pudieron actualizar los callbacks seleccionados.',
                              'error'
                          )
                        : (await N(),
                          Z.clear(),
                          ge({
                              filter: W.filter,
                              sort: W.sort,
                              search: W.search,
                          }),
                          U(),
                          a > 0
                              ? S(`Actualizados ${n}; con error ${a}.`, 'info')
                              : S(
                                    `Marcados ${n} callbacks como contactados.`,
                                    'success'
                                ));
                })();
            }),
        e.addEventListener('change', (e) => {
            const t = e.target;
            t instanceof HTMLInputElement &&
                t.matches('input[data-callback-select-key]') &&
                (function (e, t) {
                    const n = (function (e) {
                        if (!e) return '';
                        try {
                            return decodeURIComponent(String(e));
                        } catch (t) {
                            return String(e);
                        }
                    })(e);
                    n && (t ? Z.add(n) : Z.delete(n), se(Q));
                })(t.dataset.callbackSelectKey || '', t.checked);
        }),
        (ee = !0));
}
function fe() {
    ge({
        filter: te().filterSelect?.value || z,
        sort: te().sortSelect?.value || W.sort,
    });
}
function ge(e, { preserveSearch: n = !0 } = {}) {
    (re(), pe());
    const a = te(),
        o = a.searchInput?.value ?? W.search,
        i = a.sortSelect?.value ?? W.sort,
        r = n ? (e.search ?? o) : (e.search ?? ''),
        s = (function (e) {
            const n = {
                    filter: ne(e.filter),
                    search: String(e.search || '')
                        .trim()
                        .toLowerCase(),
                    sort: ae(e.sort),
                },
                a = ce(new Date());
            return {
                filtered: me(
                    t.filter((e) => {
                        const t = T(e.status),
                            o = le(e.fecha),
                            i = o ? ce(o) : '';
                        return (
                            ('pending' !== n.filter || 'pendiente' === t) &&
                            ('contacted' !== n.filter || 'contactado' === t) &&
                            ('today' !== n.filter || i === a) &&
                            !(
                                'sla_urgent' === n.filter &&
                                (!ie(e) || de(e.fecha) < 120)
                            ) &&
                            ('' === n.search ||
                                [e.telefono, e.preferencia, e.fecha, t]
                                    .map((e) => String(e || '').toLowerCase())
                                    .join(' ')
                                    .includes(n.search))
                        );
                    }),
                    n.sort
                ),
                criteria: n,
            };
        })({
            filter: e.filter ?? a.filterSelect?.value ?? W.filter,
            sort: e.sort ?? i,
            search: r,
        });
    ((W.filter = s.criteria.filter),
        (W.sort = s.criteria.sort),
        (W.search = s.criteria.search),
        (Q = s.filtered),
        (function (e) {
            const t = new Set(e.filter((e) => ie(e)).map((e) => oe(e)));
            Array.from(Z).forEach((e) => {
                t.has(e) || Z.delete(e);
            });
        })(s.filtered),
        (function (e) {
            (re(), pe());
            const t = document.getElementById('callbacksGrid');
            t &&
                (0 !== e.length
                    ? (t.innerHTML = e
                          .map((e) => {
                              const t = T(e.status),
                                  n = Number(e.id) || 0,
                                  a = encodeURIComponent(String(e.fecha || '')),
                                  o = String(e.fecha || ''),
                                  i = oe(e),
                                  r = encodeURIComponent(i),
                                  s = le(o)?.getTime() || 0,
                                  c = de(o),
                                  l = 'pendiente' === t,
                                  d = l && Z.has(i),
                                  u =
                                      c >= 120
                                          ? 'is-warning'
                                          : c >= 45
                                            ? 'is-accent'
                                            : 'is-muted';
                              return `\n            <div class="callback-card ${t}${d ? ' is-selected' : ''}" data-callback-status="${t}" data-callback-id="${n}" data-callback-key="${v(r)}" data-callback-date="${v(a)}" data-callback-ts="${v(String(s))}">\n                <div class="callback-header">\n                    <span class="callback-phone">${v(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${v(D(e.preferencia))}\n                </span>\n                ${l ? `<label class="toolbar-chip callback-select-chip"><input type="checkbox" data-callback-select-key="${v(r)}" ${d ? 'checked' : ''} /> Seleccionar</label>` : ''}\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${v(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                ${l ? `<span class="toolbar-chip callback-wait-chip ${u}">En cola: ${v(ue(c))}</span>` : ''}\n                <div class="callback-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${v(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${l ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                          })
                          .join(''))
                    : (t.innerHTML =
                          '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n                </div>\n        '));
        })(s.filtered),
        (function (e, t, n) {
            const a = te(),
                {
                    toolbarMeta: o,
                    toolbarState: i,
                    clearFiltersBtn: r,
                    quickFilterButtons: s,
                    filterSelect: c,
                    sortSelect: l,
                    searchInput: d,
                } = a,
                u = e.length,
                m = t.length,
                p = e.filter((e) => 'pendiente' === T(e.status)).length,
                f = e.filter((e) => 'contactado' === T(e.status)).length;
            o &&
                (o.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${v(String(u))}${m !== u ? ` de ${v(String(m))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${v(String(p))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${v(String(f))}</span>`,
                    '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
                ].join(''));
            const g = n.filter !== z,
                h = '' !== n.search,
                b = n.sort !== V;
            if (i)
                if (g || h || b) {
                    const e = [
                        '<span class="toolbar-state-label">Criterios activos:</span>',
                    ];
                    (g &&
                        e.push(
                            `<span class="toolbar-state-value">${v(J[n.filter] || n.filter)}</span>`
                        ),
                        h &&
                            e.push(
                                `<span class="toolbar-state-value is-search">Busqueda: ${v(n.search)}</span>`
                            ),
                        b &&
                            e.push(
                                `<span class="toolbar-state-value is-sort">Orden: ${v(Y[n.sort] || n.sort)}</span>`
                            ),
                        e.push(
                            `<span class="toolbar-state-value">Resultados: ${v(String(u))}</span>`
                        ),
                        (i.innerHTML = e.join('')));
                } else
                    i.innerHTML =
                        '<span class="toolbar-state-empty">Sin filtros activos</span>';
            var y, S;
            (r && r.classList.toggle('is-hidden', !g && !h && !b),
                c && (c.value = n.filter),
                l && (l.value = n.sort),
                d && (d.value = n.search),
                (y = s),
                (S = n.filter),
                y.forEach((e) => {
                    const t = e.dataset.filterValue === S;
                    (e.classList.toggle('is-active', t),
                        e.setAttribute('aria-pressed', String(t)));
                }));
        })(s.filtered, t, s.criteria),
        se(s.filtered),
        (function (e) {
            const t = document.getElementById('callbacksOpsQueueHealth'),
                n = document.getElementById('callbacksOpsPendingCount'),
                a = document.getElementById('callbacksOpsUrgentCount'),
                o = document.getElementById('callbacksOpsTodayCount'),
                i = document.getElementById('callbacksOpsNext'),
                r = document.getElementById('callbacksOpsNextBtn');
            if (!(t && n && a && o && i)) return;
            const s =
                ((c = e),
                (Array.isArray(c) ? c : [])
                    .filter((e) => 'pendiente' === T(e.status))
                    .map((e) => ({ callback: e, minutesWaiting: de(e.fecha) }))
                    .sort((e, t) => {
                        if (t.minutesWaiting !== e.minutesWaiting)
                            return t.minutesWaiting - e.minutesWaiting;
                        const n = le(e.callback.fecha),
                            a = le(t.callback.fecha);
                        return (n ? n.getTime() : 0) - (a ? a.getTime() : 0);
                    }));
            var c;
            const l = s.length,
                d = s.filter((e) => e.minutesWaiting >= 120).length,
                u = s.filter((e) => e.minutesWaiting >= 45).length,
                m = ce(new Date()),
                p = s.filter((e) => {
                    const t = le(e.callback.fecha);
                    return !!t && ce(t) === m;
                }).length;
            ((n.textContent = v(String(l))),
                (a.textContent = v(String(d))),
                (o.textContent = v(String(p))),
                (t.className = 'toolbar-chip'),
                d > 0 || l >= 8
                    ? (t.classList.add('is-warning'),
                      (t.textContent = 'Cola: prioridad alta'))
                    : u >= 2 || l >= 3
                      ? (t.classList.add('is-accent'),
                        (t.textContent = 'Cola: atención requerida'))
                      : (t.classList.add('is-muted'),
                        (t.textContent = 'Cola: estable')));
            const f = s[0] || null;
            if (!f)
                return (
                    (i.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = le(f.callback.fecha),
                h = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((i.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${v(f.callback.telefono || 'Sin teléfono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${v(ue(f.minutesWaiting))} | Preferencia: ${v(D(f.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${v(h)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function he(e, { preserveSearch: t = !0 } = {}) {
    ge({ filter: e }, { preserveSearch: t });
}
function be() {
    ge({ search: te().searchInput?.value || '' });
}
function ye() {
    const e = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    if (0 === e.length)
        return (S('No hay callbacks pendientes para priorizar.', 'info'), !1);
    const t = e.sort((e, t) => {
            const n = Number(e.getAttribute('data-callback-ts') || 0),
                a = Number(t.getAttribute('data-callback-ts') || 0);
            return Number.isFinite(n) && Number.isFinite(a) && n !== a
                ? n - a
                : 0;
        })[0],
        n = t.querySelector('a[href^="tel:"]');
    return n instanceof HTMLElement
        ? (t.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          n.focus({ preventScroll: !0 }),
          !0)
        : (t.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          t.focus?.(),
          !0);
}
let ve = !1;
function Se(e, t = 'muted') {
    const n = document.getElementById('pushStatusIndicator');
    n &&
        (n.classList.remove(
            'status-pill-muted',
            'status-pill-ok',
            'status-pill-warn',
            'status-pill-error'
        ),
        n.classList.add(`status-pill-${t}`),
        (n.textContent = `Push: ${e}`));
}
function we(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function ke() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function Ee(e) {
    const { subscribeBtn: t, testBtn: n } = ke();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Be(e) {
    const { subscribeBtn: t } = ke();
    if (t) {
        if (e)
            return (
                (t.dataset.action = 'unsubscribe'),
                t.classList.remove('btn-primary'),
                t.classList.add('btn-secondary'),
                void (t.innerHTML =
                    '<i class="fas fa-bell-slash"></i> Desactivar Notificaciones')
            );
        ((t.dataset.action = 'subscribe'),
            t.classList.remove('btn-secondary'),
            t.classList.add('btn-primary'),
            (t.innerHTML =
                '<i class="fas fa-bell"></i> Activar Notificaciones'));
    }
}
async function Ce() {
    const e = await b('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Le() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Be(Boolean(t)),
        Se(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function $e() {
    const { subscribeBtn: e } = ke();
    if (!e) return;
    const t = String(e.dataset.action || 'subscribe'),
        n = e.innerHTML;
    ((e.disabled = !0),
        (e.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'));
    try {
        'unsubscribe' === t
            ? (await (async function () {
                  const e = await navigator.serviceWorker.ready,
                      t = await e.pushManager.getSubscription();
                  t &&
                      (await b('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              Se('disponible', 'muted'),
              S('Notificaciones desactivadas', 'info'))
            : (await (async function () {
                  if ('granted' !== (await Notification.requestPermission()))
                      throw new Error('Permiso de notificaciones denegado');
                  const e = await Ce(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: we(e),
                  });
                  return (
                      await b('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              Se('activo', 'ok'),
              S('Notificaciones activadas', 'success'));
    } catch (e) {
        (Se('error', 'error'),
            S(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await Le().catch(() => {
                Be(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function Ie() {
    const { testBtn: e } = ke();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await b('push-test', { method: 'POST', body: {} })).result ||
                {},
            t = Number(e.success || 0),
            n = Number(e.failed || 0);
        n > 0
            ? S(`Push test: ${t} ok, ${n} fallidos`, 'warning')
            : S(`Push test enviado (${t})`, 'success');
    } catch (e) {
        S(`Push test: ${e.message || 'error'}`, 'error');
    } finally {
        (t && (t.className = n), (e.disabled = !1));
    }
}
const De = 'themeMode',
    Te = new Set(['light', 'dark', 'system']);
let Ae = 'system',
    Me = null,
    Ne = !1,
    xe = !1,
    _e = null;
function He() {
    return (
        Me ||
            'function' != typeof window.matchMedia ||
            (Me = window.matchMedia('(prefers-color-scheme: dark)')),
        Me
    );
}
function Pe(e) {
    return Te.has(String(e || '').trim());
}
function Re() {
    try {
        const e = localStorage.getItem(De) || 'system';
        return Pe(e) ? e : 'system';
    } catch (e) {
        return 'system';
    }
}
function qe(e) {
    const t = document.documentElement;
    if (!t) return;
    const n = (function (e) {
        return 'system' !== e ? e : He()?.matches ? 'dark' : 'light';
    })(e);
    (t.setAttribute('data-theme-mode', e), t.setAttribute('data-theme', n));
}
function Fe() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((e) => {
            const t = e.dataset.themeMode === Ae;
            (e.classList.toggle('is-active', t),
                e.setAttribute('aria-pressed', String(t)));
        });
}
function je(e, { persist: t = !1, animate: n = !1 } = {}) {
    const a = Pe(e) ? e : 'system';
    ((Ae = a),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(De, e);
                } catch (e) {}
            })(a),
        n &&
            document.body &&
            (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
                (_e && clearTimeout(_e),
                document.body.classList.remove('theme-transition'),
                document.body.offsetWidth,
                document.body.classList.add('theme-transition'),
                (_e = setTimeout(() => {
                    document.body?.classList.remove('theme-transition');
                }, 220)))),
        qe(a),
        Fe());
}
function Oe() {
    'system' === Ae && (qe('system'), Fe());
}
function Ue(e) {
    (e?.key && e.key !== De) ||
        je(
            'string' == typeof e?.newValue && Pe(e.newValue)
                ? e.newValue
                : Re(),
            { persist: !1, animate: !1 }
        );
}
const ze = 'admin-appointments-sort',
    Ve = 'admin-appointments-density',
    Ge = 'datetime_desc',
    Ke = 'comfortable',
    We = 'all',
    Je = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
    Ye = new Set(['comfortable', 'compact']),
    Qe = new Set([
        'all',
        'today',
        'upcoming_48h',
        'week',
        'month',
        'confirmed',
        'cancelled',
        'no_show',
        'pending_transfer',
        'triage_attention',
    ]);
function Ze(e) {
    const t = String(e?.date || '').trim();
    if (!t) return null;
    const n = String(e?.time || '00:00').trim() || '00:00',
        a = new Date(`${t}T${n}:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Xe() {
    return {
        filterSelect: document.getElementById('appointmentFilter'),
        sortSelect: document.getElementById('appointmentSort'),
        searchInput: document.getElementById('searchAppointments'),
        stateRow: document.getElementById('appointmentsToolbarState'),
        clearBtn: document.getElementById('clearAppointmentsFiltersBtn'),
        appointmentsSection: document.getElementById('appointments'),
        densityButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
        ),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-quick-filter"][data-filter-value]'
            )
        ),
    };
}
function et(e) {
    const t = String(e || '').trim();
    return Qe.has(t) ? t : We;
}
function tt(e) {
    const t = String(e || '').trim();
    return Je.has(t) ? t : Ge;
}
function nt(e) {
    const t = String(e || '').trim();
    return Ye.has(t) ? t : Ke;
}
function at(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ot(e) {
    const t = nt(e),
        { appointmentsSection: n } = Xe();
    (n?.classList.toggle('appointments-density-compact', 'compact' === t),
        (function (e) {
            const t = nt(e),
                { densityButtons: n } = Xe();
            n.forEach((e) => {
                const n = e.dataset.density === t;
                (e.classList.toggle('is-active', n),
                    e.setAttribute('aria-pressed', n ? 'true' : 'false'));
            });
        })(t));
}
function it(e, t = new Date()) {
    const n = String(e?.paymentStatus || ''),
        a = String(e?.status || 'confirmed'),
        o = 'noshow' === a ? 'no_show' : a,
        i = (function (e, t = new Date()) {
            const n = Ze(e);
            return n
                ? (n.getTime() - t.getTime()) / 36e5
                : Number.POSITIVE_INFINITY;
        })(e, t),
        r = 'pending_transfer_review' === n,
        s = 'no_show' === o,
        c = 'completed' === o,
        l = !(c || 'cancelled' === o || s),
        d = l && Number.isFinite(i) && i < -2,
        u = l && Number.isFinite(i) && i >= -2 && i <= 24,
        m = Ze(e),
        p =
            s && m
                ? (t.getTime() - m.getTime()) / 864e5
                : Number.POSITIVE_INFINITY,
        f = s && Number.isFinite(p) && p >= 0 && p <= 7;
    let g = 8;
    r
        ? (g = 0)
        : d
          ? (g = 1)
          : u
            ? (g = 2)
            : f
              ? (g = 3)
              : 'confirmed' === o
                ? (g = 4)
                : 'pending' === o
                  ? (g = 5)
                  : s
                    ? (g = 6)
                    : c && (g = 7);
    const h = [];
    return (
        r && h.push({ tone: 'is-warning', label: 'Validar pago' }),
        d
            ? h.push({ tone: 'is-warning', label: 'Atrasada' })
            : u && h.push({ tone: 'is-accent', label: 'Proxima <24h' }),
        f && h.push({ tone: 'is-muted', label: 'Reagendar no-show' }),
        {
            status: o,
            isPendingTransfer: r,
            isOverdue: d,
            isImminent: u,
            requiresNoShowFollowUp: f,
            priorityScore: g,
            hoursUntil: i,
            badges: h,
        }
    );
}
function rt(e) {
    return it(e).priorityScore;
}
function st() {
    !(function () {
        const e = document.getElementById('appointmentFilter');
        if (
            e instanceof HTMLSelectElement &&
            !e.querySelector('option[value="triage_attention"]')
        ) {
            const t = document.createElement('option');
            ((t.value = 'triage_attention'),
                (t.textContent = 'Triage accionable'),
                e.appendChild(t));
        }
        const t = document.querySelector('.appointments-quick-filters');
        if (t && !t.querySelector('[data-filter-value="triage_attention"]')) {
            const e = document.createElement('button');
            ((e.type = 'button'),
                (e.className = 'appointment-quick-filter-btn'),
                (e.dataset.action = 'appointment-quick-filter'),
                (e.dataset.filterValue = 'triage_attention'),
                e.setAttribute('aria-pressed', 'false'),
                (e.title = 'Citas con accion prioritaria'),
                (e.textContent = 'Triage'),
                t.appendChild(e));
        }
    })();
    const t = (function () {
        const { filterSelect: e, sortSelect: t, searchInput: n } = Xe();
        return {
            filter: et(e?.value || We),
            sort: tt(t?.value || Ge),
            search: String(n?.value || '').trim(),
        };
    })();
    !(function (e) {
        const t = et(e),
            { quickFilterButtons: n } = Xe();
        n.forEach((e) => {
            const n = e.dataset.filterValue === t;
            (e.classList.toggle('is-active', n),
                e.setAttribute('aria-pressed', n ? 'true' : 'false'));
        });
    })(t.filter);
    const n = (function (e, t) {
        const n = Array.isArray(e) ? e : [],
            a = String(t || '')
                .trim()
                .toLowerCase();
        return a
            ? n.filter(
                  (e) =>
                      String(e.name || '')
                          .toLowerCase()
                          .includes(a) ||
                      String(e.email || '')
                          .toLowerCase()
                          .includes(a) ||
                      String(e.phone || '').includes(a)
              )
            : [...n];
    })(
        (function (e, t) {
            const n = Array.isArray(e) ? e : [],
                a = et(t);
            let o = [...n];
            const i = new Date(),
                r = (function (e) {
                    const t = e instanceof Date ? e : new Date(e);
                    return Number.isNaN(t.getTime())
                        ? ''
                        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                })(i),
                s = new Date(i);
            s.setHours(s.getHours() + 48);
            const c = (function () {
                    const e = new Date(),
                        t = new Date(e);
                    t.setDate(e.getDate() - e.getDay());
                    const n = new Date(t);
                    return (
                        n.setDate(t.getDate() + 6),
                        {
                            start: t.toISOString().split('T')[0],
                            end: n.toISOString().split('T')[0],
                        }
                    );
                })(),
                l = i.getMonth();
            switch (a) {
                case 'today':
                    o = o.filter((e) => e.date === r);
                    break;
                case 'upcoming_48h':
                    o = o.filter((e) => {
                        const t = Ze(e);
                        if (!t) return !1;
                        const n = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== n &&
                            'completed' !== n &&
                            t >= i &&
                            t <= s
                        );
                    });
                    break;
                case 'week':
                    o = o.filter((e) => e.date >= c.start && e.date <= c.end);
                    break;
                case 'month':
                    o = o.filter((e) => new Date(e.date).getMonth() === l);
                    break;
                case 'confirmed':
                case 'cancelled':
                case 'no_show':
                    o = o.filter((e) => (e.status || 'confirmed') === a);
                    break;
                case 'pending_transfer':
                    o = o.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    );
                    break;
                case 'triage_attention':
                    o = o.filter((e) => {
                        const t = it(e, i);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    });
            }
            return o;
        })(e, t.filter),
        t.search
    );
    (!(function (t, n = {}) {
        const a = document.getElementById('appointmentsTableBody');
        if (!a) return;
        if (
            ((function (t) {
                const n = document.getElementById('appointmentsToolbarMeta');
                if (!n) return;
                const a = Array.isArray(t) ? t : [],
                    o = Array.isArray(e) ? e : [],
                    i = a.length,
                    r = o.length,
                    s = a.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    ).length,
                    c = (function (e) {
                        const t = new Date().toISOString().split('T')[0];
                        return e.filter((e) => e.date === t).length;
                    })(a),
                    l = a.filter((e) => {
                        const t = it(e);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    }).length,
                    d = a.filter((e) => {
                        const t = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== t &&
                            'completed' !== t &&
                            'no_show' !== t &&
                            'noshow' !== t
                        );
                    }).length,
                    u = [
                        `<span class="toolbar-chip is-accent">Mostrando ${v(String(i))}${r !== i ? ` de ${v(String(r))}` : ''}</span>`,
                        `<span class="toolbar-chip">Hoy: ${v(String(c))}</span>`,
                        `<span class="toolbar-chip">Accionables: ${v(String(d))}</span>`,
                    ];
                (s > 0 &&
                    u.push(
                        `<span class="toolbar-chip is-warning">Por validar: ${v(String(s))}</span>`
                    ),
                    l > 0 &&
                        u.push(
                            `<span class="toolbar-chip is-accent">Triage: ${v(String(l))}</span>`
                        ),
                    (n.innerHTML = u.join('')));
            })(t),
            0 === t.length)
        )
            return void (a.innerHTML =
                '\n            <tr class="table-empty-row">\n                <td colspan="8">\n                    <div class="table-empty-state">\n                        <i class="fas fa-calendar-check" aria-hidden="true"></i>\n                        <strong>No hay citas registradas</strong>\n                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>\n                    </div>\n                </td>\n            </tr>\n        ');
        const o = (function (e, t) {
            const n = tt(t),
                a = Array.isArray(e) ? [...e] : [],
                o = (e, t) => {
                    const n = `${String(e?.date || '')} ${String(e?.time || '')}`,
                        a = `${String(t?.date || '')} ${String(t?.time || '')}`;
                    return n.localeCompare(a);
                };
            return a.sort((e, t) => {
                if ('patient_az' === n) {
                    const n = String(e?.name || '').toLocaleLowerCase('es'),
                        a = String(t?.name || '').toLocaleLowerCase('es'),
                        i = n.localeCompare(a, 'es');
                    return 0 !== i ? i : o(e, t);
                }
                if ('datetime_asc' === n) return o(e, t);
                if ('triage' === n) {
                    const n = rt(e) - rt(t);
                    if (0 !== n) return n;
                    const a = it(e),
                        i = it(t);
                    return a.hoursUntil !== i.hoursUntil
                        ? a.hoursUntil - i.hoursUntil
                        : o(e, t);
                }
                return -o(e, t);
            });
        })(t, n?.sort || Ge);
        a.innerHTML = o
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    o = 'cancelled' === t,
                    i = 'no_show' === t || 'noshow' === t,
                    r = it(e),
                    s = [
                        'appointment-row',
                        a ? 'is-payment-review' : '',
                        o ? 'is-cancelled' : '',
                        i ? 'is-noshow' : '',
                        r.isPendingTransfer ||
                        r.isOverdue ||
                        r.isImminent ||
                        r.requiresNoShowFollowUp
                            ? 'is-triage-attention'
                            : '',
                    ]
                        .filter(Boolean)
                        .join(' '),
                    c = e.doctorAssigned
                        ? `<br><small>Asignado: ${v(C(e.doctorAssigned))}</small>`
                        : '',
                    l = e.transferReference
                        ? `<br><small>Ref: ${v(e.transferReference)}</small>`
                        : '',
                    d = (function (e) {
                        const t = String(e || '').trim();
                        return '' === t
                            ? ''
                            : t.startsWith('/') || /^https?:\/\//i.test(t)
                              ? t
                              : '';
                    })(e.transferProofUrl),
                    u = d
                        ? `<br><a class="appointment-proof-link" href="${v(d)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> Ver comprobante</a>`
                        : '',
                    m = String(e.phone || '').replace(/\D/g, ''),
                    p = r.badges
                        .map(
                            (e) =>
                                `<span class="toolbar-chip ${v(e.tone)}">${v(e.label)}</span>`
                        )
                        .join(''),
                    f = r.isPendingTransfer
                        ? `Hola ${String(e.name || '').trim()}, estamos validando tu comprobante de pago para la cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()}.`
                        : r.isOverdue
                          ? `Hola ${String(e.name || '').trim()}, notamos que tu cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()} quedo pendiente. Te ayudamos a reprogramar.`
                          : r.requiresNoShowFollowUp
                            ? `Hola ${String(e.name || '').trim()}, podemos ayudarte a reagendar tu consulta cuando te convenga.`
                            : '',
                    g = `https://wa.me/${encodeURIComponent(m)}${f ? `?text=${encodeURIComponent(f)}` : ''}`;
                return `\n        <tr class="${s}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${v(e.name)}</strong><br>\n                <small>${v(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${v(String(e.phone || 'Sin telefono'))}</span>\n                    ${p}\n                </div>\n            </td>\n            <td data-label="Servicio">${v(B(e.service))}</td>\n            <td data-label="Doctor">${v(C(e.doctor))}${c}</td>\n            <td data-label="Fecha">${v(
                    (function (e) {
                        const t = new Date(e);
                        return Number.isNaN(t.getTime())
                            ? e
                            : t.toLocaleDateString('es-EC', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                              });
                    })(e.date)
                )}</td>\n            <td data-label="Hora">${v(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${v(e.price || '$0.00')}</strong>\n                <small>${v($(e.paymentMethod))} - ${v(I(n))}</small>\n                ${l}\n                ${u}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${v(t)}">\n                    ${v(L(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${v(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(g)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="${v(r.isPendingTransfer ? 'WhatsApp para validar pago' : r.isOverdue ? 'WhatsApp para reprogramar cita atrasada' : r.requiresNoShowFollowUp ? 'WhatsApp para seguimiento no-show' : 'WhatsApp')}" aria-label="Abrir WhatsApp de ${v(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = Xe();
            if (!n) return;
            const o = et(e?.filter || We),
                i = tt(e?.sort || Ge),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = Xe();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = o !== We,
                l = r.length > 0,
                d = i !== Ge || s !== Ke;
            if (
                (a &&
                    (a.classList.toggle('is-hidden', !c && !l),
                    (a.disabled = !c && !l)),
                !c && !l && !d)
            )
                return void (n.innerHTML =
                    '<span class="toolbar-state-empty">Sin filtros activos</span>');
            const u = Array.isArray(t) ? t.length : 0,
                m = [
                    `<span class="toolbar-state-label">${c || l ? 'Criterios activos:' : 'Vista activa:'}</span>`,
                ];
            (c &&
                m.push(
                    `<span class="toolbar-state-value is-filter">Filtro: ${v(
                        (function (e) {
                            const t = {
                                all: 'Todas las citas',
                                today: 'Hoy',
                                upcoming_48h: 'Proximas 48h',
                                week: 'Esta semana',
                                month: 'Este mes',
                                confirmed: 'Confirmadas',
                                cancelled: 'Canceladas',
                                no_show: 'No asistio',
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                            };
                            return t[String(e || We)] || t.all;
                        })(o)
                    )}</span>`
                ),
                l &&
                    m.push(
                        `<span class="toolbar-state-value is-search">Busqueda: ${v(r)}</span>`
                    ),
                m.push(
                    `<span class="toolbar-state-value">Resultados: ${v(String(u))}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-sort">Orden: ${v(
                        (function (e) {
                            const t = {
                                datetime_desc: 'Mas recientes primero',
                                datetime_asc: 'Proximas primero',
                                triage: 'Triage operativo',
                                patient_az: 'Paciente (A-Z)',
                            };
                            return t[tt(e)] || t.datetime_desc;
                        })(i)
                    )}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-density">Densidad: ${v(
                        (function (e) {
                            const t = {
                                comfortable: 'Comoda',
                                compact: 'Compacta',
                            };
                            return t[nt(e)] || t.comfortable;
                        })(s)
                    )}</span>`
                ),
                (n.innerHTML = m.join('')));
        })(t, n));
}
function ct() {
    st();
}
function lt(e, t = {}) {
    const { filterSelect: n, searchInput: a } = Xe(),
        o = et(e),
        i = !1 !== t.preserveSearch;
    (n && (n.value = o), !i && a && (a.value = ''), st());
}
function dt() {
    lt(We, { preserveSearch: !1 });
}
function ut(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
function mt() {
    if (!Array.isArray(e) || 0 === e.length)
        return void S('No hay citas para exportar', 'warning');
    const t = e.map((e) => [
            Number(e.id) || 0,
            e.date || '',
            e.time || '',
            ut(e.name || ''),
            ut(e.email || ''),
            ut(e.phone || ''),
            ut(B(e.service)),
            ut(C(e.doctor)),
            e.price || '',
            ut(L(e.status || 'confirmed')),
            ut(I(e.paymentStatus)),
            ut($(e.paymentMethod)),
        ]),
        n = [
            [
                'ID',
                'Fecha',
                'Hora',
                'Paciente',
                'Email',
                'Telefono',
                'Servicio',
                'Doctor',
                'Precio',
                'Estado',
                'Estado pago',
                'Metodo pago',
            ].join(','),
            ...t.map((e) => e.join(',')),
        ].join('\n'),
        a = new Blob([n], { type: 'text/csv;charset=utf-8;' }),
        o = URL.createObjectURL(a),
        i = document.createElement('a');
    ((i.href = o),
        (i.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`),
        document.body.appendChild(i),
        i.click(),
        document.body.removeChild(i),
        URL.revokeObjectURL(o),
        S('CSV exportado correctamente', 'success'));
}
let pt = null,
    ft = new Date(),
    gt = !1,
    ht = null,
    bt = {},
    yt = !1;
const vt = 'admin-availability-day-clipboard',
    St = 'admin-availability-last-selected-date';
function wt(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = {};
    return (
        Object.keys(t)
            .sort()
            .forEach((e) => {
                if (!$t(e)) return;
                const a = At(t[e] || []);
                a.length > 0 && (n[e] = a);
            }),
        n
    );
}
function kt(e) {
    bt = wt(e);
}
function Et() {
    const e = wt(a),
        t = wt(bt);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                o = t[n] || [];
            return a.length !== o.length || a.some((e, t) => e !== o[t]);
        });
}
function Bt() {
    return Et().length > 0;
}
function Ct(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Lt(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function $t(e) {
    return Boolean(Lt(e));
}
function It(e) {
    try {
        const t = String(e || '').trim();
        if (!$t(t)) return void localStorage.removeItem(St);
        localStorage.setItem(St, t);
    } catch (e) {}
}
function Dt() {
    ht ||
        (ht = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(vt) || 'null');
                if (!e || 'object' != typeof e) return null;
                const t = String(e.sourceDate || '').trim(),
                    n = Array.isArray(e.slots)
                        ? e.slots
                              .map((e) => String(e || '').trim())
                              .filter(Boolean)
                        : [];
                return t && 0 !== n.length
                    ? { sourceDate: t, slots: Array.from(new Set(n)).sort() }
                    : null;
            } catch (e) {
                return null;
            }
        })());
}
function Tt() {
    try {
        if (
            ht &&
            'object' == typeof ht &&
            Array.isArray(ht.slots) &&
            ht.slots.length > 0
        )
            return void localStorage.setItem(vt, JSON.stringify(ht));
        localStorage.removeItem(vt);
    } catch (e) {}
}
function At(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function Mt(e, t) {
    const n = String(e || '').trim(),
        a = At(t);
    if (!n || 0 === a.length) return ((ht = null), void Tt());
    ((ht = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        Tt());
}
function Nt(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = Lt(t);
    return n
        ? n.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          })
        : t;
}
function xt() {
    return pt ? At(a[pt] || []) : [];
}
function _t(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const o = At(t);
    0 !== o.length ? (a[n] = o) : delete a[n];
}
function Ht(e, t) {
    const n = Lt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const o = Math.max(0, Math.round(a));
    return 0 === o
        ? []
        : Array.from({ length: o }, (e, t) => {
              const a = new Date(n);
              return (a.setDate(n.getDate() + t), Ct(a));
          });
}
function Pt(e) {
    return (Array.isArray(e) ? e : []).reduce(
        (e, t) => e + At(a[t] || []).length,
        0
    );
}
function Rt(e) {
    const t = Lt(e);
    t && (ft = new Date(t.getFullYear(), t.getMonth(), 1));
}
function qt(e, t) {
    const n = Lt(e);
    if (!n) return;
    const a = Number(t);
    if (!Number.isFinite(a) || 0 === a) return;
    const o = new Date(n);
    o.setDate(n.getDate() + a);
    const i = Ct(o);
    (Rt(i), tn(i));
}
function Ft(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function jt(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function Ot(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function Ut() {
    const e = document.getElementById('availabilitySelectionSummary');
    if (!e) return;
    const t =
            'google' === String(o.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = gt ? 'Solo lectura' : 'Editable',
        i = String(pt || '').trim(),
        r = i ? (Array.isArray(a[i]) ? a[i].length : 0) : null;
    if (!i)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
            `<span class="availability-summary-chip ${gt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Lt(i),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : i;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
        `<span class="availability-summary-chip ${gt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${v(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${v(String(r ?? 0))}</span>`,
    ].join('');
}
function zt() {
    Dt();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(pt || '').trim()),
        o = xt(),
        i = o.length > 0,
        r = n ? Ht(pt, 7) : [],
        s = Pt(r),
        c = r.filter((e) => At(a[e] || []).length > 0).length,
        l = At(ht?.slots || []),
        d = l.length > 0,
        u = e.querySelector('[data-action="copy-availability-day"]'),
        m = e.querySelector('[data-action="paste-availability-day"]'),
        p = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        f = e.querySelector('[data-action="duplicate-availability-next-week"]'),
        g = e.querySelector('[data-action="clear-availability-day"]'),
        h = e.querySelector('[data-action="clear-availability-week"]');
    if (
        (u instanceof HTMLButtonElement && (u.disabled = !n || !i),
        m instanceof HTMLButtonElement && (m.disabled = !n || !d || gt),
        p instanceof HTMLButtonElement && (p.disabled = !n || !i || gt),
        f instanceof HTMLButtonElement && (f.disabled = !n || !i || gt),
        g instanceof HTMLButtonElement && (g.disabled = !n || !i || gt),
        h instanceof HTMLButtonElement && (h.disabled = !n || 0 === s || gt),
        e.classList.toggle('is-hidden', !n && !d),
        !n && !d)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const b = [];
    (n &&
        (b.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${v(Nt(pt))}</span>`
        ),
        b.push(
            `<span class="toolbar-chip is-muted">Slots: ${v(String(o.length))}</span>`
        ),
        b.push(
            `<span class="toolbar-chip is-muted">Semana: ${v(String(c))} dia(s), ${v(String(s))} slot(s)</span>`
        )),
        d
            ? b.push(
                  `<span class="toolbar-chip">Portapapeles: ${v(String(l.length))} (${v(Nt(ht?.sourceDate))})</span>`
              )
            : b.push(
                  '<span class="toolbar-chip is-muted">Portapapeles vacío</span>'
              ),
        gt &&
            b.push(
                '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
            ),
        (t.innerHTML = b.join('')));
}
function Vt() {
    const e = document.getElementById('availabilityDraftPanel'),
        t = document.getElementById('availabilityDraftStatus'),
        n = document.getElementById('availabilitySaveDraftBtn'),
        a = document.getElementById('availabilityDiscardDraftBtn');
    if (!e || !t) return;
    const o = Et(),
        i = o.length,
        r = o
            .slice(0, 2)
            .map((e) => Nt(e))
            .join(', ');
    if (gt)
        t.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    else if (0 === i)
        t.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    else {
        const e = `${i} día${1 === i ? '' : 's'} con cambios pendientes`,
            n = r ? ` (${v(r)}${i > 2 ? '…' : ''})` : '';
        t.innerHTML = `<span class="toolbar-chip is-info">${v(e)}${n}</span>`;
    }
    (n instanceof HTMLButtonElement &&
        ((n.disabled = gt || 0 === i || yt),
        n.setAttribute('aria-busy', String(yt))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === i || yt));
}
function Gt() {
    const {
        statusEl: e,
        detailsEl: t,
        linksEl: n,
    } = (function () {
        const e = document.querySelector('#availability .time-slots-config');
        if (!e) return { statusEl: null, detailsEl: null, linksEl: null };
        let t = document.getElementById('availabilitySyncStatus');
        t ||
            ((t = document.createElement('div')),
            (t.id = 'availabilitySyncStatus'),
            (t.className = 'selected-date'),
            e.firstChild
                ? e.insertBefore(t, e.firstChild.nextSibling)
                : e.appendChild(t));
        let n = document.getElementById('availabilitySyncDetails');
        n ||
            ((n = document.createElement('div')),
            (n.id = 'availabilitySyncDetails'),
            (n.className = 'selected-date'),
            t.insertAdjacentElement('afterend', n));
        let a = document.getElementById('availabilitySyncLinks');
        return (
            a ||
                ((a = document.createElement('div')),
                (a.id = 'availabilitySyncLinks'),
                (a.className = 'selected-date'),
                n.insertAdjacentElement('afterend', a)),
            { statusEl: t, detailsEl: n, linksEl: a }
        );
    })();
    if (!e) return;
    const a = String(o.source || 'store'),
        i = String(o.mode || 'live'),
        r = String(o.timezone || 'America/Guayaquil'),
        s = String(o.calendarAuth || 'n/d'),
        c = !1 === o.calendarTokenHealthy ? 'no' : 'si',
        l = !1 === o.calendarConfigured ? 'no' : 'si',
        d = !1 === o.calendarReachable ? 'no' : 'si',
        u = Ft(o.generatedAt),
        m = Ft(o.calendarLastSuccessAt),
        p = Ft(o.calendarLastErrorAt),
        f = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${v(n)}</strong> | TZ: <strong>${v(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${v(s)}</strong> | Token OK: <strong>${v(c)}</strong> | Configurado: <strong>${v(l)}</strong> | Reachable: <strong>${v(d)}</strong> | Ultimo exito: <strong>${v(m)}</strong> | Snapshot: <strong>${v(u)}</strong>`;
            ('blocked' === i &&
                f &&
                (e += ` | Ultimo error: <strong>${v(p)}</strong> (${v(f)})`),
                (t.innerHTML = e));
        }
        jt(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${v(u)}</strong>`),
            jt(
                'Selecciona un dia para editar horarios. Guarda o descarta el borrador cuando termines.'
            ));
    if (
        ((function (e) {
            const t = document.querySelector(
                '#availability .availability-calendar h3'
            );
            t &&
                (t.textContent =
                    'google' === e
                        ? 'Disponibilidad (Google Calendar - Solo lectura)'
                        : 'Configurar Horarios Disponibles');
            const n = document.querySelector(
                '#availability .time-slots-config h3'
            );
            n &&
                (n.textContent =
                    'google' === e
                        ? 'Horarios del Dia (solo lectura)'
                        : 'Horarios del Dia');
        })(a),
        Ut(),
        zt(),
        Vt(),
        !n)
    )
        return;
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const h = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = v(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${v(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        h('rosero', 'Dr. Rosero'),
        h('narvaez', 'Dra. Narváez'),
    ].join(' | ');
}
function Kt() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Ot(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        Wt(),
        Ut(),
        zt(),
        Vt());
}
function Wt() {
    const e = Boolean(String(pt || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', gt || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', gt || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = gt || !e;
        })),
        zt(),
        Vt());
}
function Jt() {
    const e = ft.getFullYear(),
        t = ft.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = Ct(new Date());
    ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].forEach((e) => {
        const t = document.createElement('div');
        ((t.className = 'calendar-day-header'),
            (t.textContent = e),
            r.appendChild(t));
    });
    for (let e = n - 1; e >= 0; e -= 1) {
        const t = i - e,
            n = document.createElement('div');
        ((n.className = 'calendar-day other-month'),
            (n.textContent = t),
            r.appendChild(n));
    }
    for (let n = 1; n <= o; n += 1) {
        const o = Ct(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            (i.tabIndex = 0),
            i.setAttribute('role', 'button'),
            i.setAttribute('aria-label', `Seleccionar ${o}`),
            pt === o && i.classList.add('selected'),
            s === o && i.classList.add('today'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => tn(o)),
            i.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void tn(o))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void qt(o, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void qt(o, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void qt(o, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), qt(o, 7))
                            )
            ),
            r.appendChild(i));
    }
    const c = 42 - (n + o);
    for (let e = 1; e <= c; e += 1) {
        const t = document.createElement('div');
        ((t.className = 'calendar-day other-month'),
            (t.textContent = e),
            r.appendChild(t));
    }
}
function Yt(e) {
    (ft.setMonth(ft.getMonth() + e), Jt());
}
function Qt() {
    const e = new Date();
    ((ft = new Date(e.getFullYear(), e.getMonth(), 1)), Jt(), tn(Ct(e)));
}
function Zt() {
    const e = (function ({
        referenceDate: e = '',
        includeReference: t = !1,
    } = {}) {
        const n = Object.keys(a || {})
            .filter((e) => {
                if (!$t(e)) return !1;
                const t = a[e];
                return Array.isArray(t) && t.length > 0;
            })
            .sort();
        if (0 === n.length) return '';
        const o = $t(e) ? String(e).trim() : Ct(new Date()),
            i = t ? (e) => e >= o : (e) => e > o;
        return n.find(i) || n[0];
    })({ referenceDate: pt || Ct(new Date()), includeReference: !1 });
    e
        ? (Rt(e), tn(e))
        : S('No hay fechas con horarios configurados', 'warning');
}
function Xt() {
    const e = document.getElementById('newSlotTime');
    e instanceof HTMLInputElement &&
        (gt || e.closest('.is-hidden') || e.focus({ preventScroll: !0 }));
}
function en() {
    return (
        document.getElementById('availability')?.classList.contains('active') ||
        !1
    );
}
function tn(e, { persist: t = !0 } = {}) {
    if (!$t(e)) return;
    ((pt = e), t && It(e), Jt());
    const n = Lt(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        n.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        Wt(),
        Ut(),
        nn(e));
}
function nn(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Ot(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            Ut(),
            zt(),
            void Vt()
        );
    const o = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${gt ? ' is-readonly' : ''}">\n            <span class="time">${v(e)}</span>\n            <div class="slot-actions">\n                ${gt ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        Ut(),
        zt(),
        Vt());
}
function an() {
    (Jt(), pt ? nn(pt) : Kt());
}
function on(e) {
    ('function' == typeof e && e(), an());
}
async function rn() {
    if (gt)
        return (
            S(
                'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                'warning'
            ),
            !1
        );
    if (!Bt()) return (S('No hay cambios pendientes por guardar', 'info'), !1);
    try {
        return (
            await (async function () {
                if (gt)
                    throw new Error(
                        'Disponibilidad en solo lectura (Google Calendar).'
                    );
                if (yt) return !1;
                ((yt = !0), Vt());
                try {
                    const e = wt(a);
                    return (
                        u(e),
                        await b('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        kt(a),
                        !0
                    );
                } finally {
                    ((yt = !1), Vt());
                }
            })(),
            S('Cambios de disponibilidad guardados', 'success'),
            !0
        );
    } catch (e) {
        return (S(`No se pudieron guardar cambios: ${e.message}`, 'error'), !1);
    }
}
function sn() {
    Bt()
        ? confirm(
              'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
          ) && (u(wt(bt)), an(), S('Cambios pendientes descartados', 'success'))
        : S('No hay cambios pendientes por descartar', 'info');
}
function cn() {
    return gt
        ? (S(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!pt || (S('Selecciona una fecha primero', 'warning'), !1);
}
function ln() {
    if (!pt) return void S('Selecciona una fecha para copiar', 'warning');
    const e = xt();
    0 !== e.length
        ? (Mt(pt, e),
          zt(),
          S(
              `Día copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
              'success'
          ))
        : S('No hay horarios para copiar en este dia', 'warning');
}
async function dn() {
    if ((Dt(), !cn())) return;
    const e = At(ht?.slots || []);
    if (0 === e.length) return void S('Portapapeles vacio', 'warning');
    const t = xt();
    t.length === e.length && t.every((t, n) => t === e[n])
        ? S('La fecha ya tiene esos mismos horarios', 'warning')
        : (t.length > 0 &&
              !confirm(
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${Nt(pt)} con ${e.length}?`
              )) ||
          (on(() => {
              _t(pt, e);
          }),
          S('Horarios pegados en cambios pendientes', 'success'));
}
async function un() {
    if (!cn()) return;
    const e = xt();
    if (0 === e.length)
        return void S('No hay horarios para duplicar en este dia', 'warning');
    const t = Lt(pt);
    if (!t) return void S('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const o = Ct(n),
        i = At(a[o] || []);
    (i.length > 0 &&
        !confirm(
            `${Nt(o)} ya tiene ${i.length} horario${1 === i.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (on(() => {
            (_t(o, e), Mt(pt, e));
        }),
        Rt(o),
        tn(o),
        S(`Horarios duplicados a ${Nt(o)} (pendiente de guardar)`, 'success'));
}
async function mn() {
    if (!cn()) return;
    const e = xt();
    if (0 === e.length)
        return void S('No hay horarios para duplicar en este dia', 'warning');
    const t = Ht(pt, 8).slice(1);
    if (0 === t.length)
        return void S('No se pudieron preparar los siguientes dias', 'error');
    const n = t.filter((t) => {
        const n = At(a[t] || []);
        return (
            n.length > 0 &&
            (n.length !== e.length || n.some((t, n) => t !== e[n]))
        );
    }).length;
    (n > 0 &&
        !confirm(
            `Se reemplazaran horarios en ${n} dia(s). Deseas continuar?`
        )) ||
        (on(() => {
            (t.forEach((t) => {
                _t(t, e);
            }),
                Mt(pt, e));
        }),
        S(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function pn() {
    if (!cn()) return;
    const e = xt();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${Nt(pt)}?`
          ) &&
          (on(() => {
              _t(pt, []);
          }),
          Rt(pt),
          tn(pt),
          S('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : S('No hay horarios que limpiar en este dia', 'warning');
}
async function fn() {
    if (!cn()) return;
    const e = Ht(pt, 7);
    if (0 === e.length)
        return void S('No se pudo preparar la semana de limpieza', 'error');
    const t = e.filter((e) => At(a[e] || []).length > 0);
    if (0 === t.length)
        return void S(
            'No hay horarios para limpiar en los proximos 7 dias',
            'warning'
        );
    const n = Pt(t);
    confirm(
        `Eliminar ${n} horario(s) en ${t.length} dia(s) desde ${Nt(pt)}?`
    ) &&
        (on(() => {
            t.forEach((e) => {
                _t(e, []);
            });
        }),
        Rt(pt),
        tn(pt),
        S(
            `Semana limpiada (${t.length} dia(s)) pendiente de guardar`,
            'success'
        ));
}
const gn = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'reviews'],
        ['digit5', 'availability'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'reviews'],
        ['5', 'availability'],
    ]),
    hn = [
        'a[href]',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','),
    bn = 'adminLastSection',
    yn = 'adminSidebarCollapsed',
    vn = {
        dashboard: {
            title: 'Acciones rápidas: dashboard',
            actions: [
                {
                    action: 'refresh-admin-data',
                    icon: 'fa-rotate-right',
                    label: 'Actualizar datos',
                },
                {
                    action: 'context-open-appointments-today',
                    icon: 'fa-calendar-day',
                    label: 'Citas de hoy',
                },
                {
                    action: 'context-open-callbacks-pending',
                    icon: 'fa-phone',
                    label: 'Callbacks pendientes',
                },
            ],
        },
        appointments: {
            title: 'Acciones rápidas: citas',
            actions: [
                {
                    action: 'appointment-quick-filter',
                    filterValue: 'today',
                    icon: 'fa-calendar-day',
                    label: 'Filtrar hoy',
                },
                {
                    action: 'appointment-quick-filter',
                    filterValue: 'pending_transfer',
                    icon: 'fa-money-check-dollar',
                    label: 'Por validar',
                },
                {
                    action: 'clear-appointment-filters',
                    icon: 'fa-filter-circle-xmark',
                    label: 'Limpiar filtros',
                },
                {
                    action: 'export-csv',
                    icon: 'fa-file-csv',
                    label: 'Exportar CSV',
                },
            ],
        },
        callbacks: {
            title: 'Acciones rápidas: callbacks',
            actions: [
                {
                    action: 'callback-quick-filter',
                    filterValue: 'pending',
                    icon: 'fa-phone',
                    label: 'Pendientes',
                },
                {
                    action: 'callback-quick-filter',
                    filterValue: 'today',
                    icon: 'fa-calendar-day',
                    label: 'Hoy',
                },
                {
                    action: 'clear-callback-filters',
                    icon: 'fa-filter-circle-xmark',
                    label: 'Limpiar filtros',
                },
                {
                    action: 'context-open-appointments-transfer',
                    icon: 'fa-calendar-check',
                    label: 'Ver citas por validar',
                },
                {
                    action: 'context-open-callbacks-next',
                    icon: 'fa-phone-volume',
                    label: 'Siguiente llamada',
                },
            ],
        },
        reviews: {
            title: 'Acciones rápidas: reseñas',
            actions: [
                {
                    action: 'refresh-admin-data',
                    icon: 'fa-rotate-right',
                    label: 'Actualizar datos',
                },
                {
                    action: 'context-open-dashboard',
                    icon: 'fa-chart-line',
                    label: 'Volver a dashboard',
                },
                {
                    action: 'context-open-callbacks-pending',
                    icon: 'fa-headset',
                    label: 'Revisar callbacks',
                },
            ],
        },
        availability: {
            title: 'Acciones rápidas: disponibilidad',
            actions: [
                {
                    action: 'context-availability-today',
                    icon: 'fa-calendar-day',
                    label: 'Ir a hoy',
                },
                {
                    action: 'context-availability-next',
                    icon: 'fa-forward',
                    label: 'Siguiente con horarios',
                },
                {
                    action: 'context-focus-slot-input',
                    icon: 'fa-clock',
                    label: 'Agregar horario',
                },
                {
                    action: 'context-copy-availability-day',
                    icon: 'fa-copy',
                    label: 'Copiar día',
                },
            ],
        },
    };
let Sn = 0,
    wn = 0;
function kn() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function En(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(kn().map((e) => e.dataset.section)).has(n) ? n : t;
}
function Bn() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? En(e, 'dashboard')
        : (function () {
              try {
                  return En(localStorage.getItem(bn), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function Cn() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        Bn() ||
        'dashboard'
    );
}
function Ln() {
    return window.innerWidth <= 1024;
}
function $n() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function In() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function Dn(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function Tn(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!Ln() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        Dn(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(yn, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function An() {
    Ln()
        ? Tn(!1, { persist: !1 })
        : Tn(
              (function () {
                  try {
                      return '1' === localStorage.getItem(yn);
                  } catch (e) {
                      return !1;
                  }
              })(),
              { persist: !1 }
          );
}
function Mn(e) {
    const t = En(e, 'dashboard');
    (kn().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = En(e, 'dashboard');
            try {
                localStorage.setItem(bn, t);
            } catch (e) {}
        })(t));
}
function Nn(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function xn() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !Sn))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - Sn),
        a = (function (e) {
            if (!Sn) return 'sin actualizar';
            const t = Math.max(0, e - Sn),
                n = Math.floor(t / 6e4);
            return n <= 0
                ? 'hace menos de 1 min'
                : 1 === n
                  ? 'hace 1 min'
                  : `hace ${n} min`;
        })(t),
        o = n >= 3e5;
    (e.classList.remove('status-pill-muted'),
        e.classList.add(o ? 'status-pill-stale' : 'status-pill-live'),
        (e.textContent = `Datos: ${a}`));
}
function _n() {
    ((Sn = Date.now()), xn());
}
function Hn({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function Pn(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = vn[e && vn[e] ? e : 'dashboard'];
    ((t.textContent = a.title),
        (n.innerHTML = ''),
        a.actions.forEach((e) => {
            n.appendChild(
                (function (e) {
                    const t = document.createElement('button');
                    return (
                        (t.type = 'button'),
                        (t.className = 'admin-context-action-btn'),
                        (t.dataset.action = e.action),
                        e.filterValue &&
                            (t.dataset.filterValue = e.filterValue),
                        e.targetSection &&
                            (t.dataset.targetSection = e.targetSection),
                        (t.title = e.hint || e.label),
                        (t.innerHTML = `<i class="fas ${e.icon}" aria-hidden="true"></i><span>${e.label}</span>`),
                        t
                    );
                })(e)
            );
        }));
}
function Rn() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function qn() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(hn)).filter((e) => {
              if (!(e instanceof HTMLElement)) return !1;
              if (e.hasAttribute('disabled')) return !1;
              if ('true' === e.getAttribute('aria-hidden')) return !1;
              if (e.closest('.is-hidden')) return !1;
              if (0 === e.getClientRects().length) return !1;
              if (0 === e.offsetWidth && 0 === e.offsetHeight) return !1;
              const t = window.getComputedStyle(e);
              return 'none' !== t.display && 'hidden' !== t.visibility;
          })
        : [];
}
function Fn(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = Ln(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function jn(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = Rn();
    if (!t || !n || !a) return;
    const o = Boolean(e && Ln());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        Fn(o),
        o &&
            (function () {
                const e = document.getElementById('adminSidebar');
                if (!e) return;
                const t = e.querySelector('.nav-item.active');
                if (t instanceof HTMLElement)
                    return (
                        t.scrollIntoView({ block: 'nearest' }),
                        void t.focus()
                    );
                const n = qn();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function On({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = Rn(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (jn(!1), e && n && t && t.focus());
}
function Un(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function zn(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = En(Cn(), 'dashboard'),
        s = En(e, 'dashboard');
    if (
        'availability' === r &&
        'availability' !== s &&
        Bt() &&
        !confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        )
    )
        return (Mn(r), a || Nn(r), o && Un(r), !1);
    if ((Mn(s), i && On(), n))
        try {
            (await N(), _n());
        } catch (e) {
            S(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    return (await Jn(s), a && Nn(s), o && Un(s), !0);
}
async function Vn(e) {
    (await zn('appointments', { focus: !1 }),
        lt(e, { preserveSearch: !1 }),
        Un('appointments'));
}
async function Gn(e) {
    (await zn('callbacks', { focus: !1 }),
        he(e, { preserveSearch: !1 }),
        Un('callbacks'));
}
async function Kn({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await N(),
            _n(),
            await Jn(Cn()),
            e && S('Datos actualizados', 'success'),
            !0
        );
    } catch (e) {
        return (
            t &&
                S(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                ),
            !1
        );
    }
}
async function Wn(e) {
    const t = document.getElementById('adminQuickCommand'),
        n = String(e || '')
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    if (!n)
        return (
            S(
                'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
                'info'
            ),
            Hn(),
            !1
        );
    if ('help' === n || 'ayuda' === n)
        return (
            S(
                'Comandos: citas hoy, citas por validar, callbacks pendientes, disponibilidad hoy, exportar csv.',
                'info'
            ),
            !0
        );
    if (n.includes('exportar') && n.includes('csv'))
        return (
            await zn('appointments', { focus: !1 }),
            mt(),
            Un('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await zn('dashboard'), !0);
    if (n.includes('resena') || n.includes('review'))
        return (await zn('reviews'), !0);
    if (n.includes('callback'))
        return (
            await Gn(
                n.includes('hoy')
                    ? 'today'
                    : n.includes('contactado')
                      ? 'contacted'
                      : 'pending'
            ),
            !0
        );
    if (n.includes('cita') || n.includes('agenda')) {
        const e = n.includes('hoy')
            ? 'today'
            : n.includes('validar') ||
                n.includes('transferencia') ||
                n.includes('por validar')
              ? 'pending_transfer'
              : n.includes('no show') || n.includes('no asistio')
                ? 'no_show'
                : 'all';
        return (await Vn(e), n.includes('limpiar') && dt(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await zn('availability', { focus: !1 }),
          n.includes('hoy')
              ? Qt()
              : n.includes('siguiente')
                ? Zt()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  Xt(),
          Un('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await Kn({ showSuccessToast: !0 }), !0)
          : (S(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function Jn(e) {
    const t = document.getElementById('pageTitle');
    (t &&
        (t.textContent =
            {
                dashboard: 'Dashboard',
                appointments: 'Citas',
                callbacks: 'Callbacks',
                reviews: 'Resenas',
                availability: 'Disponibilidad',
            }[e] || 'Dashboard'),
        Pn(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const i = document.getElementById(e);
    switch ((i && i.classList.add('active'), e)) {
        case 'dashboard':
        default:
            U();
            break;
        case 'appointments':
            ct();
            break;
        case 'callbacks':
            (re(),
                pe(),
                ge({
                    filter: te().filterSelect?.value || W.filter,
                    sort: te().sortSelect?.value || W.sort,
                    search: te().searchInput?.value || W.search,
                }));
            break;
        case 'reviews':
            !(function () {
                const e =
                    n.length > 0
                        ? (
                              n.reduce(
                                  (e, t) => e + (Number(t.rating) || 0),
                                  0
                              ) / n.length
                          ).toFixed(1)
                        : '0.0';
                ((document.getElementById('adminAvgRating').textContent = e),
                    (document.getElementById('totalReviewsCount').textContent =
                        `${n.length} reseñas`));
                const t = document.getElementById('adminRatingStars'),
                    a = Math.floor(Number(e));
                t.innerHTML = '';
                for (let e = 1; e <= 5; e += 1) {
                    const n = document.createElement('i');
                    ((n.className = e <= a ? 'fas fa-star' : 'far fa-star'),
                        t.appendChild(n));
                }
                const o = document.getElementById('reviewsGrid');
                0 !== n.length
                    ? (o.innerHTML = n
                          .slice()
                          .sort((e, t) =>
                              String(t.date || '').localeCompare(
                                  String(e.date || '')
                              )
                          )
                          .map(
                              (e) =>
                                  `\n            <div class="review-card-admin">\n                <div class="review-header-admin">\n                    <strong>${v(e.name || 'Paciente')}</strong>\n                    ${e.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}\n                </div>\n                <div class="review-rating">${'★'.repeat(Number(e.rating) || 0)}${'☆'.repeat(5 - (Number(e.rating) || 0))}</div>\n                <p>${v(e.text || '')}</p>\n                <small>${v(new Date(e.date).toLocaleDateString('es-EC'))}</small>\n            </div>\n        `
                          )
                          .join(''))
                    : (o.innerHTML =
                          '<p class="empty-message">No hay reseñas registradas</p>');
            })();
            break;
        case 'availability':
            await (async function () {
                if (
                    (await (async function () {
                        try {
                            const e = await b('availability', {
                                    query: {
                                        doctor: 'indiferente',
                                        service: 'consulta',
                                        days: 45,
                                    },
                                }),
                                t =
                                    e && e.data && 'object' == typeof e.data
                                        ? e.data
                                        : {},
                                n =
                                    e && e.meta && 'object' == typeof e.meta
                                        ? e.meta
                                        : {},
                                i = o && 'object' == typeof o ? o : {},
                                r = {
                                    ...i,
                                    ...n,
                                    source: String(
                                        n.source || i.source || 'store'
                                    ),
                                    mode: String(n.mode || i.mode || 'live'),
                                    timezone: String(
                                        n.timezone ||
                                            i.timezone ||
                                            'America/Guayaquil'
                                    ),
                                    generatedAt: String(
                                        n.generatedAt ||
                                            i.generatedAt ||
                                            new Date().toISOString()
                                    ),
                                };
                            if (
                                (u(wt(t)),
                                m(r),
                                kt(a),
                                (gt = 'google' === String(r.source || '')),
                                Gt(),
                                Wt(),
                                pt && !$t(pt))
                            )
                                return ((pt = null), It(''), void Kt());
                            pt ? nn(pt) : Kt();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                S(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (gt = 'google' === String(o.source || '')),
                                Gt(),
                                Wt());
                        }
                    })(),
                    !pt)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(St);
                            return $t(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    $t(e) && (pt = e);
                }
                (pt && !$t(pt) && (pt = null),
                    pt && Rt(pt),
                    Jt(),
                    pt ? tn(pt, { persist: !1 }) : Kt());
            })();
    }
}
async function Yn() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = Bn();
    (Mn(n),
        Nn(n),
        An(),
        On(),
        await (async function () {
            const e = document.getElementById('currentDate');
            if (e) {
                const t = {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                };
                e.textContent = new Date().toLocaleDateString('es-EC', t);
            }
            try {
                (await N(), _n());
            } catch (e) {
                S(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = Cn();
            await Jn(t);
        })(),
        await (async function () {
            if (ve) return;
            ve = !0;
            const { subscribeBtn: e, testBtn: t } = ke();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return (Ee(!1), void Se('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await Ce(),
                        Ee(!0),
                        Se('disponible', 'muted'),
                        e.addEventListener('click', $e),
                        t.addEventListener('click', Ie),
                        await Le());
                } catch (e) {
                    (Ee(!1), Se('sin configurar', 'warn'));
                }
            }
        })());
}
async function Qn(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return y('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && g(t.csrfToken),
                S('Bienvenido al panel de administración', 'success'),
                await Yn());
        } catch {
            S('Código incorrecto o sesión expirada', 'error');
        }
        return;
    }
    const n = document.getElementById('adminPassword')?.value || '';
    try {
        const e = await (async function (e) {
            return y('login', { method: 'POST', body: { password: e } });
        })(n);
        if (e.twoFactorRequired) {
            (document
                .getElementById('passwordGroup')
                ?.classList.add('is-hidden'),
                t?.classList.remove('is-hidden'),
                document.getElementById('admin2FACode')?.focus());
            const e = document.getElementById('loginBtn');
            return (
                e && (e.innerHTML = '<i class="fas fa-check"></i> Verificar'),
                void S('Ingresa tu código 2FA', 'info')
            );
        }
        (e.csrfToken && g(e.csrfToken),
            S('Bienvenido al panel de administración', 'success'),
            await Yn());
    } catch {
        S('Contraseña incorrecta', 'error');
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    ((Ae = Re()),
        je(Ae, { persist: !1, animate: !1 }),
        (function () {
            if (Ne) return;
            const e = He();
            e &&
                ('function' == typeof e.addEventListener
                    ? (e.addEventListener('change', Oe), (Ne = !0))
                    : 'function' == typeof e.addListener &&
                      (e.addListener(Oe), (Ne = !0)));
        })(),
        xe ||
            'function' != typeof window.addEventListener ||
            (window.addEventListener('storage', Ue), (xe = !0)),
        (function () {
            document.addEventListener('click', async (o) => {
                const i = o.target.closest('[data-action]');
                if (!i) return;
                const r = i.dataset.action;
                if ('close-toast' !== r) {
                    if ('logout' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                try {
                                    await y('logout', { method: 'POST' });
                                } catch (e) {}
                                (S('Sesion cerrada correctamente', 'info'),
                                    setTimeout(
                                        () => window.location.reload(),
                                        800
                                    ));
                            })())
                        );
                    if ('export-data' === r)
                        return (
                            o.preventDefault(),
                            void (function () {
                                const o = {
                                        appointments: e,
                                        callbacks: t,
                                        reviews: n,
                                        availability: a,
                                        exportDate: new Date().toISOString(),
                                    },
                                    i = new Blob([JSON.stringify(o, null, 2)], {
                                        type: 'application/json',
                                    }),
                                    r = URL.createObjectURL(i),
                                    s = document.createElement('a');
                                ((s.href = r),
                                    (s.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`),
                                    document.body.appendChild(s),
                                    s.click(),
                                    document.body.removeChild(s),
                                    URL.revokeObjectURL(r),
                                    S(
                                        'Datos exportados correctamente',
                                        'success'
                                    ));
                            })()
                        );
                    if ('open-import-file' === r)
                        return (
                            o.preventDefault(),
                            void document
                                .getElementById('importFileInput')
                                ?.click()
                        );
                    if ('set-admin-theme' === r)
                        return (
                            o.preventDefault(),
                            void je(i.dataset.themeMode || 'system', {
                                persist: !0,
                                animate: !0,
                            })
                        );
                    if ('toggle-sidebar-collapse' === r)
                        return (
                            o.preventDefault(),
                            Ln() ? void jn(!$n()) : void Tn(!In())
                        );
                    if ('run-admin-command' === r) {
                        o.preventDefault();
                        const e = document.getElementById('adminQuickCommand');
                        return void (await Wn(
                            e instanceof HTMLInputElement ? e.value : ''
                        ));
                    }
                    if ('refresh-admin-data' === r)
                        return (
                            o.preventDefault(),
                            void (await Kn({ showSuccessToast: !0 }))
                        );
                    if ('context-open-dashboard' === r)
                        return (
                            o.preventDefault(),
                            void (await zn('dashboard'))
                        );
                    if ('context-open-appointments-today' === r)
                        return (o.preventDefault(), void (await Vn('today')));
                    if ('context-open-appointments-transfer' === r)
                        return (
                            o.preventDefault(),
                            void (await Vn('pending_transfer'))
                        );
                    if ('context-open-callbacks-pending' === r)
                        return (o.preventDefault(), void (await Gn('pending')));
                    if ('context-open-callbacks-next' === r)
                        return (
                            o.preventDefault(),
                            await Gn('pending'),
                            void ye()
                        );
                    if ('context-focus-slot-input' === r)
                        return (
                            o.preventDefault(),
                            await zn('availability', { focus: !1 }),
                            void Xt()
                        );
                    if ('context-availability-today' === r)
                        return (
                            o.preventDefault(),
                            await zn('availability', { focus: !1 }),
                            void Qt()
                        );
                    if ('context-availability-next' === r)
                        return (
                            o.preventDefault(),
                            await zn('availability', { focus: !1 }),
                            void Zt()
                        );
                    if ('context-copy-availability-day' === r)
                        return (
                            o.preventDefault(),
                            await zn('availability', { focus: !1 }),
                            void ln()
                        );
                    try {
                        if ('export-csv' === r)
                            return (o.preventDefault(), void mt());
                        if ('appointment-quick-filter' === r)
                            return (
                                o.preventDefault(),
                                void lt(i.dataset.filterValue || 'all')
                            );
                        if ('callback-quick-filter' === r)
                            return (
                                o.preventDefault(),
                                void he(i.dataset.filterValue || 'all')
                            );
                        if ('callbacks-triage-next' === r)
                            return (
                                o.preventDefault(),
                                await Gn('pending'),
                                void ye()
                            );
                        if ('clear-appointment-filters' === r)
                            return (o.preventDefault(), void dt());
                        if ('clear-callback-filters' === r)
                            return (
                                o.preventDefault(),
                                void ge(
                                    { filter: z, sort: V, search: '' },
                                    { preserveSearch: !1 }
                                )
                            );
                        if ('appointment-density' === r)
                            return (
                                o.preventDefault(),
                                void (function (e) {
                                    const t = nt(e);
                                    (ot(t),
                                        at(Ve, t),
                                        Boolean(
                                            document.getElementById(
                                                'appointmentsTableBody'
                                            )
                                        ) && st());
                                })(i.dataset.density || 'comfortable')
                            );
                        if ('change-month' === r)
                            return (
                                o.preventDefault(),
                                void Yt(Number(i.dataset.delta || 0))
                            );
                        if ('availability-today' === r)
                            return (o.preventDefault(), void Qt());
                        if ('availability-next-with-slots' === r)
                            return (o.preventDefault(), void Zt());
                        if ('prefill-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (function (e) {
                                    if (gt)
                                        return void S(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    const t =
                                        document.getElementById('newSlotTime');
                                    t instanceof HTMLInputElement &&
                                        ((t.value = String(e || '').trim()),
                                        t.focus());
                                })(i.dataset.time || '')
                            );
                        if ('copy-availability-day' === r)
                            return (o.preventDefault(), void ln());
                        if ('paste-availability-day' === r)
                            return (o.preventDefault(), void (await dn()));
                        if ('duplicate-availability-day-next' === r)
                            return (o.preventDefault(), void (await un()));
                        if ('duplicate-availability-next-week' === r)
                            return (o.preventDefault(), void (await mn()));
                        if ('clear-availability-day' === r)
                            return (o.preventDefault(), void (await pn()));
                        if ('clear-availability-week' === r)
                            return (o.preventDefault(), void (await fn()));
                        if ('save-availability-draft' === r)
                            return (o.preventDefault(), void (await rn()));
                        if ('discard-availability-draft' === r)
                            return (o.preventDefault(), void sn());
                        if ('add-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function () {
                                    if (gt)
                                        return void S(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    if (!pt)
                                        return void S(
                                            'Selecciona una fecha primero',
                                            'warning'
                                        );
                                    const e =
                                        document.getElementById('newSlotTime');
                                    if (!(e instanceof HTMLInputElement))
                                        return;
                                    const t = String(e.value || '').trim();
                                    if (!t)
                                        return void S(
                                            'Ingresa un horario',
                                            'warning'
                                        );
                                    const n = At(a[pt] || []);
                                    n.includes(t)
                                        ? S('Este horario ya existe', 'warning')
                                        : (on(() => {
                                              _t(pt, [...n, t]);
                                          }),
                                          (e.value = ''),
                                          S(
                                              'Horario agregado a cambios pendientes',
                                              'success'
                                          ));
                                })())
                            );
                        if ('remove-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e, t) {
                                    if (gt)
                                        return void S(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    const n = String(e || '').trim(),
                                        o = String(t || '').trim();
                                    if (!$t(n) || !o)
                                        return void S(
                                            'No se pudo identificar el horario a eliminar',
                                            'warning'
                                        );
                                    const i = At(a[n] || []),
                                        r = i.filter((e) => e !== o);
                                    r.length !== i.length
                                        ? (on(() => {
                                              _t(n, r);
                                          }),
                                          S(
                                              'Horario eliminado de cambios pendientes',
                                              'success'
                                          ))
                                        : S(
                                              'El horario ya no existe en el borrador',
                                              'info'
                                          );
                                })(
                                    decodeURIComponent(i.dataset.date || ''),
                                    decodeURIComponent(i.dataset.time || '')
                                ))
                            );
                        if ('approve-transfer' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Aprobar el comprobante de transferencia de esta cita?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await b('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        paymentStatus: 'paid',
                                                        paymentPaidAt:
                                                            new Date().toISOString(),
                                                    },
                                                }),
                                                    await N(),
                                                    ct(),
                                                    U(),
                                                    S(
                                                        'Transferencia aprobada',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                S(
                                                    `No se pudo aprobar: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else S('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('reject-transfer' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await b('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        paymentStatus: 'failed',
                                                    },
                                                }),
                                                    await N(),
                                                    ct(),
                                                    U(),
                                                    S(
                                                        'Transferencia rechazada',
                                                        'warning'
                                                    ));
                                            } catch (e) {
                                                S(
                                                    `No se pudo rechazar: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else S('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('cancel-appointment' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Estas seguro de cancelar esta cita?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await b('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        status: 'cancelled',
                                                    },
                                                }),
                                                    await N(),
                                                    ct(),
                                                    U(),
                                                    S(
                                                        'Cita cancelada correctamente',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                S(
                                                    `No se pudo cancelar la cita: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else S('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('mark-no-show' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            'Marcar esta cita como "No asistio"?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await b('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        status: 'no_show',
                                                    },
                                                }),
                                                    await N(),
                                                    ct(),
                                                    U(),
                                                    S(
                                                        'Cita marcada como no asistio',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                S(
                                                    `No se pudo marcar no-show: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else S('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        'mark-contacted' === r &&
                            (o.preventDefault(),
                            await (async function (e, n = '') {
                                let a = null;
                                const o = Number(e);
                                o > 0 &&
                                    (a = t.find((e) => Number(e.id) === o));
                                const i = n ? decodeURIComponent(n) : '';
                                if (
                                    (!a &&
                                        i &&
                                        (a = t.find((e) => e.fecha === i)),
                                    a)
                                )
                                    try {
                                        Z.delete(oe(a));
                                        const e = a.id || Date.now();
                                        (a.id || (a.id = e),
                                            await b('callbacks', {
                                                method: 'PATCH',
                                                body: {
                                                    id: Number(e),
                                                    status: 'contactado',
                                                },
                                            }),
                                            await N(),
                                            ge({
                                                filter: W.filter,
                                                sort: W.sort,
                                                search: W.search,
                                            }),
                                            U(),
                                            S(
                                                'Marcado como contactado',
                                                'success'
                                            ));
                                    } catch (e) {
                                        S(
                                            `No se pudo actualizar callback: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else S('Callback no encontrado', 'error');
                            })(
                                Number(i.dataset.callbackId || 0),
                                i.dataset.callbackDate || ''
                            ));
                    } catch (e) {
                        S(`Error ejecutando accion: ${e.message}`, 'error');
                    }
                } else i.closest('.toast')?.remove();
            });
            const o = document.getElementById('appointmentFilter');
            o &&
                o.addEventListener('change', () => {
                    st();
                });
            const i = document.getElementById('searchAppointments');
            i &&
                i.addEventListener('input', () => {
                    st();
                });
            const r = document.getElementById('appointmentSort');
            r &&
                r.addEventListener('change', () => {
                    !(function (e) {
                        const t = tt(e),
                            { sortSelect: n } = Xe();
                        (n && (n.value = t), at(ze, t), st());
                    })(r.value || 'datetime_desc');
                });
            const s = document.getElementById('callbackFilter');
            s && s.addEventListener('change', fe);
            const c = document.getElementById('searchCallbacks');
            c && c.addEventListener('input', be);
            const l = document.getElementById('adminQuickCommand');
            l instanceof HTMLInputElement &&
                l.addEventListener('keydown', async (e) => {
                    'Enter' === e.key &&
                        (e.preventDefault(), await Wn(l.value));
                });
        })(),
        (function () {
            const e = { sort: tt(A(ze, Ge)), density: nt(A(Ve, Ke)) },
                { sortSelect: t } = Xe();
            (t && (t.value = e.sort), ot(e.density));
        })(),
        wn ||
            (wn = window.setInterval(() => {
                xn();
            }, 3e4)),
        xn(),
        Pn(Bn()),
        An());
    const o = document.getElementById('loginForm');
    (o && o.addEventListener('submit', Qn),
        kn().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await zn(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                Ln() ? jn(!$n()) : Tn(!In());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => On({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => On({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!Ln() || !$n()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = qn();
                if (0 === n.length) return (e.preventDefault(), void t.focus());
                const a = n[0],
                    o = n[n.length - 1],
                    i = document.activeElement;
                i instanceof HTMLElement && t.contains(i)
                    ? e.shiftKey && i === a
                        ? (e.preventDefault(), o.focus())
                        : e.shiftKey ||
                          i !== o ||
                          (e.preventDefault(), a.focus())
                    : (e.preventDefault(), (e.shiftKey ? o : a).focus());
            })(e),
                'Escape' !== e.key
                    ? (function (e) {
                          const t = document.getElementById('adminDashboard');
                          if (!t || t.classList.contains('is-hidden')) return;
                          const n =
                              (a = e.target) instanceof HTMLElement &&
                              (!!a.isContentEditable ||
                                  Boolean(
                                      a.closest(
                                          'input, textarea, select, [contenteditable="true"]'
                                      )
                                  ));
                          var a;
                          const o = String(e.key || '').toLowerCase(),
                              i = String(e.code || '').toLowerCase();
                          if (
                              (e.ctrlKey || e.metaKey) &&
                              'k' === o &&
                              !e.altKey &&
                              !e.shiftKey
                          )
                              return (e.preventDefault(), void Hn());
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              document
                                  .getElementById('appointments')
                                  ?.classList.contains('active') &&
                              !n
                          )
                              return (
                                  e.preventDefault(),
                                  void (function () {
                                      const { searchInput: e } = Xe();
                                      e instanceof HTMLInputElement &&
                                          (e.focus({ preventScroll: !0 }),
                                          e.select());
                                  })()
                              );
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              document
                                  .getElementById('callbacks')
                                  ?.classList.contains('active') &&
                              !n
                          )
                              return (
                                  e.preventDefault(),
                                  void (function () {
                                      const e = te().searchInput;
                                      e instanceof HTMLInputElement &&
                                          (e.focus({ preventScroll: !0 }),
                                          e.select());
                                  })()
                              );
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              en() &&
                              !n
                          )
                              return (e.preventDefault(), void Xt());
                          if (
                              !(
                                  '/' !== e.key ||
                                  e.altKey ||
                                  e.ctrlKey ||
                                  e.metaKey ||
                                  n
                              )
                          )
                              return (e.preventDefault(), void Hn());
                          if (!e.altKey || !e.shiftKey) return;
                          if (n) return;
                          if ('keyr' === i)
                              return (
                                  e.preventDefault(),
                                  void Kn({ showSuccessToast: !0 })
                              );
                          if ('m' === o || 'keym' === i)
                              return (
                                  e.preventDefault(),
                                  Ln() ? void jn(!$n()) : void Tn(!In())
                              );
                          if (en()) {
                              if ('ArrowLeft' === e.key)
                                  return (e.preventDefault(), void Yt(-1));
                              if ('ArrowRight' === e.key)
                                  return (e.preventDefault(), void Yt(1));
                              if ('keyy' === i)
                                  return (e.preventDefault(), void Qt());
                              if ('keys' === i)
                                  return (e.preventDefault(), void Zt());
                              if ('keyd' === i)
                                  return (e.preventDefault(), void un());
                              if ('keyw' === i)
                                  return (e.preventDefault(), void mn());
                              if ('keyv' === i)
                                  return (e.preventDefault(), void dn());
                              if ('keyx' === i)
                                  return (e.preventDefault(), void pn());
                              if ('keyq' === i)
                                  return (e.preventDefault(), void fn());
                              if ('keyg' === i)
                                  return (e.preventDefault(), void rn());
                              if ('keyz' === i)
                                  return (e.preventDefault(), void sn());
                          }
                          const r =
                              {
                                  keya: 'all',
                                  keyh: 'today',
                                  keyt: 'pending_transfer',
                                  keyn: 'no_show',
                              }[i] || null;
                          if (r) return (e.preventDefault(), void Vn(r));
                          const s =
                              { keyp: 'pending', keyc: 'contacted' }[i] || null;
                          if (s) return (e.preventDefault(), void Gn(s));
                          const c = gn.get(i) || gn.get(o);
                          c && (e.preventDefault(), zn(c));
                      })(e)
                    : On({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (Ln() || On(), An(), Fn($n()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await zn(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return En(
                            window.location.hash.replace(/^#/, '').trim(),
                            e
                        );
                    })({ fallback: 'dashboard' }),
                    {
                        refresh: !1,
                        updateHash: !1,
                        focus: !1,
                        closeMobileNav: !1,
                    }
                ));
        }));
    const i = document.getElementById('importFileInput');
    (i &&
        i.addEventListener('change', () =>
            (async function (e) {
                const t = e.files && e.files[0];
                if (
                    t &&
                    ((e.value = ''),
                    confirm(
                        'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
                    ))
                )
                    try {
                        const e = await t.text(),
                            n = JSON.parse(e);
                        if (!n || 'object' != typeof n)
                            throw new Error(
                                'El archivo no contiene datos validos'
                            );
                        const a = {
                            appointments: Array.isArray(n.appointments)
                                ? n.appointments
                                : [],
                            callbacks: Array.isArray(n.callbacks)
                                ? n.callbacks
                                : [],
                            reviews: Array.isArray(n.reviews) ? n.reviews : [],
                            availability:
                                n.availability &&
                                'object' == typeof n.availability
                                    ? n.availability
                                    : {},
                        };
                        (await b('import', { method: 'POST', body: a }),
                            await N(),
                            _n());
                        const o = document.querySelector('.nav-item.active');
                        (await Jn(o?.dataset.section || 'dashboard'),
                            S(
                                `Datos importados: ${a.appointments.length} citas`,
                                'success'
                            ));
                    } catch (e) {
                        S(`Error al importar: ${e.message}`, 'error');
                    }
            })(i)
        ),
        window.addEventListener('online', async () => {
            (await Kn({ showSuccessToast: !1, showErrorToast: !1 }))
                ? S('Conexion restaurada. Datos actualizados.', 'success')
                : S(
                      'Conexion restaurada, pero no se pudieron refrescar datos.',
                      'warning'
                  );
        }),
        Fn(!1),
        Dn(In()),
        await (async function () {
            if (!navigator.onLine && A('appointments', null))
                return (
                    S('Modo offline: mostrando datos locales', 'info'),
                    void (await Yn())
                );
            (await (async function () {
                try {
                    const e = await y('status');
                    return (
                        !!e.authenticated && (e.csrfToken && g(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (S('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await Yn()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (On(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })());
});
