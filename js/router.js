import { withDeployAssetVersion, debugLog } from '../src/apps/shared/utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { setThemeMode } from './theme.js';
import { changeLanguage } from './i18n.js';
// LAZY LOADED IMPORTS
// import { toggleMobileMenu, startWebVideo, closeVideoModal } from './ui.js';
// import { openReviewModal, closeReviewModal } from './engagement.js';
// import {
//     closePaymentModal,
//     processPayment,
//     markBookingViewed,
// } from './booking.js';
// import { closeSuccessModal } from './success-modal.js';
// import { closeRescheduleModal, submitReschedule } from './reschedule.js';
// import {
//     toggleChatbot,
//     sendChatMessage,
//     handleChatBookingSelection,
//     sendQuickMessage,
//     minimizeChatbot,
//     startChatBooking,
//     handleChatDateSelect,
// } from '../src/apps/chat/shell.js';

const DATA_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260221-api-fix'
);

function selectService(value) {
    const select = document.getElementById('serviceSelect');
    if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change'));
        import('./booking.js').then(({ markBookingViewed }) => markBookingViewed('service_select'));
        const appointmentSection = document.getElementById('citas');
        if (appointmentSection) {
            const navHeight =
                document.querySelector('.nav')?.offsetHeight || 80;
            const targetPosition =
                appointmentSection.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        }
    }
}

function getActionRouterEngineDeps() {
    return {
        setThemeMode,
        changeLanguage,
        toggleMobileMenu: () => import('./ui.js').then(m => m.toggleMobileMenu()),
        startWebVideo: (id) => import('./ui.js').then(m => m.startWebVideo(id)),
        closeVideoModal: () => import('./ui.js').then(m => m.closeVideoModal()),
        openReviewModal: () => import('./engagement.js').then(m => m.openReviewModal()),
        closeReviewModal: () => import('./engagement.js').then(m => m.closeReviewModal()),
        closePaymentModal: (opts) => import('./booking.js').then(m => m.closePaymentModal(opts)),
        processPayment: () => import('./booking.js').then(m => m.processPayment()),
        closeSuccessModal: () => import('./success-modal.js').then(m => m.closeSuccessModal()),
        closeRescheduleModal: () => import('./reschedule.js').then(m => m.closeRescheduleModal()),
        submitReschedule: (id) => import('./reschedule.js').then(m => m.submitReschedule(id)),
        toggleChatbot: () => import('../src/apps/chat/shell.js').then(m => m.toggleChatbot()),
        sendChatMessage: () => import('../src/apps/chat/shell.js').then(m => m.sendChatMessage()),
        handleChatBookingSelection: (val) => import('../src/apps/chat/shell.js').then(m => m.handleChatBookingSelection(val)),
        sendQuickMessage: (val) => import('../src/apps/chat/shell.js').then(m => m.sendQuickMessage(val)),
        minimizeChatbot: () => import('../src/apps/chat/shell.js').then(m => m.minimizeChatbot()),
        startChatBooking: () => import('../src/apps/chat/shell.js').then(m => m.startChatBooking()),
        handleChatDateSelect: (val) => import('../src/apps/chat/shell.js').then(m => m.handleChatDateSelect(val)),
        selectService,
    };
}

export function loadActionRouterEngine() {
    return loadDeferredModule({
        cacheKey: 'action-router-engine',
        src: DATA_BUNDLE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.ActionRouterEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getActionRouterEngineDeps()),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine',
    });
}

export function initActionRouterEngine() {
    runDeferredModule(
        loadActionRouterEngine,
        () => undefined,
        (error) => {
            debugLog('Action router load failed:', error);
        }
    );
}
