/**
 * Figo chat engine (deferred-loaded).
 * Extracted from script.js to reduce initial parsing work.
 */
(function () {
// build-sync: 20260219-sync1
// ========================================
// INTEGRACIÓN CON BOT DEL SERVIDOR
// ========================================
let deps = null;
let initialized = false;

const DEFAULT_CLINIC_ADDRESS = 'Valparaíso 13-183 y Sodiro, Consultorio Dr. Cecilio Caiza, Quito (Frente al Colegio de las Mercedarias, a 2 cuadras de la Maternidad Isidro Ayora)';
const DEFAULT_CLINIC_MAP_URL = 'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
const DEFAULT_DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
const DEFAULT_DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';

let CLINIC_ADDRESS = DEFAULT_CLINIC_ADDRESS;
let CLINIC_MAP_URL = DEFAULT_CLINIC_MAP_URL;
let DOCTOR_CAROLINA_PHONE = DEFAULT_DOCTOR_CAROLINA_PHONE;
let DOCTOR_CAROLINA_EMAIL = DEFAULT_DOCTOR_CAROLINA_EMAIL;

let conversationContext = [];
let chatHistory = [];
let currentAppointment = null;

const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    maxTokens: 1000,
    temperature: 0.7
};
let CHAT_CONTEXT_MAX_ITEMS = 24;

let isProcessingMessage = false; // Evitar duplicados

function getDepFunction(name) {
    if (deps && typeof deps[name] === 'function') {
        return deps[name];
    }

    if (typeof window !== 'undefined' && typeof window[name] === 'function') {
        return window[name];
    }

    return null;
}

function debugLog() {
    const logger = (deps && typeof deps.debugLog === 'function')
        ? deps.debugLog
        : (typeof window !== 'undefined' && typeof window.debugLog === 'function' ? window.debugLog : null);

    if (!logger) {
        return;
    }

    try {
        logger.apply(null, arguments);
    } catch (_) {
        // noop
    }
}

function callDep(name) {
    const fn = getDepFunction(name);
    if (!fn) {
        return undefined;
    }

    try {
        const args = Array.prototype.slice.call(arguments, 1);
        return fn.apply(null, args);
    } catch (_) {
        return undefined;
    }
}

function syncRuntimeState() {
    const context = callDep('getConversationContext');
    if (Array.isArray(context)) {
        conversationContext = context.slice(-CHAT_CONTEXT_MAX_ITEMS);
    }

    const history = callDep('getChatHistory');
    if (Array.isArray(history)) {
        chatHistory = history.slice();
    } else {
        try {
            const raw = localStorage.getItem('chatHistory');
            const parsed = raw ? JSON.parse(raw) : [];
            chatHistory = Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            chatHistory = [];
        }
    }

    const appointment = callDep('getCurrentAppointment');
    if (appointment && typeof appointment === 'object') {
        currentAppointment = appointment;
    } else if (typeof window !== 'undefined' && window.currentAppointment && typeof window.currentAppointment === 'object') {
        currentAppointment = window.currentAppointment;
    } else {
        currentAppointment = null;
    }
}

function persistConversationContext() {
    if (!Array.isArray(conversationContext)) {
        conversationContext = [];
    }

    if (conversationContext.length > CHAT_CONTEXT_MAX_ITEMS) {
        conversationContext = conversationContext.slice(-CHAT_CONTEXT_MAX_ITEMS);
    }

    const persisted = callDep('setConversationContext', conversationContext);
    if (persisted !== undefined) {
        return;
    }

    if (typeof window !== 'undefined') {
        window.conversationContext = conversationContext.slice();
    }
}

function persistChatHistory() {
    if (!Array.isArray(chatHistory)) {
        chatHistory = [];
    }

    const persisted = callDep('setChatHistory', chatHistory);
    if (persisted !== undefined) {
        return;
    }

    try {
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    } catch (_) {
        // noop
    }
}

function applyRuntimeConfig() {
    if (!deps || typeof deps !== 'object') {
        return;
    }

    const contextMax = Number(deps.chatContextMaxItems);
    if (Number.isFinite(contextMax) && contextMax > 0) {
        CHAT_CONTEXT_MAX_ITEMS = Math.floor(contextMax);
    }

    if (typeof deps.clinicAddress === 'string' && deps.clinicAddress.trim() !== '') {
        CLINIC_ADDRESS = deps.clinicAddress.trim();
    }
    if (typeof deps.clinicMapUrl === 'string' && deps.clinicMapUrl.trim() !== '') {
        CLINIC_MAP_URL = deps.clinicMapUrl.trim();
    }
    if (typeof deps.doctorCarolinaPhone === 'string' && deps.doctorCarolinaPhone.trim() !== '') {
        DOCTOR_CAROLINA_PHONE = deps.doctorCarolinaPhone.trim();
    }
    if (typeof deps.doctorCarolinaEmail === 'string' && deps.doctorCarolinaEmail.trim() !== '') {
        DOCTOR_CAROLINA_EMAIL = deps.doctorCarolinaEmail.trim();
    }
}

function init(inputDeps) {
    deps = inputDeps || {};
    applyRuntimeConfig();
    syncRuntimeState();
    initialized = true;
    return window.FigoChatEngine;
}

function addBotMessage(html, showOfflineLabel) {
    const depCall = callDep('addBotMessage', html, showOfflineLabel);
    if (depCall !== undefined) {
        return depCall;
    }
    if (window.PielChatUiEngine && typeof window.PielChatUiEngine.addBotMessage === 'function') {
        return window.PielChatUiEngine.addBotMessage(html, showOfflineLabel);
    }
    return undefined;
}

function showTypingIndicator() {
    const depCall = callDep('showTypingIndicator');
    if (depCall !== undefined) {
        return depCall;
    }
    if (window.PielChatUiEngine && typeof window.PielChatUiEngine.showTypingIndicator === 'function') {
        return window.PielChatUiEngine.showTypingIndicator();
    }
    return undefined;
}

function removeTypingIndicator() {
    const depCall = callDep('removeTypingIndicator');
    if (depCall !== undefined) {
        return depCall;
    }
    if (window.PielChatUiEngine && typeof window.PielChatUiEngine.removeTypingIndicator === 'function') {
        return window.PielChatUiEngine.removeTypingIndicator();
    }
    return undefined;
}

function startChatBooking() {
    const depCall = callDep('startChatBooking');
    if (depCall !== undefined) {
        return depCall;
    }
    if (window.PielChatBookingEngine && typeof window.PielChatBookingEngine.startChatBooking === 'function') {
        return window.PielChatBookingEngine.startChatBooking();
    }
    return undefined;
}

function processChatBookingStep(message) {
    const depFn = getDepFunction('processChatBookingStep');
    if (depFn) {
        return depFn(message);
    }
    if (window.PielChatBookingEngine && typeof window.PielChatBookingEngine.processChatBookingStep === 'function') {
        return window.PielChatBookingEngine.processChatBookingStep(message);
    }
    return Promise.resolve(false);
}

function isChatBookingActive() {
    const depFn = getDepFunction('isChatBookingActive');
    if (depFn) {
        try {
            return depFn() === true;
        } catch (_) {
            return false;
        }
    }
    if (window.PielChatBookingEngine && typeof window.PielChatBookingEngine.isActive === 'function') {
        try {
            return window.PielChatBookingEngine.isActive() === true;
        } catch (_) {
            return false;
        }
    }
    return false;
}

function showToast(message, type, title) {
    const depCall = callDep('showToast', message, type, title);
    if (depCall !== undefined) {
        return depCall;
    }
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        return window.showToast(message, type, title);
    }
    return undefined;
}

