/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */
import { A as API_ENDPOINT, B as API_REQUEST_TIMEOUT_MS, E as API_DEFAULT_RETRIES, F as getApiSlowNoticeLastAt, G as API_SLOW_NOTICE_COOLDOWN_MS, s as showToast, p as state, H as API_SLOW_NOTICE_MS, I as waitMs, J as setApiSlowNoticeLastAt, K as API_RETRY_BASE_DELAY_MS, r as runDeferredModule, d as withDeployAssetVersion, l as loadDeferredModule, L as setStripeSdkPromise, M as getStripeSdkPromise, N as setPaymentConfigLoadedAt, O as getPaymentConfigLoadedAt, P as setPaymentConfigLoaded, Q as getPaymentConfigLoaded, R as setPaymentConfig, S as getPaymentConfig, u as getCurrentLang, T as markBookingViewed, c as createWarmupRunner, b as bindWarmupTarget, a as scheduleDeferredTask, U as normalizeAnalyticsLabel, t as trackEvent, V as uploadTransferProof, v as createAppointmentRecord, W as loadAnalyticsEngine, z as observeOnceWhenVisible, q as setCurrentAppointment, x as getBookedSlots, y as loadAvailabilityData } from '../../script.js';
import { showSuccessModal } from './success-modal-D5Mn68in.js';

async function apiRequest(resource, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const query = new URLSearchParams({ resource: resource });
    if (options.query && typeof options.query === 'object') {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
    }
    const url = `${API_ENDPOINT}?${query.toString()}`;
    const requestInit = {
        method: method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    };

    if (options.body !== undefined) {
        requestInit.headers['Content-Type'] = 'application/json';
        requestInit.body = JSON.stringify(options.body);
    }

    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1500, Number(options.timeoutMs))
        : API_REQUEST_TIMEOUT_MS;
    const maxRetries = Number.isInteger(options.retries)
        ? Math.max(0, Number(options.retries))
        : method === 'GET'
          ? API_DEFAULT_RETRIES
          : 0;

    const shouldShowSlowNotice = options.silentSlowNotice !== true;
    const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

    function makeApiError(message, status = 0, retryable = false, code = '') {
        const error = new Error(message);
        error.status = status;
        error.retryable = retryable;
        error.code = code;
        return error;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let slowNoticeTimer = null;

        if (shouldShowSlowNotice) {
            slowNoticeTimer = setTimeout(() => {
                const now = Date.now();
                if (
                    now - getApiSlowNoticeLastAt() >
                    API_SLOW_NOTICE_COOLDOWN_MS
                ) {
                    setApiSlowNoticeLastAt(now);
                    showToast(
                        state.currentLang === 'es'
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    );
                }
            }, API_SLOW_NOTICE_MS);
        }

        try {
            const response = await fetch(url, {
                ...requestInit,
                signal: controller.signal,
            });

            const responseText = await response.text();
            let payload = {};
            try {
                payload = responseText ? JSON.parse(responseText) : {};
            } catch (error) {
                throw makeApiError(
                    'Respuesta del servidor no es JSON valido',
                    response.status,
                    false,
                    'invalid_json'
                );
            }

            if (!response.ok || payload.ok === false) {
                const message = payload.error || `HTTP ${response.status}`;
                throw makeApiError(
                    message,
                    response.status,
                    retryableStatusCodes.has(response.status),
                    'http_error'
                );
            }

            return payload;
        } catch (error) {
            const normalizedError = (() => {
                if (error && error.name === 'AbortError') {
                    return makeApiError(
                        state.currentLang === 'es'
                            ? 'Tiempo de espera agotado con el servidor'
                            : 'Server request timed out',
                        0,
                        true,
                        'timeout'
                    );
                }

                if (error instanceof Error) {
                    if (typeof error.retryable !== 'boolean') {
                        error.retryable = false;
                    }
                    if (typeof error.status !== 'number') {
                        error.status = 0;
                    }
                    return error;
                }

                return makeApiError(
                    'Error de conexion con el servidor',
                    0,
                    true,
                    'network_error'
                );
            })();

            lastError = normalizedError;

            const canRetry =
                attempt < maxRetries && normalizedError.retryable === true;
            if (!canRetry) {
                throw normalizedError;
            }

            const retryDelay = API_RETRY_BASE_DELAY_MS * (attempt + 1);
            await waitMs(retryDelay);
        } finally {
            clearTimeout(timeoutId);
            if (slowNoticeTimer !== null) {
                clearTimeout(slowNoticeTimer);
            }
        }
    }

    throw lastError || new Error('No se pudo completar la solicitud');
}

const BOOKING_UTILS_URL$1 = withDeployAssetVersion('/js/engines/booking-utils.js');

