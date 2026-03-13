!(function () {
    'use strict';
    let t = null;
    function e() {
        return t && 'function' == typeof t.getChatHistory
            ? t.getChatHistory()
            : [];
    }
    function n(e) {
        t && 'function' == typeof t.setChatHistory && t.setChatHistory(e);
    }
    function i(e) {
        if (!Array.isArray(e) || 0 === e.length) return [];
        const n =
                Date.now() -
                (function () {
                    const e = Number(t && t.historyTtlMs);
                    return Number.isFinite(e) && e > 0 ? e : 864e5;
                })(),
            i = e.filter((t) => {
                if (!t || 'object' != typeof t) return !1;
                const e = t.time ? new Date(t.time).getTime() : Number.NaN;
                return Number.isFinite(e) && e > n;
            }),
            a = (function () {
                const e = Number(t && t.historyMaxItems);
                return Number.isFinite(e) && e > 0 ? Math.floor(e) : 50;
            })();
        return i.length <= a ? i : i.slice(-a);
    }
    function a() {
        try {
            localStorage.setItem(
                t &&
                    'string' == typeof t.historyStorageKey &&
                    t.historyStorageKey
                    ? t.historyStorageKey
                    : 'chatHistory',
                JSON.stringify(e())
            );
        } catch {}
    }
    function o(e) {
        if (t && 'function' == typeof t.escapeHtml) return t.escapeHtml(e);
        const n = document.createElement('div');
        return ((n.textContent = String(e || '')), n.innerHTML);
    }
    function r(t) {
        const e = [
                'b',
                'strong',
                'i',
                'em',
                'br',
                'p',
                'ul',
                'ol',
                'li',
                'a',
                'div',
                'button',
                'input',
                'span',
                'small',
            ],
            n = {
                a: ['href', 'target', 'rel'],
                button: ['class', 'data-action'],
                div: ['class'],
                input: ['type', 'id', 'min', 'value', 'class'],
                i: ['class'],
                span: ['class'],
                small: ['class'],
            },
            i = String(t || '')
                .replace(
                    /onclick="handleChatBookingSelection\('([^']+)'\)"/g,
                    'data-action="chat-booking" data-value="$1"'
                )
                .replace(
                    /onclick="sendQuickMessage\('([^']+)'\)"/g,
                    'data-action="quick-message" data-value="$1"'
                )
                .replace(
                    /onclick="handleChatDateSelect\(this\.value\)"/g,
                    'data-action="chat-date-select"'
                )
                .replace(
                    /onclick="minimizeChatbot\(\)"/g,
                    'data-action="minimize-chat"'
                )
                .replace(
                    /onclick="startChatBooking\(\)"/g,
                    'data-action="start-booking"'
                ),
            a = document.createElement('div');
        return (
            (a.innerHTML = i),
            a
                .querySelectorAll('script, style, iframe, object, embed')
                .forEach((t) => t.remove()),
            a.querySelectorAll('*').forEach((t) => {
                const i = t.tagName.toLowerCase();
                if (!e.includes(i))
                    return void t.replaceWith(
                        document.createTextNode(t.textContent || '')
                    );
                const a = (n[i] || []).concat(['data-action', 'data-value']);
                if (
                    (Array.from(t.attributes).forEach((e) => {
                        a.includes(e.name) || t.removeAttribute(e.name);
                    }),
                    'a' === i)
                ) {
                    const e = t.getAttribute('href') || '';
                    (/^https?:\/\/|^#/.test(e) || t.removeAttribute('href'),
                        e.startsWith('http') &&
                            (t.setAttribute('target', '_blank'),
                            t.setAttribute('rel', 'noopener noreferrer')));
                }
                Array.from(t.attributes).forEach((e) => {
                    e.name.startsWith('on') && t.removeAttribute(e.name);
                });
            }),
            a.innerHTML
        );
    }
    function s() {
        const t = document.getElementById('chatMessages');
        t && (t.scrollTop = t.scrollHeight);
    }
    function c() {
        return document.getElementById('chatMessages');
    }
    function l(t) {
        const e = document.createElement('div');
        return (
            (e.className = 'chat-message user'),
            (e.innerHTML = `\n        <div class="message-avatar"><i class="fas fa-user"></i></div>\n        <div class="message-content"><p>${o(t)}</p></div>\n    `),
            e
        );
    }
    function u(t, e) {
        const n = e
                ? '<div class="chatbot-offline-badge"><i class="fas fa-robot"></i> Asistente Virtual</div>'
                : '',
            i = document.createElement('div');
        return (
            (i.className = 'chat-message bot'),
            (i.innerHTML = `\n        <div class="message-avatar"><i class="fas fa-user-md"></i></div>\n        <div class="message-content">${n}${r(t)}</div>\n    `),
            i
        );
    }
    ((window.Piel = window.Piel || {}),
        (window.Piel.ChatUiEngine = {
            init: function (e) {
                return ((t = e || {}), window.Piel && window.Piel.ChatUiEngine);
            },
            addUserMessage: function (o) {
                const r = c();
                if (!r) return;
                (r.appendChild(l(o)), s());
                const u = {
                    type: 'user',
                    text: o,
                    time: new Date().toISOString(),
                };
                (n(i(e().concat(u))),
                    a(),
                    (function (e, n) {
                        const i = String(e).trim(),
                            a = String(n || '').trim();
                        if (!i || !a) return;
                        const o = (function () {
                                if (
                                    t &&
                                    'function' ==
                                        typeof t.getConversationContext
                                ) {
                                    const e = t.getConversationContext();
                                    return Array.isArray(e) ? e : [];
                                }
                                return [];
                            })().slice(),
                            r = o[o.length - 1];
                        if (r && r.role === i && r.content === a) return;
                        o.push({ role: i, content: a });
                        const s = (function () {
                            const e = Number(t && t.contextMaxItems);
                            return Number.isFinite(e) && e > 0
                                ? Math.floor(e)
                                : 24;
                        })();
                        var c;
                        ((c = o.length > s ? o.slice(-s) : o),
                            t &&
                                'function' == typeof t.setConversationContext &&
                                t.setConversationContext(c));
                    })('user', o));
            },
            addBotMessage: function (o, l) {
                const d = c();
                if (!d) return;
                const m = r(o),
                    f = d.querySelector('.chat-message.bot:last-child');
                if (f) {
                    const e = f.querySelector('.message-content');
                    if (e && e.innerHTML === m)
                        return void (function () {
                            t &&
                                'function' == typeof t.debugLog &&
                                t.debugLog.apply(null, arguments);
                        })('Mensaje duplicado detectado, no se muestra');
                }
                (d.appendChild(u(m, l)), s());
                const g = {
                    type: 'bot',
                    text: m,
                    time: new Date().toISOString(),
                };
                (n(i(e().concat(g))), a());
            },
            renderChatHistory: function (t) {
                const e = c();
                e &&
                    ((e.innerHTML = ''),
                    (Array.isArray(t) ? t : []).forEach((t) => {
                        if (!t || 'object' != typeof t) return;
                        const n = String(t.type || '')
                            .trim()
                            .toLowerCase();
                        'user' !== n
                            ? ('bot' === n ||
                                  'assistant' === n ||
                                  'system' === n ||
                                  '' === n) &&
                              e.appendChild(
                                  u(
                                      String(t.text || ''),
                                      !0 === t.showOfflineLabel
                                  )
                              )
                            : e.appendChild(l(String(t.text || '')));
                    }),
                    s());
            },
            sanitizeBotHtml: r,
            showTypingIndicator: function () {
                const t = c();
                if (!t || document.getElementById('typingIndicator')) return;
                const e = document.createElement('div');
                ((e.className = 'chat-message bot typing'),
                    (e.id = 'typingIndicator'),
                    (e.innerHTML =
                        '\n        <div class="message-avatar"><i class="fas fa-user-md"></i></div>\n        <div class="typing-indicator">\n            <span></span><span></span><span></span>\n        </div>\n    '),
                    t.appendChild(e),
                    s());
            },
            removeTypingIndicator: function () {
                const t = document.getElementById('typingIndicator');
                t && t.remove();
            },
            scrollToBottom: s,
            escapeHtml: o,
        }));
})();
