!(function () {
    'use strict';
    const e = 'kioskThemeMode',
        t = 9e5,
        n = 'queueKioskOfflineOutbox',
        i = {
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
        };
    function a(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function o(e) {
        return document.getElementById(e);
    }
    async function r(e, { method: t = 'GET', body: n } = {}) {
        const i = new URLSearchParams();
        (i.set('resource', e), i.set('t', String(Date.now())));
        const a = await fetch(`/api.php?${i.toString()}`, {
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
            o = await a.text();
        let r;
        try {
            r = o ? JSON.parse(o) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!a.ok || !1 === r.ok)
            throw new Error(r.error || `HTTP ${a.status}`);
        return r;
    }
    function s(e, t = 'info') {
        const n = o('kioskStatus');
        n && ((n.textContent = e), (n.dataset.status = t));
    }
    function c(e, t) {
        const n = o('queueConnectionState');
        if (!n) return;
        const i = String(e || 'live').toLowerCase(),
            a = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            };
        ((n.dataset.state = i),
            (n.textContent = String(t || '').trim() || a[i] || a.live));
    }
    function u() {
        const e = o('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!i.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                (e.dataset.state = 'normal'),
                (e.style.color = 'var(--muted)'),
                void (e.style.borderColor = 'var(--border)')
            );
        const t = Math.max(0, i.idleDeadlineTs - Date.now());
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
    function l() {
        const e = o('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function d() {
        const e = o('assistantMessages');
        (e && (e.innerHTML = ''),
            (i.chatHistory = []),
            D(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const t = o('assistantInput');
        t instanceof HTMLInputElement && (t.value = '');
    }
    function m({ durationMs: e = null } = {}) {
        const n = Math.min(
            t,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : i.idleResetMs
                )
            )
        );
        (i.idleTimerId &&
            (window.clearTimeout(i.idleTimerId), (i.idleTimerId = 0)),
            i.idleTickId &&
                (window.clearInterval(i.idleTickId), (i.idleTickId = 0)),
            (i.idleDeadlineTs = Date.now() + n),
            u(),
            (i.idleTickId = window.setInterval(() => {
                u();
            }, 1e3)),
            (i.idleTimerId = window.setTimeout(() => {
                if (i.assistantBusy || i.queueManualRefreshBusy)
                    return (
                        s(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void m({ durationMs: 15e3 })
                    );
                p({ reason: 'idle_timeout' });
            }, n)));
    }
    function f() {
        m();
    }
    function p({ reason: e = 'manual' } = {}) {
        (!(function () {
            const e = o('checkinForm'),
                t = o('walkinForm');
            (e instanceof HTMLFormElement && e.reset(),
                t instanceof HTMLFormElement && t.reset(),
                F());
        })(),
            d(),
            l(),
            s(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            S(),
            m());
    }
    function g() {
        let e = o('queueOpsHint');
        if (e) return e;
        const t = document.querySelector('.kiosk-side .kiosk-card'),
            n = o('queueUpdatedAt');
        return t && n
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function y(e) {
        const t = g();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function h() {
        let e = o('queueOutboxHint');
        if (e) return e;
        const t = g();
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
        const t = h();
        t &&
            (t.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function b() {
        try {
            localStorage.setItem(n, JSON.stringify(i.offlineOutbox));
        } catch (e) {}
    }
    function S() {
        const e = i.offlineOutbox.length;
        if (e <= 0) return void k('Pendientes offline: 0 (sin pendientes).');
        const t = Date.parse(String(i.offlineOutbox[0]?.queuedAt || ''));
        k(
            `Pendientes offline: ${e} · sincronizacion automatica al reconectar${Number.isFinite(t) ? ` · mas antiguo ${q(Date.now() - t)}` : ''}`
        );
    }
    function v() {
        let e = o('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = o('queueUpdatedAt');
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
    function T(e) {
        const t = v();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function q(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const i = Math.floor(n / 60),
            a = n % 60;
        return a <= 0 ? `${i}m` : `${i}m ${a}s`;
    }
    function M() {
        return i.queueLastHealthySyncAt
            ? `hace ${q(Date.now() - i.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function L(e) {
        const t = o('queueUpdatedAt');
        if (!t) return;
        const n = Date.parse(String(e || ''));
        Number.isFinite(n)
            ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function w() {
        const e = Math.max(0, Number(i.queueFailureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function E() {
        i.queueTimerId &&
            (window.clearTimeout(i.queueTimerId), (i.queueTimerId = 0));
    }
    function x(e) {
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
    async function I() {
        if (i.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        i.queueRefreshBusy = !0;
        try {
            const e = await r('queue-state');
            ((i.queueState = e.data || {}),
                (function (e) {
                    const t = o('queueWaitingCount'),
                        n = o('queueCalledCount'),
                        i = o('queueCallingNow'),
                        r = o('queueNextList');
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
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${a(e.assignedConsultorio)}</header>\n                            <strong>${a(e.ticketCode || '--')}</strong>\n                            <span>${a(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                                  )
                                  .join(''));
                    }
                    if (r) {
                        const t = Array.isArray(e?.nextTickets)
                            ? e.nextTickets
                            : [];
                        0 === t.length
                            ? (r.innerHTML =
                                  '<li class="queue-empty">No hay turnos en espera.</li>')
                            : (r.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <li>\n                            <span class="ticket-code">${a(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${a(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${a(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(i.queueState),
                L(i.queueState?.updatedAt));
            const t = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(i.queueState);
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
            i.queueRefreshBusy = !1;
        }
    }
    function C(e, t) {
        const n = o('ticketResult');
        if (!n) return;
        const r = e?.data || {},
            s = e?.print || {},
            c = Array.isArray(i.queueState?.nextTickets)
                ? i.queueState.nextTickets
                : [],
            u = c.find((e) => Number(e.id) === Number(r.id))?.position || '-',
            l = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${a(s.message || 'sin detalle')})`;
        n.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${a(t)}</p>\n            <div class="ticket-result-main">\n                <strong>${a(r.ticketCode || '--')}</strong>\n                <span>${a(r.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${a(u)}</dd></div>\n                <div><dt>Tipo</dt><dd>${a(r.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${a(x(r.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${l}</p>\n        </article>\n    `;
    }
    function H({
        originLabel: e,
        patientInitials: t,
        queueType: n,
        queuedAt: r,
    }) {
        const s = o('ticketResult');
        s &&
            (s.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${a(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${a(`PEND-${String(i.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${a(t || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${a(n || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${a(x(r))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function $(e) {
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
    function A({
        resource: e,
        body: t,
        originLabel: n,
        patientInitials: a,
        queueType: o,
    }) {
        const r = String(e || '');
        if ('queue-ticket' !== r && 'queue-checkin' !== r) return null;
        const s = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: r,
            body: t && 'object' == typeof t ? t : {},
            originLabel: String(n || 'Solicitud offline'),
            patientInitials: String(a || '--'),
            queueType: String(o || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
        };
        return (
            (i.offlineOutbox = [s, ...i.offlineOutbox].slice(0, 25)),
            b(),
            S(),
            s
        );
    }
    async function O({
        source: e = 'auto',
        force: t = !1,
        maxItems: n = 4,
    } = {}) {
        if (i.offlineOutboxFlushBusy) return;
        if (!i.offlineOutbox.length) return;
        if (!t && !1 === navigator.onLine) return;
        i.offlineOutboxFlushBusy = !0;
        let a = 0;
        try {
            for (
                ;
                i.offlineOutbox.length && a < Math.max(1, Number(n || 1));
            ) {
                const e = i.offlineOutbox[0];
                try {
                    const t = await r(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (i.offlineOutbox.shift(),
                        b(),
                        S(),
                        C(t, `${e.originLabel} (sincronizado)`),
                        s(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        (a += 1));
                } catch (t) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(t?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        b(),
                        S());
                    const n = $(t);
                    s(
                        n
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${t.message}`,
                        n ? 'info' : 'error'
                    );
                    break;
                }
            }
            a > 0 &&
                ((i.queueFailureStreak = 0),
                (await I()).ok &&
                    ((i.queueLastHealthySyncAt = Date.now()),
                    c('live', 'Cola conectada'),
                    y(`Outbox sincronizado desde ${e}. (${M()})`)));
        } finally {
            i.offlineOutboxFlushBusy = !1;
        }
    }
    async function B(e) {
        if (
            (e.preventDefault(),
            f(),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const t = o('checkinPhone'),
            n = o('checkinTime'),
            a = o('checkinDate'),
            u = o('checkinInitials'),
            l = o('checkinSubmit'),
            d = t instanceof HTMLInputElement ? t.value.trim() : '',
            m = n instanceof HTMLInputElement ? n.value.trim() : '',
            p = a instanceof HTMLInputElement ? a.value.trim() : '',
            g = u instanceof HTMLInputElement ? u.value.trim() : '';
        if (d && m && p) {
            l instanceof HTMLButtonElement && (l.disabled = !0);
            try {
                const e = {
                        telefono: d,
                        hora: m,
                        fecha: p,
                        patientInitials: g,
                    },
                    t = await r('queue-checkin', { method: 'POST', body: e });
                (s('Check-in registrado correctamente', 'success'),
                    C(
                        t,
                        t.replay ? 'Check-in ya existente' : 'Check-in de cita'
                    ),
                    (i.queueFailureStreak = 0),
                    (await I()).ok ||
                        c(
                            'reconnecting',
                            'Check-in registrado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if ($(e)) {
                    const e = A({
                        resource: 'queue-checkin',
                        body: {
                            telefono: d,
                            hora: m,
                            fecha: p,
                            patientInitials: g,
                        },
                        originLabel: 'Check-in de cita',
                        patientInitials: g || d.slice(-2),
                        queueType: 'appointment',
                    });
                    if (e)
                        return (
                            c('offline', 'Sin conexion al backend'),
                            y(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            H({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void s(
                                'Check-in guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                s(`No se pudo registrar el check-in: ${e.message}`, 'error');
            } finally {
                l instanceof HTMLButtonElement && (l.disabled = !1);
            }
        } else
            s('Telefono, fecha y hora son obligatorios para check-in', 'error');
    }
    async function N(e) {
        (e.preventDefault(), f());
        const t = o('walkinName'),
            n = o('walkinInitials'),
            a = o('walkinPhone'),
            u = o('walkinSubmit'),
            l = t instanceof HTMLInputElement ? t.value.trim() : '',
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
                })(l),
            m = a instanceof HTMLInputElement ? a.value.trim() : '';
        if (d) {
            u instanceof HTMLButtonElement && (u.disabled = !0);
            try {
                const e = { patientInitials: d, name: l, phone: m },
                    t = await r('queue-ticket', { method: 'POST', body: e });
                (s('Turno walk-in registrado correctamente', 'success'),
                    C(t, 'Turno sin cita'),
                    (i.queueFailureStreak = 0),
                    (await I()).ok ||
                        c(
                            'reconnecting',
                            'Turno creado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if ($(e)) {
                    const e = A({
                        resource: 'queue-ticket',
                        body: { patientInitials: d, name: l, phone: m },
                        originLabel: 'Turno sin cita',
                        patientInitials: d,
                        queueType: 'walk_in',
                    });
                    if (e)
                        return (
                            c('offline', 'Sin conexion al backend'),
                            y(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            H({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void s(
                                'Turno guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                s(`No se pudo crear el turno: ${e.message}`, 'error');
            } finally {
                u instanceof HTMLButtonElement && (u.disabled = !1);
            }
        } else s('Ingresa iniciales o nombre para generar el turno', 'error');
    }
    function D(e, t) {
        const n = o('assistantMessages');
        if (!n) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${a(t)}</p>`),
            n.appendChild(i),
            (n.scrollTop = n.scrollHeight));
    }
    async function R(e) {
        if ((e.preventDefault(), f(), i.assistantBusy)) return;
        const t = o('assistantInput'),
            n = o('assistantSend');
        if (!(t instanceof HTMLInputElement)) return;
        const a = t.value.trim();
        if (a) {
            (D('user', a),
                (t.value = ''),
                (i.assistantBusy = !0),
                n instanceof HTMLButtonElement && (n.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...i.chatHistory.slice(-6),
                        { role: 'user', content: a },
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
                    o = (function (e) {
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
                (D('bot', o),
                    (i.chatHistory = [
                        ...i.chatHistory,
                        { role: 'user', content: a },
                        { role: 'assistant', content: o },
                    ].slice(-8)));
            } catch (e) {
                D(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((i.assistantBusy = !1),
                    n instanceof HTMLButtonElement && (n.disabled = !1));
            }
        }
    }
    function P(e) {
        i.themeMode = e;
        const t = document.documentElement,
            n = i.mediaQuery instanceof MediaQueryList && i.mediaQuery.matches,
            a = 'system' === e ? (n ? 'dark' : 'light') : e;
        ((t.dataset.theme = a),
            document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                const n = t.getAttribute('data-theme-mode');
                (t.classList.toggle('is-active', n === e),
                    t.setAttribute('aria-pressed', String(n === e)));
            }));
    }
    function F() {
        const e = o('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function z({ immediate: e = !1 } = {}) {
        if ((E(), !i.queuePollingEnabled)) return;
        const t = e ? 0 : w();
        i.queueTimerId = window.setTimeout(() => {
            _();
        }, t);
    }
    async function _() {
        if (!i.queuePollingEnabled) return;
        if (document.hidden)
            return (
                c('paused', 'Cola en pausa (pestana oculta)'),
                y('Pestana oculta. Turnero en pausa temporal.'),
                void z()
            );
        if (!1 === navigator.onLine)
            return (
                (i.queueFailureStreak += 1),
                c('offline', 'Sin conexion al backend'),
                y(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                S(),
                void z()
            );
        await O({ source: 'poll' });
        const e = await I();
        if (e.ok && !e.stale)
            ((i.queueFailureStreak = 0),
                (i.queueLastHealthySyncAt = Date.now()),
                c('live', 'Cola conectada'),
                y(
                    `Operacion estable (${M()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            i.queueFailureStreak += 1;
            const t = q(e.ageMs || 0);
            (c('reconnecting', `Watchdog: cola estancada ${t}`),
                y(
                    `Cola degradada: sin cambios en ${t}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            i.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(w() / 1e3));
            (c('reconnecting', `Reintentando en ${e}s`),
                y(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (S(), z());
    }
    async function j() {
        if (!i.queueManualRefreshBusy) {
            (f(),
                (i.queueManualRefreshBusy = !0),
                T(!0),
                c('reconnecting', 'Refrescando manualmente...'));
            try {
                await O({ source: 'manual' });
                const e = await I();
                if (e.ok && !e.stale)
                    return (
                        (i.queueFailureStreak = 0),
                        (i.queueLastHealthySyncAt = Date.now()),
                        c('live', 'Cola conectada'),
                        void y(`Sincronizacion manual exitosa (${M()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = q(e.ageMs || 0);
                    return (
                        c('reconnecting', `Watchdog: cola estancada ${t}`),
                        void y(
                            `Persisten datos estancados (${t}). Verifica backend o recepcion.`
                        )
                    );
                }
                const t = Math.max(1, Math.ceil(w() / 1e3));
                (c(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${t}s`
                ),
                    y(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                (S(), (i.queueManualRefreshBusy = !1), T(!1));
            }
        }
    }
    function U({ immediate: e = !0 } = {}) {
        if (((i.queuePollingEnabled = !0), e))
            return (c('live', 'Sincronizando cola...'), void _());
        z();
    }
    function Q({ reason: e = 'paused' } = {}) {
        ((i.queuePollingEnabled = !1), (i.queueFailureStreak = 0), E());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (c('offline', 'Sin conexion al backend'),
              y('Sin conexion. Esperando reconexion para reanudar cola.'),
              void S())
            : 'hidden' === t
              ? (c('paused', 'Cola en pausa (pestana oculta)'),
                void y('Pestana oculta. Reanudando al volver a primer plano.'))
              : (c('paused', 'Cola en pausa'),
                y('Sincronizacion pausada por navegacion.'),
                void S());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((i.idleResetMs = (function () {
            const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                n = Number.isFinite(e) ? e : 9e4;
            return Math.min(t, Math.max(5e3, Math.round(n)));
        })()),
            (function () {
                const t = localStorage.getItem(e) || 'system';
                ((i.mediaQuery = window.matchMedia(
                    '(prefers-color-scheme: dark)'
                )),
                    i.mediaQuery.addEventListener('change', () => {
                        'system' === i.themeMode && P('system');
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
                                    (localStorage.setItem(e, n), P(n));
                                })(
                                    t.getAttribute('data-theme-mode') ||
                                        'system'
                                );
                            });
                        }),
                    P(t));
            })(),
            F());
        const a = o('checkinForm'),
            r = o('walkinForm'),
            s = o('assistantForm');
        (a instanceof HTMLFormElement && a.addEventListener('submit', B),
            r instanceof HTMLFormElement && r.addEventListener('submit', N),
            s instanceof HTMLFormElement && s.addEventListener('submit', R),
            (function () {
                let e = o('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const t = o('kioskStatus');
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
        const u = o('kioskSessionResetBtn');
        (u instanceof HTMLButtonElement &&
            u.addEventListener('click', () => {
                p({ reason: 'manual' });
            }),
            d(),
            l(),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        f();
                    },
                    !0
                );
            }),
            m(),
            g(),
            h(),
            (function () {
                try {
                    const e = localStorage.getItem(n);
                    if (!e) return void (i.offlineOutbox = []);
                    const t = JSON.parse(e);
                    if (!Array.isArray(t)) return void (i.offlineOutbox = []);
                    i.offlineOutbox = t
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
                        }))
                        .filter(
                            (e) =>
                                e.id &&
                                ('queue-ticket' === e.resource ||
                                    'queue-checkin' === e.resource)
                        )
                        .slice(0, 25);
                } catch (e) {
                    i.offlineOutbox = [];
                }
            })(),
            S());
        const k = v();
        (k instanceof HTMLButtonElement &&
            k.addEventListener('click', () => {
                j();
            }),
            c('paused', 'Sincronizacion lista'),
            y('Esperando primera sincronizacion de cola...'),
            L(''),
            !1 !== navigator.onLine && O({ source: 'startup', force: !0 }),
            U({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? Q({ reason: 'hidden' })
                    : U({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (O({ source: 'online', force: !0 }), U({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (Q({ reason: 'offline' }), S());
            }),
            window.addEventListener('beforeunload', () => {
                Q({ reason: 'paused' });
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                if ('keyr' === t) return (e.preventDefault(), void j());
                'keyl' === t && (e.preventDefault(), p({ reason: 'manual' }));
            }));
    });
})();
