/**
 * PIEL EN ARMONIA - CHATBOT CON KIMI AI
 * Usa proxy CORS gratuito para conectar con Kimi
 */

var chatbotOpen = false;
var conversationHistory = [];

// API Key de Kimi
const KIMI_API_KEY = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';

// URLs de proxies CORS gratuitos (probaremos varios)
const PROXY_URLS = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
];

const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';

// ===== BASE DE CONOCIMIENTO (Fallback) =====
const knowledgeBase = {
    'hola': '¡Hola! Bienvenido a Piel en Armonía. ¿En qué puedo ayudarte?',
    'precio': '💰 Precios:<br>• Consulta presencial: $40<br>• Telefónica: $25<br>• Video: $30<br>• Láser: desde $150<br>• Acné: desde $80',
    'cita': '📅 Agenda por WhatsApp: +593 98 245 3672<br>📞 Teléfono: +593 98 245 3672',
    'ubicacion': '📍 Valparaíso 13-183 y Sodiro, Quito<br>🕐 Lun-Vie: 9:00-18:00, Sáb: 9:00-13:00',
    'acne': '💉 Tratamiento de acné desde $80. Evaluación personalizada.',
    'laser': '✨ Láser desde $150. Requiere evaluación previa.',
    'doctor': '👨‍⚕️ Dr. Javier Rosero (Clínico)<br>👩‍⚕️ Dra. Carolina Narváez (Estética)'
};

// ===== FUNCIONES DEL CHATBOT =====

function toggleChatbot() {
    var container = document.getElementById('chatbotContainer');
    chatbotOpen = !chatbotOpen;
    
    if (chatbotOpen) {
        container.classList.add('active');
        document.getElementById('chatNotification').style.display = 'none';
        document.getElementById('chatInput').focus();
    } else {
        container.classList.remove('active');
    }
}

function minimizeChatbot() {
    document.getElementById('chatbotContainer').classList.remove('active');
    chatbotOpen = false;
}

function handleChatKeypress(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

function sendChatMessage() {
    var input = document.getElementById('chatInput');
    var message = input.value.trim();
    
    if (!message) return;
    
    addUserMessage(message);
    input.value = '';
    
    // LLAMAR A KIMI VIA PROXY
    callKimiWithProxy(message);
}

function sendQuickMessage(type) {
    var messages = {
        'services': '¿Qué servicios ofrecen?',
        'appointment': 'Quiero agendar una cita',
        'prices': '¿Cuáles son los precios?',
        'location': '¿Dónde están ubicados?',
        'human': 'Hablar con un humano'
    };
    
    var msg = messages[type] || type;
    addUserMessage(msg);
    callKimiWithProxy(msg);
}

function addUserMessage(text) {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message user';
    div.innerHTML = '<div class="message-content"><p>' + escapeHtml(text) + '</p></div>';
    container.appendChild(div);
    scrollBottom();
    
    conversationHistory.push({role: 'user', content: text});
}

function addBotMessage(html) {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message bot';
    div.innerHTML = '<div class="message-avatar"><i class="fas fa-user-md"></i></div><div class="message-content"><p>' + html + '</p></div>';
    container.appendChild(div);
    scrollBottom();
}

function showTyping() {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'chat-message bot';
    div.innerHTML = '<div class="message-avatar"><i class="fas fa-user-md"></i></div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    container.appendChild(div);
    scrollBottom();
}

function hideTyping() {
    var el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function scrollBottom() {
    var container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== LLAMADA A KIMI CON PROXY =====

async function callKimiWithProxy(message) {
    showTyping();
    
    console.log('🤖 Intentando conectar con Kimi AI via proxy...');
    
    const systemPrompt = `Eres el Dr. Virtual de Piel en Armonía, clínica dermatológica en Quito, Ecuador.

INFO:
- Doctores: Dr. Javier Rosero (clínico) y Dra. Carolina Narváez (estética)
- Dirección: Valparaíso 13-183 y Sodiro, Quito
- Tel/WhatsApp: +593 98 245 3672
- Horario: Lun-Vie 9:00-18:00, Sáb 9:00-13:00

PRECIOS:
- Consulta presencial: $40
- Telefónica: $25
- Video: $30
- Láser: desde $150
- Acné: desde $80
- Rejuvenecimiento: desde $120

Responde profesional, amable y conciso (máx 3 líneas).`;

    // Preparar mensajes
    var messages = [{role: 'system', content: systemPrompt}];
    var recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => messages.push(msg));
    
    if (!conversationHistory.length || conversationHistory[conversationHistory.length - 1].content !== message) {
        messages.push({role: 'user', content: message});
        conversationHistory.push({role: 'user', content: message});
    }

    const requestBody = {
        model: 'moonshot-v1-8k',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
    };

    // Intentar con cada proxy
    for (let i = 0; i < PROXY_URLS.length; i++) {
        const proxyUrl = PROXY_URLS[i];
        const fullUrl = proxyUrl + encodeURIComponent(KIMI_API_URL);
        
        console.log(`🌐 Intentando proxy ${i + 1}/${PROXY_URLS.length}:`, proxyUrl);
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + KIMI_API_KEY,
                    'Origin': window.location.origin
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📡 Status:', response.status);
            
            if (!response.ok) {
                console.log(`❌ Proxy ${i + 1} falló con status ${response.status}`);
                continue; // Intentar siguiente proxy
            }
            
            const data = await response.json();
            console.log('✅ Respuesta recibida:', data);
            
            hideTyping();
            
            if (data.choices && data.choices[0] && data.choices[0].message) {
                const aiResponse = data.choices[0].message.content;
                const formattedResponse = aiResponse.replace(/\n/g, '<br>');
                addBotMessage(formattedResponse);
                conversationHistory.push({role: 'assistant', content: aiResponse});
                console.log('✅ Respuesta AI mostrada');
                return; // Éxito, salir
            }
            
        } catch (error) {
            console.log(`❌ Proxy ${i + 1} error:`, error.message);
        }
    }
    
    // Si todos los proxies fallan, usar fallback
    console.log('⚠️ Todos los proxies fallaron, usando modo offline');
    hideTyping();
    
    const fallbackResponse = getLocalResponse(message);
    addBotMessage(fallbackResponse + '<br><br><small style="opacity:0.6">(Servidor AI temporalmente no disponible)</small>');
}

function getLocalResponse(message) {
    var lower = message.toLowerCase();
    
    for (var key in knowledgeBase) {
        if (lower.includes(key)) {
            return knowledgeBase[key];
        }
    }
    
    return 'Para más información:<br>📱 WhatsApp: +593 98 245 3672<br>📞 Tel: +593 98 245 3672';
}

console.log('✅ Chatbot Kimi cargado - Usando proxies CORS gratuitos');
