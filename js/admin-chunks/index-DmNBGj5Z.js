import {
    q as a,
    i as t,
    a as n,
    s as e,
    b as i,
    e as s,
    h as o,
    c as l,
    d as c,
    f as r,
    r as d,
    g as u,
    j as p,
    k as b,
    l as m,
    m as v,
    n as g,
    o as h,
    u as y,
    p as f,
    t as k,
    v as S,
    w,
    x as C,
    y as q,
    z as A,
    A as L,
    B as x,
    C as E,
    D as T,
    E as B,
    F as M,
    G as F,
    H as I,
    I as P,
    J as D,
    K as _,
    L as N,
    M as H,
    N as $,
    O as R,
    P as O,
    Q as V,
    R as z,
    S as j,
    T as U,
    U as Q,
    V as G,
    W,
    X as K,
    Y as Z,
    Z as J,
    _ as X,
    $ as Y,
    a0 as aa,
    a1 as ta,
    a2 as na,
    a3 as ea,
    a4 as ia,
    a5 as sa,
    a6 as oa,
    a7 as la,
    a8 as ca,
    a9 as ra,
    aa as da,
    ab as ua,
    ac as pa,
    ad as ba,
    ae as ma,
    af as va,
    ag as ga,
    ah as ha,
    ai as ya,
    aj as fa,
    ak as ka,
    al as Sa,
    am as wa,
    an as Ca,
    ao as qa,
    ap as Aa,
    aq as La,
    ar as xa,
    as as Ea,
    at as Ta,
    au as Ba,
    av as Ma,
    aw as Fa,
    ax as Ia,
    ay as Pa,
    az as Da,
    aA as _a,
    aB as Na,
    aC as Ha,
    aD as $a,
    aE as Ra,
    aF as Oa,
    aG as Va,
} from './push-BwJ5SClw.js';
const za = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    },
    ja = {
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
function Ua(a, t, n, e = !1) {
    return `\n        <button\n            type="button"\n            class="admin-quick-nav-item${e ? ' active' : ''}"\n            data-section="${a}"\n            aria-pressed="${e ? 'true' : 'false'}"\n        >\n            <span>${t}</span>\n            <span class="admin-quick-nav-shortcut">${n}</span>\n        </button>\n    `;
}
function Qa(a, n, e, i = !1) {
    return `\n        <a\n            href="#${a}"\n            class="nav-item${i ? ' active' : ''}"\n            data-section="${a}"\n            ${i ? 'aria-current="page"' : ''}\n        >\n            ${t(e)}\n            <span>${n}</span>\n            <span class="badge" id="${a}Badge">0</span>\n        </a>\n    `;
}
function Ga() {
    const t = a('#loginScreen'),
        n = a('#adminDashboard');
    (t && t.classList.remove('is-hidden'), n && n.classList.add('is-hidden'));
}
function Wa() {
    const t = a('#loginScreen'),
        n = a('#adminDashboard');
    (t && t.classList.add('is-hidden'), n && n.classList.remove('is-hidden'));
}
function Ka(t) {
    (n('.admin-section').forEach((a) => {
        a.classList.toggle('active', a.id === t);
    }),
        n('.nav-item[data-section]').forEach((a) => {
            const n = a.dataset.section === t;
            (a.classList.toggle('active', n),
                n
                    ? a.setAttribute('aria-current', 'page')
                    : a.removeAttribute('aria-current'));
        }),
        n('.admin-quick-nav-item[data-section]').forEach((a) => {
            const n = a.dataset.section === t;
            (a.classList.toggle('active', n),
                a.setAttribute('aria-pressed', String(n)));
        }));
    const e = za[t] || 'Dashboard',
        i = a('#pageTitle');
    i && (i.textContent = e);
}
function Za(t) {
    const n = a('#group2FA'),
        e = a('#adminLoginStepSummary'),
        i = a('#adminLoginStepEyebrow'),
        s = a('#adminLoginStepTitle'),
        o = a('#adminLoginSupportCopy'),
        l = a('#loginReset2FABtn'),
        c = a('#loginForm');
    n &&
        (n.classList.toggle('is-hidden', !t),
        c?.classList.toggle('is-2fa-stage', Boolean(t)),
        l?.classList.toggle('is-hidden', !t),
        i &&
            (i.textContent = t
                ? 'Verificacion secundaria'
                : 'Ingreso protegido'),
        s &&
            (s.textContent = t
                ? 'Confirma el codigo 2FA'
                : 'Acceso de administrador'),
        e &&
            (e.textContent = t
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        o &&
            (o.textContent = t
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        Xa(!1));
}
function Ja({
    tone: t = 'neutral',
    title: n = 'Proteccion activa',
    message: e = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = a('#adminLoginStatusCard'),
        s = a('#adminLoginStatusTitle'),
        o = a('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', t),
        s && (s.textContent = n),
        o && (o.textContent = e));
}
function Xa(t) {
    const n = a('#loginBtn'),
        e = a('#loginReset2FABtn'),
        i = a('#adminPassword'),
        s = a('#admin2FACode'),
        o = a('#group2FA'),
        l = Boolean(o && !o.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(t) || l),
        s instanceof HTMLInputElement && (s.disabled = Boolean(t) || !l),
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(t)),
            (n.textContent = t
                ? l
                    ? 'Verificando...'
                    : 'Ingresando...'
                : l
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        e instanceof HTMLButtonElement && (e.disabled = Boolean(t)));
}
function Ya({ clearPassword: t = !1 } = {}) {
    const n = a('#adminPassword'),
        e = a('#admin2FACode');
    (n instanceof HTMLInputElement && t && (n.value = ''),
        e instanceof HTMLInputElement && (e.value = ''));
}
function at(t = 'password') {
    const n = a('2fa' === t ? '#admin2FACode' : '#adminPassword');
    n instanceof HTMLInputElement && (n.focus(), n.select?.());
}
function tt(t) {
    const n = ja[t?.ui?.activeSection || 'dashboard'] || ja.dashboard,
        o = t?.auth && 'object' == typeof t.auth ? t.auth : {},
        l = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        c = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        r = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
        d =
            t?.data?.availability && 'object' == typeof t.data.availability
                ? t.data.availability
                : {},
        u = Array.isArray(t?.data?.queueTickets) ? t.data.queueTickets : [],
        p =
            t?.data?.queueMeta && 'object' == typeof t.data.queueMeta
                ? t.data.queueMeta
                : null;
    (e('#adminSectionEyebrow', n.eyebrow),
        e('#adminContextTitle', n.title),
        e('#adminContextSummary', n.summary),
        i(
            '#adminContextActions',
            n.actions
                .map((a) =>
                    (function (a) {
                        return `\n        <button type="button" class="sony-context-action" ${[`data-action="${s(a.action)}"`, a.queueConsultorio ? `data-queue-consultorio="${s(a.queueConsultorio)}"` : '', a.filterValue ? `data-filter-value="${s(a.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${s(a.label)}</strong>\n                <small>${s(a.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${s(a.shortcut || '')}</span>\n        </button>\n    `;
                    })(a)
                )
                .join('')
        ),
        e(
            '#adminSyncState',
            (function (a) {
                const t = Number(a || 0);
                return t
                    ? `Ultima carga ${new Date(t).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Listo para primera sincronizacion';
            })(t?.ui?.lastRefreshAt || 0)
        ));
    const b = (function (a) {
            return a.filter((a) => {
                const t = String(
                    a.paymentStatus || a.payment_status || ''
                ).toLowerCase();
                return (
                    'pending_transfer_review' === t || 'pending_transfer' === t
                );
            }).length;
        })(l),
        m = (function (a) {
            return a.filter((a) => {
                const t = String(a.status || '')
                    .toLowerCase()
                    .trim();
                return 'pending' === t || 'pendiente' === t;
            }).length;
        })(c),
        v = (function (a) {
            return Object.values(a || {}).filter(
                (a) => Array.isArray(a) && a.length > 0
            ).length;
        })(d),
        g = (function (a, t) {
            return t && Number.isFinite(Number(t.waitingCount))
                ? Math.max(0, Number(t.waitingCount))
                : (Array.isArray(a) ? a : []).filter(
                      (a) => 'waiting' === String(a.status || '').toLowerCase()
                  ).length;
        })(u, p);
    (e('#dashboardBadge', b + m),
        e('#appointmentsBadge', l.length),
        e('#callbacksBadge', m),
        e('#reviewsBadge', r.length),
        e('#availabilityBadge', v),
        e('#queueBadge', g));
    const h = a('#adminSessionTile'),
        y = o.authenticated
            ? 'Sesion activa'
            : o.requires2FA
              ? 'Verificacion 2FA'
              : 'No autenticada',
        f = o.authenticated ? 'success' : o.requires2FA ? 'warning' : 'neutral';
    (h?.setAttribute('data-state', f),
        e('#adminSessionState', y),
        e(
            '#adminSessionMeta',
            (function (a) {
                const t = a && 'object' == typeof a ? a : {};
                if (t.authenticated) {
                    const a =
                            {
                                session: 'sesion restaurada',
                                password: 'clave validada',
                                '2fa': '2FA validado',
                            }[String(t.authMethod || '')] || 'acceso validado',
                        n = Number(t.lastAuthAt || 0);
                    return n
                        ? `Protegida por ${a}. ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${a}.`;
                }
                return t.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(o)
        ));
}
const nt = 'adminLastSection',
    et = 'adminSidebarCollapsed';
function it(a, { persist: t = !1 } = {}) {
    const n = k(a);
    (y((t) => ({ ...t, ui: { ...t.ui, themeMode: a, theme: n } })),
        t && S(a),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((t) => {
            const n = t.dataset.themeMode === a;
            (t.classList.toggle('is-active', n),
                t.setAttribute('aria-pressed', String(n)));
        }));
}
function st() {
    const a = B();
    (Pa(nt, a.ui.activeSection), Pa(et, a.ui.sidebarCollapsed ? '1' : '0'));
}
function ot() {
    const a = P();
    (e('#adminRefreshStatus', a),
        e(
            '#adminSyncState',
            'Datos: sin sincronizar' === a
                ? 'Listo para primera sincronizacion'
                : a.replace('Datos: ', 'Estado: ')
        ));
}
function lt() {
    (Za(!1),
        Ya(),
        Xa(!1),
        Ja({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function ct(a, t = {}) {
    const n = g(a, 'dashboard'),
        { force: e = !1 } = t,
        i = B().ui.activeSection;
    (e ||
        'availability' !== B().ui.activeSection ||
        'availability' === n ||
        !M() ||
        window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        )) &&
        (!(function (a) {
            const t = g(a, 'dashboard');
            (y((a) => ({ ...a, ui: { ...a.ui, activeSection: t } })),
                Ka(t),
                tt(B()),
                f(t),
                st());
        })(n),
        'queue' === n && 'queue' !== i && Ba() && (await ia()));
}
function rt() {
    (y((a) => ({
        ...a,
        ui: {
            ...a.ui,
            sidebarCollapsed: !a.ui.sidebarCollapsed,
            sidebarOpen: a.ui.sidebarOpen,
        },
    })),
        pt(),
        st());
}
function dt() {
    (y((a) => ({ ...a, ui: { ...a.ui, sidebarOpen: !a.ui.sidebarOpen } })),
        pt());
}
function ut() {
    (y((a) => ({ ...a, ui: { ...a.ui, sidebarOpen: !1 } })), pt());
}
function pt() {
    const t = B(),
        n = window.matchMedia('(max-width: 1024px)').matches;
    !(function ({ open: t, collapsed: n }) {
        const e = a('#adminSidebar'),
            i = a('#adminSidebarBackdrop'),
            s = a('#adminMenuToggle');
        (e && e.classList.toggle('is-open', Boolean(t)),
            i && i.classList.toggle('is-hidden', !t),
            s && s.setAttribute('aria-expanded', String(Boolean(t))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(t)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(n)
            ));
        const o = a('#adminSidebarCollapse');
        o && o.setAttribute('aria-pressed', String(Boolean(n)));
    })({
        open: !!n && t.ui.sidebarOpen,
        collapsed: !n && t.ui.sidebarCollapsed,
    });
}
function bt() {
    const a = document.getElementById('adminQuickCommand');
    a instanceof HTMLInputElement && a.focus();
}
function mt() {
    const a = B().ui.activeSection;
    if ('appointments' === a) {
        const a = document.getElementById('searchAppointments');
        return void (a instanceof HTMLInputElement && a.focus());
    }
    if ('callbacks' === a) {
        const a = document.getElementById('searchCallbacks');
        return void (a instanceof HTMLInputElement && a.focus());
    }
    if ('queue' === a) {
        const a = document.getElementById('queueSearchInput');
        a instanceof HTMLInputElement && a.focus();
    }
}
async function vt(a) {
    switch (a) {
        case 'appointments_pending_transfer':
            (await ct('appointments'), w('pending_transfer'), q(''));
            break;
        case 'appointments_all':
            (await ct('appointments'), w('all'), q(''));
            break;
        case 'appointments_no_show':
            (await ct('appointments'), w('no_show'), q(''));
            break;
        case 'callbacks_pending':
            (await ct('callbacks'), A('pending'));
            break;
        case 'callbacks_contacted':
            (await ct('callbacks'), A('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await ct('callbacks'), A('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await ct('queue'), v('sla_risk'));
            break;
        case 'queue_waiting':
            (await ct('queue'), v('waiting'));
            break;
        case 'queue_called':
            (await ct('queue'), v('called'));
            break;
        case 'queue_no_show':
            (await ct('queue'), v('no_show'));
            break;
        case 'queue_all':
            (await ct('queue'), v('all'));
            break;
        case 'queue_call_next':
            (await ct('queue'), await ea(B().queue.stationConsultorio));
    }
}
async function gt(a = !1) {
    const t = await Ma();
    (Fa(),
        await Ia(),
        tt(B()),
        Da(B()),
        _a(),
        Na(),
        Ha(),
        $a(),
        Ra(),
        ot(),
        a &&
            m(
                t ? 'Datos actualizados' : 'Datos cargados desde cache local',
                t ? 'success' : 'warning'
            ));
}
function ht(a) {
    const t = String(a || '')
        .trim()
        .toLowerCase();
    return t
        ? t.includes('callbacks') && t.includes('pend')
            ? 'callbacks_pending'
            : t.includes('callback') && (t.includes('urg') || t.includes('sla'))
              ? 'callbacks_sla_urgent'
              : t.includes('citas') && t.includes('transfer')
                ? 'appointments_pending_transfer'
                : t.includes('queue') || t.includes('cola')
                  ? 'queue_sla_risk'
                  : t.includes('no show')
                    ? 'appointments_no_show'
                    : null
        : null;
}
async function yt(a) {
    a.preventDefault();
    const t = document.getElementById('adminPassword'),
        n = document.getElementById('admin2FACode'),
        e = t instanceof HTMLInputElement ? t.value : '',
        i = n instanceof HTMLInputElement ? n.value : '';
    try {
        Xa(!0);
        const a = B();
        if (
            (Ja({
                tone: a.auth.requires2FA ? 'warning' : 'neutral',
                title: a.auth.requires2FA
                    ? 'Validando segundo factor'
                    : 'Validando credenciales',
                message: a.auth.requires2FA
                    ? 'Comprobando el codigo 2FA antes de abrir el panel.'
                    : 'Comprobando clave y proteccion de sesion.',
            }),
            a.auth.requires2FA)
        )
            await F(i);
        else if ((await I(e)).requires2FA)
            return (
                Za(!0),
                Ja({
                    tone: 'warning',
                    title: 'Codigo 2FA requerido',
                    message:
                        'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                }),
                void at('2fa')
            );
        (Ja({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            Wa(),
            Za(!1),
            Ya({ clearPassword: !0 }),
            await gt(!1),
            m('Sesion iniciada', 'success'));
    } catch (a) {
        (Ja({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                a?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            at(B().auth.requires2FA ? '2fa' : 'password'),
            m(a?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        Xa(!1);
    }
}
async function ft() {
    (!(function () {
        const n = a('#loginScreen'),
            e = a('#adminDashboard');
        if (!(n instanceof HTMLElement && e instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((n.innerHTML = `\n        <div class="sony-login-shell">\n            <section class="sony-login-hero">\n                <div class="sony-login-brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Admin Operations</h1>\n                    <p>Centro de control con una capa visual premium, autenticacion endurecida y flujo rapido para operacion diaria.</p>\n                </div>\n                <div class="sony-login-badge-row">\n                    <span class="sony-login-badge">Sony-like UI</span>\n                    <span class="sony-login-badge">CSP self-hosted</span>\n                    <span class="sony-login-badge">2FA ready</span>\n                </div>\n                <div class="sony-login-trust-grid">\n                    <article class="sony-login-trust-card">\n                        <span>Acceso</span>\n                        <strong>Sesion de administrador</strong>\n                        <small>Entrada aislada para operacion y triage.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Proteccion</span>\n                        <strong>Clave + verificacion</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Entorno</span>\n                        <strong>Activos locales</strong>\n                        <small>Fuentes, iconos y estilos propios sin dependencias remotas.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="sony-login-panel">\n                <div class="sony-login-panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para entrar al centro operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.\n                    </p>\n                </form>\n\n                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${t('sun')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${t('moon')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${t('system')}</button>\n                </div>\n            </section>\n        </div>\n    `),
            (e.innerHTML = `\n        <aside class="admin-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <strong>Piel en Armonia</strong>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${t('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                ${Qa('dashboard', 'Dashboard', 'dashboard', !0)}\n                ${Qa('appointments', 'Citas', 'appointments')}\n                ${Qa('callbacks', 'Callbacks', 'callbacks')}\n                ${Qa('reviews', 'Resenas', 'reviews')}\n                ${Qa('availability', 'Disponibilidad', 'availability')}\n                ${Qa('queue', 'Turnero Sala', 'queue')}\n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${t('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n        <main class="admin-main" id="adminMainContent" tabindex="-1">\n            <header class="admin-header">\n                <div class="admin-header-title-wrap">\n                    <button type="button" id="adminMenuToggle" aria-controls="adminSidebar" aria-expanded="false">${t('menu')}<span>Menu</span></button>\n                    <h2 id="pageTitle">Dashboard</h2>\n                </div>\n                <nav class="admin-quick-nav" data-qa="admin-quick-nav" aria-label="Navegacion rapida">\n                    ${Ua('dashboard', 'Dashboard', 'Alt+Shift+1', !0)}\n                    ${Ua('appointments', 'Citas', 'Alt+Shift+2')}\n                    ${Ua('callbacks', 'Callbacks', 'Alt+Shift+3')}\n                    ${Ua('reviews', 'Resenas', 'Alt+Shift+4')}\n                    ${Ua('availability', 'Disponibilidad', 'Alt+Shift+5')}\n                    ${Ua('queue', 'Turnero', 'Alt+Shift+6')}\n                </nav>\n                <div class="admin-header-actions">\n                    <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${t('sun')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${t('moon')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${t('system')}</button>\n                    </div>\n                    <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                </div>\n            </header>\n\n            <section class="sony-context-strip" id="adminProductivityStrip">\n                <div class="sony-context-grid">\n                    <div class="sony-context-copy">\n                        <p class="sony-kicker" id="adminSectionEyebrow">Control Deck</p>\n                        <h3 id="adminContextTitle">Vista general operativa</h3>\n                        <p id="adminContextSummary">Monitorea agenda, callbacks y cola desde un solo frente.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="sony-command-stage">\n                        <div class="sony-command-box">\n                            <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />\n                            <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                        </div>\n                        <div class="sony-status-cluster">\n                            <article class="sony-status-tile">\n                                <span>Push</span>\n                                <strong id="pushStatusIndicator">Inicializando</strong>\n                                <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                            </article>\n                            <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                                <span>Sesion</span>\n                                <strong id="adminSessionState">No autenticada</strong>\n                                <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                            </article>\n                            <article class="sony-status-tile">\n                                <span>Sincronizacion</span>\n                                <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                                <small id="adminSyncState">Listo para primera sincronizacion</small>\n                            </article>\n                        </div>\n                    </div>\n                </div>\n            </section>\n\n            \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Admin premium minimal</p>\n                        <h3>Centro operativo diario</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad en una sola vista de control.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda Premium</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Triage, pagos y seguimiento sin salir de la mesa.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">Triage de SLA</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n        </main>\n    `));
    })(),
        document.body.classList.add('admin-v2-mode'),
        (function () {
            (document.addEventListener('click', async (a) => {
                const t =
                    a.target instanceof Element
                        ? a.target.closest('[data-action]')
                        : null;
                if (!t) return;
                const n = String(t.getAttribute('data-action') || '');
                if (n) {
                    a.preventDefault();
                    try {
                        await (async function (a, t) {
                            switch (a) {
                                case 'close-toast':
                                    return void t.closest('.toast')?.remove();
                                case 'set-admin-theme':
                                    return void it(
                                        String(t.dataset.themeMode || 'system'),
                                        { persist: !0 }
                                    );
                                case 'toggle-sidebar-collapse':
                                    return void rt();
                                case 'refresh-admin-data':
                                    return void (await gt(!0));
                                case 'run-admin-command': {
                                    const a =
                                        document.getElementById(
                                            'adminQuickCommand'
                                        );
                                    if (a instanceof HTMLInputElement) {
                                        const t = ht(a.value);
                                        t && (await vt(t));
                                    }
                                    return;
                                }
                                case 'logout':
                                    return (
                                        await Ta(),
                                        Ga(),
                                        lt(),
                                        void m('Sesion cerrada', 'info')
                                    );
                                case 'reset-login-2fa':
                                    return (
                                        y((a) => ({
                                            ...a,
                                            auth: {
                                                ...a.auth,
                                                requires2FA: !1,
                                            },
                                        })),
                                        Za(!1),
                                        Ya(),
                                        Ja({
                                            tone: 'neutral',
                                            title: 'Ingreso protegido',
                                            message:
                                                'Volviste al paso de clave. Puedes reintentar el acceso.',
                                        }),
                                        void at('password')
                                    );
                                case 'appointment-quick-filter':
                                    return void w(
                                        String(t.dataset.filterValue || 'all')
                                    );
                                case 'clear-appointment-filters':
                                    return void Ea();
                                case 'appointment-density':
                                    return void xa(
                                        String(
                                            t.dataset.density || 'comfortable'
                                        )
                                    );
                                case 'approve-transfer':
                                    return (
                                        await La(Number(t.dataset.id || 0)),
                                        void m(
                                            'Transferencia aprobada',
                                            'success'
                                        )
                                    );
                                case 'reject-transfer':
                                    return (
                                        await Aa(Number(t.dataset.id || 0)),
                                        void m(
                                            'Transferencia rechazada',
                                            'warning'
                                        )
                                    );
                                case 'mark-no-show':
                                    return (
                                        await qa(Number(t.dataset.id || 0)),
                                        void m(
                                            'Marcado como no show',
                                            'warning'
                                        )
                                    );
                                case 'cancel-appointment':
                                    return (
                                        await Ca(Number(t.dataset.id || 0)),
                                        void m('Cita cancelada', 'warning')
                                    );
                                case 'export-csv':
                                    return void wa();
                                case 'callback-quick-filter':
                                    return void A(
                                        String(t.dataset.filterValue || 'all')
                                    );
                                case 'clear-callback-filters':
                                    return void Sa();
                                case 'callbacks-triage-next':
                                case 'context-open-callbacks-next':
                                    return (
                                        await ct('callbacks'),
                                        A('pending'),
                                        void D()
                                    );
                                case 'mark-contacted':
                                    return (
                                        await ka(
                                            Number(t.dataset.callbackId || 0),
                                            String(t.dataset.callbackDate || '')
                                        ),
                                        void m(
                                            'Callback actualizado',
                                            'success'
                                        )
                                    );
                                case 'change-month':
                                    return void fa(
                                        Number(t.dataset.delta || 0)
                                    );
                                case 'availability-today':
                                case 'context-availability-today':
                                    return void ya();
                                case 'availability-prev-with-slots':
                                    return void ha();
                                case 'availability-next-with-slots':
                                case 'context-availability-next':
                                    return void ga();
                                case 'select-availability-day':
                                    return void va(
                                        String(t.dataset.date || '')
                                    );
                                case 'prefill-time-slot':
                                    return void ma(
                                        String(t.dataset.time || '')
                                    );
                                case 'add-time-slot':
                                    return void ba();
                                case 'remove-time-slot':
                                    return void pa(
                                        decodeURIComponent(
                                            String(t.dataset.date || '')
                                        ),
                                        decodeURIComponent(
                                            String(t.dataset.time || '')
                                        )
                                    );
                                case 'copy-availability-day':
                                case 'context-copy-availability-day':
                                    return void ua();
                                case 'paste-availability-day':
                                    return void da();
                                case 'duplicate-availability-day-next':
                                    return void ra(1);
                                case 'duplicate-availability-next-week':
                                    return void ra(7);
                                case 'clear-availability-day':
                                    return void ca();
                                case 'clear-availability-week':
                                    return void la();
                                case 'save-availability-draft':
                                    return (
                                        await oa(),
                                        void m(
                                            'Disponibilidad guardada',
                                            'success'
                                        )
                                    );
                                case 'discard-availability-draft':
                                    return (
                                        sa(),
                                        void m('Borrador descartado', 'info')
                                    );
                                case 'queue-refresh-state':
                                    return void (await ia());
                                case 'queue-call-next':
                                    return void (await ea(
                                        Number(t.dataset.queueConsultorio || 0)
                                    ));
                                case 'queue-release-station':
                                    return void (await na(
                                        Number(t.dataset.queueConsultorio || 0)
                                    ));
                                case 'queue-toggle-ticket-select':
                                    return void ta(
                                        Number(t.dataset.queueId || 0)
                                    );
                                case 'queue-select-visible':
                                    return void aa();
                                case 'queue-clear-selection':
                                    return void Y();
                                case 'queue-ticket-action':
                                    return void (await X(
                                        Number(t.dataset.queueId || 0),
                                        String(t.dataset.queueAction || ''),
                                        Number(t.dataset.queueConsultorio || 0)
                                    ));
                                case 'queue-reprint-ticket':
                                    return void (await J(
                                        Number(t.dataset.queueId || 0)
                                    ));
                                case 'queue-bulk-action':
                                    return void (await Z(
                                        String(
                                            t.dataset.queueAction || 'no_show'
                                        )
                                    ));
                                case 'queue-bulk-reprint':
                                    return void (await K());
                                case 'queue-clear-search':
                                    return void W();
                                case 'queue-toggle-shortcuts':
                                    return void G();
                                case 'queue-toggle-one-tap':
                                    return void Q();
                                case 'queue-start-practice':
                                    return void U(!0);
                                case 'queue-stop-practice':
                                    return void U(!1);
                                case 'queue-lock-station':
                                    return void j(
                                        Number(t.dataset.queueConsultorio || 1)
                                    );
                                case 'queue-set-station-mode':
                                    return void z(
                                        String(t.dataset.queueMode || 'free')
                                    );
                                case 'queue-sensitive-confirm':
                                    return void (await V());
                                case 'queue-sensitive-cancel':
                                    return void O();
                                case 'queue-capture-call-key':
                                    return void R();
                                case 'queue-clear-call-key':
                                    return void $();
                                case 'callbacks-bulk-select-visible':
                                    return void H();
                                case 'callbacks-bulk-clear':
                                    return void N();
                                case 'callbacks-bulk-mark':
                                    return void (await _());
                                case 'context-open-appointments-transfer':
                                    return (
                                        await ct('appointments'),
                                        void w('pending_transfer')
                                    );
                                case 'context-open-callbacks-pending':
                                    return (
                                        await ct('callbacks'),
                                        void A('pending')
                                    );
                                case 'context-open-dashboard':
                                    return void (await ct('dashboard'));
                            }
                        })(n, t);
                    } catch (a) {
                        m(a?.message || 'Error ejecutando accion', 'error');
                    }
                }
            }),
                document.addEventListener('click', async (a) => {
                    const t =
                        a.target instanceof Element
                            ? a.target.closest('[data-section]')
                            : null;
                    if (!t) return;
                    const n = t.classList.contains('admin-quick-nav-item'),
                        e = t.classList.contains('nav-item');
                    (n || e) &&
                        (a.preventDefault(),
                        await ct(
                            String(
                                t.getAttribute('data-section') || 'dashboard'
                            )
                        ),
                        window.matchMedia('(max-width: 1024px)').matches &&
                            ut());
                }),
                document.addEventListener('click', (a) => {
                    const t =
                        a.target instanceof Element
                            ? a.target.closest('[data-queue-filter]')
                            : null;
                    t &&
                        (a.preventDefault(),
                        v(
                            String(t.getAttribute('data-queue-filter') || 'all')
                        ));
                }));
            const a = document.getElementById('callbacksBulkSelectVisibleBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const t = document.getElementById('callbacksBulkClearBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-clear');
            const n = document.getElementById('callbacksBulkMarkBtn');
            n && n.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        o(),
        l(),
        c(),
        (function () {
            const a = g(h(nt, 'dashboard')),
                t = '1' === h(et, '0');
            (y((n) => ({
                ...n,
                ui: {
                    ...n.ui,
                    activeSection: a,
                    sidebarCollapsed: t,
                    sidebarOpen: !1,
                },
            })),
                Ka(a),
                f(a),
                pt());
        })(),
        r(),
        it(d()),
        lt(),
        (function () {
            const a = document.getElementById('appointmentFilter');
            a instanceof HTMLSelectElement &&
                a.addEventListener('change', () => {
                    w(a.value);
                });
            const t = document.getElementById('appointmentSort');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    C(t.value);
                });
            const n = document.getElementById('searchAppointments');
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    q(n.value);
                });
            const e = document.getElementById('callbackFilter');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    A(e.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    L(i.value);
                });
            const s = document.getElementById('searchCallbacks');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    x(s.value);
                });
            const o = document.getElementById('queueSearchInput');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    E(o.value);
                });
            const l = document.getElementById('adminQuickCommand');
            l instanceof HTMLInputElement &&
                l.addEventListener('keydown', async (a) => {
                    if ('Enter' !== a.key) return;
                    a.preventDefault();
                    const t = ht(l.value);
                    t && (await vt(t));
                });
        })(),
        (function () {
            const t = a('#adminMenuToggle'),
                n = a('#adminMenuClose'),
                e = a('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                window.matchMedia('(max-width: 1024px)').matches ? dt() : rt();
            }),
                n?.addEventListener('click', () => ut()),
                e?.addEventListener('click', () => ut()),
                window.addEventListener('resize', () => {
                    window.matchMedia('(max-width: 1024px)').matches
                        ? pt()
                        : ut();
                }),
                window.addEventListener('hashchange', async () => {
                    const a = T(B().ui.activeSection);
                    await ct(a, { force: !0 });
                }),
                window.addEventListener('storage', (a) => {
                    'themeMode' === a.key && it(String(a.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (a) => {
            M() && (a.preventDefault(), (a.returnValue = ''));
        }));
    const n = document.getElementById('loginForm');
    (n instanceof HTMLFormElement && n.addEventListener('submit', yt),
        u({
            navigateToSection: ct,
            focusQuickCommand: bt,
            focusCurrentSearch: mt,
            runQuickAction: vt,
            closeSidebar: ut,
            toggleMenu: () => {
                window.matchMedia('(max-width: 1024px)').matches ? dt() : rt();
            },
            dismissQueueSensitiveDialog: Va,
            toggleQueueHelp: () => G(),
            queueNumpadAction: Oa,
        }),
        (await p())
            ? await (async function () {
                  (Wa(), await gt(!1), Ka(B().ui.activeSection));
              })()
            : (Ga(), lt()),
        b(),
        window.setInterval(() => {
            ot();
        }, 3e4));
}
const kt = (
    'loading' === document.readyState
        ? new Promise((a, t) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      ft().then(a).catch(t);
                  },
                  { once: !0 }
              );
          })
        : ft()
).catch((a) => {
    throw (console.error('admin-v2 boot failed', a), a);
});
export { kt as default };
