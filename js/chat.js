import { KIMI_CONFIG, SYSTEM_PROMPT, CLINIC_ADDRESS, DOCTOR_CAROLINA_PHONE, DOCTOR_CAROLINA_EMAIL } from './config.js';
import {
    getCurrentLang, getChatbotOpen, setChatbotOpen, getChatStartedTracked, setChatStartedTracked,
    getConversationContext, setConversationContext, getChatHistory, setChatHistory, setCurrentAppointment
} from './state.js';
import { debugLog, escapeHtml, showToast } from './utils.js';
import { trackEvent } from './analytics.js';
import { loadDeferredModule, runDeferredModule, createWarmupRunner, bindWarmupTarget, scheduleDeferredTask, withDeferredModule } from './loader.js';
import {
    loadAvailabilityData, getBookedSlots, startCheckoutSession, completeCheckoutSession,
    createAppointmentRecord, openPaymentModal
} from './booking.js';

const CHAT_BOOKING_ENGINE_URL = '/chat-booking-engine.js?v=figo-chat-booking-20260220-sync2';

// CHATBOT FUNCTIONS
export function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    const notification = document.getElementById('chatNotification');
    const isOpen = !getChatbotOpen();
    setChatbotOpen(isOpen);

    if (isOpen) {
        container.classList.add('active');
        if (notification) notification.style.display = 'none';
        scrollToBottom();
        if (!getChatStartedTracked()) {
            setChatStartedTracked(true);
            trackEvent('chat_started', {
                source: 'widget'
            });
        }

        const history = getChatHistory();
        // Si es la primera vez, mostrar mensaje inicial
        if (history.length === 0) {
            // Verificar si estamos usando IA real
            const usandoIA = shouldUseRealAI();

            debugLog('?? Estado del chatbot:', usandoIA ? 'IA REAL' : 'Respuestas locales');

            var welcomeMsg;

            if (usandoIA) {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonía</strong>.<br><br>';
                welcomeMsg += '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
                welcomeMsg += 'Puedo ayudarte con información detallada sobre:<br>';
                welcomeMsg += '• Nuestros servicios dermatologicos<br>';
                welcomeMsg += '• Precios de consultas y tratamientos<br>';
                welcomeMsg += '• Agendar citas presenciales o online<br>';
                welcomeMsg += '• Ubicacion y horarios de atencion<br>';
                welcomeMsg += '• Resolver tus dudas sobre cuidado de la piel<br><br>';
                welcomeMsg += '¿En que puedo ayudarte hoy?';
            } else {
                welcomeMsg = '¡Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonía</strong>.<br><br>';
                welcomeMsg += 'Puedo ayudarte con información sobre:<br>';
                welcomeMsg += '• Nuestros servicios dermatologicos<br>';
                welcomeMsg += '• Precios de consultas y tratamientos<br>';
                welcomeMsg += '• Agendar citas presenciales o online<br>';
                welcomeMsg += '• Ubicacion y horarios de atencion<br><br>';
                welcomeMsg += '¿En que puedo ayudarte hoy?';
            }

            addBotMessage(welcomeMsg);

            // Sugerir opciones rapidas
            setTimeout(function() {
                var quickOptions = '<div class="chat-suggestions">';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
                quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
                quickOptions += '<i class="fas fa-calendar-check"></i> Agendar cita';
                quickOptions += '</button>';
                quickOptions += '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
                quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
                quickOptions += '</button>';
                quickOptions += '</div>';
                addBotMessage(quickOptions);
            }, 500);
        }
    } else {
        container.classList.remove('active');
    }
}

export function minimizeChatbot() {
    document.getElementById('chatbotContainer').classList.remove('active');
    setChatbotOpen(false);
}

export function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

export async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    addUserMessage(message);
    input.value = '';

    await processWithKimi(message);
}

