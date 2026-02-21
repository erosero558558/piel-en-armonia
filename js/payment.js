import { apiRequest } from './api.js';
import {
    getPaymentConfig,
    setPaymentConfig,
    getPaymentConfigLoaded,
    setPaymentConfigLoaded,
    getPaymentConfigLoadedAt,
    setPaymentConfigLoadedAt,
    getStripeSdkPromise,
    setStripeSdkPromise,
    getCurrentLang,
} from './state.js';
import { API_ENDPOINT, API_REQUEST_TIMEOUT_MS } from './config.js';
import { loadDeferredModule, withDeferredModule } from './loader.js';
import { withDeployAssetVersion } from './utils.js';

const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');

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

export function loadPaymentGatewayEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getPaymentGatewayEngineDeps()),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine'
    });
}

export async function loadPaymentConfig() {
    const now = Date.now();
    if (
        getPaymentConfigLoaded() &&
        now - getPaymentConfigLoadedAt() < 5 * 60 * 1000
    ) {
        return getPaymentConfig();
    }

    let config;
    try {
        const payload = await apiRequest('payment-config');
        config = {
            enabled: payload.enabled === true,
            provider: payload.provider || 'stripe',
            publishableKey: payload.publishableKey || '',
            currency: payload.currency || 'USD',
        };
    } catch (error) {
        config = {
            enabled: false,
            provider: 'stripe',
            publishableKey: '',
            currency: 'USD',
        };
    }
    setPaymentConfig(config);
    setPaymentConfigLoaded(true);
    setPaymentConfigLoadedAt(now);
    return config;
}

export async function loadStripeSdk() {
    if (typeof window.Stripe === 'function') {
        return true;
    }

    if (getStripeSdkPromise()) {
        return getStripeSdkPromise();
    }

    const promise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
            'script[data-stripe-sdk="true"]'
        );
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true), {
                once: true,
            });
            existingScript.addEventListener(
                'error',
                () => reject(new Error('No se pudo cargar Stripe SDK')),
                { once: true }
            );
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.defer = true;
        script.dataset.stripeSdk = 'true';
        script.onload = () => resolve(true);
        script.onerror = () =>
            reject(new Error('No se pudo cargar Stripe SDK'));
        document.head.appendChild(script);
    });

    setStripeSdkPromise(promise);
    return promise;
}

export async function createPaymentIntent(appointment) {
    const payload = await apiRequest('payment-intent', {
        method: 'POST',
        body: appointment,
    });
    return payload;
}

export async function verifyPaymentIntent(paymentIntentId) {
    return apiRequest('payment-verify', {
        method: 'POST',
        body: { paymentIntentId },
    });
}

export async function uploadTransferProof(file) {
    const formData = new FormData();
    formData.append('proof', file);

    const query = new URLSearchParams({ resource: 'transfer-proof' });
    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        API_REQUEST_TIMEOUT_MS
    );

    let response;
    let text = '';
    try {
        response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
            signal: controller.signal,
        });
        text = await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(
                getCurrentLang() === 'es'
                    ? 'Tiempo de espera agotado al subir el comprobante'
                    : 'Upload timed out while sending proof file'
            );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error('No se pudo interpretar la respuesta de subida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload.data || {};
}