function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }

    if (window.location.protocol === 'file:') {
        return false;
    }

    return true;
}

async function processWithKimi(message) {
    if (!initialized) {
        syncRuntimeState();
    }

    syncRuntimeState();

    if (isProcessingMessage) {
        debugLog('Ya procesando, ignorando duplicado');
        return;
    }

    // Si hay un booking en curso, desviar al flujo conversacional
    if (isChatBookingActive()) {
        const handled = await processChatBookingStep(message);
        if (handled !== false) {
            return;
        }
    }

    // Detectar intención de agendar cita para iniciar booking conversacional
    if (/cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(message)) {
        startChatBooking();
        return;
    }

    isProcessingMessage = true;

    showTypingIndicator();

    if (isOutOfScopeIntent(message)) {
        removeTypingIndicator();
        addBotMessage(`Puedo ayudarte con temas de <strong>Piel en Armonía</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#citas" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp directo</a>`, false);
        isProcessingMessage = false;
        return;
    }
    
    // Prioriza IA real cuando el servidor esta disponible.
    // Si falla la conexion, usa fallback local para no romper la experiencia.
    debugLog('Procesando mensaje:', message);
    
    try {
        if (shouldUseRealAI()) {
            debugLog('🤖 Consultando bot del servidor...');
            await tryRealAI(message);
        } else {
            debugLog('💬 Usando respuestas locales (modo offline)');
            setTimeout(() => {
                removeTypingIndicator();
                processLocalResponse(message, false);
            }, 600);
        }
    } catch (error) {
        debugLog('Error:', error);
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

    const clinicScopePattern = /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicación|dirección|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|teléfono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/;
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

function shouldRefineWithFigo(botResponse) {
    return isGenericAssistantReply(botResponse);
}

const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la clinica dermatologica "Piel en Armonia" en Quito, Ecuador.

INFORMACION DE LA CLINICA:
- Nombre: Piel en Armonia
- Doctores: Dr. Javier Rosero (Dermatologo Clinico) y Dra. Carolina Narvaez (Dermatologa Estetica)
- Direccion: Valparaiso 13-183 y Sodiro, Consultorio Dr. Celio Caiza, Quito (Frente al Colegio de las Mercedarias, a 2 cuadras de la Maternidad Isidro Ayora)
- Telefono/WhatsApp: 098 245 3672
- Contacto Dra. Carolina: 098 786 6885 | caro93narvaez@gmail.com
- Horario: Lunes-Viernes 9:00-18:00, Sabados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS (con IVA 15%):
- Consulta Dermatológica: $46
- Consulta Telefónica: $28.75
- Video Consulta: $34.50
- Tratamiento Láser: desde $172.50
- Rejuvenecimiento: desde $138
- Tratamiento de Acné: desde $80
- Detección de Cáncer de Piel: desde $70

OPCIONES DE CONSULTA ONLINE:
1. Llamada telefonica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- Se profesional, amable y empatico
- Responde en espanol (o en el idioma que use el paciente)
- Si el paciente tiene sintomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefonica
- Si no sabes algo especifico, ofrece transferir al doctor real
- No hagas diagnosticos medicos definitivos, solo orientacion general
- Usa emojis ocasionalmente para ser amigable
- Manten respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la clinica
2. Entender los precios
3. Agendar citas
4. Resolver dudas basicas sobre dermatologia
5. Conectar con un doctor real cuando sea necesario`;

const FIGO_EXPERT_PROMPT = `MODO FIGO PRO:
- Responde con pasos claros y accionables, no con texto general.
- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.
- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.
- Mantente enfocado en Piel en Armonía (servicios, precios, citas, pagos, ubicación y contacto).
- Si preguntan temas fuera de la clínica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Piel en Armonía y redirige a servicios/citas.
- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.`;

function buildAppointmentContextSummary() {
    syncRuntimeState();

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
    syncRuntimeState();

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

    debugLog(`📡 Status (${debugLabel}):`, response.status);

    const responseText = await response.text();
    debugLog(`📄 Respuesta cruda (${debugLabel}):`, responseText.substring(0, 500));

    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        debugLog('Error parseando JSON:', e);
        throw new Error('Respuesta no es JSON valido');
    }

    if (!response.ok || data.ok === false) {
        const reasonHint = data && typeof data.reason === 'string' && data.reason
            ? ` (${data.reason})`
            : '';
        throw new Error(`HTTP ${response.status}${reasonHint}`);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        debugLog('Estructura invalida:', data);
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
        syncRuntimeState();

        // Limpiar duplicados del contexto antes de enviar
        const uniqueContext = [];
        for (const msg of conversationContext) {
            const last = uniqueContext[uniqueContext.length - 1];
            if (!last || last.role !== msg.role || last.content !== msg.content) {
                uniqueContext.push(msg);
            }
        }
        conversationContext = uniqueContext;
        if (conversationContext.length > CHAT_CONTEXT_MAX_ITEMS) {
            conversationContext = conversationContext.slice(-CHAT_CONTEXT_MAX_ITEMS);
        }
        persistConversationContext();
        
        // Preparar mensajes para la API
        const messages = buildFigoMessages();
        
        debugLog('🚀 Enviando a:', KIMI_CONFIG.apiUrl);
        debugLog('📊 Contexto actual:', conversationContext.length, 'mensajes');
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
        if (canRefine && shouldRefineWithFigo(botResponse)) {
            debugLog('Respuesta generica detectada, solicitando precision adicional a Figo');

            const precisionPrompt = `Tu respuesta anterior fue demasiado general.
Responde con información específica para la web de Piel en Armonía.
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
                    debugLog('✅ Respuesta refinada aplicada');
                }
            } catch (refineError) {
                debugLog('No se pudo refinar con Figo:', refineError);
            }

            if (isGenericAssistantReply(botResponse)) {
                debugLog('Respuesta sigue generica, usando fallback local especializado');
                removeTypingIndicator();
                processLocalResponse(message, false);
                return;
            }
        }
        
        // Evitar duplicados: verificar si el último mensaje ya es del asistente con el mismo contenido
        const lastMsg = conversationContext[conversationContext.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== botResponse) {
            conversationContext.push({ role: 'assistant', content: botResponse });
            if (conversationContext.length > CHAT_CONTEXT_MAX_ITEMS) {
                conversationContext = conversationContext.slice(-CHAT_CONTEXT_MAX_ITEMS);
            }
            persistConversationContext();
        }
        
        removeTypingIndicator();
        addBotMessage(formatMarkdown(botResponse), false);
        debugLog('💬 Mensaje mostrado en chat');
        
    } catch (error) {
        debugLog('Error con bot del servidor:', error);
        removeTypingIndicator();
        
        processLocalResponse(message, false);
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
    if (/debug|info sistema|información técnica/.test(normalizedMsg)) {
        mostrarInfoDebug();
        return;
    }
    
    // Intentar detectar intención y dar respuesta local
    let response = null;
    
    // AYUDA / MENU
    if (/ayuda|help|menu|opciones|que puedes hacer/.test(lowerMsg)) {
        response = 'Opciones disponibles:<br><br>';
        response += '<strong>Servicios:</strong> Información sobre consultas<br>';
        response += '<strong>Precios:</strong> Tarifas de servicios<br>';
        response += '<strong>Citas:</strong> Como agendar<br>';
        response += '<strong>Ubicación:</strong> Dirección y horarios<br>';
        response += '<strong>Contacto:</strong> WhatsApp y teléfono';
    }
    // FUERA DE ALCANCE
    else if (isOutOfScopeIntent(normalizedMsg)) {
        response = `Puedo ayudarte solo con temas de <strong>Piel en Armonía</strong>.<br><br>
Puedes consultarme sobre:<br>
- Servicios y tratamientos dermatologicos<br>
- Precios y formas de pago<br>
- Agenda de citas y horarios<br>
- Ubicacion y contacto<br><br>
Si quieres, te llevo directo a <a href="#citas" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp</a>.`;
        addBotMessage(response, isOffline);
        return;
    }
    // SALUDO
    else if (/hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(lowerMsg)) {
        response = '¡Hola! Soy <strong>Figo</strong>, asistente de <strong>Piel en Armonía</strong>.<br><br>';
        response += 'Puedo ayudarte con:<br>';
        response += '• Servicios dermatologicos<br>';
        response += '• Precios de tratamientos<br>';
        response += '• Agendar citas<br>';
        response += '• Ubicacion y horarios<br><br>';
        response += '¿En que puedo ayudarte?';
    }
    // SERVICIOS
    else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(lowerMsg)) {
        response = 'Servicios dermatológicos:<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $46<br>';
        response += '• Telefónica: $28.75<br>';
        response += '• Video: $34.50<br><br>';
        response += '<strong>Tratamientos:</strong><br>';
        response += '• Acné: desde $80<br>';
        response += '• Láser: desde $172.50<br>';
        response += '• Rejuvenecimiento: desde $138<br>';
        response += '• Detección de cáncer de piel: desde $70';
    }
    // PRECIOS
    else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(lowerMsg)) {
        response = 'Precios (incluyen IVA 15%):<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $46<br>';
        response += '• Telefónica: $28.75<br>';
        response += '• Video: $34.50<br><br>';
        response += '<strong>Tratamientos (desde):</strong><br>';
        response += '• Acné: $80<br>';
        response += '• Láser: $172.50<br>';
        response += '• Rejuvenecimiento: $138<br><br>';
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
• <strong>Tarjeta:</strong> ingresa numero, fecha de vencimiento, CVV y nombre.<br>
• <strong>Transferencia:</strong> realiza la transferencia y coloca el numero de referencia.<br>
• <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>

<strong>4) Confirmacion</strong><br>
Tu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">098 245 3672</a>.<br><br>