function getPaymentGatewayEngineDeps() {
    return {
        apiRequest,
        getCurrentLang,
        getPaymentConfig, setPaymentConfig,
        getPaymentConfigLoaded, setPaymentConfigLoaded,
        getPaymentConfigLoadedAt, setPaymentConfigLoadedAt,
        getStripeSdkPromise, setStripeSdkPromise,
        apiEndpoint: API_ENDPOINT,
        apiRequestTimeoutMs: API_REQUEST_TIMEOUT_MS
    };
}

function loadPaymentGatewayEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL$1,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getPaymentGatewayEngineDeps()),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine'
    });
}

async function loadPaymentConfig() {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadPaymentConfig());
}

async function loadStripeSdk() {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadStripeSdk());
}

async function createPaymentIntent(appointment) {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.createPaymentIntent(appointment));
}

async function verifyPaymentIntent(paymentIntentId) {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.verifyPaymentIntent(paymentIntentId));
}

const BOOKING_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'
);
const BOOKING_UI_URL = withDeployAssetVersion(
    '/js/engines/booking-ui.js?v=figo-booking-ui-20260220-sync3-cachepurge1'
);
const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');
const CASE_PHOTO_UPLOAD_CONCURRENCY = 2;

function stripTransientAppointmentFields(appointment) {
    const payload = { ...appointment };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

async function ensureCasePhotosUploaded(appointment) {
    const files = Array.isArray(appointment?.casePhotoFiles)
        ? appointment.casePhotoFiles
        : [];
    if (files.length === 0) {
        return { names: [], urls: [], paths: [] };
    }

    if (
        Array.isArray(appointment.casePhotoUploads) &&
        appointment.casePhotoUploads.length > 0
    ) {
        return {
            names: appointment.casePhotoUploads
                .map((item) => String(item.name || ''))
                .filter(Boolean),
            urls: appointment.casePhotoUploads
                .map((item) => String(item.url || ''))
                .filter(Boolean),
            paths: appointment.casePhotoUploads
                .map((item) => String(item.path || ''))
                .filter(Boolean),
        };
    }

    const uploads = new Array(files.length);
    const workerCount = Math.max(
        1,
        Math.min(CASE_PHOTO_UPLOAD_CONCURRENCY, files.length)
    );
    let cursor = 0;

    const uploadWorker = async () => {
        while (cursor < files.length) {
            const index = cursor;
            cursor += 1;
            const file = files[index];
            const uploaded = await uploadTransferProof(file, { retries: 2 });
            uploads[index] = {
                name: uploaded.transferProofName || file.name || '',
                url: uploaded.transferProofUrl || '',
                path: uploaded.transferProofPath || '',
            };
        }
    };

    await Promise.all(
        Array.from({ length: workerCount }, () => uploadWorker())
    );
    appointment.casePhotoUploads = uploads;

    return {
        names: uploads.map((item) => String(item.name || '')).filter(Boolean),
        urls: uploads.map((item) => String(item.url || '')).filter(Boolean),
        paths: uploads.map((item) => String(item.path || '')).filter(Boolean),
    };
}

async function buildAppointmentPayload(appointment) {
    const payload = stripTransientAppointmentFields(appointment || {});
    const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
    payload.casePhotoCount = uploadedPhotos.urls.length;
    payload.casePhotoNames = uploadedPhotos.names;
    payload.casePhotoUrls = uploadedPhotos.urls;
    payload.casePhotoPaths = uploadedPhotos.paths;
    return payload;
}

function getBookingEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        getCurrentAppointment: () => state.currentAppointment,
        setCurrentAppointment: (appt) => { state.currentAppointment = appt; },
        getCheckoutSession: () => state.checkoutSession,
        setCheckoutSessionActive: (active) => { state.checkoutSession.active = (active === true); },
        startCheckoutSession,
        setCheckoutStep,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent,
        buildAppointmentPayload,
        stripTransientAppointmentFields,
        createAppointmentRecord,
        uploadTransferProof,
        showSuccessModal,
        showToast,
        trackEvent,
        normalizeAnalyticsLabel,
    };
}

function loadBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-engine',
        src: BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.Piel && window.Piel.BookingEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingEngineDeps()),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine',
    });
}

function initBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingEngine(), {
        markWarmOnSuccess: true,
    });

    const selectors = [
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]',
    ];

    selectors.forEach((selector) => {
        bindWarmupTarget(selector, 'mouseenter', warmup);
        bindWarmupTarget(selector, 'focus', warmup, false);
        bindWarmupTarget(selector, 'touchstart', warmup);
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1100,
    });
}

