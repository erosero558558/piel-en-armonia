import {
    getCurrentLang, getCurrentAppointment, setCurrentAppointment,
    getCheckoutSession, setCheckoutSession, setCheckoutSessionActive,
    getAvailabilityCache, setAvailabilityCache, getAvailabilityCacheLoadedAt, setAvailabilityCacheLoadedAt,
    getAvailabilityCachePromise, setAvailabilityCachePromise, getBookedSlotsCache,
    getBookingViewTracked, setBookingViewTracked,
    getAvailabilityPrefetched, setAvailabilityPrefetched
} from './state.js';
import {
    DEFAULT_TIME_SLOTS, LOCAL_FALLBACK_ENABLED, AVAILABILITY_CACHE_TTL_MS, BOOKED_SLOTS_CACHE_TTL_MS,
    MAX_CASE_PHOTOS, MAX_CASE_PHOTO_BYTES, CASE_PHOTO_ALLOWED_TYPES, CLINIC_ADDRESS
} from './config.js';
import {
    showToast, debugLog, escapeHtml, storageGetJSON, storageSetJSON
} from './utils.js';
import {
    loadDeferredModule, scheduleDeferredTask, createWarmupRunner, bindWarmupTarget, observeOnceWhenVisible, runDeferredModule
} from './loader.js';
import { apiRequest } from './api.js';
import {
    loadPaymentConfig, loadStripeSdk, createPaymentIntent, verifyPaymentIntent, uploadTransferProof
} from './payment.js';
import { trackEvent, normalizeAnalyticsLabel } from './analytics.js';
import { showSuccessModal } from './success-modal.js';

const BOOKING_ENGINE_URL = '/booking-engine.js?v=figo-booking-20260219-mbfix1';
const BOOKING_UI_URL = '/booking-ui.js?v=figo-booking-ui-20260218-phase4';

export function getCasePhotoFiles(formElement) {
    const input = formElement?.querySelector('#casePhotos');
    if (!input || !input.files) return [];
    return Array.from(input.files);
}

export function validateCasePhotoFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            getCurrentLang() === 'es'
                ? `Puedes subir maximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                getCurrentLang() === 'es'
                    ? `Cada foto debe pesar maximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                    : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
            );
        }

        const mime = String(file.type || '').toLowerCase();
        const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
        const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
        if (!validByMime && !validByExt) {
            throw new Error(
                getCurrentLang() === 'es'
                    ? 'Solo se permiten imágenes JPG, PNG o WEBP.'
                    : 'Only JPG, PNG or WEBP images are allowed.'
            );
        }
    }
}

async function ensureCasePhotosUploaded(appointment) {
    const files = Array.isArray(appointment?.casePhotoFiles) ? appointment.casePhotoFiles : [];
    if (files.length === 0) {
        return { names: [], urls: [], paths: [] };
    }

    if (Array.isArray(appointment.casePhotoUploads) && appointment.casePhotoUploads.length > 0) {
        return {
            names: appointment.casePhotoUploads.map(item => String(item.name || '')).filter(Boolean),
            urls: appointment.casePhotoUploads.map(item => String(item.url || '')).filter(Boolean),
            paths: appointment.casePhotoUploads.map(item => String(item.path || '')).filter(Boolean)
        };
    }

    const uploads = [];
    for (const file of files) {
        const uploaded = await uploadTransferProof(file);
        uploads.push({
            name: uploaded.transferProofName || file.name || '',
            url: uploaded.transferProofUrl || '',
            path: uploaded.transferProofPath || ''
        });
    }
    appointment.casePhotoUploads = uploads;

    return {
        names: uploads.map(item => String(item.name || '')).filter(Boolean),
        urls: uploads.map(item => String(item.url || '')).filter(Boolean),
        paths: uploads.map(item => String(item.path || '')).filter(Boolean)
    };
}

