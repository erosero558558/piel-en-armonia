!(function () {
    'use strict';
    const e = 'queueDisplayBellMuted',
        t = 'queueDisplayLastSnapshot',
        n = {
            lastCalledSignature: '',
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
        };
    function a(e) {
        return document.getElementById(e);
    }
    function o(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function i(e, t) {
        const n = a('displayConnectionState');
        if (!n) return;
        const o = String(e || 'live').toLowerCase(),
            i = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            };
        ((n.dataset.state = o),
            (n.textContent = String(t || '').trim() || i[o] || i.live));
    }
    function s() {
        let e = a('displayOpsHint');
        if (e) return e;
        const t = a('displayUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function l(e) {
        const t = s();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function r() {
        let e = a('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
            ? ((e = document.createElement('button')),
              (e.id = 'displayManualRefreshBtn'),
              (e.type = 'button'),
              (e.textContent = 'Refrescar panel'),
              (e.style.justifySelf = 'end'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.34rem 0.55rem'),
              (e.style.background = 'rgb(24 39 67 / 64%)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              t.appendChild(e),
              e)
            : null;
    }
    function c(e) {
        const t = r();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function d() {
        let e = a('displayBellToggleBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
            ? ((e = document.createElement('button')),
              (e.id = 'displayBellToggleBtn'),
              (e.type = 'button'),
              (e.style.justifySelf = 'end'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.34rem 0.55rem'),
              (e.style.background = 'rgb(24 39 67 / 64%)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              (e.style.fontSize = '0.8rem'),
              (e.style.fontWeight = '600'),
              t.appendChild(e),
              e)
            : null;
    }
    function u() {
        const e = d();
        e instanceof HTMLButtonElement &&
            ((e.textContent = n.bellMuted
                ? 'Campanilla: Off'
                : 'Campanilla: On'),
            (e.dataset.state = n.bellMuted ? 'muted' : 'enabled'),
            e.setAttribute('aria-pressed', String(n.bellMuted)),
            (e.title = n.bellMuted
                ? 'Campanilla en silencio'
                : 'Campanilla activa'));
    }
    function p() {
        !(function (t, { announce: a = !1 } = {}) {
            ((n.bellMuted = Boolean(t)),
                localStorage.setItem(e, n.bellMuted ? '1' : '0'),
                u(),
                a &&
                    l(
                        n.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!n.bellMuted, { announce: !0 });
    }
    function f(e) {
        const t = e && 'object' == typeof e ? e : {};
        return {
            updatedAt: String(t.updatedAt || new Date().toISOString()),
            callingNow: Array.isArray(t.callingNow) ? t.callingNow : [],
            nextTickets: Array.isArray(t.nextTickets) ? t.nextTickets : [],
        };
    }
    function m(e, { mode: t = 'restore' } = {}) {
        if (!e?.data) return !1;
        h(e.data);
        const n = g(
            Math.max(0, Date.now() - Date.parse(String(e.savedAt || '')))
        );
        return (
            i('reconnecting', 'Respaldo local activo'),
            l(
                'startup' === t
                    ? `Mostrando respaldo local (${n}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${n}).`
            ),
            !0
        );
    }
    function g(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const a = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${a}m` : `${a}m ${o}s`;
    }
    function y() {
        return n.lastHealthySyncAt
            ? `hace ${g(Date.now() - n.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function S(e, t, n) {
        const i = a(e);
        i &&
            (i.innerHTML = t
                ? `\n        <article class="display-called-card">\n            <h3>${n}</h3>\n            <strong>${o(t.ticketCode || '--')}</strong>\n            <span>${o(t.patientInitials || '--')}</span>\n        </article>\n    `
                : `\n            <article class="display-called-card is-empty">\n                <h3>${n}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
    }
    function h(e) {
        const t = Array.isArray(e?.callingNow) ? e.callingNow : [],
            i = { 1: null, 2: null };
        for (const e of t) {
            const t = Number(e?.assignedConsultorio || 0);
            (1 !== t && 2 !== t) || (i[t] = e);
        }
        (S('displayConsultorio1', i[1], 'Consultorio 1'),
            S('displayConsultorio2', i[2], 'Consultorio 2'),
            (function (e) {
                const t = a('displayNextList');
                t &&
                    (Array.isArray(e) && 0 !== e.length
                        ? (t.innerHTML = e
                              .slice(0, 8)
                              .map(
                                  (e) =>
                                      `\n                <li>\n                    <span class="next-code">${o(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${o(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${o(e.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (t.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(e?.nextTickets || []),
            (function (e) {
                const t = a('displayUpdatedAt');
                if (!t) return;
                const n = Date.parse(String(e?.updatedAt || ''));
                Number.isFinite(n)
                    ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (t.textContent = 'Actualizacion pendiente');
            })(e));
        const s = (function (e) {
            return Array.isArray(e) && 0 !== e.length
                ? e
                      .map(
                          (e) =>
                              `${String(e.assignedConsultorio || '-')}:${String(e.ticketCode || '')}:${String(e.calledAt || '')}`
                      )
                      .sort()
                      .join('|')
                : '';
        })(t);
        (s &&
            s !== n.lastCalledSignature &&
            (function () {
                if (!n.bellMuted)
                    try {
                        n.audioContext ||
                            (n.audioContext = new (
                                window.AudioContext || window.webkitAudioContext
                            )());
                        const e = n.audioContext,
                            t = e.currentTime,
                            a = e.createOscillator(),
                            o = e.createGain();
                        ((a.type = 'sine'),
                            a.frequency.setValueAtTime(932, t),
                            o.gain.setValueAtTime(1e-4, t),
                            o.gain.exponentialRampToValueAtTime(0.16, t + 0.02),
                            o.gain.exponentialRampToValueAtTime(1e-4, t + 0.22),
                            a.connect(o),
                            o.connect(e.destination),
                            a.start(t),
                            a.stop(t + 0.24));
                    } catch (e) {}
            })(),
            (n.lastCalledSignature = s));
    }
    function w() {
        const e = Math.max(0, Number(n.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function v() {
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function M({ immediate: e = !1 } = {}) {
        if ((v(), !n.pollingEnabled)) return;
        const t = e ? 0 : w();
        n.pollingId = window.setTimeout(() => {
            x();
        }, t);
    }
    async function b() {
        if (n.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        n.refreshBusy = !0;
        try {
            const e =
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
                ).data || {};
            (h(e),
                (function (e) {
                    const a = f(e),
                        o = { savedAt: new Date().toISOString(), data: a };
                    n.lastSnapshot = o;
                    try {
                        localStorage.setItem(t, JSON.stringify(o));
                    } catch (e) {}
                })(e));
            const a = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(e);
            return {
                ok: !0,
                stale: Boolean(a.stale),
                missingTimestamp: Boolean(a.missingTimestamp),
                ageMs: a.ageMs,
                usedSnapshot: !1,
            };
        } catch (e) {
            const t = m(n.lastSnapshot, { mode: 'restore' });
            if (!t) {
                const t = a('displayNextList');
                t &&
                    (t.innerHTML = `<li class="display-empty">Sin conexion: ${o(e.message)}</li>`);
            }
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
                usedSnapshot: t,
            };
        } finally {
            n.refreshBusy = !1;
        }
    }
    async function x() {
        if (!n.pollingEnabled) return;
        if (document.hidden)
            return (
                i('paused', 'En pausa (pestana oculta)'),
                l('Pantalla en pausa por pestana oculta.'),
                void M()
            );
        if (!1 === navigator.onLine)
            return (
                (n.failureStreak += 1),
                m(n.lastSnapshot, { mode: 'restore' }) ||
                    (i('offline', 'Sin conexion'),
                    l(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void M()
            );
        const e = await b();
        if (e.ok && !e.stale)
            ((n.failureStreak = 0),
                (n.lastHealthySyncAt = Date.now()),
                i('live', 'Conectado'),
                l(`Panel estable (${y()}).`));
        else if (e.ok && e.stale) {
            n.failureStreak += 1;
            const t = g(e.ageMs || 0);
            (i('reconnecting', `Watchdog: datos estancados ${t}`),
                l(`Datos estancados ${t}. Verifica fuente de cola.`));
        } else {
            if (((n.failureStreak += 1), e.usedSnapshot)) return void M();
            const t = Math.max(1, Math.ceil(w() / 1e3));
            (i('reconnecting', `Reconectando en ${t}s`),
                l(`Conexion inestable. Reintento automatico en ${t}s.`));
        }
        M();
    }
    async function C() {
        if (!n.manualRefreshBusy) {
            ((n.manualRefreshBusy = !0),
                c(!0),
                i('reconnecting', 'Refrescando panel...'));
            try {
                const e = await b();
                if (e.ok && !e.stale)
                    return (
                        (n.failureStreak = 0),
                        (n.lastHealthySyncAt = Date.now()),
                        i('live', 'Conectado'),
                        void l(`Sincronizacion manual exitosa (${y()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = g(e.ageMs || 0);
                    return (
                        i('reconnecting', `Watchdog: datos estancados ${t}`),
                        void l(`Persisten datos estancados (${t}).`)
                    );
                }
                if (e.usedSnapshot) return;
                const t = Math.max(1, Math.ceil(w() / 1e3));
                (i(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${t}s`
                ),
                    l(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                ((n.manualRefreshBusy = !1), c(!1));
            }
        }
    }
    function A({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (i('live', 'Sincronizando...'), void x());
        M();
    }
    function k({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), v());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (i('offline', 'Sin conexion'),
              void l('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === t
              ? (i('paused', 'En pausa (pestana oculta)'),
                void l('Pantalla oculta. Reanuda al volver al frente.'))
              : (i('paused', 'En pausa'), void l('Sincronizacion pausada.'));
    }
    function E() {
        const e = a('displayClock');
        e &&
            (e.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        (!(function () {
            const t = localStorage.getItem(e);
            n.bellMuted = '1' === t;
        })(),
            (function () {
                try {
                    const e = localStorage.getItem(t);
                    if (!e) return null;
                    const a = JSON.parse(e);
                    if (!a || 'object' != typeof a) return null;
                    const o = Date.parse(String(a.savedAt || ''));
                    if (!Number.isFinite(o)) return null;
                    if (Date.now() - o > 216e5) return null;
                    const i = f(a.data || {}),
                        s = { savedAt: new Date(o).toISOString(), data: i };
                    return ((n.lastSnapshot = s), s);
                } catch (e) {
                    return null;
                }
            })(),
            E(),
            (n.clockId = window.setInterval(E, 1e3)),
            s());
        const a = r();
        a instanceof HTMLButtonElement &&
            a.addEventListener('click', () => {
                C();
            });
        const o = d();
        (o instanceof HTMLButtonElement &&
            o.addEventListener('click', () => {
                p();
            }),
            u(),
            i('paused', 'Sincronizacion lista'),
            m(n.lastSnapshot, { mode: 'startup' }) ||
                l('Esperando primera sincronizacion...'),
            A({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? k({ reason: 'hidden' })
                    : A({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                A({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                k({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (k({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                if ('keyr' === t) return (e.preventDefault(), void C());
                'keym' === t && (e.preventDefault(), p());
            }));
    });
})();
