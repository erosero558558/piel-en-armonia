import {
    s as e,
    r as t,
    w as n,
    a as o,
    g as i,
    c as a,
    b as s,
    d as c,
    l as r,
    e as d,
    f as l,
    h as u,
    D as g,
    i as h,
    C as m,
    j as p,
    k as f,
    m as C,
    n as y,
    o as w,
    p as b,
    q as I,
    t as k,
    u as v,
    v as S,
    x as E,
    y as P,
    z as M,
    A as H,
    B as A,
    E as B,
    F as T,
    G as j,
    H as x,
    I as R,
} from '../../script.js';
const W = u(
        '/js/engines/chat-ui-engine.js?v=figo-chat-ui-20260219-phase1-sync1'
    ),
    L = u(
        '/js/engines/chat-widget-engine.js?v=figo-chat-widget-20260219-phase2-notification2-funnel1-sync1'
    ),
    U = u(
        '/js/engines/chat-booking-engine.js?v=figo-chat-booking-20260219-mbfix1'
    ),
    D = u('/js/engines/chat-engine.js?v=figo-chat-20260223-openclaw-queue1');
function O() {
    const e = (function () {
        try {
            return new URLSearchParams(window.location.search || '');
        } catch {
            return new URLSearchParams();
        }
    })();
    return {
        mode: String(e.get('mode') || '').trim(),
        sessionId: String(e.get('sessionId') || '').trim(),
        caseId: String(e.get('caseId') || '').trim(),
        appointmentId: String(e.get('appointmentId') || '').trim(),
        surface: String(e.get('surface') || '').trim(),
    };
}
function K() {
    return O();
}
function N(e) {
    const t = O(),
        n = (function (e) {
            const t = e && 'object' == typeof e ? e : Object.create(null),
                n =
                    t.metadata && 'object' == typeof t.metadata
                        ? t.metadata.patientIntake
                        : null;
            return {
                sessionId: String(t.sessionId || n?.sessionId || '').trim(),
                caseId: String(t.caseId || n?.caseId || '').trim(),
            };
        })(e);
    return !(
        (!n.sessionId && !n.caseId) ||
        (t.sessionId && t.sessionId !== n.sessionId) ||
        (t.caseId && t.caseId !== n.caseId)
    );
}
function q() {
    if ('clinical_intake' === O().mode) return 'clinical_intake';
    const e = i();
    return N(e) ||
        'clinical_intake' ===
            String(e?.metadata?.patientIntake?.mode || '').trim()
        ? 'clinical_intake'
        : 'general';
}
function _(e) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        'function' == typeof window.Piel.ChatUiEngine.escapeHtml
    )
        return window.Piel.ChatUiEngine.escapeHtml(e);
    const t = document.createElement('div');
    return ((t.textContent = e), t.innerHTML);
}
function z() {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        'function' == typeof window.Piel.ChatUiEngine.scrollToBottom
    )
        return void window.Piel.ChatUiEngine.scrollToBottom();
    const e = document.getElementById('chatMessages');
    e && (e.scrollTop = e.scrollHeight);
}
function Q(e) {
    return n(X, (t) => t.addUserMessage(e));
}
function F(e, n = !1) {
    return t(X, (t) => t.addBotMessage(e, n));
}
function V(n = e.chatHistory) {
    return t(
        X,
        (e) => {
            e &&
                'function' == typeof e.renderChatHistory &&
                e.renderChatHistory(Array.isArray(n) ? n : []);
        },
        () => {}
    );
}
function G() {
    t(X, (e) => e.showTypingIndicator());
}
function J() {
    t(X, (e) => e.removeTypingIndicator());
}
function X() {
    return r({
        cacheKey: 'chat-ui-engine',
        src: W,
        scriptDataAttribute: 'data-chat-ui-engine',
        resolveModule: () => window.Piel && window.Piel.ChatUiEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (t) =>
            t.init({
                getChatHistory: () => e.chatHistory,
                setChatHistory: (t) => {
                    e.chatHistory = t;
                },
                getConversationContext: () => e.conversationContext,
                setConversationContext: (t) => {
                    e.conversationContext = t;
                },
                historyStorageKey: 'chatHistory',
                historyTtlMs: 864e5,
                historyMaxItems: 50,
                contextMaxItems: 24,
                debugLog: v,
            }),
        missingApiError: 'chat-ui-engine loaded without API',
        loadError: 'No se pudo cargar chat-ui-engine.js',
        logLabel: 'Chat UI engine',
    });
}
function Y() {
    const e = a(() => X(), { markWarmOnSuccess: !0 });
    (s('#chatbotWidget .chatbot-toggle', 'mouseenter', e),
        s('#chatbotWidget .chatbot-toggle', 'touchstart', e),
        s('#chatInput', 'focus', e, !1),
        c(e, { idleTimeout: 2600, fallbackDelay: 1300 }));
}
function Z() {
    return r({
        cacheKey: 'chat-widget-engine',
        src: L,
        scriptDataAttribute: 'data-chat-widget-engine',
        resolveModule: () => window.Piel && window.Piel.ChatWidgetEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (n) =>
            n.init({
                getChatbotOpen: () => e.chatbotOpen,
                setChatbotOpen: (t) => {
                    e.chatbotOpen = t;
                },
                getChatHistoryLength: () => e.chatHistory.length,
                getChatMode: q,
                getClinicalRouteContext: K,
                getClinicalHistorySession: () => e.clinicalHistorySession,
                doesClinicalSessionMatchRoute: N,
                warmChatUi: () => t(X, () => {}),
                renderChatHistory: V,
                ensureClinicalSessionHydrated: Ce,
                scrollToBottom: z,
                trackEvent: S,
                debugLog: v,
                addBotMessage: F,
                addUserMessage: Q,
                processWithKimi: fe,
                startChatBooking: re,
                isChatBookingActive: he,
            }),
        missingApiError: 'chat-widget-engine loaded without API',
        loadError: 'No se pudo cargar chat-widget-engine.js',
        logLabel: 'Chat widget engine',
    });
}
function $() {
    const e = a(() => Z(), { markWarmOnSuccess: !0 });
    (s('#chatbotWidget .chatbot-toggle', 'mouseenter', e),
        s('#chatbotWidget .chatbot-toggle', 'touchstart', e),
        s('#chatInput', 'focus', e, !1),
        c(e, { idleTimeout: 2600, fallbackDelay: 1300 }));
}
function ee() {
    t(
        Z,
        (e) => e.toggleChatbot(),
        () => {
            const e = document.getElementById('chatbotContainer');
            if (!e) return;
            const t = !l();
            (d(t), e.classList.toggle('active', t));
        }
    );
}
function te() {
    t(
        Z,
        (e) => e.minimizeChatbot(),
        () => {
            const e = document.getElementById('chatbotContainer');
            (e && e.classList.remove('active'), d(!1));
        }
    );
}
function ne(e) {
    t(
        Z,
        (t) => t.handleChatKeypress(e),
        () => {
            e && 'Enter' === e.key && oe();
        }
    );
}
async function oe() {
    return t(
        Z,
        (e) => e.sendChatMessage(),
        async () => {
            const e = document.getElementById('chatInput');
            if (!e) return;
            const t = String(e.value || '').trim();
            t &&
                (await Promise.resolve(Q(t)).catch(() => {}),
                (e.value = ''),
                await fe(t));
        }
    );
}
function ie(e) {
    t(
        Z,
        (t) => t.sendQuickMessage(e),
        () => {
            if ('appointment' === e)
                return (
                    Promise.resolve(Q('Quiero agendar una cita')).catch(
                        () => {}
                    ),
                    void re()
                );
            const t =
                {
                    services: 'Que servicios ofrecen?',
                    prices: 'Cuales son los precios?',
                    telemedicine: 'Como funciona la consulta online?',
                    human: 'Quiero hablar con un doctor real',
                    acne: 'Tengo problemas de acne',
                    laser: 'Informacion sobre tratamientos laser',
                    location: 'Donde estan ubicados?',
                }[e] || e;
            (Promise.resolve(Q(t)).catch(() => {}), fe(t));
        }
    );
}
function ae() {
    t(Z, (e) => e.scheduleInitialNotification(3e4));
}
function se() {
    return r({
        cacheKey: 'chat-booking-engine',
        src: U,
        scriptDataAttribute: 'data-chat-booking-engine',
        resolveModule: () => window.Piel && window.Piel.ChatBookingEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                addBotMessage: F,
                addUserMessage: Q,
                showTypingIndicator: G,
                removeTypingIndicator: J,
                loadAvailabilityData: R,
                getBookedSlots: x,
                startCheckoutSession: j,
                setCheckoutStep: T,
                completeCheckoutSession: B,
                createAppointmentRecord: A,
                getCaptchaToken: H,
                showToast: o,
                trackEvent: S,
                escapeHtml: _,
                minimizeChatbot: te,
                openPaymentModal: M,
                getCurrentLang: P,
                setCurrentAppointment: E,
            }),
        missingApiError: 'chat-booking-engine loaded without API',
        loadError: 'No se pudo cargar chat-booking-engine.js',
        logLabel: 'Chat booking engine',
    });
}
function ce() {
    const e = a(() => se());
    (s('#chatbotWidget .chatbot-toggle', 'mouseenter', e),
        s('#chatbotWidget .chatbot-toggle', 'touchstart', e),
        s(
            '#quickOptions [data-action="quick-message"][data-value="appointment"]',
            'mouseenter',
            e
        ),
        s(
            '#quickOptions [data-action="quick-message"][data-value="appointment"]',
            'touchstart',
            e
        ),
        s('#chatInput', 'focus', e, !1),
        c(e, { idleTimeout: 2600, fallbackDelay: 1700 }));
}
function re() {
    t(
        se,
        (e) => e.startChatBooking(),
        () => {
            F(
                'No pude iniciar la reserva por chat. Puedes continuar desde <a href="#v5-booking" data-action="minimize-chat">el formulario</a>.'
            );
        }
    );
}
function de(e) {
    t(
        se,
        (t) => t.handleChatBookingSelection(e),
        () => {
            F('No pude procesar esa opcion. Intenta nuevamente.');
        }
    );
}
function le(e) {
    e &&
        t(
            se,
            (t) => t.handleChatDateSelect(e),
            () => {
                F('No pude procesar esa fecha. Intenta nuevamente.');
            }
        );
}
function ue(e) {
    return n(se, (t) => t.processChatBookingStep(e));
}
function ge() {
    return n(se, (e) => e.finalizeChatBooking());
}
function he() {
    return (
        !(
            !window.Piel ||
            !window.Piel.ChatBookingEngine ||
            'function' != typeof window.Piel.ChatBookingEngine.isActive
        ) && window.Piel.ChatBookingEngine.isActive()
    );
}
function me() {
    return r({
        cacheKey: 'figo-chat-engine',
        src: D,
        scriptDataAttribute: 'data-figo-chat-engine',
        resolveModule: () => window.Piel && window.Piel.FigoChatEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.processWithKimi),
        onModuleReady: (e) => {
            e &&
                'function' == typeof e.init &&
                e.init({
                    debugLog: v,
                    showTypingIndicator: G,
                    removeTypingIndicator: J,
                    addBotMessage: F,
                    startChatBooking: re,
                    processChatBookingStep: ue,
                    isChatBookingActive: he,
                    showToast: o,
                    getChatMode: q,
                    getClinicalRouteContext: K,
                    getConversationContext: k,
                    setConversationContext: I,
                    getCurrentAppointment: b,
                    getChatHistory: w,
                    setChatHistory: y,
                    getClinicalHistorySession: i,
                    setClinicalHistorySession: C,
                    clearClinicalHistorySession: f,
                    renderChatHistory: V,
                    clinicalHistorySessionEndpoint:
                        '/api.php?resource=clinical-history-session',
                    chatContextMaxItems: 24,
                    clinicAddress: p,
                    clinicMapUrl: m,
                    doctorCarolinaPhone: h,
                    doctorCarolinaEmail: g,
                });
        },
        missingApiError: 'Figo chat engine loaded without API',
        loadError: 'No se pudo cargar chat-engine.js',
    });
}
function pe() {
    const e = a(() => me(), { markWarmOnSuccess: !0 });
    (s('#chatbotWidget .chatbot-toggle', 'mouseenter', e),
        s('#chatbotWidget .chatbot-toggle', 'touchstart', e),
        s('#chatInput', 'focus', e),
        c(e, { idleTimeout: 7e3, fallbackDelay: 7e3 }));
}
async function fe(e) {
    return t(
        me,
        (t) => t.processWithKimi(e),
        (e) => {
            (J(),
                F(
                    'No se pudo iniciar el asistente en este momento. Intenta de nuevo o escribenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.',
                    !1
                ));
        }
    );
}
async function Ce(e = {}) {
    return t(
        me,
        (t) =>
            t && 'function' == typeof t.ensureClinicalSessionHydrated
                ? t.ensureClinicalSessionHydrated(e)
                : null,
        () => null
    );
}
function ye() {
    return (
        'file:' !== window.location.protocol ||
        (setTimeout(() => {
            o(
                'Para usar funciones online, abre el sitio en un servidor local. Ver docs/LOCAL_SERVER.md',
                'warning',
                'Servidor requerido'
            );
        }, 2e3),
        !1)
    );
}
export {
    F as addBotMessage,
    Q as addUserMessage,
    ye as checkServerEnvironment,
    N as doesClinicalSessionMatchRoute,
    Ce as ensureClinicalSessionHydrated,
    _ as escapeHtml,
    ge as finalizeChatBooking,
    q as getChatMode,
    K as getClinicalRouteContext,
    de as handleChatBookingSelection,
    le as handleChatDateSelect,
    ne as handleChatKeypress,
    ce as initChatBookingEngineWarmup,
    pe as initChatEngineWarmup,
    Y as initChatUiEngineWarmup,
    $ as initChatWidgetEngineWarmup,
    he as isChatBookingActive,
    se as loadChatBookingEngine,
    X as loadChatUiEngine,
    Z as loadChatWidgetEngine,
    me as loadFigoChatEngine,
    te as minimizeChatbot,
    ue as processChatBookingStep,
    fe as processWithKimi,
    J as removeTypingIndicator,
    V as renderChatHistory,
    ae as scheduleChatNotification,
    z as scrollToBottom,
    oe as sendChatMessage,
    ie as sendQuickMessage,
    G as showTypingIndicator,
    re as startChatBooking,
    ee as toggleChatbot,
};
