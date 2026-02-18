/**
 * Figo chat engine (deferred-loaded).
 * Extracted from script.js to reduce initial parsing work.
 */
(function () {// ========================================
// INTEGRACIÃ“N CON BOT DEL SERVIDOR
// ========================================
let isProcessingMessage = false; // Evitar duplicados
async function processWithKimi(message) {
    if (isProcessingMessage) {
        debugLog('â³ Ya procesando, ignorando duplicado');
        return;
    }

    // Si hay un booking en curso, desviar al flujo conversacional
    if (chatBooking !== null) {
        await processChatBookingStep(message);
        return;
    }

    // Detectar intenciÃ³n de agendar cita para iniciar booking conversacional
    if (/cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(message)) {
        startChatBooking();
        return;
    }

    isProcessingMessage = true;

    showTypingIndicator();

    if (isOutOfScopeIntent(message)) {
        removeTypingIndicator();
        addBotMessage(`Puedo ayudarte con temas de <strong>Piel en ArmonÃ­a</strong> (servicios, precios, citas, pagos, horarios y ubicaciÃ³n).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#citas" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank">WhatsApp directo</a>`, false);
        isProcessingMessage = false;
        return;
    }
    
    // Prioriza IA real cuando el servidor esta disponible.
    // Si falla la conexion, usa fallback local para no romper la experiencia.
    debugLog('ðŸ“ Procesando mensaje:', message);
    
    try {
        if (shouldUseRealAI()) {
            debugLog('ðŸ¤– Consultando bot del servidor...');
            await tryRealAI(message);
        } else {
            debugLog('ðŸ’¬ Usando respuestas locales (modo offline)');
            setTimeout(() => {
                removeTypingIndicator();
                processLocalResponse(message, false);
            }, 600);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        processLocalResponse(message, false);
    } finally {
        isProcessingMessage = false;
    }
}

function normalizeIntentText(text) {
    if (!text) return '';

    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isPaymentIntent(text) {
    const normalized = normalizeIntentText(text);
    return /(pago|pagar|metodo de pago|tarjeta|transferencia|efectivo|deposito|comprobante|referencia|factura|visa|mastercard)/.test(normalized);
}

function isHighValueClinicIntent(text) {
    const normalized = normalizeIntentText(text);
    return isPaymentIntent(normalized) || /(cita|agendar|reservar|turno|hora|precio|cuanto cuesta|valor|tarifa|costo|servicio|tratamiento)/.test(normalized);
}

function isClinicScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const clinicScopePattern = /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicaciÃ³n|direcciÃ³n|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|telÃ©fono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/;
    return clinicScopePattern.test(normalized);
}

function isOutOfScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return false;

    if (/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(normalized)) {
        return false;
    }

    if (isClinicScopeIntent(normalized)) {
        return false;
    }

    return /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(normalized);
}

function isGenericAssistantReply(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const genericPatterns = [
        /gracias por tu mensaje/,
        /puedo ayudarte con piel en armonia/,
        /soy figo/,
        /asistente virtual/,
        /modo offline/,
        /te sugiero/,
        /para informacion mas detallada/,
        /escribenos por whatsapp/,
        /visita estas secciones/,
        /hay algo mas en lo que pueda orientarte/,
        /estoy teniendo problemas tecnicos/,
        /contactanos directamente por whatsapp/,
        /te atenderemos personalmente/
    ];

    let matches = 0;
    for (const pattern of genericPatterns) {
        if (pattern.test(normalized)) matches += 1;
    }

    return matches >= 2;
}

function shouldRefineWithFigo(userMessage, botResponse) {
    return isGenericAssistantReply(botResponse);
}

const FIGO_EXPERT_PROMPT = `MODO FIGO PRO:
- Responde con pasos claros y accionables, no con texto general.
- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.
- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.
- Mantente enfocado en Piel en ArmonÃ­a (servicios, precios, citas, pagos, ubicaciÃ³n y contacto).
- Si preguntan temas fuera de la clÃ­nica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Piel en ArmonÃ­a y redirige a servicios/citas.
- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.`;

function buildAppointmentContextSummary() {
    if (!currentAppointment) return 'sin cita activa';

    const parts = [];
    if (currentAppointment.service) parts.push(`servicio=${currentAppointment.service}`);
    if (currentAppointment.doctor) parts.push(`doctor=${currentAppointment.doctor}`);
    if (currentAppointment.date) parts.push(`fecha=${currentAppointment.date}`);
    if (currentAppointment.time) parts.push(`hora=${currentAppointment.time}`);
    if (currentAppointment.price) parts.push(`precio=${currentAppointment.price}`);

    return parts.length ? parts.join(', ') : 'sin datos relevantes';
}

function getChatRuntimeContext() {
    const section = window.location.hash || '#inicio';
    const paymentModalOpen = !!document.getElementById('paymentModal')?.classList.contains('active');
    const appointmentSummary = buildAppointmentContextSummary();

    return `CONTEXTO WEB EN TIEMPO REAL:
- Seccion actual: ${section}
- Modal de pago abierto: ${paymentModalOpen ? 'si' : 'no'}
- Cita en progreso: ${appointmentSummary}

FLUJO DE PAGO REAL DEL SITIO:
1) El paciente completa el formulario de cita.
2) Se abre el modal de pago automaticamente.
3) Puede elegir tarjeta, transferencia o efectivo.
4) Al confirmar, la cita se registra y el equipo valida por WhatsApp.`;
}

function buildFigoMessages() {
    return [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: FIGO_EXPERT_PROMPT },
        { role: 'system', content: getChatRuntimeContext() },
        ...conversationContext.slice(-10)
    ];
}

async function requestFigoCompletion(messages, overrides = {}, debugLabel = 'principal') {
    const payload = {
        model: KIMI_CONFIG.model,
        messages: messages,
        max_tokens: KIMI_CONFIG.maxTokens,
        temperature: KIMI_CONFIG.temperature,
        ...overrides
    };

    const controller = new AbortController();
    const timeoutMs = 9000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(KIMI_CONFIG.apiUrl + '?t=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error('TIMEOUT');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    debugLog(`ðŸ“¡ Status (${debugLabel}):`, response.status);

    const responseText = await response.text();
    debugLog(`ðŸ“„ Respuesta cruda (${debugLabel}):`, responseText.substring(0, 500));

    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        console.error('âŒ Error parseando JSON:', e);
        throw new Error('Respuesta no es JSON valido');
    }

    if (!response.ok || data.ok === false) {
        const reasonHint = data && typeof data.reason === 'string' && data.reason
            ? ` (${data.reason})`
            : '';
        throw new Error(`HTTP ${response.status}${reasonHint}`);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('âŒ Estructura invalida:', data);
        throw new Error('Respuesta invalida');
    }

    return {
        content: data.choices[0].message.content || '',
        mode: typeof data.mode === 'string' ? data.mode : '',
        source: typeof data.source === 'string' ? data.source : '',
        reason: typeof data.reason === 'string' ? data.reason : '',
        configured: data.configured !== false,
        recursiveConfigDetected: data.recursiveConfigDetected === true,
        upstreamStatus: Number.isFinite(data.upstreamStatus) ? Number(data.upstreamStatus) : 0
    };
}

async function tryRealAI(message) {
    try {
        // Limpiar duplicados del contexto antes de enviar
        const uniqueContext = [];
        for (const msg of conversationContext) {
            const last = uniqueContext[uniqueContext.length - 1];
            if (!last || last.role !== msg.role || last.content !== msg.content) {
                uniqueContext.push(msg);
            }
        }
        conversationContext = uniqueContext;
        
        // Preparar mensajes para la API
        const messages = buildFigoMessages();
        
        debugLog('ðŸš€ Enviando a:', KIMI_CONFIG.apiUrl);
        debugLog('ðŸ“Š Contexto actual:', conversationContext.length, 'mensajes');
        const primaryReply = await requestFigoCompletion(messages, {}, 'principal');
        let botResponse = String(primaryReply.content || '').trim();
        if (!botResponse) {
            throw new Error('Respuesta vacia del backend de chat');
        }
        debugLog('Respuesta recibida:', botResponse.substring(0, 100) + '...');
        if (primaryReply.mode === 'degraded' || primaryReply.source === 'fallback') {
            debugLog('Figo en modo degradado:', primaryReply.reason || 'sin motivo');
        }

        const canRefine = primaryReply.mode === 'live' && primaryReply.source !== 'fallback';
        if (canRefine && shouldRefineWithFigo(message, botResponse)) {
            debugLog('âš ï¸ Respuesta generica detectada, solicitando precision adicional a Figo');

            const precisionPrompt = `Tu respuesta anterior fue demasiado general.
Responde con informaciÃ³n especÃ­fica para la web de Piel en ArmonÃ­a.
Incluye pasos concretos y el siguiente paso recomendado para el paciente.
Pregunta original del paciente: "${message}"`;

            const refinedMessages = [
                ...messages,
                { role: 'assistant', content: botResponse },
                { role: 'user', content: precisionPrompt }
            ];

            try {
                const refinedResponse = await requestFigoCompletion(
                    refinedMessages,
                    { temperature: 0.3 },
                    'refinada'
                );

                const refinedText = String(refinedResponse?.content || '').trim();
                if (refinedText && !isGenericAssistantReply(refinedText)) {
                    botResponse = refinedText;
                    debugLog('âœ… Respuesta refinada aplicada');
                }
            } catch (refineError) {
                console.warn('âš ï¸ No se pudo refinar con Figo:', refineError);
            }

            if (isGenericAssistantReply(botResponse)) {
                debugLog('âš ï¸ Respuesta sigue generica, usando fallback local especializado');
                removeTypingIndicator();
                processLocalResponse(message, false);
                return;
            }
        }
        
        // Evitar duplicados: verificar si el Ãºltimo mensaje ya es del asistente con el mismo contenido
        const lastMsg = conversationContext[conversationContext.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== botResponse) {
            conversationContext.push({ role: 'assistant', content: botResponse });
        }
        
        removeTypingIndicator();
        addBotMessage(formatMarkdown(botResponse), false);
        debugLog('ðŸ’¬ Mensaje mostrado en chat');
        
    } catch (error) {
        console.error('âŒ Error con bot del servidor:', error);
        removeTypingIndicator();
        
        // Mostrar error especÃ­fico
        if (error.message.includes('HTTP 503')) {
            processLocalResponse(message, false);
        } else if (error.message.includes('TIMEOUT')) {
            processLocalResponse(message, false);
        } else if (error.message.includes('Failed to fetch')) {
            processLocalResponse(message, false);
        } else {
            processLocalResponse(message, false);
        }
    }
}

// ========================================
// SISTEMA DE RESPUESTAS LOCALES (FALLBACK)
// ========================================
function processLocalResponse(message, isOffline = true) {
    const lowerMsg = message.toLowerCase();
    const normalizedMsg = normalizeIntentText(message);
    
    // Comando especial: forzar IA
    if (/forzar ia|activar ia|modo ia|usar ia/.test(normalizedMsg)) {
        forzarModoIA();
        return;
    }
    
    // Comando especial: debug info
    if (/debug|info sistema|informaciÃ³n tÃ©cnica/.test(normalizedMsg)) {
        mostrarInfoDebug();
        return;
    }
    
    // Intentar detectar intenciÃ³n y dar respuesta local
    let response = null;
    
    // AYUDA / MENU
    if (/ayuda|help|menu|opciones|que puedes hacer/.test(lowerMsg)) {
        response = 'Opciones disponibles:<br><br>';
        response += '<strong>Servicios:</strong> InformaciÃ³n sobre consultas<br>';
        response += '<strong>Precios:</strong> Tarifas de servicios<br>';
        response += '<strong>Citas:</strong> Como agendar<br>';
        response += '<strong>UbicaciÃ³n:</strong> DirecciÃ³n y horarios<br>';
        response += '<strong>Contacto:</strong> WhatsApp y telÃ©fono';
    }
    // FUERA DE ALCANCE
    else if (isOutOfScopeIntent(normalizedMsg)) {
        response = `Puedo ayudarte solo con temas de <strong>Piel en ArmonÃ­a</strong>.<br><br>
Puedes consultarme sobre:<br>
- Servicios y tratamientos dermatologicos<br>
- Precios y formas de pago<br>
- Agenda de citas y horarios<br>
- Ubicacion y contacto<br><br>
Si quieres, te llevo directo a <a href="#citas" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank">WhatsApp</a>.`;
        addBotMessage(response, isOffline);
        return;
    }
    // SALUDO
    else if (/hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(lowerMsg)) {
        response = 'Â¡Hola! Soy el asistente de <strong>Piel en ArmonÃ­a</strong>.<br><br>';
        response += 'Puedo ayudarte con:<br>';
        response += 'â€¢ Servicios dermatologicos<br>';
        response += 'â€¢ Precios de tratamientos<br>';
        response += 'â€¢ Agendar citas<br>';
        response += 'â€¢ Ubicacion y horarios<br><br>';
        response += 'Â¿En que puedo ayudarte?';
    }
    // SERVICIOS
    else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(lowerMsg)) {
        response = 'Servicios dermatologicos:<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += 'â€¢ Presencial: $40<br>';
        response += 'â€¢ Telefonica: $25<br>';
        response += 'â€¢ Video: $30<br><br>';
        response += '<strong>Tratamientos:</strong><br>';
        response += 'â€¢ Acne: desde $80<br>';
        response += 'â€¢ Laser: desde $150<br>';
        response += 'â€¢ Rejuvenecimiento: desde $120<br>';
        response += 'â€¢ DetecciÃ³n de cÃ¡ncer de piel: desde $70';
    }
    // PRECIOS
    else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(lowerMsg)) {
        response = 'Precios (incluyen IVA 12%):<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += 'â€¢ Presencial: $40<br>';
        response += 'â€¢ Telefonica: $25<br>';
        response += 'â€¢ Video: $30<br><br>';
        response += '<strong>Tratamientos (desde):</strong><br>';
        response += 'â€¢ Acne: $80<br>';
        response += 'â€¢ Laser: $150<br>';
        response += 'â€¢ Rejuvenecimiento: $120<br><br>';
        response += 'Para presupuesto preciso, agenda una consulta.';
    }
    // PAGOS
    else if (isPaymentIntent(normalizedMsg)) {
        response = `Asi puedes realizar tu pago en la web:<br><br>
<strong>1) Reserva tu cita</strong><br>
Ve a <a href="#citas" data-action="minimize-chat">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>

<strong>2) Abre el modulo de pago</strong><br>
Al enviar el formulario se abre la ventana de pago automaticamente.<br><br>

<strong>3) Elige metodo de pago</strong><br>
â€¢ <strong>Tarjeta:</strong> ingresa numero, fecha de vencimiento, CVV y nombre.<br>
â€¢ <strong>Transferencia:</strong> realiza la transferencia y coloca el numero de referencia.<br>
â€¢ <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>

<strong>4) Confirmacion</strong><br>
Tu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank">+593 98 245 3672</a>.<br><br>

Si quieres, te guio paso a paso seg\u00fan el m\u00e9todo que prefieras.`;
    }
    // CITAS - iniciar booking conversacional
    else if (/cita|agendar|reservar|turno|hora/.test(lowerMsg)) {
        startChatBooking();
        return;
    }
    // ACNÃ‰
    else if (/acne|grano|espinilla|barro/.test(lowerMsg)) {
        response = 'El acne es muy comun y tenemos soluciones efectivas.<br><br>';
        response += 'Nuestro enfoque:<br>';
        response += 'â€¢ Evaluacion personalizada<br>';
        response += 'â€¢ Tratamientos topicos<br>';
        response += 'â€¢ Medicacion oral si es necesario<br>';
        response += 'â€¢ Peelings quimicos<br>';
        response += 'â€¢ Laser para cicatrices<br><br>';
        response += 'Primera consulta: $40<br><br>';
        response += 'Â¿Te gustaria agendar?';
    }
    // LASER
    else if (/laser/.test(lowerMsg)) {
        response = 'Tecnologia laser de ultima generacion.<br><br>';
        response += 'Tratamientos:<br>';
        response += 'â€¢ Eliminacion de lesiones vasculares<br>';
        response += 'â€¢ Tratamiento de manchas<br>';
        response += 'â€¢ Rejuvenecimiento facial<br>';
        response += 'â€¢ Cicatrices de acne<br><br>';
        response += 'Precio: Desde $150<br><br>';
        response += 'Se requiere consulta de evaluaci\u00f3n previa.<br>';
        response += 'Â¿Deseas agendar?';
    }
    // UBICACION
    else if (/donde|ubicaciÃ³n|direcciÃ³n|lugar|mapa|quito/.test(lowerMsg)) {
        response = '<strong>Ubicacion:</strong><br>';
        response += `${CLINIC_ADDRESS}<br>`;
        response += '<br>';
        response += '<strong>Horario:</strong><br>';
        response += 'Lunes - Viernes: 9:00 - 18:00<br>';
        response += 'Sabados: 9:00 - 13:00<br><br>';
        response += '<strong>Estacionamiento:</strong> Privado disponible<br><br>';
        response += `<strong>Mapa:</strong> <a href="${CLINIC_MAP_URL}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`;
        response += '<strong>Contacto:</strong> +593 98 245 3672';
    }
    // DOCTORES
    else if (/doctor|mÃ©dico|medico|especialista|rosero|narvaez|dr|dra/.test(lowerMsg)) {
        response = `Contamos con dos excelentes especialistas:

<strong>ðŸ‘¨â€âš•ï¸ Dr. Javier Rosero</strong>
DermatÃ³logo ClÃ­nico
15 aÃ±os de experiencia
Especialista en detecciÃ³n temprana de cÃ¡ncer de piel

<strong>ðŸ‘©â€âš•ï¸ Dra. Carolina NarvÃ¡ez</strong>
DermatÃ³loga EstÃ©tica
Especialista en rejuvenecimiento facial y lÃ¡ser
Contacto directo: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}

Ambos estÃ¡n disponibles para consulta presencial y online.

Â¿Con quiÃ©n te gustarÃ­a agendar?`;
    }
    // TELEMEDICINA
    else if (/online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(lowerMsg)) {
        response = `Ofrecemos 3 opciones de consulta remota:

<strong>ðŸ“ž 1. Llamada TelefÃ³nica - $25</strong>
Ideal para consultas rÃ¡pidas y seguimientos

<strong>ðŸ’¬ 2. WhatsApp Video - $30</strong>
Videollamada por WhatsApp, muy fÃ¡cil de usar

<strong>ðŸ–¥ï¸ 3. Video Web (Jitsi) - $30</strong>
No necesitas instalar nada, funciona en el navegador

Todas incluyen:
âœ“ EvaluaciÃ³n mÃ©dica completa
âœ“ Receta digital
âœ“ Recomendaciones personalizadas
âœ“ Seguimiento por WhatsApp

Â¿CuÃ¡l prefieres?`;
    }
    // DESPEDIDA
    else if (/gracias|thank|adios|chao|hasta luego|bye/.test(lowerMsg)) {
        response = `Â¡De nada! ðŸ˜Š

Si tienes mÃ¡s dudas, no dudes en escribirme. TambiÃ©n puedes contactarnos directamente:

ðŸ“± WhatsApp: +593 98 245 3672
ðŸ“ž TelÃ©fono: +593 98 245 3672

Â¡Que tengas un excelente dÃ­a!`;
    }
    // RESPUESTA POR DEFECTO
    else {
        response = `Puedo ayudarte mejor si eliges una opcion:<br><br>
1) <strong>Servicios y precios</strong><br>
2) <strong>Reservar cita</strong><br>
3) <strong>Pagos</strong><br><br>
Tambien puedes ir directo:<br>
- <a href="#servicios" data-action="minimize-chat">Servicios</a><br>
- <a href="#citas" data-action="minimize-chat">Reservar Cita</a><br>
- <a href="https://wa.me/593982453672" target="_blank">WhatsApp +593 98 245 3672</a>`;
    }
    
    addBotMessage(response, isOffline);
}

