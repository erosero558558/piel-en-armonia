const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// payment/engine.js has no ES module imports — inject as-is.
// It exposes window.PielPaymentGatewayEngine at the module level.
const engineScript = fs.readFileSync(
    path.resolve(__dirname, '../../src/apps/payment/engine.js'),
    'utf8'
);


test.describe('Payment Gateway Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        await page.addScriptTag({ content: engineScript });
        await page.waitForFunction(
            () => typeof window.PielPaymentGatewayEngine !== 'undefined'
        );
    });

    // -----------------------------------------------------------------------
    // init
    // -----------------------------------------------------------------------
    test.describe('init', () => {
        test('returns the engine object with all expected methods', async ({ page }) => {
            // page.evaluate serializes to JSON — check methods inside the browser context
            const result = await page.evaluate(() => {
                const engine = window.PielPaymentGatewayEngine.init({});
                return {
                    isTruthy: !!engine,
                    hasLoadPaymentConfig: typeof engine.loadPaymentConfig === 'function',
                    hasLoadStripeSdk: typeof engine.loadStripeSdk === 'function',
                    hasCreatePaymentIntent: typeof engine.createPaymentIntent === 'function',
                    hasVerifyPaymentIntent: typeof engine.verifyPaymentIntent === 'function',
                    hasUploadTransferProof: typeof engine.uploadTransferProof === 'function',
                };
            });
            expect(result.isTruthy).toBe(true);
            expect(result.hasLoadPaymentConfig).toBe(true);
            expect(result.hasLoadStripeSdk).toBe(true);
            expect(result.hasCreatePaymentIntent).toBe(true);
            expect(result.hasUploadTransferProof).toBe(true);
        });

        test('stores the provided deps so they are accessible to other methods', async ({ page }) => {
            const called = await page.evaluate(async () => {
                let wasCalled = false;
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => {
                        wasCalled = true;
                        return {};
                    },
                });
                await window.PielPaymentGatewayEngine.loadPaymentConfig();
                return wasCalled;
            });
            expect(called).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // loadPaymentConfig
    // -----------------------------------------------------------------------
    test.describe('loadPaymentConfig', () => {
        test('returns normalized config on success', async ({ page }) => {
            const config = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => ({
                        enabled: true,
                        provider: 'stripe',
                        publishableKey: 'pk_test_abc',
                        currency: 'USD',
                    }),
                });
                return window.PielPaymentGatewayEngine.loadPaymentConfig();
            });
            expect(config.enabled).toBe(true);
            expect(config.provider).toBe('stripe');
            expect(config.publishableKey).toBe('pk_test_abc');
            expect(config.currency).toBe('USD');
        });

        test('returns default config when API call fails', async ({ page }) => {
            const config = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => {
                        throw new Error('Network error');
                    },
                });
                return window.PielPaymentGatewayEngine.loadPaymentConfig();
            });
            expect(config.enabled).toBe(false);
            expect(config.provider).toBe('stripe');
            expect(config.publishableKey).toBe('');
        });

        test('caches the result and does not call apiRequest a second time', async ({ page }) => {
            const callCount = await page.evaluate(async () => {
                let calls = 0;
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => {
                        calls++;
                        return { enabled: true, provider: 'stripe' };
                    },
                });
                await window.PielPaymentGatewayEngine.loadPaymentConfig();
                await window.PielPaymentGatewayEngine.loadPaymentConfig();
                return calls;
            });
            expect(callCount).toBe(1);
        });

        test('normalizes enabled=false when payload is missing', async ({ page }) => {
            const config = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => ({}), // empty payload
                });
                return window.PielPaymentGatewayEngine.loadPaymentConfig();
            });
            expect(config.enabled).toBe(false);
        });

        test('returns default config when apiRequest dep is missing (error is caught internally)', async ({ page }) => {
            // getApiRequest() throws, but loadPaymentConfig catches it and returns default config
            const config = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({}); // no apiRequest
                return window.PielPaymentGatewayEngine.loadPaymentConfig();
            });
            expect(config.enabled).toBe(false);
            expect(config.provider).toBe('stripe');
        });
    });

    // -----------------------------------------------------------------------
    // loadStripeSdk
    // -----------------------------------------------------------------------
    test.describe('loadStripeSdk', () => {
        test('returns true immediately when window.Stripe is already defined', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.Stripe = function() {}; // Stripe already loaded
                window.PielPaymentGatewayEngine.init({});
                return window.PielPaymentGatewayEngine.loadStripeSdk();
            });
            expect(result).toBe(true);
        });

        test('creates a script tag and resolves when it loads', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.Stripe = undefined;
                window.PielPaymentGatewayEngine.init({});
                const promise = window.PielPaymentGatewayEngine.loadStripeSdk();
                // Script is created synchronously in the Promise executor — trigger load manually
                const script = document.querySelector('script[data-stripe-sdk="true"]');
                if (script && typeof script.onload === 'function') script.onload();
                return promise;
            });
            expect(result).toBe(true);
        });

        test('rejects when the script fails to load', async ({ page }) => {
            const threw = await page.evaluate(async () => {
                window.Stripe = undefined;
                window.PielPaymentGatewayEngine.init({});
                const promise = window.PielPaymentGatewayEngine.loadStripeSdk();
                const script = document.querySelector('script[data-stripe-sdk="true"]');
                if (script && typeof script.onerror === 'function') script.onerror();
                try {
                    await promise;
                    return false;
                } catch {
                    return true;
                }
            });
            expect(threw).toBe(true);
        });

        test('does not create a second script tag when called concurrently', async ({ page }) => {
            const scriptCount = await page.evaluate(() => {
                window.Stripe = undefined;
                window.PielPaymentGatewayEngine.init({});
                // Both calls happen synchronously before any microtask runs
                window.PielPaymentGatewayEngine.loadStripeSdk();
                window.PielPaymentGatewayEngine.loadStripeSdk();
                return document.querySelectorAll('script[data-stripe-sdk="true"]').length;
            });
            expect(scriptCount).toBe(1);
        });

        test('uses an existing stripe script element if already in the DOM', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.Stripe = undefined;
                // Pre-insert the script tag (simulating partial page load)
                const existingScript = document.createElement('script');
                existingScript.dataset.stripeSdk = 'true';
                document.head.appendChild(existingScript);

                window.PielPaymentGatewayEngine.init({});
                const promise = window.PielPaymentGatewayEngine.loadStripeSdk();

                // Trigger load on the existing element
                existingScript.dispatchEvent(new Event('load'));
                return promise;
            });
            expect(result).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // createPaymentIntent
    // -----------------------------------------------------------------------
    test.describe('createPaymentIntent', () => {
        test('calls apiRequest with payment-intent resource and POST body', async ({ page }) => {
            const call = await page.evaluate(async () => {
                let capturedResource, capturedOptions;
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async (resource, options) => {
                        capturedResource = resource;
                        capturedOptions = options;
                        return { ok: true, clientSecret: 'cs_test' };
                    },
                });
                await window.PielPaymentGatewayEngine.createPaymentIntent({
                    service: 'acne',
                    date: '2026-03-01',
                });
                return { resource: capturedResource, options: capturedOptions };
            });
            expect(call.resource).toBe('payment-intent');
            expect(call.options.method).toBe('POST');
            expect(call.options.body).toEqual({ service: 'acne', date: '2026-03-01' });
        });

        test('returns the API response', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async () => ({ ok: true, clientSecret: 'cs_test_xyz' }),
                });
                return window.PielPaymentGatewayEngine.createPaymentIntent({ service: 'laser' });
            });
            expect(result.clientSecret).toBe('cs_test_xyz');
        });
    });

    // -----------------------------------------------------------------------
    // verifyPaymentIntent
    // -----------------------------------------------------------------------
    test.describe('verifyPaymentIntent', () => {
        test('calls apiRequest with payment-verify resource and paymentIntentId in body', async ({ page }) => {
            const call = await page.evaluate(async () => {
                let capturedResource, capturedOptions;
                window.PielPaymentGatewayEngine.init({
                    apiRequest: async (resource, options) => {
                        capturedResource = resource;
                        capturedOptions = options;
                        return { ok: true, verified: true };
                    },
                });
                await window.PielPaymentGatewayEngine.verifyPaymentIntent('pi_test_123');
                return { resource: capturedResource, options: capturedOptions };
            });
            expect(call.resource).toBe('payment-verify');
            expect(call.options.method).toBe('POST');
            expect(call.options.body).toEqual({ paymentIntentId: 'pi_test_123' });
        });
    });

    // -----------------------------------------------------------------------
    // uploadTransferProof
    // -----------------------------------------------------------------------
    test.describe('uploadTransferProof', () => {
        test('sends a POST with FormData containing the proof file', async ({ page }) => {
            const captured = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({});
                let capturedBody;
                window.fetch = async (url, init) => {
                    capturedBody = init.body;
                    return new Response(
                        JSON.stringify({ ok: true, data: { url: '/uploads/proof.jpg' } }),
                        { status: 200 }
                    );
                };
                const file = new File(['content'], 'proof.jpg', { type: 'image/jpeg' });
                await window.PielPaymentGatewayEngine.uploadTransferProof(file);
                return capturedBody instanceof FormData;
            });
            expect(captured).toBe(true);
        });

        test('returns payload.data on success', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({});
                window.fetch = async () =>
                    new Response(
                        JSON.stringify({ ok: true, data: { fileId: 'abc123' } }),
                        { status: 200 }
                    );
                const file = new File(['x'], 'proof.jpg', { type: 'image/jpeg' });
                return window.PielPaymentGatewayEngine.uploadTransferProof(file);
            });
            expect(result.fileId).toBe('abc123');
        });

        test('uses deps.apiEndpoint when provided', async ({ page }) => {
            const url = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({ apiEndpoint: '/custom-api.php' });
                let capturedUrl;
                window.fetch = async (u) => {
                    capturedUrl = u;
                    return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
                };
                const file = new File(['x'], 'proof.jpg', { type: 'image/jpeg' });
                await window.PielPaymentGatewayEngine.uploadTransferProof(file);
                return capturedUrl;
            });
            expect(url).toContain('/custom-api.php');
        });

        test('throws a localized timeout error when upload is aborted', async ({ page }) => {
            const error = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({
                    apiRequestTimeoutMs: 100, // short timeout
                    getCurrentLang: () => 'es',
                });
                // Fetch that respects AbortSignal
                window.fetch = (url, init) =>
                    new Promise((resolve, reject) => {
                        if (init && init.signal) {
                            init.signal.addEventListener('abort', () =>
                                reject(new DOMException('Aborted', 'AbortError'))
                            );
                        }
                        // Never resolves
                    });
                const file = new File(['x'], 'proof.jpg', { type: 'image/jpeg' });
                try {
                    await window.PielPaymentGatewayEngine.uploadTransferProof(file);
                } catch (e) {
                    return e.message;
                }
            });
            expect(error).toContain('Tiempo de espera agotado');
        });

        test('throws when response is not valid JSON', async ({ page }) => {
            const threw = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({});
                window.fetch = async () => new Response('not-json{{', { status: 200 });
                const file = new File(['x'], 'proof.jpg', { type: 'image/jpeg' });
                try {
                    await window.PielPaymentGatewayEngine.uploadTransferProof(file);
                    return false;
                } catch {
                    return true;
                }
            });
            expect(threw).toBe(true);
        });

        test('throws with server error message when response.ok is false', async ({ page }) => {
            const error = await page.evaluate(async () => {
                window.PielPaymentGatewayEngine.init({});
                window.fetch = async () =>
                    new Response(
                        JSON.stringify({ ok: false, error: 'File too large' }),
                        { status: 413 }
                    );
                const file = new File(['x'], 'proof.jpg', { type: 'image/jpeg' });
                try {
                    await window.PielPaymentGatewayEngine.uploadTransferProof(file);
                } catch (e) {
                    return e.message;
                }
            });
            expect(error).toBe('File too large');
        });
    });
});
