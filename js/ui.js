import { withDeployAssetVersion } from './utils.js';
import { loadDeferredModule, createWarmupRunner, bindWarmupTarget, scheduleDeferredTask, runDeferredModule } from './loader.js';
import { closePaymentModal } from './booking.js';

const UI_EFFECTS_URL = withDeployAssetVersion('/ui-effects.js?v=figo-ui-20260220-sync2');
const MODAL_UX_ENGINE_URL = withDeployAssetVersion('/modal-ux-engine.js?v=figo-modal-ux-20260220-phase2-cachefix1');

// UI Effects
export function loadUiEffects() {
    return loadDeferredModule({
        cacheKey: 'ui-effects',
        src: UI_EFFECTS_URL,
        scriptDataAttribute: 'data-ui-effects',
        resolveModule: () => window.PielUiEffects,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(),
        missingApiError: 'ui-effects loaded without API',
        loadError: 'No se pudo cargar ui-effects.js',
        logLabel: 'UI effects'
    });
}

export function initUiEffectsWarmup() {
    const warmup = createWarmupRunner(() => loadUiEffects());
    bindWarmupTarget('.nav', 'mouseenter', warmup);
    bindWarmupTarget('.nav', 'touchstart', warmup);
    const triggerOnce = () => warmup();
    window.addEventListener('scroll', triggerOnce, { once: true, passive: true });
    window.addEventListener('pointerdown', triggerOnce, { once: true, passive: true });
    scheduleDeferredTask(warmup, { idleTimeout: 1800, fallbackDelay: 1200 });
}

export function toggleMobileMenu(forceClose) {
    const menu = document.getElementById('mobileMenu');
    if (forceClose === false) {
        menu.classList.remove('active');
        document.body.style.overflow = '';
        return;
    }
    menu.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
}

// Modal UX Engine
function getModalUxEngineDeps() {
    return {
        closePaymentModal,
        toggleMobileMenu
    };
}

export function loadModalUxEngine() {
    return loadDeferredModule({
        cacheKey: 'modal-ux-engine',
        src: MODAL_UX_ENGINE_URL,
        scriptDataAttribute: 'data-modal-ux-engine',
        resolveModule: () => window.PielModalUxEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getModalUxEngineDeps()),
        missingApiError: 'modal-ux-engine loaded without API',
        loadError: 'No se pudo cargar modal-ux-engine.js',
        logLabel: 'Modal UX engine'
    });
}

export function initModalUxEngineWarmup() {
    const warmup = createWarmupRunner(() => loadModalUxEngine());
    bindWarmupTarget('.modal', 'pointerdown', warmup);
    bindWarmupTarget('.modal-close', 'pointerdown', warmup);
    if (document.querySelector('.modal')) {
        setTimeout(warmup, 180);
    }
    scheduleDeferredTask(warmup, { idleTimeout: 2200, fallbackDelay: 1200 });
}

export function startWebVideo() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

export function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}