export function sendQuickMessage(type) {
    if (type === 'appointment') {
        addUserMessage('Quiero agendar una cita');
        startChatBooking();
        return;
    }

    const messages = {
        services: '¿Qué servicios ofrecen?',
        prices: '¿Cuáles son los precios?',
        telemedicine: '¿Cómo funciona la consulta online?',
        human: 'Quiero hablar con un doctor real',
        acne: 'Tengo problemas de acné',
        laser: 'Información sobre tratamientos láser',
        location: '¿Dónde están ubicados?'
    };

    const message = messages[type] || type;
    addUserMessage(message);

    processWithKimi(message);
}

export function addUserMessage(text) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user"></i></div>
        <div class="message-content"><p>${escapeHtml(text)}</p></div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    const history = getChatHistory();
    history.push({ type: 'user', text, time: new Date().toISOString() });
    setChatHistory(history);

    // Agregar al contexto de conversación (evitar duplicados)
    const context = getConversationContext();
    const lastMsg = context[context.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text) {
        context.push({ role: 'user', content: text });
    }
    setConversationContext(context);
}

export function addBotMessage(html, showOfflineLabel = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const safeHtml = sanitizeBotHtml(html);

    // Verificar si el ultimo mensaje es identico (evitar duplicados en UI)
    const lastMessage = messagesContainer.querySelector('.chat-message.bot:last-child');
    if (lastMessage) {
        const lastContent = lastMessage.querySelector('.message-content');
        if (lastContent && lastContent.innerHTML === safeHtml) {
            debugLog('⚠️ Mensaje duplicado detectado, no se muestra');
            return;
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';

    // Solo mostrar indicador offline si se solicita explícitamente (para debug)
    const offlineIndicator = showOfflineLabel ?
        `<div style="font-size: 0.7rem; color: #86868b; margin-bottom: 4px; opacity: 0.7;">
            <i class="fas fa-robot"></i> Asistente Virtual
        </div>` : '';

    messageDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="message-content">${offlineIndicator}${safeHtml}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // Guardar en historial
    const history = getChatHistory();
    history.push({ type: 'bot', text: safeHtml, time: new Date().toISOString() });
    setChatHistory(history);
}

export function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot typing';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-user-md"></i></div>
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

export function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function sanitizeBotHtml(html) {
    const allowed = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'button', 'input', 'span', 'small'];
    const allowedAttrs = {
        'a': ['href', 'target', 'rel'],
        'button': ['class', 'data-action'],
        'div': ['class', 'style'],
        'input': ['type', 'id', 'min', 'style', 'value'],
        'i': ['class'],
        'span': ['class', 'style'],
        'small': ['class']
    };

    // Convertir onclick inline a data-action antes de sanitizar
    const safeHtml = html
        .replace(/onclick="handleChatBookingSelection\('([^']+)'\)"/g, 'data-action="chat-booking" data-value="$1"')
        .replace(/onclick="sendQuickMessage\('([^']+)'\)"/g, 'data-action="quick-message" data-value="$1"')
        .replace(/onclick="handleChatDateSelect\(this\.value\)"/g, 'data-action="chat-date-select"')
        .replace(/onclick="minimizeChatbot\(\)"/g, 'data-action="minimize-chat"')
        .replace(/onclick="startChatBooking\(\)"/g, 'data-action="start-booking"');

    const div = document.createElement('div');
    div.innerHTML = safeHtml;
    div.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (!allowed.includes(tag)) {
            el.replaceWith(document.createTextNode(el.textContent));
        } else {
            const keep = [...(allowedAttrs[tag] || []), 'data-action', 'data-value'];
            Array.from(el.attributes).forEach(attr => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) el.removeAttribute('href');
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }
            // Eliminar cualquier atributo on* que haya pasado
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        }
    });
    return div.innerHTML;
}

function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }

    var protocol = window.location.protocol;

    if (protocol === 'file:') {
        return false;
    }

    return true;
}

// CHAT BOOKING ENGINE
function getChatBookingEngineDeps() {
    return {
        addBotMessage,
        addUserMessage,
        showTypingIndicator,
        removeTypingIndicator,
        loadAvailabilityData,
        getBookedSlots,
        startCheckoutSession,
        completeCheckoutSession,
        createAppointmentRecord,
        showToast,
        trackEvent,
        escapeHtml,
        minimizeChatbot,
        openPaymentModal,
        getCurrentLang: getCurrentLang,
        setCurrentAppointment: setCurrentAppointment
    };
}

