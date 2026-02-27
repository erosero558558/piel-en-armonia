!(function () {
    'use strict';
    const e = 'kioskThemeMode',
        t = 9e5,
        n = 'queueKioskOfflineOutbox',
        i = 'queueKioskPrinterState',
        o = {
            queueState: null,
            chatHistory: [],
            assistantBusy: !1,
            queueTimerId: 0,
            queuePollingEnabled: !1,
            queueFailureStreak: 0,
            queueRefreshBusy: !1,
            queueManualRefreshBusy: !1,
            queueLastHealthySyncAt: 0,
            themeMode: 'system',
            mediaQuery: null,
            idleTimerId: 0,
            idleTickId: 0,
            idleDeadlineTs: 0,
            idleResetMs: 9e4,
            offlineOutbox: [],
            offlineOutboxFlushBusy: !1,
            lastConnectionState: '',
            lastConnectionMessage: '',
            printerState: null,
        };
    function a(e, t = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'kiosk',
                        event: String(e || 'unknown'),
                        at: new Date().toISOString(),
                        ...t,
                    },
                })
            );
        } catch (e) {}
    }
    function r(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function s(e) {
        return document.getElementById(e);
    }
    async function u(e, { method: t = 'GET', body: n } = {}) {
        const i = new URLSearchParams();
        (i.set('resource', e), i.set('t', String(Date.now())));
        const o = await fetch(`/api.php?${i.toString()}`, {
                method: t,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(void 0 !== n
                        ? { 'Content-Type': 'application/json' }
                        : {}),
                },
                body: void 0 !== n ? JSON.stringify(n) : void 0,
            }),
            a = await o.text();
        let r;
        try {
            r = a ? JSON.parse(a) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!o.ok || !1 === r.ok)
            throw new Error(r.error || `HTTP ${o.status}`);
        return r;
    }
    function c(e, t = 'info') {
        const n = s('kioskStatus');
        if (!n) return;
        const i = String(e || '').trim() || 'Estado operativo',
            o = String(t || 'info').toLowerCase(),
            r =
                i !== String(n.textContent || '').trim() ||
                o !== String(n.dataset.status || '').toLowerCase();
        ((n.textContent = i),
            (n.dataset.status = o),
            r && a('kiosk_status', { status: o, message: i }));
    }
    function l(e, t) {
        const n = s('queueConnectionState');
        if (!n) return;
        const i = String(e || 'live').toLowerCase(),
            r = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            },
            u = String(t || '').trim() || r[i] || r.live,
            c = i !== o.lastConnectionState || u !== o.lastConnectionMessage;
        ((o.lastConnectionState = i),
            (o.lastConnectionMessage = u),
            (n.dataset.state = i),
            (n.textContent = u),
            c && a('connection_state', { state: i, message: u }));
    }
    function d() {
        const e = s('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!o.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                (e.dataset.state = 'normal'),
                (e.style.color = 'var(--muted)'),
                void (e.style.borderColor = 'var(--border)')
            );
        const t = Math.max(0, o.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const t = Math.max(0, Number(e || 0)),
                n = Math.ceil(t / 1e3);
            return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
        })(t)}`;
        const n = t <= 2e4;
        ((e.dataset.state = n ? 'warning' : 'normal'),
            (e.style.color = n ? 'var(--danger)' : 'var(--muted)'),
            (e.style.borderColor = n ? 'var(--danger)' : 'var(--border)'));
    }
    function f() {
        const e = s('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function m() {
        const e = s('assistantMessages');
        (e && (e.innerHTML = ''),
            (o.chatHistory = []),
            U(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const t = s('assistantInput');
        t instanceof HTMLInputElement && (t.value = '');
    }
    function p({ durationMs: e = null } = {}) {
        const n = Math.min(
            t,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : o.idleResetMs
                )
            )
        );
        (o.idleTimerId &&
            (window.clearTimeout(o.idleTimerId), (o.idleTimerId = 0)),
            o.idleTickId &&
                (window.clearInterval(o.idleTickId), (o.idleTickId = 0)),
            (o.idleDeadlineTs = Date.now() + n),
            d(),
            (o.idleTickId = window.setInterval(() => {
                d();
            }, 1e3)),
            (o.idleTimerId = window.setTimeout(() => {
                if (o.assistantBusy || o.queueManualRefreshBusy)
                    return (
                        c(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void p({ durationMs: 15e3 })
                    );
                y({ reason: 'idle_timeout' });
            }, n)));
    }
    function g() {
        p();
    }
    function y({ reason: e = 'manual' } = {}) {
        (!(function () {
            const e = s('checkinForm'),
                t = s('walkinForm');
            (e instanceof HTMLFormElement && e.reset(),
                t instanceof HTMLFormElement && t.reset(),
                W());
        })(),
            m(),
            f(),
            c(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            w(),
            p());
    }
    function b() {
        let e = s('queueOpsHint');
        if (e) return e;
        const t = document.querySelector('.kiosk-side .kiosk-card'),
            n = s('queueUpdatedAt');
        return t && n
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function h(e) {
        const t = b();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function S() {
        let e = s('queueOutboxHint');
        if (e) return e;
        const t = b();
        return t?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function k(e) {
        const t = S();
        t &&
            (t.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function v() {
        let e = s('queuePrinterHint');
        if (e) return e;
        const t = S();
        return t?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function x() {
        const e = v();
        if (!e) return;
        const t = o.printerState;
        if (!t) return void (e.textContent = 'Impresora: estado pendiente.');
        const n = t.printed ? 'impresion OK' : t.errorCode || 'sin impresion',
            i = t.message ? ` (${t.message})` : '',
            a = D(t.at);
        e.textContent = `Impresora: ${n}${i} · ${a}`;
    }
    function q() {
        let e = s('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const t = S();
        return t?.parentElement
            ? ((e = document.createElement('section')),
              (e.id = 'queueOutboxConsole'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.75rem'),
              (e.style.padding = '0.55rem 0.65rem'),
              (e.style.marginBottom = '0.65rem'),
              (e.style.background = 'var(--surface-soft)'),
              (e.innerHTML =
                  '\n        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>\n        <div style="display:flex;flex-wrap:wrap;gap:0.45rem;margin:0.25rem 0 0.45rem;">\n            <button id="queueOutboxRetryBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Sincronizar pendientes</button>\n            <button id="queueOutboxDropOldestBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Descartar mas antiguo</button>\n            <button id="queueOutboxClearBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Limpiar pendientes</button>\n        </div>\n        <ol id="queueOutboxList" style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;">\n            <li class="queue-empty">Sin pendientes offline.</li>\n        </ol>\n        <p class="queue-updated-at" style="margin-top:0.45rem;">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>\n    '),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function T(e) {
        const t = s('queueOutboxRetryBtn'),
            n = s('queueOutboxClearBtn'),
            i = s('queueOutboxDropOldestBtn');
        (t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e) || !o.offlineOutbox.length),
            (t.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            n instanceof HTMLButtonElement &&
                (n.disabled = Boolean(e) || !o.offlineOutbox.length),
            i instanceof HTMLButtonElement &&
                (i.disabled = Boolean(e) || o.offlineOutbox.length <= 0));
    }
    function L() {
        q();
        const e = s('queueOutboxSummary'),
            t = s('queueOutboxList'),
            n = o.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                n <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${n} pendiente(s)`),
            t instanceof HTMLElement &&
                (t.innerHTML =
                    n <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : o.offlineOutbox
                              .slice(0, 6)
                              .map((e, t) => {
                                  const n = D(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${r(e.originLabel)}</strong> · ${r(e.patientInitials || '--')} · ${r(e.queueType || '--')} · ${r(n)} · intento ${t + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            T(!1));
    }
    function M({ reason: e = 'manual' } = {}) {
        ((o.offlineOutbox = []),
            E(),
            w(),
            L(),
            'manual' === e &&
                c('Pendientes offline limpiados manualmente.', 'info'));
    }
    function E() {
        try {
            localStorage.setItem(n, JSON.stringify(o.offlineOutbox));
        } catch (e) {}
    }
    function w() {
        const e = o.offlineOutbox.length;
        if (e <= 0)
            return (k('Pendientes offline: 0 (sin pendientes).'), void L());
        const t = Date.parse(String(o.offlineOutbox[0]?.queuedAt || ''));
        (k(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(t) ? ` - mas antiguo ${I(Date.now() - t)}` : ''}`
        ),
            L());
    }
    function C() {
        let e = s('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = s('queueUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('button')),
              (e.id = 'queueManualRefreshBtn'),
              (e.type = 'button'),
              (e.textContent = 'Reintentar sincronizacion'),
              (e.style.margin = '0.25rem 0 0.55rem'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.42rem 0.62rem'),
              (e.style.background = 'var(--surface-soft)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function O(e) {
        const t = C();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function I(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const i = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function $() {
        return o.queueLastHealthySyncAt
            ? `hace ${I(Date.now() - o.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function H(e) {
        const t = s('queueUpdatedAt');
        if (!t) return;
        const n = Date.parse(String(e || ''));
        Number.isFinite(n)
            ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function B() {
        const e = Math.max(0, Number(o.queueFailureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function A() {
        o.queueTimerId &&
            (window.clearTimeout(o.queueTimerId), (o.queueTimerId = 0));
    }
    function D(e) {
        const t = Date.parse(String(e || ''));
        return Number.isFinite(t)
            ? new Date(t).toLocaleString('es-EC', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
              })
            : '--';
    }
    async function N() {
        if (o.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        o.queueRefreshBusy = !0;
        try {
            const e = await u('queue-state');
            ((o.queueState = e.data || {}),
                (function (e) {
                    const t = s('queueWaitingCount'),
                        n = s('queueCalledCount'),
                        i = s('queueCallingNow'),
                        o = s('queueNextList');
                    if (
                        (t && (t.textContent = String(e?.waitingCount || 0)),
                        n && (n.textContent = String(e?.calledCount || 0)),
                        i)
                    ) {
                        const t = Array.isArray(e?.callingNow)
                            ? e.callingNow
                            : [];
                        0 === t.length
                            ? (i.innerHTML =
                                  '<p class="queue-empty">Sin llamados activos.</p>')
                            : (i.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${r(e.assignedConsultorio)}</header>\n                            <strong>${r(e.ticketCode || '--')}</strong>\n                            <span>${r(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                                  )
                                  .join(''));
                    }
                    if (o) {
                        const t = Array.isArray(e?.nextTickets)
                            ? e.nextTickets
                            : [];
                        0 === t.length
                            ? (o.innerHTML =
                                  '<li class="queue-empty">No hay turnos en espera.</li>')
                            : (o.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <li>\n                            <span class="ticket-code">${r(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${r(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${r(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(o.queueState),
                H(o.queueState?.updatedAt));
            const t = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(o.queueState);
            return {
                ok: !0,
                stale: Boolean(t.stale),
                missingTimestamp: Boolean(t.missingTimestamp),
                ageMs: t.ageMs,
            };
        } catch (e) {
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
            };
        } finally {
            o.queueRefreshBusy = !1;
        }
    }
    function R(e, t) {
        const n = s('ticketResult');
        if (!n) return;
        const u = e?.data || {},
            c = e?.print || {};
        !(function (e, { origin: t = 'ticket' } = {}) {
            const n = e?.print || {};
            ((o.printerState = {
                ok: Boolean(n.ok),
                printed: Boolean(e?.printed),
                errorCode: String(n.errorCode || ''),
                message: String(n.message || ''),
                at: new Date().toISOString(),
            }),
                (function () {
                    try {
                        localStorage.setItem(i, JSON.stringify(o.printerState));
                    } catch (e) {}
                })(),
                x(),
                a('printer_result', {
                    origin: t,
                    ok: o.printerState.ok,
                    printed: o.printerState.printed,
                    errorCode: o.printerState.errorCode,
                }));
        })(e, { origin: t });
        const l = Array.isArray(o.queueState?.nextTickets)
                ? o.queueState.nextTickets
                : [],
            d = l.find((e) => Number(e.id) === Number(u.id))?.position || '-',
            f = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${r(c.message || 'sin detalle')})`;
        n.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${r(t)}</p>\n            <div class="ticket-result-main">\n                <strong>${r(u.ticketCode || '--')}</strong>\n                <span>${r(u.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${r(d)}</dd></div>\n                <div><dt>Tipo</dt><dd>${r(u.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${r(D(u.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${f}</p>\n        </article>\n    `;
    }
    function P({
        originLabel: e,
        patientInitials: t,
        queueType: n,
        queuedAt: i,
    }) {
        const a = s('ticketResult');
        a &&
            (a.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${r(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${r(`PEND-${String(o.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${r(t || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${r(n || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${r(D(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function F(e) {
        if (!1 === navigator.onLine) return !0;
        const t = String(e?.message || '').toLowerCase();
        return (
            !!t &&
            (t.includes('failed to fetch') ||
                t.includes('networkerror') ||
                t.includes('network request failed') ||
                t.includes('load failed') ||
                t.includes('network'))
        );
    }
    function z(e, t) {
        const n = String(e || '').toLowerCase(),
            i = (function (e) {
                const t = e && 'object' == typeof e ? e : {};
                return Object.keys(t)
                    .sort()
                    .reduce((e, n) => ((e[n] = t[n]), e), {});
            })(t);
        return `${n}:${JSON.stringify(i)}`;
    }
    function _({
        resource: e,
        body: t,
        originLabel: n,
        patientInitials: i,
        queueType: r,
    }) {
        const s = String(e || '');
        if ('queue-ticket' !== s && 'queue-checkin' !== s) return null;
        const u = z(s, t),
            c = Date.now(),
            l = o.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== u) return !1;
                const t = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(t) && c - t <= 9e4;
            });
        if (l)
            return (
                a('offline_queued_duplicate', { resource: s, fingerprint: u }),
                { ...l, deduped: !0 }
            );
        const d = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: s,
            body: t && 'object' == typeof t ? t : {},
            originLabel: String(n || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(r || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: u,
        };
        return (
            (o.offlineOutbox = [d, ...o.offlineOutbox].slice(0, 25)),
            E(),
            w(),
            a('offline_queued', {
                resource: s,
                queueSize: o.offlineOutbox.length,
            }),
            d
        );
    }
    async function j({
        source: e = 'auto',
        force: t = !1,
        maxItems: n = 4,
    } = {}) {
        if (o.offlineOutboxFlushBusy) return;
        if (!o.offlineOutbox.length) return;
        if (!t && !1 === navigator.onLine) return;
        ((o.offlineOutboxFlushBusy = !0), T(!0));
        let i = 0;
        try {
            for (
                ;
                o.offlineOutbox.length && i < Math.max(1, Number(n || 1));
            ) {
                const e = o.offlineOutbox[0];
                try {
                    const t = await u(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (o.offlineOutbox.shift(),
                        E(),
                        w(),
                        R(t, `${e.originLabel} (sincronizado)`),
                        c(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        a('offline_synced_item', {
                            resource: e.resource,
                            originLabel: e.originLabel,
                            pendingAfter: o.offlineOutbox.length,
                        }),
                        (i += 1));
                } catch (t) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(t?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        E(),
                        w());
                    const n = F(t);
                    (c(
                        n
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${t.message}`,
                        n ? 'info' : 'error'
                    ),
                        a('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: n,
                            error: String(t?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((o.queueFailureStreak = 0),
                (await N()).ok &&
                    ((o.queueLastHealthySyncAt = Date.now()),
                    l('live', 'Cola conectada'),
                    h(`Outbox sincronizado desde ${e}. (${$()})`),
                    a('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: o.offlineOutbox.length,
                    })));
        } finally {
            ((o.offlineOutboxFlushBusy = !1), L());
        }
    }
    async function K(e) {
        if (
            (e.preventDefault(),
            g(),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const t = s('checkinPhone'),
            n = s('checkinTime'),
            i = s('checkinDate'),
            a = s('checkinInitials'),
            r = s('checkinSubmit'),
            d = t instanceof HTMLInputElement ? t.value.trim() : '',
            f = n instanceof HTMLInputElement ? n.value.trim() : '',
            m = i instanceof HTMLInputElement ? i.value.trim() : '',
            p = a instanceof HTMLInputElement ? a.value.trim() : '';
        if (d && f && m) {
            r instanceof HTMLButtonElement && (r.disabled = !0);
            try {
                const e = {
                        telefono: d,
                        hora: f,
                        fecha: m,
                        patientInitials: p,
                    },
                    t = await u('queue-checkin', { method: 'POST', body: e });
                (c('Check-in registrado correctamente', 'success'),
                    R(
                        t,
                        t.replay ? 'Check-in ya existente' : 'Check-in de cita'
                    ),
                    (o.queueFailureStreak = 0),
                    (await N()).ok ||
                        l(
                            'reconnecting',
                            'Check-in registrado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if (F(e)) {
                    const e = _({
                        resource: 'queue-checkin',
                        body: {
                            telefono: d,
                            hora: f,
                            fecha: m,
                            patientInitials: p,
                        },
                        originLabel: 'Check-in de cita',
                        patientInitials: p || d.slice(-2),
                        queueType: 'appointment',
                    });
                    if (e)
                        return (
                            l('offline', 'Sin conexion al backend'),
                            h(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            P({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void c(
                                e.deduped
                                    ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                                    : 'Check-in guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                c(`No se pudo registrar el check-in: ${e.message}`, 'error');
            } finally {
                r instanceof HTMLButtonElement && (r.disabled = !1);
            }
        } else
            c('Telefono, fecha y hora son obligatorios para check-in', 'error');
    }
    async function J(e) {
        (e.preventDefault(), g());
        const t = s('walkinName'),
            n = s('walkinInitials'),
            i = s('walkinPhone'),
            a = s('walkinSubmit'),
            r = t instanceof HTMLInputElement ? t.value.trim() : '',
            d =
                (n instanceof HTMLInputElement ? n.value.trim() : '') ||
                (function (e) {
                    const t = String(e || '').trim();
                    if (!t) return '';
                    const n = t
                        .toUpperCase()
                        .split(/\s+/)
                        .map((e) => e.replace(/[^A-Z]/g, ''))
                        .filter(Boolean);
                    if (0 === n.length) return '';
                    let i = '';
                    for (const e of n)
                        if (((i += e.slice(0, 1)), i.length >= 3)) break;
                    return i.slice(0, 4);
                })(r),
            f = i instanceof HTMLInputElement ? i.value.trim() : '';
        if (d) {
            a instanceof HTMLButtonElement && (a.disabled = !0);
            try {
                const e = { patientInitials: d, name: r, phone: f },
                    t = await u('queue-ticket', { method: 'POST', body: e });
                (c('Turno walk-in registrado correctamente', 'success'),
                    R(t, 'Turno sin cita'),
                    (o.queueFailureStreak = 0),
                    (await N()).ok ||
                        l(
                            'reconnecting',
                            'Turno creado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if (F(e)) {
                    const e = _({
                        resource: 'queue-ticket',
                        body: { patientInitials: d, name: r, phone: f },
                        originLabel: 'Turno sin cita',
                        patientInitials: d,
                        queueType: 'walk_in',
                    });
                    if (e)
                        return (
                            l('offline', 'Sin conexion al backend'),
                            h(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            P({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void c(
                                e.deduped
                                    ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                                    : 'Turno guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                c(`No se pudo crear el turno: ${e.message}`, 'error');
            } finally {
                a instanceof HTMLButtonElement && (a.disabled = !1);
            }
        } else c('Ingresa iniciales o nombre para generar el turno', 'error');
    }
    function U(e, t) {
        const n = s('assistantMessages');
        if (!n) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${r(t)}</p>`),
            n.appendChild(i),
            (n.scrollTop = n.scrollHeight));
    }
    async function Q(e) {
        if ((e.preventDefault(), g(), o.assistantBusy)) return;
        const t = s('assistantInput'),
            n = s('assistantSend');
        if (!(t instanceof HTMLInputElement)) return;
        const i = t.value.trim();
        if (i) {
            (U('user', i),
                (t.value = ''),
                (o.assistantBusy = !0),
                n instanceof HTMLButtonElement && (n.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...o.chatHistory.slice(-6),
                        { role: 'user', content: i },
                    ],
                    t = await fetch(`/figo-chat.php?t=${Date.now()}`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'figo-assistant',
                            source: 'kiosk_waiting_room',
                            messages: e,
                            max_tokens: 180,
                            temperature: 0.2,
                        }),
                    }),
                    n = await t.json(),
                    a = (function (e) {
                        const t = String(e || '')
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '');
                        if (
                            /(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(
                                t
                            )
                        )
                            return 'En este kiosco solo puedo ayudarte con turnos y orientacion de sala. Para consulta medica, acude a recepcion.';
                        return (
                            String(e || '').trim() ||
                            'Puedo ayudarte con turnos, check-in y ubicacion de consultorios.'
                        );
                    })(String(n?.choices?.[0]?.message?.content || '').trim());
                (U('bot', a),
                    (o.chatHistory = [
                        ...o.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: a },
                    ].slice(-8)));
            } catch (e) {
                U(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((o.assistantBusy = !1),
                    n instanceof HTMLButtonElement && (n.disabled = !1));
            }
        }
    }
    function G(e) {
        o.themeMode = e;
        const t = document.documentElement,
            n = o.mediaQuery instanceof MediaQueryList && o.mediaQuery.matches,
            i = 'system' === e ? (n ? 'dark' : 'light') : e;
        ((t.dataset.theme = i),
            document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                const n = t.getAttribute('data-theme-mode');
                (t.classList.toggle('is-active', n === e),
                    t.setAttribute('aria-pressed', String(n === e)));
            }));
    }
    function W() {
        const e = s('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function V({ immediate: e = !1 } = {}) {
        if ((A(), !o.queuePollingEnabled)) return;
        const t = e ? 0 : B();
        o.queueTimerId = window.setTimeout(() => {
            Y();
        }, t);
    }
    async function Y() {
        if (!o.queuePollingEnabled) return;
        if (document.hidden)
            return (
                l('paused', 'Cola en pausa (pestana oculta)'),
                h('Pestana oculta. Turnero en pausa temporal.'),
                void V()
            );
        if (!1 === navigator.onLine)
            return (
                (o.queueFailureStreak += 1),
                l('offline', 'Sin conexion al backend'),
                h(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                w(),
                void V()
            );
        await j({ source: 'poll' });
        const e = await N();
        if (e.ok && !e.stale)
            ((o.queueFailureStreak = 0),
                (o.queueLastHealthySyncAt = Date.now()),
                l('live', 'Cola conectada'),
                h(
                    `Operacion estable (${$()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            o.queueFailureStreak += 1;
            const t = I(e.ageMs || 0);
            (l('reconnecting', `Watchdog: cola estancada ${t}`),
                h(
                    `Cola degradada: sin cambios en ${t}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            o.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(B() / 1e3));
            (l('reconnecting', `Reintentando en ${e}s`),
                h(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (w(), V());
    }
    async function Z() {
        if (!o.queueManualRefreshBusy) {
            (g(),
                (o.queueManualRefreshBusy = !0),
                O(!0),
                l('reconnecting', 'Refrescando manualmente...'));
            try {
                await j({ source: 'manual' });
                const e = await N();
                if (e.ok && !e.stale)
                    return (
                        (o.queueFailureStreak = 0),
                        (o.queueLastHealthySyncAt = Date.now()),
                        l('live', 'Cola conectada'),
                        void h(`Sincronizacion manual exitosa (${$()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = I(e.ageMs || 0);
                    return (
                        l('reconnecting', `Watchdog: cola estancada ${t}`),
                        void h(
                            `Persisten datos estancados (${t}). Verifica backend o recepcion.`
                        )
                    );
                }
                const t = Math.max(1, Math.ceil(B() / 1e3));
                (l(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${t}s`
                ),
                    h(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                (w(), (o.queueManualRefreshBusy = !1), O(!1));
            }
        }
    }
    function X({ immediate: e = !0 } = {}) {
        if (((o.queuePollingEnabled = !0), e))
            return (l('live', 'Sincronizando cola...'), void Y());
        V();
    }
    function ee({ reason: e = 'paused' } = {}) {
        ((o.queuePollingEnabled = !1), (o.queueFailureStreak = 0), A());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (l('offline', 'Sin conexion al backend'),
              h('Sin conexion. Esperando reconexion para reanudar cola.'),
              void w())
            : 'hidden' === t
              ? (l('paused', 'Cola en pausa (pestana oculta)'),
                void h('Pestana oculta. Reanudando al volver a primer plano.'))
              : (l('paused', 'Cola en pausa'),
                h('Sincronizacion pausada por navegacion.'),
                void w());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((o.idleResetMs = (function () {
            const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                n = Number.isFinite(e) ? e : 9e4;
            return Math.min(t, Math.max(5e3, Math.round(n)));
        })()),
            (function () {
                const t = localStorage.getItem(e) || 'system';
                ((o.mediaQuery = window.matchMedia(
                    '(prefers-color-scheme: dark)'
                )),
                    o.mediaQuery.addEventListener('change', () => {
                        'system' === o.themeMode && G('system');
                    }),
                    document
                        .querySelectorAll('[data-theme-mode]')
                        .forEach((t) => {
                            t.addEventListener('click', () => {
                                !(function (t) {
                                    const n = [
                                        'light',
                                        'dark',
                                        'system',
                                    ].includes(t)
                                        ? t
                                        : 'system';
                                    (localStorage.setItem(e, n), G(n));
                                })(
                                    t.getAttribute('data-theme-mode') ||
                                        'system'
                                );
                            });
                        }),
                    G(t));
            })(),
            W());
        const a = s('checkinForm'),
            r = s('walkinForm'),
            u = s('assistantForm');
        (a instanceof HTMLFormElement && a.addEventListener('submit', K),
            r instanceof HTMLFormElement && r.addEventListener('submit', J),
            u instanceof HTMLFormElement && u.addEventListener('submit', Q),
            (function () {
                let e = s('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const t = s('kioskStatus');
                if (!(t instanceof HTMLElement)) return null;
                ((e = document.createElement('div')),
                    (e.id = 'kioskSessionGuard'),
                    (e.style.display = 'flex'),
                    (e.style.flexWrap = 'wrap'),
                    (e.style.alignItems = 'center'),
                    (e.style.gap = '0.55rem'),
                    (e.style.marginBottom = '0.85rem'));
                const n = document.createElement('span');
                ((n.id = 'kioskSessionCountdown'),
                    (n.textContent = 'Privacidad auto: --:--'),
                    (n.style.display = 'inline-flex'),
                    (n.style.alignItems = 'center'),
                    (n.style.padding = '0.2rem 0.55rem'),
                    (n.style.border = '1px solid var(--border)'),
                    (n.style.borderRadius = '999px'),
                    (n.style.background = 'var(--surface-soft)'),
                    (n.style.color = 'var(--muted)'),
                    (n.style.fontSize = '0.82rem'));
                const i = document.createElement('button');
                ((i.id = 'kioskSessionResetBtn'),
                    (i.type = 'button'),
                    (i.textContent = 'Nueva persona / limpiar pantalla'),
                    (i.style.border = '1px solid var(--border)'),
                    (i.style.borderRadius = '0.65rem'),
                    (i.style.padding = '0.38rem 0.62rem'),
                    (i.style.background = 'var(--surface-soft)'),
                    (i.style.color = 'var(--text)'),
                    (i.style.cursor = 'pointer'),
                    e.appendChild(n),
                    e.appendChild(i),
                    t.insertAdjacentElement('afterend', e));
            })());
        const d = s('kioskSessionResetBtn');
        (d instanceof HTMLButtonElement &&
            d.addEventListener('click', () => {
                y({ reason: 'manual' });
            }),
            m(),
            f(),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        g();
                    },
                    !0
                );
            }),
            p(),
            b(),
            S(),
            v(),
            q(),
            (function () {
                try {
                    const e = localStorage.getItem(n);
                    if (!e) return void (o.offlineOutbox = []);
                    const t = JSON.parse(e);
                    if (!Array.isArray(t)) return void (o.offlineOutbox = []);
                    o.offlineOutbox = t
                        .map((e) => ({
                            id: String(e?.id || ''),
                            resource: String(e?.resource || ''),
                            body:
                                e && 'object' == typeof e.body && e.body
                                    ? e.body
                                    : {},
                            originLabel: String(
                                e?.originLabel || 'Solicitud offline'
                            ),
                            patientInitials: String(e?.patientInitials || '--'),
                            queueType: String(e?.queueType || '--'),
                            queuedAt: String(
                                e?.queuedAt || new Date().toISOString()
                            ),
                            attempts: Number(e?.attempts || 0),
                            lastError: String(e?.lastError || ''),
                            fingerprint: String(e?.fingerprint || ''),
                        }))
                        .filter(
                            (e) =>
                                e.id &&
                                ('queue-ticket' === e.resource ||
                                    'queue-checkin' === e.resource)
                        )
                        .map((e) => ({
                            ...e,
                            fingerprint: e.fingerprint || z(e.resource, e.body),
                        }))
                        .slice(0, 25);
                } catch (e) {
                    o.offlineOutbox = [];
                }
            })(),
            (function () {
                try {
                    const e = localStorage.getItem(i);
                    if (!e) return void (o.printerState = null);
                    const t = JSON.parse(e);
                    if (!t || 'object' != typeof t)
                        return void (o.printerState = null);
                    o.printerState = {
                        ok: Boolean(t.ok),
                        printed: Boolean(t.printed),
                        errorCode: String(t.errorCode || ''),
                        message: String(t.message || ''),
                        at: String(t.at || new Date().toISOString()),
                    };
                } catch (e) {
                    o.printerState = null;
                }
            })(),
            x(),
            w());
        const k = C();
        k instanceof HTMLButtonElement &&
            k.addEventListener('click', () => {
                Z();
            });
        const T = s('queueOutboxRetryBtn');
        T instanceof HTMLButtonElement &&
            T.addEventListener('click', () => {
                j({ source: 'operator', force: !0, maxItems: 25 });
            });
        const O = s('queueOutboxDropOldestBtn');
        O instanceof HTMLButtonElement &&
            O.addEventListener('click', () => {
                !(function () {
                    if (!o.offlineOutbox.length) return;
                    const e = o.offlineOutbox[o.offlineOutbox.length - 1];
                    (o.offlineOutbox.pop(),
                        E(),
                        w(),
                        L(),
                        c(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const I = s('queueOutboxClearBtn');
        (I instanceof HTMLButtonElement &&
            I.addEventListener('click', () => {
                M({ reason: 'manual' });
            }),
            l('paused', 'Sincronizacion lista'),
            h('Esperando primera sincronizacion de cola...'),
            H(''),
            !1 !== navigator.onLine && j({ source: 'startup', force: !0 }),
            X({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? ee({ reason: 'hidden' })
                    : X({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (j({ source: 'online', force: !0 }), X({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (ee({ reason: 'offline' }), w());
            }),
            window.addEventListener('beforeunload', () => {
                ee({ reason: 'paused' });
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void Z())
                    : 'keyl' === t
                      ? (e.preventDefault(), void y({ reason: 'manual' }))
                      : 'keyy' === t
                        ? (e.preventDefault(),
                          void j({
                              source: 'shortcut',
                              force: !0,
                              maxItems: 25,
                          }))
                        : void (
                              'keyk' === t &&
                              (e.preventDefault(), M({ reason: 'manual' }))
                          );
            }));
    });
})();