function formatMarkdown(text) {
    // Convertir markdown bÃ¡sico a HTML
    let html = text
        // Negritas
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Cursiva
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Saltos de lÃ­nea
        .replace(/\n/g, '<br>');
    
    return html;
}

// ========================================
// UTILIDADES DEL CHATBOT
// ========================================
function resetConversation() {
    conversationContext = [];
    localStorage.removeItem('chatHistory');
    chatHistory = [];
    showToast('Conversacion reiniciada', 'info');
}

setTimeout(() => {
    const notification = document.getElementById('chatNotification');
    if (notification && !chatbotOpen && chatHistory.length === 0) {
        notification.style.display = 'flex';
    }
}, 30000);

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}

function forzarModoIA() {
    localStorage.setItem('forceAI', 'true');
    showToast('Modo IA activado manualmente', 'success');

    if (chatHistory.length > 0) {
        addBotMessage('<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.');
    }
}

function mostrarInfoDebug() {
    const usaIA = shouldUseRealAI();
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const forzado = localStorage.getItem('forceAI') === 'true';

    let msg = '<strong>InformaciÃ³n del sistema:</strong><br><br>';
    msg += 'Protocolo: ' + protocolo + '<br>';
    msg += 'Hostname: ' + hostname + '<br>';
    msg += 'Usa IA: ' + (usaIA ? 'SI' : 'NO') + '<br>';
    msg += 'Forzado: ' + (forzado ? 'SI' : 'NO') + '<br><br>';
    msg += 'Endpoint: ' + KIMI_CONFIG.apiUrl;

    addBotMessage(msg);
}

if (typeof window !== 'undefined') {
    window.FigoChatEngine = {
        processWithKimi,
        resetConversation,
        checkServerEnvironment,
        forzarModoIA,
        mostrarInfoDebug
    };
}
})();
