'use strict';

const DEFAULT_PAYMENT_CONFIG = {
    enabled: false,
    provider: 'stripe',
    publishableKey: '',
    currency: 'USD',
};

let deps = null;
let paymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeSdkPromise = null;

function init(inputDeps) {
    deps = inputDeps || {};
    return window.PielPaymentGatewayEngine;
}

function getApiRequest() {
    if (deps && typeof deps.apiRequest === 'function') {
        return deps.apiRequest;
    }
    throw new Error('PaymentGatewayEngine dependency missing: apiRequest');
}

function normalizePaymentConfig(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    return {
        enabled: source.enabled === true,
        provider: source.provider || 'stripe',
        publishableKey: source.publishableKey || '',
        currency: source.currency || 'USD',
    };
}

async function loadPaymentConfig() {
    const now = Date.now();
    if (
        paymentConfigLoaded &&
        now - paymentConfigLoadedAt < 5 * 60 * 1000
    ) {
        return paymentConfig;
    }

    try {
        const payload = await getApiRequest()('payment-config');
        paymentConfig = normalizePaymentConfig(payload);
    } catch (_) {
        paymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
    }

    paymentConfigLoaded = true;
    paymentConfigLoadedAt = now;
    return paymentConfig;
}

async function loadStripeSdk() {
    if (typeof window.Stripe === 'function') {
        return true;
    }

    if (stripeSdkPromise) {
        return stripeSdkPromise;
    }

    stripeSdkPromise = new Promise((resolve, reject) => {
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
    }).catch((error) => {
        stripeSdkPromise = null;
        throw error;
    });

    return stripeSdkPromise;
}

async function createPaymentIntent(appointment) {
    return getApiRequest()('payment-intent', {
        method: 'POST',
        body: appointment,
    });
}

async function verifyPaymentIntent(paymentIntentId) {
    return getApiRequest()('payment-verify', {
        method: 'POST',
        body: { paymentIntentId },
    });
}

async function uploadTransferProof(file) {
    const formData = new FormData();
    formData.append('proof', file);

    const query = new URLSearchParams({ resource: 'transfer-proof' });
    const controller = new AbortController();
    const timeoutMs = (deps && deps.apiRequestTimeoutMs) || 9000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const apiEndpoint = (deps && deps.apiEndpoint) || '/api.php';

    let response;
    let text = '';
    try {
        response = await fetch(`${apiEndpoint}?${query.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
            signal: controller.signal
        });
        text = await response.text();
    } catch (error) {
        if (error && error.name === 'AbortError') {
            const lang = deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
            throw new Error(
                lang === 'es'
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

window.PielPaymentGatewayEngine = {
    init,
    loadPaymentConfig,
    loadStripeSdk,
    createPaymentIntent,
    verifyPaymentIntent,
    uploadTransferProof,
};
