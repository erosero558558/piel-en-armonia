/**
 * Payment gateway engine (deferred-loaded).
 * Handles payment config caching, Stripe SDK loading and gateway calls.
 */
(function () {
    'use strict';

    const DEFAULT_PAYMENT_CONFIG = {
        enabled: false,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD'
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
            currency: source.currency || 'USD'
        };
    }

    async function loadPaymentConfig() {
        const now = Date.now();
        if (paymentConfigLoaded && (now - paymentConfigLoadedAt) < 5 * 60 * 1000) {
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
        }).catch((error) => {
            stripeSdkPromise = null;
            throw error;
        });

        return stripeSdkPromise;
    }

    async function createPaymentIntent(appointment) {
        return getApiRequest()('payment-intent', {
            method: 'POST',
            body: appointment
        });
    }

    async function verifyPaymentIntent(paymentIntentId) {
        return getApiRequest()('payment-verify', {
            method: 'POST',
            body: { paymentIntentId }
        });
    }

    window.PielPaymentGatewayEngine = {
        init,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent
    };
})();
