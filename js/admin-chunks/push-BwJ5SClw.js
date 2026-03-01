function t(t) {
    return String(t ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function e(t, e = document) {
    return e.querySelector(t);
}
function n(t, e = document) {
    return Array.from(e.querySelectorAll(t));
}
function a(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime())
        ? String(t || '')
        : e.toLocaleDateString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
function o(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime())
        ? String(t || '')
        : e.toLocaleString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          });
}
function i(t) {
    const e = Number(t || 0);
    return Number.isFinite(e) ? Math.round(e).toLocaleString('es-EC') : '0';
}
function s(n, a = 'info') {
    const o = e('#toastContainer');
    if (!(o instanceof HTMLElement)) return;
    const i = document.createElement('div');
    ((i.className = `toast ${a}`),
        i.setAttribute('role', 'error' === a ? 'alert' : 'status'),
        (i.innerHTML = `\n        <div class="toast-body">${t(n)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        o.appendChild(i),
        window.setTimeout(() => {
            i.parentElement && i.remove();
        }, 4500));
}
function r(t, n) {
    const a = e(t);
    a && (a.textContent = String(n ?? ''));
}
function c(t, n) {
    const a = e(t);
    a && (a.innerHTML = n);
}
function l() {
    const t = document.activeElement;
    return (
        t instanceof HTMLElement &&
        Boolean(
            t.closest(
                'input, textarea, select, [contenteditable="true"], [role="textbox"]'
            )
        )
    );
}
function u(t) {
    const e = t instanceof Date ? t : new Date(t || '');
    return Number.isNaN(e.getTime())
        ? ''
        : `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
const d = new Set(),
    p = {
        auth: {
            authenticated: !1,
            csrfToken: '',
            requires2FA: !1,
            lastAuthAt: 0,
            authMethod: '',
        },
        ui: {
            activeSection: 'dashboard',
            sidebarCollapsed: !1,
            sidebarOpen: !1,
            themeMode: 'system',
            theme: 'light',
            lastRefreshAt: 0,
        },
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {},
            availabilityMeta: {},
            queueTickets: [],
            queueMeta: null,
            funnelMetrics: null,
            health: null,
        },
        appointments: {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        callbacks: {
            filter: 'all',
            sort: 'recent_desc',
            search: '',
            selected: [],
        },
        availability: {
            monthAnchor: new Date(),
            selectedDate: '',
            draft: {},
            draftDirty: !1,
            clipboard: [],
            clipboardDate: '',
            lastAction: '',
        },
        queue: {
            filter: 'all',
            search: '',
            helpOpen: !1,
            oneTap: !1,
            practiceMode: !1,
            customCallKey: null,
            captureCallKeyMode: !1,
            stationMode: 'free',
            stationConsultorio: 1,
            selected: [],
            fallbackPartial: !1,
            syncMode: 'live',
            pendingSensitiveAction: null,
            activity: [],
        },
    };
let m = structuredClone(p);
function f() {
    return m;
}
function g(t) {
    const e = t(m);
    e &&
        ((m = e),
        d.forEach((t) => {
            try {
                t(m);
            } catch (t) {}
        }));
}
const h = {
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
};
function b(t) {
    const {
        navigateToSection: e,
        focusQuickCommand: n,
        focusCurrentSearch: a,
        runQuickAction: o,
        closeSidebar: i,
        toggleMenu: s,
        dismissQueueSensitiveDialog: r,
        toggleQueueHelp: c,
        queueNumpadAction: u,
    } = t;
    window.addEventListener('keydown', (t) => {
        const d = String(t.key || '').toLowerCase(),
            p = String(t.code || '').toLowerCase();
        if ('Escape' === t.key) {
            if ('function' == typeof r && r()) return;
            return void i();
        }
        if (t.ctrlKey && !t.shiftKey && !t.altKey && 'k' === d)
            return (t.preventDefault(), void n());
        if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
            return (t.preventDefault(), void a());
        if (t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey) {
            const n = p || d;
            if ('keym' === n) return (t.preventDefault(), void s());
            if ('digit0' === n) return (t.preventDefault(), void c());
            if (h[n]) {
                if (l()) return;
                return (t.preventDefault(), void e(h[n]));
            }
            const a = {
                keyt: 'appointments_pending_transfer',
                keya: 'appointments_all',
                keyn: 'appointments_no_show',
                keyp: 'callbacks_pending',
                keyc: 'callbacks_contacted',
                keyu: 'callbacks_sla_urgent',
                keyw: 'queue_sla_risk',
                keyl: 'queue_call_next',
            };
            if (
                ('queue' === f().ui.activeSection &&
                    Object.assign(a, {
                        keyw: 'queue_waiting',
                        keyc: 'queue_called',
                        keya: 'queue_all',
                        keyo: 'queue_all',
                        keyl: 'queue_sla_risk',
                    }),
                a[n])
            ) {
                if (l()) return;
                return (t.preventDefault(), void o(a[n]));
            }
        }
        const m = f().queue,
            g = Boolean(m.captureCallKeyMode),
            b = m.customCallKey,
            y =
                b &&
                'object' == typeof b &&
                String(b.key || '') === String(t.key || '') &&
                String(b.code || '').toLowerCase() === p &&
                Number(b.location || 0) === Number(t.location || 0);
        if (
            p.startsWith('numpad') ||
            3 === t.location ||
            ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(p) ||
            g ||
            y
        ) {
            if (l()) return;
            Promise.resolve(
                u({ key: t.key, code: t.code, location: t.location })
            ).catch(() => {});
        }
    });
}
function y(t, e = '') {
    try {
        const n = localStorage.getItem(t);
        return null === n ? e : n;
    } catch (t) {
        return e;
    }
}
function v(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function w(t, e) {
    try {
        const n = localStorage.getItem(t);
        return n ? JSON.parse(n) : e;
    } catch (t) {
        return e;
    }
}
function k(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function S(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const C = 'themeMode',
    q = new Set(['light', 'dark', 'system']);
function A() {
    const t = String(y(C, 'system') || 'system')
        .trim()
        .toLowerCase();
    return q.has(t) ? t : 'system';
}
function $(t) {
    const e = q.has(t) ? t : 'system';
    v(C, e);
}
function M(t) {
    const e = (function (t) {
        return 'light' === t || 'dark' === t
            ? t
            : window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
    })(t);
    return (
        document.documentElement.setAttribute('data-theme-mode', t),
        document.documentElement.setAttribute('data-theme', e),
        e
    );
}
const T = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function _(t, e = 'dashboard') {
    const n = String(t || '')
        .trim()
        .toLowerCase();
    return T.has(n) ? n : e;
}
function N(t = 'dashboard') {
    return _(String(window.location.hash || '').replace(/^#/, ''), t);
}
function D(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            n = e ? `#${e}` : '';
        window.location.hash !== n &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${n}`
            );
    })(_(t));
}
let B = '';
async function E(t, e = {}) {
    const n = String(e.method || 'GET').toUpperCase(),
        a = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== n && B && (a.headers['X-CSRF-Token'] = B),
        void 0 !== e.body &&
            ((a.headers['Content-Type'] = 'application/json'),
            (a.body = JSON.stringify(e.body))));
    const o = await fetch(t, a),
        i = await o.text();
    let s;
    try {
        s = i ? JSON.parse(i) : {};
    } catch (t) {
        throw new Error(`Respuesta no valida (${o.status})`);
    }
    if (
        ((s = (function (t) {
            return t && 'object' == typeof t ? t : {};
        })(s)),
        !o.ok || !1 === s.ok)
    )
        throw new Error(s.error || s.message || `HTTP ${o.status}`);
    return s;
}
function L(t) {
    B = String(t || '');
}
async function I(t, e = {}) {
    return E(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function P(t, e = {}) {
    return E(`/admin-auth.php?action=${encodeURIComponent(t)}`, e);
}
async function H() {
    try {
        const t = await P('status'),
            e = !0 === t.authenticated,
            n = e ? String(t.csrfToken || '') : '';
        return (
            L(n),
            g((t) => ({
                ...t,
                auth: {
                    ...t.auth,
                    authenticated: e,
                    csrfToken: n,
                    requires2FA: !1,
                    lastAuthAt: e ? Date.now() : 0,
                    authMethod: e ? 'session' : '',
                },
            })),
            e
        );
    } catch (t) {
        return !1;
    }
}
async function O(t) {
    const e = String(t || '').trim();
    if (!e) throw new Error('Contrasena requerida');
    const n = await P('login', { method: 'POST', body: { password: e } });
    if (!0 === n.twoFactorRequired)
        return (
            g((t) => ({
                ...t,
                auth: { ...t.auth, requires2FA: !0, authMethod: 'password' },
            })),
            { authenticated: !1, requires2FA: !0 }
        );
    const a = String(n.csrfToken || '');
    return (
        L(a),
        g((t) => ({
            ...t,
            auth: {
                ...t.auth,
                authenticated: !0,
                csrfToken: a,
                requires2FA: !1,
                lastAuthAt: Date.now(),
                authMethod: 'password',
            },
        })),
        { authenticated: !0, requires2FA: !1 }
    );
}
async function x(t) {
    const e = String(t || '').trim();
    if (!e) throw new Error('Codigo 2FA requerido');
    const n = await P('login-2fa', { method: 'POST', body: { code: e } }),
        a = String(n.csrfToken || '');
    return (
        L(a),
        g((t) => ({
            ...t,
            auth: {
                ...t.auth,
                authenticated: !0,
                csrfToken: a,
                requires2FA: !1,
                lastAuthAt: Date.now(),
                authMethod: '2fa',
            },
        })),
        { authenticated: !0 }
    );
}
async function j() {
    try {
        await P('logout', { method: 'POST' });
    } catch (t) {}
    (L(''),
        g((t) => ({
            ...t,
            auth: {
                ...t.auth,
                authenticated: !1,
                csrfToken: '',
                requires2FA: !1,
                lastAuthAt: 0,
                authMethod: '',
            },
        })));
}
const F = {
    dashboard:
        '<path d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6zm10 0h8v-6h-8v6z"/>',
    appointments: '<path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 8H6v10h14V10z"/>',
    callbacks:
        '<path d="M6.6 10.8c1.4 2.8 3.7 5.2 6.5 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1.3.4 2.7.6 4.1.6.7 0 1.2.6 1.2 1.2V21c0 .7-.6 1.2-1.2 1.2C10.8 22.2 1.8 13.2 1.8 2.4 1.8 1.8 2.4 1.2 3 1.2h4.2c.7 0 1.2.6 1.2 1.2 0 1.4.2 2.8.6 4.1.1.4 0 .9-.3 1.2l-2.1 2.1z"/>',
    reviews:
        '<path d="m12 17.3-6.2 3.6 1.6-6.9L2 9.4l7.1-.6L12 2l2.9 6.8 7.1.6-5.4 4.6 1.6 6.9z"/>',
    availability:
        '<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 11h5v2h-7V7h2v6z"/>',
    queue: '<path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z"/>',
    menu: '<path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>',
    logout: '<path d="M10 17v-2h6V9h-6V7h8v10h-8zM4 19V5h8v2H6v10h6v2H4zm13.6-5L14 10.4l1.4-1.4 6 6-6 6-1.4-1.4 3.6-3.6H9v-2h8.6z"/>',
    sun: '<path d="M6.8 4.2 5.4 2.8 4 4.2l1.4 1.4 1.4-1.4zm10.8 0 1.4-1.4-1.4-1.4-1.4 1.4 1.4 1.4zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0-6h-2v3h2V0zm0 21h-2v3h2v-3zM0 11v2h3v-2H0zm21 0v2h3v-2h-3zM5.4 20.6 4 22l1.4 1.4 1.4-1.4-1.4-1.4zm13.2 0-1.4 1.4 1.4 1.4 1.4-1.4-1.4-1.4z"/>',
    moon: '<path d="M14.5 2.5a9 9 0 1 0 7 14.5 8 8 0 1 1-7-14.5z"/>',
    system: '<path d="M3 4h18v12H3V4zm2 2v8h14V6H5zm-2 12h18v2H3v-2z"/>',
};
function z(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${F[t] || F.menu}</svg>`;
}
const R = 'appointments',
    K = 'callbacks',
    V = 'reviews',
    U = 'availability',
    Q = 'availability-meta',
    J = 'queue-tickets',
    W = 'queue-meta',
    G = 'health-status';
function Y(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function Z(t) {
    g((e) => {
        return {
            ...e,
            data: {
                ...e.data,
                appointments: t.appointments || [],
                callbacks:
                    ((n = t.callbacks || []),
                    (Array.isArray(n) ? n : []).map((t) => ({
                        ...t,
                        status: String(t.status || '')
                            .toLowerCase()
                            .includes('contact')
                            ? 'contacted'
                            : 'pending',
                    }))),
                reviews: t.reviews || [],
                availability: t.availability || {},
                availabilityMeta: t.availabilityMeta || {},
                queueTickets: t.queueTickets || [],
                queueMeta: t.queueMeta || null,
                funnelMetrics: t.funnelMetrics || e.data.funnelMetrics,
                health: t.health || null,
            },
            ui: { ...e.ui, lastRefreshAt: Date.now() },
        };
        var n;
    });
}
async function X() {
    try {
        const [t, e] = await Promise.all([
                I('data'),
                I('health').catch(() => null),
            ]),
            n = t.data || {};
        let a = n.funnelMetrics || null;
        if (!a) {
            const t = await I('funnel-metrics').catch(() => null);
            a = t?.data || null;
        }
        const o = {
            appointments: Array.isArray(n.appointments) ? n.appointments : [],
            callbacks: Array.isArray(n.callbacks) ? n.callbacks : [],
            reviews: Array.isArray(n.reviews) ? n.reviews : [],
            availability:
                n.availability && 'object' == typeof n.availability
                    ? n.availability
                    : {},
            availabilityMeta:
                n.availabilityMeta && 'object' == typeof n.availabilityMeta
                    ? n.availabilityMeta
                    : {},
            queueTickets: Y(n),
            queueMeta:
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : n.queue_state && 'object' == typeof n.queue_state
                      ? n.queue_state
                      : null,
            funnelMetrics: a,
            health: e && e.ok ? e : null,
        };
        return (
            Z(o),
            (function (t) {
                (k(R, t.appointments || []),
                    k(K, t.callbacks || []),
                    k(V, t.reviews || []),
                    k(U, t.availability || {}),
                    k(Q, t.availabilityMeta || {}),
                    k(J, t.queueTickets || []),
                    k(W, t.queueMeta || null),
                    k(G, t.health || null));
            })(o),
            !0
        );
    } catch (t) {
        return (
            Z({
                appointments: w(R, []),
                callbacks: w(K, []),
                reviews: w(V, []),
                availability: w(U, {}),
                availabilityMeta: w(Q, {}),
                queueTickets: w(J, []),
                queueMeta: w(W, null),
                health: w(G, null),
                funnelMetrics: {
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
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            }),
            !1
        );
    }
}
function tt() {
    const t = f(),
        e = Number(t.ui.lastRefreshAt || 0);
    if (!e) return 'Datos: sin sincronizar';
    const n = Math.max(0, Math.round((Date.now() - e) / 1e3));
    return n < 60 ? `Datos: hace ${n}s` : `Datos: hace ${Math.round(n / 60)}m`;
}
function et(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function nt(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function at(t) {
    return et(t.paymentStatus || t.payment_status || '');
}
function ot(t) {
    return et(t);
}
function it(t, e = '-') {
    const n = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return n
        ? n
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : e;
}
function st(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[et(t)] || it(t, 'Pendiente')
    );
}
function rt(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[et(t)] || it(t, 'Pendiente')
    );
}
function ct(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        n = Math.abs(e);
    return e < 0
        ? n < 60
            ? `Hace ${n} min`
            : n < 1440
              ? `Hace ${Math.round(n / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function lt(t) {
    const e = nt(t);
    if (!e) return !1;
    const n = new Date(e),
        a = new Date();
    return (
        n.getFullYear() === a.getFullYear() &&
        n.getMonth() === a.getMonth() &&
        n.getDate() === a.getDate()
    );
}
function ut(t) {
    const e = nt(t);
    if (!e) return !1;
    const n = e - Date.now();
    return n >= 0 && n <= 1728e5;
}
function dt(t) {
    const e = at(t),
        n = ot(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === n ||
        'cancelled' === n
    );
}
function pt(t, e) {
    const n = et(e);
    return 'pending_transfer' === n
        ? t.filter((t) => {
              const e = at(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === n
          ? t.filter(ut)
          : 'no_show' === n
            ? t.filter((t) => 'no_show' === ot(t.status))
            : 'triage_attention' === n
              ? t.filter(dt)
              : t;
}
function mt(t) {
    const e = t
        .filter((t) => pt([t], 'pending_transfer').length > 0)
        .sort((t, e) => nt(t) - nt(e))[0];
    if (e)
        return {
            item: e,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y libera la agenda antes del check-in.',
            tags: ['Pago por validar', 'WhatsApp listo'],
        };
    const n = t
        .filter((t) => 'no_show' === ot(t.status))
        .sort((t, e) => nt(t) - nt(e))[0];
    if (n)
        return {
            item: n,
            label: 'Incidencia abierta',
            hint: 'Confirma si requiere seguimiento o reprogramacion.',
            tags: ['No show', 'Seguimiento'],
        };
    const a = t.filter((t) => nt(t) > 0).sort((t, e) => nt(t) - nt(e))[0];
    return a
        ? {
              item: a,
              label: 'Siguiente ingreso',
              hint: 'Revisa contexto y deja la atencion preparada.',
              tags: ['Agenda viva'],
          }
        : {
              item: null,
              label: 'Sin foco activo',
              hint: 'Cuando entren citas accionables apareceran aqui.',
              tags: [],
          };
}
function ft(e) {
    return e.length
        ? e
              .map((e) => {
                  const n = nt(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">\n                        <div class="appointment-service">\n                            <strong>${t(it(e.service, 'Servicio pendiente'))}</strong>\n                            <span>Especialista: ${t(it(e.doctor, 'Sin asignar'))}</span>\n                            <small>${t(e.price || 'Sin tarifa')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(a(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(ct(n))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      e
                  ) {
                      const n = e.paymentStatus || e.payment_status || '',
                          a = String(
                              e.transferProofUrl ||
                                  e.transferProofURL ||
                                  e.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${t(
                          (function (t) {
                              const e = et(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(n)
                      )}">${t(st(n))}</span>\n            <small>Metodo: ${t(((o = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[et(o)] || it(o, 'Metodo no definido')))}</small>\n            ${a ? `<a href="${t(a)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var o;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const n = ot(e.status),
                          a = [];
                      return (
                          'pending_transfer_review' === at(e) &&
                              a.push('Transferencia en espera'),
                          'no_show' === n && a.push('Paciente ausente'),
                          'cancelled' === n && a.push('Bloqueo operativo'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${t(
                              (function (t) {
                                  const e = et(t);
                                  return 'completed' === e
                                      ? 'success'
                                      : 'cancelled' === e || 'no_show' === e
                                        ? 'danger'
                                        : 'pending' === e
                                          ? 'warning'
                                          : 'neutral';
                              })(n)
                          )}">${t(rt(n))}</span>\n            <small>${t(a[0] || 'Sin alertas abiertas')}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const n = Number(e.id || 0);
                      return `\n        <div class="table-actions">\n            <a href="https://wa.me/${encodeURIComponent(String(e.phone || '').replace(/\s+/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp de ${t(e.name || 'Paciente')}" title="WhatsApp para validar pago">WhatsApp</a>\n            <button type="button" data-action="approve-transfer" data-id="${n}">Aprobar</button>\n            <button type="button" data-action="reject-transfer" data-id="${n}">Rechazar</button>\n            <button type="button" data-action="mark-no-show" data-id="${n}">No show</button>\n            <button type="button" data-action="cancel-appointment" data-id="${n}">Cancelar</button>\n            <button type="button" data-action="context-open-appointments-transfer">Triage</button>\n        </div>\n    `;
                  })(e)}</td>\n                </tr>\n            `;
              })
              .join('')
        : '<tr class="table-empty-row"><td colspan="6">No hay resultados</td></tr>';
}
function gt() {
    let t = 'datetime_desc',
        e = 'comfortable';
    try {
        ((t = JSON.parse(
            localStorage.getItem('admin-appointments-sort') || '"datetime_desc"'
        )),
            (e = JSON.parse(
                localStorage.getItem('admin-appointments-density') ||
                    '"comfortable"'
            )));
    } catch (t) {}
    g((n) => ({
        ...n,
        appointments: {
            ...n.appointments,
            sort: 'string' == typeof t ? t : 'datetime_desc',
            density: 'string' == typeof e ? e : 'comfortable',
        },
    }));
}
function ht() {
    const e = f(),
        n = Array.isArray(e.data.appointments) ? e.data.appointments : [],
        o = (function (t, e) {
            const n = et(e),
                a = [...t];
            return 'patient_az' === n
                ? (a.sort((t, e) => et(t.name).localeCompare(et(e.name), 'es')),
                  a)
                : 'datetime_asc' === n
                  ? (a.sort((t, e) => nt(t) - nt(e)), a)
                  : (a.sort((t, e) => nt(e) - nt(t)), a);
        })(
            (function (t, e) {
                const n = et(e);
                return n
                    ? t.filter((t) =>
                          [
                              t.name,
                              t.email,
                              t.phone,
                              t.service,
                              t.doctor,
                              t.paymentStatus,
                              t.payment_status,
                          ].some((t) => et(t).includes(n))
                      )
                    : t;
            })(pt(n, e.appointments.filter), e.appointments.search),
            e.appointments.sort
        );
    (c('#appointmentsTableBody', ft(o)),
        r('#appointmentsToolbarMeta', `Mostrando ${o.length} de ${n.length}`));
    const i = [];
    ('all' !== et(e.appointments.filter) &&
        ('pending_transfer' === et(e.appointments.filter)
            ? i.push('Transferencias por validar')
            : 'triage_attention' === et(e.appointments.filter)
              ? i.push('Triage accionable')
              : 'upcoming_48h' === et(e.appointments.filter)
                ? i.push('Proximas 48h')
                : 'no_show' === et(e.appointments.filter)
                  ? i.push('No show')
                  : i.push(e.appointments.filter)),
        et(e.appointments.search) &&
            i.push(`Busqueda: ${e.appointments.search}`),
        'patient_az' === et(e.appointments.sort)
            ? i.push('Paciente (A-Z)')
            : 'datetime_asc' === et(e.appointments.sort) &&
              i.push('Fecha ascendente'),
        0 !== o.length ||
            ('all' === et(e.appointments.filter) &&
                !et(e.appointments.search)) ||
            i.push('Resultados: 0'),
        r(
            '#appointmentsToolbarState',
            i.length ? i.join(' | ') : 'Sin filtros activos'
        ));
    const s = document.getElementById('clearAppointmentsFiltersBtn');
    if (s) {
        const t =
            'all' !== et(e.appointments.filter) || et(e.appointments.search);
        s.classList.toggle('is-hidden', !t);
    }
    const l = document.getElementById('appointmentFilter');
    l instanceof HTMLSelectElement && (l.value = e.appointments.filter);
    const u = document.getElementById('appointmentSort');
    u instanceof HTMLSelectElement && (u.value = e.appointments.sort);
    const d = document.getElementById('searchAppointments');
    d instanceof HTMLInputElement &&
        d.value !== e.appointments.search &&
        (d.value = e.appointments.search);
    const p = document.getElementById('appointments');
    (p &&
        p.classList.toggle(
            'appointments-density-compact',
            'compact' === et(e.appointments.density)
        ),
        document
            .querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
            .forEach((t) => {
                const n = et(t.dataset.density) === et(e.appointments.density);
                t.classList.toggle('is-active', n);
            }),
        (function (t) {
            const e = et(t);
            document
                .querySelectorAll(
                    '.appointment-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const n = et(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', n);
                });
        })(e.appointments.filter),
        (function (t) {
            try {
                (localStorage.setItem(
                    'admin-appointments-sort',
                    JSON.stringify(t.sort)
                ),
                    localStorage.setItem(
                        'admin-appointments-density',
                        JSON.stringify(t.density)
                    ));
            } catch (t) {}
        })(e.appointments),
        (function (e, n, o) {
            (r('#appointmentsOpsPendingTransfer', e.pendingTransferCount),
                r(
                    '#appointmentsOpsPendingTransferMeta',
                    e.pendingTransferCount > 0
                        ? `${e.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                r('#appointmentsOpsUpcomingCount', e.upcomingCount),
                r(
                    '#appointmentsOpsUpcomingMeta',
                    e.upcomingCount > 0
                        ? `${e.upcomingCount} cita(s) bajo ventana inmediata`
                        : 'Sin presion inmediata'
                ),
                r('#appointmentsOpsNoShowCount', e.noShowCount),
                r(
                    '#appointmentsOpsNoShowMeta',
                    e.noShowCount > 0
                        ? `${e.noShowCount} caso(s) requieren seguimiento`
                        : 'Sin incidencias'
                ),
                r('#appointmentsOpsTodayCount', e.todayCount),
                r(
                    '#appointmentsOpsTodayMeta',
                    e.todayCount > 0
                        ? `${e.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ),
                r(
                    '#appointmentsDeckSummary',
                    o > 0
                        ? `${e.pendingTransferCount} transferencias, ${e.triageCount} frentes accionables y ${n} cita(s) visibles.`
                        : 'Sin citas cargadas.'
                ),
                r(
                    '#appointmentsWorkbenchHint',
                    e.pendingTransferCount > 0
                        ? 'Hay pagos por validar antes de liberar la agenda.'
                        : 'Triage, pagos y seguimiento sin salir de la mesa.'
                ));
            const i = document.getElementById('appointmentsDeckChip');
            i &&
                ((i.textContent =
                    e.pendingTransferCount > 0 || e.noShowCount > 0
                        ? 'Atencion operativa'
                        : 'Agenda estable'),
                i.setAttribute(
                    'data-state',
                    e.pendingTransferCount > 0 || e.noShowCount > 0
                        ? 'warning'
                        : 'success'
                ));
            const s = e.focus;
            if ((r('#appointmentsFocusLabel', s.label), !s.item))
                return (
                    r('#appointmentsFocusPatient', 'Sin citas activas'),
                    r(
                        '#appointmentsFocusMeta',
                        'Cuando entren citas accionables apareceran aqui.'
                    ),
                    r('#appointmentsFocusWindow', '-'),
                    r('#appointmentsFocusPayment', '-'),
                    r('#appointmentsFocusStatus', '-'),
                    r('#appointmentsFocusContact', '-'),
                    c('#appointmentsFocusTags', ''),
                    void r('#appointmentsFocusHint', s.hint)
                );
            const l = s.item;
            (r('#appointmentsFocusPatient', l.name || 'Sin nombre'),
                r(
                    '#appointmentsFocusMeta',
                    `${it(l.service, 'Servicio pendiente')} | ${a(l.date)} ${l.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', ct(nt(l))),
                r(
                    '#appointmentsFocusPayment',
                    st(l.paymentStatus || l.payment_status)
                ),
                r('#appointmentsFocusStatus', rt(l.status)),
                r('#appointmentsFocusContact', l.phone || 'Sin telefono'),
                c(
                    '#appointmentsFocusTags',
                    s.tags
                        .map(
                            (e) =>
                                `<span class="appointments-focus-tag">${t(e)}</span>`
                        )
                        .join('')
                ),
                r('#appointmentsFocusHint', s.hint));
        })(
            (function (t) {
                const e = pt(t, 'pending_transfer'),
                    n = pt(t, 'upcoming_48h'),
                    a = pt(t, 'no_show'),
                    o = pt(t, 'triage_attention'),
                    i = t.filter(lt);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: n.length,
                    noShowCount: a.length,
                    todayCount: i.length,
                    triageCount: o.length,
                    focus: mt(t),
                };
            })(n),
            o.length,
            n.length
        ));
}
function bt(t) {
    (g((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), ht());
}
function yt(t) {
    bt({ filter: et(t) || 'all' });
}
function vt(t) {
    bt({ search: String(t || '') });
}
function wt() {
    bt({ filter: 'all', search: '' });
}
function kt(t) {
    bt({ sort: et(t) || 'datetime_desc' });
}
function St(t) {
    bt({ density: 'compact' === et(t) ? 'compact' : 'comfortable' });
}
function Ct(t, e) {
    const n = Number(t || 0);
    (g((t) => {
        const a = (t.data.appointments || []).map((t) =>
            Number(t.id || 0) === n ? { ...t, ...e } : t
        );
        return { ...t, data: { ...t.data, appointments: a } };
    }),
        ht());
}
async function qt(t, e) {
    await I('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
async function At(t) {
    (await qt(t, { paymentStatus: 'paid' }), Ct(t, { paymentStatus: 'paid' }));
}
async function $t(t) {
    (await qt(t, { paymentStatus: 'failed' }),
        Ct(t, { paymentStatus: 'failed' }));
}
async function Mt(t) {
    (await qt(t, { status: 'no_show' }), Ct(t, { status: 'no_show' }));
}
async function Tt(t) {
    (await qt(t, { status: 'cancelled' }), Ct(t, { status: 'cancelled' }));
}
function _t() {
    const t = [
            [
                'id',
                'name',
                'service',
                'date',
                'time',
                'status',
                'payment_status',
            ],
            ...(f().data.appointments || []).map((t) => [
                t.id,
                t.name,
                t.service,
                t.date,
                t.time,
                t.status,
                t.paymentStatus || t.payment_status || '',
            ]),
        ]
            .map((t) =>
                t
                    .map((t) => `"${String(t ?? '').replace(/"/g, '""')}"`)
                    .join(',')
            )
            .join('\n'),
        e = new Blob([t], { type: 'text/csv;charset=utf-8' }),
        n = URL.createObjectURL(e),
        a = document.createElement('a');
    ((a.href = n),
        (a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
        document.body.appendChild(a),
        a.click(),
        a.remove(),
        URL.revokeObjectURL(n));
}
const Nt = 'admin-callbacks-sort',
    Dt = 'admin-callbacks-filter',
    Bt = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Et = new Set(['recent_desc', 'waiting_desc']);
function Lt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function It(t) {
    const e = Lt(t);
    return Bt.has(e) ? e : 'all';
}
function Pt(t) {
    const e = Lt(t);
    return Et.has(e) ? e : 'recent_desc';
}
function Ht(t) {
    const e = Lt(t);
    return 'contacted' === e ||
        'contactado' === e ||
        'completed' === e ||
        'done' === e ||
        'resolved' === e ||
        'called' === e ||
        'atendido' === e
        ? 'contacted'
        : 'pending';
}
function Ot(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function xt(t) {
    const e = Ot(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function jt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin teléfono').trim() ||
        'Sin teléfono'
    );
}
function Ft(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const n = new Date();
    return (
        e.getFullYear() === n.getFullYear() &&
        e.getMonth() === n.getMonth() &&
        e.getDate() === n.getDate()
    );
}
function zt(t) {
    return t >= 120
        ? { label: 'Critico SLA', tone: 'danger', note: 'Escala inmediata' }
        : t >= 45
          ? {
                label: 'En ventana',
                tone: 'warning',
                note: 'Conviene atender pronto',
            }
          : {
                label: 'Reciente',
                tone: 'neutral',
                note: 'Todavia dentro de margen',
            };
}
function Rt() {
    let t = 'all',
        e = 'recent_desc';
    try {
        ((t = JSON.parse(localStorage.getItem(Dt) || '"all"')),
            (e = JSON.parse(localStorage.getItem(Nt) || '"recent_desc"')));
    } catch (t) {}
    g((n) => ({
        ...n,
        callbacks: { ...n.callbacks, filter: It(t), sort: Pt(e) },
    }));
}
function Kt() {
    const e = f(),
        n = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
        a = (function (t, e) {
            const n = Lt(e);
            return n
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          Lt(t).includes(n)
                      )
                  )
                : t;
        })(
            (function (t, e) {
                const n = It(e);
                return 'pending' === n || 'contacted' === n
                    ? t.filter((t) => Ht(t.status) === n)
                    : 'today' === n
                      ? t.filter((t) => Ft(t.fecha || t.createdAt))
                      : 'sla_urgent' === n
                        ? t.filter(
                              (t) => 'pending' === Ht(t.status) && xt(t) >= 120
                          )
                        : t;
            })(n, e.callbacks.filter),
            e.callbacks.search
        ),
        i = (function (t, e) {
            const n = [...t];
            return 'waiting_desc' === Pt(e)
                ? (n.sort((t, e) => Ot(t) - Ot(e)), n)
                : (n.sort((t, e) => Ot(e) - Ot(t)), n);
        })(a, e.callbacks.sort),
        s = new Set((e.callbacks.selected || []).map((t) => Number(t || 0)));
    (c(
        '#callbacksGrid',
        i.length
            ? i
                  .map((e) =>
                      (function (e, n) {
                          const a = Ht(e.status),
                              i =
                                  'pending' === a
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              s = 'pending' === a ? 'pendiente' : 'contactado',
                              r = Number(e.id || 0),
                              c = jt(e),
                              l = xt(e),
                              u = zt(l);
                          return `\n        <article class="${i}${n ? ' is-selected' : ''}" data-callback-id="${r}" data-callback-status="${s}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${t('pending' === a ? u.tone : 'success')}">${'pending' === a ? 'Pendiente' : 'Contactado'}</span>\n                    <h4>${t(c)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${t(u.tone)}">${t(u.label)}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${t(e.preferencia || '-')}</strong></p>\n                <p><span>Fecha</span><strong>${t(o(e.fecha || e.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${l} min</strong></p>\n                <p><span>Estado</span><strong>${t('pending' === a ? 'Pendiente' : 'Contactado')}</strong></p>\n            </div>\n            <p class="callback-card-note">${t('pending' === a ? u.note : 'Callback resuelto y fuera de cola operativa.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${r}" data-callback-date="${t(e.fecha || '')}">Marcar contactado</button>\n            </div>\n        </article>\n    `;
                      })(e, s.has(Number(e.id || 0)))
                  )
                  .join('')
            : '<p class="callbacks-grid-empty">No hay callbacks para el filtro actual.</p>'
    ),
        r('#callbacksToolbarMeta', `Mostrando ${i.length} de ${n.length}`));
    const l = [];
    ('all' !== It(e.callbacks.filter) &&
        l.push(
            'pending' === It(e.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === It(e.callbacks.filter)
                  ? 'Contactados'
                  : 'today' === It(e.callbacks.filter)
                    ? 'Hoy'
                    : 'Urgentes SLA'
        ),
        Lt(e.callbacks.search) && l.push(`Busqueda: ${e.callbacks.search}`),
        'waiting_desc' === Pt(e.callbacks.sort) &&
            l.push('Orden: Mayor espera (SLA)'),
        r(
            '#callbacksToolbarState',
            l.length ? l.join(' | ') : 'Sin filtros activos'
        ));
    const u = document.getElementById('callbackFilter');
    u instanceof HTMLSelectElement && (u.value = It(e.callbacks.filter));
    const d = document.getElementById('callbackSort');
    d instanceof HTMLSelectElement && (d.value = Pt(e.callbacks.sort));
    const p = document.getElementById('searchCallbacks');
    (p instanceof HTMLInputElement &&
        p.value !== e.callbacks.search &&
        (p.value = e.callbacks.search),
        (function (t) {
            const e = Lt(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const n = Lt(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', n);
                });
        })(e.callbacks.filter));
    const m = (function (t) {
        const e = t.filter((t) => 'pending' === Ht(t.status)),
            n = e.filter((t) => xt(t) >= 120),
            a = e.slice().sort((t, e) => Ot(t) - Ot(e))[0];
        return {
            pendingCount: e.length,
            urgentCount: n.length,
            todayCount: t.filter((t) => Ft(t.fecha || t.createdAt)).length,
            next: a,
            queueHealth:
                n.length > 0
                    ? 'Cola: prioridad alta'
                    : e.length > 0
                      ? 'Cola: atención requerida'
                      : 'Cola: estable',
            queueState:
                n.length > 0 ? 'danger' : e.length > 0 ? 'warning' : 'success',
        };
    })(n);
    (r('#callbacksOpsPendingCount', m.pendingCount),
        r('#callbacksOpsUrgentCount', m.urgentCount),
        r('#callbacksOpsTodayCount', m.todayCount),
        r('#callbacksOpsQueueHealth', m.queueHealth));
    const g = document.getElementById('callbacksBulkSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === i.length);
    const h = document.getElementById('callbacksBulkClearBtn');
    h instanceof HTMLButtonElement && (h.disabled = 0 === s.size);
    const b = document.getElementById('callbacksBulkMarkBtn');
    (b instanceof HTMLButtonElement && (b.disabled = 0 === s.size),
        (function (t, e, n, a) {
            (r(
                '#callbacksDeckSummary',
                n > 0
                    ? `${t.pendingCount} pendiente(s), ${t.urgentCount} fuera de SLA y ${e} visibles.`
                    : 'Sin callbacks pendientes.'
            ),
                r(
                    '#callbacksDeckHint',
                    t.urgentCount > 0
                        ? 'Escala primero los casos criticos.'
                        : t.pendingCount > 0
                          ? 'La cola se puede drenar en esta misma vista.'
                          : 'Sin bloqueos'
                ));
            const o = document.getElementById('callbacksQueueChip');
            o &&
                ((o.textContent =
                    'danger' === t.queueState
                        ? 'SLA comprometido'
                        : 'warning' === t.queueState
                          ? 'Cola activa'
                          : 'Cola estable'),
                o.setAttribute('data-state', t.queueState));
            const i = document.getElementById('callbacksOpsQueueHealth');
            i && i.setAttribute('data-state', t.queueState);
            const s = t.next;
            (r('#callbacksOpsNext', s ? jt(s) : 'Sin teléfono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${jt(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecerá aqui.'
                ),
                r('#callbacksNextWait', `${s ? xt(s) : 0} min`),
                r('#callbacksNextPreference', (s && s.preferencia) || '-'),
                r('#callbacksNextState', s ? zt(xt(s)).label : 'Pendiente'));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === a),
                r('#callbacksSelectedCount', a));
        })(m, i.length, n.length, s.size));
}
function Vt(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e &&
            (function (t) {
                try {
                    (localStorage.setItem(Dt, JSON.stringify(It(t.filter))),
                        localStorage.setItem(Nt, JSON.stringify(Pt(t.sort))));
                } catch (t) {}
            })(f().callbacks),
        Kt());
}
function Ut(t) {
    Vt({ filter: It(t), selected: [] });
}
function Qt(t) {
    Vt({ sort: Pt(t), selected: [] });
}
function Jt(t) {
    Vt({ search: String(t || ''), selected: [] });
}
function Wt() {
    Vt({ filter: 'all', sort: 'recent_desc', search: '', selected: [] });
}
function Gt() {
    Vt({ selected: [] }, { persist: !1 });
}
function Yt() {
    Vt(
        {
            selected: Array.from(
                document.querySelectorAll(
                    '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
                )
            )
                .map((t) => Number(t.getAttribute('data-callback-id') || 0))
                .filter((t) => t > 0),
        },
        { persist: !1 }
    );
}
async function Zt(t, e = '') {
    const n = Number(t || 0);
    n <= 0 ||
        (await I('callbacks', {
            method: 'PATCH',
            body: { id: n, status: 'contacted', fecha: e },
        }),
        (function (t) {
            const e = Number(t || 0);
            (g((t) => {
                const n = (t.data.callbacks || []).map((t) =>
                    Number(t.id || 0) === e ? { ...t, status: 'contacted' } : t
                );
                return {
                    ...t,
                    data: { ...t.data, callbacks: n },
                    callbacks: {
                        ...t.callbacks,
                        selected: (t.callbacks.selected || []).filter(
                            (t) => Number(t || 0) !== e
                        ),
                    },
                };
            }),
                Kt());
        })(n));
}
async function Xt() {
    const t = (f().callbacks.selected || [])
        .map((t) => Number(t || 0))
        .filter((t) => t > 0);
    for (const e of t)
        try {
            await Zt(e);
        } catch (t) {}
}
function te() {
    const t = document.querySelector(
        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
    );
    t instanceof HTMLElement && t.focus();
}
const ee = 'admin-availability-selected-date',
    ne = 'admin-availability-month-anchor';
function ae(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function oe(t) {
    return [...new Set(t.map(ae).filter(Boolean))].sort();
}
function ie(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? '' : u(n) === e ? e : '';
}
function se(t) {
    const e = ie(t);
    if (!e) return null;
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? null : n;
}
function re(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((n) => {
                const a = ie(n);
                if (!a) return;
                const o = oe(Array.isArray(t[n]) ? t[n] : []);
                o.length && (e[a] = o);
            }),
        e
    );
}
function ce(t) {
    return re(t || {});
}
function le(t) {
    return JSON.stringify(re(t || {}));
}
function ue(t) {
    const e = ce(f().data.availability || {});
    return le(t) !== le(e);
}
function de(t, e = '') {
    let n = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) n = new Date(t);
    else {
        const e = ie(t);
        e && (n = new Date(`${e}T12:00:00`));
    }
    if (!n) {
        const t = se(e);
        n = t ? new Date(t) : new Date();
    }
    return (n.setDate(1), n.setHours(12, 0, 0, 0), n);
}
function pe(t, e) {
    const n = ie(t);
    if (n) return n;
    const a = Object.keys(e || {})[0];
    if (a) {
        const t = ie(a);
        if (t) return t;
    }
    return u(new Date());
}
function me() {
    const t = f(),
        e = ie(t.availability.selectedDate),
        n = de(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(ee, e) : localStorage.removeItem(ee),
            localStorage.setItem(ne, u(n)));
    } catch (t) {}
}
function fe() {
    let t = '',
        e = '';
    try {
        ((t = String(localStorage.getItem(ee) || '')),
            (e = String(localStorage.getItem(ne) || '')));
    } catch (t) {}
    const n = ie(t),
        a = de(e, n);
    g((t) => ({
        ...t,
        availability: {
            ...t.availability,
            ...(n ? { selectedDate: n } : {}),
            monthAnchor: a,
        },
    }));
}
function ge(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? Ae() : me());
}
function he(t, e = {}) {
    const n = ce(t),
        a = pe(e.selectedDate || f().availability.selectedDate, n);
    ge(
        {
            draft: n,
            selectedDate: a,
            monthAnchor: de(e.monthAnchor || f().availability.monthAnchor, a),
            draftDirty: ue(n),
            ...e,
        },
        { render: !0 }
    );
}
function be(t) {
    ge({ lastAction: String(t || '') }, { render: !0 });
}
function ye(t, e, n = '') {
    const a = ie(t) || ke();
    if (!a) return;
    const o = ve(),
        i = oe(Array.isArray(e) ? e : []);
    (i.length ? (o[a] = i) : delete o[a],
        he(o, { selectedDate: a, monthAnchor: a, lastAction: n }));
}
function ve() {
    return ce(f().availability.draft || {});
}
function we() {
    const t = f().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function ke() {
    const t = f(),
        e = ie(t.availability.selectedDate);
    if (e) return e;
    const n = ce(t.availability.draft || {});
    return Object.keys(n)[0] || u(new Date());
}
function Se(t, e) {
    const n = ie(t);
    n &&
        ge(
            { selectedDate: n, monthAnchor: de(n, n), lastAction: e || '' },
            { render: !0 }
        );
}
function Ce(t = 1) {
    const e = ve(),
        n = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!n.length) return '';
    const a = ie(f().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? n.sort() : n.sort().reverse()).find((e) =>
            t >= 0 ? e >= a : e <= a
        ) || ''
    );
}
function qe() {
    const t = f(),
        e = ce(t.data.availability || {}),
        n = pe(t.availability.selectedDate, e);
    (ge({
        draft: e,
        selectedDate: n,
        monthAnchor: de(t.availability.monthAnchor, n),
        draftDirty: !1,
        lastAction: '',
    }),
        Ae());
}
function Ae() {
    ((function () {
        const t = f(),
            e = de(t.availability.monthAnchor, t.availability.selectedDate),
            n = ke(),
            a = e.getMonth(),
            o = ce(t.availability.draft),
            i = u(new Date());
        var s;
        r(
            '#calendarMonth',
            ((s = e),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(s))
        );
        c(
            '#availabilityCalendar',
            (function (t) {
                const e = new Date(t.getFullYear(), t.getMonth(), 1),
                    n = (e.getDay() + 6) % 7;
                e.setDate(e.getDate() - n);
                const a = [];
                for (let t = 0; t < 42; t += 1) {
                    const n = new Date(e);
                    (n.setDate(e.getDate() + t), a.push(n));
                }
                return a;
            })(e)
                .map((t) => {
                    const e = u(t),
                        s = Array.isArray(o[e]) && o[e].length > 0;
                    return `\n                <button type="button" class="${['calendar-day', t.getMonth() === a ? '' : 'other-month', s ? 'has-slots' : '', e === n ? 'is-selected' : '', e === i ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${e}">\n                    <span>${t.getDate()}</span>\n                    ${s ? `<small>${o[e].length} slots</small>` : ''}\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const e = f(),
                n = ke(),
                a = oe(ce(e.availability.draft)[n] || []);
            (r('#selectedDate', n || '-'),
                a.length
                    ? c(
                          '#timeSlotsList',
                          a
                              .map(
                                  (e) =>
                                      `\n            <div class="time-slot-item">\n                <span>${t(e)}</span>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(n)}" data-time="${encodeURIComponent(e)}" ${we() ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : c(
                          '#timeSlotsList',
                          `<p class="empty-message">${we() ? 'No hay horarios configurados (Solo lectura)' : 'No hay horarios configurados'}</p>`
                      ));
        })(),
        (function () {
            const t = f(),
                n = ke(),
                a = ce(t.availability.draft),
                o = Array.isArray(a[n]) ? a[n].length : 0,
                i = we(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: l,
                } = (function () {
                    const t = f().data.availabilityMeta || {},
                        e = we();
                    return {
                        sourceText: e ? 'Google Calendar' : 'Local',
                        modeText: e ? 'Solo lectura' : 'Editable',
                        timezone: String(
                            t.timezone ||
                                Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone ||
                                '-'
                        ),
                    };
                })();
            (r(
                '#availabilityHeading',
                i
                    ? 'Configurar Horarios Disponibles · Solo lectura'
                    : 'Configurar Horarios Disponibles'
            ),
                r('#availabilitySourceBadge', `Fuente: ${s}`),
                r('#availabilityModeBadge', `Modo: ${c}`),
                r('#availabilityTimezoneBadge', `TZ: ${l}`),
                r(
                    '#availabilitySelectionSummary',
                    `Fecha: ${n} | Fuente: ${s} | Modo: ${c} | Slots: ${o}`
                ),
                r(
                    '#availabilityDraftStatus',
                    t.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                r(
                    '#availabilitySyncStatus',
                    i ? `Google Calendar | ${l}` : `Store local | ${l}`
                ));
            const u = e('#addSlotForm'),
                d = e('#availabilityQuickSlotPresets');
            (u && u.classList.toggle('is-hidden', i),
                d && d.classList.toggle('is-hidden', i));
            const p = e('#newSlotTime');
            p instanceof HTMLInputElement && (p.disabled = i);
            const m = e('[data-action="add-time-slot"]');
            m instanceof HTMLButtonElement && (m.disabled = i);
            const g = Array.isArray(t.availability.clipboard)
                ? t.availability.clipboard.length
                : 0;
            let h = 'Sin acciones pendientes';
            (i
                ? (h = 'Edicion bloqueada por proveedor Google')
                : t.availability.lastAction
                  ? (h = String(t.availability.lastAction))
                  : g && (h = `Portapapeles: ${g} slots`),
                r('#availabilityDayActionsStatus', h),
                document
                    .querySelectorAll(
                        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                    )
                    .forEach((e) => {
                        e instanceof HTMLButtonElement &&
                            ('availabilityDiscardDraftBtn' !== e.id &&
                            'availabilitySaveDraftBtn' !== e.id
                                ? 'paste-availability-day' !==
                                  String(e.dataset.action || '')
                                    ? (e.disabled = i)
                                    : (e.disabled = i || 0 === g)
                                : (e.disabled =
                                      i || !t.availability.draftDirty));
                    }));
        })(),
        me());
}
function $e() {
    return Boolean(f().availability.draftDirty);
}
function Me(t) {
    const e = ie(t);
    e &&
        ge(
            { selectedDate: e, monthAnchor: de(e, e), lastAction: '' },
            { render: !0 }
        );
}
function Te(t) {
    const e = Number(t || 0);
    if (!Number.isFinite(e) || 0 === e) return;
    const n = de(f().availability.monthAnchor, f().availability.selectedDate);
    (n.setMonth(n.getMonth() + e),
        ge({ monthAnchor: n, lastAction: '' }, { render: !0 }));
}
function _e() {
    Se(u(new Date()), 'Hoy');
}
function Ne() {
    const t = Ce(1);
    t
        ? Se(t, `Siguiente fecha con slots: ${t}`)
        : be('No hay fechas siguientes con slots');
}
function De() {
    const t = Ce(-1);
    t
        ? Se(t, `Fecha previa con slots: ${t}`)
        : be('No hay fechas anteriores con slots');
}
function Be(t) {
    if (we()) return;
    const n = e('#newSlotTime');
    n instanceof HTMLInputElement && ((n.value = ae(t)), n.focus());
}
function Ee() {
    if (we()) return;
    const t = e('#newSlotTime');
    if (!(t instanceof HTMLInputElement)) return;
    const n = ae(t.value);
    if (!n) return;
    const a = f(),
        o = ie(a.availability.selectedDate) || ke();
    o &&
        (ye(
            o,
            [
                ...(Array.isArray(a.availability.draft[o])
                    ? a.availability.draft[o]
                    : []),
                n,
            ],
            `Slot ${n} agregado en ${o}`
        ),
        (t.value = ''));
}
function Le(t, e) {
    if (we()) return;
    const n = ie(t);
    if (!n) return;
    const a = f(),
        o = Array.isArray(a.availability.draft[n])
            ? a.availability.draft[n]
            : [],
        i = ae(e);
    ye(
        n,
        o.filter((t) => ae(t) !== i),
        `Slot ${i || '-'} removido en ${n}`
    );
}
function Ie() {
    if (we()) return;
    const t = f(),
        e = ie(t.availability.selectedDate) || ke(),
        n = Array.isArray(t.availability.draft[e])
            ? oe(t.availability.draft[e])
            : [];
    ge(
        {
            clipboard: n,
            clipboardDate: e,
            lastAction: n.length
                ? `Portapapeles: ${n.length} slots (${e})`
                : 'Portapapeles vacio',
        },
        { render: !0 }
    );
}
function Pe() {
    if (we()) return;
    const t = f(),
        e = Array.isArray(t.availability.clipboard)
            ? oe(t.availability.clipboard)
            : [];
    if (!e.length) return void be('Portapapeles vacio');
    const n = ie(t.availability.selectedDate) || ke();
    ye(n, e, `Pegado ${e.length} slots en ${n}`);
}
function He(t) {
    if (we()) return;
    const e = f(),
        n = ie(e.availability.selectedDate) || ke(),
        a = Array.isArray(e.availability.draft[n])
            ? e.availability.draft[n]
            : [],
        o = se(n);
    if (!o) return;
    o.setDate(o.getDate() + Number(t || 0));
    const i = u(o);
    ye(i, a, `Duplicado ${a.length} slots en ${i}`);
}
function Oe() {
    if (we()) return;
    const t = ie(f().availability.selectedDate) || ke();
    t &&
        window.confirm(`Se eliminaran los slots del dia ${t}. ¿Continuar?`) &&
        ye(t, [], `Dia ${t} limpiado`);
}
function xe() {
    if (we()) return;
    const t = ie(f().availability.selectedDate) || ke();
    if (!t) return;
    const e = (function (t) {
        const e = se(t);
        if (!e) return null;
        const n = (e.getDay() + 6) % 7,
            a = new Date(e);
        a.setDate(e.getDate() - n);
        const o = new Date(a);
        return (o.setDate(a.getDate() + 6), { start: a, end: o });
    })(t);
    if (!e) return;
    const n = u(e.start),
        a = u(e.end);
    if (
        !window.confirm(
            `Se eliminaran los slots de la semana ${n} a ${a}. ¿Continuar?`
        )
    )
        return;
    const o = ve();
    for (let t = 0; t < 7; t += 1) {
        const n = new Date(e.start);
        (n.setDate(e.start.getDate() + t), delete o[u(n)]);
    }
    he(o, { selectedDate: t, lastAction: `Semana limpiada (${n} - ${a})` });
}
async function je() {
    if (we()) return;
    const t = ve(),
        e = await I('availability', {
            method: 'POST',
            body: { availability: t },
        }),
        n = e?.data && 'object' == typeof e.data ? ce(e.data) : t,
        a = e?.meta && 'object' == typeof e.meta ? e.meta : null;
    (g((t) => ({
        ...t,
        data: {
            ...t.data,
            availability: n,
            availabilityMeta: a
                ? { ...t.data.availabilityMeta, ...a }
                : t.data.availabilityMeta,
        },
        availability: {
            ...t.availability,
            draft: n,
            draftDirty: !1,
            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
        },
    })),
        Ae());
}
function Fe() {
    if (we()) return;
    const t = f();
    if (
        t.availability.draftDirty &&
        !window.confirm(
            'Se descartaran los cambios pendientes de disponibilidad. ¿Continuar?'
        )
    )
        return;
    const e = ce(t.data.availability || {}),
        n = pe(t.availability.selectedDate, e);
    ge(
        {
            draft: e,
            selectedDate: n,
            monthAnchor: de(t.availability.monthAnchor, n),
            draftDirty: !1,
            lastAction: 'Borrador descartado',
        },
        { render: !0 }
    );
}
const ze = 'queueStationMode',
    Re = 'queueStationConsultorio',
    Ke = 'queueOneTapAdvance',
    Ve = 'queueCallKeyBindingV1',
    Ue = 'queueNumpadHelpOpen',
    Qe = 'queueAdminLastSnapshot',
    Je = new Map([
        [1, !1],
        [2, !1],
    ]);
let We = '';
const Ge = new Set(['no_show', 'cancelar']);
function Ye(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Ze(t) {
    const e = Ye(t);
    return ['waiting', 'wait', 'en_espera', 'espera'].includes(e)
        ? 'waiting'
        : ['called', 'calling', 'llamado'].includes(e)
          ? 'called'
          : ['completed', 'complete', 'completar', 'done'].includes(e)
            ? 'completed'
            : [
                    'no_show',
                    'noshow',
                    'no-show',
                    'no show',
                    'no_asistio',
                ].includes(e)
              ? 'no_show'
              : ['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(e)
                ? 'cancelled'
                : e || 'waiting';
}
function Xe(t) {
    const e = Ye(t);
    return ['complete', 'completed', 'completar'].includes(e)
        ? 'completar'
        : ['no_show', 'noshow', 'no-show', 'no show'].includes(e)
          ? 'no_show'
          : [
                  'cancel',
                  'cancelled',
                  'canceled',
                  'cancelar',
                  'cancelado',
              ].includes(e)
            ? 'cancelar'
            : ['reasignar', 'reassign'].includes(e)
              ? 'reasignar'
              : ['re-llamar', 'rellamar', 'recall', 'llamar'].includes(e)
                ? 're-llamar'
                : ['liberar', 'release'].includes(e)
                  ? 'liberar'
                  : e;
}
function tn(t) {
    return Array.isArray(t) ? t : [];
}
function en(t, e = 0) {
    const n = Number(t);
    return Number.isFinite(n) ? n : e;
}
function nn(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function an(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
function on(t) {
    g((e) => {
        const n = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: n } };
    });
    try {
        _n();
    } catch (t) {}
}
function sn(t) {
    (v(ze, t.queue.stationMode || 'free'),
        v(Re, t.queue.stationConsultorio || 1),
        v(Ke, t.queue.oneTap ? '1' : '0'),
        v(Ue, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? k(Ve, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(Ve),
        k(Qe, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function rn(t, e = 0) {
    const n = Number(t?.id || t?.ticket_id || e + 1);
    return {
        id: n,
        ticketCode: String(t?.ticketCode || t?.ticket_code || `A-${n}`),
        queueType: String(t?.queueType || t?.queue_type || 'walk_in'),
        patientInitials: String(
            t?.patientInitials || t?.patient_initials || '--'
        ),
        priorityClass: String(
            t?.priorityClass || t?.priority_class || 'walk_in'
        ),
        status: Ze(t?.status || 'waiting'),
        assignedConsultorio:
            2 === Number(t?.assignedConsultorio || t?.assigned_consultorio || 0)
                ? 2
                : 1 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
                  ? 1
                  : null,
        createdAt: String(
            t?.createdAt || t?.created_at || new Date().toISOString()
        ),
        calledAt: String(t?.calledAt || t?.called_at || ''),
        completedAt: String(t?.completedAt || t?.completed_at || ''),
    };
}
function cn(t, e = 0, n = {}) {
    const a = t && 'object' == typeof t ? t : {},
        o = rn({ ...a, ...n }, e);
    return (
        an(a.createdAt, a.created_at) || (o.createdAt = ''),
        an(a.priorityClass, a.priority_class) || (o.priorityClass = ''),
        an(a.queueType, a.queue_type) || (o.queueType = ''),
        an(a.patientInitials, a.patient_initials) || (o.patientInitials = ''),
        o
    );
}
function ln(t) {
    const e = t.filter((t) => 'waiting' === t.status),
        n = t.filter((t) => 'called' === t.status),
        a = {
            1: n.find((t) => 1 === t.assignedConsultorio) || null,
            2: n.find((t) => 2 === t.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: e.length,
        calledCount: n.length,
        counts: {
            waiting: e.length,
            called: n.length,
            completed: t.filter((t) => 'completed' === t.status).length,
            no_show: t.filter((t) => 'no_show' === t.status).length,
            cancelled: t.filter((t) => 'cancelled' === t.status).length,
        },
        callingNowByConsultorio: a,
        nextTickets: e
            .slice(0, 5)
            .map((t, e) => ({
                id: t.id,
                ticketCode: t.ticketCode,
                patientInitials: t.patientInitials,
                position: e + 1,
            })),
    };
}
function un(t, e = []) {
    const n = t && 'object' == typeof t ? t : {},
        a = n.counts && 'object' == typeof n.counts ? n.counts : {},
        o =
            n.callingNowByConsultorio &&
            'object' == typeof n.callingNowByConsultorio
                ? n.callingNowByConsultorio
                : n.calling_now_by_consultorio &&
                    'object' == typeof n.calling_now_by_consultorio
                  ? n.calling_now_by_consultorio
                  : {},
        i = tn(n.callingNow).concat(tn(n.calling_now)),
        s = tn(e).map((t, e) => rn(t, e)),
        r =
            o[1] ||
            o[1] ||
            i.find(
                (t) =>
                    1 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        c =
            o[2] ||
            o[2] ||
            i.find(
                (t) =>
                    2 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        l = r ? cn(r, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        u = c ? cn(c, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = tn(n.nextTickets)
            .concat(tn(n.next_tickets))
            .map((t, e) =>
                cn(
                    {
                        ...t,
                        status: t?.status || 'waiting',
                        assignedConsultorio: null,
                    },
                    e
                )
            ),
        p = s.filter((t) => 'waiting' === t.status).length,
        m = s.filter((t) => 'called' === t.status).length,
        f = Math.max(Number(Boolean(l)) + Number(Boolean(u)), m),
        g = en(
            n.waitingCount ?? n.waiting_count ?? a.waiting ?? d.length ?? p,
            0
        ),
        h = en(n.calledCount ?? n.called_count ?? a.called ?? f, 0),
        b = en(
            a.completed ??
                n.completedCount ??
                n.completed_count ??
                s.filter((t) => 'completed' === t.status).length,
            0
        ),
        y = en(
            a.no_show ??
                a.noShow ??
                n.noShowCount ??
                n.no_show_count ??
                s.filter((t) => 'no_show' === t.status).length,
            0
        ),
        v = en(
            a.cancelled ??
                a.canceled ??
                n.cancelledCount ??
                n.cancelled_count ??
                s.filter((t) => 'cancelled' === t.status).length,
            0
        );
    return {
        updatedAt: String(
            n.updatedAt || n.updated_at || new Date().toISOString()
        ),
        waitingCount: g,
        calledCount: h,
        counts: {
            waiting: g,
            called: h,
            completed: b,
            no_show: y,
            cancelled: v,
        },
        callingNowByConsultorio: { 1: l, 2: u },
        nextTickets: d,
    };
}
function dn(t) {
    const e = rn(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${Ye(e.ticketCode || '')}`;
}
function pn(t) {
    const e = un(t),
        n = new Map(),
        a = (t) => {
            if (!t) return;
            const e = rn(t, n.size);
            (an(t?.createdAt, t?.created_at) || (e.createdAt = ''),
                an(t?.priorityClass, t?.priority_class) ||
                    (e.priorityClass = ''),
                an(t?.queueType, t?.queue_type) || (e.queueType = ''),
                n.set(dn(e), e));
        },
        o =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        i =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (o && a({ ...o, status: 'called', assignedConsultorio: 1 }),
        i && a({ ...i, status: 'called', assignedConsultorio: 2 }));
    for (const t of tn(e.nextTickets))
        a({ ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(n.values());
}
function mn() {
    const t = f(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => rn(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? un(t.data.queueMeta, e)
                : ln(e),
    };
}
function fn() {
    const t = f(),
        { queueTickets: e } = mn();
    return (function (t, e) {
        const n = Ye(e);
        return n
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => Ye(t).includes(n)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const n = Ye(e);
            return 'waiting' === n
                ? t.filter((t) => 'waiting' === t.status)
                : 'called' === n
                  ? t.filter((t) => 'called' === t.status)
                  : 'no_show' === n
                    ? t.filter((t) => 'no_show' === t.status)
                    : 'sla_risk' === n
                      ? t.filter(
                            (t) =>
                                'waiting' === t.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - nn(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === Ye(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function gn(t, e = null) {
    const n = Array.isArray(e) ? e : mn().queueTickets,
        a = new Set(n.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(tn(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && a.has(t))
        .sort((t, e) => t - e);
}
function hn() {
    return gn(f().queue.selected || []);
}
function bn() {
    const t = (function () {
        const t = new Set(hn());
        return t.size
            ? mn().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : fn();
}
function yn(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: gn(t, e.data.queueTickets || []) },
    })),
        e && Nn());
}
function vn(t) {
    const e = Number(t || 0);
    if (!e) return;
    const n = hn();
    yn(n.includes(e) ? n.filter((t) => t !== e) : [...n, e]);
}
function wn() {
    yn(fn().map((t) => Number(t.id || 0)));
}
function kn() {
    yn([]);
}
function Sn(e) {
    const n = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        a = Math.max(0, Math.round((Date.now() - nn(e.createdAt)) / 6e4)),
        o = Number(e.id || 0),
        i = new Set(hn()).has(o),
        s = 'called' === e.status,
        r = s && e.assignedConsultorio,
        c = s;
    return `\n        <tr data-queue-id="${o}" class="${i ? 'is-selected' : ''}">\n            <td>\n                <label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${o}" ${i ? 'checked' : ''} />\n                </label>\n            </td>\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (Ze(t)) {
                case 'waiting':
                    return 'En espera';
                case 'called':
                    return 'Llamado';
                case 'completed':
                    return 'Completado';
                case 'no_show':
                    return 'No asistio';
                case 'cancelled':
                    return 'Cancelado';
                default:
                    return String(t || '--');
            }
        })(e.status)
    )}</td>\n            <td>${n}</td>\n            <td>${a} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${o}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function Cn(t) {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        n = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (n && (n.textContent = `Confirmar accion sensible: ${t.action}`),
        g((e) => ({ ...e, queue: { ...e.queue, pendingSensitiveAction: t } })),
        e instanceof HTMLDialogElement && 'function' == typeof e.showModal)
    ) {
        if (((e.hidden = !1), e.removeAttribute('hidden'), !e.open))
            try {
                e.showModal();
            } catch (t) {
                e.setAttribute('open', '');
            }
    } else
        e instanceof HTMLElement &&
            (e.setAttribute('open', ''), (e.hidden = !1));
}
function qn() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function An(t, e = null, n = {}) {
    const a = tn(t).map((t, e) => rn(t, e)),
        o = un(e && 'object' == typeof e ? e : ln(a), a),
        i = a.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof n.fallbackPartial
                ? n.fallbackPartial
                : Number(o.waitingCount || 0) > i,
        r =
            'fallback' === Ye(n.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === Ye(n.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: a, queueMeta: o },
        queue: {
            ...t.queue,
            selected: gn(t.queue.selected || [], a),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        sn(f()),
        Nn());
}
function $n(t, e) {
    const n = Number(t || 0),
        a = (f().data.queueTickets || []).map((t, a) => {
            const o = rn(t, a);
            return o.id !== n
                ? o
                : rn('function' == typeof e ? e(o) : { ...o }, a);
        });
    An(a, ln(a), { fallbackPartial: !1, syncMode: 'live' });
}
function Mn(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), sn(f()), Nn());
}
function Tn(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        mn().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function _n() {
    const e = f().queue.activity || [];
    c(
        '#queueActivityList',
        e.length
            ? e
                  .map(
                      (e) =>
                          `<li><span>${t(o(e.at))}</span><strong>${t(e.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function Nn() {
    const e = f(),
        { queueMeta: n } = mn(),
        a = fn(),
        o = hn().length,
        i = bn(),
        s = tn(n.nextTickets),
        l = Number(n.waitingCount || n.counts?.waiting || 0);
    (!(function (t) {
        const e = f(),
            n = un(t, e.data.queueTickets || []),
            a =
                n.callingNowByConsultorio?.[1] ||
                n.callingNowByConsultorio?.[1] ||
                null,
            o =
                n.callingNowByConsultorio?.[2] ||
                n.callingNowByConsultorio?.[2] ||
                null,
            i = a
                ? String(a.ticketCode || a.ticket_code || 'A-000')
                : 'Sin llamado',
            s = o
                ? String(o.ticketCode || o.ticket_code || 'A-000')
                : 'Sin llamado';
        (r(
            '#queueWaitingCountAdmin',
            Number(n.waitingCount || n.counts?.waiting || 0)
        ),
            r(
                '#queueCalledCountAdmin',
                Number(n.calledCount || n.counts?.called || 0)
            ),
            r('#queueC1Now', i),
            r('#queueC2Now', s));
        const c = document.getElementById('queueReleaseC1');
        c instanceof HTMLButtonElement &&
            ((c.hidden = !a),
            (c.textContent = a ? `Liberar C1 · ${i}` : 'Release C1'),
            a
                ? c.setAttribute('data-queue-id', String(Number(a.id || 0)))
                : c.removeAttribute('data-queue-id'));
        const l = document.getElementById('queueReleaseC2');
        l instanceof HTMLButtonElement &&
            ((l.hidden = !o),
            (l.textContent = o ? `Liberar C2 · ${s}` : 'Release C2'),
            o
                ? l.setAttribute('data-queue-id', String(Number(o.id || 0)))
                : l.removeAttribute('data-queue-id'));
        const u = document.getElementById('queueSyncStatus');
        if ('fallback' === Ye(e.queue.syncMode))
            return (
                r('#queueSyncStatus', 'fallback'),
                void (u && u.setAttribute('data-state', 'fallback'))
            );
        const d = String(n.updatedAt || '').trim();
        if (!d) return;
        const p = Math.max(0, Math.round((Date.now() - nn(d)) / 1e3)),
            m = p >= 60;
        if (
            (r('#queueSyncStatus', m ? `Watchdog (${p}s)` : 'vivo'),
            u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
            m)
        ) {
            const t = `stale-${Math.floor(p / 15)}`;
            return void (
                t !== We &&
                ((We = t), on('Watchdog de cola: realtime en reconnecting'))
            );
        }
        We = 'live';
    })(n),
        c(
            '#queueTableBody',
            a.length
                ? a.map(Sn).join('')
                : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
        ));
    const u =
        e.queue.fallbackPartial && s.length && l > s.length
            ? `<li><span>-</span><strong>Mostrando primeros ${s.length} de ${l} en espera</strong></li>`
            : '';
    c(
        '#queueNextAdminList',
        s.length
            ? `${u}${s.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
    const d = a.filter(
            (t) =>
                'waiting' === t.status &&
                (Math.max(
                    0,
                    Math.round((Date.now() - nn(t.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === Ye(t.priorityClass))
        ).length,
        p = [d > 0 ? `riesgo: ${d}` : 'sin riesgo'];
    (o > 0 && p.push(`seleccion: ${o}`),
        e.queue.fallbackPartial && p.push('fallback parcial'),
        r('#queueTriageSummary', p.join(' | ')),
        r('#queueSelectedCount', o));
    const m = document.getElementById('queueSelectionChip');
    m instanceof HTMLElement && m.classList.toggle('is-hidden', 0 === o);
    const g = document.getElementById('queueSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === a.length);
    const h = document.getElementById('queueClearSelectionBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === o),
        document
            .querySelectorAll(
                '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
            )
            .forEach((t) => {
                t instanceof HTMLButtonElement && (t.disabled = 0 === i.length);
            }),
        r('#queueStationBadge', `Estación C${e.queue.stationConsultorio}`),
        r(
            '#queueStationModeBadge',
            'locked' === e.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const b = document.getElementById('queuePracticeModeBadge');
    b instanceof HTMLElement && (b.hidden = !e.queue.practiceMode);
    const y = document.getElementById('queueShortcutPanel');
    y instanceof HTMLElement && (y.hidden = !e.queue.helpOpen);
    const v = document.querySelector('[data-action="queue-clear-call-key"]');
    v instanceof HTMLElement && (v.hidden = !e.queue.customCallKey);
    const w = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (w instanceof HTMLElement &&
        (w.setAttribute('aria-pressed', String(Boolean(e.queue.oneTap))),
        (w.textContent = e.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((t) => {
                if (!(t instanceof HTMLButtonElement)) return;
                const n = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1;
                t.disabled =
                    'locked' === e.queue.stationMode &&
                    n !== Number(e.queue.stationConsultorio || 1);
            }));
    const k = Tn(e.queue.stationConsultorio);
    (document
        .querySelectorAll(
            '[data-action="queue-release-station"][data-queue-consultorio]'
        )
        .forEach((t) => {
            if (!(t instanceof HTMLButtonElement)) return;
            const n = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1,
                a = Tn(n);
            ((t.disabled = !a),
                'locked' === e.queue.stationMode &&
                    n !== Number(e.queue.stationConsultorio || 1) &&
                    (t.disabled = !0));
        }),
        k &&
            (p.push(
                `activo: ${k.ticketCode} en C${e.queue.stationConsultorio}`
            ),
            r('#queueTriageSummary', p.join(' | '))),
        _n());
}
function Dn(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function Bn(t, e = {}) {
    const n =
        t?.data?.queueState ||
        t?.data?.queue_state ||
        t?.data?.queueMeta ||
        t?.data ||
        null;
    if (!n || 'object' != typeof n) return;
    const a = (function (t) {
            return t && 'object' == typeof t
                ? Array.isArray(t.queue_tickets)
                    ? t.queue_tickets
                    : Array.isArray(t.queueTickets)
                      ? t.queueTickets
                      : Array.isArray(t.tickets)
                        ? t.tickets
                        : []
                : [];
        })(n),
        o = t?.data?.ticket || null;
    if (
        !(function (t, e, n) {
            if (e.length > 0) return !0;
            if (
                Dn(t, 'queue_tickets') ||
                Dn(t, 'queueTickets') ||
                Dn(t, 'tickets')
            )
                return !0;
            if (n && 'object' == typeof n) return !0;
            if (
                Dn(t, 'waitingCount') ||
                Dn(t, 'waiting_count') ||
                Dn(t, 'calledCount') ||
                Dn(t, 'called_count') ||
                Dn(t, 'completedCount') ||
                Dn(t, 'completed_count') ||
                Dn(t, 'noShowCount') ||
                Dn(t, 'no_show_count') ||
                Dn(t, 'cancelledCount') ||
                Dn(t, 'cancelled_count')
            )
                return !0;
            const a =
                t?.counts && 'object' == typeof t.counts ? t.counts : null;
            if (
                a &&
                (Dn(a, 'waiting') ||
                    Dn(a, 'called') ||
                    Dn(a, 'completed') ||
                    Dn(a, 'no_show') ||
                    Dn(a, 'noShow') ||
                    Dn(a, 'cancelled') ||
                    Dn(a, 'canceled'))
            )
                return !0;
            if (Dn(t, 'nextTickets') || Dn(t, 'next_tickets')) return !0;
            const o =
                t?.callingNowByConsultorio &&
                'object' == typeof t.callingNowByConsultorio
                    ? t.callingNowByConsultorio
                    : t?.calling_now_by_consultorio &&
                        'object' == typeof t.calling_now_by_consultorio
                      ? t.calling_now_by_consultorio
                      : null;
            return (
                !(
                    !o ||
                    !(
                        Boolean(o[1]) ||
                        Boolean(o[2]) ||
                        Boolean(o[1]) ||
                        Boolean(o[2])
                    )
                ) || tn(t?.callingNow).concat(tn(t?.calling_now)).some(Boolean)
            );
        })(n, a, o)
    )
        return;
    const i = 'fallback' === Ye(e.syncMode) ? 'fallback' : 'live',
        s = (f().data.queueTickets || []).map((t, e) => rn(t, e)),
        r = un(n, s),
        c = (function (t) {
            const e =
                    t?.counts && 'object' == typeof t.counts ? t.counts : null,
                n =
                    Dn(t, 'waitingCount') ||
                    Dn(t, 'waiting_count') ||
                    Boolean(e && Dn(e, 'waiting')),
                a =
                    Dn(t, 'calledCount') ||
                    Dn(t, 'called_count') ||
                    Boolean(e && Dn(e, 'called')),
                o = Dn(t, 'nextTickets') || Dn(t, 'next_tickets'),
                i =
                    Dn(t, 'callingNowByConsultorio') ||
                    Dn(t, 'calling_now_by_consultorio') ||
                    Dn(t, 'callingNow') ||
                    Dn(t, 'calling_now');
            return { waiting: n || o, called: a || i };
        })(n),
        l = pn(r),
        u = Boolean(o && 'object' == typeof o);
    if (!(a.length || l.length || u || c.waiting || c.called)) return;
    const d =
            Number(r.waitingCount || 0) >
            l.filter((t) => 'waiting' === t.status).length,
        p = new Map(s.map((t) => [dn(t), t]));
    if (a.length) An(a, r, { fallbackPartial: !1, syncMode: i });
    else {
        !(function (t, e, n) {
            const a = e.callingNowByConsultorio || {},
                o = Number(e.calledCount || e.counts?.called || 0),
                i = Number(e.waitingCount || e.counts?.waiting || 0),
                s = tn(e.nextTickets),
                r = new Set(),
                c = a[1] || a[1] || null,
                l = a[2] || a[2] || null;
            (c && r.add(dn(c)), l && r.add(dn(l)));
            const u = new Set(s.map((t) => dn(t))),
                d = r.size > 0 || 0 === o,
                p = u.size > 0 || 0 === i,
                m = u.size > 0 && i > u.size;
            for (const [e, a] of t.entries()) {
                const o = rn(a, 0);
                n.called && d && 'called' === o.status && !r.has(e)
                    ? t.set(
                          e,
                          rn(
                              {
                                  ...o,
                                  status: 'completed',
                                  assignedConsultorio: null,
                                  completedAt:
                                      o.completedAt || new Date().toISOString(),
                              },
                              0
                          )
                      )
                    : n.waiting &&
                      p &&
                      'waiting' === o.status &&
                      (i <= 0 ? t.delete(e) : m || u.has(e) || t.delete(e));
            }
        })(p, r, c);
        for (const t of l) {
            const e = dn(t),
                n = p.get(e) || null,
                a = an(t.createdAt, t.created_at, n?.createdAt, n?.created_at),
                o = an(
                    t.priorityClass,
                    t.priority_class,
                    n?.priorityClass,
                    n?.priority_class,
                    'walk_in'
                ),
                i = an(
                    t.queueType,
                    t.queue_type,
                    n?.queueType,
                    n?.queue_type,
                    'walk_in'
                ),
                s = an(
                    t.patientInitials,
                    t.patient_initials,
                    n?.patientInitials,
                    n?.patient_initials,
                    '--'
                );
            p.set(
                e,
                rn(
                    {
                        ...(n || {}),
                        ...t,
                        status: t.status,
                        assignedConsultorio: t.assignedConsultorio,
                        createdAt: a || new Date().toISOString(),
                        priorityClass: o,
                        queueType: i,
                        patientInitials: s,
                    },
                    p.size
                )
            );
        }
        if (u) {
            const t = rn(o, p.size),
                e = dn(t),
                n = p.get(e) || null;
            p.set(e, rn({ ...(n || {}), ...t }, p.size));
        }
        An(Array.from(p.values()), r, { fallbackPartial: d, syncMode: i });
    }
}
function En(t, e, n = void 0) {
    $n(t, (t) => ({
        ...t,
        status: e,
        assignedConsultorio: void 0 === n ? t.assignedConsultorio : n,
        calledAt:
            'called' === e
                ? new Date().toISOString()
                : 'waiting' === e
                  ? ''
                  : t.calledAt,
        completedAt:
            'completed' === e || 'no_show' === e || 'cancelled' === e
                ? new Date().toISOString()
                : '',
    }));
}
async function Ln() {
    try {
        (Bn(await I('queue-state'), { syncMode: 'live' }),
            on('Queue refresh realizado'));
    } catch (t) {
        on('Queue refresh con error');
        const e = w(Qe, null);
        e?.queueTickets &&
            An(e.queueTickets, e.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            });
    }
}
function In(t) {
    Mn({ filter: Ye(t) || 'all', selected: [] });
}
function Pn(t) {
    Mn({ search: String(t || ''), selected: [] });
}
function Hn() {
    Mn({ search: '', selected: [] });
    const t = document.getElementById('queueSearchInput');
    t instanceof HTMLInputElement && (t.value = '');
}
async function On(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        n = f();
    if (!Je.get(e)) {
        if (
            'locked' === n.queue.stationMode &&
            n.queue.stationConsultorio !== e
        )
            return (
                on(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (n.queue.practiceMode) {
            const t = (function (t) {
                return mn().queueTickets.find(
                    (e) =>
                        'waiting' === e.status &&
                        (!e.assignedConsultorio || e.assignedConsultorio === t)
                );
            })(e);
            return t
                ? ((function (t, e) {
                      $n(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void on(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void on('Practica: sin tickets en espera');
        }
        Je.set(e, !0);
        try {
            (Bn(
                await I('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                on(`Llamado C${e} ejecutado`));
        } catch (t) {
            (on(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            Je.set(e, !1);
        }
    }
}
async function xn({ ticketId: t, action: e, consultorio: n }) {
    const a = Number(t || 0),
        o = Xe(e);
    if (a && o)
        return f().queue.practiceMode
            ? ('reasignar' === o || 're-llamar' === o || 'rellamar' === o
                  ? En(a, 'called', 2 === Number(n || 1) ? 2 : 1)
                  : 'liberar' === o
                    ? En(a, 'waiting', null)
                    : 'completar' === o
                      ? En(a, 'completed')
                      : 'no_show' === o
                        ? En(a, 'no_show')
                        : 'cancelar' === o && En(a, 'cancelled'),
              void on(`Practica: accion ${o} en ticket ${a}`))
            : (Bn(
                  await I('queue-ticket', {
                      method: 'PATCH',
                      body: { id: a, action: o, consultorio: Number(n || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void on(`Accion ${o} ticket ${a}`));
}
async function jn(t, e, n = 0) {
    const a = {
            ticketId: Number(t || 0),
            action: Xe(e),
            consultorio: Number(n || 0),
        },
        o = f(),
        i = (function (t) {
            const e = Number(t || 0);
            return (
                (e && mn().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(a.ticketId);
    if (
        !o.queue.practiceMode &&
        Ge.has(a.action) &&
        (function (t, e) {
            const n = Xe(t);
            if ('cancelar' === n) return !0;
            if ('no_show' !== n) return !1;
            const a = e || null;
            return (
                !a ||
                'called' === Ze(a.status) ||
                Number(a.assignedConsultorio || 0) > 0
            );
        })(a.action, i)
    )
        return (Cn(a), void on(`Accion ${a.action} pendiente de confirmacion`));
    await xn(a);
}
async function Fn(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        n = Tn(e);
    n
        ? await jn(n.id, 'liberar', e)
        : on(`Sin ticket activo para liberar en C${e}`);
}
async function zn() {
    const t = f().queue.pendingSensitiveAction;
    t ? (qn(), await xn(t)) : qn();
}
function Rn() {
    (qn(), on('Accion sensible cancelada'));
}
function Kn() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = f().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (Rn(), 0)
    );
}
async function Vn(t) {
    const e = bn(),
        n = Xe(t);
    if (e.length) {
        if (Ge.has(n)) {
            const t =
                'no_show' === n
                    ? 'No show'
                    : 'completar' === n || 'completed' === n
                      ? 'Completar'
                      : 'Cancelar';
            if (!window.confirm(`${t}: confirmar acción masiva`)) return;
        }
        for (const t of e)
            try {
                await xn({
                    ticketId: t.id,
                    action: n,
                    consultorio:
                        t.assignedConsultorio || f().queue.stationConsultorio,
                });
            } catch (t) {}
        (kn(), on(`Bulk ${n} sobre ${e.length} tickets`));
    }
}
async function Un(t) {
    const e = Number(t || 0);
    e &&
        (f().queue.practiceMode
            ? on(`Practica: reprint ticket ${e}`)
            : (await I('queue-reprint', { method: 'POST', body: { id: e } }),
              on(`Reimpresion ticket ${e}`)));
}
async function Qn() {
    const t = bn();
    for (const e of t)
        try {
            await Un(e.id);
        } catch (t) {}
    (kn(), on(`Bulk reimpresion ${t.length}`));
}
function Jn() {
    Mn({ helpOpen: !f().queue.helpOpen });
}
function Wn() {
    Mn({ oneTap: !f().queue.oneTap });
}
function Gn(t) {
    const e = Boolean(t);
    (qn(),
        Mn({ practiceMode: e }),
        on(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function Yn(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    (Mn({ stationMode: 'locked', stationConsultorio: e }),
        on(`Estacion bloqueada en C${e}`));
}
function Zn(t) {
    if ('free' === Ye(t))
        return (Mn({ stationMode: 'free' }), void on('Estacion en modo libre'));
    Mn({ stationMode: 'locked' });
}
function Xn() {
    (Mn({ captureCallKeyMode: !0 }),
        s('Calibración activa: presiona la tecla externa', 'info'));
}
function ta() {
    window.confirm('¿Quitar tecla externa calibrada?') &&
        (Mn({ customCallKey: null, captureCallKeyMode: !1 }),
        s('Tecla externa eliminada', 'success'));
}
function ea() {
    const t = f(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        mn().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
async function na(t) {
    const e = f();
    if (e.queue.captureCallKeyMode) {
        const e = {
            key: String(t.key || ''),
            code: String(t.code || ''),
            location: Number(t.location || 0),
        };
        return (
            Mn({ customCallKey: e, captureCallKeyMode: !1 }),
            s('Tecla externa guardada', 'success'),
            void on(`Tecla externa calibrada: ${e.code}`)
        );
    }
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                Ye(e.code) === Ye(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await On(e.queue.stationConsultorio));
    const n = Ye(t.code),
        a = Ye(t.key),
        o =
            'numpadenter' === n ||
            'kpenter' === n ||
            ('enter' === a && 3 === Number(t.location || 0));
    if (o && e.queue.pendingSensitiveAction) await zn();
    else {
        if ('numpad2' === n || '2' === a)
            return 'locked' === e.queue.stationMode &&
                2 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void on('Cambio de estación bloqueado por lock'))
                : (Mn({ stationConsultorio: 2 }),
                  void on('Numpad: estacion C2'));
        if ('numpad1' === n || '1' === a)
            return 'locked' === e.queue.stationMode &&
                1 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void on('Cambio de estación bloqueado por lock'))
                : (Mn({ stationConsultorio: 1 }),
                  void on('Numpad: estacion C1'));
        if (o) {
            if (e.queue.oneTap) {
                const t = ea();
                t &&
                    (await xn({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    }));
            }
            await On(e.queue.stationConsultorio);
        } else {
            if (
                'numpaddecimal' === n ||
                'kpdecimal' === n ||
                'decimal' === a ||
                ',' === a ||
                '.' === a
            ) {
                const t = ea();
                return void (
                    t &&
                    Cn({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadsubtract' === n || 'kpsubtract' === n || '-' === a) {
                const t = ea();
                return void (
                    t &&
                    Cn({
                        ticketId: t.id,
                        action: 'no_show',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadadd' === n || 'kpadd' === n || '+' === a) {
                const t = ea();
                t &&
                    (await xn({
                        ticketId: t.id,
                        action: 're-llamar',
                        consultorio: e.queue.stationConsultorio,
                    }),
                    on(`Re-llamar ${t.ticketCode}`),
                    s(`Re-llamar ${t.ticketCode}`, 'info'));
            }
        }
    }
}
function aa() {
    const t = {
            stationMode: 'locked' === Ye(y(ze, 'free')) ? 'locked' : 'free',
            stationConsultorio: 2 === Number(y(Re, '1')) ? 2 : 1,
            oneTap: '1' === y(Ke, '0'),
            helpOpen: '1' === y(Ue, '0'),
            customCallKey: w(Ve, null),
        },
        e = Ye(S('station')),
        n = Ye(S('lock')),
        a = Ye(S('one_tap')),
        o =
            'c2' === e || '2' === e
                ? 2
                : 'c1' === e || '1' === e
                  ? 1
                  : t.stationConsultorio,
        i = '1' === n || 'true' === n ? 'locked' : t.stationMode,
        s =
            '1' === a ||
            'true' === a ||
            ('0' !== a && 'false' !== a && t.oneTap);
    (g((e) => ({
        ...e,
        queue: {
            ...e.queue,
            stationMode: i,
            stationConsultorio: o,
            oneTap: s,
            helpOpen: t.helpOpen,
            customCallKey:
                t.customCallKey && 'object' == typeof t.customCallKey
                    ? t.customCallKey
                    : null,
        },
    })),
        sn(f()));
}
function oa() {
    const t = f();
    return (
        'fallback' !== Ye(t.queue.syncMode) && !Boolean(t.queue.fallbackPartial)
    );
}
async function ia() {
    const t = f(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => rn(t, e))
            : [],
        n =
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? un(t.data.queueMeta, e)
                : null;
    if (e.length)
        return void An(e, n || null, { fallbackPartial: !1, syncMode: 'live' });
    const a = n ? pn(n) : [];
    if (a.length)
        return (
            An(a, n, { fallbackPartial: !0, syncMode: 'fallback' }),
            void on('Queue fallback parcial desde metadata')
        );
    if ((await Ln(), (f().data.queueTickets || []).length)) return;
    const o = w(Qe, null);
    if (o?.queueTickets?.length)
        return (
            An(o.queueTickets, o.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            }),
            void on('Queue fallback desde snapshot local')
        );
    An([], null, { fallbackPartial: !1, syncMode: 'live' });
}
function sa(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ra(e, n, a, o = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(o)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(a)}</small>\n            </div>\n            <strong>${t(n)}</strong>\n        </li>\n    `;
}
function ca(e) {
    const n = Array.isArray(e.data.appointments) ? e.data.appointments : [],
        a = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
        o = Array.isArray(e.data.reviews) ? e.data.reviews : [],
        s = e.data.funnelMetrics || {},
        l = new Date().toISOString().split('T')[0],
        u = n.filter((t) => String(t.date || '') === l).length,
        d = a.filter((t) => {
            const e = sa(t.status);
            return 'pending' === e || 'pendiente' === e;
        }).length,
        p = n.filter((t) => 'no_show' === sa(t.status)).length,
        m = o.length
            ? (
                  o.reduce((t, e) => t + Number(e.rating || 0), 0) / o.length
              ).toFixed(1)
            : '0.0',
        f = o.filter((t) => {
            const e = new Date(t.date || t.createdAt || '');
            return (
                !Number.isNaN(e.getTime()) && Date.now() - e.getTime() <= 2592e6
            );
        }).length;
    (r('#todayAppointments', u),
        r('#totalAppointments', n.length),
        r('#pendingCallbacks', d),
        r('#totalReviewsCount', o.length),
        r('#totalNoShows', p),
        r('#avgRating', m),
        r('#adminAvgRating', m),
        r('#dashboardHeroRating', m),
        r('#dashboardHeroRecentReviews', f));
    const g = s.summary || {};
    (r('#funnelViewBooking', i(g.viewBooking || 0)),
        r('#funnelStartCheckout', i(g.startCheckout || 0)),
        r('#funnelBookingConfirmed', i(g.bookingConfirmed || 0)),
        r(
            '#funnelAbandonRate',
            `${Number(g.abandonRatePct || 0).toFixed(1)}%`
        ));
    const h = (e, n, a) =>
        Array.isArray(e) && e.length
            ? e
                  .slice(0, 6)
                  .map((e) => {
                      return (
                          (o = String(e[n] || e.label || '-')),
                          (i = String(e[a] ?? e.count ?? 0)),
                          `<li><span>${t(o)}</span><strong>${t(i)}</strong></li>`
                      );
                      var o, i;
                  })
                  .join('')
            : '<li><span>Sin datos</span><strong>0</strong></li>';
    (c('#funnelEntryList', h(s.checkoutEntryBreakdown, 'entry', 'count')),
        c('#funnelSourceList', h(s.sourceBreakdown, 'source', 'count')),
        c(
            '#funnelPaymentMethodList',
            h(s.paymentMethodBreakdown, 'method', 'count')
        ),
        c(
            '#funnelAbandonReasonList',
            h(s.abandonReasonBreakdown, 'reason', 'count')
        ),
        c('#funnelStepList', h(s.bookingStepBreakdown, 'step', 'count')),
        c('#funnelErrorCodeList', h(s.errorCodeBreakdown, 'code', 'count')),
        c('#funnelAbandonList', h(s.checkoutAbandonByStep, 'step', 'count')));
    const b = n.filter((t) => {
            const e = sa(t.paymentStatus || t.payment_status);
            return 'pending_transfer_review' === e || 'pending_transfer' === e;
        }).length,
        y = a.filter((t) => {
            const e = sa(t.status);
            if ('pending' !== e && 'pendiente' !== e) return !1;
            const n = new Date(t.fecha || t.createdAt || '');
            return (
                !Number.isNaN(n.getTime()) &&
                (Date.now() - n.getTime()) / 6e4 >= 60
            );
        }).length;
    (r('#operationPendingReviewCount', b),
        r('#operationPendingCallbacksCount', d),
        r('#operationTodayLoadCount', u),
        r('#dashboardHeroPendingTransfers', b),
        r('#dashboardHeroUrgentCallbacks', y),
        r(
            '#operationQueueHealth',
            y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
        ),
        r(
            '#dashboardQueueHealth',
            y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
        ),
        r('#dashboardLiveStatus', b > 0 || y > 0 ? 'Atencion' : 'Estable'),
        r(
            '#dashboardLiveMeta',
            b > 0
                ? 'Existen transferencias pendientes por validar.'
                : y > 0
                  ? 'Hay callbacks fuera de SLA que requieren contacto.'
                  : 'Sin alertas criticas en la operacion actual.'
        ),
        r(
            '#dashboardFlowStatus',
            u > 6
                ? 'Agenda con demanda alta'
                : p > 0
                  ? 'Revisar ausencias del dia'
                  : 'Flujo operativo bajo control'
        ),
        r(
            '#dashboardHeroSummary',
            b > 0 || y > 0
                ? `Prioriza ${b} transferencia(s) y ${y} callback(s) urgentes.`
                : 'Agenda, callbacks y disponibilidad en una sola vista de control.'
        ),
        c(
            '#operationActionList',
            [
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Validar transferencias',
                    desc: `${b} por revisar`,
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Triage callbacks',
                    desc: `${d} pendientes`,
                },
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar tablero',
                    desc: 'Sincronizar datos',
                },
            ]
                .map(
                    (e) =>
                        `\n            <button type="button" class="operations-action-item" data-action="${e.action}">\n                <span>${t(e.label)}</span>\n                <small>${t(e.desc)}</small>\n            </button>\n        `
                )
                .join('')
        ));
    const v = Number(e.ui?.lastRefreshAt || 0);
    (r(
        '#operationRefreshSignal',
        v
            ? `Sync ${new Date(v).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
            : 'Tiempo real'
    ),
        r(
            '#operationDeckMeta',
            b > 0 || d > 0 ? 'Prioridades activas' : 'Operacion estable'
        ),
        c(
            '#dashboardAttentionList',
            [
                ra(
                    'Transferencias',
                    String(b),
                    b > 0 ? 'Comprobantes por revisar' : 'Sin pendientes',
                    b > 0 ? 'warning' : 'neutral'
                ),
                ra(
                    'Callbacks urgentes',
                    String(y),
                    y > 0 ? 'Mayores a 60 minutos' : 'SLA dentro de rango',
                    y > 0 ? 'danger' : 'neutral'
                ),
                ra(
                    'No show',
                    String(p),
                    p > 0 ? 'Requiere seguimiento' : 'Sin ausencias recientes',
                    p > 0 ? 'warning' : 'neutral'
                ),
            ].join('')
        ));
}
function la(t) {
    const e = Math.max(0, Math.min(5, Math.round(Number(t || 0))));
    return `${'★'.repeat(e)}${'☆'.repeat(5 - e)}`;
}
function ua(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function da() {
    const e = f(),
        n = Array.isArray(e.data.reviews) ? e.data.reviews : [],
        a = (function (t) {
            return t
                .slice()
                .sort(
                    (t, e) =>
                        new Date(e.date || e.createdAt || 0).getTime() -
                        new Date(t.date || t.createdAt || 0).getTime()
                );
        })(n),
        i = n.length
            ? n.reduce((t, e) => t + Number(e.rating || 0), 0) / n.length
            : 0,
        s = n.filter((t) => Number(t.rating || 0) >= 5).length,
        l = n.filter((t) => {
            const e = new Date(t.date || t.createdAt || '');
            return (
                !Number.isNaN(e.getTime()) && Date.now() - e.getTime() <= 2592e6
            );
        }).length;
    if (
        (r('#reviewsAverageRating', i.toFixed(1)),
        r('#reviewsFiveStarCount', s),
        r('#reviewsRecentCount', l),
        r('#reviewsTotalCount', n.length),
        r(
            '#reviewsSentimentLabel',
            (function (t, e) {
                return e
                    ? t >= 4.6
                        ? 'Feedback excelente'
                        : t >= 4
                          ? 'Tono solido'
                          : t >= 3
                            ? 'Tono mixto'
                            : 'Atencion requerida'
                    : 'Sin senal suficiente';
            })(i, n.length)
        ),
        c(
            '#reviewsSummaryRail',
            (function (e, n) {
                const a = e[0],
                    i = a ? o(a.date || a.createdAt || '') : '-';
                return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${t(a ? String(a.name || 'Anonimo') : 'Sin datos')}</strong>\n            <small>${t(i)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${t(String(n))} en 30 dias</strong>\n            <small>Lectura del pulso reciente</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Seal premium</span>\n            <strong>${t(e.length >= 5 ? 'Base consistente' : 'Volumen inicial')}</strong>\n            <small>Calidad y recurrencia de comentarios</small>\n        </article>\n    `;
            })(a, l)
        ),
        !n.length)
    )
        return (
            c(
                '#reviewsSpotlight',
                '\n                <div class="reviews-empty-state">\n                    <strong>Sin feedback reciente</strong>\n                    <p>No hay resenas registradas todavia.</p>\n                </div>\n            '
            ),
            void c(
                '#reviewsGrid',
                '\n                <div class="reviews-empty-state">\n                    <strong>No hay resenas registradas.</strong>\n                    <p>Cuando entren comentarios, apareceran aqui con resumen y spotlight.</p>\n                </div>\n            '
            )
        );
    const u = a.find((t) => Number(t.rating || 0) >= 5) || a[0];
    (c(
        '#reviewsSpotlight',
        `\n            <article class="reviews-spotlight-card">\n                <div class="reviews-spotlight-top">\n                    <span class="review-avatar">${t(ua(u.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(u.name || 'Anonimo')}</strong>\n                        <small>${t(o(u.date || u.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <p class="reviews-spotlight-stars">${t(la(u.rating))}</p>\n                <p>${t(u.comment || u.review || '')}</p>\n            </article>\n        `
    ),
        c(
            '#reviewsGrid',
            a
                .map((e) => {
                    const n = Number(e.rating || 0);
                    return `\n                <article class="review-card" data-rating="${t(String(n))}">\n                    <header>\n                        <div class="review-card-heading">\n                            <span class="review-avatar">${t(ua(e.name || 'Anonimo'))}</span>\n                            <div>\n                                <strong>${t(e.name || 'Anonimo')}</strong>\n                                <small>${t(o(e.date || e.createdAt || ''))}</small>\n                            </div>\n                        </div>\n                        <span class="review-rating-badge">${t(la(n))}</span>\n                    </header>\n                    <p>${t(e.comment || e.review || '')}</p>\n                </article>\n            `;
                })
                .join('')
        ));
}
async function pa() {
    const t = (function () {
        const t = 'Notification' in window,
            e = 'serviceWorker' in navigator,
            n = 'PushManager' in window;
        if (!t)
            return {
                tone: 'neutral',
                label: 'Push no disponible',
                meta: 'Este navegador no soporta notificaciones.',
            };
        const a = String(Notification.permission || 'default');
        return 'granted' === a
            ? {
                  tone: 'success',
                  label: e && n ? 'Push listo' : 'Push parcial',
                  meta:
                      e && n
                          ? 'Permisos concedidos y APIs disponibles.'
                          : 'Permiso otorgado, pero faltan APIs del navegador.',
              }
            : 'denied' === a
              ? {
                    tone: 'danger',
                    label: 'Push bloqueado',
                    meta: 'El navegador rechazo permisos de notificacion.',
                }
              : {
                    tone: 'warning',
                    label: 'Push pendiente',
                    meta: 'La sesion aun no concede permisos.',
                };
    })();
    (['pushStatusIndicator', 'dashboardPushStatus'].forEach((e) => {
        const n = document.getElementById(e);
        n && (n.setAttribute('data-state', t.tone), r(`#${e}`, t.label));
    }),
        ['pushStatusMeta', 'dashboardPushMeta'].forEach((e) => {
            document.getElementById(e) && r(`#${e}`, t.meta);
        }));
}
export {
    kn as $,
    Qt as A,
    Jt as B,
    Pn as C,
    N as D,
    f as E,
    $e as F,
    x as G,
    O as H,
    tt as I,
    te as J,
    Xt as K,
    Gt as L,
    Yt as M,
    ta as N,
    Xn as O,
    Rn as P,
    zn as Q,
    Zn as R,
    Yn as S,
    Gn as T,
    Wn as U,
    Jn as V,
    Hn as W,
    Qn as X,
    Vn as Y,
    Un as Z,
    jn as _,
    n as a,
    wn as a0,
    vn as a1,
    Fn as a2,
    On as a3,
    Ln as a4,
    Fe as a5,
    je as a6,
    xe as a7,
    Oe as a8,
    He as a9,
    ht as aA,
    Kt as aB,
    da as aC,
    Ae as aD,
    Nn as aE,
    na as aF,
    Kn as aG,
    Pe as aa,
    Ie as ab,
    Le as ac,
    Ee as ad,
    Be as ae,
    Me as af,
    Ne as ag,
    De as ah,
    _e as ai,
    Te as aj,
    Zt as ak,
    Wt as al,
    _t as am,
    Tt as an,
    Mt as ao,
    $t as ap,
    At as aq,
    St as ar,
    wt as as,
    j as at,
    oa as au,
    X as av,
    qe as aw,
    ia as ax,
    v as ay,
    ca as az,
    c as b,
    Rt as c,
    fe as d,
    t as e,
    aa as f,
    b as g,
    gt as h,
    z as i,
    H as j,
    pa as k,
    s as l,
    In as m,
    _ as n,
    y as o,
    D as p,
    e as q,
    A as r,
    r as s,
    M as t,
    g as u,
    $ as v,
    yt as w,
    kt as x,
    vt as y,
    Ut as z,
};
