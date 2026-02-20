import { DEFAULT_TIME_SLOTS } from './config.js';

const internalState = {
    currentLang: localStorage.getItem('language') || 'es',
    currentThemeMode: localStorage.getItem('themeMode') || 'system',
    currentAppointment: null,
    checkoutSession: {
        active: false,
        completed: false,
        startedAt: 0,
        service: '',
        doctor: ''
    },
    bookingViewTracked: false,
    chatStartedTracked: false,
    availabilityPrefetched: false,
    reviewsPrefetched: false,
    apiSlowNoticeLastAt: 0,
    availabilityCache: {},
    availabilityCacheLoadedAt: 0,
    availabilityCachePromise: null,
    bookedSlotsCache: new Map(),
    reviewsCache: [],
    paymentConfig: { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' },
    paymentConfigLoaded: false,
    paymentConfigLoadedAt: 0,
    stripeSdkPromise: null,
    chatbotOpen: false,
    conversationContext: []
};

function getChatHistory() {
    try {
        const raw = localStorage.getItem('chatHistory');
        const saved = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const valid = saved.filter(m => m.time && new Date(m.time).getTime() > cutoff);
        if (valid.length !== saved.length) {
            try { localStorage.setItem('chatHistory', JSON.stringify(valid)); } catch(e) {}
        }
        return valid;
    } catch(e) { return []; }
}

function setChatHistory(history) {
    try { localStorage.setItem('chatHistory', JSON.stringify(history)); } catch(e) {}
}

const handler = {
    get(target, prop, receiver) {
        if (prop === 'chatHistory') {
            return getChatHistory();
        }
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (prop === 'chatHistory') {
            setChatHistory(value);
            return true;
        }
        if (prop === 'bookedSlotsCache') {
            return false;
        }
        return Reflect.set(target, prop, value, receiver);
    }
};

export const state = new Proxy(internalState, handler);