Si quieres, te guio paso a paso seg\u00fan el m\u00e9todo que prefieras.`;
    }
    // HANDOFF / HUMAN
    else if (/hablar con|humano|persona real|doctor real|agente/.test(lowerMsg)) {
        response = `Entiendo que prefieres hablar con una persona. 👩‍💻<br><br>
Puedes chatear directamente con nuestro equipo humano por WhatsApp aquí:<br><br>
👉 <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Abrir Chat de WhatsApp</a><br><br>
O llámanos al +593 98 245 3672.`;
    }
    // CITAS - iniciar booking conversacional
    else if (/cita|agendar|reservar|turno|hora/.test(lowerMsg)) {
        startChatBooking();
        return;
    }
    // ACNÉ
    else if (/acne|grano|espinilla|barro/.test(lowerMsg)) {
        response = 'El acne es muy comun y tenemos soluciones efectivas.<br><br>';
        response += 'Nuestro enfoque:<br>';
        response += '• Evaluacion personalizada<br>';
        response += '• Tratamientos topicos<br>';
        response += '• Medicacion oral si es necesario<br>';
        response += '• Peelings quimicos<br>';
        response += '• Laser para cicatrices<br><br>';
        response += 'Primera consulta: $40<br><br>';
        response += '¿Te gustaria agendar?';
    }
    // LASER
    else if (/laser/.test(lowerMsg)) {
        response = 'Tecnologia laser de ultima generacion.<br><br>';
        response += 'Tratamientos:<br>';
        response += '• Eliminacion de lesiones vasculares<br>';
        response += '• Tratamiento de manchas<br>';
        response += '• Rejuvenecimiento facial<br>';
        response += '• Cicatrices de acne<br><br>';
        response += 'Precio: Desde $150<br><br>';
        response += 'Se requiere consulta de evaluaci\u00f3n previa.<br>';
        response += '¿Deseas agendar?';
    }
    // UBICACION
    else if (/donde|ubicación|dirección|lugar|mapa|quito/.test(lowerMsg)) {
        response = '<strong>Ubicacion:</strong><br>';
        response += `${CLINIC_ADDRESS}<br>`;
        response += '<br>';
        response += '<strong>Horario:</strong><br>';
        response += 'Lunes - Viernes: 9:00 - 18:00<br>';
        response += 'Sabados: 9:00 - 13:00<br><br>';
        response += '<strong>Estacionamiento:</strong> Privado disponible<br><br>';
        response += `<strong>Mapa:</strong> <a href="${CLINIC_MAP_URL}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`;
        response += '<strong>Contacto:</strong> 098 245 3672';
    }
    // DOCTORES
    else if (/doctor|médico|medico|especialista|rosero|narvaez|dr|dra/.test(lowerMsg)) {
        response = `Contamos con dos excelentes especialistas:

<strong>Dr. Javier Rosero</strong>
Dermatólogo Clínico
15 años de experiencia
Especialista en detección temprana de cáncer de piel

<strong>Dra. Carolina Narvaez</strong>
Dermatóloga Estética
Especialista en rejuvenecimiento facial y láser
Contacto directo: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}

Ambos están disponibles para consulta presencial y online.

¿Con quién te gustaría agendar?`;
    }
    // TELEMEDICINA
    else if (/online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(lowerMsg)) {
        response = `Ofrecemos 3 opciones de consulta remota:

<strong>📞 1. Llamada Telefónica - $25</strong>
Ideal para consultas rápidas y seguimientos

<strong>💬 2. WhatsApp Video - $30</strong>
Videollamada por WhatsApp, muy fácil de usar

<strong>3. Video Web (Jitsi) - $30</strong>
No necesitas instalar nada, funciona en el navegador

Todas incluyen:
✓ Evaluación médica completa
✓ Receta digital
✓ Recomendaciones personalizadas
✓ Seguimiento por WhatsApp

¿Cuál prefieres?`;
    }
    // DESPEDIDA
    else if (/gracias|thank|adios|chao|hasta luego|bye/.test(lowerMsg)) {
        response = `¡De nada! 😊

Si tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:

📱 WhatsApp: 098 245 3672
📞 Teléfono: 098 245 3672

¡Que tengas un excelente día!`;
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
- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp 098 245 3672</a>`;
    }
    
    addBotMessage(response, isOffline);
}

function formatMarkdown(text) {
    // Convertir markdown básico a HTML
    let html = text
        // Negritas
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Cursiva
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Saltos de línea
        .replace(/\n/g, '<br>');
    
    return html;
}

// ========================================
// UTILIDADES DEL CHATBOT
// ========================================
function resetConversation() {
    conversationContext = [];
    persistConversationContext();
    localStorage.removeItem('chatHistory');
    chatHistory = [];
    persistChatHistory();
    showToast('Conversacion reiniciada', 'info');
}

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
    syncRuntimeState();
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

    let msg = '<strong>Información del sistema:</strong><br><br>';
    msg += 'Protocolo: ' + protocolo + '<br>';
    msg += 'Hostname: ' + hostname + '<br>';
    msg += 'Usa IA: ' + (usaIA ? 'SI' : 'NO') + '<br>';
    msg += 'Forzado: ' + (forzado ? 'SI' : 'NO') + '<br><br>';
    msg += 'Endpoint: ' + KIMI_CONFIG.apiUrl;

    addBotMessage(msg);
}

if (typeof window !== 'undefined') {
    window.FigoChatEngine = {
        init,
        processWithKimi,
        resetConversation,
        checkServerEnvironment,
        forzarModoIA,
        mostrarInfoDebug
    };
}
})();
