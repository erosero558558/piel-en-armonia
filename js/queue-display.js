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
            connectionState: 'paused',
            lastConnectionMessage: '',
            lastRenderedSignature: '',
        };
    function a(e, t = {}) {
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
    function o(e) {
        return document.getElementById(e);
    }
    function i(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function s(e, t) {
        const i = o('displayConnectionState');
        if (!i) return;
        const s = String(e || 'live').toLowerCase(),
            l = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            },
            r = String(t || '').trim() || l[s] || l.live,
            c = s !== n.connectionState || r !== n.lastConnectionMessage;
        ((n.connectionState = s),
            (n.lastConnectionMessage = r),
            (i.dataset.state = s),
            (i.textContent = r),
            c && a('connection_state', { state: s, message: r }));
    }
    function l() {
        let e = o('displayOpsHint');
        if (e) return e;
        const t = o('displayUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function r(e) {
        const t = l();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function c() {
        let e = o('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
            ? ((e = document.createElement('button')),
              (e.id = 'displayManualRefreshBtn'),
              (e.type = 'button'),
              (e.textContent = 'Refrescar panel'),
              e.setAttribute(
                  'aria-label',
                  'Refrescar estado de turnos en pantalla'
              ),
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
    function d(e) {
        const t = c();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function u() {
        let e = o('displayBellToggleBtn');
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
              e.setAttribute('aria-label', 'Alternar campanilla de llamados'),
              t.appendChild(e),
              e)
            : null;
    }
    function p() {
        const e = u();
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
    function m() {
        !(function (t, { announce: o = !1 } = {}) {
            ((n.bellMuted = Boolean(t)),
                localStorage.setItem(e, n.bellMuted ? '1' : '0'),
                p(),
                a('bell_muted_changed', { muted: n.bellMuted, announce: o }),
                o &&
                    r(
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
    function g(e, { mode: t = 'restore' } = {}) {
        if (!e?.data) return !1;
        w(e.data);
        const n = Math.max(0, Date.now() - Date.parse(String(e.savedAt || ''))),
            o = b(n);
        return (
            s('reconnecting', 'Respaldo local activo'),
            r(
                'startup' === t
                    ? `Mostrando respaldo local (${o}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${o}).`
            ),
            a('snapshot_restored', { mode: t, ageMs: n }),
            !0
        );
    }
    function y() {
        let e = o('displaySnapshotHint');
        if (e instanceof HTMLElement) return e;
        const t = l();
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displaySnapshotHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Respaldo: sin datos locales'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function S() {
        const e = y();
        if (!(e instanceof HTMLElement)) return;
        if (!n.lastSnapshot?.savedAt)
            return void (e.textContent = 'Respaldo: sin datos locales');
        const t = Date.parse(String(n.lastSnapshot.savedAt || ''));
        Number.isFinite(t)
            ? (e.textContent = `Respaldo: ${b(Date.now() - t)} de antiguedad`)
            : (e.textContent = 'Respaldo: sin datos locales');
    }
    function h({ announce: e = !1 } = {}) {
        ((n.lastSnapshot = null), (n.lastRenderedSignature = ''));
        try {
            localStorage.removeItem(t);
        } catch (e) {}
        (S(),
            'live' !== n.connectionState &&
                ((function (e = 'No hay turnos pendientes.') {
                    ((n.lastRenderedSignature = ''),
                        C('displayConsultorio1', null, 'Consultorio 1'),
                        C('displayConsultorio2', null, 'Consultorio 2'));
                    const t = o('displayNextList');
                    t &&
                        (t.innerHTML = `<li class="display-empty">${i(e)}</li>`);
                })('Sin respaldo local disponible.'),
                !1 === navigator.onLine
                    ? s('offline', 'Sin conexion')
                    : s('reconnecting', 'Sin respaldo local')),
            e &&
                r(
                    'Respaldo local limpiado. Esperando datos en vivo del backend.'
                ),
            a('snapshot_cleared', { announce: e }));
    }
    function b(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const a = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${a}m` : `${a}m ${o}s`;
    }
    function v() {
        return n.lastHealthySyncAt
            ? `hace ${b(Date.now() - n.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function C(e, t, n) {
        const a = o(e);
        a &&
            (a.innerHTML = t
                ? `\n        <article class="display-called-card">\n            <h3>${n}</h3>\n            <strong>${i(t.ticketCode || '--')}</strong>\n            <span>${i(t.patientInitials || '--')}</span>\n        </article>\n    `
                : `\n            <article class="display-called-card is-empty">\n                <h3>${n}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
    }
    function w(e) {
        const t = (function (e) {
                const t = Array.isArray(e?.callingNow)
                        ? e.callingNow.map((e) => ({
                              id: Number(e?.id || 0),
                              ticketCode: String(e?.ticketCode || ''),
                              patientInitials: String(e?.patientInitials || ''),
                              consultorio: Number(e?.assignedConsultorio || 0),
                              calledAt: String(e?.calledAt || ''),
                          }))
                        : [],
                    n = Array.isArray(e?.nextTickets)
                        ? e.nextTickets
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
                    a = String(e?.updatedAt || '');
                return JSON.stringify({
                    updatedAt: a,
                    callingNow: t,
                    nextTickets: n,
                });
            })(e),
            s = t === n.lastRenderedSignature,
            l = Array.isArray(e?.callingNow) ? e.callingNow : [],
            r = { 1: null, 2: null };
        for (const e of l) {
            const t = Number(e?.assignedConsultorio || 0);
            (1 !== t && 2 !== t) || (r[t] = e);
        }
        s ||
            (C('displayConsultorio1', r[1], 'Consultorio 1'),
            C('displayConsultorio2', r[2], 'Consultorio 2'),
            (function (e) {
                const t = o('displayNextList');
                t &&
                    (Array.isArray(e) && 0 !== e.length
                        ? (t.innerHTML = e
                              .slice(0, 8)
                              .map(
                                  (e) =>
                                      `\n                <li>\n                    <span class="next-code">${i(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${i(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${i(e.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (t.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(e?.nextTickets || []),
            (function (e) {
                const t = o('displayUpdatedAt');
                if (!t) return;
                const n = Date.parse(String(e?.updatedAt || ''));
                Number.isFinite(n)
                    ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (t.textContent = 'Actualizacion pendiente');
            })(e),
            (n.lastRenderedSignature = t),
            a('render_update', {
                callingNowCount: l.length,
                nextCount: Array.isArray(e?.nextTickets)
                    ? e.nextTickets.length
                    : 0,
            }));
        const c = (function (e) {
            return Array.isArray(e) && 0 !== e.length
                ? e
                      .map(
                          (e) =>
                              `${String(e.assignedConsultorio || '-')}:${String(e.ticketCode || '')}:${String(e.calledAt || '')}`
                      )
                      .sort()
                      .join('|')
                : '';
        })(l);
        (c &&
            c !== n.lastCalledSignature &&
            ((function () {
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
            a('called_signature_changed', { signature: c })),
            (n.lastCalledSignature = c));
    }
    function x() {
        const e = Math.max(0, Number(n.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function A() {
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function M({ immediate: e = !1 } = {}) {
        if ((A(), !n.pollingEnabled)) return;
        const t = e ? 0 : x();
        n.pollingId = window.setTimeout(() => {
            E();
        }, t);
    }
    async function k() {
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
            (w(e),
                (function (e) {
                    const a = f(e),
                        o = { savedAt: new Date().toISOString(), data: a };
                    n.lastSnapshot = o;
                    try {
                        localStorage.setItem(t, JSON.stringify(o));
                    } catch (e) {}
                    S();
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
            const t = g(n.lastSnapshot, { mode: 'restore' });
            if (!t) {
                const t = o('displayNextList');
                t &&
                    (t.innerHTML = `<li class="display-empty">Sin conexion: ${i(e.message)}</li>`);
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
    async function E() {
        if (!n.pollingEnabled) return;
        if (document.hidden)
            return (
                s('paused', 'En pausa (pestana oculta)'),
                r('Pantalla en pausa por pestana oculta.'),
                void M()
            );
        if (!1 === navigator.onLine)
            return (
                (n.failureStreak += 1),
                g(n.lastSnapshot, { mode: 'restore' }) ||
                    (s('offline', 'Sin conexion'),
                    r(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void M()
            );
        const e = await k();
        if (e.ok && !e.stale)
            ((n.failureStreak = 0),
                (n.lastHealthySyncAt = Date.now()),
                s('live', 'Conectado'),
                r(`Panel estable (${v()}).`));
        else if (e.ok && e.stale) {
            n.failureStreak += 1;
            const t = b(e.ageMs || 0);
            (s('reconnecting', `Watchdog: datos estancados ${t}`),
                r(`Datos estancados ${t}. Verifica fuente de cola.`));
        } else {
            if (((n.failureStreak += 1), e.usedSnapshot)) return void M();
            const t = Math.max(1, Math.ceil(x() / 1e3));
            (s('reconnecting', `Reconectando en ${t}s`),
                r(`Conexion inestable. Reintento automatico en ${t}s.`));
        }
        M();
    }
    async function T() {
        if (!n.manualRefreshBusy) {
            ((n.manualRefreshBusy = !0),
                d(!0),
                s('reconnecting', 'Refrescando panel...'));
            try {
                const e = await k();
                if (e.ok && !e.stale)
                    return (
                        (n.failureStreak = 0),
                        (n.lastHealthySyncAt = Date.now()),
                        s('live', 'Conectado'),
                        void r(`Sincronizacion manual exitosa (${v()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = b(e.ageMs || 0);
                    return (
                        s('reconnecting', `Watchdog: datos estancados ${t}`),
                        void r(`Persisten datos estancados (${t}).`)
                    );
                }
                if (e.usedSnapshot) return;
                const t = Math.max(1, Math.ceil(x() / 1e3));
                (s(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${t}s`
                ),
                    r(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                ((n.manualRefreshBusy = !1), d(!1));
            }
        }
    }
    function L({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (s('live', 'Sincronizando...'), void E());
        M();
    }
    function R({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), A());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (s('offline', 'Sin conexion'),
              void r('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === t
              ? (s('paused', 'En pausa (pestana oculta)'),
                void r('Pantalla oculta. Reanuda al volver al frente.'))
              : (s('paused', 'En pausa'), void r('Sincronizacion pausada.'));
    }
    function $() {
        const e = o('displayClock');
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
                n.lastSnapshot = null;
                try {
                    const e = localStorage.getItem(t);
                    if (!e) return (S(), null);
                    const a = JSON.parse(e);
                    if (!a || 'object' != typeof a) return (S(), null);
                    const o = Date.parse(String(a.savedAt || ''));
                    if (!Number.isFinite(o)) return (S(), null);
                    if (Date.now() - o > 216e5) return (S(), null);
                    const i = f(a.data || {}),
                        s = { savedAt: new Date(o).toISOString(), data: i };
                    return ((n.lastSnapshot = s), S(), s);
                } catch (e) {
                    return (S(), null);
                }
            })(),
            $(),
            (n.clockId = window.setInterval($, 1e3)),
            l(),
            y());
        const a = c();
        a instanceof HTMLButtonElement &&
            a.addEventListener('click', () => {
                T();
            });
        const i = u();
        i instanceof HTMLButtonElement &&
            i.addEventListener('click', () => {
                m();
            });
        const d = (function () {
            let e = o('displaySnapshotClearBtn');
            if (e instanceof HTMLButtonElement) return e;
            const t = document.querySelector('.display-clock-wrap');
            return t
                ? ((e = document.createElement('button')),
                  (e.id = 'displaySnapshotClearBtn'),
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
                h({ announce: !0 });
            }),
            p(),
            S(),
            s('paused', 'Sincronizacion lista'),
            g(n.lastSnapshot, { mode: 'startup' }) ||
                r('Esperando primera sincronizacion...'),
            L({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? R({ reason: 'hidden' })
                    : L({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                L({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                R({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (R({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void T())
                    : 'keym' === t
                      ? (e.preventDefault(), void m())
                      : void (
                            'keyx' === t &&
                            (e.preventDefault(), h({ announce: !0 }))
                        );
            }));
    });
})();
