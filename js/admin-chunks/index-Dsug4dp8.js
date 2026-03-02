import {
    q as t,
    i as a,
    a as e,
    s as n,
    b as i,
    e as s,
    u as o,
    g as r,
    c as l,
    f as c,
    d,
    t as u,
    h as p,
    j as m,
    r as b,
    k as g,
    l as v,
    m as h,
    n as f,
    o as y,
    p as k,
    v as S,
    w,
    x as C,
    y as A,
    z as $,
    A as L,
    B as q,
    C as T,
    D as E,
    E as D,
    F as _,
    G as M,
    H as x,
    I as B,
    J as N,
    K as P,
    L as F,
    M as I,
    N as H,
    O as R,
    P as O,
    Q as j,
    R as z,
    S as V,
    T as U,
    U as Q,
    V as G,
    W,
    X as J,
    Y,
    Z,
    _ as K,
    $ as X,
    a0 as tt,
    a1 as at,
    a2 as et,
    a3 as nt,
} from './push-JusQsl3L.js';
const it = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    },
    st = {
        dashboard: {
            eyebrow: 'Resumen Diario',
            title: 'Que requiere atencion ahora',
            summary:
                'Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.',
            actions: [
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Validar pagos',
                    meta: 'Transferencias pendientes',
                    shortcut: 'Alt+Shift+T',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Llamadas',
                    meta: 'Pendientes por contacto',
                    shortcut: 'Alt+Shift+P',
                },
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar',
                    meta: 'Sincronizar tablero',
                    shortcut: 'Ctrl+K',
                },
            ],
        },
        appointments: {
            eyebrow: 'Agenda Clinica',
            title: 'Triage de citas',
            summary:
                'Prioriza transferencias, no show y proximas 48 horas sin perder lectura.',
            actions: [
                {
                    action: 'clear-appointment-filters',
                    label: 'Limpiar filtros',
                    meta: 'Regresar al corte total',
                    shortcut: 'Reset',
                },
                {
                    action: 'export-csv',
                    label: 'Exportar CSV',
                    meta: 'Bajar corte operativo',
                    shortcut: 'CSV',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cruzar seguimiento telefonico',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        callbacks: {
            eyebrow: 'SLA Telefonico',
            title: 'Siguiente callback',
            summary:
                'Ordena la cola por urgencia, contacto pendiente y siguiente accion real.',
            actions: [
                {
                    action: 'callbacks-triage-next',
                    label: 'Siguiente llamada',
                    meta: 'Mover foco al siguiente caso',
                    shortcut: 'Next',
                },
                {
                    action: 'context-open-callbacks-next',
                    label: 'Abrir siguiente',
                    meta: 'Ir a la tarjeta prioritaria',
                    shortcut: 'Alt+Shift+3',
                },
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Cruzar citas',
                    meta: 'Revisar pagos pendientes',
                    shortcut: 'Alt+Shift+2',
                },
            ],
        },
        reviews: {
            eyebrow: 'Lectura De Calidad',
            title: 'Resenas y senal reciente',
            summary:
                'Resume rating, volumen y comentarios utiles sin convertir feedback en ruido.',
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
                    meta: 'Regresar al resumen diario',
                    shortcut: 'Alt+Shift+1',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cerrar seguimiento operativo',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        availability: {
            eyebrow: 'Calendario Editorial',
            title: 'Planeacion de disponibilidad',
            summary:
                'Gestiona slots, duplicados y semanas futuras con el calendario como canvas principal.',
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
                    meta: 'Buscar siguiente dia util',
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
            eyebrow: 'Fase 2',
            title: 'Turnero sala',
            summary:
                'Esta superficie se mantiene compatible, pero su rediseño completo queda fuera de esta primera ola.',
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
function ot(t, e, n, i = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${i ? ' active' : ''}"\n            data-section="${t}"\n            ${i ? 'aria-current="page"' : ''}\n        >\n            ${a(n)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function rt() {
    const a = t('#loginScreen'),
        e = t('#adminDashboard');
    (a && a.classList.remove('is-hidden'), e && e.classList.add('is-hidden'));
}
function lt() {
    const a = t('#loginScreen'),
        e = t('#adminDashboard');
    (a && a.classList.add('is-hidden'), e && e.classList.remove('is-hidden'));
}
function ct() {
    const a = t('#adminCommandPalette');
    a instanceof HTMLElement &&
        (a.classList.remove('is-hidden'),
        a.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function dt() {
    const a = t('#adminCommandPalette');
    a instanceof HTMLElement &&
        (a.classList.add('is-hidden'),
        a.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function ut(a) {
    (e('.admin-section').forEach((t) => {
        t.classList.toggle('active', t.id === a);
    }),
        e('.nav-item[data-section]').forEach((t) => {
            const e = t.dataset.section === a;
            (t.classList.toggle('active', e),
                e
                    ? t.setAttribute('aria-current', 'page')
                    : t.removeAttribute('aria-current'));
        }),
        e('.admin-quick-nav-item[data-section]').forEach((t) => {
            const e = t.dataset.section === a;
            (t.classList.toggle('active', e),
                t.setAttribute('aria-pressed', String(e)));
        }));
    const n = it[a] || 'Dashboard',
        i = t('#pageTitle');
    i && (i.textContent = n);
}
function pt(a) {
    const e = t('#group2FA'),
        n = t('#adminLoginStepSummary'),
        i = t('#adminLoginStepEyebrow'),
        s = t('#adminLoginStepTitle'),
        o = t('#adminLoginSupportCopy'),
        r = t('#loginReset2FABtn'),
        l = t('#loginForm');
    e &&
        (e.classList.toggle('is-hidden', !a),
        l?.classList.toggle('is-2fa-stage', Boolean(a)),
        r?.classList.toggle('is-hidden', !a),
        i &&
            (i.textContent = a
                ? 'Verificacion secundaria'
                : 'Ingreso protegido'),
        s &&
            (s.textContent = a
                ? 'Confirma el codigo 2FA'
                : 'Acceso de administrador'),
        n &&
            (n.textContent = a
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        o &&
            (o.textContent = a
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        bt(!1));
}
function mt({
    tone: a = 'neutral',
    title: e = 'Proteccion activa',
    message: n = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = t('#adminLoginStatusCard'),
        s = t('#adminLoginStatusTitle'),
        o = t('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', a),
        s && (s.textContent = e),
        o && (o.textContent = n));
}
function bt(a) {
    const e = t('#loginBtn'),
        n = t('#loginReset2FABtn'),
        i = t('#adminPassword'),
        s = t('#admin2FACode'),
        o = t('#group2FA'),
        r = Boolean(o && !o.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(a) || r),
        s instanceof HTMLInputElement && (s.disabled = Boolean(a) || !r),
        e instanceof HTMLButtonElement &&
            ((e.disabled = Boolean(a)),
            (e.textContent = a
                ? r
                    ? 'Verificando...'
                    : 'Ingresando...'
                : r
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        n instanceof HTMLButtonElement && (n.disabled = Boolean(a)));
}
function gt({ clearPassword: a = !1 } = {}) {
    const e = t('#adminPassword'),
        n = t('#admin2FACode');
    (e instanceof HTMLInputElement && a && (e.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function vt(a = 'password') {
    const e = t('2fa' === a ? '#admin2FACode' : '#adminPassword');
    e instanceof HTMLInputElement && (e.focus(), e.select?.());
}
function ht(a) {
    const e = st[a?.ui?.activeSection || 'dashboard'] || st.dashboard,
        o = a?.auth && 'object' == typeof a.auth ? a.auth : {},
        r = Array.isArray(a?.data?.appointments) ? a.data.appointments : [],
        l = Array.isArray(a?.data?.callbacks) ? a.data.callbacks : [],
        c = Array.isArray(a?.data?.reviews) ? a.data.reviews : [],
        d =
            a?.data?.availability && 'object' == typeof a.data.availability
                ? a.data.availability
                : {},
        u = Array.isArray(a?.data?.queueTickets) ? a.data.queueTickets : [],
        p =
            a?.data?.queueMeta && 'object' == typeof a.data.queueMeta
                ? a.data.queueMeta
                : null;
    (n('#adminSectionEyebrow', e.eyebrow),
        n('#adminContextTitle', e.title),
        n('#adminContextSummary', e.summary),
        i(
            '#adminContextActions',
            e.actions
                .map((t) =>
                    (function (t) {
                        return `\n        <button type="button" class="sony-context-action" ${[`data-action="${s(t.action)}"`, t.queueConsultorio ? `data-queue-consultorio="${s(t.queueConsultorio)}"` : '', t.filterValue ? `data-filter-value="${s(t.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${s(t.label)}</strong>\n                <small>${s(t.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${s(t.shortcut || '')}</span>\n        </button>\n    `;
                    })(t)
                )
                .join('')
        ),
        n(
            '#adminSyncState',
            (function (t) {
                const a = Number(t || 0);
                return a
                    ? `Ultima carga ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Listo para primera sincronizacion';
            })(a?.ui?.lastRefreshAt || 0)
        ));
    const m = (function (t) {
            return t.filter((t) => {
                const a = String(
                    t.paymentStatus || t.payment_status || ''
                ).toLowerCase();
                return (
                    'pending_transfer_review' === a || 'pending_transfer' === a
                );
            }).length;
        })(r),
        b = (function (t) {
            return t.filter((t) => {
                const a = String(t.status || '')
                    .toLowerCase()
                    .trim();
                return 'pending' === a || 'pendiente' === a;
            }).length;
        })(l),
        g = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(d),
        v = (function (t, a) {
            return a && Number.isFinite(Number(a.waitingCount))
                ? Math.max(0, Number(a.waitingCount))
                : (Array.isArray(t) ? t : []).filter(
                      (t) => 'waiting' === String(t.status || '').toLowerCase()
                  ).length;
        })(u, p);
    (n('#dashboardBadge', m + b),
        n('#appointmentsBadge', r.length),
        n('#callbacksBadge', b),
        n('#reviewsBadge', c.length),
        n('#availabilityBadge', g),
        n('#queueBadge', v));
    const h = t('#adminSessionTile'),
        f = o.authenticated
            ? 'Sesion activa'
            : o.requires2FA
              ? 'Verificacion 2FA'
              : 'No autenticada',
        y = o.authenticated ? 'success' : o.requires2FA ? 'warning' : 'neutral';
    (h?.setAttribute('data-state', y),
        n('#adminSessionState', f),
        n(
            '#adminSessionMeta',
            (function (t) {
                const a = t && 'object' == typeof t ? t : {};
                if (a.authenticated) {
                    const t =
                            {
                                session: 'sesion restaurada',
                                password: 'clave validada',
                                '2fa': '2FA validado',
                            }[String(a.authMethod || '')] || 'acceso validado',
                        e = Number(a.lastAuthAt || 0);
                    return e
                        ? `Protegida por ${t}. ${new Date(e).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${t}.`;
                }
                return a.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(o)
        ));
}
const ft = {
    dashboard: {
        hero: '.dashboard-hero-panel',
        priority: '.dashboard-signal-panel',
        workbench: '.dashboard-card-operations',
        detail: '#funnelSummary',
    },
    appointments: {
        hero: '.appointments-command-deck',
        priority: '.appointments-focus-panel',
        workbench: '.appointments-workbench',
    },
    callbacks: {
        hero: '.callbacks-command-deck',
        priority: '#callbacksOpsPanel',
        workbench: '.callbacks-workbench',
        detail: '.callbacks-next-panel',
    },
    reviews: {
        hero: '.reviews-summary-panel',
        detail: '.reviews-spotlight-panel',
        workbench: '#reviewsGrid',
    },
    availability: {
        hero: '.availability-header',
        workbench: '.availability-container',
        detail: '#availabilityDetailGrid',
    },
    queue: {
        hero: '#queueStationControl',
        workbench: '.queue-admin-table',
        detail: '#queueActivityPanel',
    },
};
function yt(a, e, n) {
    if (!e) return;
    const i = t(`#${a}`);
    if (!(i instanceof HTMLElement)) return;
    const s = i.querySelector(e);
    s instanceof HTMLElement && s.setAttribute(n, 'true');
}
const kt = 'admin-appointments-sort',
    St = 'admin-appointments-density';
function wt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Ct(t) {
    return (function (t) {
        const a = new Date(t || '');
        return Number.isNaN(a.getTime()) ? 0 : a.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function At(t) {
    return wt(t.paymentStatus || t.payment_status || '');
}
function $t(t) {
    return wt(t);
}
function Lt(t, a = '-') {
    const e = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return e
        ? e
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : a;
}
function qt(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[wt(t)] || Lt(t, 'Pendiente')
    );
}
function Tt(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[wt(t)] || Lt(t, 'Pendiente')
    );
}
function Et(t) {
    if (!t) return 'Sin fecha';
    const a = Math.round((t - Date.now()) / 6e4),
        e = Math.abs(a);
    return a < 0
        ? e < 60
            ? `Hace ${e} min`
            : e < 1440
              ? `Hace ${Math.round(e / 60)} h`
              : 'Ya ocurrio'
        : a < 60
          ? `En ${Math.max(a, 0)} min`
          : a < 1440
            ? `En ${Math.round(a / 60)} h`
            : `En ${Math.round(a / 1440)} d`;
}
function Dt(t) {
    const a = Ct(t);
    if (!a) return !1;
    const e = new Date(a),
        n = new Date();
    return (
        e.getFullYear() === n.getFullYear() &&
        e.getMonth() === n.getMonth() &&
        e.getDate() === n.getDate()
    );
}
function _t(t) {
    const a = Ct(t);
    if (!a) return !1;
    const e = a - Date.now();
    return e >= 0 && e <= 1728e5;
}
function Mt(t) {
    const a = At(t),
        e = $t(t.status);
    return (
        'pending_transfer_review' === a ||
        'pending_transfer' === a ||
        'no_show' === e ||
        'cancelled' === e
    );
}
function xt(t, a) {
    const e = wt(a);
    return 'pending_transfer' === e
        ? t.filter((t) => {
              const a = At(t);
              return (
                  'pending_transfer_review' === a || 'pending_transfer' === a
              );
          })
        : 'upcoming_48h' === e
          ? t.filter(_t)
          : 'no_show' === e
            ? t.filter((t) => 'no_show' === $t(t.status))
            : 'triage_attention' === e
              ? t.filter(Mt)
              : t;
}
function Bt(t) {
    const a = At(t),
        e = $t(t.status),
        n = Ct(t);
    return 'pending_transfer_review' === a || 'pending_transfer' === a
        ? {
              label: 'Transferencia',
              tone: 'warning',
              note: 'No liberar hasta validar pago.',
          }
        : 'no_show' === e
          ? {
                label: 'No show',
                tone: 'danger',
                note: 'Requiere seguimiento o cierre.',
            }
          : 'cancelled' === e
            ? {
                  label: 'Cancelada',
                  tone: 'danger',
                  note: 'Bloqueo operativo cerrado.',
              }
            : Dt(t)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: n ? Et(n) : 'Agenda del dia',
                }
              : _t(t)
                ? {
                      label: '48h',
                      tone: 'neutral',
                      note: 'Ventana inmediata de agenda.',
                  }
                : {
                      label: 'Programada',
                      tone: 'neutral',
                      note: 'Sin incidencias abiertas.',
                  };
}
function Nt(t) {
    const a = t
            .map((t) => ({ item: t, stamp: Ct(t) }))
            .sort((t, a) => t.stamp - a.stamp),
        e = a.find(({ item: t }) => {
            const a = At(t);
            return 'pending_transfer_review' === a || 'pending_transfer' === a;
        });
    if (e)
        return {
            item: e.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const n = a.find(({ item: t }) => 'no_show' === $t(t.status));
    if (n)
        return {
            item: n.item,
            label: 'Seguimiento abierto',
            hint: 'Define si se reprograma o se cierra la incidencia.',
            tags: ['No show', 'Seguimiento'],
        };
    const i = a.find(({ stamp: t }) => t >= Date.now());
    return i
        ? {
              item: i.item,
              label: 'Siguiente ingreso',
              hint: 'Deja contexto listo para la siguiente atencion.',
              tags: ['Agenda viva'],
          }
        : {
              item: null,
              label: 'Sin foco activo',
              hint: 'Cuando entre una cita accionable aparecera aqui.',
              tags: [],
          };
}
function Pt(t) {
    return t.length
        ? t
              .map((t) => {
                  const a = Ct(t),
                      e = Bt(t);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(t.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${s(t.name || 'Sin nombre')}</strong>\n                            <span>${s(t.email || 'Sin email')}</span>\n                            <small>${s(t.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">\n                        <div class="appointment-service">\n                            <strong>${s(Lt(t.service, 'Servicio pendiente'))}</strong>\n                            <span>Especialista: ${s(Lt(t.doctor, 'Sin asignar'))}</span>\n                            <small>${s(e.label)} | ${s(e.note)}</small>\n                        </div>\n                    </td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${s(c(t.date))}</strong>\n                            <span>${s(t.time || '--:--')}</span>\n                            <small>${s(Et(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      t
                  ) {
                      const a = t.paymentStatus || t.payment_status || '',
                          e = String(
                              t.transferProofUrl ||
                                  t.transferProofURL ||
                                  t.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${s(
                          (function (t) {
                              const a = wt(t);
                              return 'paid' === a
                                  ? 'success'
                                  : 'failed' === a
                                    ? 'danger'
                                    : 'pending_cash' === a
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${s(qt(a))}</span>\n            <small>Metodo: ${s(((n = t.paymentMethod || t.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[wt(n)] || Lt(n, 'Metodo pendiente')))}</small>\n            ${e ? `<a href="${s(e)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var n;
                  })(
                      t
                  )}</td>\n                    <td data-label="Estado">${(function (
                      t
                  ) {
                      const a = $t(t.status),
                          e = At(t),
                          n = Bt(t),
                          i = [];
                      return (
                          'pending_transfer_review' === e &&
                              i.push('Transferencia por validar'),
                          'no_show' === a && i.push('Paciente ausente'),
                          'cancelled' === a && i.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${s(
                              (function (t) {
                                  const a = wt(t);
                                  return 'completed' === a
                                      ? 'success'
                                      : 'cancelled' === a || 'no_show' === a
                                        ? 'danger'
                                        : 'pending' === a
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${s(Tt(a))}</span>\n            <small>${s(i[0] || n.note)}</small>\n        </div>\n    `
                      );
                  })(
                      t
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      t
                  ) {
                      const a = Number(t.id || 0),
                          e = At(t),
                          n = (function (t) {
                              const a = String(t || '').replace(/\D+/g, '');
                              return a ? `https://wa.me/${a}` : '';
                          })(t.phone || ''),
                          i = [];
                      return (
                          n &&
                              i.push(
                                  `<a href="${s(n)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${s(t.name || 'Paciente')}" title="WhatsApp para seguimiento">WhatsApp</a>`
                              ),
                          ('pending_transfer_review' !== e &&
                              'pending_transfer' !== e) ||
                              (i.push(
                                  `<button type="button" data-action="approve-transfer" data-id="${a}">Aprobar</button>`
                              ),
                              i.push(
                                  `<button type="button" data-action="reject-transfer" data-id="${a}">Rechazar</button>`
                              )),
                          i.push(
                              `<button type="button" data-action="mark-no-show" data-id="${a}">No show</button>`
                          ),
                          i.push(
                              `<button type="button" data-action="cancel-appointment" data-id="${a}">Cancelar</button>`
                          ),
                          `<div class="table-actions">${i.join('')}</div>`
                      );
                  })(t)}</td>\n                </tr>\n            `;
              })
              .join('')
        : `<tr class="table-empty-row"><td colspan="6">${s('No hay citas para el filtro actual.')}</td></tr>`;
}
function Ft() {
    const t = r(),
        a = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        e = (function (t, a) {
            const e = wt(a),
                n = [...t];
            return 'patient_az' === e
                ? (n.sort((t, a) => wt(t.name).localeCompare(wt(a.name), 'es')),
                  n)
                : 'datetime_asc' === e
                  ? (n.sort((t, a) => Ct(t) - Ct(a)), n)
                  : (n.sort((t, a) => Ct(a) - Ct(t)), n);
        })(
            (function (t, a) {
                const e = wt(a);
                return e
                    ? t.filter((t) =>
                          [
                              t.name,
                              t.email,
                              t.phone,
                              t.service,
                              t.doctor,
                              t.paymentStatus,
                              t.payment_status,
                              t.status,
                          ].some((t) => wt(t).includes(e))
                      )
                    : t;
            })(xt(a, t.appointments.filter), t.appointments.search),
            t.appointments.sort
        );
    (i('#appointmentsTableBody', Pt(e)),
        n('#appointmentsToolbarMeta', `Mostrando ${e.length} de ${a.length}`));
    const o = [];
    if ('all' !== wt(t.appointments.filter)) {
        const a = {
            pending_transfer: 'Transferencias por validar',
            triage_attention: 'Triage accionable',
            upcoming_48h: 'Proximas 48h',
            no_show: 'No show',
        };
        o.push(a[wt(t.appointments.filter)] || t.appointments.filter);
    }
    (wt(t.appointments.search) && o.push(`Busqueda: ${t.appointments.search}`),
        'patient_az' === wt(t.appointments.sort)
            ? o.push('Paciente (A-Z)')
            : 'datetime_asc' === wt(t.appointments.sort)
              ? o.push('Fecha ascendente')
              : o.push('Fecha reciente'),
        0 === e.length && o.push('Resultados: 0'),
        n('#appointmentsToolbarState', o.join(' | ')));
    const l = document.getElementById('clearAppointmentsFiltersBtn');
    if (l) {
        const a =
            'all' !== wt(t.appointments.filter) ||
            '' !== wt(t.appointments.search);
        l.classList.toggle('is-hidden', !a);
    }
    const d = document.getElementById('appointmentFilter');
    d instanceof HTMLSelectElement && (d.value = t.appointments.filter);
    const u = document.getElementById('appointmentSort');
    u instanceof HTMLSelectElement && (u.value = t.appointments.sort);
    const p = document.getElementById('searchAppointments');
    p instanceof HTMLInputElement &&
        p.value !== t.appointments.search &&
        (p.value = t.appointments.search);
    const m = document.getElementById('appointments');
    (m &&
        m.classList.toggle(
            'appointments-density-compact',
            'compact' === wt(t.appointments.density)
        ),
        document
            .querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
            .forEach((a) => {
                const e = wt(a.dataset.density) === wt(t.appointments.density);
                a.classList.toggle('is-active', e);
            }),
        (function (t) {
            const a = wt(t);
            document
                .querySelectorAll(
                    '.appointment-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const e = wt(t.dataset.filterValue) === a;
                    t.classList.toggle('is-active', e);
                });
        })(t.appointments.filter),
        (function (t) {
            try {
                (localStorage.setItem(kt, JSON.stringify(t.sort)),
                    localStorage.setItem(St, JSON.stringify(t.density)));
            } catch (t) {}
        })(t.appointments),
        (function (t, a, e) {
            (n('#appointmentsOpsPendingTransfer', t.pendingTransferCount),
                n(
                    '#appointmentsOpsPendingTransferMeta',
                    t.pendingTransferCount > 0
                        ? `${t.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                n('#appointmentsOpsUpcomingCount', t.upcomingCount),
                n(
                    '#appointmentsOpsUpcomingMeta',
                    t.upcomingCount > 0
                        ? `${t.upcomingCount} cita(s) dentro de 48h`
                        : 'Sin presion inmediata'
                ),
                n('#appointmentsOpsNoShowCount', t.noShowCount),
                n(
                    '#appointmentsOpsNoShowMeta',
                    t.noShowCount > 0
                        ? `${t.noShowCount} caso(s) con seguimiento`
                        : 'Sin incidencias'
                ),
                n('#appointmentsOpsTodayCount', t.todayCount),
                n(
                    '#appointmentsOpsTodayMeta',
                    t.todayCount > 0
                        ? `${t.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ));
            const o =
                e > 0
                    ? `${t.pendingTransferCount} transferencia(s), ${t.triageCount} frente(s) accionables y ${a} cita(s) visibles.`
                    : 'Sin citas cargadas.';
            (n('#appointmentsDeckSummary', o),
                n(
                    '#appointmentsWorkbenchHint',
                    t.pendingTransferCount > 0
                        ? 'Primero valida pagos; luego ordena la mesa por fecha o paciente.'
                        : t.triageCount > 0
                          ? 'La agenda tiene incidencias abiertas dentro de esta misma mesa.'
                          : 'Filtros, orden y tabla en un workbench unico.'
                ));
            const r = document.getElementById('appointmentsDeckChip');
            if (r) {
                const a =
                    t.pendingTransferCount > 0 || t.noShowCount > 0
                        ? 'warning'
                        : 'success';
                ((r.textContent =
                    'warning' === a ? 'Atencion operativa' : 'Agenda estable'),
                    r.setAttribute('data-state', a));
            }
            const l = t.focus;
            if ((n('#appointmentsFocusLabel', l.label), !l.item))
                return (
                    n('#appointmentsFocusPatient', 'Sin citas activas'),
                    n(
                        '#appointmentsFocusMeta',
                        'Cuando entren citas accionables apareceran aqui.'
                    ),
                    n('#appointmentsFocusWindow', '-'),
                    n('#appointmentsFocusPayment', '-'),
                    n('#appointmentsFocusStatus', '-'),
                    n('#appointmentsFocusContact', '-'),
                    i('#appointmentsFocusTags', ''),
                    void n('#appointmentsFocusHint', l.hint)
                );
            const d = l.item;
            (n('#appointmentsFocusPatient', d.name || 'Sin nombre'),
                n(
                    '#appointmentsFocusMeta',
                    `${Lt(d.service, 'Servicio pendiente')} | ${c(d.date)} ${d.time || '--:--'}`
                ),
                n('#appointmentsFocusWindow', Et(Ct(d))),
                n(
                    '#appointmentsFocusPayment',
                    qt(d.paymentStatus || d.payment_status)
                ),
                n('#appointmentsFocusStatus', Tt(d.status)),
                n('#appointmentsFocusContact', d.phone || 'Sin telefono'),
                i(
                    '#appointmentsFocusTags',
                    l.tags
                        .map(
                            (t) =>
                                `<span class="appointments-focus-tag">${s(t)}</span>`
                        )
                        .join('')
                ),
                n('#appointmentsFocusHint', l.hint));
        })(
            (function (t) {
                const a = xt(t, 'pending_transfer'),
                    e = xt(t, 'upcoming_48h'),
                    n = xt(t, 'no_show'),
                    i = xt(t, 'triage_attention'),
                    s = t.filter(Dt);
                return {
                    pendingTransferCount: a.length,
                    upcomingCount: e.length,
                    noShowCount: n.length,
                    todayCount: s.length,
                    triageCount: i.length,
                    focus: Nt(t),
                };
            })(a),
            e.length,
            a.length
        ));
}
function It(t) {
    (o((a) => ({ ...a, appointments: { ...a.appointments, ...t } })), Ft());
}
function Ht(t) {
    It({ filter: wt(t) || 'all' });
}
function Rt(t) {
    It({ search: String(t || '') });
}
function Ot(t, a) {
    const e = Number(t || 0);
    (o((t) => ({
        ...t,
        data: {
            ...t.data,
            appointments: (t.data.appointments || []).map((t) =>
                Number(t.id || 0) === e ? { ...t, ...a } : t
            ),
        },
    })),
        Ft());
}
async function jt(t, a) {
    await l('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...a },
    });
}
const zt = 'admin-callbacks-sort',
    Vt = 'admin-callbacks-filter',
    Ut = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Qt = new Set(['recent_desc', 'waiting_desc']);
function Gt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Wt(t) {
    const a = Gt(t);
    return Ut.has(a) ? a : 'all';
}
function Jt(t) {
    const a = Gt(t);
    return Qt.has(a) ? a : 'recent_desc';
}
function Yt(t) {
    const a = Gt(t);
    return 'contacted' === a ||
        'contactado' === a ||
        'completed' === a ||
        'done' === a ||
        'resolved' === a ||
        'called' === a ||
        'atendido' === a
        ? 'contacted'
        : 'pending';
}
function Zt(t) {
    const a = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(a.getTime()) ? 0 : a.getTime();
}
function Kt(t) {
    const a = Zt(t);
    return a ? Math.max(0, Math.round((Date.now() - a) / 6e4)) : 0;
}
function Xt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function ta(t) {
    const a = new Date(t || '');
    if (Number.isNaN(a.getTime())) return !1;
    const e = new Date();
    return (
        a.getFullYear() === e.getFullYear() &&
        a.getMonth() === e.getMonth() &&
        a.getDate() === e.getDate()
    );
}
function aa(t) {
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
function ea(t) {
    return t < 60 ? `${t} min` : `${Math.round(t / 60)} h`;
}
function na() {
    const t = r(),
        a = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        e = (function (t, a) {
            const e = Gt(a);
            return e
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          Gt(t).includes(e)
                      )
                  )
                : t;
        })(
            (function (t, a) {
                const e = Wt(a);
                return 'pending' === e || 'contacted' === e
                    ? t.filter((t) => Yt(t.status) === e)
                    : 'today' === e
                      ? t.filter((t) => ta(t.fecha || t.createdAt))
                      : 'sla_urgent' === e
                        ? t.filter(
                              (t) => 'pending' === Yt(t.status) && Kt(t) >= 120
                          )
                        : t;
            })(a, t.callbacks.filter),
            t.callbacks.search
        ),
        o = (function (t, a) {
            const e = [...t];
            return 'waiting_desc' === Jt(a)
                ? (e.sort((t, a) => Zt(t) - Zt(a)), e)
                : (e.sort((t, a) => Zt(a) - Zt(t)), e);
        })(e, t.callbacks.sort),
        l = new Set((t.callbacks.selected || []).map((t) => Number(t || 0)));
    (i(
        '#callbacksGrid',
        o.length
            ? o
                  .map((t, a) =>
                      (function (
                          t,
                          { selected: a = !1, position: e = null } = {}
                      ) {
                          const n = Yt(t.status),
                              i =
                                  'pending' === n
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              o = 'pending' === n ? 'pendiente' : 'contactado',
                              r = Number(t.id || 0),
                              l = Xt(t),
                              c = Kt(t),
                              u = aa(c),
                              p = t.preferencia || 'Sin preferencia',
                              m =
                                  'pending' === n
                                      ? 1 === e
                                          ? 'Siguiente contacto recomendado'
                                          : 'Caso pendiente en cola'
                                      : 'Caso ya resuelto';
                          return `\n        <article class="${i}${a ? ' is-selected' : ''}" data-callback-id="${r}" data-callback-status="${o}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${s('pending' === n ? u.tone : 'success')}">${s('pending' === n ? 'Pendiente' : 'Contactado')}</span>\n                    <h4>${s(l)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${s('pending' === n ? u.tone : 'success')}">${s('pending' === n ? u.label : 'Cerrado')}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${s(p)}</strong></p>\n                <p><span>Fecha</span><strong>${s(d(t.fecha || t.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${s(ea(c))}</strong></p>\n                <p><span>Lectura</span><strong>${s(m)}</strong></p>\n            </div>\n            <p class="callback-card-note">${s('pending' === n ? u.note : 'Registro ya marcado como contactado.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${r}" data-callback-date="${s(t.fecha || '')}" ${'pending' !== n ? 'disabled' : ''}>${'pending' === n ? 'Marcar contactado' : 'Contactado'}</button>\n            </div>\n        </article>\n    `;
                      })(t, {
                          selected: l.has(Number(t.id || 0)),
                          position: a + 1,
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    ),
        n('#callbacksToolbarMeta', `Mostrando ${o.length} de ${a.length}`));
    const c = [];
    ('all' !== Wt(t.callbacks.filter) &&
        c.push(
            'pending' === Wt(t.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === Wt(t.callbacks.filter)
                  ? 'Contactados'
                  : 'today' === Wt(t.callbacks.filter)
                    ? 'Hoy'
                    : 'Urgentes SLA'
        ),
        Gt(t.callbacks.search) && c.push(`Busqueda: ${t.callbacks.search}`),
        'waiting_desc' === Jt(t.callbacks.sort)
            ? c.push('Orden: Mayor espera (SLA)')
            : c.push('Orden: Mas recientes'),
        n('#callbacksToolbarState', c.join(' | ')));
    const u = document.getElementById('callbackFilter');
    u instanceof HTMLSelectElement && (u.value = Wt(t.callbacks.filter));
    const p = document.getElementById('callbackSort');
    p instanceof HTMLSelectElement && (p.value = Jt(t.callbacks.sort));
    const m = document.getElementById('searchCallbacks');
    (m instanceof HTMLInputElement &&
        m.value !== t.callbacks.search &&
        (m.value = t.callbacks.search),
        (function (t) {
            const a = Gt(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const e = Gt(t.dataset.filterValue) === a;
                    t.classList.toggle('is-active', e);
                });
        })(t.callbacks.filter));
    const b = (function (t) {
        const a = t.filter((t) => 'pending' === Yt(t.status)),
            e = a.filter((t) => Kt(t) >= 120),
            n = a.slice().sort((t, a) => Zt(t) - Zt(a))[0];
        return {
            pendingCount: a.length,
            urgentCount: e.length,
            todayCount: t.filter((t) => ta(t.fecha || t.createdAt)).length,
            next: n,
            queueHealth:
                e.length > 0
                    ? 'Cola: prioridad alta'
                    : a.length > 0
                      ? 'Cola: atencion requerida'
                      : 'Cola: estable',
            queueState:
                e.length > 0 ? 'danger' : a.length > 0 ? 'warning' : 'success',
        };
    })(a);
    (n('#callbacksOpsPendingCount', b.pendingCount),
        n('#callbacksOpsUrgentCount', b.urgentCount),
        n('#callbacksOpsTodayCount', b.todayCount),
        n('#callbacksOpsQueueHealth', b.queueHealth));
    const g = document.getElementById('callbacksBulkSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === o.length);
    const v = document.getElementById('callbacksBulkClearBtn');
    v instanceof HTMLButtonElement && (v.disabled = 0 === l.size);
    const h = document.getElementById('callbacksBulkMarkBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === l.size),
        (function (t, a, e, i) {
            (n(
                '#callbacksDeckSummary',
                e > 0
                    ? `${t.pendingCount} pendiente(s), ${t.urgentCount} fuera de SLA y ${a} visibles.`
                    : 'Sin callbacks pendientes.'
            ),
                n(
                    '#callbacksDeckHint',
                    t.urgentCount > 0
                        ? 'Escala primero los casos criticos.'
                        : t.pendingCount > 0
                          ? 'La cola se puede drenar en esta misma vista.'
                          : 'Sin bloqueos'
                ));
            const s = document.getElementById('callbacksQueueChip');
            s &&
                ((s.textContent =
                    'danger' === t.queueState
                        ? 'SLA comprometido'
                        : 'warning' === t.queueState
                          ? 'Cola activa'
                          : 'Cola estable'),
                s.setAttribute('data-state', t.queueState));
            const o = document.getElementById('callbacksOpsQueueHealth');
            o && o.setAttribute('data-state', t.queueState);
            const r = t.next;
            (n('#callbacksOpsNext', r ? Xt(r) : 'Sin telefono'),
                n(
                    '#callbacksNextSummary',
                    r
                        ? `Prioriza ${Xt(r)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                n('#callbacksNextWait', r ? ea(Kt(r)) : '0 min'),
                n('#callbacksNextPreference', (r && r.preferencia) || '-'),
                n('#callbacksNextState', r ? aa(Kt(r)).label : 'Pendiente'));
            const l = document.getElementById('callbacksSelectionChip');
            (l && l.classList.toggle('is-hidden', 0 === i),
                n('#callbacksSelectedCount', i));
        })(b, o.length, a.length, l.size));
}
function ia(t, { persist: a = !0 } = {}) {
    (o((a) => ({ ...a, callbacks: { ...a.callbacks, ...t } })),
        a &&
            (function (t) {
                try {
                    (localStorage.setItem(Vt, JSON.stringify(Wt(t.filter))),
                        localStorage.setItem(zt, JSON.stringify(Jt(t.sort))));
                } catch (t) {}
            })(r().callbacks),
        na());
}
function sa(t) {
    ia({ filter: Wt(t), selected: [] });
}
async function oa(t, a = '') {
    const e = Number(t || 0);
    e <= 0 ||
        (await l('callbacks', {
            method: 'PATCH',
            body: { id: e, status: 'contacted', fecha: a },
        }),
        (function (t) {
            const a = Number(t || 0);
            (o((t) => ({
                ...t,
                data: {
                    ...t.data,
                    callbacks: (t.data.callbacks || []).map((t) =>
                        Number(t.id || 0) === a
                            ? { ...t, status: 'contacted' }
                            : t
                    ),
                },
                callbacks: {
                    ...t.callbacks,
                    selected: (t.callbacks.selected || []).filter(
                        (t) => Number(t || 0) !== a
                    ),
                },
            })),
                na());
        })(e));
}
const ra = 'admin-availability-selected-date',
    la = 'admin-availability-month-anchor';
function ca(t) {
    const a = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return a ? `${a[1]}:${a[2]}` : '';
}
function da(t) {
    return [...new Set(t.map(ca).filter(Boolean))].sort();
}
function ua(t) {
    const a = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return '';
    const e = new Date(`${a}T12:00:00`);
    return Number.isNaN(e.getTime()) ? '' : u(e) === a ? a : '';
}
function pa(t) {
    const a = ua(t);
    if (!a) return null;
    const e = new Date(`${a}T12:00:00`);
    return Number.isNaN(e.getTime()) ? null : e;
}
function ma(t) {
    const a = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((e) => {
                const n = ua(e);
                if (!n) return;
                const i = da(Array.isArray(t[e]) ? t[e] : []);
                i.length && (a[n] = i);
            }),
        a
    );
}
function ba(t) {
    return ma(t || {});
}
function ga(t) {
    return JSON.stringify(ma(t || {}));
}
function va(t) {
    const a = ba(r().data.availability || {});
    return ga(t) !== ga(a);
}
function ha(t, a = '') {
    let e = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) e = new Date(t);
    else {
        const a = ua(t);
        a && (e = new Date(`${a}T12:00:00`));
    }
    if (!e) {
        const t = pa(a);
        e = t ? new Date(t) : new Date();
    }
    return (e.setDate(1), e.setHours(12, 0, 0, 0), e);
}
function fa(t, a) {
    const e = ua(t);
    if (e) return e;
    const n = Object.keys(a || {})[0];
    if (n) {
        const t = ua(n);
        if (t) return t;
    }
    return u(new Date());
}
function ya() {
    const t = r(),
        a = ua(t.availability.selectedDate),
        e = ha(t.availability.monthAnchor, a);
    try {
        (a ? localStorage.setItem(ra, a) : localStorage.removeItem(ra),
            localStorage.setItem(la, u(e)));
    } catch (t) {}
}
function ka(t, { render: a = !1 } = {}) {
    (o((a) => ({ ...a, availability: { ...a.availability, ...t } })),
        a ? Da() : ya());
}
function Sa(t, a = {}) {
    const e = ba(t),
        n = fa(a.selectedDate || r().availability.selectedDate, e);
    ka(
        {
            draft: e,
            selectedDate: n,
            monthAnchor: ha(a.monthAnchor || r().availability.monthAnchor, n),
            draftDirty: va(e),
            ...a,
        },
        { render: !0 }
    );
}
function wa(t) {
    ka({ lastAction: String(t || '') }, { render: !0 });
}
function Ca(t, a, e = '') {
    const n = ua(t) || La();
    if (!n) return;
    const i = Aa(),
        s = da(Array.isArray(a) ? a : []);
    (s.length ? (i[n] = s) : delete i[n],
        Sa(i, { selectedDate: n, monthAnchor: n, lastAction: e }));
}
function Aa() {
    return ba(r().availability.draft || {});
}
function $a() {
    const t = r().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function La() {
    const t = r(),
        a = ua(t.availability.selectedDate);
    if (a) return a;
    const e = ba(t.availability.draft || {});
    return Object.keys(e)[0] || u(new Date());
}
function qa(t, a) {
    return t.length
        ? 1 === t.length
            ? '1 slot publicado. ' +
              (a
                  ? 'Lectura desde Google Calendar.'
                  : 'Puedes duplicarlo o ampliarlo.')
            : `${t.length} slots en el dia. ${a ? 'Referencia en solo lectura.' : 'Listo para copiar o limpiar.'}`
        : a
          ? 'No hay slots publicados en este dia.'
          : 'Agrega slots o copia una jornada existente.';
}
function Ta(t, a) {
    const e = ua(t);
    e &&
        ka(
            { selectedDate: e, monthAnchor: ha(e, e), lastAction: a || '' },
            { render: !0 }
        );
}
function Ea(t = 1) {
    const a = Aa(),
        e = Object.keys(a).filter((t) => a[t]?.length > 0);
    if (!e.length) return '';
    const n = ua(r().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? e.sort() : e.sort().reverse()).find((a) =>
            t >= 0 ? a >= n : a <= n
        ) || ''
    );
}
function Da() {
    ((function () {
        const t = r(),
            a = ha(t.availability.monthAnchor, t.availability.selectedDate),
            e = La(),
            s = a.getMonth(),
            o = ba(t.availability.draft),
            l = u(new Date());
        var c;
        n(
            '#calendarMonth',
            ((c = a),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(c))
        );
        const d = (function (t) {
            const a = new Date(t.getFullYear(), t.getMonth(), 1),
                e = (a.getDay() + 6) % 7;
            a.setDate(a.getDate() - e);
            const n = [];
            for (let t = 0; t < 42; t += 1) {
                const e = new Date(a);
                (e.setDate(a.getDate() + t), n.push(e));
            }
            return n;
        })(a)
            .map((t) => {
                const a = u(t),
                    n = Array.isArray(o[a]) ? o[a] : [],
                    i = n.length > 0,
                    r = t.getMonth() === s;
                return `\n                <button type="button" class="${['calendar-day', r ? '' : 'other-month', i ? 'has-slots' : '', a === e ? 'is-selected' : '', a === l ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${a}">\n                    <span>${t.getDate()}</span>\n                    <small>${i ? `${n.length} slot${1 === n.length ? '' : 's'}` : r ? 'Sin slots' : ''}</small>\n                </button>\n            `;
            })
            .join('');
        i('#availabilityCalendar', d);
    })(),
        (function () {
            const t = r(),
                a = La(),
                e = da(ba(t.availability.draft)[a] || []),
                o = $a();
            (n('#selectedDate', a || '-'),
                e.length
                    ? i(
                          '#timeSlotsList',
                          e
                              .map(
                                  (t) =>
                                      `\n            <div class="time-slot-item">\n                <div>\n                    <strong>${s(t)}</strong>\n                    <small>${s(o ? 'Slot publicado' : 'Disponible para consulta')}</small>\n                </div>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(a)}" data-time="${encodeURIComponent(t)}" ${o ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : i(
                          '#timeSlotsList',
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${s(qa([], o))}</p>`
                      ));
        })(),
        (function () {
            const a = r(),
                e = La(),
                i = ba(a.availability.draft),
                s = Array.isArray(i[e]) ? i[e] : [],
                o = $a(),
                {
                    sourceText: l,
                    modeText: c,
                    timezone: d,
                } = (function () {
                    const t = r().data.availabilityMeta || {},
                        a = $a();
                    return {
                        sourceText: a ? 'Google Calendar' : 'Local',
                        modeText: a ? 'Solo lectura' : 'Editable',
                        timezone: String(
                            t.timezone ||
                                Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone ||
                                '-'
                        ),
                    };
                })();
            (n(
                '#availabilityHeading',
                o
                    ? 'Calendario de disponibilidad - Solo lectura'
                    : 'Calendario de disponibilidad'
            ),
                n('#availabilitySourceBadge', `Fuente: ${l}`),
                n('#availabilityModeBadge', `Modo: ${c}`),
                n('#availabilityTimezoneBadge', `TZ: ${d}`),
                n(
                    '#availabilitySelectionSummary',
                    `Fecha: ${e} | ${(function (t) {
                        const a = pa(t);
                        return a
                            ? new Intl.DateTimeFormat('es-EC', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                              }).format(a)
                            : t || '-';
                    })(e)} | Fuente: ${l} | Modo: ${c} | Slots: ${s.length}`
                ),
                n(
                    '#availabilityDraftStatus',
                    a.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                n(
                    '#availabilitySyncStatus',
                    o ? `Google Calendar | ${d}` : `Store local | ${d}`
                ));
            const u = t('#addSlotForm'),
                p = t('#availabilityQuickSlotPresets');
            (u && u.classList.toggle('is-hidden', o),
                p && p.classList.toggle('is-hidden', o));
            const m = t('#newSlotTime');
            m instanceof HTMLInputElement && (m.disabled = o);
            const b = t('[data-action="add-time-slot"]');
            b instanceof HTMLButtonElement && (b.disabled = o);
            const g = Array.isArray(a.availability.clipboard)
                ? a.availability.clipboard.length
                : 0;
            let v = qa(s, o);
            (o
                ? (v = 'Edicion bloqueada por proveedor Google')
                : a.availability.lastAction
                  ? (v = String(a.availability.lastAction))
                  : g && (v = `Portapapeles: ${g} slots`),
                n('#availabilityDayActionsStatus', v),
                document
                    .querySelectorAll(
                        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                    )
                    .forEach((t) => {
                        t instanceof HTMLButtonElement &&
                            ('availabilityDiscardDraftBtn' !== t.id &&
                            'availabilitySaveDraftBtn' !== t.id
                                ? 'paste-availability-day' !==
                                  String(t.dataset.action || '')
                                    ? (t.disabled = o)
                                    : (t.disabled = o || 0 === g)
                                : (t.disabled =
                                      o || !a.availability.draftDirty));
                    }));
        })(),
        ya());
}
function _a() {
    return Boolean(r().availability.draftDirty);
}
function Ma(t) {
    if ($a()) return;
    const a = r(),
        e = ua(a.availability.selectedDate) || La(),
        n = Array.isArray(a.availability.draft[e])
            ? a.availability.draft[e]
            : [],
        i = pa(e);
    if (!i) return;
    i.setDate(i.getDate() + Number(t || 0));
    const s = u(i);
    Ca(s, n, `Duplicado ${n.length} slots en ${s}`);
}
function xa(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Ba(t) {
    const a = new Date(t || '');
    return Number.isNaN(a.getTime()) ? 0 : a.getTime();
}
function Na(t) {
    return Ba(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function Pa(t) {
    if (!t) return 'Sin fecha';
    const a = Math.round((t - Date.now()) / 6e4),
        e = Math.abs(a);
    return a < 0
        ? e < 60
            ? `Hace ${e} min`
            : e < 1440
              ? `Hace ${Math.round(e / 60)} h`
              : 'Ya ocurrio'
        : a < 60
          ? `En ${Math.max(a, 0)} min`
          : a < 1440
            ? `En ${Math.round(a / 60)} h`
            : `En ${Math.round(a / 1440)} d`;
}
function Fa(t, a, e) {
    return Array.isArray(t) && 0 !== t.length
        ? t
              .slice(0, 5)
              .map((t) => {
                  const n = String(t[a] || t.label || '-'),
                      i = String(t[e] ?? t.count ?? 0);
                  return `<li><span>${s(n)}</span><strong>${s(i)}</strong></li>`;
              })
              .join('')
        : '<li><span>Sin datos</span><strong>0</strong></li>';
}
function Ia(t, a, e, n = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${s(n)}">\n            <div>\n                <span>${s(t)}</span>\n                <small>${s(e)}</small>\n            </div>\n            <strong>${s(String(a))}</strong>\n        </li>\n    `;
}
function Ha(t, a, e) {
    return `\n        <button type="button" class="operations-action-item" data-action="${s(t)}">\n            <span>${s(a)}</span>\n            <small>${s(e)}</small>\n        </button>\n    `;
}
function Ra(t) {
    const a = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        e = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        s = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
        o =
            t?.data?.availability && 'object' == typeof t.data.availability
                ? t.data.availability
                : {},
        r = t?.data?.funnelMetrics || {},
        l = (function (t) {
            return t.filter((t) =>
                (function (t) {
                    if (!t) return !1;
                    const a = new Date(t),
                        e = new Date();
                    return (
                        a.getFullYear() === e.getFullYear() &&
                        a.getMonth() === e.getMonth() &&
                        a.getDate() === e.getDate()
                    );
                })(Na(t))
            ).length;
        })(a),
        d = (function (t) {
            return t.filter((t) => {
                const a = xa(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === a || 'pending_transfer' === a
                );
            }).length;
        })(a),
        u = (function (t) {
            return t.filter((t) => 'pending' === xa(t.status)).length;
        })(e),
        m = (function (t) {
            return t.filter((t) => {
                if ('pending' !== xa(t.status)) return !1;
                const a = (function (t) {
                    return Ba(t?.fecha || t?.createdAt || '');
                })(t);
                return !!a && Math.round((Date.now() - a) / 6e4) >= 120;
            }).length;
        })(e),
        b = (function (t) {
            return t.filter((t) => 'no_show' === xa(t.status)).length;
        })(a),
        g = (function (t) {
            return t.length
                ? (
                      t.reduce((t, a) => t + Number(a.rating || 0), 0) /
                      t.length
                  ).toFixed(1)
                : '0.0';
        })(s),
        v = (function (t, a = 30) {
            const e = Date.now();
            return t.filter((t) => {
                const n = Ba(t.date || t.createdAt || '');
                return !!n && e - n <= 24 * a * 60 * 60 * 1e3;
            }).length;
        })(s),
        h = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(o),
        f = (function (t) {
            return t
                .map((t) => ({ item: t, stamp: Na(t) }))
                .filter((t) => t.stamp > 0 && t.stamp >= Date.now())
                .sort((t, a) => t.stamp - a.stamp)[0];
        })(a);
    (n('#todayAppointments', l),
        n('#totalAppointments', a.length),
        n('#pendingCallbacks', u),
        n('#totalReviewsCount', s.length),
        n('#totalNoShows', b),
        n('#avgRating', g),
        n('#adminAvgRating', g),
        n('#dashboardHeroRating', g),
        n('#dashboardHeroRecentReviews', v),
        n('#dashboardHeroUrgentCallbacks', m),
        n('#dashboardHeroPendingTransfers', d),
        n(
            '#dashboardHeroSummary',
            (function ({
                pendingTransfers: t,
                urgentCallbacks: a,
                noShows: e,
                nextAppointment: n,
            }) {
                return t > 0
                    ? `Primero valida ${t} transferencia(s) antes de liberar mas agenda.`
                    : a > 0
                      ? `Hay ${a} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`
                      : e > 0
                        ? `Revisa ${e} no show del corte actual para cerrar seguimiento.`
                        : n?.item
                          ? `La siguiente cita es ${n.item.name || 'sin nombre'} ${Pa(n.stamp).toLowerCase()}.`
                          : 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
            })({
                pendingTransfers: d,
                urgentCallbacks: m,
                noShows: b,
                nextAppointment: f,
            })
        ));
    const y = d > 0 || m > 0 ? 'Atencion' : l > 0 ? 'Activo' : 'Estable',
        k = d > 0 || m > 0 ? 'warning' : l > 0 ? 'neutral' : 'success',
        S =
            d > 0
                ? 'Transferencias detenidas hasta validar comprobante.'
                : m > 0
                  ? 'Callbacks fuera de SLA requieren llamada inmediata.'
                  : f?.item
                    ? `Siguiente ingreso: ${f.item.name || 'Paciente'} el ${c(f.item.date)} a las ${f.item.time || '--:--'}.`
                    : 'Sin alertas criticas en la operacion actual.';
    (n('#dashboardLiveStatus', y),
        document
            .getElementById('dashboardLiveStatus')
            ?.setAttribute('data-state', k),
        n('#dashboardLiveMeta', S),
        n(
            '#dashboardQueueHealth',
            m > 0
                ? 'Cola: SLA comprometido'
                : u > 0
                  ? 'Cola: pendiente por drenar'
                  : 'Cola: estable'
        ),
        n(
            '#dashboardFlowStatus',
            f?.item
                ? `${Pa(f.stamp)} | ${f.item.name || 'Paciente'}`
                : h > 0
                  ? `${h} dia(s) con slots publicados`
                  : 'Sin citas inmediatas'
        ),
        n('#operationPendingReviewCount', d),
        n('#operationPendingCallbacksCount', u),
        n('#operationTodayLoadCount', l),
        n(
            '#operationDeckMeta',
            d > 0 || m > 0
                ? 'La prioridad ya esta definida'
                : f?.item
                  ? 'Siguiente accion lista'
                  : 'Operacion sin frentes urgentes'
        ),
        n(
            '#operationQueueHealth',
            f?.item
                ? `Siguiente hito: ${f.item.name || 'Paciente'} ${Pa(f.stamp).toLowerCase()}`
                : 'Sin citas inmediatas en cola'
        ));
    const w = [
        Ha(
            'context-open-appointments-transfer',
            d > 0 ? 'Validar transferencias' : 'Abrir agenda clinica',
            d > 0
                ? `${d} comprobante(s) por revisar`
                : `${a.length} cita(s) en el corte`
        ),
        Ha(
            'context-open-callbacks-pending',
            m > 0 ? 'Resolver callbacks urgentes' : 'Abrir callbacks',
            m > 0 ? `${m} caso(s) fuera de SLA` : `${u} callback(s) pendientes`
        ),
        Ha(
            'refresh-admin-data',
            'Actualizar tablero',
            f?.item
                ? `Proxima cita ${Pa(f.stamp).toLowerCase()}`
                : 'Sincronizar agenda y funnel'
        ),
    ];
    i('#operationActionList', w.join(''));
    const C = [
        Ia(
            'Transferencias',
            d,
            d > 0
                ? 'Pago detenido antes de confirmar.'
                : 'Sin comprobantes pendientes.',
            d > 0 ? 'warning' : 'success'
        ),
        Ia(
            'Callbacks urgentes',
            m,
            m > 0 ? 'Mas de 120 min en espera.' : 'SLA dentro de rango.',
            m > 0 ? 'danger' : 'success'
        ),
        Ia(
            'Agenda de hoy',
            l,
            l > 0 ? `${l} ingreso(s) en la jornada.` : 'No hay citas hoy.',
            l > 6 ? 'warning' : 'neutral'
        ),
        Ia(
            'Disponibilidad',
            h,
            h > 0
                ? 'Dias con slots listos para publicar.'
                : 'Sin slots cargados en el calendario.',
            h > 0 ? 'success' : 'warning'
        ),
    ];
    i('#dashboardAttentionList', C.join(''));
    const A = r.summary || {};
    (n('#funnelViewBooking', p(A.viewBooking || 0)),
        n('#funnelStartCheckout', p(A.startCheckout || 0)),
        n('#funnelBookingConfirmed', p(A.bookingConfirmed || 0)),
        n('#funnelAbandonRate', `${Number(A.abandonRatePct || 0).toFixed(1)}%`),
        i('#funnelEntryList', Fa(r.checkoutEntryBreakdown, 'entry', 'count')),
        i('#funnelSourceList', Fa(r.sourceBreakdown, 'source', 'count')),
        i(
            '#funnelPaymentMethodList',
            Fa(r.paymentMethodBreakdown, 'method', 'count')
        ),
        i('#funnelAbandonList', Fa(r.checkoutAbandonByStep, 'step', 'count')),
        i(
            '#funnelAbandonReasonList',
            Fa(r.abandonReasonBreakdown, 'reason', 'count')
        ),
        i('#funnelStepList', Fa(r.bookingStepBreakdown, 'step', 'count')),
        i('#funnelErrorCodeList', Fa(r.errorCodeBreakdown, 'code', 'count')));
}
function Oa(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ja(t) {
    const a = new Date(t?.date || t?.createdAt || '');
    return Number.isNaN(a.getTime()) ? 0 : a.getTime();
}
function za(t) {
    return `${Math.max(0, Math.min(5, Math.round(Number(t || 0))))}/5`;
}
function Va(t) {
    const a = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return a.length ? a.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function Ua(t, a = 220) {
    const e = String(t || '').trim();
    return e
        ? e.length <= a
            ? e
            : `${e.slice(0, a - 1).trim()}...`
        : 'Sin comentario escrito.';
}
const Qa = 'adminLastSection',
    Ga = 'adminSidebarCollapsed';
function Wa(t, { persist: a = !1 } = {}) {
    const e = C(t);
    (o((a) => ({ ...a, ui: { ...a.ui, themeMode: t, theme: e } })),
        a && A(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((a) => {
            const e = a.dataset.themeMode === t;
            (a.classList.toggle('is-active', e),
                a.setAttribute('aria-pressed', String(e)));
        }));
}
function Ja() {
    const t = r();
    (tt(Qa, t.ui.activeSection), tt(Ga, t.ui.sidebarCollapsed ? '1' : '0'));
}
function Ya() {
    const t = E();
    (n('#adminRefreshStatus', t),
        n(
            '#adminSyncState',
            'Datos: sin sincronizar' === t
                ? 'Listo para primera sincronizacion'
                : t.replace('Datos: ', 'Estado: ')
        ));
}
function Za() {
    (pt(!1),
        gt(),
        bt(!1),
        mt({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function Ka(t, a = {}) {
    const e = k(t, 'dashboard'),
        { force: n = !1 } = a,
        i = r().ui.activeSection;
    (n ||
        'availability' !== r().ui.activeSection ||
        'availability' === e ||
        !_a() ||
        window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        )) &&
        (!(function (t) {
            const a = k(t, 'dashboard');
            (o((t) => ({ ...t, ui: { ...t.ui, activeSection: a } })),
                ut(a),
                ht(r()),
                w(a),
                Ja());
        })(e),
        'queue' === e && 'queue' !== i && Z() && (await J()));
}
function Xa() {
    (o((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    })),
        ee(),
        Ja());
}
function te() {
    (o((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } })),
        ee());
}
function ae() {
    (o((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })), ee(), dt());
}
function ee() {
    const a = r(),
        e = window.matchMedia('(max-width: 1024px)').matches;
    !(function ({ open: a, collapsed: e }) {
        const n = t('#adminSidebar'),
            i = t('#adminSidebarBackdrop'),
            s = t('#adminMenuToggle');
        (n && n.classList.toggle('is-open', Boolean(a)),
            i && i.classList.toggle('is-hidden', !a),
            s && s.setAttribute('aria-expanded', String(Boolean(a))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(a)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(e)
            ));
        const o = t('#adminSidebarCollapse');
        o && o.setAttribute('aria-pressed', String(Boolean(e)));
    })({
        open: !!e && a.ui.sidebarOpen,
        collapsed: !e && a.ui.sidebarCollapsed,
    });
}
function ne() {
    ct();
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function ie() {
    const t = r().ui.activeSection;
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
async function se(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await Ka('appointments'), Ht('pending_transfer'), Rt(''));
            break;
        case 'appointments_all':
            (await Ka('appointments'), Ht('all'), Rt(''));
            break;
        case 'appointments_no_show':
            (await Ka('appointments'), Ht('no_show'), Rt(''));
            break;
        case 'callbacks_pending':
            (await Ka('callbacks'), sa('pending'));
            break;
        case 'callbacks_contacted':
            (await Ka('callbacks'), sa('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await Ka('callbacks'), sa('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await Ka('queue'), y('sla_risk'));
            break;
        case 'queue_waiting':
            (await Ka('queue'), y('waiting'));
            break;
        case 'queue_called':
            (await Ka('queue'), y('called'));
            break;
        case 'queue_no_show':
            (await Ka('queue'), y('no_show'));
            break;
        case 'queue_all':
            (await Ka('queue'), y('all'));
            break;
        case 'queue_call_next':
            (await Ka('queue'), await W(r().queue.stationConsultorio));
    }
}
async function oe(t = !1) {
    const a = await K();
    (!(function () {
        const t = r(),
            a = ba(t.data.availability || {}),
            e = fa(t.availability.selectedDate, a);
        (ka({
            draft: a,
            selectedDate: e,
            monthAnchor: ha(t.availability.monthAnchor, e),
            draftDirty: !1,
            lastAction: '',
        }),
            Da());
    })(),
        await X(),
        ht(r()),
        Ra(r()),
        Ft(),
        na(),
        (function () {
            const t = r(),
                a = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
                e = (function (t) {
                    return t.slice().sort((t, a) => ja(a) - ja(t));
                })(a),
                o = (function (t) {
                    return t.length
                        ? t.reduce((t, a) => t + Number(a.rating || 0), 0) /
                              t.length
                        : 0;
                })(a),
                l = a.filter((t) => Number(t.rating || 0) >= 5).length,
                c = (function (t, a = 30) {
                    const e = Date.now();
                    return t.filter((t) => {
                        const n = ja(t);
                        return !!n && e - n <= 24 * a * 60 * 60 * 1e3;
                    }).length;
                })(a),
                u = (function (t) {
                    return t.filter((t) => Number(t.rating || 0) <= 3).length;
                })(a),
                p = (function (t) {
                    const a = t.find((t) => Number(t.rating || 0) <= 3);
                    if (a)
                        return {
                            item: a,
                            eyebrow: 'Feedback accionable',
                            summary:
                                'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
                        };
                    const e = t.find((t) => Number(t.rating || 0) >= 5);
                    return e
                        ? {
                              item: e,
                              eyebrow: 'Senal a repetir',
                              summary:
                                  'Usa este comentario como referencia del recorrido que conviene proteger.',
                          }
                        : t[0]
                          ? {
                                item: t[0],
                                eyebrow: 'Ultima voz',
                                summary:
                                    'Es la resena mas reciente dentro del corte actual.',
                            }
                          : {
                                item: null,
                                eyebrow: 'Sin spotlight',
                                summary:
                                    'Cuando entren resenas apareceran aqui con lectura prioritaria.',
                            };
                })(e);
            if (
                (n('#reviewsAverageRating', o.toFixed(1)),
                n('#reviewsFiveStarCount', l),
                n('#reviewsRecentCount', c),
                n('#reviewsTotalCount', a.length),
                n(
                    '#reviewsSentimentLabel',
                    (function (t, a, e) {
                        return a
                            ? e > 0 && t < 4
                                ? 'Atencion requerida'
                                : t >= 4.7
                                  ? 'Confianza alta'
                                  : t >= 4.2
                                    ? 'Tono solido'
                                    : t >= 3.5
                                      ? 'Lectura mixta'
                                      : 'Atencion requerida'
                            : 'Sin senal suficiente';
                    })(o, a.length, u)
                ),
                i(
                    '#reviewsSummaryRail',
                    (function (t, a, e) {
                        const n = t[0],
                            i = n ? d(n.date || n.createdAt || '') : '-',
                            o = n ? String(n.name || 'Anonimo') : 'Sin datos';
                        return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${s(o)}</strong>\n            <small>${s(i)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${s(String(a))} en 30 dias</strong>\n            <small>Volumen reciente de feedback.</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Riesgo</span>\n            <strong>${s(e > 0 ? `${e} por revisar` : 'Sin alertas')}</strong>\n            <small>${s(e > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>\n        </article>\n    `;
                    })(e, c, u)
                ),
                !a.length)
            )
                return (
                    i(
                        '#reviewsSpotlight',
                        '\n                <div class="reviews-empty-state" data-admin-empty-state="reviews">\n                    <strong>Sin feedback reciente</strong>\n                    <p>No hay resenas registradas todavia.</p>\n                </div>\n            '
                    ),
                    void i(
                        '#reviewsGrid',
                        '\n                <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">\n                    <strong>No hay resenas registradas.</strong>\n                    <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>\n                </div>\n            '
                    )
                );
            if (p.item) {
                const t = p.item;
                i(
                    '#reviewsSpotlight',
                    `\n                <article class="reviews-spotlight-card">\n                    <div class="reviews-spotlight-top">\n                        <span class="review-avatar">${s(Va(t.name || 'Anonimo'))}</span>\n                        <div>\n                            <small>${s(p.eyebrow)}</small>\n                            <strong>${s(t.name || 'Anonimo')}</strong>\n                            <small>${s(d(t.date || t.createdAt || ''))}</small>\n                        </div>\n                    </div>\n                    <p class="reviews-spotlight-stars">${s(za(t.rating))}</p>\n                    <p>${s(Ua(t.comment || t.review || '', 320))}</p>\n                    <small>${s(p.summary)}</small>\n                </article>\n            `
                );
            } else
                i(
                    '#reviewsSpotlight',
                    `\n                <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">\n                    <strong>Sin spotlight disponible</strong>\n                    <p>${s(p.summary)}</p>\n                </div>\n            `
                );
            const m = e
                .map((t) =>
                    (function (t, { featured: a = !1 } = {}) {
                        const e = Number(t.rating || 0),
                            n =
                                e >= 5
                                    ? 'success'
                                    : e <= 3
                                      ? 'danger'
                                      : 'neutral',
                            i =
                                e >= 5
                                    ? 'Resena de alta confianza'
                                    : e <= 3
                                      ? 'Revisar posible friccion'
                                      : 'Resena util para contexto';
                        return `\n        <article class="review-card${a ? ' is-featured' : ''}" data-rating="${s(String(e))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${s(Va(t.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${s(t.name || 'Anonimo')}</strong>\n                        <small>${s(d(t.date || t.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${s(n)}">${s(za(e))}</span>\n            </header>\n            <p>${s(Ua(t.comment || t.review || ''))}</p>\n            <small>${s(i)}</small>\n        </article>\n    `;
                    })(t, {
                        featured:
                            p.item &&
                            Oa(t.name) === Oa(p.item.name) &&
                            ja(t) === ja(p.item),
                    })
                )
                .join('');
            i('#reviewsGrid', m);
        })(),
        Da(),
        at(),
        Ya(),
        t &&
            f(
                a ? 'Datos actualizados' : 'Datos cargados desde cache local',
                a ? 'success' : 'warning'
            ));
}
function re(t) {
    const a = String(t || '')
        .trim()
        .toLowerCase();
    return a
        ? a.includes('callbacks') && a.includes('pend')
            ? 'callbacks_pending'
            : a.includes('callback') && (a.includes('urg') || a.includes('sla'))
              ? 'callbacks_sla_urgent'
              : a.includes('citas') && a.includes('transfer')
                ? 'appointments_pending_transfer'
                : a.includes('queue') || a.includes('cola')
                  ? 'queue_sla_risk'
                  : a.includes('no show')
                    ? 'appointments_no_show'
                    : null
        : null;
}
async function le(a, e) {
    switch (a) {
        case 'close-toast':
            return void e.closest('.toast')?.remove();
        case 'set-admin-theme':
            return void Wa(String(e.dataset.themeMode || 'system'), {
                persist: !0,
            });
        case 'toggle-sidebar-collapse':
            return void Xa();
        case 'refresh-admin-data':
            return void (await oe(!0));
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const a = re(t.value);
                a && (await se(a), (t.value = ''), dt());
            }
            return;
        }
        case 'open-command-palette':
            return (ct(), void ne());
        case 'close-command-palette':
            return void dt();
        case 'logout':
            return (
                await Y(),
                rt(),
                dt(),
                Za(),
                void f('Sesion cerrada', 'info')
            );
        case 'reset-login-2fa':
            return (
                o((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                pt(!1),
                gt(),
                mt({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                void vt('password')
            );
        case 'appointment-quick-filter':
            return void Ht(String(e.dataset.filterValue || 'all'));
        case 'clear-appointment-filters':
            return void It({ filter: 'all', search: '' });
        case 'appointment-density':
            return void It({
                density:
                    'compact' === wt(String(e.dataset.density || 'comfortable'))
                        ? 'compact'
                        : 'comfortable',
            });
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await jt(t, { paymentStatus: 'paid' }),
                        Ot(t, { paymentStatus: 'paid' }));
                })(Number(e.dataset.id || 0)),
                void f('Transferencia aprobada', 'success')
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await jt(t, { paymentStatus: 'failed' }),
                        Ot(t, { paymentStatus: 'failed' }));
                })(Number(e.dataset.id || 0)),
                void f('Transferencia rechazada', 'warning')
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await jt(t, { status: 'no_show' }),
                        Ot(t, { status: 'no_show' }));
                })(Number(e.dataset.id || 0)),
                void f('Marcado como no show', 'warning')
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await jt(t, { status: 'cancelled' }),
                        Ot(t, { status: 'cancelled' }));
                })(Number(e.dataset.id || 0)),
                void f('Cita cancelada', 'warning')
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
                        ...(r().data.appointments || []).map((t) => [
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
                    a = new Blob([t], { type: 'text/csv;charset=utf-8' }),
                    e = URL.createObjectURL(a),
                    n = document.createElement('a');
                ((n.href = e),
                    (n.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
                    document.body.appendChild(n),
                    n.click(),
                    n.remove(),
                    URL.revokeObjectURL(e));
            })();
        case 'callback-quick-filter':
            return void sa(String(e.dataset.filterValue || 'all'));
        case 'clear-callback-filters':
            return void ia({
                filter: 'all',
                sort: 'recent_desc',
                search: '',
                selected: [],
            });
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await Ka('callbacks'),
                sa('pending'),
                void (function () {
                    const t = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    t instanceof HTMLElement && t.focus();
                })()
            );
        case 'mark-contacted':
            return (
                await oa(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.callbackDate || '')
                ),
                void f('Callback actualizado', 'success')
            );
        case 'change-month':
            return void (function (t) {
                const a = Number(t || 0);
                if (!Number.isFinite(a) || 0 === a) return;
                const e = ha(
                    r().availability.monthAnchor,
                    r().availability.selectedDate
                );
                (e.setMonth(e.getMonth() + a),
                    ka({ monthAnchor: e, lastAction: '' }, { render: !0 }));
            })(Number(e.dataset.delta || 0));
        case 'availability-today':
        case 'context-availability-today':
            return void Ta(u(new Date()), 'Hoy');
        case 'availability-prev-with-slots':
            return void (function () {
                const t = Ea(-1);
                t
                    ? Ta(t, `Fecha previa con slots: ${t}`)
                    : wa('No hay fechas anteriores con slots');
            })();
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return void (function () {
                const t = Ea(1);
                t
                    ? Ta(t, `Siguiente fecha con slots: ${t}`)
                    : wa('No hay fechas siguientes con slots');
            })();
        case 'select-availability-day':
            return void (function (t) {
                const a = ua(t);
                a &&
                    ka(
                        {
                            selectedDate: a,
                            monthAnchor: ha(a, a),
                            lastAction: '',
                        },
                        { render: !0 }
                    );
            })(String(e.dataset.date || ''));
        case 'prefill-time-slot':
            return void (function (a) {
                if ($a()) return;
                const e = t('#newSlotTime');
                e instanceof HTMLInputElement && ((e.value = ca(a)), e.focus());
            })(String(e.dataset.time || ''));
        case 'add-time-slot':
            return void (function () {
                if ($a()) return;
                const a = t('#newSlotTime');
                if (!(a instanceof HTMLInputElement)) return;
                const e = ca(a.value);
                if (!e) return;
                const n = r(),
                    i = ua(n.availability.selectedDate) || La();
                i &&
                    (Ca(
                        i,
                        [
                            ...(Array.isArray(n.availability.draft[i])
                                ? n.availability.draft[i]
                                : []),
                            e,
                        ],
                        `Slot ${e} agregado en ${i}`
                    ),
                    (a.value = ''));
            })();
        case 'remove-time-slot':
            return void (function (t, a) {
                if ($a()) return;
                const e = ua(t);
                if (!e) return;
                const n = r(),
                    i = Array.isArray(n.availability.draft[e])
                        ? n.availability.draft[e]
                        : [],
                    s = ca(a);
                Ca(
                    e,
                    i.filter((t) => ca(t) !== s),
                    `Slot ${s || '-'} removido en ${e}`
                );
            })(
                decodeURIComponent(String(e.dataset.date || '')),
                decodeURIComponent(String(e.dataset.time || ''))
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return void (function () {
                if ($a()) return;
                const t = r(),
                    a = ua(t.availability.selectedDate) || La(),
                    e = Array.isArray(t.availability.draft[a])
                        ? da(t.availability.draft[a])
                        : [];
                ka(
                    {
                        clipboard: e,
                        clipboardDate: a,
                        lastAction: e.length
                            ? `Portapapeles: ${e.length} slots (${a})`
                            : 'Portapapeles vacio',
                    },
                    { render: !0 }
                );
            })();
        case 'paste-availability-day':
            return void (function () {
                if ($a()) return;
                const t = r(),
                    a = Array.isArray(t.availability.clipboard)
                        ? da(t.availability.clipboard)
                        : [];
                if (!a.length) return void wa('Portapapeles vacio');
                const e = ua(t.availability.selectedDate) || La();
                Ca(e, a, `Pegado ${a.length} slots en ${e}`);
            })();
        case 'duplicate-availability-day-next':
            return void Ma(1);
        case 'duplicate-availability-next-week':
            return void Ma(7);
        case 'clear-availability-day':
            return void (function () {
                if ($a()) return;
                const t = ua(r().availability.selectedDate) || La();
                t &&
                    window.confirm(
                        `Se eliminaran los slots del dia ${t}. Continuar?`
                    ) &&
                    Ca(t, [], `Dia ${t} limpiado`);
            })();
        case 'clear-availability-week':
            return void (function () {
                if ($a()) return;
                const t = ua(r().availability.selectedDate) || La();
                if (!t) return;
                const a = (function (t) {
                    const a = pa(t);
                    if (!a) return null;
                    const e = (a.getDay() + 6) % 7,
                        n = new Date(a);
                    n.setDate(a.getDate() - e);
                    const i = new Date(n);
                    return (i.setDate(n.getDate() + 6), { start: n, end: i });
                })(t);
                if (!a) return;
                const e = u(a.start),
                    n = u(a.end);
                if (
                    !window.confirm(
                        `Se eliminaran los slots de la semana ${e} a ${n}. Continuar?`
                    )
                )
                    return;
                const i = Aa();
                for (let t = 0; t < 7; t += 1) {
                    const e = new Date(a.start);
                    (e.setDate(a.start.getDate() + t), delete i[u(e)]);
                }
                Sa(i, {
                    selectedDate: t,
                    lastAction: `Semana limpiada (${e} - ${n})`,
                });
            })();
        case 'save-availability-draft':
            return (
                await (async function () {
                    if ($a()) return;
                    const t = Aa(),
                        a = await l('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        e =
                            a?.data && 'object' == typeof a.data
                                ? ba(a.data)
                                : t,
                        n =
                            a?.meta && 'object' == typeof a.meta
                                ? a.meta
                                : null;
                    (o((t) => ({
                        ...t,
                        data: {
                            ...t.data,
                            availability: e,
                            availabilityMeta: n
                                ? { ...t.data.availabilityMeta, ...n }
                                : t.data.availabilityMeta,
                        },
                        availability: {
                            ...t.availability,
                            draft: e,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        Da());
                })(),
                void f('Disponibilidad guardada', 'success')
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if ($a()) return;
                    const t = r();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const a = ba(t.data.availability || {}),
                        e = fa(t.availability.selectedDate, a);
                    ka(
                        {
                            draft: a,
                            selectedDate: e,
                            monthAnchor: ha(t.availability.monthAnchor, e),
                            draftDirty: !1,
                            lastAction: 'Borrador descartado',
                        },
                        { render: !0 }
                    );
                })(),
                void f('Borrador descartado', 'info')
            );
        case 'queue-refresh-state':
            return void (await J());
        case 'queue-call-next':
            return void (await W(Number(e.dataset.queueConsultorio || 0)));
        case 'queue-release-station':
            return void (await G(Number(e.dataset.queueConsultorio || 0)));
        case 'queue-toggle-ticket-select':
            return void Q(Number(e.dataset.queueId || 0));
        case 'queue-select-visible':
            return void U();
        case 'queue-clear-selection':
            return void V();
        case 'queue-ticket-action':
            return void (await z(
                Number(e.dataset.queueId || 0),
                String(e.dataset.queueAction || ''),
                Number(e.dataset.queueConsultorio || 0)
            ));
        case 'queue-reprint-ticket':
            return void (await j(Number(e.dataset.queueId || 0)));
        case 'queue-bulk-action':
            return void (await O(String(e.dataset.queueAction || 'no_show')));
        case 'queue-bulk-reprint':
            return void (await R());
        case 'queue-clear-search':
            return void H();
        case 'queue-toggle-shortcuts':
            return void I();
        case 'queue-toggle-one-tap':
            return void F();
        case 'queue-start-practice':
            return void P(!0);
        case 'queue-stop-practice':
            return void P(!1);
        case 'queue-lock-station':
            return void N(Number(e.dataset.queueConsultorio || 1));
        case 'queue-set-station-mode':
            return void B(String(e.dataset.queueMode || 'free'));
        case 'queue-sensitive-confirm':
            return void (await x());
        case 'queue-sensitive-cancel':
            return void M();
        case 'queue-capture-call-key':
            return void _();
        case 'queue-clear-call-key':
            return void D();
        case 'callbacks-bulk-select-visible':
            return void ia(
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
            return void ia({ selected: [] }, { persist: !1 });
        case 'callbacks-bulk-mark':
            return void (await (async function () {
                const t = (r().callbacks.selected || [])
                    .map((t) => Number(t || 0))
                    .filter((t) => t > 0);
                for (const a of t)
                    try {
                        await oa(a);
                    } catch (t) {}
            })());
        case 'context-open-appointments-transfer':
            return (await Ka('appointments'), void Ht('pending_transfer'));
        case 'context-open-callbacks-pending':
            return (await Ka('callbacks'), void sa('pending'));
        case 'context-open-dashboard':
            return void (await Ka('dashboard'));
    }
}
async function ce(t) {
    t.preventDefault();
    const a = document.getElementById('adminPassword'),
        e = document.getElementById('admin2FACode'),
        n = a instanceof HTMLInputElement ? a.value : '',
        i = e instanceof HTMLInputElement ? e.value : '';
    try {
        bt(!0);
        const t = r();
        if (
            (mt({
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
            await q(i);
        else if ((await T(n)).requires2FA)
            return (
                pt(!0),
                mt({
                    tone: 'warning',
                    title: 'Codigo 2FA requerido',
                    message:
                        'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                }),
                void vt('2fa')
            );
        (mt({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            lt(),
            dt(),
            pt(!1),
            gt({ clearPassword: !0 }),
            await oe(!1),
            f('Sesion iniciada', 'success'));
    } catch (t) {
        (mt({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            vt(r().auth.requires2FA ? '2fa' : 'password'),
            f(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        bt(!1);
    }
}
async function de() {
    (!(function () {
        const e = t('#loginScreen'),
            n = t('#adminDashboard');
        if (!(e instanceof HTMLElement && n instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((e.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${a('sun')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${a('moon')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${a('system')}</button>\n                </div>\n            </section>\n        </div>\n    `),
            (n.innerHTML = `\n        <div class="admin-v3-shell">\n            <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n                <header class="sidebar-header">\n                    <div class="admin-v3-sidebar__brand">\n                        <strong>Piel en Armonia</strong>\n                        <small>Admin sony_v3</small>\n                    </div>\n                    <div class="toolbar-group">\n                        <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${a('menu')}</button>\n                        <button type="button" id="adminMenuClose">Cerrar</button>\n                    </div>\n                </header>\n                <nav class="sidebar-nav" id="adminSidebarNav">\n                    ${ot('dashboard', 'Dashboard', 'dashboard', !0)}\n                    ${ot('appointments', 'Citas', 'appointments')}\n                    ${ot('callbacks', 'Callbacks', 'callbacks')}\n                    ${ot('reviews', 'Resenas', 'reviews')}\n                    ${ot('availability', 'Disponibilidad', 'availability')}\n                    ${ot('queue', 'Turnero Sala', 'queue')}\n                </nav>\n                <footer class="sidebar-footer">\n                    <button type="button" class="logout-btn" data-action="logout">${a('logout')}<span>Cerrar sesion</span></button>\n                </footer>\n            </aside>\n            <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n            <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n                <header class="admin-v3-topbar">\n                    <div class="admin-v3-topbar__copy">\n                        <p class="sony-kicker">Sony V3</p>\n                        <h2 id="pageTitle">Dashboard</h2>\n                    </div>\n                    <div class="admin-v3-topbar__actions">\n                        <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${a('menu')}<span>Menu</span></button>\n                        <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                        <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                        <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${a('sun')}</button>\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${a('moon')}</button>\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${a('system')}</button>\n                        </div>\n                    </div>\n                </header>\n\n                <section class="admin-v3-context-strip" id="adminProductivityStrip">\n                    <div class="admin-v3-context-copy" data-admin-section-hero>\n                        <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                        <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                        <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="admin-v3-status-rail" data-admin-priority-rail>\n                        <article class="sony-status-tile">\n                            <span>Push</span>\n                            <strong id="pushStatusIndicator">Inicializando</strong>\n                            <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                        </article>\n                        <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                            <span>Sesion</span>\n                            <strong id="adminSessionState">No autenticada</strong>\n                            <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                        </article>\n                        <article class="sony-status-tile">\n                            <span>Sincronizacion</span>\n                            <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                            <small id="adminSyncState">Listo para primera sincronizacion</small>\n                        </article>\n                    </div>\n                </section>\n\n                \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Resumen diario</p>\n                        <h3>Prioridades de hoy</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda clinica</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">SLA telefonico</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n            </main>\n\n            <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n                <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n                <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                    <div class="admin-command-dialog__head">\n                        <div>\n                            <p class="sony-kicker">Command Palette</p>\n                            <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                        </div>\n                        <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                    </div>\n                    <div class="admin-command-box">\n                        <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                        <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                    </div>\n                    <div class="admin-command-dialog__hints">\n                        <span>Ctrl+K abre esta paleta</span>\n                        <span>/ enfoca la busqueda de la seccion activa</span>\n                    </div>\n                </div>\n            </div>\n        </div>\n    `));
    })(),
        (function () {
            const a = t('#adminMainContent');
            (a instanceof HTMLElement &&
                a.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(ft).forEach(([t, a]) => {
                    (yt(t, a.hero, 'data-admin-section-hero'),
                        yt(t, a.priority, 'data-admin-priority-rail'),
                        yt(t, a.workbench, 'data-admin-workbench'),
                        yt(t, a.detail, 'data-admin-detail-rail'));
                }));
        })(),
        document.body.classList.add('admin-v3-mode'),
        document.body.classList.remove('admin-v2-mode'),
        (function () {
            (document.addEventListener('click', async (t) => {
                const a =
                    t.target instanceof Element
                        ? t.target.closest('[data-action]')
                        : null;
                if (!a) return;
                const e = String(a.getAttribute('data-action') || '');
                if (e) {
                    t.preventDefault();
                    try {
                        await le(e, a);
                    } catch (t) {
                        f(t?.message || 'Error ejecutando accion', 'error');
                    }
                }
            }),
                document.addEventListener('click', async (t) => {
                    const a =
                        t.target instanceof Element
                            ? t.target.closest('[data-section]')
                            : null;
                    if (!a) return;
                    const e = a.classList.contains('admin-quick-nav-item'),
                        n = a.classList.contains('nav-item');
                    (e || n) &&
                        (t.preventDefault(),
                        await Ka(
                            String(
                                a.getAttribute('data-section') || 'dashboard'
                            )
                        ),
                        window.matchMedia('(max-width: 1024px)').matches &&
                            ae());
                }),
                document.addEventListener('click', (t) => {
                    const a =
                        t.target instanceof Element
                            ? t.target.closest('[data-queue-filter]')
                            : null;
                    a &&
                        (t.preventDefault(),
                        y(
                            String(a.getAttribute('data-queue-filter') || 'all')
                        ));
                }));
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const a = document.getElementById('callbacksBulkClearBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-clear');
            const e = document.getElementById('callbacksBulkMarkBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = 'datetime_desc',
                a = 'comfortable';
            try {
                ((t = JSON.parse(
                    localStorage.getItem(kt) || '"datetime_desc"'
                )),
                    (a = JSON.parse(
                        localStorage.getItem(St) || '"comfortable"'
                    )));
            } catch (t) {}
            o((e) => ({
                ...e,
                appointments: {
                    ...e.appointments,
                    sort: 'string' == typeof t ? t : 'datetime_desc',
                    density: 'string' == typeof a ? a : 'comfortable',
                },
            }));
        })(),
        (function () {
            let t = 'all',
                a = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(Vt) || '"all"')),
                    (a = JSON.parse(
                        localStorage.getItem(zt) || '"recent_desc"'
                    )));
            } catch (t) {}
            o((e) => ({
                ...e,
                callbacks: { ...e.callbacks, filter: Wt(t), sort: Jt(a) },
            }));
        })(),
        (function () {
            let t = '',
                a = '';
            try {
                ((t = String(localStorage.getItem(ra) || '')),
                    (a = String(localStorage.getItem(la) || '')));
            } catch (t) {}
            const e = ua(t),
                n = ha(a, e);
            o((t) => ({
                ...t,
                availability: {
                    ...t.availability,
                    ...(e ? { selectedDate: e } : {}),
                    monthAnchor: n,
                },
            }));
        })(),
        (function () {
            const t = k(S(Qa, 'dashboard')),
                a = '1' === S(Ga, '0');
            (o((e) => ({
                ...e,
                ui: {
                    ...e.ui,
                    activeSection: t,
                    sidebarCollapsed: a,
                    sidebarOpen: !1,
                },
            })),
                ut(t),
                w(t),
                ee());
        })(),
        m(),
        Wa(b()),
        Za(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    Ht(t.value);
                });
            const a = document.getElementById('appointmentSort');
            a instanceof HTMLSelectElement &&
                a.addEventListener('change', () => {
                    It({ sort: wt(a.value) || 'datetime_desc' });
                });
            const e = document.getElementById('searchAppointments');
            e instanceof HTMLInputElement &&
                e.addEventListener('input', () => {
                    Rt(e.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    sa(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    ia({ sort: Jt(i.value), selected: [] });
                });
            const s = document.getElementById('searchCallbacks');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        ia({ search: String(t || ''), selected: [] }));
                });
            const o = document.getElementById('queueSearchInput');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    $(o.value);
                });
            const r = document.getElementById('adminQuickCommand');
            r instanceof HTMLInputElement &&
                r.addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const a = re(r.value);
                    a && (await se(a));
                });
        })(),
        (function () {
            const a = t('#adminMenuToggle'),
                e = t('#adminMenuClose'),
                n = t('#adminSidebarBackdrop');
            (a?.addEventListener('click', () => {
                window.matchMedia('(max-width: 1024px)').matches ? te() : Xa();
            }),
                e?.addEventListener('click', () => ae()),
                n?.addEventListener('click', () => ae()),
                window.addEventListener('resize', () => {
                    window.matchMedia('(max-width: 1024px)').matches
                        ? ee()
                        : ae();
                }),
                window.addEventListener('hashchange', async () => {
                    const t = L(r().ui.activeSection);
                    await Ka(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && Wa(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            _a() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const e = document.getElementById('loginForm');
    (e instanceof HTMLFormElement && e.addEventListener('submit', ce),
        g({
            navigateToSection: Ka,
            focusQuickCommand: ne,
            focusCurrentSearch: ie,
            runQuickAction: se,
            closeSidebar: ae,
            toggleMenu: () => {
                window.matchMedia('(max-width: 1024px)').matches ? te() : Xa();
            },
            dismissQueueSensitiveDialog: nt,
            toggleQueueHelp: () => I(),
            queueNumpadAction: et,
        }),
        (await v())
            ? await (async function () {
                  (lt(), dt(), await oe(!1), ut(r().ui.activeSection));
              })()
            : (rt(), dt(), Za()),
        h(),
        window.setInterval(() => {
            Ya();
        }, 3e4));
}
const ue = (
    'loading' === document.readyState
        ? new Promise((t, a) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      de().then(t).catch(a);
                  },
                  { once: !0 }
              );
          })
        : de()
).catch((t) => {
    throw (console.error('admin-v3 boot failed', t), t);
});
export { ue as default };