export function stripTransientAppointmentFields(appointment) {
    const payload = { ...appointment };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

export async function buildAppointmentPayload(appointment) {
    const payload = stripTransientAppointmentFields(appointment || {});
    const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
    payload.casePhotoCount = uploadedPhotos.urls.length;
    payload.casePhotoNames = uploadedPhotos.names;
    payload.casePhotoUrls = uploadedPhotos.urls;
    payload.casePhotoPaths = uploadedPhotos.paths;
    return payload;
}

function getBookedSlotsCacheKey(date, doctor = '') {
    return `${String(date || '')}::${String(doctor || '')}`;
}

export function invalidateBookedSlotsCache(date = '', doctor = '') {
    const targetDate = String(date || '').trim();
    const targetDoctor = String(doctor || '').trim();
    const cache = getBookedSlotsCache();
    if (!targetDate) {
        cache.clear();
        return;
    }

    for (const key of cache.keys()) {
        if (!key.startsWith(`${targetDate}::`)) {
            continue;
        }
        if (targetDoctor === '' || key === getBookedSlotsCacheKey(targetDate, targetDoctor)) {
            cache.delete(key);
        }
    }
}

export async function loadAvailabilityData(options = {}) {
    const forceRefresh = options && options.forceRefresh === true;
    const now = Date.now();
    const cache = getAvailabilityCache();
    const loadedAt = getAvailabilityCacheLoadedAt();

    if (!forceRefresh && loadedAt > 0 && (now - loadedAt) < AVAILABILITY_CACHE_TTL_MS) {
        return cache;
    }

    if (!forceRefresh && getAvailabilityCachePromise()) {
        return getAvailabilityCachePromise();
    }

    const promise = (async () => {
        try {
            const payload = await apiRequest('availability');
            setAvailabilityCache(payload.data || {});
            setAvailabilityCacheLoadedAt(Date.now());
            storageSetJSON('availability', getAvailabilityCache());
        } catch (error) {
            setAvailabilityCache(storageGetJSON('availability', {}));
            const currentCache = getAvailabilityCache();
            if (currentCache && typeof currentCache === 'object' && Object.keys(currentCache).length > 0) {
                setAvailabilityCacheLoadedAt(Date.now());
            }
        } finally {
            setAvailabilityCachePromise(null);
        }

        return getAvailabilityCache();
    })();

    setAvailabilityCachePromise(promise);
    return promise;
}

export async function getBookedSlots(date, doctor = '') {
    const cacheKey = getBookedSlotsCacheKey(date, doctor);
    const now = Date.now();
    const cache = getBookedSlotsCache();
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (now - cachedEntry.at) < BOOKED_SLOTS_CACHE_TTL_MS) {
        return cachedEntry.slots;
    }

    try {
        const query = { date: date };
        if (doctor) query.doctor = doctor;
        const payload = await apiRequest('booked-slots', { query });
        const slots = Array.isArray(payload.data) ? payload.data : [];
        cache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error;
        }
        const appointments = storageGetJSON('appointments', []);
        const slots = appointments
            .filter(a => {
                if (a.date !== date || a.status === 'cancelled') return false;
                if (doctor && doctor !== 'indiferente') {
                    const aDoc = a.doctor || '';
                    if (aDoc && aDoc !== 'indiferente' && aDoc !== doctor) return false;
                }
                return true;
            })
            .map(a => a.time);
        cache.set(cacheKey, {
            slots,
            at: now
        });
        return slots;
    }
}

export async function createAppointmentRecord(appointment, options = {}) {
    const allowLocalFallback = options.allowLocalFallback !== false;
    try {
        const payload = await apiRequest('appointments', {
            method: 'POST',
            body: appointment
        });
        const localAppointments = storageGetJSON('appointments', []);
        localAppointments.push(payload.data);
        storageSetJSON('appointments', localAppointments);
        if (payload && payload.data) {
            invalidateBookedSlotsCache(payload.data.date || appointment?.date || '', payload.data.doctor || appointment?.doctor || '');
        } else {
            invalidateBookedSlotsCache(appointment?.date || '', appointment?.doctor || '');
        }
        return {
            appointment: payload.data,
            emailSent: payload.emailSent === true
        };
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED || !allowLocalFallback) {
            throw error;
        }
        const localAppointments = storageGetJSON('appointments', []);
        const fallback = {
            ...appointment,
            id: Date.now(),
            status: 'confirmed',
            dateBooked: new Date().toISOString(),
            paymentStatus: appointment.paymentStatus || 'pending'
        };
        localAppointments.push(fallback);
        storageSetJSON('appointments', localAppointments);
        invalidateBookedSlotsCache(fallback.date || appointment?.date || '', fallback.doctor || appointment?.doctor || '');
        return {
            appointment: fallback,
            emailSent: false
        };
    }
}

export function startCheckoutSession(appointment) {
    const session = {
        active: true,
        completed: false,
        startedAt: Date.now(),
        service: appointment?.service || '',
        doctor: appointment?.doctor || ''
    };
    setCheckoutSession(session);
}

export function completeCheckoutSession(method) {
    const session = getCheckoutSession();
    if (!session.active) {
        return;
    }
    session.completed = true;
    setCheckoutSession(session);
    trackEvent('booking_confirmed', {
        payment_method: method || 'unknown',
        service: session.service || '',
        doctor: session.doctor || ''
    });
}

export function maybeTrackCheckoutAbandon(reason = 'unknown') {
    const session = getCheckoutSession();
    if (!session.active || session.completed) {
        return;
    }

    const startedAt = session.startedAt || Date.now();
    const elapsedSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    trackEvent('checkout_abandon', {
        service: session.service || '',
        doctor: session.doctor || '',
        elapsed_sec: elapsedSec,
        reason: normalizeAnalyticsLabel(reason, 'unknown')
    });
}