export function loadChatBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-booking-engine',
        src: CHAT_BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-chat-booking-engine',
        resolveModule: () => window.PielChatBookingEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatBookingEngineDeps()),
        missingApiError: 'chat-booking-engine loaded without API',
        loadError: 'No se pudo cargar chat-booking-engine.js',
        logLabel: 'Chat booking engine'
    });
}

export function initChatBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatBookingEngine());

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#quickOptions [data-action="quick-message"][data-value="appointment"]', 'mouseenter', warmup);
    bindWarmupTarget('#quickOptions [data-action="quick-message"][data-value="appointment"]', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);

    scheduleDeferredTask(warmup, {
        idleTimeout: 2600,
        fallbackDelay: 1700
    });
}

export function startChatBooking() {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.startChatBooking(),
        () => {
            addBotMessage('No pude iniciar la reserva por chat. Puedes continuar desde <a href="#citas" data-action="minimize-chat">el formulario</a>.');
        }
    );
}

export function cancelChatBooking() {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.cancelChatBooking(),
        () => {
            addBotMessage('No se pudo cancelar la reserva en este momento.');
        }
    );
}

export function handleChatBookingSelection(value) {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatBookingSelection(value),
        () => {
            addBotMessage('No pude procesar esa opcion. Intenta nuevamente.');
        }
    );
}

export function handleChatDateSelect(value) {
    if (!value) {
        return;
    }

    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatDateSelect(value),
        () => {
            addBotMessage('No pude procesar esa fecha. Intenta nuevamente.');
        }
    );
}

export function processChatBookingStep(userInput) {
    return withDeferredModule(loadChatBookingEngine, (engine) => engine.processChatBookingStep(userInput));
}

export function finalizeChatBooking() {
    return withDeferredModule(loadChatBookingEngine, (engine) => engine.finalizeChatBooking());
}

export function isChatBookingActive() {
    if (window.PielChatBookingEngine && typeof window.PielChatBookingEngine.isActive === 'function') {
        return window.PielChatBookingEngine.isActive();
    }
    return false;
}

// FIGO CHAT ENGINE
export function loadFigoChatEngine() {
    return loadDeferredModule({
        cacheKey: 'figo-chat-engine',
        src: '/chat-engine.js?v=figo-chat-20260218-phase2',
        scriptDataAttribute: 'data-figo-chat-engine',
        resolveModule: () => window.FigoChatEngine,
        isModuleReady: (module) => !!module,
        missingApiError: 'Figo chat engine loaded without API',
        loadError: 'No se pudo cargar chat-engine.js'
    });
}

export function initChatEngineWarmup() {
    const warmup = createWarmupRunner(() => loadFigoChatEngine(), { markWarmOnSuccess: true });

    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup);

    scheduleDeferredTask(warmup, {
        idleTimeout: 7000,
        fallbackDelay: 7000
    });
}

export async function processWithKimi(message) {
    return runDeferredModule(
        loadFigoChatEngine,
        (engine) => engine.processWithKimi(message),
        (error) => {
            console.error('Error cargando motor de chat:', error);
            removeTypingIndicator();
            addBotMessage('No se pudo iniciar el asistente en este momento. Intenta de nuevo o escribenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.', false);
        }
    );
}

export function resetConversation() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.resetConversation(), () => {
        showToast('No se pudo reiniciar la conversacion.', 'warning');
    });
}

export function forzarModoIA() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.forzarModoIA(), () => {
        showToast('No se pudo activar modo IA.', 'warning');
    });
}

export function mostrarInfoDebug() {
    runDeferredModule(loadFigoChatEngine, (engine) => engine.mostrarInfoDebug(), () => {
        showToast('No se pudo mostrar informacion de debug.', 'warning');
    });
}

export function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast('Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md', 'warning', 'Servidor requerido');
        }, 2000);
        return false;
    }
    return true;
}
