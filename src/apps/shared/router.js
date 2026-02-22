'use strict';

let deps = null;
let listenersBound = false;

function getEngineRef() {
    if (window.Piel && window.Piel.ActionRouterEngine) {
        return window.Piel.ActionRouterEngine;
    }
    return window.PielActionRouterEngine;
}

function init(inputDeps) {
    deps = inputDeps || {};
    bindListeners();
    return getEngineRef();
}

function callDep(name) {
    if (!deps || typeof deps[name] !== 'function') {
        return undefined;
    }

    const args = Array.prototype.slice.call(arguments, 1);
    return deps[name].apply(null, args);
}

function handleActionClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
        return;
    }

    const actionEl = target.closest('[data-action]');
    if (!actionEl) {
        return;
    }

    const action = String(actionEl.getAttribute('data-action') || '').trim();
    const value = actionEl.getAttribute('data-value') || '';
    if (!action) {
        return;
    }

    switch (action) {
        case 'toast-close':
            actionEl.closest('.toast')?.remove();
            break;
        case 'set-theme':
            callDep('setThemeMode', value || 'system');
            break;
        case 'set-language':
            callDep('changeLanguage', value || 'es');
            break;
        case 'toggle-mobile-menu':
            callDep('toggleMobileMenu');
            break;
        case 'start-web-video':
            callDep('startWebVideo');
            break;
        case 'open-review-modal':
            callDep('openReviewModal');
            break;
        case 'close-review-modal':
            callDep('closeReviewModal');
            break;
        case 'close-video-modal':
            callDep('closeVideoModal');
            break;
        case 'close-payment-modal':
            callDep('closePaymentModal');
            break;
        case 'process-payment':
            callDep('processPayment');
            break;
        case 'close-success-modal':
            callDep('closeSuccessModal');
            break;
        case 'close-reschedule-modal':
            callDep('closeRescheduleModal');
            break;
        case 'submit-reschedule':
            callDep('submitReschedule');
            break;
        case 'toggle-chatbot':
            callDep('toggleChatbot');
            break;
        case 'send-chat-message':
            callDep('sendChatMessage');
            break;
        case 'chat-booking':
            callDep('handleChatBookingSelection', value);
            break;
        case 'quick-message':
            callDep('sendQuickMessage', value);
            break;
        case 'minimize-chat':
            callDep('minimizeChatbot');
            break;
        case 'start-booking':
            callDep('startChatBooking');
            break;
        case 'select-service':
            callDep('selectService', value);
            break;
        default:
            break;
    }
}

function handleActionChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
        return;
    }

    if (target.closest('[data-action="chat-date-select"]')) {
        callDep('handleChatDateSelect', target.value);
    }
}

function bindListeners() {
    if (listenersBound) {
        return;
    }
    listenersBound = true;
    document.addEventListener('click', handleActionClick);
    document.addEventListener('change', handleActionChange);
}

window.Piel = window.Piel || {};
window.Piel.ActionRouterEngine = {
    init
};
// Legacy global kept for compatibility with older loaders.
window.PielActionRouterEngine = window.Piel.ActionRouterEngine;