// CHECKOUT SESSION WRAPPERS
function startCheckoutSession(appointment, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.startCheckoutSession(appointment, metadata)
    );
}

function setCheckoutStep(step, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.setCheckoutStep(step, metadata)
    );
}

function completeCheckoutSession(method) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.completeCheckoutSession(method)
    );
}

function maybeTrackCheckoutAbandon(reason = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.maybeTrackCheckoutAbandon(reason)
    );
}

function loadBookingCalendarEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils-calendar',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
        isModuleReady: (module) => !!(module && typeof module.initCalendar === 'function'),
        missingApiError: 'booking-calendar-engine loaded without API',
        loadError: 'No se pudo cargar booking-calendar-engine',
        logLabel: 'Booking Calendar engine'
    });
}

async function updateAvailableTimes(elements) {
    return runDeferredModule(loadBookingCalendarEngine, (engine) => engine.updateAvailableTimes(getBookingUiDeps(), elements));
}

// BOOKING UI
function getDefaultTimeSlots() {
    return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
}

function getBookingUiDeps() {
    return {
        loadAvailabilityData,
        getBookedSlots,
        updateAvailableTimes,
        getDefaultTimeSlots,
        showToast,
        getCurrentLang: () => state.currentLang,
        getCasePhotoFiles: (form) => {
            const input = form?.querySelector('#casePhotos');
            if (!input || !input.files) return [];
            return Array.from(input.files);
        },
        validateCasePhotoFiles,
        markBookingViewed,
        startCheckoutSession,
        setCheckoutStep,
        trackEvent,
        normalizeAnalyticsLabel,
        openPaymentModal,
        setCurrentAppointment: setCurrentAppointment,
    };
}

function validateCasePhotoFiles(files) {
    const MAX_CASE_PHOTOS = 3;
    const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
    const CASE_PHOTO_ALLOWED_TYPES = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
    ]);

    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            state.currentLang === 'es'
                ? `Puedes subir m\u00E1ximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                state.currentLang === 'es'
                    ? `Cada foto debe pesar m\u00E1ximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                    : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
            );
        }

        const mime = String(file.type || '').toLowerCase();
        const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
        const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
        if (!validByMime && !validByExt) {
            throw new Error(
                state.currentLang === 'es'
                    ? 'Solo se permiten im\u00e1genes JPG, PNG o WEBP.'
                    : 'Only JPG, PNG or WEBP images are allowed.'
            );
        }
    }
}

function loadBookingUi() {
    return loadDeferredModule({
        cacheKey: 'booking-ui',
        src: BOOKING_UI_URL,
        scriptDataAttribute: 'data-booking-ui',
        resolveModule: () => window.Piel && window.Piel.BookingUi,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => {
            module.init(getBookingUiDeps());
            window.PielBookingUiReady = true;
            if (window.debugLog) window.debugLog('Booking UI ready');
        },
        missingApiError: 'booking-ui loaded without API',
        loadError: 'No se pudo cargar booking-ui.js',
        logLabel: 'Booking UI',
    });
}

function initBookingUiWarmup() {
    const warmup = createWarmupRunner(() => loadBookingUi());

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup,
    });

    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('focusin', warmup, { once: true });
        appointmentForm.addEventListener('pointerdown', warmup, {
            once: true,
            passive: true,
        });
        setTimeout(warmup, 120);
    }

    if (!bookingSection && !appointmentForm) {
        return;
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 1100,
    });
}

function openPaymentModal(appointmentData) {
    runDeferredModule(
        loadBookingEngine,
        (engine) => engine.openPaymentModal(appointmentData),
        (error) => {
            showToast('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}

function closePaymentModal(options = {}) {
    if (
        window.Piel &&
        window.Piel.BookingEngine &&
        typeof window.Piel.BookingEngine.closePaymentModal === 'function'
    ) {
        window.Piel.BookingEngine.closePaymentModal(options);
        return;
    }

    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason =
        options && typeof options.reason === 'string'
            ? options.reason
            : 'modal_close';
    if (!skipAbandonTrack) {
        maybeTrackCheckoutAbandon(abandonReason);
    }

    state.checkoutSession.active = false;
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

async function processPayment() {
    return runDeferredModule(
        loadBookingEngine,
        (engine) => engine.processPayment(),
        (error) => {
            showToast('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}

function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initBookingFunnelObserver()
    );
}

export { closePaymentModal, completeCheckoutSession, initBookingEngineWarmup, initBookingFunnelObserver, initBookingUiWarmup, loadBookingCalendarEngine, loadBookingEngine, loadBookingUi, markBookingViewed, maybeTrackCheckoutAbandon, openPaymentModal, processPayment, setCheckoutStep, startCheckoutSession, updateAvailableTimes };
