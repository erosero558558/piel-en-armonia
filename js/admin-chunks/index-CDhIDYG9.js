import {
    q as t,
    i as a,
    a as n,
    s as e,
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
    n as y,
    o as f,
    p as S,
    v as k,
    w,
    x as C,
    y as A,
    z as q,
    A as L,
    B as $,
    C as T,
    D,
    E,
    F as M,
    G as B,
    H as x,
    I as N,
    J as _,
    K as F,
    L as P,
    M as I,
    N as H,
    O as R,
    P as O,
    Q as j,
    R as z,
    S as V,
    T as U,
    U as Q,
    V as W,
    W as G,
    X as J,
    Y,
    Z,
    _ as K,
    $ as X,
    a0 as tt,
    a1 as at,
    a2 as nt,
    a3 as et,
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
function ot(t, a, n, e = !1) {
    return `\n        <button\n            type="button"\n            class="admin-quick-nav-item${e ? ' active' : ''}"\n            data-section="${t}"\n            aria-pressed="${e ? 'true' : 'false'}"\n        >\n            <span>${a}</span>\n            <span class="admin-quick-nav-shortcut">${n}</span>\n        </button>\n    `;
}
function rt(t, n, e, i = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${i ? ' active' : ''}"\n            data-section="${t}"\n            ${i ? 'aria-current="page"' : ''}\n        >\n            ${a(e)}\n            <span>${n}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function lt() {
    const a = t('#loginScreen'),
        n = t('#adminDashboard');
    (a && a.classList.remove('is-hidden'), n && n.classList.add('is-hidden'));
}
function ct() {
    const a = t('#loginScreen'),
        n = t('#adminDashboard');
    (a && a.classList.add('is-hidden'), n && n.classList.remove('is-hidden'));
}
function dt(a) {
    (n('.admin-section').forEach((t) => {
        t.classList.toggle('active', t.id === a);
    }),
        n('.nav-item[data-section]').forEach((t) => {
            const n = t.dataset.section === a;
            (t.classList.toggle('active', n),
                n
                    ? t.setAttribute('aria-current', 'page')
                    : t.removeAttribute('aria-current'));
        }),
        n('.admin-quick-nav-item[data-section]').forEach((t) => {
            const n = t.dataset.section === a;
            (t.classList.toggle('active', n),
                t.setAttribute('aria-pressed', String(n)));
        }));
    const e = it[a] || 'Dashboard',
        i = t('#pageTitle');
    i && (i.textContent = e);
}
function ut(a) {
    const n = t('#group2FA'),
        e = t('#adminLoginStepSummary'),
        i = t('#adminLoginStepEyebrow'),
        s = t('#adminLoginStepTitle'),
        o = t('#adminLoginSupportCopy'),
        r = t('#loginReset2FABtn'),
        l = t('#loginForm');
    n &&
        (n.classList.toggle('is-hidden', !a),
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
        e &&
            (e.textContent = a
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        o &&
            (o.textContent = a
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        mt(!1));
}
function pt({
    tone: a = 'neutral',
    title: n = 'Proteccion activa',
    message: e = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = t('#adminLoginStatusCard'),
        s = t('#adminLoginStatusTitle'),
        o = t('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', a),
        s && (s.textContent = n),
        o && (o.textContent = e));
}
function mt(a) {
    const n = t('#loginBtn'),
        e = t('#loginReset2FABtn'),
        i = t('#adminPassword'),
        s = t('#admin2FACode'),
        o = t('#group2FA'),
        r = Boolean(o && !o.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(a) || r),
        s instanceof HTMLInputElement && (s.disabled = Boolean(a) || !r),
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(a)),
            (n.textContent = a
                ? r
                    ? 'Verificando...'
                    : 'Ingresando...'
                : r
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        e instanceof HTMLButtonElement && (e.disabled = Boolean(a)));
}
function bt({ clearPassword: a = !1 } = {}) {
    const n = t('#adminPassword'),
        e = t('#admin2FACode');
    (n instanceof HTMLInputElement && a && (n.value = ''),
        e instanceof HTMLInputElement && (e.value = ''));
}
function gt(a = 'password') {
    const n = t('2fa' === a ? '#admin2FACode' : '#adminPassword');
    n instanceof HTMLInputElement && (n.focus(), n.select?.());
}
function vt(a) {
    const n = st[a?.ui?.activeSection || 'dashboard'] || st.dashboard,
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
    (e('#adminSectionEyebrow', n.eyebrow),
        e('#adminContextTitle', n.title),
        e('#adminContextSummary', n.summary),
        i(
            '#adminContextActions',
            n.actions
                .map((t) =>
                    (function (t) {
                        return `\n        <button type="button" class="sony-context-action" ${[`data-action="${s(t.action)}"`, t.queueConsultorio ? `data-queue-consultorio="${s(t.queueConsultorio)}"` : '', t.filterValue ? `data-filter-value="${s(t.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${s(t.label)}</strong>\n                <small>${s(t.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${s(t.shortcut || '')}</span>\n        </button>\n    `;
                    })(t)
                )
                .join('')
        ),
        e(
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
    (e('#dashboardBadge', m + b),
        e('#appointmentsBadge', r.length),
        e('#callbacksBadge', b),
        e('#reviewsBadge', c.length),
        e('#availabilityBadge', g),
        e('#queueBadge', v));
    const h = t('#adminSessionTile'),
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
            (function (t) {
                const a = t && 'object' == typeof t ? t : {};
                if (a.authenticated) {
                    const t =
                            {
                                session: 'sesion restaurada',
                                password: 'clave validada',
                                '2fa': '2FA validado',
                            }[String(a.authMethod || '')] || 'acceso validado',
                        n = Number(a.lastAuthAt || 0);
                    return n
                        ? `Protegida por ${t}. ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${t}.`;
                }
                return a.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(o)
        ));
}
function ht(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function yt(t) {
    return (function (t) {
        const a = new Date(t || '');
        return Number.isNaN(a.getTime()) ? 0 : a.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function ft(t) {
    return ht(t.paymentStatus || t.payment_status || '');
}
function St(t) {
    return ht(t);
}
function kt(t, a = '-') {
    const n = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return n
        ? n
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : a;
}
function wt(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[ht(t)] || kt(t, 'Pendiente')
    );
}
function Ct(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[ht(t)] || kt(t, 'Pendiente')
    );
}
function At(t) {
    if (!t) return 'Sin fecha';
    const a = Math.round((t - Date.now()) / 6e4),
        n = Math.abs(a);
    return a < 0
        ? n < 60
            ? `Hace ${n} min`
            : n < 1440
              ? `Hace ${Math.round(n / 60)} h`
              : 'Ya ocurrio'
        : a < 60
          ? `En ${Math.max(a, 0)} min`
          : a < 1440
            ? `En ${Math.round(a / 60)} h`
            : `En ${Math.round(a / 1440)} d`;
}
function qt(t) {
    const a = yt(t);
    if (!a) return !1;
    const n = new Date(a),
        e = new Date();
    return (
        n.getFullYear() === e.getFullYear() &&
        n.getMonth() === e.getMonth() &&
        n.getDate() === e.getDate()
    );
}
function Lt(t) {
    const a = yt(t);
    if (!a) return !1;
    const n = a - Date.now();
    return n >= 0 && n <= 1728e5;
}
function $t(t) {
    const a = ft(t),
        n = St(t.status);
    return (
        'pending_transfer_review' === a ||
        'pending_transfer' === a ||
        'no_show' === n ||
        'cancelled' === n
    );
}
function Tt(t, a) {
    const n = ht(a);
    return 'pending_transfer' === n
        ? t.filter((t) => {
              const a = ft(t);
              return (
                  'pending_transfer_review' === a || 'pending_transfer' === a
              );
          })
        : 'upcoming_48h' === n
          ? t.filter(Lt)
          : 'no_show' === n
            ? t.filter((t) => 'no_show' === St(t.status))
            : 'triage_attention' === n
              ? t.filter($t)
              : t;
}
function Dt(t) {
    const a = t
        .filter((t) => Tt([t], 'pending_transfer').length > 0)
        .sort((t, a) => yt(t) - yt(a))[0];
    if (a)
        return {
            item: a,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y libera la agenda antes del check-in.',
            tags: ['Pago por validar', 'WhatsApp listo'],
        };
    const n = t
        .filter((t) => 'no_show' === St(t.status))
        .sort((t, a) => yt(t) - yt(a))[0];
    if (n)
        return {
            item: n,
            label: 'Incidencia abierta',
            hint: 'Confirma si requiere seguimiento o reprogramacion.',
            tags: ['No show', 'Seguimiento'],
        };
    const e = t.filter((t) => yt(t) > 0).sort((t, a) => yt(t) - yt(a))[0];
    return e
        ? {
              item: e,
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
function Et(t) {
    return t.length
        ? t
              .map((t) => {
                  const a = yt(t);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(t.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${s(t.name || 'Sin nombre')}</strong>\n                            <span>${s(t.email || 'Sin email')}</span>\n                            <small>${s(t.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">\n                        <div class="appointment-service">\n                            <strong>${s(kt(t.service, 'Servicio pendiente'))}</strong>\n                            <span>Especialista: ${s(kt(t.doctor, 'Sin asignar'))}</span>\n                            <small>${s(t.price || 'Sin tarifa')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${s(c(t.date))}</strong>\n                            <span>${s(t.time || '--:--')}</span>\n                            <small>${s(At(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      t
                  ) {
                      const a = t.paymentStatus || t.payment_status || '',
                          n = String(
                              t.transferProofUrl ||
                                  t.transferProofURL ||
                                  t.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${s(
                          (function (t) {
                              const a = ht(t);
                              return 'paid' === a
                                  ? 'success'
                                  : 'failed' === a
                                    ? 'danger'
                                    : 'pending_cash' === a
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${s(wt(a))}</span>\n            <small>Metodo: ${s(((e = t.paymentMethod || t.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[ht(e)] || kt(e, 'Metodo no definido')))}</small>\n            ${n ? `<a href="${s(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var e;
                  })(
                      t
                  )}</td>\n                    <td data-label="Estado">${(function (
                      t
                  ) {
                      const a = St(t.status),
                          n = [];
                      return (
                          'pending_transfer_review' === ft(t) &&
                              n.push('Transferencia en espera'),
                          'no_show' === a && n.push('Paciente ausente'),
                          'cancelled' === a && n.push('Bloqueo operativo'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${s(
                              (function (t) {
                                  const a = ht(t);
                                  return 'completed' === a
                                      ? 'success'
                                      : 'cancelled' === a || 'no_show' === a
                                        ? 'danger'
                                        : 'pending' === a
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${s(Ct(a))}</span>\n            <small>${s(n[0] || 'Sin alertas abiertas')}</small>\n        </div>\n    `
                      );
                  })(
                      t
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      t
                  ) {
                      const a = Number(t.id || 0);
                      return `\n        <div class="table-actions">\n            <a href="https://wa.me/${encodeURIComponent(String(t.phone || '').replace(/\s+/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp de ${s(t.name || 'Paciente')}" title="WhatsApp para validar pago">WhatsApp</a>\n            <button type="button" data-action="approve-transfer" data-id="${a}">Aprobar</button>\n            <button type="button" data-action="reject-transfer" data-id="${a}">Rechazar</button>\n            <button type="button" data-action="mark-no-show" data-id="${a}">No show</button>\n            <button type="button" data-action="cancel-appointment" data-id="${a}">Cancelar</button>\n            <button type="button" data-action="context-open-appointments-transfer">Triage</button>\n        </div>\n    `;
                  })(t)}</td>\n                </tr>\n            `;
              })
              .join('')
        : '<tr class="table-empty-row"><td colspan="6">No hay resultados</td></tr>';
}
function Mt() {
    const t = r(),
        a = Array.isArray(t.data.appointments) ? t.data.appointments : [],
        n = (function (t, a) {
            const n = ht(a),
                e = [...t];
            return 'patient_az' === n
                ? (e.sort((t, a) => ht(t.name).localeCompare(ht(a.name), 'es')),
                  e)
                : 'datetime_asc' === n
                  ? (e.sort((t, a) => yt(t) - yt(a)), e)
                  : (e.sort((t, a) => yt(a) - yt(t)), e);
        })(
            (function (t, a) {
                const n = ht(a);
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
                          ].some((t) => ht(t).includes(n))
                      )
                    : t;
            })(Tt(a, t.appointments.filter), t.appointments.search),
            t.appointments.sort
        );
    (i('#appointmentsTableBody', Et(n)),
        e('#appointmentsToolbarMeta', `Mostrando ${n.length} de ${a.length}`));
    const o = [];
    ('all' !== ht(t.appointments.filter) &&
        ('pending_transfer' === ht(t.appointments.filter)
            ? o.push('Transferencias por validar')
            : 'triage_attention' === ht(t.appointments.filter)
              ? o.push('Triage accionable')
              : 'upcoming_48h' === ht(t.appointments.filter)
                ? o.push('Proximas 48h')
                : 'no_show' === ht(t.appointments.filter)
                  ? o.push('No show')
                  : o.push(t.appointments.filter)),
        ht(t.appointments.search) &&
            o.push(`Busqueda: ${t.appointments.search}`),
        'patient_az' === ht(t.appointments.sort)
            ? o.push('Paciente (A-Z)')
            : 'datetime_asc' === ht(t.appointments.sort) &&
              o.push('Fecha ascendente'),
        0 !== n.length ||
            ('all' === ht(t.appointments.filter) &&
                !ht(t.appointments.search)) ||
            o.push('Resultados: 0'),
        e(
            '#appointmentsToolbarState',
            o.length ? o.join(' | ') : 'Sin filtros activos'
        ));
    const l = document.getElementById('clearAppointmentsFiltersBtn');
    if (l) {
        const a =
            'all' !== ht(t.appointments.filter) || ht(t.appointments.search);
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
            'compact' === ht(t.appointments.density)
        ),
        document
            .querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
            .forEach((a) => {
                const n = ht(a.dataset.density) === ht(t.appointments.density);
                a.classList.toggle('is-active', n);
            }),
        (function (t) {
            const a = ht(t);
            document
                .querySelectorAll(
                    '.appointment-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const n = ht(t.dataset.filterValue) === a;
                    t.classList.toggle('is-active', n);
                });
        })(t.appointments.filter),
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
        })(t.appointments),
        (function (t, a, n) {
            (e('#appointmentsOpsPendingTransfer', t.pendingTransferCount),
                e(
                    '#appointmentsOpsPendingTransferMeta',
                    t.pendingTransferCount > 0
                        ? `${t.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                e('#appointmentsOpsUpcomingCount', t.upcomingCount),
                e(
                    '#appointmentsOpsUpcomingMeta',
                    t.upcomingCount > 0
                        ? `${t.upcomingCount} cita(s) bajo ventana inmediata`
                        : 'Sin presion inmediata'
                ),
                e('#appointmentsOpsNoShowCount', t.noShowCount),
                e(
                    '#appointmentsOpsNoShowMeta',
                    t.noShowCount > 0
                        ? `${t.noShowCount} caso(s) requieren seguimiento`
                        : 'Sin incidencias'
                ),
                e('#appointmentsOpsTodayCount', t.todayCount),
                e(
                    '#appointmentsOpsTodayMeta',
                    t.todayCount > 0
                        ? `${t.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ));
            const o =
                n > 0
                    ? `${t.pendingTransferCount} transferencias, ${t.triageCount} frentes accionables y ${a} cita(s) visibles.`
                    : 'Sin citas cargadas.';
            (e('#appointmentsDeckSummary', o),
                e(
                    '#appointmentsWorkbenchHint',
                    t.pendingTransferCount > 0
                        ? 'Hay pagos por validar antes de liberar la agenda.'
                        : 'Triage, pagos y seguimiento sin salir de la mesa.'
                ));
            const r = document.getElementById('appointmentsDeckChip');
            r &&
                ((r.textContent =
                    t.pendingTransferCount > 0 || t.noShowCount > 0
                        ? 'Atencion operativa'
                        : 'Agenda estable'),
                r.setAttribute(
                    'data-state',
                    t.pendingTransferCount > 0 || t.noShowCount > 0
                        ? 'warning'
                        : 'success'
                ));
            const l = t.focus;
            if ((e('#appointmentsFocusLabel', l.label), !l.item))
                return (
                    e('#appointmentsFocusPatient', 'Sin citas activas'),
                    e(
                        '#appointmentsFocusMeta',
                        'Cuando entren citas accionables apareceran aqui.'
                    ),
                    e('#appointmentsFocusWindow', '-'),
                    e('#appointmentsFocusPayment', '-'),
                    e('#appointmentsFocusStatus', '-'),
                    e('#appointmentsFocusContact', '-'),
                    i('#appointmentsFocusTags', ''),
                    void e('#appointmentsFocusHint', l.hint)
                );
            const d = l.item;
            (e('#appointmentsFocusPatient', d.name || 'Sin nombre'),
                e(
                    '#appointmentsFocusMeta',
                    `${kt(d.service, 'Servicio pendiente')} | ${c(d.date)} ${d.time || '--:--'}`
                ),
                e('#appointmentsFocusWindow', At(yt(d))),
                e(
                    '#appointmentsFocusPayment',
                    wt(d.paymentStatus || d.payment_status)
                ),
                e('#appointmentsFocusStatus', Ct(d.status)),
                e('#appointmentsFocusContact', d.phone || 'Sin telefono'),
                i(
                    '#appointmentsFocusTags',
                    l.tags
                        .map(
                            (t) =>
                                `<span class="appointments-focus-tag">${s(t)}</span>`
                        )
                        .join('')
                ),
                e('#appointmentsFocusHint', l.hint));
        })(
            (function (t) {
                const a = Tt(t, 'pending_transfer'),
                    n = Tt(t, 'upcoming_48h'),
                    e = Tt(t, 'no_show'),
                    i = Tt(t, 'triage_attention'),
                    s = t.filter(qt);
                return {
                    pendingTransferCount: a.length,
                    upcomingCount: n.length,
                    noShowCount: e.length,
                    todayCount: s.length,
                    triageCount: i.length,
                    focus: Dt(t),
                };
            })(a),
            n.length,
            a.length
        ));
}
function Bt(t) {
    (o((a) => ({ ...a, appointments: { ...a.appointments, ...t } })), Mt());
}
function xt(t) {
    Bt({ filter: ht(t) || 'all' });
}
function Nt(t) {
    Bt({ search: String(t || '') });
}
function _t(t, a) {
    const n = Number(t || 0);
    (o((t) => {
        const e = (t.data.appointments || []).map((t) =>
            Number(t.id || 0) === n ? { ...t, ...a } : t
        );
        return { ...t, data: { ...t.data, appointments: e } };
    }),
        Mt());
}
async function Ft(t, a) {
    await l('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...a },
    });
}
const Pt = 'admin-callbacks-sort',
    It = 'admin-callbacks-filter',
    Ht = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Rt = new Set(['recent_desc', 'waiting_desc']);
function Ot(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function jt(t) {
    const a = Ot(t);
    return Ht.has(a) ? a : 'all';
}
function zt(t) {
    const a = Ot(t);
    return Rt.has(a) ? a : 'recent_desc';
}
function Vt(t) {
    const a = Ot(t);
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
function Ut(t) {
    const a = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(a.getTime()) ? 0 : a.getTime();
}
function Qt(t) {
    const a = Ut(t);
    return a ? Math.max(0, Math.round((Date.now() - a) / 6e4)) : 0;
}
function Wt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin teléfono').trim() ||
        'Sin teléfono'
    );
}
function Gt(t) {
    const a = new Date(t || '');
    if (Number.isNaN(a.getTime())) return !1;
    const n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function Jt(t) {
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
function Yt() {
    const t = r(),
        a = Array.isArray(t.data.callbacks) ? t.data.callbacks : [],
        n = (function (t, a) {
            const n = Ot(a);
            return n
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          Ot(t).includes(n)
                      )
                  )
                : t;
        })(
            (function (t, a) {
                const n = jt(a);
                return 'pending' === n || 'contacted' === n
                    ? t.filter((t) => Vt(t.status) === n)
                    : 'today' === n
                      ? t.filter((t) => Gt(t.fecha || t.createdAt))
                      : 'sla_urgent' === n
                        ? t.filter(
                              (t) => 'pending' === Vt(t.status) && Qt(t) >= 120
                          )
                        : t;
            })(a, t.callbacks.filter),
            t.callbacks.search
        ),
        o = (function (t, a) {
            const n = [...t];
            return 'waiting_desc' === zt(a)
                ? (n.sort((t, a) => Ut(t) - Ut(a)), n)
                : (n.sort((t, a) => Ut(a) - Ut(t)), n);
        })(n, t.callbacks.sort),
        l = new Set((t.callbacks.selected || []).map((t) => Number(t || 0)));
    (i(
        '#callbacksGrid',
        o.length
            ? o
                  .map((t) =>
                      (function (t, a) {
                          const n = Vt(t.status),
                              e =
                                  'pending' === n
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              i = 'pending' === n ? 'pendiente' : 'contactado',
                              o = Number(t.id || 0),
                              r = Wt(t),
                              l = Qt(t),
                              c = Jt(l);
                          return `\n        <article class="${e}${a ? ' is-selected' : ''}" data-callback-id="${o}" data-callback-status="${i}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${s('pending' === n ? c.tone : 'success')}">${'pending' === n ? 'Pendiente' : 'Contactado'}</span>\n                    <h4>${s(r)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${s(c.tone)}">${s(c.label)}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${s(t.preferencia || '-')}</strong></p>\n                <p><span>Fecha</span><strong>${s(d(t.fecha || t.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${l} min</strong></p>\n                <p><span>Estado</span><strong>${s('pending' === n ? 'Pendiente' : 'Contactado')}</strong></p>\n            </div>\n            <p class="callback-card-note">${s('pending' === n ? c.note : 'Callback resuelto y fuera de cola operativa.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${o}" data-callback-date="${s(t.fecha || '')}">Marcar contactado</button>\n            </div>\n        </article>\n    `;
                      })(t, l.has(Number(t.id || 0)))
                  )
                  .join('')
            : '<p class="callbacks-grid-empty">No hay callbacks para el filtro actual.</p>'
    ),
        e('#callbacksToolbarMeta', `Mostrando ${o.length} de ${a.length}`));
    const c = [];
    ('all' !== jt(t.callbacks.filter) &&
        c.push(
            'pending' === jt(t.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === jt(t.callbacks.filter)
                  ? 'Contactados'
                  : 'today' === jt(t.callbacks.filter)
                    ? 'Hoy'
                    : 'Urgentes SLA'
        ),
        Ot(t.callbacks.search) && c.push(`Busqueda: ${t.callbacks.search}`),
        'waiting_desc' === zt(t.callbacks.sort) &&
            c.push('Orden: Mayor espera (SLA)'),
        e(
            '#callbacksToolbarState',
            c.length ? c.join(' | ') : 'Sin filtros activos'
        ));
    const u = document.getElementById('callbackFilter');
    u instanceof HTMLSelectElement && (u.value = jt(t.callbacks.filter));
    const p = document.getElementById('callbackSort');
    p instanceof HTMLSelectElement && (p.value = zt(t.callbacks.sort));
    const m = document.getElementById('searchCallbacks');
    (m instanceof HTMLInputElement &&
        m.value !== t.callbacks.search &&
        (m.value = t.callbacks.search),
        (function (t) {
            const a = Ot(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const n = Ot(t.dataset.filterValue) === a;
                    t.classList.toggle('is-active', n);
                });
        })(t.callbacks.filter));
    const b = (function (t) {
        const a = t.filter((t) => 'pending' === Vt(t.status)),
            n = a.filter((t) => Qt(t) >= 120),
            e = a.slice().sort((t, a) => Ut(t) - Ut(a))[0];
        return {
            pendingCount: a.length,
            urgentCount: n.length,
            todayCount: t.filter((t) => Gt(t.fecha || t.createdAt)).length,
            next: e,
            queueHealth:
                n.length > 0
                    ? 'Cola: prioridad alta'
                    : a.length > 0
                      ? 'Cola: atención requerida'
                      : 'Cola: estable',
            queueState:
                n.length > 0 ? 'danger' : a.length > 0 ? 'warning' : 'success',
        };
    })(a);
    (e('#callbacksOpsPendingCount', b.pendingCount),
        e('#callbacksOpsUrgentCount', b.urgentCount),
        e('#callbacksOpsTodayCount', b.todayCount),
        e('#callbacksOpsQueueHealth', b.queueHealth));
    const g = document.getElementById('callbacksBulkSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === o.length);
    const v = document.getElementById('callbacksBulkClearBtn');
    v instanceof HTMLButtonElement && (v.disabled = 0 === l.size);
    const h = document.getElementById('callbacksBulkMarkBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === l.size),
        (function (t, a, n, i) {
            (e(
                '#callbacksDeckSummary',
                n > 0
                    ? `${t.pendingCount} pendiente(s), ${t.urgentCount} fuera de SLA y ${a} visibles.`
                    : 'Sin callbacks pendientes.'
            ),
                e(
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
            (e('#callbacksOpsNext', r ? Wt(r) : 'Sin teléfono'),
                e(
                    '#callbacksNextSummary',
                    r
                        ? `Prioriza ${Wt(r)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecerá aqui.'
                ),
                e('#callbacksNextWait', `${r ? Qt(r) : 0} min`),
                e('#callbacksNextPreference', (r && r.preferencia) || '-'),
                e('#callbacksNextState', r ? Jt(Qt(r)).label : 'Pendiente'));
            const l = document.getElementById('callbacksSelectionChip');
            (l && l.classList.toggle('is-hidden', 0 === i),
                e('#callbacksSelectedCount', i));
        })(b, o.length, a.length, l.size));
}
function Zt(t, { persist: a = !0 } = {}) {
    (o((a) => ({ ...a, callbacks: { ...a.callbacks, ...t } })),
        a &&
            (function (t) {
                try {
                    (localStorage.setItem(It, JSON.stringify(jt(t.filter))),
                        localStorage.setItem(Pt, JSON.stringify(zt(t.sort))));
                } catch (t) {}
            })(r().callbacks),
        Yt());
}
function Kt(t) {
    Zt({ filter: jt(t), selected: [] });
}
async function Xt(t, a = '') {
    const n = Number(t || 0);
    n <= 0 ||
        (await l('callbacks', {
            method: 'PATCH',
            body: { id: n, status: 'contacted', fecha: a },
        }),
        (function (t) {
            const a = Number(t || 0);
            (o((t) => {
                const n = (t.data.callbacks || []).map((t) =>
                    Number(t.id || 0) === a ? { ...t, status: 'contacted' } : t
                );
                return {
                    ...t,
                    data: { ...t.data, callbacks: n },
                    callbacks: {
                        ...t.callbacks,
                        selected: (t.callbacks.selected || []).filter(
                            (t) => Number(t || 0) !== a
                        ),
                    },
                };
            }),
                Yt());
        })(n));
}
const ta = 'admin-availability-selected-date',
    aa = 'admin-availability-month-anchor';
function na(t) {
    const a = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return a ? `${a[1]}:${a[2]}` : '';
}
function ea(t) {
    return [...new Set(t.map(na).filter(Boolean))].sort();
}
function ia(t) {
    const a = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return '';
    const n = new Date(`${a}T12:00:00`);
    return Number.isNaN(n.getTime()) ? '' : u(n) === a ? a : '';
}
function sa(t) {
    const a = ia(t);
    if (!a) return null;
    const n = new Date(`${a}T12:00:00`);
    return Number.isNaN(n.getTime()) ? null : n;
}
function oa(t) {
    const a = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((n) => {
                const e = ia(n);
                if (!e) return;
                const i = ea(Array.isArray(t[n]) ? t[n] : []);
                i.length && (a[e] = i);
            }),
        a
    );
}
function ra(t) {
    return oa(t || {});
}
function la(t) {
    return JSON.stringify(oa(t || {}));
}
function ca(t) {
    const a = ra(r().data.availability || {});
    return la(t) !== la(a);
}
function da(t, a = '') {
    let n = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) n = new Date(t);
    else {
        const a = ia(t);
        a && (n = new Date(`${a}T12:00:00`));
    }
    if (!n) {
        const t = sa(a);
        n = t ? new Date(t) : new Date();
    }
    return (n.setDate(1), n.setHours(12, 0, 0, 0), n);
}
function ua(t, a) {
    const n = ia(t);
    if (n) return n;
    const e = Object.keys(a || {})[0];
    if (e) {
        const t = ia(e);
        if (t) return t;
    }
    return u(new Date());
}
function pa() {
    const t = r(),
        a = ia(t.availability.selectedDate),
        n = da(t.availability.monthAnchor, a);
    try {
        (a ? localStorage.setItem(ta, a) : localStorage.removeItem(ta),
            localStorage.setItem(aa, u(n)));
    } catch (t) {}
}
function ma(t, { render: a = !1 } = {}) {
    (o((a) => ({ ...a, availability: { ...a.availability, ...t } })),
        a ? wa() : pa());
}
function ba(t, a = {}) {
    const n = ra(t),
        e = ua(a.selectedDate || r().availability.selectedDate, n);
    ma(
        {
            draft: n,
            selectedDate: e,
            monthAnchor: da(a.monthAnchor || r().availability.monthAnchor, e),
            draftDirty: ca(n),
            ...a,
        },
        { render: !0 }
    );
}
function ga(t) {
    ma({ lastAction: String(t || '') }, { render: !0 });
}
function va(t, a, n = '') {
    const e = ia(t) || fa();
    if (!e) return;
    const i = ha(),
        s = ea(Array.isArray(a) ? a : []);
    (s.length ? (i[e] = s) : delete i[e],
        ba(i, { selectedDate: e, monthAnchor: e, lastAction: n }));
}
function ha() {
    return ra(r().availability.draft || {});
}
function ya() {
    const t = r().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function fa() {
    const t = r(),
        a = ia(t.availability.selectedDate);
    if (a) return a;
    const n = ra(t.availability.draft || {});
    return Object.keys(n)[0] || u(new Date());
}
function Sa(t, a) {
    const n = ia(t);
    n &&
        ma(
            { selectedDate: n, monthAnchor: da(n, n), lastAction: a || '' },
            { render: !0 }
        );
}
function ka(t = 1) {
    const a = ha(),
        n = Object.keys(a).filter((t) => a[t]?.length > 0);
    if (!n.length) return '';
    const e = ia(r().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? n.sort() : n.sort().reverse()).find((a) =>
            t >= 0 ? a >= e : a <= e
        ) || ''
    );
}
function wa() {
    ((function () {
        const t = r(),
            a = da(t.availability.monthAnchor, t.availability.selectedDate),
            n = fa(),
            s = a.getMonth(),
            o = ra(t.availability.draft),
            l = u(new Date());
        var c;
        e(
            '#calendarMonth',
            ((c = a),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(c))
        );
        const d = (function (t) {
            const a = new Date(t.getFullYear(), t.getMonth(), 1),
                n = (a.getDay() + 6) % 7;
            a.setDate(a.getDate() - n);
            const e = [];
            for (let t = 0; t < 42; t += 1) {
                const n = new Date(a);
                (n.setDate(a.getDate() + t), e.push(n));
            }
            return e;
        })(a)
            .map((t) => {
                const a = u(t),
                    e = Array.isArray(o[a]) && o[a].length > 0;
                return `\n                <button type="button" class="${['calendar-day', t.getMonth() === s ? '' : 'other-month', e ? 'has-slots' : '', a === n ? 'is-selected' : '', a === l ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${a}">\n                    <span>${t.getDate()}</span>\n                    ${e ? `<small>${o[a].length} slots</small>` : ''}\n                </button>\n            `;
            })
            .join('');
        i('#availabilityCalendar', d);
    })(),
        (function () {
            const t = r(),
                a = fa(),
                n = ea(ra(t.availability.draft)[a] || []);
            (e('#selectedDate', a || '-'),
                n.length
                    ? i(
                          '#timeSlotsList',
                          n
                              .map(
                                  (t) =>
                                      `\n            <div class="time-slot-item">\n                <span>${s(t)}</span>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(a)}" data-time="${encodeURIComponent(t)}" ${ya() ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : i(
                          '#timeSlotsList',
                          `<p class="empty-message">${ya() ? 'No hay horarios configurados (Solo lectura)' : 'No hay horarios configurados'}</p>`
                      ));
        })(),
        (function () {
            const a = r(),
                n = fa(),
                i = ra(a.availability.draft),
                s = Array.isArray(i[n]) ? i[n].length : 0,
                o = ya(),
                {
                    sourceText: l,
                    modeText: c,
                    timezone: d,
                } = (function () {
                    const t = r().data.availabilityMeta || {},
                        a = ya();
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
            (e(
                '#availabilityHeading',
                o
                    ? 'Configurar Horarios Disponibles · Solo lectura'
                    : 'Configurar Horarios Disponibles'
            ),
                e('#availabilitySourceBadge', `Fuente: ${l}`),
                e('#availabilityModeBadge', `Modo: ${c}`),
                e('#availabilityTimezoneBadge', `TZ: ${d}`),
                e(
                    '#availabilitySelectionSummary',
                    `Fecha: ${n} | Fuente: ${l} | Modo: ${c} | Slots: ${s}`
                ),
                e(
                    '#availabilityDraftStatus',
                    a.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                e(
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
            let v = 'Sin acciones pendientes';
            (o
                ? (v = 'Edicion bloqueada por proveedor Google')
                : a.availability.lastAction
                  ? (v = String(a.availability.lastAction))
                  : g && (v = `Portapapeles: ${g} slots`),
                e('#availabilityDayActionsStatus', v),
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
        pa());
}
function Ca() {
    return Boolean(r().availability.draftDirty);
}
function Aa(t) {
    if (ya()) return;
    const a = r(),
        n = ia(a.availability.selectedDate) || fa(),
        e = Array.isArray(a.availability.draft[n])
            ? a.availability.draft[n]
            : [],
        i = sa(n);
    if (!i) return;
    i.setDate(i.getDate() + Number(t || 0));
    const s = u(i);
    va(s, e, `Duplicado ${e.length} slots en ${s}`);
}
function qa(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function La(t, a, n, e = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${s(e)}">\n            <div>\n                <span>${s(t)}</span>\n                <small>${s(n)}</small>\n            </div>\n            <strong>${s(a)}</strong>\n        </li>\n    `;
}
function $a(t) {
    const a = Math.max(0, Math.min(5, Math.round(Number(t || 0))));
    return `${'★'.repeat(a)}${'☆'.repeat(5 - a)}`;
}
function Ta(t) {
    const a = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return a.length ? a.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
const Da = 'adminLastSection',
    Ea = 'adminSidebarCollapsed';
function Ma(t, { persist: a = !1 } = {}) {
    const n = C(t);
    (o((a) => ({ ...a, ui: { ...a.ui, themeMode: t, theme: n } })),
        a && A(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((a) => {
            const n = a.dataset.themeMode === t;
            (a.classList.toggle('is-active', n),
                a.setAttribute('aria-pressed', String(n)));
        }));
}
function Ba() {
    const t = r();
    (tt(Da, t.ui.activeSection), tt(Ea, t.ui.sidebarCollapsed ? '1' : '0'));
}
function xa() {
    const t = D();
    (e('#adminRefreshStatus', t),
        e(
            '#adminSyncState',
            'Datos: sin sincronizar' === t
                ? 'Listo para primera sincronizacion'
                : t.replace('Datos: ', 'Estado: ')
        ));
}
function Na() {
    (ut(!1),
        bt(),
        mt(!1),
        pt({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function _a(t, a = {}) {
    const n = S(t, 'dashboard'),
        { force: e = !1 } = a,
        i = r().ui.activeSection;
    (e ||
        'availability' !== r().ui.activeSection ||
        'availability' === n ||
        !Ca() ||
        window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        )) &&
        (!(function (t) {
            const a = S(t, 'dashboard');
            (o((t) => ({ ...t, ui: { ...t.ui, activeSection: a } })),
                dt(a),
                vt(r()),
                w(a),
                Ba());
        })(n),
        'queue' === n && 'queue' !== i && Z() && (await J()));
}
function Fa() {
    (o((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    })),
        Ha(),
        Ba());
}
function Pa() {
    (o((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } })),
        Ha());
}
function Ia() {
    (o((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })), Ha());
}
function Ha() {
    const a = r(),
        n = window.matchMedia('(max-width: 1024px)').matches;
    !(function ({ open: a, collapsed: n }) {
        const e = t('#adminSidebar'),
            i = t('#adminSidebarBackdrop'),
            s = t('#adminMenuToggle');
        (e && e.classList.toggle('is-open', Boolean(a)),
            i && i.classList.toggle('is-hidden', !a),
            s && s.setAttribute('aria-expanded', String(Boolean(a))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(a)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(n)
            ));
        const o = t('#adminSidebarCollapse');
        o && o.setAttribute('aria-pressed', String(Boolean(n)));
    })({
        open: !!n && a.ui.sidebarOpen,
        collapsed: !n && a.ui.sidebarCollapsed,
    });
}
function Ra() {
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function Oa() {
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
async function ja(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await _a('appointments'), xt('pending_transfer'), Nt(''));
            break;
        case 'appointments_all':
            (await _a('appointments'), xt('all'), Nt(''));
            break;
        case 'appointments_no_show':
            (await _a('appointments'), xt('no_show'), Nt(''));
            break;
        case 'callbacks_pending':
            (await _a('callbacks'), Kt('pending'));
            break;
        case 'callbacks_contacted':
            (await _a('callbacks'), Kt('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await _a('callbacks'), Kt('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await _a('queue'), f('sla_risk'));
            break;
        case 'queue_waiting':
            (await _a('queue'), f('waiting'));
            break;
        case 'queue_called':
            (await _a('queue'), f('called'));
            break;
        case 'queue_no_show':
            (await _a('queue'), f('no_show'));
            break;
        case 'queue_all':
            (await _a('queue'), f('all'));
            break;
        case 'queue_call_next':
            (await _a('queue'), await G(r().queue.stationConsultorio));
    }
}
async function za(t = !1) {
    const a = await K();
    (!(function () {
        const t = r(),
            a = ra(t.data.availability || {}),
            n = ua(t.availability.selectedDate, a);
        (ma({
            draft: a,
            selectedDate: n,
            monthAnchor: da(t.availability.monthAnchor, n),
            draftDirty: !1,
            lastAction: '',
        }),
            wa());
    })(),
        await X(),
        vt(r()),
        (function (t) {
            const a = Array.isArray(t.data.appointments)
                    ? t.data.appointments
                    : [],
                n = Array.isArray(t.data.callbacks) ? t.data.callbacks : [],
                o = Array.isArray(t.data.reviews) ? t.data.reviews : [],
                r = t.data.funnelMetrics || {},
                l = new Date().toISOString().split('T')[0],
                c = a.filter((t) => String(t.date || '') === l).length,
                d = n.filter((t) => {
                    const a = qa(t.status);
                    return 'pending' === a || 'pendiente' === a;
                }).length,
                u = a.filter((t) => 'no_show' === qa(t.status)).length,
                m = o.length
                    ? (
                          o.reduce((t, a) => t + Number(a.rating || 0), 0) /
                          o.length
                      ).toFixed(1)
                    : '0.0',
                b = o.filter((t) => {
                    const a = new Date(t.date || t.createdAt || '');
                    return (
                        !Number.isNaN(a.getTime()) &&
                        Date.now() - a.getTime() <= 2592e6
                    );
                }).length;
            (e('#todayAppointments', c),
                e('#totalAppointments', a.length),
                e('#pendingCallbacks', d),
                e('#totalReviewsCount', o.length),
                e('#totalNoShows', u),
                e('#avgRating', m),
                e('#adminAvgRating', m),
                e('#dashboardHeroRating', m),
                e('#dashboardHeroRecentReviews', b));
            const g = r.summary || {};
            (e('#funnelViewBooking', p(g.viewBooking || 0)),
                e('#funnelStartCheckout', p(g.startCheckout || 0)),
                e('#funnelBookingConfirmed', p(g.bookingConfirmed || 0)),
                e(
                    '#funnelAbandonRate',
                    `${Number(g.abandonRatePct || 0).toFixed(1)}%`
                ));
            const v = (t, a, n) =>
                Array.isArray(t) && t.length
                    ? t
                          .slice(0, 6)
                          .map((t) => {
                              return (
                                  (e = String(t[a] || t.label || '-')),
                                  (i = String(t[n] ?? t.count ?? 0)),
                                  `<li><span>${s(e)}</span><strong>${s(i)}</strong></li>`
                              );
                              var e, i;
                          })
                          .join('')
                    : '<li><span>Sin datos</span><strong>0</strong></li>';
            (i(
                '#funnelEntryList',
                v(r.checkoutEntryBreakdown, 'entry', 'count')
            ),
                i('#funnelSourceList', v(r.sourceBreakdown, 'source', 'count')),
                i(
                    '#funnelPaymentMethodList',
                    v(r.paymentMethodBreakdown, 'method', 'count')
                ),
                i(
                    '#funnelAbandonReasonList',
                    v(r.abandonReasonBreakdown, 'reason', 'count')
                ),
                i(
                    '#funnelStepList',
                    v(r.bookingStepBreakdown, 'step', 'count')
                ),
                i(
                    '#funnelErrorCodeList',
                    v(r.errorCodeBreakdown, 'code', 'count')
                ),
                i(
                    '#funnelAbandonList',
                    v(r.checkoutAbandonByStep, 'step', 'count')
                ));
            const h = a.filter((t) => {
                    const a = qa(t.paymentStatus || t.payment_status);
                    return (
                        'pending_transfer_review' === a ||
                        'pending_transfer' === a
                    );
                }).length,
                y = n.filter((t) => {
                    const a = qa(t.status);
                    if ('pending' !== a && 'pendiente' !== a) return !1;
                    const n = new Date(t.fecha || t.createdAt || '');
                    return (
                        !Number.isNaN(n.getTime()) &&
                        (Date.now() - n.getTime()) / 6e4 >= 60
                    );
                }).length;
            (e('#operationPendingReviewCount', h),
                e('#operationPendingCallbacksCount', d),
                e('#operationTodayLoadCount', c),
                e('#dashboardHeroPendingTransfers', h),
                e('#dashboardHeroUrgentCallbacks', y),
                e(
                    '#operationQueueHealth',
                    y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
                ),
                e(
                    '#dashboardQueueHealth',
                    y > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
                ),
                e(
                    '#dashboardLiveStatus',
                    h > 0 || y > 0 ? 'Atencion' : 'Estable'
                ),
                e(
                    '#dashboardLiveMeta',
                    h > 0
                        ? 'Existen transferencias pendientes por validar.'
                        : y > 0
                          ? 'Hay callbacks fuera de SLA que requieren contacto.'
                          : 'Sin alertas criticas en la operacion actual.'
                ),
                e(
                    '#dashboardFlowStatus',
                    c > 6
                        ? 'Agenda con demanda alta'
                        : u > 0
                          ? 'Revisar ausencias del dia'
                          : 'Flujo operativo bajo control'
                ),
                e(
                    '#dashboardHeroSummary',
                    h > 0 || y > 0
                        ? `Prioriza ${h} transferencia(s) y ${y} callback(s) urgentes.`
                        : 'Agenda, callbacks y disponibilidad en una sola vista de control.'
                ),
                i(
                    '#operationActionList',
                    [
                        {
                            action: 'context-open-appointments-transfer',
                            label: 'Validar transferencias',
                            desc: `${h} por revisar`,
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
                            (t) =>
                                `\n            <button type="button" class="operations-action-item" data-action="${t.action}">\n                <span>${s(t.label)}</span>\n                <small>${s(t.desc)}</small>\n            </button>\n        `
                        )
                        .join('')
                ));
            const f = Number(t.ui?.lastRefreshAt || 0);
            (e(
                '#operationRefreshSignal',
                f
                    ? `Sync ${new Date(f).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tiempo real'
            ),
                e(
                    '#operationDeckMeta',
                    h > 0 || d > 0 ? 'Prioridades activas' : 'Operacion estable'
                ));
            const S = [
                La(
                    'Transferencias',
                    String(h),
                    h > 0 ? 'Comprobantes por revisar' : 'Sin pendientes',
                    h > 0 ? 'warning' : 'neutral'
                ),
                La(
                    'Callbacks urgentes',
                    String(y),
                    y > 0 ? 'Mayores a 60 minutos' : 'SLA dentro de rango',
                    y > 0 ? 'danger' : 'neutral'
                ),
                La(
                    'No show',
                    String(u),
                    u > 0 ? 'Requiere seguimiento' : 'Sin ausencias recientes',
                    u > 0 ? 'warning' : 'neutral'
                ),
            ];
            i('#dashboardAttentionList', S.join(''));
        })(r()),
        Mt(),
        Yt(),
        (function () {
            const t = r(),
                a = Array.isArray(t.data.reviews) ? t.data.reviews : [],
                n = (function (t) {
                    return t
                        .slice()
                        .sort(
                            (t, a) =>
                                new Date(a.date || a.createdAt || 0).getTime() -
                                new Date(t.date || t.createdAt || 0).getTime()
                        );
                })(a),
                o = a.length
                    ? a.reduce((t, a) => t + Number(a.rating || 0), 0) /
                      a.length
                    : 0,
                l = a.filter((t) => Number(t.rating || 0) >= 5).length,
                c = a.filter((t) => {
                    const a = new Date(t.date || t.createdAt || '');
                    return (
                        !Number.isNaN(a.getTime()) &&
                        Date.now() - a.getTime() <= 2592e6
                    );
                }).length;
            if (
                (e('#reviewsAverageRating', o.toFixed(1)),
                e('#reviewsFiveStarCount', l),
                e('#reviewsRecentCount', c),
                e('#reviewsTotalCount', a.length),
                e(
                    '#reviewsSentimentLabel',
                    (function (t, a) {
                        return a
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
                i(
                    '#reviewsSummaryRail',
                    (function (t, a) {
                        const n = t[0],
                            e = n ? d(n.date || n.createdAt || '') : '-',
                            i = n ? String(n.name || 'Anonimo') : 'Sin datos';
                        return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${s(i)}</strong>\n            <small>${s(e)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${s(String(a))} en 30 dias</strong>\n            <small>Lectura del pulso reciente</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Seal premium</span>\n            <strong>${s(t.length >= 5 ? 'Base consistente' : 'Volumen inicial')}</strong>\n            <small>Calidad y recurrencia de comentarios</small>\n        </article>\n    `;
                    })(n, c)
                ),
                !a.length)
            )
                return (
                    i(
                        '#reviewsSpotlight',
                        '\n                <div class="reviews-empty-state">\n                    <strong>Sin feedback reciente</strong>\n                    <p>No hay resenas registradas todavia.</p>\n                </div>\n            '
                    ),
                    void i(
                        '#reviewsGrid',
                        '\n                <div class="reviews-empty-state">\n                    <strong>No hay resenas registradas.</strong>\n                    <p>Cuando entren comentarios, apareceran aqui con resumen y spotlight.</p>\n                </div>\n            '
                    )
                );
            const u = n.find((t) => Number(t.rating || 0) >= 5) || n[0];
            i(
                '#reviewsSpotlight',
                `\n            <article class="reviews-spotlight-card">\n                <div class="reviews-spotlight-top">\n                    <span class="review-avatar">${s(Ta(u.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${s(u.name || 'Anonimo')}</strong>\n                        <small>${s(d(u.date || u.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <p class="reviews-spotlight-stars">${s($a(u.rating))}</p>\n                <p>${s(u.comment || u.review || '')}</p>\n            </article>\n        `
            );
            const p = n
                .map((t) => {
                    const a = Number(t.rating || 0);
                    return `\n                <article class="review-card" data-rating="${s(String(a))}">\n                    <header>\n                        <div class="review-card-heading">\n                            <span class="review-avatar">${s(Ta(t.name || 'Anonimo'))}</span>\n                            <div>\n                                <strong>${s(t.name || 'Anonimo')}</strong>\n                                <small>${s(d(t.date || t.createdAt || ''))}</small>\n                            </div>\n                        </div>\n                        <span class="review-rating-badge">${s($a(a))}</span>\n                    </header>\n                    <p>${s(t.comment || t.review || '')}</p>\n                </article>\n            `;
                })
                .join('');
            i('#reviewsGrid', p);
        })(),
        wa(),
        at(),
        xa(),
        t &&
            y(
                a ? 'Datos actualizados' : 'Datos cargados desde cache local',
                a ? 'success' : 'warning'
            ));
}
function Va(t) {
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
async function Ua(a, n) {
    switch (a) {
        case 'close-toast':
            return void n.closest('.toast')?.remove();
        case 'set-admin-theme':
            return void Ma(String(n.dataset.themeMode || 'system'), {
                persist: !0,
            });
        case 'toggle-sidebar-collapse':
            return void Fa();
        case 'refresh-admin-data':
            return void (await za(!0));
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const a = Va(t.value);
                a && (await ja(a));
            }
            return;
        }
        case 'logout':
            return (await Y(), lt(), Na(), void y('Sesion cerrada', 'info'));
        case 'reset-login-2fa':
            return (
                o((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                ut(!1),
                bt(),
                pt({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                void gt('password')
            );
        case 'appointment-quick-filter':
            return void xt(String(n.dataset.filterValue || 'all'));
        case 'clear-appointment-filters':
            return void Bt({ filter: 'all', search: '' });
        case 'appointment-density':
            return void Bt({
                density:
                    'compact' === ht(String(n.dataset.density || 'comfortable'))
                        ? 'compact'
                        : 'comfortable',
            });
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await Ft(t, { paymentStatus: 'paid' }),
                        _t(t, { paymentStatus: 'paid' }));
                })(Number(n.dataset.id || 0)),
                void y('Transferencia aprobada', 'success')
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await Ft(t, { paymentStatus: 'failed' }),
                        _t(t, { paymentStatus: 'failed' }));
                })(Number(n.dataset.id || 0)),
                void y('Transferencia rechazada', 'warning')
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await Ft(t, { status: 'no_show' }),
                        _t(t, { status: 'no_show' }));
                })(Number(n.dataset.id || 0)),
                void y('Marcado como no show', 'warning')
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await Ft(t, { status: 'cancelled' }),
                        _t(t, { status: 'cancelled' }));
                })(Number(n.dataset.id || 0)),
                void y('Cita cancelada', 'warning')
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
                    n = URL.createObjectURL(a),
                    e = document.createElement('a');
                ((e.href = n),
                    (e.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
                    document.body.appendChild(e),
                    e.click(),
                    e.remove(),
                    URL.revokeObjectURL(n));
            })();
        case 'callback-quick-filter':
            return void Kt(String(n.dataset.filterValue || 'all'));
        case 'clear-callback-filters':
            return void Zt({
                filter: 'all',
                sort: 'recent_desc',
                search: '',
                selected: [],
            });
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await _a('callbacks'),
                Kt('pending'),
                void (function () {
                    const t = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    t instanceof HTMLElement && t.focus();
                })()
            );
        case 'mark-contacted':
            return (
                await Xt(
                    Number(n.dataset.callbackId || 0),
                    String(n.dataset.callbackDate || '')
                ),
                void y('Callback actualizado', 'success')
            );
        case 'change-month':
            return void (function (t) {
                const a = Number(t || 0);
                if (!Number.isFinite(a) || 0 === a) return;
                const n = da(
                    r().availability.monthAnchor,
                    r().availability.selectedDate
                );
                (n.setMonth(n.getMonth() + a),
                    ma({ monthAnchor: n, lastAction: '' }, { render: !0 }));
            })(Number(n.dataset.delta || 0));
        case 'availability-today':
        case 'context-availability-today':
            return void Sa(u(new Date()), 'Hoy');
        case 'availability-prev-with-slots':
            return void (function () {
                const t = ka(-1);
                t
                    ? Sa(t, `Fecha previa con slots: ${t}`)
                    : ga('No hay fechas anteriores con slots');
            })();
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return void (function () {
                const t = ka(1);
                t
                    ? Sa(t, `Siguiente fecha con slots: ${t}`)
                    : ga('No hay fechas siguientes con slots');
            })();
        case 'select-availability-day':
            return void (function (t) {
                const a = ia(t);
                a &&
                    ma(
                        {
                            selectedDate: a,
                            monthAnchor: da(a, a),
                            lastAction: '',
                        },
                        { render: !0 }
                    );
            })(String(n.dataset.date || ''));
        case 'prefill-time-slot':
            return void (function (a) {
                if (ya()) return;
                const n = t('#newSlotTime');
                n instanceof HTMLInputElement && ((n.value = na(a)), n.focus());
            })(String(n.dataset.time || ''));
        case 'add-time-slot':
            return void (function () {
                if (ya()) return;
                const a = t('#newSlotTime');
                if (!(a instanceof HTMLInputElement)) return;
                const n = na(a.value);
                if (!n) return;
                const e = r(),
                    i = ia(e.availability.selectedDate) || fa();
                i &&
                    (va(
                        i,
                        [
                            ...(Array.isArray(e.availability.draft[i])
                                ? e.availability.draft[i]
                                : []),
                            n,
                        ],
                        `Slot ${n} agregado en ${i}`
                    ),
                    (a.value = ''));
            })();
        case 'remove-time-slot':
            return void (function (t, a) {
                if (ya()) return;
                const n = ia(t);
                if (!n) return;
                const e = r(),
                    i = Array.isArray(e.availability.draft[n])
                        ? e.availability.draft[n]
                        : [],
                    s = na(a);
                va(
                    n,
                    i.filter((t) => na(t) !== s),
                    `Slot ${s || '-'} removido en ${n}`
                );
            })(
                decodeURIComponent(String(n.dataset.date || '')),
                decodeURIComponent(String(n.dataset.time || ''))
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return void (function () {
                if (ya()) return;
                const t = r(),
                    a = ia(t.availability.selectedDate) || fa(),
                    n = Array.isArray(t.availability.draft[a])
                        ? ea(t.availability.draft[a])
                        : [];
                ma(
                    {
                        clipboard: n,
                        clipboardDate: a,
                        lastAction: n.length
                            ? `Portapapeles: ${n.length} slots (${a})`
                            : 'Portapapeles vacio',
                    },
                    { render: !0 }
                );
            })();
        case 'paste-availability-day':
            return void (function () {
                if (ya()) return;
                const t = r(),
                    a = Array.isArray(t.availability.clipboard)
                        ? ea(t.availability.clipboard)
                        : [];
                if (!a.length) return void ga('Portapapeles vacio');
                const n = ia(t.availability.selectedDate) || fa();
                va(n, a, `Pegado ${a.length} slots en ${n}`);
            })();
        case 'duplicate-availability-day-next':
            return void Aa(1);
        case 'duplicate-availability-next-week':
            return void Aa(7);
        case 'clear-availability-day':
            return void (function () {
                if (ya()) return;
                const t = ia(r().availability.selectedDate) || fa();
                t &&
                    window.confirm(
                        `Se eliminaran los slots del dia ${t}. ¿Continuar?`
                    ) &&
                    va(t, [], `Dia ${t} limpiado`);
            })();
        case 'clear-availability-week':
            return void (function () {
                if (ya()) return;
                const t = ia(r().availability.selectedDate) || fa();
                if (!t) return;
                const a = (function (t) {
                    const a = sa(t);
                    if (!a) return null;
                    const n = (a.getDay() + 6) % 7,
                        e = new Date(a);
                    e.setDate(a.getDate() - n);
                    const i = new Date(e);
                    return (i.setDate(e.getDate() + 6), { start: e, end: i });
                })(t);
                if (!a) return;
                const n = u(a.start),
                    e = u(a.end);
                if (
                    !window.confirm(
                        `Se eliminaran los slots de la semana ${n} a ${e}. ¿Continuar?`
                    )
                )
                    return;
                const i = ha();
                for (let t = 0; t < 7; t += 1) {
                    const n = new Date(a.start);
                    (n.setDate(a.start.getDate() + t), delete i[u(n)]);
                }
                ba(i, {
                    selectedDate: t,
                    lastAction: `Semana limpiada (${n} - ${e})`,
                });
            })();
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (ya()) return;
                    const t = ha(),
                        a = await l('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        n =
                            a?.data && 'object' == typeof a.data
                                ? ra(a.data)
                                : t,
                        e =
                            a?.meta && 'object' == typeof a.meta
                                ? a.meta
                                : null;
                    (o((t) => ({
                        ...t,
                        data: {
                            ...t.data,
                            availability: n,
                            availabilityMeta: e
                                ? { ...t.data.availabilityMeta, ...e }
                                : t.data.availabilityMeta,
                        },
                        availability: {
                            ...t.availability,
                            draft: n,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        wa());
                })(),
                void y('Disponibilidad guardada', 'success')
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (ya()) return;
                    const t = r();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. ¿Continuar?'
                        )
                    )
                        return;
                    const a = ra(t.data.availability || {}),
                        n = ua(t.availability.selectedDate, a);
                    ma(
                        {
                            draft: a,
                            selectedDate: n,
                            monthAnchor: da(t.availability.monthAnchor, n),
                            draftDirty: !1,
                            lastAction: 'Borrador descartado',
                        },
                        { render: !0 }
                    );
                })(),
                void y('Borrador descartado', 'info')
            );
        case 'queue-refresh-state':
            return void (await J());
        case 'queue-call-next':
            return void (await G(Number(n.dataset.queueConsultorio || 0)));
        case 'queue-release-station':
            return void (await W(Number(n.dataset.queueConsultorio || 0)));
        case 'queue-toggle-ticket-select':
            return void Q(Number(n.dataset.queueId || 0));
        case 'queue-select-visible':
            return void U();
        case 'queue-clear-selection':
            return void V();
        case 'queue-ticket-action':
            return void (await z(
                Number(n.dataset.queueId || 0),
                String(n.dataset.queueAction || ''),
                Number(n.dataset.queueConsultorio || 0)
            ));
        case 'queue-reprint-ticket':
            return void (await j(Number(n.dataset.queueId || 0)));
        case 'queue-bulk-action':
            return void (await O(String(n.dataset.queueAction || 'no_show')));
        case 'queue-bulk-reprint':
            return void (await R());
        case 'queue-clear-search':
            return void H();
        case 'queue-toggle-shortcuts':
            return void I();
        case 'queue-toggle-one-tap':
            return void P();
        case 'queue-start-practice':
            return void F(!0);
        case 'queue-stop-practice':
            return void F(!1);
        case 'queue-lock-station':
            return void _(Number(n.dataset.queueConsultorio || 1));
        case 'queue-set-station-mode':
            return void N(String(n.dataset.queueMode || 'free'));
        case 'queue-sensitive-confirm':
            return void (await x());
        case 'queue-sensitive-cancel':
            return void B();
        case 'queue-capture-call-key':
            return void M();
        case 'queue-clear-call-key':
            return void E();
        case 'callbacks-bulk-select-visible':
            return void Zt(
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
            return void Zt({ selected: [] }, { persist: !1 });
        case 'callbacks-bulk-mark':
            return void (await (async function () {
                const t = (r().callbacks.selected || [])
                    .map((t) => Number(t || 0))
                    .filter((t) => t > 0);
                for (const a of t)
                    try {
                        await Xt(a);
                    } catch (t) {}
            })());
        case 'context-open-appointments-transfer':
            return (await _a('appointments'), void xt('pending_transfer'));
        case 'context-open-callbacks-pending':
            return (await _a('callbacks'), void Kt('pending'));
        case 'context-open-dashboard':
            return void (await _a('dashboard'));
    }
}
async function Qa(t) {
    t.preventDefault();
    const a = document.getElementById('adminPassword'),
        n = document.getElementById('admin2FACode'),
        e = a instanceof HTMLInputElement ? a.value : '',
        i = n instanceof HTMLInputElement ? n.value : '';
    try {
        mt(!0);
        const t = r();
        if (
            (pt({
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
            await $(i);
        else if ((await T(e)).requires2FA)
            return (
                ut(!0),
                pt({
                    tone: 'warning',
                    title: 'Codigo 2FA requerido',
                    message:
                        'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                }),
                void gt('2fa')
            );
        (pt({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            ct(),
            ut(!1),
            bt({ clearPassword: !0 }),
            await za(!1),
            y('Sesion iniciada', 'success'));
    } catch (t) {
        (pt({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            gt(r().auth.requires2FA ? '2fa' : 'password'),
            y(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        mt(!1);
    }
}
async function Wa() {
    (!(function () {
        const n = t('#loginScreen'),
            e = t('#adminDashboard');
        if (!(n instanceof HTMLElement && e instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((n.innerHTML = `\n        <div class="sony-login-shell">\n            <section class="sony-login-hero">\n                <div class="sony-login-brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Admin Operations</h1>\n                    <p>Centro de control con una capa visual premium, autenticacion endurecida y flujo rapido para operacion diaria.</p>\n                </div>\n                <div class="sony-login-badge-row">\n                    <span class="sony-login-badge">Sony-like UI</span>\n                    <span class="sony-login-badge">CSP self-hosted</span>\n                    <span class="sony-login-badge">2FA ready</span>\n                </div>\n                <div class="sony-login-trust-grid">\n                    <article class="sony-login-trust-card">\n                        <span>Acceso</span>\n                        <strong>Sesion de administrador</strong>\n                        <small>Entrada aislada para operacion y triage.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Proteccion</span>\n                        <strong>Clave + verificacion</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="sony-login-trust-card">\n                        <span>Entorno</span>\n                        <strong>Activos locales</strong>\n                        <small>Fuentes, iconos y estilos propios sin dependencias remotas.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="sony-login-panel">\n                <div class="sony-login-panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para entrar al centro operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.\n                    </p>\n                </form>\n\n                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${a('sun')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${a('moon')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${a('system')}</button>\n                </div>\n            </section>\n        </div>\n    `),
            (e.innerHTML = `\n        <aside class="admin-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <strong>Piel en Armonia</strong>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${a('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                ${rt('dashboard', 'Dashboard', 'dashboard', !0)}\n                ${rt('appointments', 'Citas', 'appointments')}\n                ${rt('callbacks', 'Callbacks', 'callbacks')}\n                ${rt('reviews', 'Resenas', 'reviews')}\n                ${rt('availability', 'Disponibilidad', 'availability')}\n                ${rt('queue', 'Turnero Sala', 'queue')}\n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${a('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n        <main class="admin-main" id="adminMainContent" tabindex="-1">\n            <header class="admin-header">\n                <div class="admin-header-title-wrap">\n                    <button type="button" id="adminMenuToggle" aria-controls="adminSidebar" aria-expanded="false">${a('menu')}<span>Menu</span></button>\n                    <h2 id="pageTitle">Dashboard</h2>\n                </div>\n                <nav class="admin-quick-nav" data-qa="admin-quick-nav" aria-label="Navegacion rapida">\n                    ${ot('dashboard', 'Dashboard', 'Alt+Shift+1', !0)}\n                    ${ot('appointments', 'Citas', 'Alt+Shift+2')}\n                    ${ot('callbacks', 'Callbacks', 'Alt+Shift+3')}\n                    ${ot('reviews', 'Resenas', 'Alt+Shift+4')}\n                    ${ot('availability', 'Disponibilidad', 'Alt+Shift+5')}\n                    ${ot('queue', 'Turnero', 'Alt+Shift+6')}\n                </nav>\n                <div class="admin-header-actions">\n                    <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${a('sun')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${a('moon')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${a('system')}</button>\n                    </div>\n                    <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                </div>\n            </header>\n\n            <section class="sony-context-strip" id="adminProductivityStrip">\n                <div class="sony-context-grid">\n                    <div class="sony-context-copy">\n                        <p class="sony-kicker" id="adminSectionEyebrow">Control Deck</p>\n                        <h3 id="adminContextTitle">Vista general operativa</h3>\n                        <p id="adminContextSummary">Monitorea agenda, callbacks y cola desde un solo frente.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="sony-command-stage">\n                        <div class="sony-command-box">\n                            <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />\n                            <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                        </div>\n                        <div class="sony-status-cluster">\n                            <article class="sony-status-tile">\n                                <span>Push</span>\n                                <strong id="pushStatusIndicator">Inicializando</strong>\n                                <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                            </article>\n                            <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                                <span>Sesion</span>\n                                <strong id="adminSessionState">No autenticada</strong>\n                                <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                            </article>\n                            <article class="sony-status-tile">\n                                <span>Sincronizacion</span>\n                                <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                                <small id="adminSyncState">Listo para primera sincronizacion</small>\n                            </article>\n                        </div>\n                    </div>\n                </div>\n            </section>\n\n            \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Admin premium minimal</p>\n                        <h3>Centro operativo diario</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad en una sola vista de control.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda Premium</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Triage, pagos y seguimiento sin salir de la mesa.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">Triage de SLA</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n        </main>\n    `));
    })(),
        document.body.classList.add('admin-v2-mode'),
        (function () {
            (document.addEventListener('click', async (t) => {
                const a =
                    t.target instanceof Element
                        ? t.target.closest('[data-action]')
                        : null;
                if (!a) return;
                const n = String(a.getAttribute('data-action') || '');
                if (n) {
                    t.preventDefault();
                    try {
                        await Ua(n, a);
                    } catch (t) {
                        y(t?.message || 'Error ejecutando accion', 'error');
                    }
                }
            }),
                document.addEventListener('click', async (t) => {
                    const a =
                        t.target instanceof Element
                            ? t.target.closest('[data-section]')
                            : null;
                    if (!a) return;
                    const n = a.classList.contains('admin-quick-nav-item'),
                        e = a.classList.contains('nav-item');
                    (n || e) &&
                        (t.preventDefault(),
                        await _a(
                            String(
                                a.getAttribute('data-section') || 'dashboard'
                            )
                        ),
                        window.matchMedia('(max-width: 1024px)').matches &&
                            Ia());
                }),
                document.addEventListener('click', (t) => {
                    const a =
                        t.target instanceof Element
                            ? t.target.closest('[data-queue-filter]')
                            : null;
                    a &&
                        (t.preventDefault(),
                        f(
                            String(a.getAttribute('data-queue-filter') || 'all')
                        ));
                }));
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const a = document.getElementById('callbacksBulkClearBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-clear');
            const n = document.getElementById('callbacksBulkMarkBtn');
            n && n.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = 'datetime_desc',
                a = 'comfortable';
            try {
                ((t = JSON.parse(
                    localStorage.getItem('admin-appointments-sort') ||
                        '"datetime_desc"'
                )),
                    (a = JSON.parse(
                        localStorage.getItem('admin-appointments-density') ||
                            '"comfortable"'
                    )));
            } catch (t) {}
            o((n) => ({
                ...n,
                appointments: {
                    ...n.appointments,
                    sort: 'string' == typeof t ? t : 'datetime_desc',
                    density: 'string' == typeof a ? a : 'comfortable',
                },
            }));
        })(),
        (function () {
            let t = 'all',
                a = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(It) || '"all"')),
                    (a = JSON.parse(
                        localStorage.getItem(Pt) || '"recent_desc"'
                    )));
            } catch (t) {}
            o((n) => ({
                ...n,
                callbacks: { ...n.callbacks, filter: jt(t), sort: zt(a) },
            }));
        })(),
        (function () {
            let t = '',
                a = '';
            try {
                ((t = String(localStorage.getItem(ta) || '')),
                    (a = String(localStorage.getItem(aa) || '')));
            } catch (t) {}
            const n = ia(t),
                e = da(a, n);
            o((t) => ({
                ...t,
                availability: {
                    ...t.availability,
                    ...(n ? { selectedDate: n } : {}),
                    monthAnchor: e,
                },
            }));
        })(),
        (function () {
            const t = S(k(Da, 'dashboard')),
                a = '1' === k(Ea, '0');
            (o((n) => ({
                ...n,
                ui: {
                    ...n.ui,
                    activeSection: t,
                    sidebarCollapsed: a,
                    sidebarOpen: !1,
                },
            })),
                dt(t),
                w(t),
                Ha());
        })(),
        m(),
        Ma(b()),
        Na(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    xt(t.value);
                });
            const a = document.getElementById('appointmentSort');
            a instanceof HTMLSelectElement &&
                a.addEventListener('change', () => {
                    Bt({ sort: ht(a.value) || 'datetime_desc' });
                });
            const n = document.getElementById('searchAppointments');
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    Nt(n.value);
                });
            const e = document.getElementById('callbackFilter');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    Kt(e.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Zt({ sort: zt(i.value), selected: [] });
                });
            const s = document.getElementById('searchCallbacks');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        Zt({ search: String(t || ''), selected: [] }));
                });
            const o = document.getElementById('queueSearchInput');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    q(o.value);
                });
            const r = document.getElementById('adminQuickCommand');
            r instanceof HTMLInputElement &&
                r.addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const a = Va(r.value);
                    a && (await ja(a));
                });
        })(),
        (function () {
            const a = t('#adminMenuToggle'),
                n = t('#adminMenuClose'),
                e = t('#adminSidebarBackdrop');
            (a?.addEventListener('click', () => {
                window.matchMedia('(max-width: 1024px)').matches ? Pa() : Fa();
            }),
                n?.addEventListener('click', () => Ia()),
                e?.addEventListener('click', () => Ia()),
                window.addEventListener('resize', () => {
                    window.matchMedia('(max-width: 1024px)').matches
                        ? Ha()
                        : Ia();
                }),
                window.addEventListener('hashchange', async () => {
                    const t = L(r().ui.activeSection);
                    await _a(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && Ma(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            Ca() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const n = document.getElementById('loginForm');
    (n instanceof HTMLFormElement && n.addEventListener('submit', Qa),
        g({
            navigateToSection: _a,
            focusQuickCommand: Ra,
            focusCurrentSearch: Oa,
            runQuickAction: ja,
            closeSidebar: Ia,
            toggleMenu: () => {
                window.matchMedia('(max-width: 1024px)').matches ? Pa() : Fa();
            },
            dismissQueueSensitiveDialog: et,
            toggleQueueHelp: () => I(),
            queueNumpadAction: nt,
        }),
        (await v())
            ? await (async function () {
                  (ct(), await za(!1), dt(r().ui.activeSection));
              })()
            : (lt(), Na()),
        h(),
        window.setInterval(() => {
            xa();
        }, 3e4));
}
const Ga = (
    'loading' === document.readyState
        ? new Promise((t, a) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      Wa().then(t).catch(a);
                  },
                  { once: !0 }
              );
          })
        : Wa()
).catch((t) => {
    throw (console.error('admin-v2 boot failed', t), t);
});
export { Ga as default };
