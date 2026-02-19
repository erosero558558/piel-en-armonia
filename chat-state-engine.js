/**
 * Chat state engine (deferred-loaded).
 * Centralizes chat history and conversation context state.
 */
(function () {
    'use strict';

    const DEFAULT_HISTORY_STORAGE_KEY = 'chatHistory';
    const DEFAULT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
    const DEFAULT_HISTORY_MAX_ITEMS = 50;
    const DEFAULT_CONTEXT_MAX_ITEMS = 24;

    let deps = null;
    let initialized = false;
    let chatHistory = [];
    let conversationContext = [];

    function init(inputDeps) {
        deps = inputDeps || {};
        if (!initialized) {
            chatHistory = readStoredHistory();
            conversationContext = [];
            initialized = true;
        }
        return window.PielChatStateEngine;
    }

    function normalizePositiveNumber(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) {
            return fallback;
        }
        return Math.floor(num);
    }

    function getHistoryStorageKey() {
        const key = deps && typeof deps.historyStorageKey === 'string'
            ? deps.historyStorageKey.trim()
            : '';
        return key || DEFAULT_HISTORY_STORAGE_KEY;
    }

    function getHistoryTtlMs() {
        return normalizePositiveNumber(deps && deps.historyTtlMs, DEFAULT_HISTORY_TTL_MS);
    }

    function getHistoryMaxItems() {
        return normalizePositiveNumber(deps && deps.historyMaxItems, DEFAULT_HISTORY_MAX_ITEMS);
    }

    function getContextMaxItems() {
        return normalizePositiveNumber(deps && deps.contextMaxItems, DEFAULT_CONTEXT_MAX_ITEMS);
    }

    function debugLogSafe() {
        if (deps && typeof deps.debugLog === 'function') {
            deps.debugLog.apply(null, arguments);
        }
    }

    function normalizeHistory(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }

        const cutoff = Date.now() - getHistoryTtlMs();
        const filtered = entries.filter((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }
            const ts = entry.time ? new Date(entry.time).getTime() : Number.NaN;
            return Number.isFinite(ts) && ts > cutoff;
        });

        const maxItems = getHistoryMaxItems();
        if (filtered.length <= maxItems) {
            return filtered;
        }

        return filtered.slice(-maxItems);
    }

    function normalizeContext(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }

        const unique = [];
        entries.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }

            const role = String(entry.role || '').trim();
            const content = String(entry.content || '').trim();
            if (!role || !content) {
                return;
            }

            const last = unique[unique.length - 1];
            if (last && last.role === role && last.content === content) {
                return;
            }

            unique.push({ role, content });
        });

        const maxItems = getContextMaxItems();
        if (unique.length <= maxItems) {
            return unique;
        }

        return unique.slice(-maxItems);
    }

    function readStoredHistory() {
        try {
            const raw = localStorage.getItem(getHistoryStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
            const valid = normalizeHistory(parsed);

            if (Array.isArray(parsed) && valid.length !== parsed.length) {
                try {
                    localStorage.setItem(getHistoryStorageKey(), JSON.stringify(valid));
                } catch (error) {
                    // noop
                }
            }

            return valid;
        } catch (error) {
            debugLogSafe('Chat state read failed:', error);
            return [];
        }
    }

    function getChatHistory() {
        return chatHistory;
    }

    function setChatHistory(nextHistory) {
        chatHistory = normalizeHistory(nextHistory);
    }

    function getConversationContext() {
        return conversationContext;
    }

    function setConversationContext(nextContext) {
        conversationContext = normalizeContext(nextContext);
    }

    function getChatHistoryLength() {
        return chatHistory.length;
    }

    window.PielChatStateEngine = {
        init,
        getChatHistory,
        setChatHistory,
        getConversationContext,
        setConversationContext,
        getChatHistoryLength,
        getHistoryStorageKey,
        getHistoryTtlMs,
        getHistoryMaxItems,
        getContextMaxItems
    };
})();