export function markBookingViewed(source = 'unknown') {
    if (getBookingViewTracked()) {
        return;
    }
    setBookingViewTracked(true);
    trackEvent('view_booking', {
        source
    });
}

export function prefetchAvailabilityData(source = 'unknown') {
    if (getAvailabilityPrefetched()) {
        return;
    }
    setAvailabilityPrefetched(true);
    loadAvailabilityData().catch(() => {
        setAvailabilityPrefetched(false);
    });
    trackEvent('availability_prefetch', {
        source
    });
}

function getBookingEngineDeps() {
    return {
        getCurrentLang: getCurrentLang,
        getCurrentAppointment: getCurrentAppointment,
        setCurrentAppointment: setCurrentAppointment,
        getCheckoutSession: getCheckoutSession,
        setCheckoutSessionActive: setCheckoutSessionActive,
        startCheckoutSession,
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
        normalizeAnalyticsLabel
    };
}

export function loadBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-engine',
        src: BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.PielBookingEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingEngineDeps()),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine'
    });
}

export function initBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingEngine(), { markWarmOnSuccess: true });

    const selectors = [
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]'
    ];

    selectors.forEach((selector) => {
        bindWarmupTarget(selector, 'mouseenter', warmup);
        bindWarmupTarget(selector, 'focus', warmup, false);
        bindWarmupTarget(selector, 'touchstart', warmup);
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1100
    });
}

// Payment Modal Wrappers
export function openPaymentModal(appointmentData) {
    runDeferredModule(
        loadBookingEngine,
        (engine) => engine.openPaymentModal(appointmentData),
        (error) => {
            debugLog('openPaymentModal fallback error:', error);
            showToast('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}

export function closePaymentModal(options = {}) {
    if (window.PielBookingEngine && typeof window.PielBookingEngine.closePaymentModal === 'function') {
        window.PielBookingEngine.closePaymentModal(options);
        return;
    }

    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason = options && typeof options.reason === 'string' ? options.reason : 'modal_close';
    if (!skipAbandonTrack) {
        maybeTrackCheckoutAbandon(abandonReason);
    }

    setCheckoutSessionActive(false);
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

export function getActivePaymentMethod() {
    if (window.PielBookingEngine && typeof window.PielBookingEngine.getActivePaymentMethod === 'function') {
        return window.PielBookingEngine.getActivePaymentMethod();
    }
    const activeMethod = document.querySelector('.payment-method.active');
    return activeMethod?.dataset.method || 'cash';
}

export async function processPayment() {
    return runDeferredModule(
        loadBookingEngine,
        (engine) => engine.processPayment(),
        (error) => {
            debugLog('processPayment error:', error);
            showToast('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}

// Booking UI
function getBookingUiDeps() {
    return {
        loadAvailabilityData,
        getBookedSlots,
        showToast,
        getCurrentLang: getCurrentLang,
        getDefaultTimeSlots: () => DEFAULT_TIME_SLOTS.slice(),
        getCasePhotoFiles,
        validateCasePhotoFiles,
        markBookingViewed,
        startCheckoutSession,
        trackEvent,
        normalizeAnalyticsLabel,
        openPaymentModal,
        setCurrentAppointment: setCurrentAppointment
    };
}

export function loadBookingUi() {
    return loadDeferredModule({
        cacheKey: 'booking-ui',
        src: BOOKING_UI_URL,
        scriptDataAttribute: 'data-booking-ui',
        resolveModule: () => window.PielBookingUi,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingUiDeps()),
        missingApiError: 'booking-ui loaded without API',
        loadError: 'No se pudo cargar booking-ui.js',
        logLabel: 'Booking UI'
    });
}

export function initBookingUiWarmup() {
    const warmup = createWarmupRunner(() => loadBookingUi());

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup
    });

    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('focusin', warmup, { once: true });
        appointmentForm.addEventListener('pointerdown', warmup, { once: true, passive: true });
        setTimeout(warmup, 120);
    }

    if (!bookingSection && !appointmentForm) {
        return;
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 1100
    });
}

export function initBookingFunnelObserver() {
    const bookingSection = document.getElementById('citas');
    if (!bookingSection) {
        return;
    }

    observeOnceWhenVisible(bookingSection, () => {
        markBookingViewed('observer');
        prefetchAvailabilityData('booking_section_visible');
    }, {
        threshold: 0.35,
        onNoObserver: () => {
            markBookingViewed('fallback_no_observer');
            prefetchAvailabilityData('fallback_no_observer');
        }
    });
}
