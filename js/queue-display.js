!(function () {
    'use strict';
    function e(e) {
        if (
            'object' == typeof crypto &&
            crypto &&
            'function' == typeof crypto.randomUUID
        )
            return `${e}-${crypto.randomUUID()}`;
        const t = Math.random().toString(36).slice(2, 10);
        return `${e}-${Date.now().toString(36)}-${t}`;
    }
    function t(e, t, n, a) {
        const o = 'function' == typeof n && n() ? n() : {},
            i = o.details && 'object' == typeof o.details ? o.details : {};
        return {
            surface: e,
            deviceId: t,
            instance: String(o.instance || 'main'),
            deviceLabel: String(o.deviceLabel || ''),
            appMode: String(o.appMode || 'web'),
            route:
                String(o.route || '').trim() ||
                `${window.location.pathname}${window.location.search}`,
            status: String(o.status || 'warning'),
            summary: String(o.summary || ''),
            networkOnline:
                'boolean' == typeof o.networkOnline
                    ? o.networkOnline
                    : !1 !== navigator.onLine,
            lastEvent: String(o.lastEvent || a || 'heartbeat'),
            lastEventAt: String(o.lastEventAt || new Date().toISOString()),
            details: i,
        };
    }
    const n = Object.freeze({
        schema: 'turnero-clinic-profile/v1',
        clinic_id: 'default-clinic',
        branding: {
            name: 'Piel en Armonia',
            short_name: 'Piel en Armonia',
            city: 'Quito',
            base_url: '',
        },
        consultorios: {
            c1: { label: 'Consultorio 1', short_label: 'C1' },
            c2: { label: 'Consultorio 2', short_label: 'C2' },
        },
        surfaces: {
            admin: {
                enabled: !0,
                label: 'Admin web',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: !0,
                label: 'Operador web',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: !0,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: !0,
                label: 'Sala web',
                route: '/sala-turnos.html',
            },
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: !0,
            native_apps_blocking: !1,
            notes: [],
        },
    });
    let a = null;
    function o(e, t = '') {
        return String(e ?? '').trim() || t;
    }
    function i(e) {
        const t = e && 'object' == typeof e ? e : {},
            a = t.branding && 'object' == typeof t.branding ? t.branding : {},
            i =
                t.consultorios && 'object' == typeof t.consultorios
                    ? t.consultorios
                    : {},
            l = t.surfaces && 'object' == typeof t.surfaces ? t.surfaces : {},
            r = t.release && 'object' == typeof t.release ? t.release : {};
        return {
            schema: o(t.schema, n.schema),
            clinic_id: o(t.clinic_id, n.clinic_id),
            branding: {
                name: o(a.name, n.branding.name),
                short_name: o(a.short_name, o(a.name, n.branding.short_name)),
                city: o(a.city, n.branding.city),
                base_url: o(a.base_url, n.branding.base_url),
            },
            consultorios: {
                c1: {
                    label: o(i?.c1?.label, n.consultorios.c1.label),
                    short_label: o(
                        i?.c1?.short_label,
                        n.consultorios.c1.short_label
                    ),
                },
                c2: {
                    label: o(i?.c2?.label, n.consultorios.c2.label),
                    short_label: o(
                        i?.c2?.short_label,
                        n.consultorios.c2.short_label
                    ),
                },
            },
            surfaces: {
                admin: {
                    enabled:
                        'boolean' != typeof l?.admin?.enabled ||
                        l.admin.enabled,
                    label: o(l?.admin?.label, n.surfaces.admin.label),
                    route: o(l?.admin?.route, n.surfaces.admin.route),
                },
                operator: {
                    enabled:
                        'boolean' != typeof l?.operator?.enabled ||
                        l.operator.enabled,
                    label: o(l?.operator?.label, n.surfaces.operator.label),
                    route: o(l?.operator?.route, n.surfaces.operator.route),
                },
                kiosk: {
                    enabled:
                        'boolean' != typeof l?.kiosk?.enabled ||
                        l.kiosk.enabled,
                    label: o(l?.kiosk?.label, n.surfaces.kiosk.label),
                    route: o(l?.kiosk?.route, n.surfaces.kiosk.route),
                },
                display: {
                    enabled:
                        'boolean' != typeof l?.display?.enabled ||
                        l.display.enabled,
                    label: o(l?.display?.label, n.surfaces.display.label),
                    route: o(l?.display?.route, n.surfaces.display.route),
                },
            },
            release: {
                mode: o(r.mode, n.release.mode),
                admin_mode_default:
                    'expert' ===
                    o(r.admin_mode_default, n.release.admin_mode_default)
                        ? 'expert'
                        : 'basic',
                separate_deploy:
                    'boolean' != typeof r.separate_deploy || r.separate_deploy,
                native_apps_blocking:
                    'boolean' == typeof r.native_apps_blocking &&
                    r.native_apps_blocking,
                notes: Array.isArray(r.notes)
                    ? r.notes.map((e) => o(e)).filter(Boolean)
                    : [],
            },
        };
    }
    function l(e) {
        return o(e?.branding?.name, n.branding.name);
    }
    function r(e) {
        return o(e?.branding?.short_name, l(e));
    }
    function s(e) {
        const t = i(e);
        return (function (e) {
            let t = 2166136261;
            for (let n = 0; n < e.length; n += 1)
                ((t ^= e.charCodeAt(n)), (t = Math.imul(t, 16777619)));
            return (t >>> 0).toString(16).padStart(8, '0');
        })(
            [
                t.clinic_id,
                t.branding.base_url,
                t.consultorios.c1.label,
                t.consultorios.c1.short_label,
                t.consultorios.c2.label,
                t.consultorios.c2.short_label,
                t.surfaces.admin.enabled ? '1' : '0',
                t.surfaces.admin.route,
                t.surfaces.operator.enabled ? '1' : '0',
                t.surfaces.operator.route,
                t.surfaces.kiosk.enabled ? '1' : '0',
                t.surfaces.kiosk.route,
                t.surfaces.display.enabled ? '1' : '0',
                t.surfaces.display.route,
                t.release.mode,
                t.release.admin_mode_default,
                t.release.separate_deploy ? '1' : '0',
                t.release.native_apps_blocking ? '1' : '0',
            ].join('|')
        );
    }
    function c(e, t, a = {}) {
        const i = Boolean(a.short),
            l = 2 === Number(t || 0) ? 'c2' : 'c1',
            r = n.consultorios[l],
            s =
                e?.consultorios && 'object' == typeof e.consultorios
                    ? e.consultorios[l]
                    : null;
        return i ? o(s?.short_label, r.short_label) : o(s?.label, r.label);
    }
    function d(e) {
        const t = o(e);
        if (!t) return '';
        try {
            const e = new URL(t, 'https://turnero.local');
            return `${e.pathname}${e.hash || ''}` || '/';
        } catch (e) {
            return t;
        }
    }
    function u(e, t, a = {}) {
        const l = i(e),
            c = (function (e) {
                return {
                    source:
                        'fallback_default' ===
                        String(e?.runtime_meta?.source || 'remote')
                            .trim()
                            .toLowerCase()
                            ? 'fallback_default'
                            : 'remote',
                    profileFingerprint: String(
                        e?.runtime_meta?.profileFingerprint || s(e)
                    ).trim(),
                };
            })(e),
            u = String(t).trim().toLowerCase(),
            p = l.surfaces[u] || n.surfaces.operator,
            m = !1 !== p.enabled,
            f = d(p.route),
            b = (function (e = {}) {
                return o(e.currentRoute)
                    ? d(e.currentRoute)
                    : 'undefined' != typeof window &&
                        window.location &&
                        'string' == typeof window.location.pathname
                      ? d(
                            `${window.location.pathname || ''}${window.location.hash || ''}`
                        )
                      : '';
            })(a),
            g = '' === f || '' === b || f === b;
        return m
            ? 'remote' !== c.source
                ? {
                      surface: u,
                      enabled: m,
                      expectedRoute: f,
                      currentRoute: b,
                      routeMatches: g,
                      state: 'alert',
                      label: p.label,
                      detail: 'No se pudo cargar clinic-profile.json; la superficie quedó con perfil de respaldo y no puede operar como piloto.',
                      reason: 'profile_missing',
                  }
                : g
                  ? {
                        surface: u,
                        enabled: m,
                        expectedRoute: f,
                        currentRoute: b,
                        routeMatches: g,
                        state: 'ready',
                        label: p.label,
                        detail: `Ruta canónica verificada: ${f || b || 'sin ruta'}.`,
                        reason: 'ready',
                    }
                  : {
                        surface: u,
                        enabled: m,
                        expectedRoute: f,
                        currentRoute: b,
                        routeMatches: g,
                        state: 'alert',
                        label: p.label,
                        detail: `La ruta activa (${b || 'sin ruta'}) no coincide con la canónica (${f || 'sin ruta declarada'}).`,
                        reason: 'route_mismatch',
                    }
            : {
                  surface: u,
                  enabled: m,
                  expectedRoute: f,
                  currentRoute: b,
                  routeMatches: !1,
                  state: 'alert',
                  label: p.label,
                  detail: `${p.label} está deshabilitada en el perfil de ${r(l)}.`,
                  reason: 'disabled',
              };
    }
    const p = 'turnero-clinic-storage/v1';
    function m(e) {
        if ('string' != typeof e || !e.trim()) return null;
        try {
            const t = JSON.parse(e);
            if (!t || 'object' != typeof t || Array.isArray(t)) return null;
            if (
                t.values &&
                'object' == typeof t.values &&
                !Array.isArray(t.values)
            )
                return {
                    schema: String(t.schema || '').trim() || p,
                    values: t.values,
                };
        } catch (e) {
            return null;
        }
        return null;
    }
    function f(e) {
        const t = i(e);
        return String(t?.clinic_id || '').trim() || 'default-clinic';
    }
    function b(e, t, n = {}) {
        const a =
                'function' == typeof n.normalizeValue
                    ? n.normalizeValue
                    : (e) => e,
            o = Object.prototype.hasOwnProperty.call(n, 'fallbackValue')
                ? n.fallbackValue
                : null,
            i = f(t);
        try {
            const t = localStorage.getItem(String(e || ''));
            if (null === t) return o;
            const n = m(t);
            return n
                ? Object.prototype.hasOwnProperty.call(n.values, i)
                    ? a(n.values[i], o)
                    : o
                : a(t, o);
        } catch (e) {
            return o;
        }
    }
    function g(e, t, n) {
        const a = f(t),
            o = String(e || '');
        if (!o) return !1;
        try {
            const e = m(localStorage.getItem(o)) || { schema: p, values: {} };
            return (
                (e.values[a] = n),
                localStorage.setItem(o, JSON.stringify(e)),
                !0
            );
        } catch (e) {
            return !1;
        }
    }
    const y = 'queueDisplayBellMuted',
        h = 'queueDisplayLastSnapshot',
        S = 'displayAnnouncementInlineStyles',
        v = 'displayStarInlineStyles',
        w = 'display-bell-flash',
        x = {
            lastCalledSignature: '',
            callBaselineReady: !1,
            audioContext: null,
            pollingId: 0,
            clockId: 0,
            pollingEnabled: !1,
            failureStreak: 0,
            refreshBusy: !1,
            manualRefreshBusy: !1,
            lastHealthySyncAt: 0,
            bellMuted: !1,
            lastSnapshot: null,
            connectionState: 'paused',
            lastConnectionMessage: '',
            lastRenderedSignature: '',
            bellFlashId: 0,
            lastBellAt: 0,
            lastBellBlockedHintAt: 0,
            bellPrimed: !1,
            lastBellSource: '',
            lastBellOutcome: 'idle',
            clinicProfile: null,
            lastRenderedState: null,
        };
    let A = null;
    function k(e, t = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'display',
                        event: String(e || 'unknown'),
                        at: new Date().toISOString(),
                        ...t,
                    },
                })
            );
        } catch (e) {}
    }
    function C(e) {
        return document.getElementById(e);
    }
    function _(e) {
        return 1 !== Number(e || 0) && 2 !== Number(e || 0)
            ? 'Recepcion'
            : c(x.clinicProfile, e);
    }
    function M(e = x.clinicProfile) {
        return u(e, 'display');
    }
    function T() {
        return 'alert' === M().state;
    }
    function L(e, t = !1) {
        return (
            !0 === e ||
            1 === e ||
            '1' === e ||
            'true' === e ||
            (!1 !== e && 0 !== e && '0' !== e && 'false' !== e && Boolean(t))
        );
    }
    function E(e) {
        const t = (function (e) {
            if (!e) return null;
            if ('object' == typeof e) return e;
            if ('string' != typeof e || !e.trim()) return null;
            try {
                const t = JSON.parse(e);
                return t && 'object' == typeof t ? t : null;
            } catch (e) {
                return null;
            }
        })(e);
        if (!t || Array.isArray(t)) return null;
        const n = Date.parse(String(t.savedAt || ''));
        return Number.isFinite(n)
            ? Date.now() - n > 216e5
                ? null
                : { savedAt: new Date(n).toISOString(), data: ne(t.data || {}) }
            : null;
    }
    function B() {
        const e =
            `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
        return e.includes('android') ||
            e.includes('google tv') ||
            e.includes('aft')
            ? 'android_tv'
            : 'web';
    }
    function N() {
        const e = String(x.connectionState || 'paused'),
            t = Boolean(x.lastHealthySyncAt),
            n = M(),
            a = String(x.clinicProfile?.clinic_id || '').trim(),
            o = String(
                x.clinicProfile?.branding?.name ||
                    x.clinicProfile?.branding?.short_name ||
                    ''
            ).trim(),
            i = s(x.clinicProfile),
            l = String(
                x.clinicProfile?.runtime_meta?.source || 'remote'
            ).trim();
        let r = 'warning',
            c = 'Sala TV pendiente de validación.';
        return (
            'alert' === n.state
                ? ((r = 'alert'), (c = n.detail))
                : 'offline' === e
                  ? ((r = 'alert'),
                    (c =
                        'Sala TV sin conexión; usa respaldo local y confirma llamados manuales.'))
                  : x.bellMuted
                    ? ((r = 'warning'),
                      (c =
                          'La campanilla está en silencio; reactivarla antes de operar.'))
                    : 'blocked' !== x.lastBellOutcome && x.bellPrimed
                      ? 'live' === e &&
                        t &&
                        ((r = 'ready'),
                        (c =
                            'Sala TV lista: cola en vivo, audio activo y respaldo local disponible.'))
                      : ((r = 'alert'),
                        (c =
                            'La TV no confirmó audio; repite la prueba de campanilla.')),
            {
                instance: 'main',
                deviceLabel: 'Sala TV TCL C655',
                appMode: B(),
                status: r,
                summary: c,
                networkOnline: !1 !== navigator.onLine,
                lastEvent:
                    'played' === x.lastBellOutcome
                        ? 'bell_ok'
                        : 'blocked' === x.lastBellOutcome
                          ? 'bell_blocked'
                          : 'heartbeat',
                lastEventAt:
                    x.lastBellAt > 0
                        ? new Date(x.lastBellAt).toISOString()
                        : new Date().toISOString(),
                details: {
                    connection: e,
                    bellMuted: Boolean(x.bellMuted),
                    bellPrimed: Boolean(x.bellPrimed),
                    bellOutcome: String(x.lastBellOutcome || 'idle'),
                    healthySync: t,
                    clinicId: a,
                    clinicName: o,
                    profileSource: l,
                    profileFingerprint: i,
                    surfaceContractState: String(n.state || ''),
                    surfaceRouteExpected: String(n.expectedRoute || ''),
                    surfaceRouteCurrent: String(n.currentRoute || ''),
                },
            }
        );
    }
    function $() {
        return (
            A ||
            ((A = (function ({
                surface: n,
                intervalMs: a = 15e3,
                getPayload: o,
            } = {}) {
                const i = (function (e) {
                        const t = String(e || '')
                            .trim()
                            .toLowerCase();
                        return 'sala_tv' === t ? 'display' : t || 'operator';
                    })(n),
                    l = (function (t) {
                        const n = `queueSurfaceDeviceIdV1:${t}`;
                        try {
                            const a = localStorage.getItem(n);
                            if (a) return a;
                            const o = e(t);
                            return (localStorage.setItem(n, o), o);
                        } catch (n) {
                            return e(t);
                        }
                    })(i),
                    r = Math.max(5e3, Number(a || 15e3));
                let s = 0,
                    c = !1,
                    d = 0,
                    u = !1;
                async function p(e = 'interval', { keepalive: n = !1 } = {}) {
                    if (c) return !1;
                    c = !0;
                    try {
                        return (
                            !!(
                                await fetch(
                                    `/api.php?resource=${encodeURIComponent('queue-surface-heartbeat')}`,
                                    {
                                        method: 'POST',
                                        credentials: 'same-origin',
                                        keepalive: n,
                                        headers: {
                                            Accept: 'application/json',
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(t(i, l, o, e)),
                                    }
                                )
                            ).ok && ((d = Date.now()), !0)
                        );
                    } catch (e) {
                        return !1;
                    } finally {
                        c = !1;
                    }
                }
                function m() {
                    'visible' === document.visibilityState && p('visible');
                }
                function f() {
                    p('online');
                }
                function b() {
                    p('unload', { keepalive: !0 });
                }
                function g() {
                    (s && (window.clearInterval(s), (s = 0)),
                        u &&
                            ((u = !1),
                            document.removeEventListener('visibilitychange', m),
                            window.removeEventListener('online', f),
                            window.removeEventListener('beforeunload', b)));
                }
                return {
                    start: function ({ immediate: e = !0 } = {}) {
                        (g(),
                            u ||
                                ((u = !0),
                                document.addEventListener(
                                    'visibilitychange',
                                    m
                                ),
                                window.addEventListener('online', f),
                                window.addEventListener('beforeunload', b)),
                            e && p('boot'),
                            (s = window.setInterval(() => {
                                'hidden' !== document.visibilityState &&
                                    p('interval');
                            }, r)));
                    },
                    stop: g,
                    notify: function (e = 'state_change') {
                        Date.now() - d < 4e3 || p(e);
                    },
                    beatNow: (e = 'manual') => p(e),
                    getDeviceId: () => l,
                };
            })({ surface: 'display', intervalMs: 15e3, getPayload: N })),
            A)
        );
    }
    function R(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function H(e) {
        const t = String(e || '')
            .trim()
            .toUpperCase();
        return (t && t.replace(/[^A-Z0-9-]/g, '')) || '--';
    }
    function I(e) {
        const t = String(e || '').trim();
        if (!t) return '--';
        const n = t
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!n) return '--';
        const a = n.split(/[\s-]+/).filter(Boolean);
        let o = '';
        if (a.length >= 2)
            o = `${String(a[0] || '').charAt(0)}${String(a[a.length - 1] || '').charAt(0)}`;
        else if (1 === a.length) {
            const e = String(a[0] || '').replace(/[^A-Za-z0-9]/g, '');
            if (!e) return '--';
            o = e.length <= 3 && e === e.toUpperCase() ? e : e.slice(0, 2);
        }
        const i = o.toUpperCase().trim();
        return i ? i.slice(0, 3) : '--';
    }
    function P(e, t) {
        if (!e || 'object' != typeof e || !Array.isArray(t)) return [];
        for (const n of t) if (n && Array.isArray(e[n])) return e[n];
        return [];
    }
    function O(e, t) {
        if (!e || 'object' != typeof e || !Array.isArray(t)) return null;
        for (const n of t) {
            if (!n) continue;
            const t = e[n];
            if (t && 'object' == typeof t && !Array.isArray(t)) return t;
        }
        return null;
    }
    function D(e, t, n = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(t))
            return Number(n || 0);
        for (const n of t) {
            if (!n) continue;
            const t = Number(e[n]);
            if (Number.isFinite(t)) return t;
        }
        return Number(n || 0);
    }
    function j(e) {
        const t = e && 'object' == typeof e ? e : {},
            n = O(t, ['counts']) || {},
            a = D(t, ['waitingCount', 'waiting_count'], Number.NaN),
            o = D(t, ['calledCount', 'called_count'], Number.NaN);
        let i = P(t, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === i.length) {
            const e = O(t, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (i = Object.values(e).filter(Boolean));
        }
        const l = P(t, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            r = Number.isFinite(a)
                ? a
                : D(n, ['waiting', 'waiting_count'], l.length),
            s = Number.isFinite(o)
                ? o
                : D(n, ['called', 'called_count'], i.length);
        return {
            updatedAt:
                String(t.updatedAt || t.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(r || 0)),
            calledCount: Math.max(0, Number(s || 0)),
            callingNow: Array.isArray(i)
                ? i.map((e) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: H(e?.ticketCode || e?.ticket_code || '--'),
                      patientInitials: I(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      assignedConsultorio:
                          Number(
                              e?.assignedConsultorio ??
                                  e?.assigned_consultorio ??
                                  0
                          ) || null,
                      calledAt: String(e?.calledAt || e?.called_at || ''),
                  }))
                : [],
            nextTickets: Array.isArray(l)
                ? l.map((e, t) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: H(e?.ticketCode || e?.ticket_code || '--'),
                      patientInitials: I(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      position:
                          Number(e?.position || 0) > 0
                              ? Number(e.position)
                              : t + 1,
                  }))
                : [],
        };
    }
    function q(e, t) {
        const n = C('displayConnectionState');
        if (!n) return;
        const a = String(e || 'live').toLowerCase(),
            o = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            },
            i = String(t || '').trim() || o[a] || o.live,
            l = a !== x.connectionState || i !== x.lastConnectionMessage;
        ((x.connectionState = a),
            (x.lastConnectionMessage = i),
            (n.dataset.state = a),
            (n.textContent = i),
            l && k('connection_state', { state: a, message: i }),
            W());
    }
    function V() {
        let e = C('displayOpsHint');
        if (e) return e;
        const t = C('displayUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function z() {
        if (document.getElementById(v)) return;
        const e = document.createElement('style');
        ((e.id = v),
            (e.textContent = `\n        body[data-display-mode='star'] .display-header {\n            border-bottom-color: color-mix(in srgb, var(--accent) 18%, var(--border));\n            box-shadow: 0 10px 32px rgb(16 36 61 / 10%);\n        }\n        body[data-display-mode='star'] .display-brand strong {\n            letter-spacing: -0.02em;\n        }\n        body[data-display-mode='star'] .display-privacy-pill {\n            width: fit-content;\n            border: 1px solid color-mix(in srgb, var(--accent) 24%, #fff 76%);\n            border-radius: 999px;\n            padding: 0.22rem 0.66rem;\n            background: color-mix(in srgb, var(--accent-soft) 90%, #fff 10%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n            font-size: 0.83rem;\n            font-weight: 600;\n            line-height: 1.3;\n        }\n        body[data-display-mode='star'] .display-layout {\n            gap: 1.1rem;\n        }\n        body[data-display-mode='star'] .display-panel {\n            border-radius: 22px;\n            padding: 1.12rem;\n        }\n        body[data-display-mode='star'] .display-next-list li {\n            min-height: 68px;\n        }\n        #displayMetrics {\n            margin: 0.7rem 1.35rem 0;\n            display: flex;\n            flex-wrap: wrap;\n            gap: 0.56rem;\n        }\n        .display-metric-chip {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.36rem 0.7rem;\n            background: var(--surface-soft);\n            color: var(--muted);\n            font-size: 0.9rem;\n            font-weight: 600;\n        }\n        .display-metric-chip strong {\n            color: var(--text);\n            font-size: 1.02rem;\n            margin-left: 0.28rem;\n        }\n        .display-metric-chip[data-kind='active'] {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            background: color-mix(in srgb, var(--accent-soft) 88%, #fff 12%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n        }\n        .display-metric-chip[data-kind='active'] strong {\n            color: var(--accent);\n        }\n        #displayAnnouncement .display-announcement-support {\n            margin: 0.24rem 0 0;\n            color: var(--muted);\n            font-size: clamp(0.98rem, 1.45vw, 1.15rem);\n            font-weight: 500;\n            line-height: 1.3;\n        }\n        #displayAnnouncement.is-live .display-announcement-support {\n            color: color-mix(in srgb, var(--accent) 60%, var(--muted) 40%);\n        }\n        body.${w} .display-header {\n            box-shadow:\n                0 0 0 2px color-mix(in srgb, var(--accent) 34%, #fff 66%),\n                0 14px 34px rgb(16 36 61 / 18%);\n        }\n        body.${w} #displayAnnouncement {\n            border-color: color-mix(in srgb, var(--accent) 45%, #fff 55%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            transform: translateY(-1px);\n        }\n        body.${w} .display-called-card.is-live {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 14%);\n        }\n        @media (max-width: 720px) {\n            #displayMetrics {\n                margin: 0.56rem 0.9rem 0;\n            }\n        }\n    `),
            document.head.appendChild(e));
    }
    function F() {
        let e = C('displayAnnouncement');
        if (e instanceof HTMLElement) return e;
        const t = document.querySelector('.display-layout');
        return t instanceof HTMLElement
            ? ((function () {
                  if (document.getElementById(S)) return;
                  const e = document.createElement('style');
                  ((e.id = S),
                      (e.textContent =
                          '\n        #displayAnnouncement {\n            margin: 0.75rem 1.35rem 0;\n            padding: 1rem 1.2rem;\n            border-radius: 18px;\n            border: 1px solid color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            background: linear-gradient(120deg, color-mix(in srgb, var(--accent-soft) 92%, #fff 8%), #fff);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 11%);\n        }\n        #displayAnnouncement .display-announcement-label {\n            margin: 0;\n            color: var(--muted);\n            font-size: 0.96rem;\n            font-weight: 600;\n            letter-spacing: 0.02em;\n        }\n        #displayAnnouncement .display-announcement-text {\n            margin: 0.24rem 0 0;\n            font-size: clamp(1.34rem, 2.5vw, 2.15rem);\n            line-height: 1.18;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            color: var(--text);\n        }\n        #displayAnnouncement.is-live .display-announcement-text {\n            color: var(--accent);\n        }\n        #displayAnnouncement.is-bell {\n            border-color: color-mix(in srgb, var(--accent) 40%, #fff 60%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, #fff 78%);\n        }\n        #displayAnnouncement.is-idle {\n            border-color: var(--border);\n            background: linear-gradient(160deg, var(--surface-soft), #fff);\n        }\n        #displayAnnouncement.is-blocked {\n            border-color: color-mix(in srgb, var(--danger) 50%, #fff 50%);\n            background:\n                linear-gradient(160deg, rgb(239 107 107 / 14%), rgb(255 255 255 / 5%)),\n                var(--surface-soft);\n        }\n        #displayAnnouncement.is-blocked .display-announcement-text {\n            color: #ffd7d7;\n        }\n        #displayAnnouncement.is-blocked .display-announcement-support {\n            color: #ffd7d7;\n        }\n        @media (max-width: 720px) {\n            #displayAnnouncement {\n                margin: 0.6rem 0.9rem 0;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            #displayAnnouncement {\n                transition: none !important;\n            }\n        }\n    '),
                      document.head.appendChild(e));
              })(),
              z(),
              (e = document.createElement('section')),
              (e.id = 'displayAnnouncement'),
              (e.className = 'display-announcement is-idle'),
              e.setAttribute('role', 'status'),
              e.setAttribute('aria-live', 'assertive'),
              e.setAttribute('aria-atomic', 'true'),
              (e.innerHTML =
                  '\n        <p class="display-announcement-label">Llamando ahora</p>\n        <p class="display-announcement-text">Esperando siguiente llamado...</p>\n        <p class="display-announcement-support">Consulta la pantalla para el consultorio asignado.</p>\n    '),
              t.insertAdjacentElement('beforebegin', e),
              e)
            : null;
    }
    function U(e) {
        const t = F();
        if (!(t instanceof HTMLElement)) return;
        const n = t.querySelector('.display-announcement-text'),
            a = t.querySelector('.display-announcement-support');
        if (!(n instanceof HTMLElement)) return;
        if (!e) {
            (t.classList.add('is-idle'),
                t.classList.remove('is-live'),
                t.classList.remove('is-blocked'),
                delete t.dataset.consultorio);
            const e = 'Esperando siguiente llamado...',
                o = 'Consulta la pantalla para el consultorio asignado.';
            return (
                n.textContent !== e &&
                    ((n.textContent = e),
                    k('announcement_update', { mode: 'idle' })),
                void (
                    a instanceof HTMLElement &&
                    a.textContent !== o &&
                    (a.textContent = o)
                )
            );
        }
        const o = Number(e?.assignedConsultorio || 0),
            i = _(o),
            l = H(e?.ticketCode || '--'),
            r = `${i} · Turno ${l}`,
            s = `Paciente ${I(e?.patientInitials || '--')}: pasa con calma al ${i}.`;
        (t.classList.remove('is-idle'),
            t.classList.add('is-live'),
            t.classList.remove('is-blocked'),
            (t.dataset.consultorio = String(o || '')),
            n.textContent !== r &&
                ((n.textContent = r),
                k('announcement_update', {
                    mode: 'live',
                    consultorio: o,
                    ticketCode: l,
                })),
            a instanceof HTMLElement &&
                a.textContent !== s &&
                (a.textContent = s));
    }
    function J(e) {
        const t = V();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function W() {
        const e = C('displaySetupTitle'),
            t = C('displaySetupSummary'),
            n = C('displaySetupChecks');
        if (
            !(
                e instanceof HTMLElement &&
                t instanceof HTMLElement &&
                n instanceof HTMLElement
            )
        )
            return;
        const a = String(x.connectionState || 'paused'),
            o = String(x.lastConnectionMessage || 'Sincronizacion pendiente'),
            i = x.lastBellAt > 0 ? se(Date.now() - x.lastBellAt) : '',
            l = u(x.clinicProfile, 'display'),
            r = Date.parse(String(x.lastSnapshot?.savedAt || '')),
            s = Number.isFinite(r) ? se(Date.now() - r) : '',
            c = [
                {
                    label: 'Perfil de clínica',
                    state: 'alert' === l.state ? 'danger' : 'ready',
                    detail: l.detail,
                },
                {
                    label: 'Conexion y cola',
                    state:
                        'live' === a
                            ? x.lastHealthySyncAt
                                ? 'ready'
                                : 'warning'
                            : 'offline' === a
                              ? 'danger'
                              : 'warning',
                    detail:
                        'live' === a
                            ? x.lastHealthySyncAt
                                ? `Panel en vivo (${ce()}).`
                                : 'Conectado, pero esperando una sincronizacion saludable.'
                            : o,
                },
                {
                    label: 'Audio del TV',
                    state: x.bellPrimed ? 'ready' : 'warning',
                    detail: x.bellPrimed
                        ? 'Audio desbloqueado para WebView/navegador.'
                        : 'Toca "Probar campanilla" una vez para habilitar audio en la TCL C655.',
                },
                {
                    label: 'Campanilla',
                    state: x.bellMuted
                        ? 'warning'
                        : 'played' === x.lastBellOutcome
                          ? 'ready'
                          : 'blocked' === x.lastBellOutcome
                            ? 'danger'
                            : 'warning',
                    detail: x.bellMuted
                        ? 'Esta en silencio. Reactivala antes de operar la sala.'
                        : 'played' === x.lastBellOutcome
                          ? `Prueba sonora confirmada${i ? ` · hace ${i}` : ''}.`
                          : 'blocked' === x.lastBellOutcome
                            ? 'El audio fue bloqueado. Repite la prueba sonora en la TV.'
                            : 'Todavia no hay prueba sonora confirmada.',
                },
                {
                    label: 'Respaldo local',
                    state: Number.isFinite(r) ? 'ready' : 'warning',
                    detail: Number.isFinite(r)
                        ? `Ultimo respaldo local ${s} de antiguedad.`
                        : 'Aun sin snapshot local para contingencia.',
                },
            ];
        let d = 'Finaliza la puesta en marcha',
            p =
                'Confirma conexion, audio y campanilla antes de dejar la TV en operacion continua.';
        ('alert' === l.state
            ? ((d =
                  'profile_missing' === l.reason
                      ? 'Perfil de clínica no cargado'
                      : 'Ruta del piloto incorrecta'),
              (p = l.detail))
            : 'offline' === a
              ? ((d = 'Sala TV en contingencia'),
                (p =
                    'La TV puede seguir mostrando respaldo local, pero el enlace con la cola no esta disponible.'))
              : x.bellMuted
                ? ((d = 'Campanilla en silencio'),
                  (p =
                      'La campanilla esta apagada. Reactivala antes de iniciar llamados reales.'))
                : 'blocked' !== x.lastBellOutcome && x.bellPrimed
                  ? 'played' !== x.lastBellOutcome || x.lastBellAt <= 0
                      ? ((d = 'Falta probar la campanilla'),
                        (p =
                            'Ejecuta "Probar campanilla" y confirma sonido en sala antes de abrir pacientes.'))
                      : 'live' === a &&
                        x.lastHealthySyncAt &&
                        ((d = 'Sala TV lista para llamados'),
                        (p =
                            'La cola esta en vivo, la campanilla ya respondio y la TV tiene respaldo local para contingencia.'))
                  : ((d = 'Falta habilitar audio'),
                    (p =
                        'Haz una prueba sonora en la TCL C655 para desbloquear audio y confirmar volumen.')),
            (e.textContent = d),
            (t.textContent = p),
            (n.innerHTML = c
                .map(
                    (e) =>
                        `\n                <article class="display-setup-check" data-state="${R(e.state)}" role="listitem">\n                    <strong>${R(e.label)}</strong>\n                    <span>${R(e.detail)}</span>\n                </article>\n            `
                )
                .join('')),
            (function (e = 'state_change') {
                $().notify(e);
            })('setup_status'));
    }
    function G() {
        let e = C('displayMetrics');
        if (e instanceof HTMLElement) return e;
        const t = F();
        return t instanceof HTMLElement
            ? (z(),
              (e = document.createElement('section')),
              (e.id = 'displayMetrics'),
              (e.className = 'display-metrics'),
              e.setAttribute('aria-live', 'polite'),
              (e.innerHTML =
                  '\n        <span class="display-metric-chip" data-kind="waiting">\n            En cola\n            <strong data-metric="waiting">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="active">\n            Llamando\n            <strong data-metric="active">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="next">\n            Siguientes\n            <strong data-metric="next">0</strong>\n        </span>\n    '),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function K(e, t, n) {
        if (!(e instanceof HTMLElement)) return;
        const a = e.querySelector(`[data-metric="${t}"]`);
        if (!(a instanceof HTMLElement)) return;
        const o = String(Math.max(0, Number(n || 0)));
        a.textContent !== o && (a.textContent = o);
    }
    function Z(e) {
        const t = G();
        if (!(t instanceof HTMLElement)) return;
        const n = j(e),
            a = Number(n.waitingCount || 0),
            o = Array.isArray(n.callingNow) ? n.callingNow.length : 0,
            i = Array.isArray(n.nextTickets) ? n.nextTickets.length : 0;
        (K(t, 'waiting', a), K(t, 'active', o), K(t, 'next', i));
    }
    function Y() {
        let e = C('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
            ? ((e = document.createElement('button')),
              (e.id = 'displayManualRefreshBtn'),
              (e.type = 'button'),
              (e.className = 'display-control-btn'),
              (e.textContent = 'Refrescar panel'),
              e.setAttribute(
                  'aria-label',
                  'Refrescar estado de turnos en pantalla'
              ),
              t.appendChild(e),
              e)
            : null;
    }
    function Q(e) {
        const t = Y();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function X() {
        let e = C('displayBellToggleBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
            ? ((e = document.createElement('button')),
              (e.id = 'displayBellToggleBtn'),
              (e.type = 'button'),
              (e.className = 'display-control-btn display-control-btn-muted'),
              e.setAttribute('aria-label', 'Alternar campanilla de llamados'),
              t.appendChild(e),
              e)
            : null;
    }
    function ee() {
        const e = X();
        e instanceof HTMLButtonElement &&
            ((e.textContent = x.bellMuted
                ? 'Campanilla: Off'
                : 'Campanilla: On'),
            (e.dataset.state = x.bellMuted ? 'muted' : 'enabled'),
            e.setAttribute('aria-pressed', String(x.bellMuted)),
            (e.title = x.bellMuted
                ? 'Campanilla en silencio'
                : 'Campanilla activa'),
            W());
    }
    function te() {
        !(function (e, { announce: t = !1 } = {}) {
            ((x.bellMuted = Boolean(e)),
                g(y, x.clinicProfile, x.bellMuted ? '1' : '0'),
                ee(),
                k('bell_muted_changed', { muted: x.bellMuted, announce: t }),
                t &&
                    J(
                        x.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!x.bellMuted, { announce: !0 });
    }
    function ne(e) {
        const t = j(e);
        return {
            updatedAt: String(t.updatedAt || new Date().toISOString()),
            waitingCount: Number(t.waitingCount || 0),
            calledCount: Number(t.calledCount || 0),
            callingNow: Array.isArray(t.callingNow) ? t.callingNow : [],
            nextTickets: Array.isArray(t.nextTickets) ? t.nextTickets : [],
        };
    }
    function ae(e, { mode: t = 'restore' } = {}) {
        if (T()) return (le(), !1);
        if (!e?.data) return !1;
        ge(e.data);
        const n = Math.max(0, Date.now() - Date.parse(String(e.savedAt || ''))),
            a = se(n);
        return (
            q('reconnecting', 'Respaldo local activo'),
            J(
                'startup' === t
                    ? `Mostrando respaldo local (${a}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${a}).`
            ),
            k('snapshot_restored', { mode: t, ageMs: n }),
            !0
        );
    }
    function oe() {
        let e = C('displaySnapshotHint');
        if (e instanceof HTMLElement) return e;
        const t = V();
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displaySnapshotHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Respaldo: sin datos locales'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function ie() {
        const e = oe();
        if (!(e instanceof HTMLElement)) return;
        if (!x.lastSnapshot?.savedAt)
            return ((e.textContent = 'Respaldo: sin datos locales'), void W());
        const t = Date.parse(String(x.lastSnapshot.savedAt || ''));
        if (!Number.isFinite(t))
            return ((e.textContent = 'Respaldo: sin datos locales'), void W());
        ((e.textContent = `Respaldo: ${se(Date.now() - t)} de antiguedad`),
            W());
    }
    function le() {
        const e = (function () {
            const e = M();
            return 'alert' !== e.state
                ? ''
                : 'profile_missing' === e.reason
                  ? 'Pantalla bloqueada: clinic-profile.json remoto ausente. Corrige el perfil y recarga antes de mostrar llamados.'
                  : `Pantalla bloqueada: la ruta no coincide con el canon del piloto (${e.expectedRoute || '/sala-turnos.html'}). Corrige el acceso antes de usar esta TV.`;
        })();
        ((x.lastRenderedState = null),
            (x.lastRenderedSignature = ''),
            (x.lastCalledSignature = ''),
            (x.callBaselineReady = !0),
            pe(),
            de('displayConsultorio1', null, _(1)),
            de('displayConsultorio2', null, _(2)),
            (function (e) {
                const t = F();
                if (!(t instanceof HTMLElement)) return;
                const n = t.querySelector('.display-announcement-text'),
                    a = t.querySelector('.display-announcement-support');
                if (!(n instanceof HTMLElement)) return;
                const o = 'Pantalla bloqueada',
                    i =
                        String(e || '').trim() ||
                        'Corrige el perfil por clínica antes de usar esta TV.';
                (t.classList.remove('is-live', 'is-idle'),
                    t.classList.add('is-blocked'),
                    delete t.dataset.consultorio,
                    n.textContent !== o &&
                        ((n.textContent = o),
                        k('announcement_update', { mode: 'blocked' })),
                    a instanceof HTMLElement &&
                        a.textContent !== i &&
                        (a.textContent = i));
            })(e));
        const t = C('displayNextList');
        (t &&
            (t.innerHTML = `<li class="display-empty display-empty-blocked">${R(e || 'Pantalla bloqueada por configuración del piloto.')}</li>`),
            Z({ waitingCount: 0, callingNow: [], nextTickets: [] }),
            q('paused', 'Pantalla bloqueada'),
            J(e));
    }
    function re({ announce: e = !1 } = {}) {
        ((x.lastSnapshot = null),
            (x.lastRenderedSignature = ''),
            (function (e, t) {
                const n = f(t),
                    a = String(e);
                if (!a) return !1;
                try {
                    const e = m(localStorage.getItem(a));
                    return e
                        ? (delete e.values[n],
                          0 === Object.keys(e.values).length
                              ? (localStorage.removeItem(a), !0)
                              : (localStorage.setItem(a, JSON.stringify(e)),
                                !0))
                        : (localStorage.removeItem(a), !0);
                } catch (e) {
                    return !1;
                }
            })(h, x.clinicProfile),
            ie(),
            'live' !== x.connectionState &&
                ((function (e = 'No hay turnos pendientes.') {
                    ((x.lastRenderedSignature = ''),
                        (x.lastCalledSignature = ''),
                        (x.callBaselineReady = !0),
                        de('displayConsultorio1', null, _(1)),
                        de('displayConsultorio2', null, _(2)),
                        U(null));
                    const t = C('displayNextList');
                    (t &&
                        (t.innerHTML = `<li class="display-empty">${R(e)}</li>`),
                        Z({
                            waitingCount: 0,
                            callingNow: [],
                            nextTickets: [],
                        }));
                })('Sin respaldo local disponible.'),
                !1 === navigator.onLine
                    ? q('offline', 'Sin conexion')
                    : q('reconnecting', 'Sin respaldo local')),
            e &&
                J(
                    'Respaldo local limpiado. Esperando datos en vivo del backend.'
                ),
            k('snapshot_cleared', { announce: e }));
    }
    function se(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const a = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${a}m` : `${a}m ${o}s`;
    }
    function ce() {
        return x.lastHealthySyncAt
            ? `hace ${se(Date.now() - x.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function de(e, t, n) {
        const a = C(e);
        if (!a) return;
        if (!t)
            return void (a.innerHTML = `\n            <article class="display-called-card is-empty">\n                <h3>${n}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
        const o = Date.parse(String(t.calledAt || '')),
            i =
                Number.isFinite(o) && Date.now() - o <= 8e3
                    ? 'display-called-card is-live is-fresh'
                    : 'display-called-card is-live';
        a.innerHTML = `\n        <article class="${i}">\n            <h3>${n}</h3>\n            <strong>${R(t.ticketCode || '--')}</strong>\n            <span>${R(t.patientInitials || '--')}</span>\n        </article>\n    `;
    }
    function ue(e) {
        return e
            ? new Set(
                  String(e)
                      .split('|')
                      .map((e) => e.trim())
                      .filter(Boolean)
              )
            : new Set();
    }
    function pe() {
        (x.bellFlashId &&
            (window.clearTimeout(x.bellFlashId), (x.bellFlashId = 0)),
            document.body.classList.remove(w));
        const e = C('displayAnnouncement');
        e instanceof HTMLElement && e.classList.remove('is-bell');
    }
    async function me({ source: e = 'unknown' } = {}) {
        try {
            x.audioContext ||
                (x.audioContext = new (
                    window.AudioContext || window.webkitAudioContext
                )());
            const t = x.audioContext;
            return (
                'suspended' === t.state && (await t.resume()),
                (x.bellPrimed = 'running' === t.state),
                k('bell_audio_primed', { source: e, running: x.bellPrimed }),
                W(),
                x.bellPrimed
            );
        } catch (t) {
            return (
                (x.bellPrimed = !1),
                k('bell_audio_primed', { source: e, running: !1 }),
                W(),
                !1
            );
        }
    }
    function fe() {
        const e = Date.now();
        (x.lastBellBlockedHintAt > 0 && e - x.lastBellBlockedHintAt < 2e4) ||
            ((x.lastBellBlockedHintAt = e),
            (x.lastBellOutcome = 'blocked'),
            W(),
            J(
                'Audio bloqueado por navegador. Toca "Probar campanilla" una vez para habilitar sonido.'
            ));
    }
    async function be({ source: e = 'new_call', force: t = !1 } = {}) {
        if (T()) return;
        if (
            ((function () {
                const e = document.body;
                if (!(e instanceof HTMLElement)) return;
                (pe(), e.offsetWidth, e.classList.add(w));
                const t = C('displayAnnouncement');
                (t instanceof HTMLElement && t.classList.add('is-bell'),
                    (x.bellFlashId = window.setTimeout(() => {
                        pe();
                    }, 1300)));
            })(),
            x.bellMuted && !t)
        )
            return;
        const n = Date.now();
        if (!(!t && x.lastBellAt > 0 && n - x.lastBellAt < 1200))
            try {
                if (!(await me({ source: e })))
                    return ((x.lastBellSource = e), void fe());
                const t = x.audioContext,
                    n = t.currentTime,
                    a = t.createOscillator(),
                    o = t.createGain();
                ((a.type = 'sine'),
                    a.frequency.setValueAtTime(932, n),
                    o.gain.setValueAtTime(1e-4, n),
                    o.gain.exponentialRampToValueAtTime(0.16, n + 0.02),
                    o.gain.exponentialRampToValueAtTime(1e-4, n + 0.22),
                    a.connect(o),
                    o.connect(t.destination),
                    a.start(n),
                    a.stop(n + 0.24),
                    (x.lastBellAt = Date.now()),
                    (x.lastBellSource = e),
                    (x.lastBellOutcome = 'played'),
                    W(),
                    k('bell_played', { source: e, muted: x.bellMuted }));
            } catch (t) {
                ((x.lastBellSource = e), fe());
            }
    }
    function ge(e) {
        if (T()) return void le();
        const t = j(e);
        x.lastRenderedState = t;
        const n = (function (e) {
                const t = j(e),
                    n = Array.isArray(t.callingNow)
                        ? t.callingNow.map((e) => ({
                              id: Number(e?.id || 0),
                              ticketCode: String(e?.ticketCode || ''),
                              patientInitials: String(e?.patientInitials || ''),
                              consultorio: Number(e?.assignedConsultorio || 0),
                              calledAt: String(e?.calledAt || ''),
                          }))
                        : [],
                    a = Array.isArray(t.nextTickets)
                        ? t.nextTickets
                              .slice(0, 8)
                              .map((e) => ({
                                  id: Number(e?.id || 0),
                                  ticketCode: String(e?.ticketCode || ''),
                                  patientInitials: String(
                                      e?.patientInitials || ''
                                  ),
                                  position: Number(e?.position || 0),
                              }))
                        : [],
                    o = String(t.updatedAt || '');
                return JSON.stringify({
                    updatedAt: o,
                    callingNow: n,
                    nextTickets: a,
                });
            })(t),
            a = n === x.lastRenderedSignature,
            o = Array.isArray(t.callingNow) ? t.callingNow : [],
            i = { 1: null, 2: null };
        for (const e of o) {
            const t = Number(e?.assignedConsultorio || 0);
            (1 !== t && 2 !== t) || (i[t] = e);
        }
        const l = (function (e, t) {
            const n = Array.isArray(e) ? e.filter(Boolean) : [];
            if (0 === n.length) return null;
            let a = n[0],
                o = Number.NEGATIVE_INFINITY;
            for (const e of n) {
                const t = Date.parse(String(e?.calledAt || ''));
                Number.isFinite(t) && t >= o && ((o = t), (a = e));
            }
            return Number.isFinite(o) ? a : t[1] || t[2] || a;
        })(o, i);
        (a ||
            (de('displayConsultorio1', i[1], _(1)),
            de('displayConsultorio2', i[2], _(2)),
            (function (e) {
                const t = C('displayNextList');
                t &&
                    (Array.isArray(e) && 0 !== e.length
                        ? (t.innerHTML = e
                              .slice(0, 8)
                              .map(
                                  (e) =>
                                      `\n                <li>\n                    <span class="next-code">${R(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${R(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${R(e.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (t.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(t?.nextTickets || []),
            (function (e) {
                const t = C('displayUpdatedAt');
                if (!t) return;
                const n = j(e),
                    a = Date.parse(String(n.updatedAt || ''));
                Number.isFinite(a)
                    ? (t.textContent = `Actualizado ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (t.textContent = 'Actualizacion pendiente');
            })(t),
            (x.lastRenderedSignature = n),
            k('render_update', {
                callingNowCount: o.length,
                nextCount: Array.isArray(t?.nextTickets)
                    ? t.nextTickets.length
                    : 0,
            })),
            U(l),
            Z(t));
        const r = (function (e) {
            return Array.isArray(e) && 0 !== e.length
                ? e
                      .map((e) => {
                          const t = String(e.assignedConsultorio || '-'),
                              n = Number(e.id || 0),
                              a = H(e.ticketCode || '--');
                          return `${t}:${n > 0 ? `id-${n}` : `code-${a}`}`;
                      })
                      .sort()
                      .join('|')
                : '';
        })(o);
        if (!x.callBaselineReady)
            return (
                (x.lastCalledSignature = r),
                void (x.callBaselineReady = !0)
            );
        if (r !== x.lastCalledSignature) {
            const e = ue(x.lastCalledSignature),
                t = ue(r),
                n = [];
            for (const a of t) e.has(a) || n.push(a);
            (n.length > 0 && be({ source: 'new_call' }),
                k('called_signature_changed', {
                    signature: r,
                    added_count: n.length,
                }));
        }
        x.lastCalledSignature = r;
    }
    function ye() {
        const e = Math.max(0, Number(x.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function he() {
        x.pollingId && (window.clearTimeout(x.pollingId), (x.pollingId = 0));
    }
    function Se({ immediate: e = !1 } = {}) {
        if ((he(), !x.pollingEnabled)) return;
        const t = e ? 0 : ye();
        x.pollingId = window.setTimeout(() => {
            we();
        }, t);
    }
    async function ve() {
        if (T())
            return (
                le(),
                {
                    ok: !1,
                    stale: !1,
                    blocked: !0,
                    reason: 'pilot_blocked',
                    usedSnapshot: !1,
                }
            );
        if (x.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        x.refreshBusy = !0;
        try {
            const e = j(
                (
                    await (async function () {
                        const e = new URLSearchParams();
                        (e.set('resource', 'queue-state'),
                            e.set('t', String(Date.now())));
                        const t = await fetch(`/api.php?${e.toString()}`, {
                                method: 'GET',
                                credentials: 'same-origin',
                                headers: { Accept: 'application/json' },
                            }),
                            n = await t.text();
                        let a;
                        try {
                            a = n ? JSON.parse(n) : {};
                        } catch (e) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!t.ok || !1 === a.ok)
                            throw new Error(a.error || `HTTP ${t.status}`);
                        return a;
                    })()
                ).data || {}
            );
            (ge(e),
                (function (e) {
                    const t = ne(e),
                        n = { savedAt: new Date().toISOString(), data: t };
                    ((x.lastSnapshot = n), g(h, x.clinicProfile, n), ie());
                })(e));
            const t = (function (e) {
                const t = j(e),
                    n = Date.parse(String(t.updatedAt || ''));
                if (!Number.isFinite(n))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const a = Math.max(0, Date.now() - n);
                return { stale: a >= 3e4, missingTimestamp: !1, ageMs: a };
            })(e);
            return {
                ok: !0,
                stale: Boolean(t.stale),
                missingTimestamp: Boolean(t.missingTimestamp),
                ageMs: t.ageMs,
                usedSnapshot: !1,
            };
        } catch (e) {
            const t = ae(x.lastSnapshot, { mode: 'restore' });
            if (!t) {
                const t = C('displayNextList');
                t &&
                    (t.innerHTML = `<li class="display-empty">Sin conexion: ${R(e.message)}</li>`);
            }
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
                usedSnapshot: t,
            };
        } finally {
            x.refreshBusy = !1;
        }
    }
    async function we() {
        if (!x.pollingEnabled) return;
        if (T()) return void le();
        if (document.hidden)
            return (
                q('paused', 'En pausa (pestana oculta)'),
                J('Pantalla en pausa por pestana oculta.'),
                void Se()
            );
        if (!1 === navigator.onLine)
            return (
                (x.failureStreak += 1),
                ae(x.lastSnapshot, { mode: 'restore' }) ||
                    (q('offline', 'Sin conexion'),
                    J(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void Se()
            );
        const e = await ve();
        if (e.ok && !e.stale)
            ((x.failureStreak = 0),
                (x.lastHealthySyncAt = Date.now()),
                q('live', 'Conectado'),
                J(`Panel estable (${ce()}).`));
        else if (e.ok && e.stale) {
            x.failureStreak += 1;
            const t = se(e.ageMs || 0);
            (q('reconnecting', `Watchdog: datos estancados ${t}`),
                J(`Datos estancados ${t}. Verifica fuente de cola.`));
        } else {
            if (((x.failureStreak += 1), e.usedSnapshot)) return void Se();
            const t = Math.max(1, Math.ceil(ye() / 1e3));
            (q('reconnecting', `Reconectando en ${t}s`),
                J(`Conexion inestable. Reintento automatico en ${t}s.`));
        }
        Se();
    }
    async function xe() {
        if (!x.manualRefreshBusy)
            if (T()) le();
            else {
                ((x.manualRefreshBusy = !0),
                    Q(!0),
                    q('reconnecting', 'Refrescando panel...'));
                try {
                    const e = await ve();
                    if (e.ok && !e.stale)
                        return (
                            (x.failureStreak = 0),
                            (x.lastHealthySyncAt = Date.now()),
                            q('live', 'Conectado'),
                            void J(`Sincronizacion manual exitosa (${ce()}).`)
                        );
                    if (e.ok && e.stale) {
                        const t = se(e.ageMs || 0);
                        return (
                            q(
                                'reconnecting',
                                `Watchdog: datos estancados ${t}`
                            ),
                            void J(`Persisten datos estancados (${t}).`)
                        );
                    }
                    if (e.usedSnapshot) return;
                    const t = Math.max(1, Math.ceil(ye() / 1e3));
                    (q(
                        !1 === navigator.onLine ? 'offline' : 'reconnecting',
                        !1 === navigator.onLine
                            ? 'Sin conexion'
                            : `Reconectando en ${t}s`
                    ),
                        J(
                            !1 === navigator.onLine
                                ? 'Sin internet. Llamado manual temporal.'
                                : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                        ));
                } finally {
                    ((x.manualRefreshBusy = !1), Q(!1));
                }
            }
    }
    function Ae({ immediate: e = !0 } = {}) {
        if (((x.pollingEnabled = !0), e))
            return (q('live', 'Sincronizando...'), void we());
        Se();
    }
    function ke({ reason: e = 'paused' } = {}) {
        ((x.pollingEnabled = !1), (x.failureStreak = 0), he());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (q('offline', 'Sin conexion'),
              void J('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === t
              ? (q('paused', 'En pausa (pestana oculta)'),
                void J('Pantalla oculta. Reanuda al volver al frente.'))
              : (q('paused', 'En pausa'), void J('Sincronizacion pausada.'));
    }
    function Ce() {
        const e = C('displayClock');
        e &&
            (e.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        (!(function () {
            if (
                window.PielOpsTheme &&
                'function' == typeof window.PielOpsTheme.initAutoOpsTheme
            )
                return window.PielOpsTheme.initAutoOpsTheme({
                    surface: 'display',
                    family: 'ambient',
                    mode: 'system',
                });
            const e = window.matchMedia?.('(prefers-color-scheme: dark)')
                ?.matches
                ? 'dark'
                : 'light';
            (document.documentElement.setAttribute('data-theme-mode', 'system'),
                document.documentElement.setAttribute('data-theme', e),
                document.documentElement.setAttribute('data-ops-tone', e),
                document.documentElement.setAttribute(
                    'data-ops-family',
                    'ambient'
                ),
                document.body instanceof HTMLElement &&
                    (document.body.setAttribute('data-ops-tone', e),
                    document.body.setAttribute('data-ops-family', 'ambient')));
        })(),
            (document.body.dataset.displayMode = 'star'),
            z(),
            Ce(),
            (x.clockId = window.setInterval(Ce, 1e3)),
            V(),
            oe(),
            F(),
            G());
        const e = Y();
        e instanceof HTMLButtonElement &&
            e.addEventListener('click', () => {
                xe();
            });
        const t = X();
        t instanceof HTMLButtonElement &&
            t.addEventListener('click', () => {
                te();
            });
        const o = (function () {
            let e = C('displayBellTestBtn');
            if (e instanceof HTMLButtonElement) return e;
            const t = document.querySelector('.display-clock-wrap');
            return t
                ? ((e = document.createElement('button')),
                  (e.id = 'displayBellTestBtn'),
                  (e.type = 'button'),
                  (e.className =
                      'display-control-btn display-control-btn-muted'),
                  (e.textContent = 'Probar campanilla'),
                  e.setAttribute('aria-label', 'Probar campanilla de llamados'),
                  t.appendChild(e),
                  e)
                : null;
        })();
        o instanceof HTMLButtonElement &&
            o.addEventListener('click', () => {
                (be({ source: 'manual_test', force: !0 }),
                    J(
                        'Campanilla de prueba ejecutada. Si no escuchas sonido, revisa audio del equipo/TV.'
                    ));
            });
        const d = (function () {
            let e = C('displaySnapshotClearBtn');
            if (e instanceof HTMLButtonElement) return e;
            const t = document.querySelector('.display-clock-wrap');
            return t
                ? ((e = document.createElement('button')),
                  (e.id = 'displaySnapshotClearBtn'),
                  (e.type = 'button'),
                  (e.className =
                      'display-control-btn display-control-btn-muted'),
                  (e.textContent = 'Limpiar respaldo'),
                  e.setAttribute(
                      'aria-label',
                      'Limpiar respaldo local del panel'
                  ),
                  t.appendChild(e),
                  e)
                : null;
        })();
        (d instanceof HTMLButtonElement &&
            d.addEventListener('click', () => {
                re({ announce: !0 });
            }),
            ee(),
            ie(),
            W(),
            q('paused', 'Sincronizacion lista'),
            J('Cargando perfil de clinica...'));
        const u = () => {
            me({ source: 'user_gesture' });
        };
        (window.addEventListener('pointerdown', u, { once: !0 }),
            window.addEventListener('keydown', u, { once: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? ke({ reason: 'hidden' })
                    : x.clinicProfile && !T() && Ae({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                x.clinicProfile && !T() && Ae({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                ke({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (ke({ reason: 'paused' }),
                    A?.stop(),
                    x.clockId &&
                        (window.clearInterval(x.clockId), (x.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void xe())
                    : 'keym' === t
                      ? (e.preventDefault(), void te())
                      : 'keyb' === t
                        ? (e.preventDefault(),
                          be({ source: 'shortcut_test', force: !0 }),
                          void J('Campanilla de prueba ejecutada con teclado.'))
                        : void (
                              'keyx' === t &&
                              (e.preventDefault(), re({ announce: !0 }))
                          );
            }),
            (
                a ||
                ((a = fetch('/content/turnero/clinic-profile.json', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                })
                    .then(async (e) => {
                        if (!e.ok)
                            throw new Error(`clinic_profile_http_${e.status}`);
                        return e.json();
                    })
                    .then((e) => {
                        const t = i(e);
                        return {
                            ...t,
                            runtime_meta: {
                                source: 'remote',
                                profileFingerprint: s(t),
                            },
                        };
                    })
                    .catch(() => {
                        const e = i(n);
                        return {
                            ...e,
                            runtime_meta: {
                                source: 'fallback_default',
                                profileFingerprint: s(e),
                            },
                        };
                    })),
                a)
            ).then((e) => {
                ((function (e) {
                    x.clinicProfile = e;
                    const t = l(e),
                        n = r(e),
                        a =
                            String(e?.clinic_id || '').trim() ||
                            'sin-clinic-id',
                        o = String(e?.branding?.city || '').trim(),
                        i = [
                            c(e, 1, { short: !0 }),
                            c(e, 2, { short: !0 }),
                        ].join(' / ');
                    document.title = `Sala de Espera | ${t}`;
                    const d = document.querySelector('.display-brand strong');
                    d instanceof HTMLElement && (d.textContent = t);
                    const u = C('displayBrandMeta');
                    u instanceof HTMLElement &&
                        (u.textContent = `Vista pacientes · ${i}`);
                    const p = C('displayClinicMeta');
                    (p instanceof HTMLElement &&
                        (p.textContent = [a, o || n]
                            .filter(Boolean)
                            .join(' · ')),
                        (function (e) {
                            const t = M(e),
                                n = s(e).slice(0, 8),
                                a = C('displayProfileStatus');
                            a instanceof HTMLElement &&
                                ((a.dataset.state =
                                    'alert' === t.state
                                        ? 'alert'
                                        : 'ready' === t.state
                                          ? 'ready'
                                          : 'warning'),
                                (a.textContent =
                                    'alert' === t.state
                                        ? 'profile_missing' === t.reason
                                            ? 'Bloqueado · perfil de respaldo · clinic-profile.json remoto ausente'
                                            : `Bloqueado · ruta fuera de canon · se esperaba ${t.expectedRoute || '/sala-turnos.html'}`
                                        : `Perfil remoto verificado · firma ${n} · canon ${t.expectedRoute || '/sala-turnos.html'}`));
                        })(e),
                        x.lastRenderedState
                            ? ge(x.lastRenderedState)
                            : (de('displayConsultorio1', null, _(1)),
                              de('displayConsultorio2', null, _(2))));
                })(e),
                    (x.bellMuted = b(y, x.clinicProfile, {
                        fallbackValue: !1,
                        normalizeValue: L,
                    })),
                    (x.lastSnapshot = b(h, x.clinicProfile, {
                        fallbackValue: null,
                        normalizeValue: E,
                    })),
                    ie(),
                    x.lastSnapshot,
                    ee(),
                    ie(),
                    W(),
                    $().start({ immediate: !1 }),
                    T()
                        ? le()
                        : (ae(x.lastSnapshot, { mode: 'startup' }) ||
                              J('Esperando primera sincronizacion...'),
                          Ae({ immediate: !0 })));
            }));
    });
})();
