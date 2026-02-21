/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */
import { r as runDeferredModule, s as showToast, k as getCurrentAppointment, l as loadDeferredModule, d as withDeployAssetVersion, X as escapeHtml, h as CLINIC_ADDRESS, u as getCurrentLang, c as createWarmupRunner, b as bindWarmupTarget, a as scheduleDeferredTask } from '../../script.js';

const UI_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/ui-bundle.js?v=20260220-consolidated1'
);

function getSuccessModalEngineDeps() {
    return {
        getCurrentLang,
        getCurrentAppointment,
        getClinicAddress: () => CLINIC_ADDRESS,
        escapeHtml,
    };
}

function loadSuccessModalEngine() {
    return loadDeferredModule({
        cacheKey: 'success-modal-engine',
        src: UI_BUNDLE_URL,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.SuccessModalEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getSuccessModalEngineDeps()),
        missingApiError: 'success-modal-engine loaded without API',
        loadError: 'No se pudo cargar success-modal-engine.js',
        logLabel: 'Success modal engine',
    });
}

function initSuccessModalEngineWarmup() {
    const warmup = createWarmupRunner(() => loadSuccessModalEngine());
    bindWarmupTarget(
        '#appointmentForm button[type="submit"]',
        'pointerdown',
        warmup
    );
    bindWarmupTarget(
        '#appointmentForm button[type="submit"]',
        'focus',
        warmup,
        false
    );
    bindWarmupTarget('.payment-method', 'pointerdown', warmup);
    scheduleDeferredTask(warmup, { idleTimeout: 2800, fallbackDelay: 1600 });
}

function showSuccessModal(emailSent = false) {
    const appt = getCurrentAppointment();
    if (appt) {
        try {
            localStorage.setItem('last_confirmed_appointment', JSON.stringify(appt));
        } catch (e) {
            // noop
        }
    }

    runDeferredModule(
        loadSuccessModalEngine,
        (engine) => engine.showSuccessModal(emailSent),
        () => {
            showToast('No se pudo abrir la confirmacion de cita.', 'error');
        }
    );
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    runDeferredModule(loadSuccessModalEngine, (engine) =>
        engine.closeSuccessModal()
    );
}

export { closeSuccessModal, initSuccessModalEngineWarmup, loadSuccessModalEngine, showSuccessModal };
