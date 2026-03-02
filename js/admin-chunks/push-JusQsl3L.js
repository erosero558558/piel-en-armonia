function e(e) {
    return String(e ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function t(e, t = document) {
    return t.querySelector(e);
}
function n(e, t = document) {
    return Array.from(t.querySelectorAll(e));
}
function a(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime())
        ? String(e || '')
        : t.toLocaleDateString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
function o(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime())
        ? String(e || '')
        : t.toLocaleString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          });
}
function i(e) {
    const t = Number(e || 0);
    return Number.isFinite(t) ? Math.round(t).toLocaleString('es-EC') : '0';
}
function u(n, a = 'info') {
    const o = t('#toastContainer');
    if (!(o instanceof HTMLElement)) return;
    const i = document.createElement('div');
    ((i.className = `toast ${a}`),
        i.setAttribute('role', 'error' === a ? 'alert' : 'status'),
        (i.innerHTML = `\n        <div class="toast-body">${e(n)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        o.appendChild(i),
        window.setTimeout(() => {
            i.parentElement && i.remove();
        }, 4500));
}
function c(e, n) {
    const a = t(e);
    a && (a.textContent = String(n ?? ''));
}
function s(e, n) {
    const a = t(e);
    a && (a.innerHTML = n);
}
function l() {
    const e = document.activeElement;
    return (
        e instanceof HTMLElement &&
        Boolean(
            e.closest(
                'input, textarea, select, [contenteditable="true"], [role="textbox"]'
            )
        )
    );
}
function r(e) {
    const t = e instanceof Date ? e : new Date(e || '');
    return Number.isNaN(t.getTime())
        ? ''
        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
const d = new Set(),
    m = {
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
let f = structuredClone(m);
function p() {
    return f;
}
function h(e) {
    const t = e(f);
    t &&
        ((f = t),
        d.forEach((e) => {
            try {
                e(f);
            } catch (e) {}
        }));
}
const g = {
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
};
function y(e) {
    const {
        navigateToSection: t,
        focusQuickCommand: n,
        focusCurrentSearch: a,
        runQuickAction: o,
        closeSidebar: i,
        toggleMenu: u,
        dismissQueueSensitiveDialog: c,
        toggleQueueHelp: s,
        queueNumpadAction: r,
    } = e;
    window.addEventListener('keydown', (e) => {
        const d = String(e.key || '').toLowerCase(),
            m = String(e.code || '').toLowerCase();
        if ('Escape' === e.key) {
            if ('function' == typeof c && c()) return;
            return void i();
        }
        if (e.ctrlKey && !e.shiftKey && !e.altKey && 'k' === d)
            return (e.preventDefault(), void n());
        if (!e.ctrlKey && !e.metaKey && !e.altKey && '/' === d)
            return (e.preventDefault(), void a());
        if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const n = m || d;
            if ('keym' === n) return (e.preventDefault(), void u());
            if ('digit0' === n) return (e.preventDefault(), void s());
            if (g[n]) {
                if (l()) return;
                return (e.preventDefault(), void t(g[n]));
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
                ('queue' === p().ui.activeSection &&
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
                return (e.preventDefault(), void o(a[n]));
            }
        }
        const f = p().queue,
            h = Boolean(f.captureCallKeyMode),
            y = f.customCallKey,
            b =
                y &&
                'object' == typeof y &&
                String(y.key || '') === String(e.key || '') &&
                String(y.code || '').toLowerCase() === m &&
                Number(y.location || 0) === Number(e.location || 0);
        if (
            m.startsWith('numpad') ||
            3 === e.location ||
            ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(m) ||
            h ||
            b
        ) {
            if (l()) return;
            Promise.resolve(
                r({ key: e.key, code: e.code, location: e.location })
            ).catch(() => {});
        }
    });
}
function b(e, t = '') {
    try {
        const n = localStorage.getItem(e);
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function q(e, t) {
    try {
        localStorage.setItem(e, String(t));
    } catch (e) {}
}
function w(e, t) {
    try {
        const n = localStorage.getItem(e);
        return n ? JSON.parse(n) : t;
    } catch (e) {
        return t;
    }
}
function k(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function C(e) {
    try {
        return new URL(window.location.href).searchParams.get(e) || '';
    } catch (e) {
        return '';
    }
}
const v = 'themeMode',
    M = new Set(['light', 'dark', 'system']);
function S() {
    const e = String(b(v, 'system') || 'system')
        .trim()
        .toLowerCase();
    return M.has(e) ? e : 'system';
}
function _(e) {
    const t = M.has(e) ? e : 'system';
    q(v, t);
}
function A(e) {
    const t = (function (e) {
        return 'light' === e || 'dark' === e
            ? e
            : window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
    })(e);
    return (
        document.documentElement.setAttribute('data-theme-mode', e),
        document.documentElement.setAttribute('data-theme', t),
        t
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
function N(e, t = 'dashboard') {
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return T.has(n) ? n : t;
}
function $(e = 'dashboard') {
    return N(String(window.location.hash || '').replace(/^#/, ''), e);
}
function B(e) {
    !(function (e) {
        const t = String(e || '').replace(/^#/, ''),
            n = t ? `#${t}` : '';
        window.location.hash !== n &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${n}`
            );
    })(N(e));
}
let E = '';
async function I(e, t = {}) {
    const n = String(t.method || 'GET').toUpperCase(),
        a = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(t.headers || {}) },
        };
    ('GET' !== n && E && (a.headers['X-CSRF-Token'] = E),
        void 0 !== t.body &&
            ((a.headers['Content-Type'] = 'application/json'),
            (a.body = JSON.stringify(t.body))));
    const o = await fetch(e, a),
        i = await o.text();
    let u;
    try {
        u = i ? JSON.parse(i) : {};
    } catch (e) {
        throw new Error(`Respuesta no valida (${o.status})`);
    }
    if (
        ((u = (function (e) {
            return e && 'object' == typeof e ? e : {};
        })(u)),
        !o.ok || !1 === u.ok)
    )
        throw new Error(u.error || u.message || `HTTP ${o.status}`);
    return u;
}
function L(e) {
    E = String(e || '');
}
async function P(e, t = {}) {
    return I(`/api.php?resource=${encodeURIComponent(e)}`, t);
}
async function D(e, t = {}) {
    return I(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
async function z() {
    try {
        const e = await D('status'),
            t = !0 === e.authenticated,
            n = t ? String(e.csrfToken || '') : '';
        return (
            L(n),
            h((e) => ({
                ...e,
                auth: {
                    ...e.auth,
                    authenticated: t,
                    csrfToken: n,
                    requires2FA: !1,
                    lastAuthAt: t ? Date.now() : 0,
                    authMethod: t ? 'session' : '',
                },
            })),
            t
        );
    } catch (e) {
        return !1;
    }
}
async function H(e) {
    const t = String(e || '').trim();
    if (!t) throw new Error('Contrasena requerida');
    const n = await D('login', { method: 'POST', body: { password: t } });
    if (!0 === n.twoFactorRequired)
        return (
            h((e) => ({
                ...e,
                auth: { ...e.auth, requires2FA: !0, authMethod: 'password' },
            })),
            { authenticated: !1, requires2FA: !0 }
        );
    const a = String(n.csrfToken || '');
    return (
        L(a),
        h((e) => ({
            ...e,
            auth: {
                ...e.auth,
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
async function x(e) {
    const t = String(e || '').trim();
    if (!t) throw new Error('Codigo 2FA requerido');
    const n = await D('login-2fa', { method: 'POST', body: { code: t } }),
        a = String(n.csrfToken || '');
    return (
        L(a),
        h((e) => ({
            ...e,
            auth: {
                ...e.auth,
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
async function O() {
    try {
        await D('logout', { method: 'POST' });
    } catch (e) {}
    (L(''),
        h((e) => ({
            ...e,
            auth: {
                ...e.auth,
                authenticated: !1,
                csrfToken: '',
                requires2FA: !1,
                lastAuthAt: 0,
                authMethod: '',
            },
        })));
}
const j = {
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
function K(e) {
    return `<svg class="icon icon-${e}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${j[e] || j.menu}</svg>`;
}
const R = 'appointments',
    V = 'callbacks',
    F = 'reviews',
    Q = 'availability',
    W = 'availability-meta',
    J = 'queue-tickets',
    U = 'queue-meta',
    G = 'health-status';
function X(e) {
    return Array.isArray(e.queue_tickets)
        ? e.queue_tickets
        : Array.isArray(e.queueTickets)
          ? e.queueTickets
          : [];
}
function Y(e) {
    h((t) => {
        return {
            ...t,
            data: {
                ...t.data,
                appointments: e.appointments || [],
                callbacks:
                    ((n = e.callbacks || []),
                    (Array.isArray(n) ? n : []).map((e) => ({
                        ...e,
                        status: String(e.status || '')
                            .toLowerCase()
                            .includes('contact')
                            ? 'contacted'
                            : 'pending',
                    }))),
                reviews: e.reviews || [],
                availability: e.availability || {},
                availabilityMeta: e.availabilityMeta || {},
                queueTickets: e.queueTickets || [],
                queueMeta: e.queueMeta || null,
                funnelMetrics: e.funnelMetrics || t.data.funnelMetrics,
                health: e.health || null,
            },
            ui: { ...t.ui, lastRefreshAt: Date.now() },
        };
        var n;
    });
}
async function Z() {
    try {
        const [e, t] = await Promise.all([
                P('data'),
                P('health').catch(() => null),
            ]),
            n = e.data || {};
        let a = n.funnelMetrics || null;
        if (!a) {
            const e = await P('funnel-metrics').catch(() => null);
            a = e?.data || null;
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
            queueTickets: X(n),
            queueMeta:
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : n.queue_state && 'object' == typeof n.queue_state
                      ? n.queue_state
                      : null,
            funnelMetrics: a,
            health: t && t.ok ? t : null,
        };
        return (
            Y(o),
            (function (e) {
                (k(R, e.appointments || []),
                    k(V, e.callbacks || []),
                    k(F, e.reviews || []),
                    k(Q, e.availability || {}),
                    k(W, e.availabilityMeta || {}),
                    k(J, e.queueTickets || []),
                    k(U, e.queueMeta || null),
                    k(G, e.health || null));
            })(o),
            !0
        );
    } catch (e) {
        return (
            Y({
                appointments: w(R, []),
                callbacks: w(V, []),
                reviews: w(F, []),
                availability: w(Q, {}),
                availabilityMeta: w(W, {}),
                queueTickets: w(J, []),
                queueMeta: w(U, null),
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
function ee() {
    const e = p(),
        t = Number(e.ui.lastRefreshAt || 0);
    if (!t) return 'Datos: sin sincronizar';
    const n = Math.max(0, Math.round((Date.now() - t) / 1e3));
    return n < 60 ? `Datos: hace ${n}s` : `Datos: hace ${Math.round(n / 60)}m`;
}
const te = 'queueStationMode',
    ne = 'queueStationConsultorio',
    ae = 'queueOneTapAdvance',
    oe = 'queueCallKeyBindingV1',
    ie = 'queueNumpadHelpOpen',
    ue = 'queueAdminLastSnapshot',
    ce = new Map([
        [1, !1],
        [2, !1],
    ]);
let se = '';
const le = new Set(['no_show', 'cancelar']);
function re(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function de(e) {
    const t = re(e);
    return ['waiting', 'wait', 'en_espera', 'espera'].includes(t)
        ? 'waiting'
        : ['called', 'calling', 'llamado'].includes(t)
          ? 'called'
          : ['completed', 'complete', 'completar', 'done'].includes(t)
            ? 'completed'
            : [
                    'no_show',
                    'noshow',
                    'no-show',
                    'no show',
                    'no_asistio',
                ].includes(t)
              ? 'no_show'
              : ['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(t)
                ? 'cancelled'
                : t || 'waiting';
}
function me(e) {
    const t = re(e);
    return ['complete', 'completed', 'completar'].includes(t)
        ? 'completar'
        : ['no_show', 'noshow', 'no-show', 'no show'].includes(t)
          ? 'no_show'
          : [
                  'cancel',
                  'cancelled',
                  'canceled',
                  'cancelar',
                  'cancelado',
              ].includes(t)
            ? 'cancelar'
            : ['reasignar', 'reassign'].includes(t)
              ? 'reasignar'
              : ['re-llamar', 'rellamar', 'recall', 'llamar'].includes(t)
                ? 're-llamar'
                : ['liberar', 'release'].includes(t)
                  ? 'liberar'
                  : t;
}
function fe(e) {
    return Array.isArray(e) ? e : [];
}
function pe(e, t = 0) {
    const n = Number(e);
    return Number.isFinite(n) ? n : t;
}
function he(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function ge(...e) {
    for (const t of e) {
        const e = String(t ?? '').trim();
        if (e) return e;
    }
    return '';
}
function ye(e) {
    h((t) => {
        const n = [
            { at: new Date().toISOString(), message: String(e || '') },
            ...(t.queue.activity || []),
        ].slice(0, 30);
        return { ...t, queue: { ...t.queue, activity: n } };
    });
    try {
        je();
    } catch (e) {}
}
function be(e) {
    (q(te, e.queue.stationMode || 'free'),
        q(ne, e.queue.stationConsultorio || 1),
        q(ae, e.queue.oneTap ? '1' : '0'),
        q(ie, e.queue.helpOpen ? '1' : '0'),
        e.queue.customCallKey
            ? k(oe, e.queue.customCallKey)
            : (function (e) {
                  try {
                      localStorage.removeItem(e);
                  } catch (e) {}
              })(oe),
        k(ue, {
            queueMeta: e.data.queueMeta,
            queueTickets: e.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function qe(e, t = 0) {
    const n = Number(e?.id || e?.ticket_id || t + 1);
    return {
        id: n,
        ticketCode: String(e?.ticketCode || e?.ticket_code || `A-${n}`),
        queueType: String(e?.queueType || e?.queue_type || 'walk_in'),
        patientInitials: String(
            e?.patientInitials || e?.patient_initials || '--'
        ),
        priorityClass: String(
            e?.priorityClass || e?.priority_class || 'walk_in'
        ),
        status: de(e?.status || 'waiting'),
        assignedConsultorio:
            2 === Number(e?.assignedConsultorio || e?.assigned_consultorio || 0)
                ? 2
                : 1 ===
                    Number(
                        e?.assignedConsultorio || e?.assigned_consultorio || 0
                    )
                  ? 1
                  : null,
        createdAt: String(
            e?.createdAt || e?.created_at || new Date().toISOString()
        ),
        calledAt: String(e?.calledAt || e?.called_at || ''),
        completedAt: String(e?.completedAt || e?.completed_at || ''),
    };
}
function we(e, t = 0, n = {}) {
    const a = e && 'object' == typeof e ? e : {},
        o = qe({ ...a, ...n }, t);
    return (
        ge(a.createdAt, a.created_at) || (o.createdAt = ''),
        ge(a.priorityClass, a.priority_class) || (o.priorityClass = ''),
        ge(a.queueType, a.queue_type) || (o.queueType = ''),
        ge(a.patientInitials, a.patient_initials) || (o.patientInitials = ''),
        o
    );
}
function ke(e) {
    const t = e.filter((e) => 'waiting' === e.status),
        n = e.filter((e) => 'called' === e.status),
        a = {
            1: n.find((e) => 1 === e.assignedConsultorio) || null,
            2: n.find((e) => 2 === e.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: t.length,
        calledCount: n.length,
        counts: {
            waiting: t.length,
            called: n.length,
            completed: e.filter((e) => 'completed' === e.status).length,
            no_show: e.filter((e) => 'no_show' === e.status).length,
            cancelled: e.filter((e) => 'cancelled' === e.status).length,
        },
        callingNowByConsultorio: a,
        nextTickets: t
            .slice(0, 5)
            .map((e, t) => ({
                id: e.id,
                ticketCode: e.ticketCode,
                patientInitials: e.patientInitials,
                position: t + 1,
            })),
    };
}
function Ce(e, t = []) {
    const n = e && 'object' == typeof e ? e : {},
        a = n.counts && 'object' == typeof n.counts ? n.counts : {},
        o =
            n.callingNowByConsultorio &&
            'object' == typeof n.callingNowByConsultorio
                ? n.callingNowByConsultorio
                : n.calling_now_by_consultorio &&
                    'object' == typeof n.calling_now_by_consultorio
                  ? n.calling_now_by_consultorio
                  : {},
        i = fe(n.callingNow).concat(fe(n.calling_now)),
        u = fe(t).map((e, t) => qe(e, t)),
        c =
            o[1] ||
            o[1] ||
            i.find(
                (e) =>
                    1 ===
                    Number(
                        e?.assignedConsultorio || e?.assigned_consultorio || 0
                    )
            ) ||
            null,
        s =
            o[2] ||
            o[2] ||
            i.find(
                (e) =>
                    2 ===
                    Number(
                        e?.assignedConsultorio || e?.assigned_consultorio || 0
                    )
            ) ||
            null,
        l = c ? we(c, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        r = s ? we(s, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = fe(n.nextTickets)
            .concat(fe(n.next_tickets))
            .map((e, t) =>
                we(
                    {
                        ...e,
                        status: e?.status || 'waiting',
                        assignedConsultorio: null,
                    },
                    t
                )
            ),
        m = u.filter((e) => 'waiting' === e.status).length,
        f = u.filter((e) => 'called' === e.status).length,
        p = Math.max(Number(Boolean(l)) + Number(Boolean(r)), f),
        h = pe(
            n.waitingCount ?? n.waiting_count ?? a.waiting ?? d.length ?? m,
            0
        ),
        g = pe(n.calledCount ?? n.called_count ?? a.called ?? p, 0),
        y = pe(
            a.completed ??
                n.completedCount ??
                n.completed_count ??
                u.filter((e) => 'completed' === e.status).length,
            0
        ),
        b = pe(
            a.no_show ??
                a.noShow ??
                n.noShowCount ??
                n.no_show_count ??
                u.filter((e) => 'no_show' === e.status).length,
            0
        ),
        q = pe(
            a.cancelled ??
                a.canceled ??
                n.cancelledCount ??
                n.cancelled_count ??
                u.filter((e) => 'cancelled' === e.status).length,
            0
        );
    return {
        updatedAt: String(
            n.updatedAt || n.updated_at || new Date().toISOString()
        ),
        waitingCount: h,
        calledCount: g,
        counts: {
            waiting: h,
            called: g,
            completed: y,
            no_show: b,
            cancelled: q,
        },
        callingNowByConsultorio: { 1: l, 2: r },
        nextTickets: d,
    };
}
function ve(e) {
    const t = qe(e, 0);
    return t.id > 0 ? `id:${t.id}` : `code:${re(t.ticketCode || '')}`;
}
function Me(e) {
    const t = Ce(e),
        n = new Map(),
        a = (e) => {
            if (!e) return;
            const t = qe(e, n.size);
            (ge(e?.createdAt, e?.created_at) || (t.createdAt = ''),
                ge(e?.priorityClass, e?.priority_class) ||
                    (t.priorityClass = ''),
                ge(e?.queueType, e?.queue_type) || (t.queueType = ''),
                n.set(ve(t), t));
        },
        o =
            t.callingNowByConsultorio?.[1] ||
            t.callingNowByConsultorio?.[1] ||
            null,
        i =
            t.callingNowByConsultorio?.[2] ||
            t.callingNowByConsultorio?.[2] ||
            null;
    (o && a({ ...o, status: 'called', assignedConsultorio: 1 }),
        i && a({ ...i, status: 'called', assignedConsultorio: 2 }));
    for (const e of fe(t.nextTickets))
        a({ ...e, status: 'waiting', assignedConsultorio: null });
    return Array.from(n.values());
}
function Se() {
    const e = p(),
        t = Array.isArray(e.data.queueTickets)
            ? e.data.queueTickets.map((e, t) => qe(e, t))
            : [];
    return {
        queueTickets: t,
        queueMeta:
            e.data.queueMeta && 'object' == typeof e.data.queueMeta
                ? Ce(e.data.queueMeta, t)
                : ke(t),
    };
}
function _e() {
    const e = p(),
        { queueTickets: t } = Se();
    return (function (e, t) {
        const n = re(t);
        return n
            ? e.filter((e) =>
                  [e.ticketCode, e.patientInitials, e.status, e.queueType].some(
                      (e) => re(e).includes(n)
                  )
              )
            : e;
    })(
        (function (e, t) {
            const n = re(t);
            return 'waiting' === n
                ? e.filter((e) => 'waiting' === e.status)
                : 'called' === n
                  ? e.filter((e) => 'called' === e.status)
                  : 'no_show' === n
                    ? e.filter((e) => 'no_show' === e.status)
                    : 'sla_risk' === n
                      ? e.filter(
                            (e) =>
                                'waiting' === e.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - he(e.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === re(e.priorityClass))
                        )
                      : e;
        })(t, e.queue.filter),
        e.queue.search
    );
}
function Ae(e, t = null) {
    const n = Array.isArray(t) ? t : Se().queueTickets,
        a = new Set(n.map((e) => Number(e.id || 0)).filter((e) => e > 0));
    return [...new Set(fe(e).map((e) => Number(e || 0)))]
        .filter((e) => e > 0 && a.has(e))
        .sort((e, t) => e - t);
}
function Te() {
    return Ae(p().queue.selected || []);
}
function Ne() {
    const e = (function () {
        const e = new Set(Te());
        return e.size
            ? Se().queueTickets.filter((t) => e.has(Number(t.id || 0)))
            : [];
    })();
    return e.length ? e : _e();
}
function $e(e, { render: t = !0 } = {}) {
    (h((t) => ({
        ...t,
        queue: { ...t.queue, selected: Ae(e, t.data.queueTickets || []) },
    })),
        t && Ke());
}
function Be(e) {
    const t = Number(e || 0);
    if (!t) return;
    const n = Te();
    $e(n.includes(t) ? n.filter((e) => e !== t) : [...n, t]);
}
function Ee() {
    $e(_e().map((e) => Number(e.id || 0)));
}
function Ie() {
    $e([]);
}
function Le(t) {
    const n = t.assignedConsultorio ? `C${t.assignedConsultorio}` : '-',
        a = Math.max(0, Math.round((Date.now() - he(t.createdAt)) / 6e4)),
        o = Number(t.id || 0),
        i = new Set(Te()).has(o),
        u = 'called' === t.status,
        c = u && t.assignedConsultorio,
        s = u;
    return `\n        <tr data-queue-id="${o}" class="${i ? 'is-selected' : ''}">\n            <td>\n                <label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${o}" ${i ? 'checked' : ''} />\n                </label>\n            </td>\n            <td>${e(t.ticketCode)}</td>\n            <td>${e(t.queueType)}</td>\n            <td>${e(
        (function (e) {
            switch (de(e)) {
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
                    return String(e || '--');
            }
        })(t.status)
    )}</td>\n            <td>${n}</td>\n            <td>${a} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${s ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(t.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${o}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${o}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function Pe(e) {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        n = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (n && (n.textContent = `Confirmar accion sensible: ${e.action}`),
        h((t) => ({ ...t, queue: { ...t.queue, pendingSensitiveAction: e } })),
        t instanceof HTMLDialogElement && 'function' == typeof t.showModal)
    ) {
        if (((t.hidden = !1), t.removeAttribute('hidden'), !t.open))
            try {
                t.showModal();
            } catch (e) {
                t.setAttribute('open', '');
            }
    } else
        t instanceof HTMLElement &&
            (t.setAttribute('open', ''), (t.hidden = !1));
}
function De() {
    const e = document.getElementById('queueSensitiveConfirmDialog');
    (e instanceof HTMLDialogElement && e.open && e.close(),
        e instanceof HTMLElement &&
            (e.removeAttribute('open'), (e.hidden = !0)),
        h((e) => ({
            ...e,
            queue: { ...e.queue, pendingSensitiveAction: null },
        })));
}
function ze(e, t = null, n = {}) {
    const a = fe(e).map((e, t) => qe(e, t)),
        o = Ce(t && 'object' == typeof t ? t : ke(a), a),
        i = a.filter((e) => 'waiting' === e.status).length,
        u =
            'boolean' == typeof n.fallbackPartial
                ? n.fallbackPartial
                : Number(o.waitingCount || 0) > i,
        c =
            'fallback' === re(n.syncMode)
                ? 'fallback'
                : u
                  ? 'live' === re(n.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (h((e) => ({
        ...e,
        data: { ...e.data, queueTickets: a, queueMeta: o },
        queue: {
            ...e.queue,
            selected: Ae(e.queue.selected || [], a),
            fallbackPartial: u,
            syncMode: c,
        },
    })),
        be(p()),
        Ke());
}
function He(e, t) {
    const n = Number(e || 0),
        a = (p().data.queueTickets || []).map((e, a) => {
            const o = qe(e, a);
            return o.id !== n
                ? o
                : qe('function' == typeof t ? t(o) : { ...o }, a);
        });
    ze(a, ke(a), { fallbackPartial: !1, syncMode: 'live' });
}
function xe(e) {
    (h((t) => ({ ...t, queue: { ...t.queue, ...e } })), be(p()), Ke());
}
function Oe(e) {
    const t = 2 === Number(e || 0) ? 2 : 1;
    return (
        Se().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
function je() {
    const t = p().queue.activity || [];
    s(
        '#queueActivityList',
        t.length
            ? t
                  .map(
                      (t) =>
                          `<li><span>${e(o(t.at))}</span><strong>${e(t.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function Ke() {
    const t = p(),
        { queueMeta: n } = Se(),
        a = _e(),
        o = Te().length,
        i = Ne(),
        u = fe(n.nextTickets),
        l = Number(n.waitingCount || n.counts?.waiting || 0);
    (!(function (e) {
        const t = p(),
            n = Ce(e, t.data.queueTickets || []),
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
            u = o
                ? String(o.ticketCode || o.ticket_code || 'A-000')
                : 'Sin llamado';
        (c(
            '#queueWaitingCountAdmin',
            Number(n.waitingCount || n.counts?.waiting || 0)
        ),
            c(
                '#queueCalledCountAdmin',
                Number(n.calledCount || n.counts?.called || 0)
            ),
            c('#queueC1Now', i),
            c('#queueC2Now', u));
        const s = document.getElementById('queueReleaseC1');
        s instanceof HTMLButtonElement &&
            ((s.hidden = !a),
            (s.textContent = a ? `Liberar C1 · ${i}` : 'Release C1'),
            a
                ? s.setAttribute('data-queue-id', String(Number(a.id || 0)))
                : s.removeAttribute('data-queue-id'));
        const l = document.getElementById('queueReleaseC2');
        l instanceof HTMLButtonElement &&
            ((l.hidden = !o),
            (l.textContent = o ? `Liberar C2 · ${u}` : 'Release C2'),
            o
                ? l.setAttribute('data-queue-id', String(Number(o.id || 0)))
                : l.removeAttribute('data-queue-id'));
        const r = document.getElementById('queueSyncStatus');
        if ('fallback' === re(t.queue.syncMode))
            return (
                c('#queueSyncStatus', 'fallback'),
                void (r && r.setAttribute('data-state', 'fallback'))
            );
        const d = String(n.updatedAt || '').trim();
        if (!d) return;
        const m = Math.max(0, Math.round((Date.now() - he(d)) / 1e3)),
            f = m >= 60;
        if (
            (c('#queueSyncStatus', f ? `Watchdog (${m}s)` : 'vivo'),
            r && r.setAttribute('data-state', f ? 'reconnecting' : 'live'),
            f)
        ) {
            const e = `stale-${Math.floor(m / 15)}`;
            return void (
                e !== se &&
                ((se = e), ye('Watchdog de cola: realtime en reconnecting'))
            );
        }
        se = 'live';
    })(n),
        s(
            '#queueTableBody',
            a.length
                ? a.map(Le).join('')
                : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
        ));
    const r =
        t.queue.fallbackPartial && u.length && l > u.length
            ? `<li><span>-</span><strong>Mostrando primeros ${u.length} de ${l} en espera</strong></li>`
            : '';
    s(
        '#queueNextAdminList',
        u.length
            ? `${r}${u.map((t) => `<li><span>${e(t.ticketCode || t.ticket_code || '--')}</span><strong>${e(t.patientInitials || t.patient_initials || '--')}</strong></li>`).join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
    const d = a.filter(
            (e) =>
                'waiting' === e.status &&
                (Math.max(
                    0,
                    Math.round((Date.now() - he(e.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === re(e.priorityClass))
        ).length,
        m = [d > 0 ? `riesgo: ${d}` : 'sin riesgo'];
    (o > 0 && m.push(`seleccion: ${o}`),
        t.queue.fallbackPartial && m.push('fallback parcial'),
        c('#queueTriageSummary', m.join(' | ')),
        c('#queueSelectedCount', o));
    const f = document.getElementById('queueSelectionChip');
    f instanceof HTMLElement && f.classList.toggle('is-hidden', 0 === o);
    const h = document.getElementById('queueSelectVisibleBtn');
    h instanceof HTMLButtonElement && (h.disabled = 0 === a.length);
    const g = document.getElementById('queueClearSelectionBtn');
    (g instanceof HTMLButtonElement && (g.disabled = 0 === o),
        document
            .querySelectorAll(
                '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
            )
            .forEach((e) => {
                e instanceof HTMLButtonElement && (e.disabled = 0 === i.length);
            }),
        c('#queueStationBadge', `Estación C${t.queue.stationConsultorio}`),
        c(
            '#queueStationModeBadge',
            'locked' === t.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const y = document.getElementById('queuePracticeModeBadge');
    y instanceof HTMLElement && (y.hidden = !t.queue.practiceMode);
    const b = document.getElementById('queueShortcutPanel');
    b instanceof HTMLElement && (b.hidden = !t.queue.helpOpen);
    const q = document.querySelector('[data-action="queue-clear-call-key"]');
    q instanceof HTMLElement && (q.hidden = !t.queue.customCallKey);
    const w = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (w instanceof HTMLElement &&
        (w.setAttribute('aria-pressed', String(Boolean(t.queue.oneTap))),
        (w.textContent = t.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((e) => {
                if (!(e instanceof HTMLButtonElement)) return;
                const n = 2 === Number(e.dataset.queueConsultorio || 1) ? 2 : 1;
                e.disabled =
                    'locked' === t.queue.stationMode &&
                    n !== Number(t.queue.stationConsultorio || 1);
            }));
    const k = Oe(t.queue.stationConsultorio);
    (document
        .querySelectorAll(
            '[data-action="queue-release-station"][data-queue-consultorio]'
        )
        .forEach((e) => {
            if (!(e instanceof HTMLButtonElement)) return;
            const n = 2 === Number(e.dataset.queueConsultorio || 1) ? 2 : 1,
                a = Oe(n);
            ((e.disabled = !a),
                'locked' === t.queue.stationMode &&
                    n !== Number(t.queue.stationConsultorio || 1) &&
                    (e.disabled = !0));
        }),
        k &&
            (m.push(
                `activo: ${k.ticketCode} en C${t.queue.stationConsultorio}`
            ),
            c('#queueTriageSummary', m.join(' | '))),
        je());
}
function Re(e, t) {
    return Object.prototype.hasOwnProperty.call(e || {}, t);
}
function Ve(e, t = {}) {
    const n =
        e?.data?.queueState ||
        e?.data?.queue_state ||
        e?.data?.queueMeta ||
        e?.data ||
        null;
    if (!n || 'object' != typeof n) return;
    const a = (function (e) {
            return e && 'object' == typeof e
                ? Array.isArray(e.queue_tickets)
                    ? e.queue_tickets
                    : Array.isArray(e.queueTickets)
                      ? e.queueTickets
                      : Array.isArray(e.tickets)
                        ? e.tickets
                        : []
                : [];
        })(n),
        o = e?.data?.ticket || null;
    if (
        !(function (e, t, n) {
            if (t.length > 0) return !0;
            if (
                Re(e, 'queue_tickets') ||
                Re(e, 'queueTickets') ||
                Re(e, 'tickets')
            )
                return !0;
            if (n && 'object' == typeof n) return !0;
            if (
                Re(e, 'waitingCount') ||
                Re(e, 'waiting_count') ||
                Re(e, 'calledCount') ||
                Re(e, 'called_count') ||
                Re(e, 'completedCount') ||
                Re(e, 'completed_count') ||
                Re(e, 'noShowCount') ||
                Re(e, 'no_show_count') ||
                Re(e, 'cancelledCount') ||
                Re(e, 'cancelled_count')
            )
                return !0;
            const a =
                e?.counts && 'object' == typeof e.counts ? e.counts : null;
            if (
                a &&
                (Re(a, 'waiting') ||
                    Re(a, 'called') ||
                    Re(a, 'completed') ||
                    Re(a, 'no_show') ||
                    Re(a, 'noShow') ||
                    Re(a, 'cancelled') ||
                    Re(a, 'canceled'))
            )
                return !0;
            if (Re(e, 'nextTickets') || Re(e, 'next_tickets')) return !0;
            const o =
                e?.callingNowByConsultorio &&
                'object' == typeof e.callingNowByConsultorio
                    ? e.callingNowByConsultorio
                    : e?.calling_now_by_consultorio &&
                        'object' == typeof e.calling_now_by_consultorio
                      ? e.calling_now_by_consultorio
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
                ) || fe(e?.callingNow).concat(fe(e?.calling_now)).some(Boolean)
            );
        })(n, a, o)
    )
        return;
    const i = 'fallback' === re(t.syncMode) ? 'fallback' : 'live',
        u = (p().data.queueTickets || []).map((e, t) => qe(e, t)),
        c = Ce(n, u),
        s = (function (e) {
            const t =
                    e?.counts && 'object' == typeof e.counts ? e.counts : null,
                n =
                    Re(e, 'waitingCount') ||
                    Re(e, 'waiting_count') ||
                    Boolean(t && Re(t, 'waiting')),
                a =
                    Re(e, 'calledCount') ||
                    Re(e, 'called_count') ||
                    Boolean(t && Re(t, 'called')),
                o = Re(e, 'nextTickets') || Re(e, 'next_tickets'),
                i =
                    Re(e, 'callingNowByConsultorio') ||
                    Re(e, 'calling_now_by_consultorio') ||
                    Re(e, 'callingNow') ||
                    Re(e, 'calling_now');
            return { waiting: n || o, called: a || i };
        })(n),
        l = Me(c),
        r = Boolean(o && 'object' == typeof o);
    if (!(a.length || l.length || r || s.waiting || s.called)) return;
    const d =
            Number(c.waitingCount || 0) >
            l.filter((e) => 'waiting' === e.status).length,
        m = new Map(u.map((e) => [ve(e), e]));
    if (a.length) ze(a, c, { fallbackPartial: !1, syncMode: i });
    else {
        !(function (e, t, n) {
            const a = t.callingNowByConsultorio || {},
                o = Number(t.calledCount || t.counts?.called || 0),
                i = Number(t.waitingCount || t.counts?.waiting || 0),
                u = fe(t.nextTickets),
                c = new Set(),
                s = a[1] || a[1] || null,
                l = a[2] || a[2] || null;
            (s && c.add(ve(s)), l && c.add(ve(l)));
            const r = new Set(u.map((e) => ve(e))),
                d = c.size > 0 || 0 === o,
                m = r.size > 0 || 0 === i,
                f = r.size > 0 && i > r.size;
            for (const [t, a] of e.entries()) {
                const o = qe(a, 0);
                n.called && d && 'called' === o.status && !c.has(t)
                    ? e.set(
                          t,
                          qe(
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
                      m &&
                      'waiting' === o.status &&
                      (i <= 0 ? e.delete(t) : f || r.has(t) || e.delete(t));
            }
        })(m, c, s);
        for (const e of l) {
            const t = ve(e),
                n = m.get(t) || null,
                a = ge(e.createdAt, e.created_at, n?.createdAt, n?.created_at),
                o = ge(
                    e.priorityClass,
                    e.priority_class,
                    n?.priorityClass,
                    n?.priority_class,
                    'walk_in'
                ),
                i = ge(
                    e.queueType,
                    e.queue_type,
                    n?.queueType,
                    n?.queue_type,
                    'walk_in'
                ),
                u = ge(
                    e.patientInitials,
                    e.patient_initials,
                    n?.patientInitials,
                    n?.patient_initials,
                    '--'
                );
            m.set(
                t,
                qe(
                    {
                        ...(n || {}),
                        ...e,
                        status: e.status,
                        assignedConsultorio: e.assignedConsultorio,
                        createdAt: a || new Date().toISOString(),
                        priorityClass: o,
                        queueType: i,
                        patientInitials: u,
                    },
                    m.size
                )
            );
        }
        if (r) {
            const e = qe(o, m.size),
                t = ve(e),
                n = m.get(t) || null;
            m.set(t, qe({ ...(n || {}), ...e }, m.size));
        }
        ze(Array.from(m.values()), c, { fallbackPartial: d, syncMode: i });
    }
}
function Fe(e, t, n = void 0) {
    He(e, (e) => ({
        ...e,
        status: t,
        assignedConsultorio: void 0 === n ? e.assignedConsultorio : n,
        calledAt:
            'called' === t
                ? new Date().toISOString()
                : 'waiting' === t
                  ? ''
                  : e.calledAt,
        completedAt:
            'completed' === t || 'no_show' === t || 'cancelled' === t
                ? new Date().toISOString()
                : '',
    }));
}
async function Qe() {
    try {
        (Ve(await P('queue-state'), { syncMode: 'live' }),
            ye('Queue refresh realizado'));
    } catch (e) {
        ye('Queue refresh con error');
        const t = w(ue, null);
        t?.queueTickets &&
            ze(t.queueTickets, t.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            });
    }
}
function We(e) {
    xe({ filter: re(e) || 'all', selected: [] });
}
function Je(e) {
    xe({ search: String(e || ''), selected: [] });
}
function Ue() {
    xe({ search: '', selected: [] });
    const e = document.getElementById('queueSearchInput');
    e instanceof HTMLInputElement && (e.value = '');
}
async function Ge(e) {
    const t = 2 === Number(e || 0) ? 2 : 1,
        n = p();
    if (!ce.get(t)) {
        if (
            'locked' === n.queue.stationMode &&
            n.queue.stationConsultorio !== t
        )
            return (
                ye(`Llamado bloqueado para C${t} por lock de estacion`),
                void u('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (n.queue.practiceMode) {
            const e = (function (e) {
                return Se().queueTickets.find(
                    (t) =>
                        'waiting' === t.status &&
                        (!t.assignedConsultorio || t.assignedConsultorio === e)
                );
            })(t);
            return e
                ? ((function (e, t) {
                      He(e, (e) => ({
                          ...e,
                          status: 'called',
                          assignedConsultorio: t,
                          calledAt: new Date().toISOString(),
                      }));
                  })(e.id, t),
                  void ye(`Practica: llamado ${e.ticketCode} en C${t}`))
                : void ye('Practica: sin tickets en espera');
        }
        ce.set(t, !0);
        try {
            (Ve(
                await P('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: t },
                }),
                { syncMode: 'live' }
            ),
                ye(`Llamado C${t} ejecutado`));
        } catch (e) {
            (ye(`Error llamando siguiente en C${t}`),
                u(`Error llamando siguiente en C${t}`, 'error'));
        } finally {
            ce.set(t, !1);
        }
    }
}
async function Xe({ ticketId: e, action: t, consultorio: n }) {
    const a = Number(e || 0),
        o = me(t);
    if (a && o)
        return p().queue.practiceMode
            ? ('reasignar' === o || 're-llamar' === o || 'rellamar' === o
                  ? Fe(a, 'called', 2 === Number(n || 1) ? 2 : 1)
                  : 'liberar' === o
                    ? Fe(a, 'waiting', null)
                    : 'completar' === o
                      ? Fe(a, 'completed')
                      : 'no_show' === o
                        ? Fe(a, 'no_show')
                        : 'cancelar' === o && Fe(a, 'cancelled'),
              void ye(`Practica: accion ${o} en ticket ${a}`))
            : (Ve(
                  await P('queue-ticket', {
                      method: 'PATCH',
                      body: { id: a, action: o, consultorio: Number(n || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void ye(`Accion ${o} ticket ${a}`));
}
async function Ye(e, t, n = 0) {
    const a = {
            ticketId: Number(e || 0),
            action: me(t),
            consultorio: Number(n || 0),
        },
        o = p(),
        i = (function (e) {
            const t = Number(e || 0);
            return (
                (t && Se().queueTickets.find((e) => Number(e.id || 0) === t)) ||
                null
            );
        })(a.ticketId);
    if (
        !o.queue.practiceMode &&
        le.has(a.action) &&
        (function (e, t) {
            const n = me(e);
            if ('cancelar' === n) return !0;
            if ('no_show' !== n) return !1;
            const a = t || null;
            return (
                !a ||
                'called' === de(a.status) ||
                Number(a.assignedConsultorio || 0) > 0
            );
        })(a.action, i)
    )
        return (Pe(a), void ye(`Accion ${a.action} pendiente de confirmacion`));
    await Xe(a);
}
async function Ze(e) {
    const t = 2 === Number(e || 0) ? 2 : 1,
        n = Oe(t);
    n
        ? await Ye(n.id, 'liberar', t)
        : ye(`Sin ticket activo para liberar en C${t}`);
}
async function et() {
    const e = p().queue.pendingSensitiveAction;
    e ? (De(), await Xe(e)) : De();
}
function tt() {
    (De(), ye('Accion sensible cancelada'));
}
function nt() {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        t = p().queue.pendingSensitiveAction;
    return !(
        (!Boolean(t) &&
            !(e instanceof HTMLDialogElement
                ? e.open
                : e instanceof HTMLElement &&
                  (!e.hidden || e.hasAttribute('open')))) ||
        (tt(), 0)
    );
}
async function at(e) {
    const t = Ne(),
        n = me(e);
    if (t.length) {
        if (le.has(n)) {
            const e =
                'no_show' === n
                    ? 'No show'
                    : 'completar' === n || 'completed' === n
                      ? 'Completar'
                      : 'Cancelar';
            if (!window.confirm(`${e}: confirmar acción masiva`)) return;
        }
        for (const e of t)
            try {
                await Xe({
                    ticketId: e.id,
                    action: n,
                    consultorio:
                        e.assignedConsultorio || p().queue.stationConsultorio,
                });
            } catch (e) {}
        (Ie(), ye(`Bulk ${n} sobre ${t.length} tickets`));
    }
}
async function ot(e) {
    const t = Number(e || 0);
    t &&
        (p().queue.practiceMode
            ? ye(`Practica: reprint ticket ${t}`)
            : (await P('queue-reprint', { method: 'POST', body: { id: t } }),
              ye(`Reimpresion ticket ${t}`)));
}
async function it() {
    const e = Ne();
    for (const t of e)
        try {
            await ot(t.id);
        } catch (e) {}
    (Ie(), ye(`Bulk reimpresion ${e.length}`));
}
function ut() {
    xe({ helpOpen: !p().queue.helpOpen });
}
function ct() {
    xe({ oneTap: !p().queue.oneTap });
}
function st(e) {
    const t = Boolean(e);
    (De(),
        xe({ practiceMode: t }),
        ye(t ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function lt(e) {
    const t = 2 === Number(e || 0) ? 2 : 1;
    (xe({ stationMode: 'locked', stationConsultorio: t }),
        ye(`Estacion bloqueada en C${t}`));
}
function rt(e) {
    if ('free' === re(e))
        return (xe({ stationMode: 'free' }), void ye('Estacion en modo libre'));
    xe({ stationMode: 'locked' });
}
function dt() {
    (xe({ captureCallKeyMode: !0 }),
        u('Calibración activa: presiona la tecla externa', 'info'));
}
function mt() {
    window.confirm('¿Quitar tecla externa calibrada?') &&
        (xe({ customCallKey: null, captureCallKeyMode: !1 }),
        u('Tecla externa eliminada', 'success'));
}
function ft() {
    const e = p(),
        t = Number(e.queue.stationConsultorio || 1);
    return (
        Se().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
async function pt(e) {
    const t = p();
    if (t.queue.captureCallKeyMode) {
        const t = {
            key: String(e.key || ''),
            code: String(e.code || ''),
            location: Number(e.location || 0),
        };
        return (
            xe({ customCallKey: t, captureCallKeyMode: !1 }),
            u('Tecla externa guardada', 'success'),
            void ye(`Tecla externa calibrada: ${t.code}`)
        );
    }
    if (
        (function (e, t) {
            return (
                !(!t || 'object' != typeof t) &&
                re(t.code) === re(e.code) &&
                String(t.key || '') === String(e.key || '') &&
                Number(t.location || 0) === Number(e.location || 0)
            );
        })(e, t.queue.customCallKey)
    )
        return void (await Ge(t.queue.stationConsultorio));
    const n = re(e.code),
        a = re(e.key),
        o =
            'numpadenter' === n ||
            'kpenter' === n ||
            ('enter' === a && 3 === Number(e.location || 0));
    if (o && t.queue.pendingSensitiveAction) await et();
    else {
        if ('numpad2' === n || '2' === a)
            return 'locked' === t.queue.stationMode &&
                2 !== t.queue.stationConsultorio
                ? (u('Cambio bloqueado por modo estación', 'warning'),
                  void ye('Cambio de estación bloqueado por lock'))
                : (xe({ stationConsultorio: 2 }),
                  void ye('Numpad: estacion C2'));
        if ('numpad1' === n || '1' === a)
            return 'locked' === t.queue.stationMode &&
                1 !== t.queue.stationConsultorio
                ? (u('Cambio bloqueado por modo estación', 'warning'),
                  void ye('Cambio de estación bloqueado por lock'))
                : (xe({ stationConsultorio: 1 }),
                  void ye('Numpad: estacion C1'));
        if (o) {
            if (t.queue.oneTap) {
                const e = ft();
                e &&
                    (await Xe({
                        ticketId: e.id,
                        action: 'completar',
                        consultorio: t.queue.stationConsultorio,
                    }));
            }
            await Ge(t.queue.stationConsultorio);
        } else {
            if (
                'numpaddecimal' === n ||
                'kpdecimal' === n ||
                'decimal' === a ||
                ',' === a ||
                '.' === a
            ) {
                const e = ft();
                return void (
                    e &&
                    Pe({
                        ticketId: e.id,
                        action: 'completar',
                        consultorio: t.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadsubtract' === n || 'kpsubtract' === n || '-' === a) {
                const e = ft();
                return void (
                    e &&
                    Pe({
                        ticketId: e.id,
                        action: 'no_show',
                        consultorio: t.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadadd' === n || 'kpadd' === n || '+' === a) {
                const e = ft();
                e &&
                    (await Xe({
                        ticketId: e.id,
                        action: 're-llamar',
                        consultorio: t.queue.stationConsultorio,
                    }),
                    ye(`Re-llamar ${e.ticketCode}`),
                    u(`Re-llamar ${e.ticketCode}`, 'info'));
            }
        }
    }
}
function ht() {
    const e = {
            stationMode: 'locked' === re(b(te, 'free')) ? 'locked' : 'free',
            stationConsultorio: 2 === Number(b(ne, '1')) ? 2 : 1,
            oneTap: '1' === b(ae, '0'),
            helpOpen: '1' === b(ie, '0'),
            customCallKey: w(oe, null),
        },
        t = re(C('station')),
        n = re(C('lock')),
        a = re(C('one_tap')),
        o =
            'c2' === t || '2' === t
                ? 2
                : 'c1' === t || '1' === t
                  ? 1
                  : e.stationConsultorio,
        i = '1' === n || 'true' === n ? 'locked' : e.stationMode,
        u =
            '1' === a ||
            'true' === a ||
            ('0' !== a && 'false' !== a && e.oneTap);
    (h((t) => ({
        ...t,
        queue: {
            ...t.queue,
            stationMode: i,
            stationConsultorio: o,
            oneTap: u,
            helpOpen: e.helpOpen,
            customCallKey:
                e.customCallKey && 'object' == typeof e.customCallKey
                    ? e.customCallKey
                    : null,
        },
    })),
        be(p()));
}
function gt() {
    const e = p();
    return (
        'fallback' !== re(e.queue.syncMode) && !Boolean(e.queue.fallbackPartial)
    );
}
async function yt() {
    const e = p(),
        t = Array.isArray(e.data.queueTickets)
            ? e.data.queueTickets.map((e, t) => qe(e, t))
            : [],
        n =
            e.data.queueMeta && 'object' == typeof e.data.queueMeta
                ? Ce(e.data.queueMeta, t)
                : null;
    if (t.length)
        return void ze(t, n || null, { fallbackPartial: !1, syncMode: 'live' });
    const a = n ? Me(n) : [];
    if (a.length)
        return (
            ze(a, n, { fallbackPartial: !0, syncMode: 'fallback' }),
            void ye('Queue fallback parcial desde metadata')
        );
    if ((await Qe(), (p().data.queueTickets || []).length)) return;
    const o = w(ue, null);
    if (o?.queueTickets?.length)
        return (
            ze(o.queueTickets, o.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            }),
            void ye('Queue fallback desde snapshot local')
        );
    ze([], null, { fallbackPartial: !1, syncMode: 'live' });
}
async function bt() {
    const e = (function () {
        const e = 'Notification' in window,
            t = 'serviceWorker' in navigator,
            n = 'PushManager' in window;
        if (!e)
            return {
                tone: 'neutral',
                label: 'Push no disponible',
                meta: 'Este navegador no soporta notificaciones.',
            };
        const a = String(Notification.permission || 'default');
        return 'granted' === a
            ? {
                  tone: 'success',
                  label: t && n ? 'Push listo' : 'Push parcial',
                  meta:
                      t && n
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
    (['pushStatusIndicator', 'dashboardPushStatus'].forEach((t) => {
        const n = document.getElementById(t);
        n && (n.setAttribute('data-state', e.tone), c(`#${t}`, e.label));
    }),
        ['pushStatusMeta', 'dashboardPushMeta'].forEach((t) => {
            document.getElementById(t) && c(`#${t}`, e.meta);
        }));
}
export {
    yt as $,
    $ as A,
    x as B,
    H as C,
    ee as D,
    mt as E,
    dt as F,
    tt as G,
    et as H,
    rt as I,
    lt as J,
    st as K,
    ct as L,
    ut as M,
    Ue as N,
    it as O,
    at as P,
    ot as Q,
    Ye as R,
    Ie as S,
    Ee as T,
    Be as U,
    Ze as V,
    Ge as W,
    Qe as X,
    O as Y,
    gt as Z,
    Z as _,
    n as a,
    q as a0,
    Ke as a1,
    pt as a2,
    nt as a3,
    s as b,
    P as c,
    o as d,
    e,
    a as f,
    p as g,
    i as h,
    K as i,
    ht as j,
    y as k,
    z as l,
    bt as m,
    u as n,
    We as o,
    N as p,
    t as q,
    S as r,
    c as s,
    r as t,
    h as u,
    b as v,
    B as w,
    A as x,
    _ as y,
    Je as z,
};
