/**
 * Chat UI engine (deferred-loaded).
 * Handles chat message rendering, sanitization and typing indicator.
 */
(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielChatUiEngine;
    }

    function getChatHistory() {
        if (deps && typeof deps.getChatHistory === 'function') {
            return deps.getChatHistory();
        }
        return [];
    }

    function setChatHistory(nextHistory) {
        if (deps && typeof deps.setChatHistory === 'function') {
            deps.setChatHistory(nextHistory);
        }
    }

    function pruneChatHistory(entries) {
        if (deps && typeof deps.pruneChatHistory === 'function') {
            return deps.pruneChatHistory(entries);
        }
        return Array.isArray(entries) ? entries : [];
    }

    function persistChatHistory() {
        if (deps && typeof deps.persistChatHistory === 'function') {
            deps.persistChatHistory();
        }
    }

    function appendConversationContext(role, content) {
        if (deps && typeof deps.appendConversationContext === 'function') {
            deps.appendConversationContext(role, content);
        }
    }

    function debugLogSafe() {
        if (deps && typeof deps.debugLog === 'function') {
            deps.debugLog.apply(null, arguments);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function sanitizeBotHtml(html) {
        const allowed = ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'div', 'button', 'input', 'span', 'small'];
        const allowedAttrs = {
            a: ['href', 'target', 'rel'],
            button: ['class', 'data-action'],
            div: ['class'],
            input: ['type', 'id', 'min', 'value', 'class'],
            i: ['class'],
            span: ['class'],
            small: ['class']
        };

        const safeHtml = String(html || '')
            .replace(/onclick="handleChatBookingSelection\('([^']+)'\)"/g, 'data-action="chat-booking" data-value="$1"')
            .replace(/onclick="sendQuickMessage\('([^']+)'\)"/g, 'data-action="quick-message" data-value="$1"')
            .replace(/onclick="handleChatDateSelect\(this\.value\)"/g, 'data-action="chat-date-select"')
            .replace(/onclick="minimizeChatbot\(\)"/g, 'data-action="minimize-chat"')
            .replace(/onclick="startChatBooking\(\)"/g, 'data-action="start-booking"');

        const container = document.createElement('div');
        container.innerHTML = safeHtml;
        container.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
        container.querySelectorAll('*').forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (!allowed.includes(tag)) {
                el.replaceWith(document.createTextNode(el.textContent || ''));
                return;
            }

            const keep = (allowedAttrs[tag] || []).concat(['data-action', 'data-value']);
            Array.from(el.attributes).forEach((attr) => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });

            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) {
                    el.removeAttribute('href');
                }
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }

            Array.from(el.attributes).forEach((attr) => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return container.innerHTML;
    }

    function scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }

    function addUserMessage(text) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user"></i></div>
            <div class="message-content"><p>${escapeHtml(text)}</p></div>
        `;
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();

        const entry = { type: 'user', text, time: new Date().toISOString() };
        const nextHistory = pruneChatHistory(getChatHistory().concat(entry));
        setChatHistory(nextHistory);
        persistChatHistory();
        appendConversationContext('user', text);
    }

    function addBotMessage(html, showOfflineLabel) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const safeHtml = sanitizeBotHtml(html);
        const lastMessage = messagesContainer.querySelector('.chat-message.bot:last-child');
        if (lastMessage) {
            const lastContent = lastMessage.querySelector('.message-content');
            if (lastContent && lastContent.innerHTML === safeHtml) {
                debugLogSafe('Mensaje duplicado detectado, no se muestra');
                return;
            }
        }

        const offlineIndicator = showOfflineLabel
            ? '<div class="chatbot-offline-badge"><i class="fas fa-robot"></i> Asistente Virtual</div>'
            : '';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user-md"></i></div>
            <div class="message-content">${offlineIndicator}${safeHtml}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();

        const entry = { type: 'bot', text: safeHtml, time: new Date().toISOString() };
        const nextHistory = pruneChatHistory(getChatHistory().concat(entry));
        setChatHistory(nextHistory);
        persistChatHistory();
    }

    function showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer || document.getElementById('typingIndicator')) {
            return;
        }

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

    function removeTypingIndicator() {
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }

    window.PielChatUiEngine = {
        init,
        addUserMessage,
        addBotMessage,
        sanitizeBotHtml,
        showTypingIndicator,
        removeTypingIndicator,
        scrollToBottom,
        escapeHtml
    };
})();
