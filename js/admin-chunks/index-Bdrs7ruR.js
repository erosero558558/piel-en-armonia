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
function a(t, e = document) {
    return Array.from(e.querySelectorAll(t));
}
function n(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime())
        ? String(t || '')
        : e.toLocaleDateString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
function i(t) {
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
function o(t) {
    const e = Number(t || 0);
    return Number.isFinite(e) ? Math.round(e).toLocaleString('es-EC') : '0';
}
function s(a, n = 'info') {
    const i = e('#toastContainer');
    if (!(i instanceof HTMLElement)) return;
    const o = document.createElement('div');
    ((o.className = `toast ${n}`),
        o.setAttribute('role', 'error' === n ? 'alert' : 'status'),
        (o.innerHTML = `\n        <div class="toast-body">${t(a)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        i.appendChild(o),
        window.setTimeout(() => {
            o.parentElement && o.remove();
        }, 4500));
}
function l(t, a) {
    const n = e(t);
    n && (n.textContent = String(a ?? ''));
}
function c(t, a) {
    const n = e(t);
    n && (n.innerHTML = a);
}
function r() {
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
function b() {
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
function f(t, e = '') {
    try {
        const a = localStorage.getItem(t);
        return null === a ? e : a;
    } catch (t) {
        return e;
    }
}
function y(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function v(t, e) {
    try {
        const a = localStorage.getItem(t);
        return a ? JSON.parse(a) : e;
    } catch (t) {
        return e;
    }
}
function k(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function w(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const S = 'themeMode',
    C = new Set(['light', 'dark', 'system']);
const q = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function A(t, e = 'dashboard') {
    const a = String(t || '')
        .trim()
        .toLowerCase();
    return q.has(a) ? a : e;
}
function M(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            a = e ? `#${e}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(A(t));
}
let T = '';
async function $(t, e = {}) {
    const a = String(e.method || 'GET').toUpperCase(),
        n = {
            method: a,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== a && T && (n.headers['X-CSRF-Token'] = T),
        void 0 !== e.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(e.body))));
    const i = await fetch(t, n),
        o = await i.text();
    let s;
    try {
        s = o ? JSON.parse(o) : {};
    } catch (t) {
        throw new Error(`Respuesta no valida (${i.status})`);
    }
    if (
        ((s = (function (t) {
            return t && 'object' == typeof t ? t : {};
        })(s)),
        !i.ok || !1 === s.ok)
    )
        throw new Error(s.error || s.message || `HTTP ${i.status}`);
    return s;
}
function _(t) {
    T = String(t || '');
}
async function L(t, e = {}) {
    return $(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function N(t, e = {}) {
    return $(`/admin-auth.php?action=${encodeURIComponent(t)}`, e);
}
const E = {
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
function B(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${E[t] || E.menu}</svg>`;
}
const D = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    },
    x = {
        dashboard: {
            eyebrow: 'Control Deck',
            title: 'Vista general operativa',
            summary: 'Supervisa agenda, callbacks y cola desde un solo frente.',
            actions: [
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Transferencias',
                    meta: 'Revisar pagos por validar',
                    shortcut: 'Alt+Shift+T',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Callbacks',
                    meta: 'Atender pendientes',
                    shortcut: 'Alt+Shift+P',
                },
                {
                    action: 'refresh-admin-data',
                    label: 'Sincronizar',
                    meta: 'Refrescar tablero',
                    shortcut: 'Ctrl+K',
                },
            ],
        },
        appointments: {
            eyebrow: 'Agenda',
            title: 'Triage de citas',
            summary:
                'Filtra transferencias, no show y carga inmediata de agenda.',
            actions: [
                {
                    action: 'clear-appointment-filters',
                    label: 'Limpiar filtros',
                    meta: 'Volver a la vista completa',
                    shortcut: 'Reset',
                },
                {
                    action: 'export-csv',
                    label: 'Exportar CSV',
                    meta: 'Descargar corte operativo',
                    shortcut: 'CSV',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cruzar citas con llamadas',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        callbacks: {
            eyebrow: 'Triage',
            title: 'Callbacks accionables',
            summary:
                'Prioriza SLA, resuelve pendientes y escala casos urgentes.',
            actions: [
                {
                    action: 'callbacks-triage-next',
                    label: 'Siguiente llamada',
                    meta: 'Enfocar contacto prioritario',
                    shortcut: 'Next',
                },
                {
                    action: 'context-open-callbacks-next',
                    label: 'Ir al siguiente',
                    meta: 'Abrir tarjeta prioritaria',
                    shortcut: 'Alt+Shift+3',
                },
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Cruzar citas',
                    meta: 'Ver pagos pendientes',
                    shortcut: 'Alt+Shift+2',
                },
            ],
        },
        reviews: {
            eyebrow: 'Calidad',
            title: 'Lectura de resenas',
            summary:
                'Detecta tono, volumen reciente y feedback util del paciente.',
            actions: [
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar',
                    meta: 'Sincronizar resenas',
                    shortcut: 'Sync',
                },
                {
                    action: 'context-open-dashboard',
                    label: 'Volver al dashboard',
                    meta: 'Regresar al resumen',
                    shortcut: 'Alt+Shift+1',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cerrar el loop operativo',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        availability: {
            eyebrow: 'Calendario',
            title: 'Planeacion de disponibilidad',
            summary:
                'Gestiona slots, duplicados y semanas futuras sin perder contexto.',
            actions: [
                {
                    action: 'context-availability-today',
                    label: 'Ir a hoy',
                    meta: 'Volver al dia actual',
                    shortcut: 'Today',
                },
                {
                    action: 'context-availability-next',
                    label: 'Siguiente con slots',
                    meta: 'Buscar el siguiente hueco',
                    shortcut: 'Next',
                },
                {
                    action: 'context-copy-availability-day',
                    label: 'Copiar dia',
                    meta: 'Duplicar jornada seleccionada',
                    shortcut: 'Copy',
                },
            ],
        },
        queue: {
            eyebrow: 'Operacion Sala',
            title: 'Control de turnero',
            summary: 'Despacha C1/C2, vigila SLA y ejecuta acciones sensibles.',
            actions: [
                {
                    action: 'queue-call-next',
                    label: 'Llamar C1',
                    meta: 'Despachar siguiente ticket',
                    shortcut: 'C1',
                    queueConsultorio: '1',
                },
                {
                    action: 'queue-call-next',
                    label: 'Llamar C2',
                    meta: 'Despachar consultorio 2',
                    shortcut: 'C2',
                    queueConsultorio: '2',
                },
                {
                    action: 'queue-refresh-state',
                    label: 'Refrescar cola',
                    meta: 'Sincronizar estado operativo',
                    shortcut: 'Sync',
                },
            ],
        },
    };
function I(t, e, a, n = !1) {
    return `\n        <button\n            type="button"\n            class="admin-quick-nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            aria-pressed="${n ? 'true' : 'false'}"\n        >\n            <span>${e}</span>\n            <span class="admin-quick-nav-shortcut">${a}</span>\n        </button>\n    `;
}
function P(t, e, a, n = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${B(a)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function H() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function F() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function O(t) {
    (a('.admin-section').forEach((e) => {
        e.classList.toggle('active', e.id === t);
    }),
        a('.nav-item[data-section]').forEach((e) => {
            const a = e.dataset.section === t;
            (e.classList.toggle('active', a),
                a
                    ? e.setAttribute('aria-current', 'page')
                    : e.removeAttribute('aria-current'));
        }),
        a('.admin-quick-nav-item[data-section]').forEach((e) => {
            const a = e.dataset.section === t;
            (e.classList.toggle('active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
    const n = D[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = n);
}
function R(t) {
    const a = e('#group2FA'),
        n = e('#adminLoginStepSummary'),
        i = e('#adminLoginStepEyebrow'),
        o = e('#adminLoginStepTitle'),
        s = e('#adminLoginSupportCopy'),
        l = e('#loginReset2FABtn'),
        c = e('#loginForm');
    a &&
        (a.classList.toggle('is-hidden', !t),
        c?.classList.toggle('is-2fa-stage', Boolean(t)),
        l?.classList.toggle('is-hidden', !t),
        i &&
            (i.textContent = t
                ? 'Verificacion secundaria'
                : 'Ingreso protegido'),
        o &&
            (o.textContent = t
                ? 'Confirma el codigo 2FA'
                : 'Acceso de administrador'),
        n &&
            (n.textContent = t
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        s &&
            (s.textContent = t
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        j(!1));
}
function z({
    tone: t = 'neutral',
    title: a = 'Proteccion activa',
    message: n = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = e('#adminLoginStatusCard'),
        o = e('#adminLoginStatusTitle'),
        s = e('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', t),
        o && (o.textContent = a),
        s && (s.textContent = n));
}
function j(t) {
    const a = e('#loginBtn'),
        n = e('#loginReset2FABtn'),
        i = e('#adminPassword'),
        o = e('#admin2FACode'),
        s = e('#group2FA'),
        l = Boolean(s && !s.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(t) || l),
        o instanceof HTMLInputElement && (o.disabled = Boolean(t) || !l),
        a instanceof HTMLButtonElement &&
            ((a.disabled = Boolean(t)),
            (a.textContent = t
                ? l
                    ? 'Verificando...'
                    : 'Ingresando...'
                : l
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        n instanceof HTMLButtonElement && (n.disabled = Boolean(t)));
}
function V({ clearPassword: t = !1 } = {}) {
    const a = e('#adminPassword'),
        n = e('#admin2FACode');
    (a instanceof HTMLInputElement && t && (a.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function U(t = 'password') {
    const a = e('2fa' === t ? '#admin2FACode' : '#adminPassword');
    a instanceof HTMLInputElement && (a.focus(), a.select?.());
}
function K(a) {
    const n = x[a?.ui?.activeSection || 'dashboard'] || x.dashboard,
        i = a?.auth && 'object' == typeof a.auth ? a.auth : {},
        o = Array.isArray(a?.data?.appointments) ? a.data.appointments : [],
        s = Array.isArray(a?.data?.callbacks) ? a.data.callbacks : [],
        r = Array.isArray(a?.data?.reviews) ? a.data.reviews : [],
        u =
            a?.data?.availability && 'object' == typeof a.data.availability
                ? a.data.availability
                : {},
        d = Array.isArray(a?.data?.queueTickets) ? a.data.queueTickets : [],
        p =
            a?.data?.queueMeta && 'object' == typeof a.data.queueMeta
                ? a.data.queueMeta
                : null;
    (l('#adminSectionEyebrow', n.eyebrow),
        l('#adminContextTitle', n.title),
        l('#adminContextSummary', n.summary),
        c(
            '#adminContextActions',
            n.actions
                .map((e) =>
                    (function (e) {
                        return `\n        <button type="button" class="sony-context-action" ${[`data-action="${t(e.action)}"`, e.queueConsultorio ? `data-queue-consultorio="${t(e.queueConsultorio)}"` : '', e.filterValue ? `data-filter-value="${t(e.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${t(e.label)}</strong>\n                <small>${t(e.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${t(e.shortcut || '')}</span>\n        </button>\n    `;
                    })(e)
                )
                .join('')
        ),
        l(
            '#adminSyncState',
            (function (t) {
                const e = Number(t || 0);
                return e
                    ? `Ultima carga ${new Date(e).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Listo para primera sincronizacion';
            })(a?.ui?.lastRefreshAt || 0)
        ));
    const m = (function (t) {
            return t.filter((t) => {
                const e = String(
                    t.paymentStatus || t.payment_status || ''
                ).toLowerCase();
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(o),
        b = (function (t) {
            return t.filter((t) => {
                const e = String(t.status || '')
                    .toLowerCase()
                    .trim();
                return 'pending' === e || 'pendiente' === e;
            }).length;
        })(s),
        g = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(u),
        h = (function (t, e) {
            return e && Number.isFinite(Number(e.waitingCount))
                ? Math.max(0, Number(e.waitingCount))
                : (Array.isArray(t) ? t : []).filter(
                      (t) => 'waiting' === String(t.status || '').toLowerCase()
                  ).length;
        })(d, p);
    (l('#dashboardBadge', m + b),
        l('#appointmentsBadge', o.length),
        l('#callbacksBadge', b),
        l('#reviewsBadge', r.length),
        l('#availabilityBadge', g),
        l('#queueBadge', h));
    const f = e('#adminSessionTile'),
        y = i.authenticated
            ? 'Sesion activa'
            : i.requires2FA
              ? 'Verificacion 2FA'
              : 'No autenticada',
        v = i.authenticated ? 'success' : i.requires2FA ? 'warning' : 'neutral';
    (f?.setAttribute('data-state', v),
        l('#adminSessionState', y),
        l(
            '#adminSessionMeta',
            (function (t) {
                const e = t && 'object' == typeof t ? t : {};
                if (e.authenticated) {
                    const t =
                            {
                                session: 'sesion restaurada',
                                password: 'clave validada',
                                '2fa': '2FA validado',
                            }[String(e.authMethod || '')] || 'acceso validado',
                        a = Number(e.lastAuthAt || 0);
                    return a
                        ? `Protegida por ${t}. ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${t}.`;
                }
                return e.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(i)
        ));
}
const Q = 'appointments',
    W = 'callbacks',
    G = 'reviews',
    J = 'availability',
    Y = 'availability-meta',
    Z = 'queue-tickets',
    X = 'queue-meta',
    tt = 'health-status';
function et(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function at(t) {
    g((e) => {
        return {
            ...e,
            data: {
                ...e.data,
                appointments: t.appointments || [],
                callbacks:
                    ((a = t.callbacks || []),
                    (Array.isArray(a) ? a : []).map((t) => ({
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
        var a;
    });
}
function nt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function it(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function ot(t) {
    return nt(t.paymentStatus || t.payment_status || '');
}
function st(t) {
    return nt(t);
}
function lt(t, e = '-') {
    const a = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return a
        ? a
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : e;
}
function ct(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[nt(t)] || lt(t, 'Pendiente')
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
        }[nt(t)] || lt(t, 'Pendiente')
    );
}
function ut(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        a = Math.abs(e);
    return e < 0
        ? a < 60
            ? `Hace ${a} min`
            : a < 1440
              ? `Hace ${Math.round(a / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function dt(t) {
    const e = it(t);
    if (!e) return !1;
    const a = new Date(e),
        n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function pt(t) {
    const e = it(t);
    if (!e) return !1;
    const a = e - Date.now();
    return a >= 0 && a <= 1728e5;
}
function mt(t) {
    const e = ot(t),
        a = st(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function bt(t, e) {
    const a = nt(e);
    return 'pending_transfer' === a
        ? t.filter((t) => {
              const e = ot(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === a
          ? t.filter(pt)
          : 'no_show' === a
            ? t.filter((t) => 'no_show' === st(t.status))
            : 'triage_attention' === a
              ? t.filter(mt)
              : t;
}
function gt(t) {
    const e = t
        .filter((t) => bt([t], 'pending_transfer').length > 0)
        .sort((t, e) => it(t) - it(e))[0];
    if (e)
        return {
            item: e,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y libera la agenda antes del check-in.',
            tags: ['Pago por validar', 'WhatsApp listo'],
        };
    const a = t
        .filter((t) => 'no_show' === st(t.status))
        .sort((t, e) => it(t) - it(e))[0];
    if (a)
        return {
            item: a,
            label: 'Incidencia abierta',
            hint: 'Confirma si requiere seguimiento o reprogramacion.',
            tags: ['No show', 'Seguimiento'],
        };
    const n = t.filter((t) => it(t) > 0).sort((t, e) => it(t) - it(e))[0];
    return n
        ? {
              item: n,
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
function ht(e) {
    return e.length
        ? e
              .map((e) => {
                  const a = it(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">\n                        <div class="appointment-service">\n                            <strong>${t(lt(e.service, 'Servicio pendiente'))}</strong>\n                            <span>Especialista: ${t(lt(e.doctor, 'Sin asignar'))}</span>\n                            <small>${t(e.price || 'Sin tarifa')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(n(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(ut(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      e
                  ) {
                      const a = e.paymentStatus || e.payment_status || '',
                          n = String(
                              e.transferProofUrl ||
                                  e.transferProofURL ||
                                  e.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${t(
                          (function (t) {
                              const e = nt(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${t(ct(a))}</span>\n            <small>Metodo: ${t(((i = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[nt(i)] || lt(i, 'Metodo no definido')))}</small>\n            ${n ? `<a href="${t(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const a = st(e.status),
                          n = [];
                      return (
                          'pending_transfer_review' === ot(e) &&
                              n.push('Transferencia en espera'),
                          'no_show' === a && n.push('Paciente ausente'),
                          'cancelled' === a && n.push('Bloqueo operativo'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${t(
                              (function (t) {
                                  const e = nt(t);
                                  return 'completed' === e
                                      ? 'success'
                                      : 'cancelled' === e || 'no_show' === e
                                        ? 'danger'
                                        : 'pending' === e
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${t(rt(a))}</span>\n            <small>${t(n[0] || 'Sin alertas abiertas')}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const a = Number(e.id || 0);
                      return `\n        <div class="table-actions">\n            <a href="https://wa.me/${encodeURIComponent(String(e.phone || '').replace(/\s+/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp de ${t(e.name || 'Paciente')}" title="WhatsApp para validar pago">WhatsApp</a>\n            <button type="button" data-action="approve-transfer" data-id="${a}">Aprobar</button>\n            <button type="button" data-action="reject-transfer" data-id="${a}">Rechazar</button>\n            <button type="button" data-action="mark-no-show" data-id="${a}">No show</button>\n            <button type="button" data-action="cancel-appointment" data-id="${a}">Cancelar</button>\n            <button type="button" data-action="context-open-appointments-transfer">Triage</button>\n        </div>\n    `;
                  })(e)}</td>\n                </tr>\n            `;
              })
              .join('')
        : '<tr class="table-empty-row"><td colspan="6">No hay resultados</td></tr>';
}
function ft() {
    const e = b(),
        a = Array.isArray(e.data.appointments) ? e.data.appointments : [],
        i = (function (t, e) {
            const a = nt(e),
                n = [...t];
            return 'patient_az' === a
                ? (n.sort((t, e) => nt(t.name).localeCompare(nt(e.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort((t, e) => it(t) - it(e)), n)
                  : (n.sort((t, e) => it(e) - it(t)), n);
        })(
            (function (t, e) {
                const a = nt(e);
                return a
                    ? t.filter((t) =>
                          [
                              t.name,
                              t.email,
                              t.phone,
                              t.service,
                              t.doctor,
                              t.paymentStatus,
                              t.payment_status,
                          ].some((t) => nt(t).includes(a))
                      )
                    : t;
            })(bt(a, e.appointments.filter), e.appointments.search),
            e.appointments.sort
        );
    (c('#appointmentsTableBody', ht(i)),
        l('#appointmentsToolbarMeta', `Mostrando ${i.length} de ${a.length}`));
    const o = [];
    ('all' !== nt(e.appointments.filter) &&
        ('pending_transfer' === nt(e.appointments.filter)
            ? o.push('Transferencias por validar')
            : 'triage_attention' === nt(e.appointments.filter)
              ? o.push('Triage accionable')
              : 'upcoming_48h' === nt(e.appointments.filter)
                ? o.push('Proximas 48h')
                : 'no_show' === nt(e.appointments.filter)
                  ? o.push('No show')
                  : o.push(e.appointments.filter)),
        nt(e.appointments.search) &&
            o.push(`Busqueda: ${e.appointments.search}`),
        'patient_az' === nt(e.appointments.sort)
            ? o.push('Paciente (A-Z)')
            : 'datetime_asc' === nt(e.appointments.sort) &&
              o.push('Fecha ascendente'),
        0 !== i.length ||
            ('all' === nt(e.appointments.filter) &&
                !nt(e.appointments.search)) ||
            o.push('Resultados: 0'),
        l(
            '#appointmentsToolbarState',
            o.length ? o.join(' | ') : 'Sin filtros activos'
        ));
    const s = document.getElementById('clearAppointmentsFiltersBtn');
    if (s) {
        const t =
            'all' !== nt(e.appointments.filter) || nt(e.appointments.search);
        s.classList.toggle('is-hidden', !t);
    }
    const r = document.getElementById('appointmentFilter');
    r instanceof HTMLSelectElement && (r.value = e.appointments.filter);
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
            'compact' === nt(e.appointments.density)
        ),
        document
            .querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
            .forEach((t) => {
                const a = nt(t.dataset.density) === nt(e.appointments.density);
                t.classList.toggle('is-active', a);
            }),
        (function (t) {
            const e = nt(t);
            document
                .querySelectorAll(
                    '.appointment-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const a = nt(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', a);
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
        (function (e, a, i) {
            (l('#appointmentsOpsPendingTransfer', e.pendingTransferCount),
                l(
                    '#appointmentsOpsPendingTransferMeta',
                    e.pendingTransferCount > 0
                        ? `${e.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                l('#appointmentsOpsUpcomingCount', e.upcomingCount),
                l(
                    '#appointmentsOpsUpcomingMeta',
                    e.upcomingCount > 0
                        ? `${e.upcomingCount} cita(s) bajo ventana inmediata`
                        : 'Sin presion inmediata'
                ),
                l('#appointmentsOpsNoShowCount', e.noShowCount),
                l(
                    '#appointmentsOpsNoShowMeta',
                    e.noShowCount > 0
                        ? `${e.noShowCount} caso(s) requieren seguimiento`
                        : 'Sin incidencias'
                ),
                l('#appointmentsOpsTodayCount', e.todayCount),
                l(
                    '#appointmentsOpsTodayMeta',
                    e.todayCount > 0
                        ? `${e.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ),
                l(
                    '#appointmentsDeckSummary',
                    i > 0
                        ? `${e.pendingTransferCount} transferencias, ${e.triageCount} frentes accionables y ${a} cita(s) visibles.`
                        : 'Sin citas cargadas.'
                ),
                l(
                    '#appointmentsWorkbenchHint',
                    e.pendingTransferCount > 0
                        ? 'Hay pagos por validar antes de liberar la agenda.'
                        : 'Triage, pagos y seguimiento sin salir de la mesa.'
                ));
            const o = document.getElementById('appointmentsDeckChip');
            o &&
                ((o.textContent =
                    e.pendingTransferCount > 0 || e.noShowCount > 0
                        ? 'Atencion operativa'
                        : 'Agenda estable'),
                o.setAttribute(
                    'data-state',
                    e.pendingTransferCount > 0 || e.noShowCount > 0
                        ? 'warning'
                        : 'success'
                ));
            const s = e.focus;
            if ((l('#appointmentsFocusLabel', s.label), !s.item))
                return (
                    l('#appointmentsFocusPatient', 'Sin citas activas'),
                    l(
                        '#appointmentsFocusMeta',
                        'Cuando entren citas accionables apareceran aqui.'
                    ),
                    l('#appointmentsFocusWindow', '-'),
                    l('#appointmentsFocusPayment', '-'),
                    l('#appointmentsFocusStatus', '-'),
                    l('#appointmentsFocusContact', '-'),
                    c('#appointmentsFocusTags', ''),
                    void l('#appointmentsFocusHint', s.hint)
                );
            const r = s.item;
            (l('#appointmentsFocusPatient', r.name || 'Sin nombre'),
                l(
                    '#appointmentsFocusMeta',
                    `${lt(r.service, 'Servicio pendiente')} | ${n(r.date)} ${r.time || '--:--'}`
                ),
                l('#appointmentsFocusWindow', ut(it(r))),
                l(
                    '#appointmentsFocusPayment',
                    ct(r.paymentStatus || r.payment_status)
                ),
                l('#appointmentsFocusStatus', rt(r.status)),
                l('#appointmentsFocusContact', r.phone || 'Sin telefono'),
                c(
                    '#appointmentsFocusTags',
                    s.tags
                        .map(
                            (e) =>
                                `<span class="appointments-focus-tag">${t(e)}</span>`
                        )
                        .join('')
                ),
                l('#appointmentsFocusHint', s.hint));
        })(
            (function (t) {
                const e = bt(t, 'pending_transfer'),
                    a = bt(t, 'upcoming_48h'),
                    n = bt(t, 'no_show'),
                    i = bt(t, 'triage_attention'),
                    o = t.filter(dt);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: a.length,
                    noShowCount: n.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: gt(t),
                };
            })(a),
            i.length,
            a.length
        ));
}
function yt(t) {
    (g((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), ft());
}
function vt(t) {
    yt({ filter: nt(t) || 'all' });
}
function kt(t) {
    yt({ search: String(t || '') });
}
function wt(t, e) {
    const a = Number(t || 0);
    (g((t) => {
        const n = (t.data.appointments || []).map((t) =>
            Number(t.id || 0) === a ? { ...t, ...e } : t
        );
        return { ...t, data: { ...t.data, appointments: n } };
    }),
        ft());
}
async function St(t, e) {
    await L('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
const Ct = 'admin-callbacks-sort',
    qt = 'admin-callbacks-filter',
    At = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Mt = new Set(['recent_desc', 'waiting_desc']);
function Tt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function $t(t) {
    const e = Tt(t);
    return At.has(e) ? e : 'all';
}
function _t(t) {
    const e = Tt(t);
    return Mt.has(e) ? e : 'recent_desc';
}
function Lt(t) {
    const e = Tt(t);
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
function Nt(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function Et(t) {
    const e = Nt(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function Bt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin teléfono').trim() ||
        'Sin teléfono'
    );
}
function Dt(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const a = new Date();
    return (
        e.getFullYear() === a.getFullYear() &&
        e.getMonth() === a.getMonth() &&
        e.getDate() === a.getDate()
    );
}
function xt(t) {
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
function It() {
    const e = b(),
        a = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
        n = (function (t, e) {
            const a = Tt(e);
            return a
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          Tt(t).includes(a)
                      )
                  )
                : t;
        })(
            (function (t, e) {
                const a = $t(e);
                return 'pending' === a || 'contacted' === a
                    ? t.filter((t) => Lt(t.status) === a)
                    : 'today' === a
                      ? t.filter((t) => Dt(t.fecha || t.createdAt))
                      : 'sla_urgent' === a
                        ? t.filter(
                              (t) => 'pending' === Lt(t.status) && Et(t) >= 120
                          )
                        : t;
            })(a, e.callbacks.filter),
            e.callbacks.search
        ),
        o = (function (t, e) {
            const a = [...t];
            return 'waiting_desc' === _t(e)
                ? (a.sort((t, e) => Nt(t) - Nt(e)), a)
                : (a.sort((t, e) => Nt(e) - Nt(t)), a);
        })(n, e.callbacks.sort),
        s = new Set((e.callbacks.selected || []).map((t) => Number(t || 0)));
    (c(
        '#callbacksGrid',
        o.length
            ? o
                  .map((e) =>
                      (function (e, a) {
                          const n = Lt(e.status),
                              o =
                                  'pending' === n
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              s = 'pending' === n ? 'pendiente' : 'contactado',
                              l = Number(e.id || 0),
                              c = Bt(e),
                              r = Et(e),
                              u = xt(r);
                          return `\n        <article class="${o}${a ? ' is-selected' : ''}" data-callback-id="${l}" data-callback-status="${s}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${t('pending' === n ? u.tone : 'success')}">${'pending' === n ? 'Pendiente' : 'Contactado'}</span>\n                    <h4>${t(c)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${t(u.tone)}">${t(u.label)}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${t(e.preferencia || '-')}</strong></p>\n                <p><span>Fecha</span><strong>${t(i(e.fecha || e.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${r} min</strong></p>\n                <p><span>Estado</span><strong>${t('pending' === n ? 'Pendiente' : 'Contactado')}</strong></p>\n            </div>\n            <p class="callback-card-note">${t('pending' === n ? u.note : 'Callback resuelto y fuera de cola operativa.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${l}" data-callback-date="${t(e.fecha || '')}">Marcar contactado</button>\n            </div>\n        </article>\n    `;
                      })(e, s.has(Number(e.id || 0)))
                  )
                  .join('')
            : '<p class="callbacks-grid-empty">No hay callbacks para el filtro actual.</p>'
    ),
        l('#callbacksToolbarMeta', `Mostrando ${o.length} de ${a.length}`));
    const r = [];
    ('all' !== $t(e.callbacks.filter) &&
        r.push(
            'pending' === $t(e.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === $t(e.callbacks.filter)
                  ? 'Contactados'
                  : 'today' === $t(e.callbacks.filter)
                    ? 'Hoy'
                    : 'Urgentes SLA'
        ),
        Tt(e.callbacks.search) && r.push(`Busqueda: ${e.callbacks.search}`),
        'waiting_desc' === _t(e.callbacks.sort) &&
            r.push('Orden: Mayor espera (SLA)'),
        l(
            '#callbacksToolbarState',
            r.length ? r.join(' | ') : 'Sin filtros activos'
        ));
    const u = document.getElementById('callbackFilter');
    u instanceof HTMLSelectElement && (u.value = $t(e.callbacks.filter));
    const d = document.getElementById('callbackSort');
    d instanceof HTMLSelectElement && (d.value = _t(e.callbacks.sort));
    const p = document.getElementById('searchCallbacks');
    (p instanceof HTMLInputElement &&
        p.value !== e.callbacks.search &&
        (p.value = e.callbacks.search),
        (function (t) {
            const e = Tt(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const a = Tt(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', a);
                });
        })(e.callbacks.filter));
    const m = (function (t) {
        const e = t.filter((t) => 'pending' === Lt(t.status)),
            a = e.filter((t) => Et(t) >= 120),
            n = e.slice().sort((t, e) => Nt(t) - Nt(e))[0];
        return {
            pendingCount: e.length,
            urgentCount: a.length,
            todayCount: t.filter((t) => Dt(t.fecha || t.createdAt)).length,
            next: n,
            queueHealth:
                a.length > 0
                    ? 'Cola: prioridad alta'
                    : e.length > 0
                      ? 'Cola: atención requerida'
                      : 'Cola: estable',
            queueState:
                a.length > 0 ? 'danger' : e.length > 0 ? 'warning' : 'success',
        };
    })(a);
    (l('#callbacksOpsPendingCount', m.pendingCount),
        l('#callbacksOpsUrgentCount', m.urgentCount),
        l('#callbacksOpsTodayCount', m.todayCount),
        l('#callbacksOpsQueueHealth', m.queueHealth));
    const g = document.getElementById('callbacksBulkSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === o.length);
    const h = document.getElementById('callbacksBulkClearBtn');
    h instanceof HTMLButtonElement && (h.disabled = 0 === s.size);
    const f = document.getElementById('callbacksBulkMarkBtn');
    (f instanceof HTMLButtonElement && (f.disabled = 0 === s.size),
        (function (t, e, a, n) {
            (l(
                '#callbacksDeckSummary',
                a > 0
                    ? `${t.pendingCount} pendiente(s), ${t.urgentCount} fuera de SLA y ${e} visibles.`
                    : 'Sin callbacks pendientes.'
            ),
                l(
                    '#callbacksDeckHint',
                    t.urgentCount > 0
                        ? 'Escala primero los casos criticos.'
                        : t.pendingCount > 0
                          ? 'La cola se puede drenar en esta misma vista.'
                          : 'Sin bloqueos'
                ));
            const i = document.getElementById('callbacksQueueChip');
            i &&
                ((i.textContent =
                    'danger' === t.queueState
                        ? 'SLA comprometido'
                        : 'warning' === t.queueState
                          ? 'Cola activa'
                          : 'Cola estable'),
                i.setAttribute('data-state', t.queueState));
            const o = document.getElementById('callbacksOpsQueueHealth');
            o && o.setAttribute('data-state', t.queueState);
            const s = t.next;
            (l('#callbacksOpsNext', s ? Bt(s) : 'Sin teléfono'),
                l(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${Bt(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecerá aqui.'
                ),
                l('#callbacksNextWait', `${s ? Et(s) : 0} min`),
                l('#callbacksNextPreference', (s && s.preferencia) || '-'),
                l('#callbacksNextState', s ? xt(Et(s)).label : 'Pendiente'));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === n),
                l('#callbacksSelectedCount', n));
        })(m, o.length, a.length, s.size));
}
function Pt(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e &&
            (function (t) {
                try {
                    (localStorage.setItem(qt, JSON.stringify($t(t.filter))),
                        localStorage.setItem(Ct, JSON.stringify(_t(t.sort))));
                } catch (t) {}
            })(b().callbacks),
        It());
}
function Ht(t) {
    Pt({ filter: $t(t), selected: [] });
}
async function Ft(t, e = '') {
    const a = Number(t || 0);
    a <= 0 ||
        (await L('callbacks', {
            method: 'PATCH',
            body: { id: a, status: 'contacted', fecha: e },
        }),
        (function (t) {
            const e = Number(t || 0);
            (g((t) => {
                const a = (t.data.callbacks || []).map((t) =>
                    Number(t.id || 0) === e ? { ...t, status: 'contacted' } : t
                );
                return {
                    ...t,
                    data: { ...t.data, callbacks: a },
                    callbacks: {
                        ...t.callbacks,
                        selected: (t.callbacks.selected || []).filter(
                            (t) => Number(t || 0) !== e
                        ),
                    },
                };
            }),
                It());
        })(a));
}
const Ot = 'admin-availability-selected-date',
    Rt = 'admin-availability-month-anchor';
function zt(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function jt(t) {
    return [...new Set(t.map(zt).filter(Boolean))].sort();
}
function Vt(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? '' : u(a) === e ? e : '';
}
function Ut(t) {
    const e = Vt(t);
    if (!e) return null;
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Kt(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((a) => {
                const n = Vt(a);
                if (!n) return;
                const i = jt(Array.isArray(t[a]) ? t[a] : []);
                i.length && (e[n] = i);
            }),
        e
    );
}
function Qt(t) {
    return Kt(t || {});
}
function Wt(t) {
    return JSON.stringify(Kt(t || {}));
}
function Gt(t) {
    const e = Qt(b().data.availability || {});
    return Wt(t) !== Wt(e);
}
function Jt(t, e = '') {
    let a = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) a = new Date(t);
    else {
        const e = Vt(t);
        e && (a = new Date(`${e}T12:00:00`));
    }
    if (!a) {
        const t = Ut(e);
        a = t ? new Date(t) : new Date();
    }
    return (a.setDate(1), a.setHours(12, 0, 0, 0), a);
}
function Yt(t, e) {
    const a = Vt(t);
    if (a) return a;
    const n = Object.keys(e || {})[0];
    if (n) {
        const t = Vt(n);
        if (t) return t;
    }
    return u(new Date());
}
function Zt() {
    const t = b(),
        e = Vt(t.availability.selectedDate),
        a = Jt(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(Ot, e) : localStorage.removeItem(Ot),
            localStorage.setItem(Rt, u(a)));
    } catch (t) {}
}
function Xt(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? ce() : Zt());
}
function te(t, e = {}) {
    const a = Qt(t),
        n = Yt(e.selectedDate || b().availability.selectedDate, a);
    Xt(
        {
            draft: a,
            selectedDate: n,
            monthAnchor: Jt(e.monthAnchor || b().availability.monthAnchor, n),
            draftDirty: Gt(a),
            ...e,
        },
        { render: !0 }
    );
}
function ee(t) {
    Xt({ lastAction: String(t || '') }, { render: !0 });
}
function ae(t, e, a = '') {
    const n = Vt(t) || oe();
    if (!n) return;
    const i = ne(),
        o = jt(Array.isArray(e) ? e : []);
    (o.length ? (i[n] = o) : delete i[n],
        te(i, { selectedDate: n, monthAnchor: n, lastAction: a }));
}
function ne() {
    return Qt(b().availability.draft || {});
}
function ie() {
    const t = b().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function oe() {
    const t = b(),
        e = Vt(t.availability.selectedDate);
    if (e) return e;
    const a = Qt(t.availability.draft || {});
    return Object.keys(a)[0] || u(new Date());
}
function se(t, e) {
    const a = Vt(t);
    a &&
        Xt(
            { selectedDate: a, monthAnchor: Jt(a, a), lastAction: e || '' },
            { render: !0 }
        );
}
function le(t = 1) {
    const e = ne(),
        a = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!a.length) return '';
    const n = Vt(b().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? a.sort() : a.sort().reverse()).find((e) =>
            t >= 0 ? e >= n : e <= n
        ) || ''
    );
}
function ce() {
    ((function () {
        const t = b(),
            e = Jt(t.availability.monthAnchor, t.availability.selectedDate),
            a = oe(),
            n = e.getMonth(),
            i = Qt(t.availability.draft),
            o = u(new Date());
        var s;
        l(
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
                    a = (e.getDay() + 6) % 7;
                e.setDate(e.getDate() - a);
                const n = [];
                for (let t = 0; t < 42; t += 1) {
                    const a = new Date(e);
                    (a.setDate(e.getDate() + t), n.push(a));
                }
                return n;
            })(e)
                .map((t) => {
                    const e = u(t),
                        s = Array.isArray(i[e]) && i[e].length > 0;
                    return `\n                <button type="button" class="${['calendar-day', t.getMonth() === n ? '' : 'other-month', s ? 'has-slots' : '', e === a ? 'is-selected' : '', e === o ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${e}">\n                    <span>${t.getDate()}</span>\n                    ${s ? `<small>${i[e].length} slots</small>` : ''}\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const e = b(),
                a = oe(),
                n = jt(Qt(e.availability.draft)[a] || []);
            (l('#selectedDate', a || '-'),
                n.length
                    ? c(
                          '#timeSlotsList',
                          n
                              .map(
                                  (e) =>
                                      `\n            <div class="time-slot-item">\n                <span>${t(e)}</span>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(a)}" data-time="${encodeURIComponent(e)}" ${ie() ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : c(
                          '#timeSlotsList',
                          `<p class="empty-message">${ie() ? 'No hay horarios configurados (Solo lectura)' : 'No hay horarios configurados'}</p>`
                      ));
        })(),
        (function () {
            const t = b(),
                a = oe(),
                n = Qt(t.availability.draft),
                i = Array.isArray(n[a]) ? n[a].length : 0,
                o = ie(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: r,
                } = (function () {
                    const t = b().data.availabilityMeta || {},
                        e = ie();
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
            (l(
                '#availabilityHeading',
                o
                    ? 'Configurar Horarios Disponibles · Solo lectura'
                    : 'Configurar Horarios Disponibles'
            ),
                l('#availabilitySourceBadge', `Fuente: ${s}`),
                l('#availabilityModeBadge', `Modo: ${c}`),
                l('#availabilityTimezoneBadge', `TZ: ${r}`),
                l(
                    '#availabilitySelectionSummary',
                    `Fecha: ${a} | Fuente: ${s} | Modo: ${c} | Slots: ${i}`
                ),
                l(
                    '#availabilityDraftStatus',
                    t.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                l(
                    '#availabilitySyncStatus',
                    o ? `Google Calendar | ${r}` : `Store local | ${r}`
                ));
            const u = e('#addSlotForm'),
                d = e('#availabilityQuickSlotPresets');
            (u && u.classList.toggle('is-hidden', o),
                d && d.classList.toggle('is-hidden', o));
            const p = e('#newSlotTime');
            p instanceof HTMLInputElement && (p.disabled = o);
            const m = e('[data-action="add-time-slot"]');
            m instanceof HTMLButtonElement && (m.disabled = o);
            const g = Array.isArray(t.availability.clipboard)
                ? t.availability.clipboard.length
                : 0;
            let h = 'Sin acciones pendientes';
            (o
                ? (h = 'Edicion bloqueada por proveedor Google')
                : t.availability.lastAction
                  ? (h = String(t.availability.lastAction))
                  : g && (h = `Portapapeles: ${g} slots`),
                l('#availabilityDayActionsStatus', h),
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
                                    ? (e.disabled = o)
                                    : (e.disabled = o || 0 === g)
                                : (e.disabled =
                                      o || !t.availability.draftDirty));
                    }));
        })(),
        Zt());
}
function re() {
    return Boolean(b().availability.draftDirty);
}
function ue(t) {
    if (ie()) return;
    const e = b(),
        a = Vt(e.availability.selectedDate) || oe(),
        n = Array.isArray(e.availability.draft[a])
            ? e.availability.draft[a]
            : [],
        i = Ut(a);
    if (!i) return;
    i.setDate(i.getDate() + Number(t || 0));
    const o = u(i);
    ae(o, n, `Duplicado ${n.length} slots en ${o}`);
}
const de = 'queueStationMode',
    pe = 'queueStationConsultorio',
    me = 'queueOneTapAdvance',
    be = 'queueCallKeyBindingV1',
    ge = 'queueNumpadHelpOpen',
    he = 'queueAdminLastSnapshot',
    fe = new Map([
        [1, !1],
        [2, !1],
    ]);
let ye = '';
const ve = new Set(['no_show', 'cancelar']);
function ke(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function we(t) {
    const e = ke(t);
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
function Se(t) {
    const e = ke(t);
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
function Ce(t) {
    return Array.isArray(t) ? t : [];
}
function qe(t, e = 0) {
    const a = Number(t);
    return Number.isFinite(a) ? a : e;
}
function Ae(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function Me(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
function Te(t) {
    g((e) => {
        const a = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: a } };
    });
    try {
        Ge();
    } catch (t) {}
}
function $e(t) {
    (y(de, t.queue.stationMode || 'free'),
        y(pe, t.queue.stationConsultorio || 1),
        y(me, t.queue.oneTap ? '1' : '0'),
        y(ge, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? k(be, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(be),
        k(he, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function _e(t, e = 0) {
    const a = Number(t?.id || t?.ticket_id || e + 1);
    return {
        id: a,
        ticketCode: String(t?.ticketCode || t?.ticket_code || `A-${a}`),
        queueType: String(t?.queueType || t?.queue_type || 'walk_in'),
        patientInitials: String(
            t?.patientInitials || t?.patient_initials || '--'
        ),
        priorityClass: String(
            t?.priorityClass || t?.priority_class || 'walk_in'
        ),
        status: we(t?.status || 'waiting'),
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
function Le(t, e = 0, a = {}) {
    const n = t && 'object' == typeof t ? t : {},
        i = _e({ ...n, ...a }, e);
    return (
        Me(n.createdAt, n.created_at) || (i.createdAt = ''),
        Me(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        Me(n.queueType, n.queue_type) || (i.queueType = ''),
        Me(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function Ne(t) {
    const e = t.filter((t) => 'waiting' === t.status),
        a = t.filter((t) => 'called' === t.status),
        n = {
            1: a.find((t) => 1 === t.assignedConsultorio) || null,
            2: a.find((t) => 2 === t.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: e.length,
        calledCount: a.length,
        counts: {
            waiting: e.length,
            called: a.length,
            completed: t.filter((t) => 'completed' === t.status).length,
            no_show: t.filter((t) => 'no_show' === t.status).length,
            cancelled: t.filter((t) => 'cancelled' === t.status).length,
        },
        callingNowByConsultorio: n,
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
function Ee(t, e = []) {
    const a = t && 'object' == typeof t ? t : {},
        n = a.counts && 'object' == typeof a.counts ? a.counts : {},
        i =
            a.callingNowByConsultorio &&
            'object' == typeof a.callingNowByConsultorio
                ? a.callingNowByConsultorio
                : a.calling_now_by_consultorio &&
                    'object' == typeof a.calling_now_by_consultorio
                  ? a.calling_now_by_consultorio
                  : {},
        o = Ce(a.callingNow).concat(Ce(a.calling_now)),
        s = Ce(e).map((t, e) => _e(t, e)),
        l =
            i[1] ||
            i[1] ||
            o.find(
                (t) =>
                    1 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        c =
            i[2] ||
            i[2] ||
            o.find(
                (t) =>
                    2 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        r = l ? Le(l, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        u = c ? Le(c, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = Ce(a.nextTickets)
            .concat(Ce(a.next_tickets))
            .map((t, e) =>
                Le(
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
        b = Math.max(Number(Boolean(r)) + Number(Boolean(u)), m),
        g = qe(
            a.waitingCount ?? a.waiting_count ?? n.waiting ?? d.length ?? p,
            0
        ),
        h = qe(a.calledCount ?? a.called_count ?? n.called ?? b, 0),
        f = qe(
            n.completed ??
                a.completedCount ??
                a.completed_count ??
                s.filter((t) => 'completed' === t.status).length,
            0
        ),
        y = qe(
            n.no_show ??
                n.noShow ??
                a.noShowCount ??
                a.no_show_count ??
                s.filter((t) => 'no_show' === t.status).length,
            0
        ),
        v = qe(
            n.cancelled ??
                n.canceled ??
                a.cancelledCount ??
                a.cancelled_count ??
                s.filter((t) => 'cancelled' === t.status).length,
            0
        );
    return {
        updatedAt: String(
            a.updatedAt || a.updated_at || new Date().toISOString()
        ),
        waitingCount: g,
        calledCount: h,
        counts: {
            waiting: g,
            called: h,
            completed: f,
            no_show: y,
            cancelled: v,
        },
        callingNowByConsultorio: { 1: r, 2: u },
        nextTickets: d,
    };
}
function Be(t) {
    const e = _e(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${ke(e.ticketCode || '')}`;
}
function De(t) {
    const e = Ee(t),
        a = new Map(),
        n = (t) => {
            if (!t) return;
            const e = _e(t, a.size);
            (Me(t?.createdAt, t?.created_at) || (e.createdAt = ''),
                Me(t?.priorityClass, t?.priority_class) ||
                    (e.priorityClass = ''),
                Me(t?.queueType, t?.queue_type) || (e.queueType = ''),
                a.set(Be(e), e));
        },
        i =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        o =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (i && n({ ...i, status: 'called', assignedConsultorio: 1 }),
        o && n({ ...o, status: 'called', assignedConsultorio: 2 }));
    for (const t of Ce(e.nextTickets))
        n({ ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function xe() {
    const t = b(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => _e(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? Ee(t.data.queueMeta, e)
                : Ne(e),
    };
}
function Ie() {
    const t = b(),
        { queueTickets: e } = xe();
    return (function (t, e) {
        const a = ke(e);
        return a
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => ke(t).includes(a)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const a = ke(e);
            return 'waiting' === a
                ? t.filter((t) => 'waiting' === t.status)
                : 'called' === a
                  ? t.filter((t) => 'called' === t.status)
                  : 'no_show' === a
                    ? t.filter((t) => 'no_show' === t.status)
                    : 'sla_risk' === a
                      ? t.filter(
                            (t) =>
                                'waiting' === t.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - Ae(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === ke(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function Pe(t, e = null) {
    const a = Array.isArray(e) ? e : xe().queueTickets,
        n = new Set(a.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(Ce(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && n.has(t))
        .sort((t, e) => t - e);
}
function He() {
    return Pe(b().queue.selected || []);
}
function Fe() {
    const t = (function () {
        const t = new Set(He());
        return t.size
            ? xe().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : Ie();
}
function Oe(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: Pe(t, e.data.queueTickets || []) },
    })),
        e && Je());
}
function Re() {
    Oe([]);
}
function ze(e) {
    const a = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - Ae(e.createdAt)) / 6e4)),
        i = Number(e.id || 0),
        o = new Set(He()).has(i),
        s = 'called' === e.status,
        l = s && e.assignedConsultorio,
        c = s;
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                <label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${i}" ${o ? 'checked' : ''} />\n                </label>\n            </td>\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (we(t)) {
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
    )}</td>\n            <td>${a}</td>\n            <td>${n} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${l ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function je(t) {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        a = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (a && (a.textContent = `Confirmar accion sensible: ${t.action}`),
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
function Ve() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function Ue(t, e = null, a = {}) {
    const n = Ce(t).map((t, e) => _e(t, e)),
        i = Ee(e && 'object' == typeof e ? e : Ne(n), n),
        o = n.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        l =
            'fallback' === ke(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === ke(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: n, queueMeta: i },
        queue: {
            ...t.queue,
            selected: Pe(t.queue.selected || [], n),
            fallbackPartial: s,
            syncMode: l,
        },
    })),
        $e(b()),
        Je());
}
function Ke(t, e) {
    const a = Number(t || 0),
        n = (b().data.queueTickets || []).map((t, n) => {
            const i = _e(t, n);
            return i.id !== a
                ? i
                : _e('function' == typeof e ? e(i) : { ...i }, n);
        });
    Ue(n, Ne(n), { fallbackPartial: !1, syncMode: 'live' });
}
function Qe(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), $e(b()), Je());
}
function We(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        xe().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Ge() {
    const e = b().queue.activity || [];
    c(
        '#queueActivityList',
        e.length
            ? e
                  .map(
                      (e) =>
                          `<li><span>${t(i(e.at))}</span><strong>${t(e.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function Je() {
    const e = b(),
        { queueMeta: a } = xe(),
        n = Ie(),
        i = He().length,
        o = Fe(),
        s = Ce(a.nextTickets),
        r = Number(a.waitingCount || a.counts?.waiting || 0);
    (!(function (t) {
        const e = b(),
            a = Ee(t, e.data.queueTickets || []),
            n =
                a.callingNowByConsultorio?.[1] ||
                a.callingNowByConsultorio?.[1] ||
                null,
            i =
                a.callingNowByConsultorio?.[2] ||
                a.callingNowByConsultorio?.[2] ||
                null,
            o = n
                ? String(n.ticketCode || n.ticket_code || 'A-000')
                : 'Sin llamado',
            s = i
                ? String(i.ticketCode || i.ticket_code || 'A-000')
                : 'Sin llamado';
        (l(
            '#queueWaitingCountAdmin',
            Number(a.waitingCount || a.counts?.waiting || 0)
        ),
            l(
                '#queueCalledCountAdmin',
                Number(a.calledCount || a.counts?.called || 0)
            ),
            l('#queueC1Now', o),
            l('#queueC2Now', s));
        const c = document.getElementById('queueReleaseC1');
        c instanceof HTMLButtonElement &&
            ((c.hidden = !n),
            (c.textContent = n ? `Liberar C1 · ${o}` : 'Release C1'),
            n
                ? c.setAttribute('data-queue-id', String(Number(n.id || 0)))
                : c.removeAttribute('data-queue-id'));
        const r = document.getElementById('queueReleaseC2');
        r instanceof HTMLButtonElement &&
            ((r.hidden = !i),
            (r.textContent = i ? `Liberar C2 · ${s}` : 'Release C2'),
            i
                ? r.setAttribute('data-queue-id', String(Number(i.id || 0)))
                : r.removeAttribute('data-queue-id'));
        const u = document.getElementById('queueSyncStatus');
        if ('fallback' === ke(e.queue.syncMode))
            return (
                l('#queueSyncStatus', 'fallback'),
                void (u && u.setAttribute('data-state', 'fallback'))
            );
        const d = String(a.updatedAt || '').trim();
        if (!d) return;
        const p = Math.max(0, Math.round((Date.now() - Ae(d)) / 1e3)),
            m = p >= 60;
        if (
            (l('#queueSyncStatus', m ? `Watchdog (${p}s)` : 'vivo'),
            u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
            m)
        ) {
            const t = `stale-${Math.floor(p / 15)}`;
            return void (
                t !== ye &&
                ((ye = t), Te('Watchdog de cola: realtime en reconnecting'))
            );
        }
        ye = 'live';
    })(a),
        c(
            '#queueTableBody',
            n.length
                ? n.map(ze).join('')
                : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
        ));
    const u =
        e.queue.fallbackPartial && s.length && r > s.length
            ? `<li><span>-</span><strong>Mostrando primeros ${s.length} de ${r} en espera</strong></li>`
            : '';
    c(
        '#queueNextAdminList',
        s.length
            ? `${u}${s.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
    const d = n.filter(
            (t) =>
                'waiting' === t.status &&
                (Math.max(
                    0,
                    Math.round((Date.now() - Ae(t.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === ke(t.priorityClass))
        ).length,
        p = [d > 0 ? `riesgo: ${d}` : 'sin riesgo'];
    (i > 0 && p.push(`seleccion: ${i}`),
        e.queue.fallbackPartial && p.push('fallback parcial'),
        l('#queueTriageSummary', p.join(' | ')),
        l('#queueSelectedCount', i));
    const m = document.getElementById('queueSelectionChip');
    m instanceof HTMLElement && m.classList.toggle('is-hidden', 0 === i);
    const g = document.getElementById('queueSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === n.length);
    const h = document.getElementById('queueClearSelectionBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === i),
        document
            .querySelectorAll(
                '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
            )
            .forEach((t) => {
                t instanceof HTMLButtonElement && (t.disabled = 0 === o.length);
            }),
        l('#queueStationBadge', `Estación C${e.queue.stationConsultorio}`),
        l(
            '#queueStationModeBadge',
            'locked' === e.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const f = document.getElementById('queuePracticeModeBadge');
    f instanceof HTMLElement && (f.hidden = !e.queue.practiceMode);
    const y = document.getElementById('queueShortcutPanel');
    y instanceof HTMLElement && (y.hidden = !e.queue.helpOpen);
    const v = document.querySelector('[data-action="queue-clear-call-key"]');
    v instanceof HTMLElement && (v.hidden = !e.queue.customCallKey);
    const k = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (k instanceof HTMLElement &&
        (k.setAttribute('aria-pressed', String(Boolean(e.queue.oneTap))),
        (k.textContent = e.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((t) => {
                if (!(t instanceof HTMLButtonElement)) return;
                const a = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1;
                t.disabled =
                    'locked' === e.queue.stationMode &&
                    a !== Number(e.queue.stationConsultorio || 1);
            }));
    const w = We(e.queue.stationConsultorio);
    (document
        .querySelectorAll(
            '[data-action="queue-release-station"][data-queue-consultorio]'
        )
        .forEach((t) => {
            if (!(t instanceof HTMLButtonElement)) return;
            const a = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1,
                n = We(a);
            ((t.disabled = !n),
                'locked' === e.queue.stationMode &&
                    a !== Number(e.queue.stationConsultorio || 1) &&
                    (t.disabled = !0));
        }),
        w &&
            (p.push(
                `activo: ${w.ticketCode} en C${e.queue.stationConsultorio}`
            ),
            l('#queueTriageSummary', p.join(' | '))),
        Ge());
}
function Ye(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function Ze(t, e = {}) {
    const a =
        t?.data?.queueState ||
        t?.data?.queue_state ||
        t?.data?.queueMeta ||
        t?.data ||
        null;
    if (!a || 'object' != typeof a) return;
    const n = (function (t) {
            return t && 'object' == typeof t
                ? Array.isArray(t.queue_tickets)
                    ? t.queue_tickets
                    : Array.isArray(t.queueTickets)
                      ? t.queueTickets
                      : Array.isArray(t.tickets)
                        ? t.tickets
                        : []
                : [];
        })(a),
        i = t?.data?.ticket || null;
    if (
        !(function (t, e, a) {
            if (e.length > 0) return !0;
            if (
                Ye(t, 'queue_tickets') ||
                Ye(t, 'queueTickets') ||
                Ye(t, 'tickets')
            )
                return !0;
            if (a && 'object' == typeof a) return !0;
            if (
                Ye(t, 'waitingCount') ||
                Ye(t, 'waiting_count') ||
                Ye(t, 'calledCount') ||
                Ye(t, 'called_count') ||
                Ye(t, 'completedCount') ||
                Ye(t, 'completed_count') ||
                Ye(t, 'noShowCount') ||
                Ye(t, 'no_show_count') ||
                Ye(t, 'cancelledCount') ||
                Ye(t, 'cancelled_count')
            )
                return !0;
            const n =
                t?.counts && 'object' == typeof t.counts ? t.counts : null;
            if (
                n &&
                (Ye(n, 'waiting') ||
                    Ye(n, 'called') ||
                    Ye(n, 'completed') ||
                    Ye(n, 'no_show') ||
                    Ye(n, 'noShow') ||
                    Ye(n, 'cancelled') ||
                    Ye(n, 'canceled'))
            )
                return !0;
            if (Ye(t, 'nextTickets') || Ye(t, 'next_tickets')) return !0;
            const i =
                t?.callingNowByConsultorio &&
                'object' == typeof t.callingNowByConsultorio
                    ? t.callingNowByConsultorio
                    : t?.calling_now_by_consultorio &&
                        'object' == typeof t.calling_now_by_consultorio
                      ? t.calling_now_by_consultorio
                      : null;
            return (
                !(
                    !i ||
                    !(
                        Boolean(i[1]) ||
                        Boolean(i[2]) ||
                        Boolean(i[1]) ||
                        Boolean(i[2])
                    )
                ) || Ce(t?.callingNow).concat(Ce(t?.calling_now)).some(Boolean)
            );
        })(a, n, i)
    )
        return;
    const o = 'fallback' === ke(e.syncMode) ? 'fallback' : 'live',
        s = (b().data.queueTickets || []).map((t, e) => _e(t, e)),
        l = Ee(a, s),
        c = (function (t) {
            const e =
                    t?.counts && 'object' == typeof t.counts ? t.counts : null,
                a =
                    Ye(t, 'waitingCount') ||
                    Ye(t, 'waiting_count') ||
                    Boolean(e && Ye(e, 'waiting')),
                n =
                    Ye(t, 'calledCount') ||
                    Ye(t, 'called_count') ||
                    Boolean(e && Ye(e, 'called')),
                i = Ye(t, 'nextTickets') || Ye(t, 'next_tickets'),
                o =
                    Ye(t, 'callingNowByConsultorio') ||
                    Ye(t, 'calling_now_by_consultorio') ||
                    Ye(t, 'callingNow') ||
                    Ye(t, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        r = De(l),
        u = Boolean(i && 'object' == typeof i);
    if (!(n.length || r.length || u || c.waiting || c.called)) return;
    const d =
            Number(l.waitingCount || 0) >
            r.filter((t) => 'waiting' === t.status).length,
        p = new Map(s.map((t) => [Be(t), t]));
    if (n.length) Ue(n, l, { fallbackPartial: !1, syncMode: o });
    else {
        !(function (t, e, a) {
            const n = e.callingNowByConsultorio || {},
                i = Number(e.calledCount || e.counts?.called || 0),
                o = Number(e.waitingCount || e.counts?.waiting || 0),
                s = Ce(e.nextTickets),
                l = new Set(),
                c = n[1] || n[1] || null,
                r = n[2] || n[2] || null;
            (c && l.add(Be(c)), r && l.add(Be(r)));
            const u = new Set(s.map((t) => Be(t))),
                d = l.size > 0 || 0 === i,
                p = u.size > 0 || 0 === o,
                m = u.size > 0 && o > u.size;
            for (const [e, n] of t.entries()) {
                const i = _e(n, 0);
                a.called && d && 'called' === i.status && !l.has(e)
                    ? t.set(
                          e,
                          _e(
                              {
                                  ...i,
                                  status: 'completed',
                                  assignedConsultorio: null,
                                  completedAt:
                                      i.completedAt || new Date().toISOString(),
                              },
                              0
                          )
                      )
                    : a.waiting &&
                      p &&
                      'waiting' === i.status &&
                      (o <= 0 ? t.delete(e) : m || u.has(e) || t.delete(e));
            }
        })(p, l, c);
        for (const t of r) {
            const e = Be(t),
                a = p.get(e) || null,
                n = Me(t.createdAt, t.created_at, a?.createdAt, a?.created_at),
                i = Me(
                    t.priorityClass,
                    t.priority_class,
                    a?.priorityClass,
                    a?.priority_class,
                    'walk_in'
                ),
                o = Me(
                    t.queueType,
                    t.queue_type,
                    a?.queueType,
                    a?.queue_type,
                    'walk_in'
                ),
                s = Me(
                    t.patientInitials,
                    t.patient_initials,
                    a?.patientInitials,
                    a?.patient_initials,
                    '--'
                );
            p.set(
                e,
                _e(
                    {
                        ...(a || {}),
                        ...t,
                        status: t.status,
                        assignedConsultorio: t.assignedConsultorio,
                        createdAt: n || new Date().toISOString(),
                        priorityClass: i,
                        queueType: o,
                        patientInitials: s,
                    },
                    p.size
                )
            );
        }
        if (u) {
            const t = _e(i, p.size),
                e = Be(t),
                a = p.get(e) || null;
            p.set(e, _e({ ...(a || {}), ...t }, p.size));
        }
        Ue(Array.from(p.values()), l, { fallbackPartial: d, syncMode: o });
    }
}
function Xe(t, e, a = void 0) {
    Ke(t, (t) => ({
        ...t,
        status: e,
        assignedConsultorio: void 0 === a ? t.assignedConsultorio : a,
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
async function ta() {
    try {
        (Ze(await L('queue-state'), { syncMode: 'live' }),
            Te('Queue refresh realizado'));
    } catch (t) {
        Te('Queue refresh con error');
        const e = v(he, null);
        e?.queueTickets &&
            Ue(e.queueTickets, e.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            });
    }
}
function ea(t) {
    Qe({ filter: ke(t) || 'all', selected: [] });
}
async function aa(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        a = b();
    if (!fe.get(e)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== e
        )
            return (
                Te(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const t = (function (t) {
                return xe().queueTickets.find(
                    (e) =>
                        'waiting' === e.status &&
                        (!e.assignedConsultorio || e.assignedConsultorio === t)
                );
            })(e);
            return t
                ? ((function (t, e) {
                      Ke(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void Te(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void Te('Practica: sin tickets en espera');
        }
        fe.set(e, !0);
        try {
            (Ze(
                await L('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                Te(`Llamado C${e} ejecutado`));
        } catch (t) {
            (Te(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            fe.set(e, !1);
        }
    }
}
async function na({ ticketId: t, action: e, consultorio: a }) {
    const n = Number(t || 0),
        i = Se(e);
    if (n && i)
        return b().queue.practiceMode
            ? ('reasignar' === i || 're-llamar' === i || 'rellamar' === i
                  ? Xe(n, 'called', 2 === Number(a || 1) ? 2 : 1)
                  : 'liberar' === i
                    ? Xe(n, 'waiting', null)
                    : 'completar' === i
                      ? Xe(n, 'completed')
                      : 'no_show' === i
                        ? Xe(n, 'no_show')
                        : 'cancelar' === i && Xe(n, 'cancelled'),
              void Te(`Practica: accion ${i} en ticket ${n}`))
            : (Ze(
                  await L('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void Te(`Accion ${i} ticket ${n}`));
}
async function ia(t, e, a = 0) {
    const n = {
            ticketId: Number(t || 0),
            action: Se(e),
            consultorio: Number(a || 0),
        },
        i = b(),
        o = (function (t) {
            const e = Number(t || 0);
            return (
                (e && xe().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(n.ticketId);
    if (
        !i.queue.practiceMode &&
        ve.has(n.action) &&
        (function (t, e) {
            const a = Se(t);
            if ('cancelar' === a) return !0;
            if ('no_show' !== a) return !1;
            const n = e || null;
            return (
                !n ||
                'called' === we(n.status) ||
                Number(n.assignedConsultorio || 0) > 0
            );
        })(n.action, o)
    )
        return (je(n), void Te(`Accion ${n.action} pendiente de confirmacion`));
    await na(n);
}
async function oa() {
    const t = b().queue.pendingSensitiveAction;
    t ? (Ve(), await na(t)) : Ve();
}
function sa() {
    (Ve(), Te('Accion sensible cancelada'));
}
function la() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (sa(), 0)
    );
}
async function ca(t) {
    const e = Number(t || 0);
    e &&
        (b().queue.practiceMode
            ? Te(`Practica: reprint ticket ${e}`)
            : (await L('queue-reprint', { method: 'POST', body: { id: e } }),
              Te(`Reimpresion ticket ${e}`)));
}
function ra() {
    Qe({ helpOpen: !b().queue.helpOpen });
}
function ua(t) {
    const e = Boolean(t);
    (Ve(),
        Qe({ practiceMode: e }),
        Te(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function da() {
    const t = b(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        xe().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
async function pa(t) {
    const e = b();
    if (e.queue.captureCallKeyMode) {
        const e = {
            key: String(t.key || ''),
            code: String(t.code || ''),
            location: Number(t.location || 0),
        };
        return (
            Qe({ customCallKey: e, captureCallKeyMode: !1 }),
            s('Tecla externa guardada', 'success'),
            void Te(`Tecla externa calibrada: ${e.code}`)
        );
    }
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                ke(e.code) === ke(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await aa(e.queue.stationConsultorio));
    const a = ke(t.code),
        n = ke(t.key),
        i =
            'numpadenter' === a ||
            'kpenter' === a ||
            ('enter' === n && 3 === Number(t.location || 0));
    if (i && e.queue.pendingSensitiveAction) await oa();
    else {
        if ('numpad2' === a || '2' === n)
            return 'locked' === e.queue.stationMode &&
                2 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void Te('Cambio de estación bloqueado por lock'))
                : (Qe({ stationConsultorio: 2 }),
                  void Te('Numpad: estacion C2'));
        if ('numpad1' === a || '1' === n)
            return 'locked' === e.queue.stationMode &&
                1 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void Te('Cambio de estación bloqueado por lock'))
                : (Qe({ stationConsultorio: 1 }),
                  void Te('Numpad: estacion C1'));
        if (i) {
            if (e.queue.oneTap) {
                const t = da();
                t &&
                    (await na({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    }));
            }
            await aa(e.queue.stationConsultorio);
        } else {
            if (
                'numpaddecimal' === a ||
                'kpdecimal' === a ||
                'decimal' === n ||
                ',' === n ||
                '.' === n
            ) {
                const t = da();
                return void (
                    t &&
                    je({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadsubtract' === a || 'kpsubtract' === a || '-' === n) {
                const t = da();
                return void (
                    t &&
                    je({
                        ticketId: t.id,
                        action: 'no_show',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadadd' === a || 'kpadd' === a || '+' === n) {
                const t = da();
                t &&
                    (await na({
                        ticketId: t.id,
                        action: 're-llamar',
                        consultorio: e.queue.stationConsultorio,
                    }),
                    Te(`Re-llamar ${t.ticketCode}`),
                    s(`Re-llamar ${t.ticketCode}`, 'info'));
            }
        }
    }
}
function ma(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ba(e, a, n, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(i)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(n)}</small>\n            </div>\n            <strong>${t(a)}</strong>\n        </li>\n    `;
}
function ga(t) {
    const e = Math.max(0, Math.min(5, Math.round(Number(t || 0))));
    return `${'★'.repeat(e)}${'☆'.repeat(5 - e)}`;
}
function ha(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
const fa = 'adminLastSection',
    ya = 'adminSidebarCollapsed';
function va(t, { persist: e = !1 } = {}) {
    const a = (function (t) {
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
    })(t);
    (g((e) => ({ ...e, ui: { ...e.ui, themeMode: t, theme: a } })),
        e &&
            (function (t) {
                const e = C.has(t) ? t : 'system';
                y(S, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const a = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
}
function ka() {
    const t = b();
    (y(fa, t.ui.activeSection), y(ya, t.ui.sidebarCollapsed ? '1' : '0'));
}
function wa() {
    const t = (function () {
        const t = b(),
            e = Number(t.ui.lastRefreshAt || 0);
        if (!e) return 'Datos: sin sincronizar';
        const a = Math.max(0, Math.round((Date.now() - e) / 1e3));
        return a < 60
            ? `Datos: hace ${a}s`
            : `Datos: hace ${Math.round(a / 60)}m`;
    })();
    (l('#adminRefreshStatus', t),
        l(
            '#adminSyncState',
            'Datos: sin sincronizar' === t
                ? 'Listo para primera sincronizacion'
                : t.replace('Datos: ', 'Estado: ')
        ));
}
function Sa() {
    (R(!1),
        V(),
        j(!1),
        z({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function Ca(t, e = {}) {
    const a = A(t, 'dashboard'),
        { force: n = !1 } = e,
        i = b().ui.activeSection;
    (n ||
        'availability' !== b().ui.activeSection ||
        'availability' === a ||
        !re() ||
        window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        )) &&
        (!(function (t) {
            const e = A(t, 'dashboard');
            (g((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                O(e),
                K(b()),
                M(e),
                ka());
        })(a),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const t = b();
                return (
                    'fallback' !== ke(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await ta()));
}
function qa() {
    (g((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    })),
        Ta(),
        ka());
}
function Aa() {
    (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } })),
        Ta());
}
function Ma() {
    (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })), Ta());
}
function Ta() {
    const t = b(),
        a = window.matchMedia('(max-width: 1024px)').matches;
    !(function ({ open: t, collapsed: a }) {
        const n = e('#adminSidebar'),
            i = e('#adminSidebarBackdrop'),
            o = e('#adminMenuToggle');
        (n && n.classList.toggle('is-open', Boolean(t)),
            i && i.classList.toggle('is-hidden', !t),
            o && o.setAttribute('aria-expanded', String(Boolean(t))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(t)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(a)
            ));
        const s = e('#adminSidebarCollapse');
        s && s.setAttribute('aria-pressed', String(Boolean(a)));
    })({
        open: !!a && t.ui.sidebarOpen,
        collapsed: !a && t.ui.sidebarCollapsed,
    });
}
function $a() {
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function _a() {
    const t = b().ui.activeSection;
    if ('appointments' === t) {
        const t = document.getElementById('searchAppointments');
        return void (t instanceof HTMLInputElement && t.focus());
    }
    if ('callbacks' === t) {
        const t = document.getElementById('searchCallbacks');
        return void (t instanceof HTMLInputElement && t.focus());
    }
    if ('queue' === t) {
        const t = document.getElementById('queueSearchInput');
        t instanceof HTMLInputElement && t.focus();
    }
}
async function La(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await Ca('appointments'), vt('pending_transfer'), kt(''));
            break;
        case 'appointments_all':
            (await Ca('appointments'), vt('all'), kt(''));
            break;
        case 'appointments_no_show':
            (await Ca('appointments'), vt('no_show'), kt(''));
            break;
        case 'callbacks_pending':
            (await Ca('callbacks'), Ht('pending'));
            break;
        case 'callbacks_contacted':
            (await Ca('callbacks'), Ht('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await Ca('callbacks'), Ht('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await Ca('queue'), ea('sla_risk'));
            break;
        case 'queue_waiting':
            (await Ca('queue'), ea('waiting'));
            break;
        case 'queue_called':
            (await Ca('queue'), ea('called'));
            break;
        case 'queue_no_show':
            (await Ca('queue'), ea('no_show'));
            break;
        case 'queue_all':
            (await Ca('queue'), ea('all'));
            break;
        case 'queue_call_next':
            (await Ca('queue'), await aa(b().queue.stationConsultorio));
    }
}
async function Na(e = !1) {
    const a = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    L('data'),
                    L('health').catch(() => null),
                ]),
                a = t.data || {};
            let n = a.funnelMetrics || null;
            if (!n) {
                const t = await L('funnel-metrics').catch(() => null);
                n = t?.data || null;
            }
            const i = {
                appointments: Array.isArray(a.appointments)
                    ? a.appointments
                    : [],
                callbacks: Array.isArray(a.callbacks) ? a.callbacks : [],
                reviews: Array.isArray(a.reviews) ? a.reviews : [],
                availability:
                    a.availability && 'object' == typeof a.availability
                        ? a.availability
                        : {},
                availabilityMeta:
                    a.availabilityMeta && 'object' == typeof a.availabilityMeta
                        ? a.availabilityMeta
                        : {},
                queueTickets: et(a),
                queueMeta:
                    a.queueMeta && 'object' == typeof a.queueMeta
                        ? a.queueMeta
                        : a.queue_state && 'object' == typeof a.queue_state
                          ? a.queue_state
                          : null,
                funnelMetrics: n,
                health: e && e.ok ? e : null,
            };
            return (
                at(i),
                (function (t) {
                    (k(Q, t.appointments || []),
                        k(W, t.callbacks || []),
                        k(G, t.reviews || []),
                        k(J, t.availability || {}),
                        k(Y, t.availabilityMeta || {}),
                        k(Z, t.queueTickets || []),
                        k(X, t.queueMeta || null),
                        k(tt, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (
                at({
                    appointments: v(Q, []),
                    callbacks: v(W, []),
                    reviews: v(G, []),
                    availability: v(J, {}),
                    availabilityMeta: v(Y, {}),
                    queueTickets: v(Z, []),
                    queueMeta: v(X, null),
                    health: v(tt, null),
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
    })();
    (!(function () {
        const t = b(),
            e = Qt(t.data.availability || {}),
            a = Yt(t.availability.selectedDate, e);
        (Xt({
            draft: e,
            selectedDate: a,
            monthAnchor: Jt(t.availability.monthAnchor, a),
            draftDirty: !1,
            lastAction: '',
        }),
            ce());
    })(),
        await (async function () {
            const t = b(),
                e = Array.isArray(t.data.queueTickets)
                    ? t.data.queueTickets.map((t, e) => _e(t, e))
                    : [],
                a =
                    t.data.queueMeta && 'object' == typeof t.data.queueMeta
                        ? Ee(t.data.queueMeta, e)
                        : null;
            if (e.length)
                return void Ue(e, a || null, {
                    fallbackPartial: !1,
                    syncMode: 'live',
                });
            const n = a ? De(a) : [];
            if (n.length)
                return (
                    Ue(n, a, { fallbackPartial: !0, syncMode: 'fallback' }),
                    void Te('Queue fallback parcial desde metadata')
                );
            if ((await ta(), (b().data.queueTickets || []).length)) return;
            const i = v(he, null);
            if (i?.queueTickets?.length)
                return (
                    Ue(i.queueTickets, i.queueMeta || null, {
                        fallbackPartial: !0,
                        syncMode: 'fallback',
                    }),
                    void Te('Queue fallback desde snapshot local')
                );
            Ue([], null, { fallbackPartial: !1, syncMode: 'live' });
        })(),
        K(b()),
        (function (e) {
            const a = Array.isArray(e.data.appointments)
                    ? e.data.appointments
                    : [],
                n = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
                i = Array.isArray(e.data.reviews) ? e.data.reviews : [],
                s = e.data.funnelMetrics || {},
                r = new Date().toISOString().split('T')[0],
                u = a.filter((t) => String(t.date || '') === r).length,
                d = n.filter((t) => {
                    const e = ma(t.status);
                    return 'pending' === e || 'pendiente' === e;
                }).length,
                p = a.filter((t) => 'no_show' === ma(t.status)).length,
                m = i.length
                    ? (
                          i.reduce((t, e) => t + Number(e.rating || 0), 0) /
                          i.length
                      ).toFixed(1)
                    : '0.0',
                b = i.filter((t) => {
                    const e = new Date(t.date || t.createdAt || '');
                    return (
                        !Number.isNaN(e.getTime()) &&
                        Date.now() - e.getTime() <= 2592e6
                    );
                }).length;
            (l('#todayAppointments', u),
                l('#totalAppointments', a.length),
                l('#pendingCallbacks', d),
                l('#totalReviewsCount', i.length),
                l('#totalNoShows', p),
                l('#avgRating', m),
                l('#adminAvgRating', m),
                l('#dashboardHeroRating', m),
                l('#dashboardHeroRecentReviews', b));
            const g = s.summary || {};
            (l('#funnelViewBooking', o(g.viewBooking || 0)),
                l('#funnelStartCheckout', o(g.startCheckout || 0)),
                l('#funnelBookingConfirmed', o(g.bookingConfirmed || 0)),
                l(
                    '#funnelAbandonRate',
                    `${Number(g.abandonRatePct || 0).toFixed(1)}%`
                ));
            const h = (e, a, n) =>
                Array.isArray(e) && e.length
                    ? e
                          .slice(0, 6)
                          .map((e) => {
                              return (
                                  (i = String(e[a] || e.label || '-')),
                                  (o = String(e[n] ?? e.count ?? 0)),
                                  `<li><span>${t(i)}</span><strong>${t(o)}</strong></li>`
                              );
                              var i, o;
                          })
                          .join('')
                    : '<li><span>Sin datos</span><strong>0</strong></li>';
            (c(
                '#funnelEntryList',
                h(s.checkoutEntryBreakdown, 'entry', 'count')
            ),
                c('#funnelSourceList', h(s.sourceBreakdown, 'source', 'count')),
                c(
                    '#funnelPaymentMethodList',
                    h(s.paymentMethodBreakdown, 'method', 'count')
                ),
                c(
                    '#funnelAbandonReasonList',
                    h(s.abandonReasonBreakdown, 'reason', 'count')
                ),
                c(
                    '#funnelStepList',
                    h(s.bookingStepBreakdown, 'step', 'count')
                ),
                c(
                    '#funnelErrorCodeList',
                    h(s.errorCodeBreakdown, 'code', 'count')
                ),
                c(
                    '#funnelAbandonList',
                    h(s.checkoutAbandonByStep, 'step', 'count')
                ));
            const f = a.filter((t) => {
                    const e = ma(t.paymentStatus || t.payment_status);
                    return (
                        'pending_transfer_review' === e ||
                        'pending_transfer' === e
                    );
                }).length,
                y = n.filter((t) => {
                    const e = ma(t.status);
                    if ('pending' !== e && 'pendiente' !== e) return !1;
                    const a = new Date(t.fecha || t.createdAt || '');
                    return (
                        !Number.isNaN(a.getTime()) &&
                        (Date.now() - a.getTime()) / 6e4 >= 60
                    );
                }).length;
            (l('#operationPendingReviewCount', f),
                l('#operationPendingCallbacksCount', d),
                l('#operationTodayLoadCount', u),
                l('#dashboardHeroPendingTransfers', f),
                l('#dashboardHeroUrgentCallbacks', y),
                l(
                    '#operationQueueHealth',
                    y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
                ),
                l(
                    '#dashboardQueueHealth',
                    y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
                ),
                l(
                    '#dashboardLiveStatus',
                    f > 0 || y > 0 ? 'Atencion' : 'Estable'
                ),
                l(
                    '#dashboardLiveMeta',
                    f > 0
                        ? 'Existen transferencias pendientes por validar.'
                        : y > 0
                          ? 'Hay callbacks fuera de SLA que requieren contacto.'
                          : 'Sin alertas criticas en la operacion actual.'
                ),
                l(
                    '#dashboardFlowStatus',
                    u > 6
                        ? 'Agenda con demanda alta'
                        : p > 0
                          ? 'Revisar ausencias del dia'
                          : 'Flujo operativo bajo control'
                ),
                l(
                    '#dashboardHeroSummary',
                    f > 0 || y > 0
                        ? `Prioriza ${f} transferencia(s) y ${y} callback(s) urgentes.`
                        : 'Agenda, callbacks y disponibilidad en una sola vista de control.'
                ),
                c(
                    '#operationActionList',
                    [
                        {
                            action: 'context-open-appointments-transfer',
                            label: 'Validar transferencias',
                            desc: `${f} por revisar`,
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
            (l(
                '#operationRefreshSignal',
                v
                    ? `Sync ${new Date(v).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tiempo real'
            ),
                l(
                    '#operationDeckMeta',
                    f > 0 || d > 0 ? 'Prioridades activas' : 'Operacion estable'
                ),
                c(
                    '#dashboardAttentionList',
                    [
                        ba(
                            'Transferencias',
                            String(f),
                            f > 0
                                ? 'Comprobantes por revisar'
                                : 'Sin pendientes',
                            f > 0 ? 'warning' : 'neutral'
                        ),
                        ba(
                            'Callbacks urgentes',
                            String(y),
                            y > 0
                                ? 'Mayores a 60 minutos'
                                : 'SLA dentro de rango',
                            y > 0 ? 'danger' : 'neutral'
                        ),
                        ba(
                            'No show',
                            String(p),
                            p > 0
                                ? 'Requiere seguimiento'
                                : 'Sin ausencias recientes',
                            p > 0 ? 'warning' : 'neutral'
                        ),
                    ].join('')
                ));
        })(b()),
        ft(),
        It(),
        (function () {
            const e = b(),
                a = Array.isArray(e.data.reviews) ? e.data.reviews : [],
                n = (function (t) {
                    return t
                        .slice()
                        .sort(
                            (t, e) =>
                                new Date(e.date || e.createdAt || 0).getTime() -
                                new Date(t.date || t.createdAt || 0).getTime()
                        );
                })(a),
                o = a.length
                    ? a.reduce((t, e) => t + Number(e.rating || 0), 0) /
                      a.length
                    : 0,
                s = a.filter((t) => Number(t.rating || 0) >= 5).length,
                r = a.filter((t) => {
                    const e = new Date(t.date || t.createdAt || '');
                    return (
                        !Number.isNaN(e.getTime()) &&
                        Date.now() - e.getTime() <= 2592e6
                    );
                }).length;
            if (
                (l('#reviewsAverageRating', o.toFixed(1)),
                l('#reviewsFiveStarCount', s),
                l('#reviewsRecentCount', r),
                l('#reviewsTotalCount', a.length),
                l(
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
                    })(o, a.length)
                ),
                c(
                    '#reviewsSummaryRail',
                    (function (e, a) {
                        const n = e[0],
                            o = n ? i(n.date || n.createdAt || '') : '-';
                        return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${t(n ? String(n.name || 'Anonimo') : 'Sin datos')}</strong>\n            <small>${t(o)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${t(String(a))} en 30 dias</strong>\n            <small>Lectura del pulso reciente</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Seal premium</span>\n            <strong>${t(e.length >= 5 ? 'Base consistente' : 'Volumen inicial')}</strong>\n            <small>Calidad y recurrencia de comentarios</small>\n        </article>\n    `;
                    })(n, r)
                ),
                !a.length)
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
            const u = n.find((t) => Number(t.rating || 0) >= 5) || n[0];
            (c(
                '#reviewsSpotlight',
                `\n            <article class="reviews-spotlight-card">\n                <div class="reviews-spotlight-top">\n                    <span class="review-avatar">${t(ha(u.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(u.name || 'Anonimo')}</strong>\n                        <small>${t(i(u.date || u.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <p class="reviews-spotlight-stars">${t(ga(u.rating))}</p>\n                <p>${t(u.comment || u.review || '')}</p>\n            </article>\n        `
            ),
                c(
                    '#reviewsGrid',
                    n
                        .map((e) => {
                            const a = Number(e.rating || 0);
                            return `\n                <article class="review-card" data-rating="${t(String(a))}">\n                    <header>\n                        <div class="review-card-heading">\n                            <span class="review-avatar">${t(ha(e.name || 'Anonimo'))}</span>\n                            <div>\n                                <strong>${t(e.name || 'Anonimo')}</strong>\n                                <small>${t(i(e.date || e.createdAt || ''))}</small>\n                            </div>\n                        </div>\n                        <span class="review-rating-badge">${t(ga(a))}</span>\n                    </header>\n                    <p>${t(e.comment || e.review || '')}</p>\n                </article>\n            `;
                        })
                        .join('')
                ));
        })(),
        ce(),
        Je(),
        wa(),
        e &&
            s(
                a ? 'Datos actualizados' : 'Datos cargados desde cache local',
                a ? 'success' : 'warning'
            ));
}
function Ea(t) {
    const e = String(t || '')
        .trim()
        .toLowerCase();
    return e
        ? e.includes('callbacks') && e.includes('pend')
            ? 'callbacks_pending'
            : e.includes('callback') && (e.includes('urg') || e.includes('sla'))
              ? 'callbacks_sla_urgent'
              : e.includes('citas') && e.includes('transfer')
                ? 'appointments_pending_transfer'
                : e.includes('queue') || e.includes('cola')
                  ? 'queue_sla_risk'
                  : e.includes('no show')
                    ? 'appointments_no_show'
                    : null
        : null;
}
async function Ba(t, a) {
    switch (t) {
        case 'close-toast':
            return void a.closest('.toast')?.remove();
        case 'set-admin-theme':
            return void va(String(a.dataset.themeMode || 'system'), {
                persist: !0,
            });
        case 'toggle-sidebar-collapse':
            return void qa();
        case 'refresh-admin-data':
            return void (await Na(!0));
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = Ea(t.value);
                e && (await La(e));
            }
            return;
        }
        case 'logout':
            return (
                await (async function () {
                    try {
                        await N('logout', { method: 'POST' });
                    } catch (t) {}
                    (_(''),
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
                })(),
                H(),
                Sa(),
                void s('Sesion cerrada', 'info')
            );
        case 'reset-login-2fa':
            return (
                g((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                R(!1),
                V(),
                z({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                void U('password')
            );
        case 'appointment-quick-filter':
            return void vt(String(a.dataset.filterValue || 'all'));
        case 'clear-appointment-filters':
            return void yt({ filter: 'all', search: '' });
        case 'appointment-density':
            return void yt({
                density:
                    'compact' === nt(String(a.dataset.density || 'comfortable'))
                        ? 'compact'
                        : 'comfortable',
            });
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await St(t, { paymentStatus: 'paid' }),
                        wt(t, { paymentStatus: 'paid' }));
                })(Number(a.dataset.id || 0)),
                void s('Transferencia aprobada', 'success')
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await St(t, { paymentStatus: 'failed' }),
                        wt(t, { paymentStatus: 'failed' }));
                })(Number(a.dataset.id || 0)),
                void s('Transferencia rechazada', 'warning')
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await St(t, { status: 'no_show' }),
                        wt(t, { status: 'no_show' }));
                })(Number(a.dataset.id || 0)),
                void s('Marcado como no show', 'warning')
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await St(t, { status: 'cancelled' }),
                        wt(t, { status: 'cancelled' }));
                })(Number(a.dataset.id || 0)),
                void s('Cita cancelada', 'warning')
            );
        case 'export-csv':
            return void (function () {
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
                        ...(b().data.appointments || []).map((t) => [
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
                                .map(
                                    (t) =>
                                        `"${String(t ?? '').replace(/"/g, '""')}"`
                                )
                                .join(',')
                        )
                        .join('\n'),
                    e = new Blob([t], { type: 'text/csv;charset=utf-8' }),
                    a = URL.createObjectURL(e),
                    n = document.createElement('a');
                ((n.href = a),
                    (n.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
                    document.body.appendChild(n),
                    n.click(),
                    n.remove(),
                    URL.revokeObjectURL(a));
            })();
        case 'callback-quick-filter':
            return void Ht(String(a.dataset.filterValue || 'all'));
        case 'clear-callback-filters':
            return void Pt({
                filter: 'all',
                sort: 'recent_desc',
                search: '',
                selected: [],
            });
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await Ca('callbacks'),
                Ht('pending'),
                void (function () {
                    const t = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    t instanceof HTMLElement && t.focus();
                })()
            );
        case 'mark-contacted':
            return (
                await Ft(
                    Number(a.dataset.callbackId || 0),
                    String(a.dataset.callbackDate || '')
                ),
                void s('Callback actualizado', 'success')
            );
        case 'change-month':
            return void (function (t) {
                const e = Number(t || 0);
                if (!Number.isFinite(e) || 0 === e) return;
                const a = Jt(
                    b().availability.monthAnchor,
                    b().availability.selectedDate
                );
                (a.setMonth(a.getMonth() + e),
                    Xt({ monthAnchor: a, lastAction: '' }, { render: !0 }));
            })(Number(a.dataset.delta || 0));
        case 'availability-today':
        case 'context-availability-today':
            return void se(u(new Date()), 'Hoy');
        case 'availability-prev-with-slots':
            return void (function () {
                const t = le(-1);
                t
                    ? se(t, `Fecha previa con slots: ${t}`)
                    : ee('No hay fechas anteriores con slots');
            })();
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return void (function () {
                const t = le(1);
                t
                    ? se(t, `Siguiente fecha con slots: ${t}`)
                    : ee('No hay fechas siguientes con slots');
            })();
        case 'select-availability-day':
            return void (function (t) {
                const e = Vt(t);
                e &&
                    Xt(
                        {
                            selectedDate: e,
                            monthAnchor: Jt(e, e),
                            lastAction: '',
                        },
                        { render: !0 }
                    );
            })(String(a.dataset.date || ''));
        case 'prefill-time-slot':
            return void (function (t) {
                if (ie()) return;
                const a = e('#newSlotTime');
                a instanceof HTMLInputElement && ((a.value = zt(t)), a.focus());
            })(String(a.dataset.time || ''));
        case 'add-time-slot':
            return void (function () {
                if (ie()) return;
                const t = e('#newSlotTime');
                if (!(t instanceof HTMLInputElement)) return;
                const a = zt(t.value);
                if (!a) return;
                const n = b(),
                    i = Vt(n.availability.selectedDate) || oe();
                i &&
                    (ae(
                        i,
                        [
                            ...(Array.isArray(n.availability.draft[i])
                                ? n.availability.draft[i]
                                : []),
                            a,
                        ],
                        `Slot ${a} agregado en ${i}`
                    ),
                    (t.value = ''));
            })();
        case 'remove-time-slot':
            return void (function (t, e) {
                if (ie()) return;
                const a = Vt(t);
                if (!a) return;
                const n = b(),
                    i = Array.isArray(n.availability.draft[a])
                        ? n.availability.draft[a]
                        : [],
                    o = zt(e);
                ae(
                    a,
                    i.filter((t) => zt(t) !== o),
                    `Slot ${o || '-'} removido en ${a}`
                );
            })(
                decodeURIComponent(String(a.dataset.date || '')),
                decodeURIComponent(String(a.dataset.time || ''))
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return void (function () {
                if (ie()) return;
                const t = b(),
                    e = Vt(t.availability.selectedDate) || oe(),
                    a = Array.isArray(t.availability.draft[e])
                        ? jt(t.availability.draft[e])
                        : [];
                Xt(
                    {
                        clipboard: a,
                        clipboardDate: e,
                        lastAction: a.length
                            ? `Portapapeles: ${a.length} slots (${e})`
                            : 'Portapapeles vacio',
                    },
                    { render: !0 }
                );
            })();
        case 'paste-availability-day':
            return void (function () {
                if (ie()) return;
                const t = b(),
                    e = Array.isArray(t.availability.clipboard)
                        ? jt(t.availability.clipboard)
                        : [];
                if (!e.length) return void ee('Portapapeles vacio');
                const a = Vt(t.availability.selectedDate) || oe();
                ae(a, e, `Pegado ${e.length} slots en ${a}`);
            })();
        case 'duplicate-availability-day-next':
            return void ue(1);
        case 'duplicate-availability-next-week':
            return void ue(7);
        case 'clear-availability-day':
            return void (function () {
                if (ie()) return;
                const t = Vt(b().availability.selectedDate) || oe();
                t &&
                    window.confirm(
                        `Se eliminaran los slots del dia ${t}. ¿Continuar?`
                    ) &&
                    ae(t, [], `Dia ${t} limpiado`);
            })();
        case 'clear-availability-week':
            return void (function () {
                if (ie()) return;
                const t = Vt(b().availability.selectedDate) || oe();
                if (!t) return;
                const e = (function (t) {
                    const e = Ut(t);
                    if (!e) return null;
                    const a = (e.getDay() + 6) % 7,
                        n = new Date(e);
                    n.setDate(e.getDate() - a);
                    const i = new Date(n);
                    return (i.setDate(n.getDate() + 6), { start: n, end: i });
                })(t);
                if (!e) return;
                const a = u(e.start),
                    n = u(e.end);
                if (
                    !window.confirm(
                        `Se eliminaran los slots de la semana ${a} a ${n}. ¿Continuar?`
                    )
                )
                    return;
                const i = ne();
                for (let t = 0; t < 7; t += 1) {
                    const a = new Date(e.start);
                    (a.setDate(e.start.getDate() + t), delete i[u(a)]);
                }
                te(i, {
                    selectedDate: t,
                    lastAction: `Semana limpiada (${a} - ${n})`,
                });
            })();
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (ie()) return;
                    const t = ne(),
                        e = await L('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        a =
                            e?.data && 'object' == typeof e.data
                                ? Qt(e.data)
                                : t,
                        n =
                            e?.meta && 'object' == typeof e.meta
                                ? e.meta
                                : null;
                    (g((t) => ({
                        ...t,
                        data: {
                            ...t.data,
                            availability: a,
                            availabilityMeta: n
                                ? { ...t.data.availabilityMeta, ...n }
                                : t.data.availabilityMeta,
                        },
                        availability: {
                            ...t.availability,
                            draft: a,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        ce());
                })(),
                void s('Disponibilidad guardada', 'success')
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (ie()) return;
                    const t = b();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. ¿Continuar?'
                        )
                    )
                        return;
                    const e = Qt(t.data.availability || {}),
                        a = Yt(t.availability.selectedDate, e);
                    Xt(
                        {
                            draft: e,
                            selectedDate: a,
                            monthAnchor: Jt(t.availability.monthAnchor, a),
                            draftDirty: !1,
                            lastAction: 'Borrador descartado',
                        },
                        { render: !0 }
                    );
                })(),
                void s('Borrador descartado', 'info')
            );
        case 'queue-refresh-state':
            return void (await ta());
        case 'queue-call-next':
            return void (await aa(Number(a.dataset.queueConsultorio || 0)));
        case 'queue-release-station':
            return void (await (async function (t) {
                const e = 2 === Number(t || 0) ? 2 : 1,
                    a = We(e);
                a
                    ? await ia(a.id, 'liberar', e)
                    : Te(`Sin ticket activo para liberar en C${e}`);
            })(Number(a.dataset.queueConsultorio || 0)));
        case 'queue-toggle-ticket-select':
            return void (function (t) {
                const e = Number(t || 0);
                if (!e) return;
                const a = He();
                Oe(a.includes(e) ? a.filter((t) => t !== e) : [...a, e]);
            })(Number(a.dataset.queueId || 0));
        case 'queue-select-visible':
            return void Oe(Ie().map((t) => Number(t.id || 0)));
        case 'queue-clear-selection':
            return void Re();
        case 'queue-ticket-action':
            return void (await ia(
                Number(a.dataset.queueId || 0),
                String(a.dataset.queueAction || ''),
                Number(a.dataset.queueConsultorio || 0)
            ));
        case 'queue-reprint-ticket':
            return void (await ca(Number(a.dataset.queueId || 0)));
        case 'queue-bulk-action':
            return void (await (async function (t) {
                const e = Fe(),
                    a = Se(t);
                if (e.length) {
                    if (ve.has(a)) {
                        const t =
                            'no_show' === a
                                ? 'No show'
                                : 'completar' === a || 'completed' === a
                                  ? 'Completar'
                                  : 'Cancelar';
                        if (!window.confirm(`${t}: confirmar acción masiva`))
                            return;
                    }
                    for (const t of e)
                        try {
                            await na({
                                ticketId: t.id,
                                action: a,
                                consultorio:
                                    t.assignedConsultorio ||
                                    b().queue.stationConsultorio,
                            });
                        } catch (t) {}
                    (Re(), Te(`Bulk ${a} sobre ${e.length} tickets`));
                }
            })(String(a.dataset.queueAction || 'no_show')));
        case 'queue-bulk-reprint':
            return void (await (async function () {
                const t = Fe();
                for (const e of t)
                    try {
                        await ca(e.id);
                    } catch (t) {}
                (Re(), Te(`Bulk reimpresion ${t.length}`));
            })());
        case 'queue-clear-search':
            return void (function () {
                Qe({ search: '', selected: [] });
                const t = document.getElementById('queueSearchInput');
                t instanceof HTMLInputElement && (t.value = '');
            })();
        case 'queue-toggle-shortcuts':
            return void ra();
        case 'queue-toggle-one-tap':
            return void Qe({ oneTap: !b().queue.oneTap });
        case 'queue-start-practice':
            return void ua(!0);
        case 'queue-stop-practice':
            return void ua(!1);
        case 'queue-lock-station':
            return void (function (t) {
                const e = 2 === Number(t || 0) ? 2 : 1;
                (Qe({ stationMode: 'locked', stationConsultorio: e }),
                    Te(`Estacion bloqueada en C${e}`));
            })(Number(a.dataset.queueConsultorio || 1));
        case 'queue-set-station-mode':
            return void (function (t) {
                if ('free' === ke(t))
                    return (
                        Qe({ stationMode: 'free' }),
                        void Te('Estacion en modo libre')
                    );
                Qe({ stationMode: 'locked' });
            })(String(a.dataset.queueMode || 'free'));
        case 'queue-sensitive-confirm':
            return void (await oa());
        case 'queue-sensitive-cancel':
            return void sa();
        case 'queue-capture-call-key':
            return (
                Qe({ captureCallKeyMode: !0 }),
                void s('Calibración activa: presiona la tecla externa', 'info')
            );
        case 'queue-clear-call-key':
            return void (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                (Qe({ customCallKey: null, captureCallKeyMode: !1 }),
                s('Tecla externa eliminada', 'success'))
            );
        case 'callbacks-bulk-select-visible':
            return void Pt(
                {
                    selected: Array.from(
                        document.querySelectorAll(
                            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
                        )
                    )
                        .map((t) =>
                            Number(t.getAttribute('data-callback-id') || 0)
                        )
                        .filter((t) => t > 0),
                },
                { persist: !1 }
            );
        case 'callbacks-bulk-clear':
            return void Pt({ selected: [] }, { persist: !1 });
        case 'callbacks-bulk-mark':
            return void (await (async function () {
                const t = (b().callbacks.selected || [])
                    .map((t) => Number(t || 0))
                    .filter((t) => t > 0);
                for (const e of t)
                    try {
                        await Ft(e);
                    } catch (t) {}
            })());
        case 'context-open-appointments-transfer':
            return (await Ca('appointments'), void vt('pending_transfer'));
        case 'context-open-callbacks-pending':
            return (await Ca('callbacks'), void Ht('pending'));
        case 'context-open-dashboard':
            return void (await Ca('dashboard'));
    }
}
async function Da(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = e instanceof HTMLInputElement ? e.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        j(!0);
        const t = b();
        if (
            (z({
                tone: t.auth.requires2FA ? 'warning' : 'neutral',
                title: t.auth.requires2FA
                    ? 'Validando segundo factor'
                    : 'Validando credenciales',
                message: t.auth.requires2FA
                    ? 'Comprobando el codigo 2FA antes de abrir el panel.'
                    : 'Comprobando clave y proteccion de sesion.',
            }),
            t.auth.requires2FA)
        )
            await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Codigo 2FA requerido');
                const a = await N('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    n = String(a.csrfToken || '');
                return (
                    _(n),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                            lastAuthAt: Date.now(),
                            authMethod: '2fa',
                        },
                    })),
                    { authenticated: !0 }
                );
            })(i);
        else {
            const t = await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Contrasena requerida');
                const a = await N('login', {
                    method: 'POST',
                    body: { password: e },
                });
                if (!0 === a.twoFactorRequired)
                    return (
                        g((t) => ({
                            ...t,
                            auth: {
                                ...t.auth,
                                requires2FA: !0,
                                authMethod: 'password',
                            },
                        })),
                        { authenticated: !1, requires2FA: !0 }
                    );
                const n = String(a.csrfToken || '');
                return (
                    _(n),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                            lastAuthAt: Date.now(),
                            authMethod: 'password',
                        },
                    })),
                    { authenticated: !0, requires2FA: !1 }
                );
            })(n);
            if (t.requires2FA)
                return (
                    R(!0),
                    z({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void U('2fa')
                );
        }
        (z({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            F(),
            R(!1),
            V({ clearPassword: !0 }),
            await Na(!1),
            s('Sesion iniciada', 'success'));
    } catch (t) {
        (z({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            U(b().auth.requires2FA ? '2fa' : 'password'),
            s(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        j(!1);
    }
}
async function xa() {
    (!(function () {
        const t = e('#loginScreen'),
            a = e('#adminDashboard');
        if (!(t instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((t.innerHTML = `\n        <div class="sony-login-shell">\n            <section class="sony-login-hero">\n                <div class="sony-login-brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Admin Operations</h1>\n                    <p>Centro de control con una capa visual premium, autenticacion endurecida y flujo rapido para operacion diaria.</p>\n                </div>\n                <div class="sony-login-badge-row">\n                    <span class="sony-login-badge">Sony-like UI</span>\n                    <span class="sony-login-badge">CSP self-hosted</span>\n                    <span class="sony-login-badge">2FA ready</span>\n                </div>\n                <div class="sony-login-trust-grid">\n                    <article class="sony-login-trust-card">\n                        <span>Acceso</span>\n                        <strong>Sesion de administrador</strong>\n                        <small>Entrada aislada para operacion y triage.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Proteccion</span>\n                        <strong>Clave + verificacion</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Entorno</span>\n                        <strong>Activos locales</strong>\n                        <small>Fuentes, iconos y estilos propios sin dependencias remotas.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="sony-login-panel">\n                <div class="sony-login-panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para entrar al centro operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.\n                    </p>\n                </form>\n\n                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${B('sun')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${B('moon')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${B('system')}</button>\n                </div>\n            </section>\n        </div>\n    `),
            (a.innerHTML = `\n        <aside class="admin-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <strong>Piel en Armonia</strong>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${B('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                ${P('dashboard', 'Dashboard', 'dashboard', !0)}\n                ${P('appointments', 'Citas', 'appointments')}\n                ${P('callbacks', 'Callbacks', 'callbacks')}\n                ${P('reviews', 'Resenas', 'reviews')}\n                ${P('availability', 'Disponibilidad', 'availability')}\n                ${P('queue', 'Turnero Sala', 'queue')}\n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${B('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n        <main class="admin-main" id="adminMainContent" tabindex="-1">\n            <header class="admin-header">\n                <div class="admin-header-title-wrap">\n                    <button type="button" id="adminMenuToggle" aria-controls="adminSidebar" aria-expanded="false">${B('menu')}<span>Menu</span></button>\n                    <h2 id="pageTitle">Dashboard</h2>\n                </div>\n                <nav class="admin-quick-nav" data-qa="admin-quick-nav" aria-label="Navegacion rapida">\n                    ${I('dashboard', 'Dashboard', 'Alt+Shift+1', !0)}\n                    ${I('appointments', 'Citas', 'Alt+Shift+2')}\n                    ${I('callbacks', 'Callbacks', 'Alt+Shift+3')}\n                    ${I('reviews', 'Resenas', 'Alt+Shift+4')}\n                    ${I('availability', 'Disponibilidad', 'Alt+Shift+5')}\n                    ${I('queue', 'Turnero', 'Alt+Shift+6')}\n                </nav>\n                <div class="admin-header-actions">\n                    <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${B('sun')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${B('moon')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${B('system')}</button>\n                    </div>\n                    <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                </div>\n            </header>\n\n            <section class="sony-context-strip" id="adminProductivityStrip">\n                <div class="sony-context-grid">\n                    <div class="sony-context-copy">\n                        <p class="sony-kicker" id="adminSectionEyebrow">Control Deck</p>\n                        <h3 id="adminContextTitle">Vista general operativa</h3>\n                        <p id="adminContextSummary">Monitorea agenda, callbacks y cola desde un solo frente.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="sony-command-stage">\n                        <div class="sony-command-box">\n                            <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />\n                            <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                        </div>\n                        <div class="sony-status-cluster">\n                            <article class="sony-status-tile">\n                                <span>Push</span>\n                                <strong id="pushStatusIndicator">Inicializando</strong>\n                                <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                            </article>\n                            <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                                <span>Sesion</span>\n                                <strong id="adminSessionState">No autenticada</strong>\n                                <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                            </article>\n                            <article class="sony-status-tile">\n                                <span>Sincronizacion</span>\n                                <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                                <small id="adminSyncState">Listo para primera sincronizacion</small>\n                            </article>\n                        </div>\n                    </div>\n                </div>\n            </section>\n\n            \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Admin premium minimal</p>\n                        <h3>Centro operativo diario</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad en una sola vista de control.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda Premium</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Triage, pagos y seguimiento sin salir de la mesa.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">Triage de SLA</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n        </main>\n    `));
    })(),
        document.body.classList.add('admin-v2-mode'),
        (function () {
            (document.addEventListener('click', async (t) => {
                const e =
                    t.target instanceof Element
                        ? t.target.closest('[data-action]')
                        : null;
                if (!e) return;
                const a = String(e.getAttribute('data-action') || '');
                if (a) {
                    t.preventDefault();
                    try {
                        await Ba(a, e);
                    } catch (t) {
                        s(t?.message || 'Error ejecutando accion', 'error');
                    }
                }
            }),
                document.addEventListener('click', async (t) => {
                    const e =
                        t.target instanceof Element
                            ? t.target.closest('[data-section]')
                            : null;
                    if (!e) return;
                    const a = e.classList.contains('admin-quick-nav-item'),
                        n = e.classList.contains('nav-item');
                    (a || n) &&
                        (t.preventDefault(),
                        await Ca(
                            String(
                                e.getAttribute('data-section') || 'dashboard'
                            )
                        ),
                        window.matchMedia('(max-width: 1024px)').matches &&
                            Ma());
                }),
                document.addEventListener('click', (t) => {
                    const e =
                        t.target instanceof Element
                            ? t.target.closest('[data-queue-filter]')
                            : null;
                    e &&
                        (t.preventDefault(),
                        ea(
                            String(e.getAttribute('data-queue-filter') || 'all')
                        ));
                }));
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const e = document.getElementById('callbacksBulkClearBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-clear');
            const a = document.getElementById('callbacksBulkMarkBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = 'datetime_desc',
                e = 'comfortable';
            try {
                ((t = JSON.parse(
                    localStorage.getItem('admin-appointments-sort') ||
                        '"datetime_desc"'
                )),
                    (e = JSON.parse(
                        localStorage.getItem('admin-appointments-density') ||
                            '"comfortable"'
                    )));
            } catch (t) {}
            g((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof t ? t : 'datetime_desc',
                    density: 'string' == typeof e ? e : 'comfortable',
                },
            }));
        })(),
        (function () {
            let t = 'all',
                e = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(qt) || '"all"')),
                    (e = JSON.parse(
                        localStorage.getItem(Ct) || '"recent_desc"'
                    )));
            } catch (t) {}
            g((a) => ({
                ...a,
                callbacks: { ...a.callbacks, filter: $t(t), sort: _t(e) },
            }));
        })(),
        (function () {
            let t = '',
                e = '';
            try {
                ((t = String(localStorage.getItem(Ot) || '')),
                    (e = String(localStorage.getItem(Rt) || '')));
            } catch (t) {}
            const a = Vt(t),
                n = Jt(e, a);
            g((t) => ({
                ...t,
                availability: {
                    ...t.availability,
                    ...(a ? { selectedDate: a } : {}),
                    monthAnchor: n,
                },
            }));
        })(),
        (function () {
            const t = A(f(fa, 'dashboard')),
                e = '1' === f(ya, '0');
            (g((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                O(t),
                M(t),
                Ta());
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === ke(f(de, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(f(pe, '1')) ? 2 : 1,
                    oneTap: '1' === f(me, '0'),
                    helpOpen: '1' === f(ge, '0'),
                    customCallKey: v(be, null),
                },
                e = ke(w('station')),
                a = ke(w('lock')),
                n = ke(w('one_tap')),
                i =
                    'c2' === e || '2' === e
                        ? 2
                        : 'c1' === e || '1' === e
                          ? 1
                          : t.stationConsultorio,
                o = '1' === a || 'true' === a ? 'locked' : t.stationMode,
                s =
                    '1' === n ||
                    'true' === n ||
                    ('0' !== n && 'false' !== n && t.oneTap);
            (g((e) => ({
                ...e,
                queue: {
                    ...e.queue,
                    stationMode: o,
                    stationConsultorio: i,
                    oneTap: s,
                    helpOpen: t.helpOpen,
                    customCallKey:
                        t.customCallKey && 'object' == typeof t.customCallKey
                            ? t.customCallKey
                            : null,
                },
            })),
                $e(b()));
        })(),
        va(
            (function () {
                const t = String(f(S, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return C.has(t) ? t : 'system';
            })()
        ),
        Sa(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    vt(t.value);
                });
            const e = document.getElementById('appointmentSort');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    yt({ sort: nt(e.value) || 'datetime_desc' });
                });
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    kt(a.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    Ht(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Pt({ sort: _t(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value),
                        Pt({ search: String(t || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        Qe({ search: String(t || ''), selected: [] }));
                });
            const l = document.getElementById('adminQuickCommand');
            l instanceof HTMLInputElement &&
                l.addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = Ea(l.value);
                    e && (await La(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                a = e('#adminMenuClose'),
                n = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                window.matchMedia('(max-width: 1024px)').matches ? Aa() : qa();
            }),
                a?.addEventListener('click', () => Ma()),
                n?.addEventListener('click', () => Ma()),
                window.addEventListener('resize', () => {
                    window.matchMedia('(max-width: 1024px)').matches
                        ? Ta()
                        : Ma();
                }),
                window.addEventListener('hashchange', async () => {
                    const t = (function (t = 'dashboard') {
                        return A(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(b().ui.activeSection);
                    await Ca(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && va(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            re() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const t = document.getElementById('loginForm');
    (t instanceof HTMLFormElement && t.addEventListener('submit', Da),
        (function (t) {
            const {
                navigateToSection: e,
                focusQuickCommand: a,
                focusCurrentSearch: n,
                runQuickAction: i,
                closeSidebar: o,
                toggleMenu: s,
                dismissQueueSensitiveDialog: l,
                toggleQueueHelp: c,
                queueNumpadAction: u,
            } = t;
            window.addEventListener('keydown', (t) => {
                const d = String(t.key || '').toLowerCase(),
                    p = String(t.code || '').toLowerCase();
                if ('Escape' === t.key) {
                    if ('function' == typeof l && l()) return;
                    return void o();
                }
                if (t.ctrlKey && !t.shiftKey && !t.altKey && 'k' === d)
                    return (t.preventDefault(), void a());
                if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
                    return (t.preventDefault(), void n());
                if (t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey) {
                    const a = p || d;
                    if ('keym' === a) return (t.preventDefault(), void s());
                    if ('digit0' === a) return (t.preventDefault(), void c());
                    if (h[a]) {
                        if (r()) return;
                        return (t.preventDefault(), void e(h[a]));
                    }
                    const n = {
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
                        ('queue' === b().ui.activeSection &&
                            Object.assign(n, {
                                keyw: 'queue_waiting',
                                keyc: 'queue_called',
                                keya: 'queue_all',
                                keyo: 'queue_all',
                                keyl: 'queue_sla_risk',
                            }),
                        n[a])
                    ) {
                        if (r()) return;
                        return (t.preventDefault(), void i(n[a]));
                    }
                }
                const m = b().queue,
                    g = Boolean(m.captureCallKeyMode),
                    f = m.customCallKey,
                    y =
                        f &&
                        'object' == typeof f &&
                        String(f.key || '') === String(t.key || '') &&
                        String(f.code || '').toLowerCase() === p &&
                        Number(f.location || 0) === Number(t.location || 0);
                if (
                    p.startsWith('numpad') ||
                    3 === t.location ||
                    ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(
                        p
                    ) ||
                    g ||
                    y
                ) {
                    if (r()) return;
                    Promise.resolve(
                        u({ key: t.key, code: t.code, location: t.location })
                    ).catch(() => {});
                }
            });
        })({
            navigateToSection: Ca,
            focusQuickCommand: $a,
            focusCurrentSearch: _a,
            runQuickAction: La,
            closeSidebar: Ma,
            toggleMenu: () => {
                window.matchMedia('(max-width: 1024px)').matches ? Aa() : qa();
            },
            dismissQueueSensitiveDialog: la,
            toggleQueueHelp: () => ra(),
            queueNumpadAction: pa,
        }));
    const a = await (async function () {
        try {
            const t = await N('status'),
                e = !0 === t.authenticated,
                a = e ? String(t.csrfToken || '') : '';
            return (
                _(a),
                g((t) => ({
                    ...t,
                    auth: {
                        ...t.auth,
                        authenticated: e,
                        csrfToken: a,
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
    })();
    (a
        ? await (async function () {
              (F(), await Na(!1), O(b().ui.activeSection));
          })()
        : (H(), Sa()),
        (async function () {
            const t = (function () {
                const t = 'Notification' in window,
                    e = 'serviceWorker' in navigator,
                    a = 'PushManager' in window;
                if (!t)
                    return {
                        tone: 'neutral',
                        label: 'Push no disponible',
                        meta: 'Este navegador no soporta notificaciones.',
                    };
                const n = String(Notification.permission || 'default');
                return 'granted' === n
                    ? {
                          tone: 'success',
                          label: e && a ? 'Push listo' : 'Push parcial',
                          meta:
                              e && a
                                  ? 'Permisos concedidos y APIs disponibles.'
                                  : 'Permiso otorgado, pero faltan APIs del navegador.',
                      }
                    : 'denied' === n
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
                const a = document.getElementById(e);
                a &&
                    (a.setAttribute('data-state', t.tone), l(`#${e}`, t.label));
            }),
                ['pushStatusMeta', 'dashboardPushMeta'].forEach((e) => {
                    document.getElementById(e) && l(`#${e}`, t.meta);
                }));
        })(),
        window.setInterval(() => {
            wa();
        }, 3e4));
}
const Ia = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      xa().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : xa()
).catch((t) => {
    throw (console.error('admin-v2 boot failed', t), t);
});
export { Ia as default };
