/**
 * PIEL EN ARMONIA - Script Principal
 * Compatible con servidor Nginx + PHP
 */

// ===== CONFIGURACIÓN =====
const CONFIG = {
    apiUrl: 'proxy.php',
    apiKey: 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ',
    phoneNumber: '+593 98 245 3672',
    whatsappLink: 'https://wa.me/593982453672'
};

// ===== BASE DE CONOCIMIENTO LOCAL (Fallback) =====
const localKnowledge = {
    'hola': '¡Hola! Bienvenido a Piel en Armonía. ¿En qué puedo ayudarte?',
    'precio': '💰 <strong>Precios:</strong><br>• Consulta presencial: $40<br>• Telefónica: $25<br>• Video: $30<br>• Láser: desde $150<br>• Acné: desde $80',
    'cita': '📅 <strong>Agendar:</strong><br>📱 WhatsApp: +593 98 245 3672<br>📞 Teléfono: +593 98 245 3672',
    'ubicacion': '📍 <strong>Ubicación:</strong><br>Valparaíso 13-183 y Sodiro, Quito<br>🕐 Lun-Vie: 9:00-18:00, Sáb: 9:00-13:00',
    'acne': '💉 <strong>Tratamiento Acné:</strong><br>Desde $80. Evaluación personalizada.',
    'laser': '✨ <strong>Láser:</strong><br>Desde $150. Requiere evaluación previa.',
    'doctor': '👨‍⚕️ <strong>Especialistas:</strong><br>Dr. Javier Rosero<br>Dra. Carolina Narváez'
};

var chatbotOpen = false;
var conversationHistory = [];

// ===== CHATBOT FUNCIONES =====

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
    
    // Primero intentar con Kimi AI, si falla usar local
    callKimiAPI(message);
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
    callKimiAPI(msg);
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

// ===== LLAMADA A KIMI API =====

async function callKimiAPI(message) {
    showTyping();
    
    console.log('🤖 Enviando a Kimi API...');
    
    const systemPrompt = `Eres el Dr. Virtual de Piel en Armonía, clínica dermatológica en Quito, Ecuador.

INFO CLÍNICA:
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

Responde profesional, amable y conciso (máx 3 líneas). Usa HTML para formato (br, strong).`;

    // Preparar mensajes
    var messages = [{role: 'system', content: systemPrompt}];
    conversationHistory.slice(-6).forEach(msg => messages.push(msg));
    messages.push({role: 'user', content: message});

    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: CONFIG.apiKey,
                model: 'moonshot-v1-8k',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        console.log('📡 Status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error:', errorText);
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        console.log('✅ Respuesta:', data);
        
        hideTyping();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content;
            const formattedResponse = aiResponse.replace(/\n/g, '<br>');
            addBotMessage(formattedResponse);
            conversationHistory.push({role: 'assistant', content: aiResponse});
        } else if (data.error) {
            console.error('❌ API Error:', data.error);
            useLocalResponse(message);
        } else {
            useLocalResponse(message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        hideTyping();
        useLocalResponse(message);
    }
}

function useLocalResponse(message) {
    var lower = message.toLowerCase();
    
    for (var key in localKnowledge) {
        if (lower.includes(key)) {
            addBotMessage(localKnowledge[key] + '<br><br><small style="opacity:0.6">(Modo offline)</small>');
            return;
        }
    }
    
    addBotMessage('Para más información:<br>📱 WhatsApp: +593 98 245 3672<br>📞 Tel: +593 98 245 3672');
}

// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', function() {
    console.log('🩺 Piel en Armonía - Loaded');
    console.log('📞 Phone:', CONFIG.phoneNumber);
    console.log('💬 WhatsApp:', CONFIG.whatsappLink);
    console.log('🤖 Chatbot: Ready');
});

// Exportar para uso global
window.toggleChatbot = toggleChatbot;
window.minimizeChatbot = minimizeChatbot;
window.handleChatKeypress = handleChatKeypress;
window.sendChatMessage = sendChatMessage;
window.sendQuickMessage = sendQuickMessage;
