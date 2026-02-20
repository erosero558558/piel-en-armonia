import { apiRequest } from './api.js';
import { state } from './state.js';
import { API_ENDPOINT, API_REQUEST_TIMEOUT_MS } from './config.js';

export async function loadPaymentConfig() {
    const now = Date.now();
    if (state.paymentConfigLoaded && (now - state.paymentConfigLoadedAt) < 5 * 60 * 1000) {
        return state.paymentConfig;
    }

    let config;
    try {
        const payload = await apiRequest('payment-config');
        config = {
            enabled: payload.enabled === true,
            provider: payload.provider || 'stripe',
            publishableKey: payload.publishableKey || '',
            currency: payload.currency || 'USD'
        };
    } catch (_error) {
        config = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
    }
    state.paymentConfig = config;
    state.paymentConfigLoaded = true;
    state.paymentConfigLoadedAt = now;
    return config;
}

export async function loadStripeSdk() {
    if (typeof window.Stripe === 'function') {
        return true;
    }

    if (state.stripeSdkPromise) {
        return state.stripeSdkPromise;
    }

    const promise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-stripe-sdk="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Stripe SDK')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.defer = true;
        script.dataset.stripeSdk = 'true';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('No se pudo cargar Stripe SDK'));
        document.head.appendChild(script);
    });

    state.stripeSdkPromise = promise;
    return promise;
}

export async function createPaymentIntent(appointment) {
    const payload = await apiRequest('payment-intent', {
        method: 'POST',
        body: appointment
    });
    return payload;
}

export async function verifyPaymentIntent(paymentIntentId) {
    return apiRequest('payment-verify', {
        method: 'POST',
        body: { paymentIntentId }
    });
}

export async function uploadTransferProof(file) {
    const formData = new FormData();
    formData.append('proof', file);

    const query = new URLSearchParams({ resource: 'transfer-proof' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    let response;
    let text = '';
    try {
        response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
            signal: controller.signal
        });
        text = await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(
                state.currentLang === 'es'
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
    } catch (_error) {
        throw new Error('No se pudo interpretar la respuesta de subida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload.data || {};
}
