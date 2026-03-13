!(function () {
    'use strict';
    const e = '/figo-chat.php';
    let o = null,
        t = [],
        n = [],
        r = null,
        a = null,
        i = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador',
        s = '',
        c = '+593 98 786 6885',
        l = 'caro93narvaez@gmail.com',
        d = !1,
        u = null,
        p = 0;
    function g(...e) {
        o && 'function' == typeof o.debugLog && o.debugLog(...e);
    }
    function m() {
        o &&
            'function' == typeof o.removeTypingIndicator &&
            o.removeTypingIndicator();
    }
    function f(e, t = !1) {
        o && 'function' == typeof o.addBotMessage && o.addBotMessage(e, t);
    }
    function b() {
        o && 'function' == typeof o.startChatBooking && o.startChatBooking();
    }
    function h(e, t = 'info', n = '') {
        o && 'function' == typeof o.showToast && o.showToast(e, t, n);
    }
    function y() {
        if (o && 'function' == typeof o.getConversationContext) {
            const e = o.getConversationContext();
            return Array.isArray(e) ? e.slice() : [];
        }
        return Array.isArray(t) ? t.slice() : [];
    }
    function v(e) {
        ((t = Array.isArray(e) ? e.slice() : []),
            o &&
                'function' == typeof o.setConversationContext &&
                o.setConversationContext(t.slice()));
    }
    function I() {
        if (o && 'function' == typeof o.getChatHistory) {
            const e = o.getChatHistory();
            return Array.isArray(e) ? e.slice() : [];
        }
        return Array.isArray(n) ? n.slice() : [];
    }
    function w(e) {
        ((n = Array.isArray(e) ? e.slice() : []),
            o &&
                'function' == typeof o.setChatHistory &&
                o.setChatHistory(n.slice()));
    }
    function S() {
        if (o && 'function' == typeof o.getCurrentAppointment) {
            const e = o.getCurrentAppointment();
            return e && 'object' == typeof e ? e : null;
        }
        return r && 'object' == typeof r ? r : null;
    }
    function C() {
        if (o && 'function' == typeof o.getClinicalRouteContext) {
            const e = o.getClinicalRouteContext();
            return e && 'object' == typeof e ? e : {};
        }
        try {
            const e = new URLSearchParams(window.location.search || '');
            return {
                mode: String(e.get('mode') || '').trim(),
                sessionId: String(e.get('sessionId') || '').trim(),
                caseId: String(e.get('caseId') || '').trim(),
                appointmentId: String(e.get('appointmentId') || '').trim(),
                surface: String(e.get('surface') || '').trim(),
            };
        } catch {
            return {};
        }
    }
    function A() {
        return (
            'clinical_intake' ===
            ((o &&
                'function' == typeof o.getChatMode &&
                String(o.getChatMode() || '').trim()) ||
                'general')
        );
    }
    function _() {
        if (o && 'function' == typeof o.getClinicalHistorySession) {
            const e = o.getClinicalHistorySession();
            return e && 'object' == typeof e ? e : null;
        }
        return a && 'object' == typeof a ? a : null;
    }
    function j(e = null) {
        const o = e && 'object' == typeof e ? e : _() || {},
            t = o.metadata && 'object' == typeof o.metadata ? o.metadata : {},
            n =
                t.patientIntake && 'object' == typeof t.patientIntake
                    ? t.patientIntake
                    : {};
        return {
            sessionId: String(o.sessionId || n.sessionId || '').trim(),
            caseId: String(o.caseId || n.caseId || '').trim(),
            appointmentId: n.appointmentId ?? o.appointmentId ?? null,
            surface: String(n.surface || o.surface || '').trim(),
        };
    }
    function E() {
        p && (clearTimeout(p), (p = 0));
    }
    function $(e, o) {
        if ((E(), 'queued' !== String(e?.mode || e?.status || '').trim()))
            return;
        const t = j(o);
        if (!t.sessionId && !t.caseId) return;
        const n = Math.max(1e3, Math.min(1e4, Number(e?.pollAfterMs || 2e3)));
        p = setTimeout(() => {
            q({
                render: !0,
                force: !0,
                sessionId: t.sessionId,
                caseId: t.caseId,
            }).catch(() => {});
        }, n);
    }
    function k(e, t = {}) {
        const n = e && 'object' == typeof e ? e : {},
            r = n.session && 'object' == typeof n.session ? n.session : null;
        if (!r) return null;
        var i;
        ((a = (i = r) && 'object' == typeof i ? i : null),
            o &&
                'function' == typeof o.setClinicalHistorySession &&
                o.setClinicalHistorySession(a));
        const s = Array.isArray(r.transcript) ? r.transcript : [],
            c = (function (e) {
                return (Array.isArray(e) ? e : [])
                    .map((e) => {
                        if (!e || 'object' != typeof e) return null;
                        const o = String(e.role || '')
                                .trim()
                                .toLowerCase(),
                            t = String(e.content || '').trim();
                        if (!t) return null;
                        const n = {
                            time: String(
                                e.createdAt ||
                                    e.updatedAt ||
                                    new Date().toISOString()
                            ),
                        };
                        return 'user' === o
                            ? { ...n, type: 'user', text: t }
                            : { ...n, type: 'bot', text: U(t) };
                    })
                    .filter(Boolean);
            })(s);
        var l;
        return (
            w(c),
            v(
                (function (e) {
                    return (Array.isArray(e) ? e : [])
                        .map((e) => {
                            if (!e || 'object' != typeof e) return null;
                            const o = String(e.role || '')
                                    .trim()
                                    .toLowerCase(),
                                t = String(e.content || '').trim();
                            return t
                                ? {
                                      role: 'user' === o ? 'user' : 'assistant',
                                      content: t,
                                  }
                                : null;
                        })
                        .filter(Boolean)
                        .slice(-14);
                })(s)
            ),
            !1 !== t.render &&
                ((l = c),
                o &&
                    'function' == typeof o.renderChatHistory &&
                    o.renderChatHistory(Array.isArray(l) ? l : [])),
            $(n.ai, r),
            r
        );
    }
    async function q(e = {}) {
        const t = C(),
            n = _(),
            r = j(n),
            a = {
                sessionId: String(
                    e.sessionId || t.sessionId || r.sessionId || ''
                ).trim(),
                caseId: String(e.caseId || t.caseId || r.caseId || '').trim(),
            },
            i = !0 === e.render,
            s = !0 === e.force;
        return A() || a.sessionId || a.caseId || !0 === s
            ? !s &&
              n &&
              (function (e, o = {}) {
                  const t = j(e),
                      n = String(o.sessionId || '').trim(),
                      r = String(o.caseId || '').trim();
                  return !(
                      (!t.sessionId && !t.caseId) ||
                      (n && n !== t.sessionId) ||
                      (r && r !== t.caseId)
                  );
              })(n, a)
                ? (i && k({ session: n }, { render: !0 }), n)
                : a.sessionId || a.caseId
                  ? ((!s && u) ||
                        (u = (async function (e = {}, t = 'hydrate') {
                            const n = {
                                sessionId: String(e.sessionId || '').trim(),
                                caseId: String(e.caseId || '').trim(),
                            };
                            if (!n.sessionId && !n.caseId) return null;
                            const r = new URL(
                                (o &&
                                'string' ==
                                    typeof o.clinicalHistorySessionEndpoint
                                    ? o.clinicalHistorySessionEndpoint.trim()
                                    : '') ||
                                    '/api.php?resource=clinical-history-session',
                                window.location.origin
                            );
                            (n.sessionId &&
                                r.searchParams.set('sessionId', n.sessionId),
                                n.caseId &&
                                    r.searchParams.set('caseId', n.caseId),
                                r.searchParams.set('t', String(Date.now())));
                            const a = await fetch(r.toString(), {
                                method: 'GET',
                                headers: {
                                    Accept: 'application/json',
                                    'Cache-Control': 'no-cache',
                                },
                            });
                            let i;
                            g(`?? Status (${t}):`, a.status);
                            try {
                                i = await a.json();
                            } catch (e) {
                                throw D('clinical_session_invalid_json', {
                                    code: 'clinical_session_invalid_json',
                                    cause: e,
                                });
                            }
                            if (!a.ok || !0 !== i?.ok || !i?.data)
                                throw D('clinical_session_fetch_failed', {
                                    code: 'clinical_session_fetch_failed',
                                    status: a.status,
                                    payload: i,
                                });
                            return i.data;
                        })(a, 'clinical_session')
                            .then((e) => k(e, { render: i }))
                            .catch((e) => {
                                if (
                                    (g(
                                        'No se pudo hidratar la sesion clinica:',
                                        e
                                    ),
                                    n)
                                )
                                    return (
                                        i && k({ session: n }, { render: !0 }),
                                        n
                                    );
                                throw e;
                            })
                            .finally(() => {
                                u = null;
                            })),
                    u)
                  : (i && n && k({ session: n }, { render: !0 }), n)
            : null;
    }
    function T() {
        return (
            'true' === localStorage.getItem('forceAI') ||
            'file:' !== window.location.protocol
        );
    }
    function D(e, o = {}) {
        const t = new Error(e);
        return (o && 'object' == typeof o && Object.assign(t, o), t);
    }
    function P() {
        f(
            'No pude continuar tu <strong>historia clinica</strong> en este momento.<br><br>\nPuedes intentar de nuevo en unos minutos o seguir por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp +593 98 245 3672</a> si necesitas ayuda inmediata.',
            !1
        );
    }
    function R(e) {
        return e
            ? e
                  .toString()
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
            : '';
    }
    function M(e) {
        const o = R(e);
        return (
            !!o &&
            !/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(
                o
            ) &&
            !(function (e) {
                const o = R(e);
                return (
                    !o ||
                    /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicacion|direccion|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|telefono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/.test(
                        o
                    )
                );
            })(o) &&
            /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(
                o
            )
        );
    }
    function N(e) {
        const o = R(e);
        if (!o) return !0;
        const t = [
            /gracias por tu mensaje/,
            /puedo ayudarte con aurora derm/,
            /soy figo/,
            /asistente virtual/,
            /modo offline/,
            /te sugiero/,
            /para informacion mas detallada/,
            /escribenos por whatsapp/,
            /visita estas secciones/,
            /hay algo mas en lo que pueda orientarte/,
            /si prefieres atencion inmediata/,
            /te guio paso a paso/,
            /sobre ".*", te guio paso a paso/,
            /estoy teniendo problemas tecnicos/,
            /contactanos directamente por whatsapp/,
            /te atenderemos personalmente/,
        ];
        let n = 0;
        for (const e of t) e.test(o) && (n += 1);
        return n >= 2;
    }
    async function L(t, n = {}, r = 'principal') {
        const a = 'string' == typeof n.source ? n.source.trim() : '',
            i = o && 'string' == typeof o.chatSource ? o.chatSource.trim() : '',
            s = a || i,
            c = {
                model: 'figo-assistant',
                messages: t,
                max_tokens: 256,
                temperature: 0.7,
                ...n,
            };
        s && (c.source = s);
        const l = new AbortController(),
            d = setTimeout(() => l.abort(), 9e3);
        let u;
        try {
            u = await fetch(e + '?t=' + Date.now(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify(c),
                signal: l.signal,
            });
        } catch (e) {
            if (e && 'AbortError' === e.name) throw new Error('TIMEOUT');
            throw e;
        } finally {
            clearTimeout(d);
        }
        g(`?? Status (${r}):`, u.status);
        const p = await u.text();
        let m;
        g(`?? Respuesta cruda (${r}):`, p.substring(0, 500));
        try {
            m = p ? JSON.parse(p) : {};
        } catch (e) {
            if (!u.ok) throw new Error(`HTTP ${u.status}`);
            throw (
                g('Error parseando JSON:', e),
                new Error('Respuesta no es JSON valido')
            );
        }
        const f =
            m && 'object' == typeof m.clinicalIntake && m.clinicalIntake
                ? m.clinicalIntake
                : null;
        if (m && 'object' == typeof m && 'queued' === m.mode)
            return {
                content: String(m?.choices?.[0]?.message?.content || ''),
                mode: 'queued',
                source: 'string' == typeof m.source ? m.source : '',
                reason: 'string' == typeof m.reason ? m.reason : '',
                configured: !1 !== m.configured,
                recursiveConfigDetected: !0 === m.recursiveConfigDetected,
                upstreamStatus: Number.isFinite(m.upstreamStatus)
                    ? Number(m.upstreamStatus)
                    : 0,
                queued: !0,
                provider:
                    'string' == typeof m.provider
                        ? m.provider
                        : 'openclaw_queue',
                jobId: 'string' == typeof m.jobId ? m.jobId : '',
                pollUrl: 'string' == typeof m.pollUrl ? m.pollUrl : '',
                pollAfterMs: Number.isFinite(m.pollAfterMs)
                    ? Number(m.pollAfterMs)
                    : 1500,
                clinicalIntake: f,
            };
        if (!u.ok || !1 === m.ok) {
            const e =
                m && 'string' == typeof m.reason && m.reason
                    ? ` (${m.reason})`
                    : '';
            throw D(`HTTP ${u.status}${e}`, {
                provider: m && 'string' == typeof m.provider ? m.provider : '',
                code: m && 'string' == typeof m.errorCode ? m.errorCode : '',
                noLocalFallback:
                    m &&
                    'string' == typeof m.provider &&
                    'openclaw_queue' === m.provider,
            });
        }
        if (!m.choices || !m.choices[0] || !m.choices[0].message)
            throw (
                g('Estructura invalida:', m),
                new Error('Respuesta invalida')
            );
        return {
            content: m.choices[0].message.content || '',
            mode: 'string' == typeof m.mode ? m.mode : '',
            source: 'string' == typeof m.source ? m.source : '',
            reason: 'string' == typeof m.reason ? m.reason : '',
            configured: !1 !== m.configured,
            recursiveConfigDetected: !0 === m.recursiveConfigDetected,
            upstreamStatus: Number.isFinite(m.upstreamStatus)
                ? Number(m.upstreamStatus)
                : 0,
            queued: !1,
            provider: 'string' == typeof m.provider ? m.provider : '',
            jobId: 'string' == typeof m.jobId ? m.jobId : '',
            pollUrl: 'string' == typeof m.pollUrl ? m.pollUrl : '',
            pollAfterMs: Number.isFinite(m.pollAfterMs)
                ? Number(m.pollAfterMs)
                : 1500,
            clinicalIntake: f,
        };
    }
    function O(e, o = !0) {
        const t = R(e);
        if (/forzar ia|activar ia|modo ia|usar ia/.test(t)) return void F();
        if (/debug|info sistema|informacion tecnica/.test(t)) return void z();
        let n;
        if (/ayuda|help|menu|opciones|que puedes hacer/.test(t))
            ((n = 'Opciones disponibles:<br><br>'),
                (n +=
                    '<strong>Servicios:</strong> Información sobre consultas<br>'),
                (n += '<strong>Precios:</strong> Tarifas de servicios<br>'),
                (n += '<strong>Citas:</strong> Como agendar<br>'),
                (n += '<strong>Ubicación:</strong> Dirección y horarios<br>'),
                (n += '<strong>Contacto:</strong> WhatsApp y teléfono'));
        else {
            if (M(t))
                return (
                    (n =
                        'Puedo ayudarte solo con temas de <strong>Aurora Derm</strong>.<br><br>\nPuedes consultarme sobre:<br>\n- Servicios y tratamientos dermatologicos<br>\n- Precios y formas de pago<br>\n- Agenda de citas y horarios<br>\n- Ubicacion y contacto<br><br>\nSi quieres, te llevo directo a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp</a>.'),
                    void f(n, o)
                );
            if (
                /hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(
                    t
                )
            )
                ((n =
                    '¡Hola! Soy <strong>Figo</strong>, asistente de <strong>Aurora Derm</strong>.<br><br>'),
                    (n += 'Puedo ayudarte con:<br>'),
                    (n += '• Servicios dermatologicos<br>'),
                    (n += '• Precios de tratamientos<br>'),
                    (n += '• Agendar citas<br>'),
                    (n += '• Ubicacion y horarios<br><br>'),
                    (n += '¿En que puedo ayudarte?'));
            else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(t))
                ((n = 'Servicios dermatológicos:<br><br>'),
                    (n += '<strong>Consultas:</strong><br>'),
                    (n += '• Presencial: $46<br>'),
                    (n += '• Telefónica: $28.75<br>'),
                    (n += '• Video: $34.50<br><br>'),
                    (n += '<strong>Tratamientos:</strong><br>'),
                    (n += '• Acné: desde $80<br>'),
                    (n += '• Láser: desde $172.50<br>'),
                    (n += '• Rejuvenecimiento: desde $138<br>'),
                    (n += '• Detección de cáncer de piel: desde $70'));
            else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(t))
                ((n = 'Precios (incluyen IVA 15%):<br><br>'),
                    (n += '<strong>Consultas:</strong><br>'),
                    (n += '• Presencial: $46<br>'),
                    (n += '• Telefónica: $28.75<br>'),
                    (n += '• Video: $34.50<br><br>'),
                    (n += '<strong>Tratamientos (desde):</strong><br>'),
                    (n += '• Acné: $80<br>'),
                    (n += '• Láser: $172.50<br>'),
                    (n += '• Rejuvenecimiento: $138<br><br>'),
                    (n += 'Para presupuesto preciso, agenda una consulta.'));
            else if (
                (function (e) {
                    const o = R(e);
                    return /(pago|pagar|metodo de pago|tarjeta|transferencia|efectivo|deposito|comprobante|referencia|factura|visa|mastercard)/.test(
                        o
                    );
                })(t)
            )
                n = (function (e) {
                    let o =
                        'Asi puedes realizar tu pago en la web:<br><br>\n<strong>1) Reserva tu cita</strong><br>\nVe a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>\n\n<strong>2) Abre el modulo de pago</strong><br>\nAl enviar el formulario se abre la ventana de pago automaticamente.<br><br>\n\n<strong>3) Elige metodo de pago</strong><br>\n• <strong>Tarjeta:</strong> cobro seguro con Stripe.<br>\n• <strong>Transferencia:</strong> subes el comprobante y el numero de referencia.<br>\n• <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>';
                    return (
                        /(tarjeta|visa|mastercard|debito|credito|stripe)/.test(
                            e
                        ) &&
                            (o +=
                                '<strong>Tarjeta (paso a paso):</strong><br>\n1. Selecciona <strong>Tarjeta</strong>.<br>\n2. Completa nombre + datos de tarjeta en el formulario seguro.<br>\n3. Confirma el pago y espera la validacion final de la cita.<br><br>'),
                        /(transferencia|deposito|comprobante|referencia|banco)/.test(
                            e
                        ) &&
                            (o +=
                                '<strong>Transferencia (paso a paso):</strong><br>\n1. Selecciona <strong>Transferencia</strong>.<br>\n2. Realiza el deposito o transferencia a la cuenta indicada.<br>\n3. Sube el comprobante y agrega numero de referencia.<br>\n4. Nuestro equipo valida y confirma por WhatsApp.<br><br>'),
                        /(efectivo|consultorio|presencial)/.test(e) &&
                            (o +=
                                '<strong>Efectivo:</strong><br>\nLa cita queda registrada y pagas el dia de la atencion en consultorio.<br><br>'),
                        /(factura|facturacion|ruc|cedula)/.test(e) &&
                            (o +=
                                '<strong>Facturacion:</strong><br>\nComparte tus datos de facturacion (cedula/RUC y correo) y te ayudamos por WhatsApp.<br><br>'),
                        (o +=
                            '<strong>4) Confirmacion</strong><br>\nTu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">098 245 3672</a>.<br><br>\n\nSi quieres, te guio ahora mismo segun el metodo que prefieras: <strong>tarjeta</strong>, <strong>transferencia</strong> o <strong>efectivo</strong>.'),
                        o
                    );
                })(t);
            else if (
                /hablar con|humano|persona real|doctor real|agente/.test(t)
            )
                n =
                    'Entiendo que prefieres hablar con una persona. ?????<br><br>\nPuedes chatear directamente con nuestro equipo humano por WhatsApp aquí:<br><br>\n?? <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Abrir Chat de WhatsApp</a><br><br>\nO llámanos al +593 98 245 3672.';
            else {
                if (/cita|agendar|reservar|turno|hora/.test(t)) return void b();
                /acne|grano|espinilla|barro/.test(t)
                    ? ((n =
                          'El acne es muy comun y tenemos soluciones efectivas.<br><br>'),
                      (n += 'Nuestro enfoque:<br>'),
                      (n += '• Evaluacion personalizada<br>'),
                      (n += '• Tratamientos topicos<br>'),
                      (n += '• Medicacion oral si es necesario<br>'),
                      (n += '• Peelings quimicos<br>'),
                      (n += '• Laser para cicatrices<br><br>'),
                      (n += 'Primera consulta: $40<br><br>'),
                      (n += '¿Te gustaria agendar?'))
                    : /laser/.test(t)
                      ? ((n = 'Tecnologia laser de ultima generacion.<br><br>'),
                        (n += 'Tratamientos:<br>'),
                        (n += '• Eliminacion de lesiones vasculares<br>'),
                        (n += '• Tratamiento de manchas<br>'),
                        (n += '• Rejuvenecimiento facial<br>'),
                        (n += '• Cicatrices de acne<br><br>'),
                        (n += 'Precio: Desde $150<br><br>'),
                        (n += 'Se requiere consulta de evaluación previa.<br>'),
                        (n += '¿Deseas agendar?'))
                      : /donde|ubicacion|direccion|lugar|mapa|quito/.test(t)
                        ? ((n = '<strong>Ubicacion:</strong><br>'),
                          (n += `${i}<br>`),
                          (n += '<br>'),
                          (n += '<strong>Horario:</strong><br>'),
                          (n += 'Lunes - Viernes: 9:00 - 18:00<br>'),
                          (n += 'Sabados: 9:00 - 13:00<br><br>'),
                          (n +=
                              '<strong>Estacionamiento:</strong> Privado disponible<br><br>'),
                          (n += `<strong>Mapa:</strong> <a href="${s}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`),
                          (n += '<strong>Contacto:</strong> 098 245 3672'))
                        : (n =
                              /doctor|medico|especialista|rosero|narvaez|dr|dra/.test(
                                  t
                              )
                                  ? `Contamos con dos excelentes especialistas:\n\n<strong>Dr. Javier Rosero</strong>\nDermatólogo Clínico\n15 años de experiencia\nEspecialista en detección temprana de cáncer de piel\n\n<strong>Dra. Carolina Narvaez</strong>\nDermatóloga Estética\nEspecialista en rejuvenecimiento facial y láser\nContacto directo: ${c} | ${l}\n\nAmbos están disponibles para consulta presencial y online.\n\n¿Con quién te gustaría agendar?`
                                  : /online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(
                                          t
                                      )
                                    ? 'Ofrecemos 3 opciones de consulta remota:\n\n<strong>?? 1. Llamada Telefónica - $25</strong>\nIdeal para consultas rápidas y seguimientos\n\n<strong>?? 2. WhatsApp Video - $30</strong>\nVideollamada por WhatsApp, muy fácil de usar\n\n<strong>3. Video Web (Jitsi) - $30</strong>\nNo necesitas instalar nada, funciona en el navegador\n\nTodas incluyen:\n? Evaluación médica completa\n? Receta digital\n? Recomendaciones personalizadas\n? Seguimiento por WhatsApp\n\n¿Cuál prefieres?'
                                    : /gracias|thank|adios|chao|hasta luego|bye/.test(
                                            t
                                        )
                                      ? '¡De nada! ??\n\nSi tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:\n\n?? WhatsApp: 098 245 3672\n?? Teléfono: 098 245 3672\n\n¡Que tengas un excelente día!'
                                      : 'Puedo ayudarte mejor si eliges una opcion:<br><br>\n1) <strong>Servicios y precios</strong><br>\n2) <strong>Reservar cita</strong><br>\n3) <strong>Pagos</strong><br><br>\nTambien puedes ir directo:<br>\n- <a href="#servicios" data-action="minimize-chat">Servicios</a><br>\n- <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a><br>\n- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp 098 245 3672</a>');
            }
        }
        f(n, o);
    }
    function U(e) {
        return e
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(
                /\[(.+?)\]\((.+?)\)/g,
                '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
            )
            .replace(/\n/g, '<br>');
    }
    function F() {
        (localStorage.setItem('forceAI', 'true'),
            h('Modo IA activado manualmente', 'success'),
            (n = I()),
            n.length > 0 &&
                f(
                    '<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.'
                ));
    }
    function z() {
        const o = T();
        let t = '<strong>Información del sistema:</strong><br><br>';
        ((t += 'Protocolo: ' + window.location.protocol + '<br>'),
            (t += 'Hostname: ' + window.location.hostname + '<br>'),
            (t += 'Usa IA: ' + (o ? 'SI' : 'NO') + '<br>'),
            (t +=
                'Forzado: ' +
                ('true' === localStorage.getItem('forceAI') ? 'SI' : 'NO') +
                '<br><br>'),
            (t += 'Endpoint: ' + e),
            f(t));
    }
    'undefined' != typeof window &&
        ((window.Piel = window.Piel || {}),
        (window.Piel.FigoChatEngine = {
            init: function (e = {}) {
                ((o = e || {}), (t = y()), (n = I()), (r = S()), (a = _()));
                const d = String(o.clinicAddress || '').trim(),
                    u = String(o.clinicMapUrl || '').trim(),
                    p = String(o.doctorCarolinaPhone || '').trim(),
                    g = String(o.doctorCarolinaEmail || '').trim();
                return (
                    d && (i = d),
                    u && (s = u),
                    p && (c = p),
                    g && (l = g),
                    window.Piel && window.Piel.FigoChatEngine
                );
            },
            processWithKimi: async function (n) {
                if (d) return void g('Ya procesando, ignorando duplicado');
                const a = A();
                if (
                    !a &&
                    o &&
                    'function' == typeof o.isChatBookingActive &&
                    !0 === o.isChatBookingActive()
                ) {
                    const e = await (function (e) {
                        return o &&
                            'function' == typeof o.processChatBookingStep
                            ? o.processChatBookingStep(e)
                            : Promise.resolve(!1);
                    })(n);
                    if (!1 !== e) return;
                }
                if (
                    a ||
                    !/cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(
                        n
                    )
                ) {
                    if (
                        ((d = !0),
                        o &&
                            'function' == typeof o.showTypingIndicator &&
                            o.showTypingIndicator(),
                        !a && M(n))
                    )
                        return (
                            m(),
                            f(
                                'Puedo ayudarte con temas de <strong>Aurora Derm</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#v5-booking" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp directo</a>',
                                !1
                            ),
                            void (d = !1)
                        );
                    g('Procesando mensaje:', n);
                    try {
                        T()
                            ? (g('?? Consultando bot del servidor...'),
                              await (async function (o) {
                                  if (A())
                                      await (async function (o) {
                                          let t = null;
                                          try {
                                              t = await q({ render: !1 });
                                          } catch (e) {
                                              g(
                                                  'No se pudo precargar la sesion clinica:',
                                                  e
                                              );
                                          }
                                          const n = (function (e) {
                                              const o = C(),
                                                  t = j(),
                                                  n =
                                                      t.appointmentId ??
                                                      o.appointmentId ??
                                                      null,
                                                  r =
                                                      String(
                                                          o.surface ||
                                                              t.surface ||
                                                              'web_chat'
                                                      ).trim() || 'web_chat',
                                                  a = {
                                                      mode: 'clinical_intake',
                                                      messages: [],
                                                      message: String(
                                                          e || ''
                                                      ).trim(),
                                                      clientMessageId:
                                                          'undefined' !=
                                                              typeof window &&
                                                          window.crypto &&
                                                          'function' ==
                                                              typeof window
                                                                  .crypto
                                                                  .randomUUID
                                                              ? `chat-msg-${window.crypto.randomUUID()}`
                                                              : `chat-msg-${Date.now()}-${Math.floor(1e5 * Math.random())}`,
                                                      surface: r,
                                                  };
                                              return (
                                                  t.sessionId
                                                      ? (a.sessionId =
                                                            t.sessionId)
                                                      : o.sessionId &&
                                                        (a.sessionId = String(
                                                            o.sessionId || ''
                                                        ).trim()),
                                                  t.caseId
                                                      ? (a.caseId = t.caseId)
                                                      : o.caseId &&
                                                        (a.caseId = String(
                                                            o.caseId || ''
                                                        ).trim()),
                                                  null !== n &&
                                                      '' !== n &&
                                                      (a.appointmentId = n),
                                                  a
                                              );
                                          })(o);
                                          if (!n.sessionId && t) {
                                              const e = j(t);
                                              (e.sessionId &&
                                                  (n.sessionId = e.sessionId),
                                                  e.caseId &&
                                                      (n.caseId = e.caseId),
                                                  (null !== n.appointmentId &&
                                                      '' !== n.appointmentId) ||
                                                      null ===
                                                          e.appointmentId ||
                                                      '' === e.appointmentId ||
                                                      (n.appointmentId =
                                                          e.appointmentId));
                                          }
                                          g(
                                              '?? Enviando historia clinica a:',
                                              e
                                          );
                                          let r = await L(
                                              [],
                                              n,
                                              'clinical_intake'
                                          );
                                          const a =
                                              r &&
                                              r.clinicalIntake &&
                                              'object' ==
                                                  typeof r.clinicalIntake
                                                  ? r.clinicalIntake
                                                  : null;
                                          if (a)
                                              return (
                                                  k(a, { render: !0 }),
                                                  void m()
                                              );
                                          !0 === r.queued && $(r, _());
                                          const i = String(
                                              r.content || ''
                                          ).trim();
                                          if (!i)
                                              throw D(
                                                  'clinical_intake_empty_reply',
                                                  {
                                                      code: 'clinical_intake_empty_reply',
                                                  }
                                              );
                                          (m(), f(U(i), !1));
                                      })(o);
                                  else
                                      try {
                                          t = y();
                                          const n = [];
                                          for (const e of t) {
                                              const o = n[n.length - 1];
                                              (o &&
                                                  o.role === e.role &&
                                                  o.content === e.content) ||
                                                  n.push(e);
                                          }
                                          (v(n),
                                              t.length > 14 && v(t.slice(-14)));
                                          const a =
                                              ((t = y()),
                                              [
                                                  {
                                                      role: 'system',
                                                      content:
                                                          'Eres el Dr. Virtual, asistente inteligente de la clinica dermatologica "Aurora Derm" en Quito, Ecuador.\n\nINFORMACION DE LA CLINICA:\n- Nombre: Aurora Derm\n- Doctores: Dr. Javier Rosero (Dermatologo Clinico) y Dra. Carolina Narvaez (Dermatologa Estetica)\n- Direccion: Valparaiso 13-183 y Sodiro, Consultorio Dr. Celio Caiza, Quito (Frente al Colegio de las Mercedarias, a 2 cuadras de la Maternidad Isidro Ayora)\n- Telefono/WhatsApp: 098 245 3672\n- Contacto Dra. Carolina: 098 786 6885 | caro93narvaez@gmail.com\n- Horario: Lunes-Viernes 9:00-18:00, Sabados 9:00-13:00\n- Estacionamiento privado disponible\n\nSERVICIOS Y PRECIOS (con IVA 15%):\n- Consulta Dermatológica: $46\n- Consulta Telefónica: $28.75\n- Video Consulta: $34.50\n- Tratamiento Láser: desde $172.50\n- Rejuvenecimiento: desde $138\n- Tratamiento de Acné: desde $80\n- Detección de Cáncer de Piel: desde $70\n\nOPCIONES DE CONSULTA ONLINE:\n1. Llamada telefonica: tel:+593982453672\n2. WhatsApp Video: https://wa.me/593982453672\n3. Video Web (Jitsi): https://meet.jit.si/AuroraDerm-Consulta\n\nINSTRUCCIONES:\n- Se profesional, amable y empatico\n- Responde en espanol (o en el idioma que use el paciente)\n- Si el paciente tiene sintomas graves o emergencias, recomienda acudir a urgencias\n- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefonica\n- Si no sabes algo especifico, ofrece transferir al doctor real\n- No hagas diagnosticos medicos definitivos, solo orientacion general\n- Usa emojis ocasionalmente para ser amigable\n- Manten respuestas concisas pero informativas\n\nTu objetivo es ayudar a los pacientes a:\n1. Conocer los servicios de la clinica\n2. Entender los precios\n3. Agendar citas\n4. Resolver dudas basicas sobre dermatologia\n5. Conectar con un doctor real cuando sea necesario',
                                                  },
                                                  {
                                                      role: 'system',
                                                      content:
                                                          'MODO FIGO PRO:\n- Responde con pasos claros y accionables, no con texto general.\n- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.\n- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.\n- Mantente enfocado en Aurora Derm (servicios, precios, citas, pagos, ubicación y contacto).\n- Si preguntan temas fuera de la clínica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Aurora Derm y redirige a servicios/citas.\n- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.',
                                                  },
                                                  {
                                                      role: 'system',
                                                      content: `CONTEXTO WEB EN TIEMPO REAL:\n- Seccion actual: ${window.location.hash || '#inicio'}\n- Modal de pago abierto: ${document.getElementById('v5-payment-modal')?.classList.contains('active') || document.getElementById('paymentModal')?.classList.contains('active') ? 'si' : 'no'}\n- Cita en progreso: ${(function () {
                                                          if (((r = S()), !r))
                                                              return 'sin cita activa';
                                                          const e = [];
                                                          return (
                                                              r.service &&
                                                                  e.push(
                                                                      `servicio=${r.service}`
                                                                  ),
                                                              r.doctor &&
                                                                  e.push(
                                                                      `doctor=${r.doctor}`
                                                                  ),
                                                              r.date &&
                                                                  e.push(
                                                                      `fecha=${r.date}`
                                                                  ),
                                                              r.time &&
                                                                  e.push(
                                                                      `hora=${r.time}`
                                                                  ),
                                                              r.price &&
                                                                  e.push(
                                                                      `precio=${r.price}`
                                                                  ),
                                                              e.length
                                                                  ? e.join(', ')
                                                                  : 'sin datos relevantes'
                                                          );
                                                      })()}\n\nFLUJO DE PAGO REAL DEL SITIO:\n1) El paciente completa el formulario de cita.\n2) Se abre el modal de pago automaticamente.\n3) Puede elegir tarjeta, transferencia o efectivo.\n4) Al confirmar, la cita se registra y el equipo valida por WhatsApp.`,
                                                  },
                                                  ...t.slice(-6),
                                              ]);
                                          (g('?? Enviando a:', e),
                                              g(
                                                  '?? Contexto actual:',
                                                  t.length,
                                                  'mensajes'
                                              ));
                                          let i = await L(a, {}, 'principal');
                                          !0 === i.queued &&
                                              (g(
                                                  'Respuesta en cola detectada. jobId:',
                                                  i.jobId || 'n/a'
                                              ),
                                              (i = await (async function (e) {
                                                  const o = String(
                                                      e?.jobId || ''
                                                  ).trim();
                                                  if (!o)
                                                      throw D(
                                                          'queue_missing_job_id',
                                                          {
                                                              code: 'queue_missing_job_id',
                                                              noLocalFallback:
                                                                  !0,
                                                              provider:
                                                                  'openclaw_queue',
                                                          }
                                                      );
                                                  const t = Math.max(
                                                          500,
                                                          Math.min(
                                                              5e3,
                                                              Number(
                                                                  e?.pollAfterMs ||
                                                                      1500
                                                              )
                                                          )
                                                      ),
                                                      n =
                                                          String(
                                                              e?.pollUrl || ''
                                                          ).trim() ||
                                                          `/check-ai-response.php?jobId=${encodeURIComponent(o)}`,
                                                      r = Date.now() + 3e4;
                                                  let a = !0;
                                                  for (; Date.now() < r; ) {
                                                      (a ||
                                                          (await new Promise(
                                                              (e) =>
                                                                  setTimeout(
                                                                      e,
                                                                      t
                                                                  )
                                                          )),
                                                          (a = !1));
                                                      const e = n.includes('?')
                                                          ? `${n}&t=${Date.now()}`
                                                          : `${n}?t=${Date.now()}`;
                                                      let r, i;
                                                      try {
                                                          r = await fetch(e, {
                                                              method: 'GET',
                                                              headers: {
                                                                  Accept: 'application/json',
                                                                  'Cache-Control':
                                                                      'no-cache',
                                                              },
                                                          });
                                                      } catch (e) {
                                                          throw D(
                                                              'queue_poll_network',
                                                              {
                                                                  code: 'queue_poll_network',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  cause: e,
                                                              }
                                                          );
                                                      }
                                                      try {
                                                          i = await r.json();
                                                      } catch (e) {
                                                          throw D(
                                                              'queue_poll_invalid_json',
                                                              {
                                                                  code: 'queue_poll_invalid_json',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  cause: e,
                                                              }
                                                          );
                                                      }
                                                      const s = String(
                                                          i?.status || ''
                                                      ).toLowerCase();
                                                      if (
                                                          'queued' !== s &&
                                                          'processing' !== s
                                                      ) {
                                                          if (
                                                              'completed' === s
                                                          ) {
                                                              const e =
                                                                      i?.completion,
                                                                  r = String(
                                                                      e
                                                                          ?.choices?.[0]
                                                                          ?.message
                                                                          ?.content ||
                                                                          ''
                                                                  ).trim();
                                                              if (!r)
                                                                  throw D(
                                                                      'queue_completed_without_content',
                                                                      {
                                                                          code: 'queue_completed_without_content',
                                                                          noLocalFallback:
                                                                              !0,
                                                                          provider:
                                                                              'openclaw_queue',
                                                                      }
                                                                  );
                                                              return {
                                                                  content: r,
                                                                  mode: 'live',
                                                                  source: 'openclaw_queue',
                                                                  reason: '',
                                                                  configured:
                                                                      !0,
                                                                  recursiveConfigDetected:
                                                                      !1,
                                                                  upstreamStatus: 200,
                                                                  queued: !1,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  jobId: o,
                                                                  pollUrl: n,
                                                                  pollAfterMs:
                                                                      t,
                                                              };
                                                          }
                                                          throw D(
                                                              'queue_failed',
                                                              {
                                                                  code:
                                                                      'string' ==
                                                                      typeof i?.errorCode
                                                                          ? i.errorCode
                                                                          : 'queue_failed',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  message:
                                                                      'string' ==
                                                                      typeof i?.errorMessage
                                                                          ? i.errorMessage
                                                                          : 'No se pudo completar la respuesta de Figo',
                                                              }
                                                          );
                                                      }
                                                  }
                                                  throw D('queue_timeout', {
                                                      code: 'queue_timeout',
                                                      noLocalFallback: !0,
                                                      provider:
                                                          'openclaw_queue',
                                                  });
                                              })(i)));
                                          let s = String(
                                              i.content || ''
                                          ).trim();
                                          if (!s)
                                              throw new Error(
                                                  'Respuesta vacia del backend de chat'
                                              );
                                          if (
                                              (g(
                                                  'Respuesta recibida:',
                                                  s.substring(0, 100) + '...'
                                              ),
                                              ('degraded' !== i.mode &&
                                                  'fallback' !== i.source) ||
                                                  g(
                                                      'Figo en modo degradado:',
                                                      i.reason || 'sin motivo'
                                                  ),
                                              'live' === i.mode &&
                                                  'fallback' !== i.source &&
                                                  (function (e) {
                                                      return N(e);
                                                  })(s))
                                          ) {
                                              g(
                                                  'Respuesta generica detectada, solicitando precision adicional a Figo'
                                              );
                                              const e = `Tu respuesta anterior fue demasiado general.\nResponde con información específica para la web de Aurora Derm.\nIncluye pasos concretos y el siguiente paso recomendado para el paciente.\nPregunta original del paciente: "${o}"`,
                                                  t = [
                                                      ...a,
                                                      {
                                                          role: 'assistant',
                                                          content: s,
                                                      },
                                                      {
                                                          role: 'user',
                                                          content: e,
                                                      },
                                                  ];
                                              try {
                                                  const e = await L(
                                                          t,
                                                          { temperature: 0.3 },
                                                          'refinada'
                                                      ),
                                                      o = String(
                                                          e?.content || ''
                                                      ).trim();
                                                  o &&
                                                      !N(o) &&
                                                      ((s = o),
                                                      g(
                                                          '? Respuesta refinada aplicada'
                                                      ));
                                              } catch (e) {
                                                  g(
                                                      'No se pudo refinar con Figo:',
                                                      e
                                                  );
                                              }
                                              if (N(s))
                                                  return (
                                                      g(
                                                          'Respuesta sigue generica, usando fallback local especializado'
                                                      ),
                                                      m(),
                                                      void O(o, !1)
                                                  );
                                          }
                                          const c = t[t.length - 1];
                                          if (
                                              !c ||
                                              'assistant' !== c.role ||
                                              c.content !== s
                                          ) {
                                              const e = t.concat({
                                                  role: 'assistant',
                                                  content: s,
                                              });
                                              e.length > 14
                                                  ? v(e.slice(-14))
                                                  : v(e);
                                          }
                                          (m(),
                                              f(U(s), !1),
                                              g('?? Mensaje mostrado en chat'));
                                      } catch (e) {
                                          if (
                                              (g(
                                                  'Error con bot del servidor:',
                                                  e
                                              ),
                                              m(),
                                              (function (e) {
                                                  return (
                                                      !(
                                                          !e ||
                                                          'object' != typeof e
                                                      ) &&
                                                      (!0 ===
                                                          e.noLocalFallback ||
                                                          ('string' ==
                                                              typeof e.provider &&
                                                              'openclaw_queue' ===
                                                                  e.provider) ||
                                                          ('string' ==
                                                              typeof e.code &&
                                                              /^(queue_|gateway_|provider_mode_disabled)/.test(
                                                                  e.code
                                                              )))
                                                  );
                                              })(e))
                                          )
                                              return void (function (e = '') {
                                                  f(
                                                      `El asistente Figo no está disponible por unos minutos.${e ? `<br><small>Detalle técnico: ${String(e)}</small>` : ''}<br><br>\nPuedes continuar por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp +593 98 245 3672</a> para atención inmediata.`,
                                                      !1
                                                  );
                                              })(e?.code || e?.message || '');
                                          O(o, !1);
                                      }
                              })(n))
                            : a
                              ? (m(), P())
                              : (g(
                                    '?? Usando respuestas locales (modo offline)'
                                ),
                                setTimeout(() => {
                                    (m(), O(n, !1));
                                }, 600));
                    } catch (e) {
                        (g('Error:', e), m(), a ? P() : O(n, !1));
                    } finally {
                        d = !1;
                    }
                } else b();
            },
            ensureClinicalSessionHydrated: q,
            resetConversation: function () {
                (E(),
                    v([]),
                    localStorage.removeItem('chatHistory'),
                    w([]),
                    (a = null),
                    o &&
                        'function' == typeof o.clearClinicalHistorySession &&
                        o.clearClinicalHistorySession(),
                    h('Conversacion reiniciada', 'info'));
            },
            checkServerEnvironment: function () {
                return (
                    'file:' !== window.location.protocol ||
                    (setTimeout(() => {
                        h(
                            'Para usar funciones online, abre el sitio en un servidor local. Ver docs/LOCAL_SERVER.md',
                            'warning',
                            'Servidor requerido'
                        );
                    }, 2e3),
                    !1)
                );
            },
            forzarModoIA: F,
            mostrarInfoDebug: z,
        }));
})();
