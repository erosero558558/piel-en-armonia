const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Preprocess js/api.js for browser injection:
//   - Strip multi-line ES module imports
//   - Replace with test-safe constants and mocked dependencies
//   - Expose apiRequest on window.PielApi
// ---------------------------------------------------------------------------
function buildApiScript() {
    const apiPath = path.resolve(__dirname, '../../js/api.js');
    let src = fs.readFileSync(apiPath, 'utf8');

    // Remove all multi-line import blocks (import { ... } from '...')
    src = src.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '');

    // Strip 'export' keyword
    src = src.replace(/^export\s+/gm, '');

    // Test-safe constant values (short delays to keep tests fast)
    const preamble = `
var API_ENDPOINT = '/api.php';
var API_REQUEST_TIMEOUT_MS = 300;
var API_DEFAULT_RETRIES = 1;
var API_SLOW_NOTICE_MS = 60;
var API_SLOW_NOTICE_COOLDOWN_MS = 500;
var API_RETRY_BASE_DELAY_MS = 10;

var state = {
    get currentLang() {
        return (window.__testState && window.__testState.currentLang) || 'es';
    }
};
var _slowNoticeLastAt = 0;
var getApiSlowNoticeLastAt = function() { return _slowNoticeLastAt; };
var setApiSlowNoticeLastAt = function(v) { _slowNoticeLastAt = v; };
var showToast = function(msg, type) {
    if (typeof window.__captureToast === 'function') window.__captureToast(msg, type);
};
var waitMs = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
`;

    const suffix = `\nwindow.PielApi = { apiRequest };\n`;

    return preamble + src + suffix;
}

const apiScript = buildApiScript();

// Helper: mock fetch returning a JSON response
function mockFetch(page, status, body) {
    return page.evaluate(({ status, body }) => {
        window.fetch = async () =>
            new Response(JSON.stringify(body), { status });
    }, { status, body });
}

test.describe('API Request Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        await page.evaluate(() => {
            window.__testState = undefined;
            window.__captureToast = undefined;
        });
        await page.addScriptTag({ content: apiScript });
        await page.waitForFunction(() => typeof window.PielApi !== 'undefined');
    });

    // -----------------------------------------------------------------------
    // URL construction
    // -----------------------------------------------------------------------
    test.describe('URL construction', () => {
        test('includes resource param in the URL', async ({ page }) => {
            const url = await page.evaluate(async () => {
                let capturedUrl;
                window.fetch = async (u) => {
                    capturedUrl = u;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('availability');
                return capturedUrl;
            });
            expect(url).toContain('/api.php');
            expect(url).toContain('resource=availability');
        });

        test('appends non-empty query params to the URL', async ({ page }) => {
            const url = await page.evaluate(async () => {
                let capturedUrl;
                window.fetch = async (u) => {
                    capturedUrl = u;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('slots', {
                    query: { date: '2026-03-01', service: 'consulta' },
                });
                return capturedUrl;
            });
            expect(url).toContain('date=2026-03-01');
            expect(url).toContain('service=consulta');
        });

        test('omits null, undefined, and empty string query params', async ({ page }) => {
            const url = await page.evaluate(async () => {
                let capturedUrl;
                window.fetch = async (u) => {
                    capturedUrl = u;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('slots', {
                    query: {
                        present: 'yes',
                        nullVal: null,
                        undefinedVal: undefined,
                        emptyVal: '',
                    },
                });
                return capturedUrl;
            });
            expect(url).toContain('present=yes');
            expect(url).not.toContain('nullVal');
            expect(url).not.toContain('undefinedVal');
            expect(url).not.toContain('emptyVal');
        });
    });

    // -----------------------------------------------------------------------
    // Request configuration
    // -----------------------------------------------------------------------
    test.describe('Request configuration', () => {
        test('defaults to GET method', async ({ page }) => {
            const method = await page.evaluate(async () => {
                let capturedMethod;
                window.fetch = async (u, init) => {
                    capturedMethod = init.method;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('health');
                return capturedMethod;
            });
            expect(method).toBe('GET');
        });

        test('sends POST when method=POST is specified', async ({ page }) => {
            const method = await page.evaluate(async () => {
                let capturedMethod;
                window.fetch = async (u, init) => {
                    capturedMethod = init.method;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('appointments', { method: 'POST', body: {} });
                return capturedMethod;
            });
            expect(method).toBe('POST');
        });

        test('sets Content-Type: application/json and serializes body', async ({ page }) => {
            const init = await page.evaluate(async () => {
                let capturedInit;
                window.fetch = async (u, i) => {
                    capturedInit = { headers: i.headers, body: i.body };
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('appointments', {
                    method: 'POST',
                    body: { service: 'acne', date: '2026-03-01' },
                });
                return capturedInit;
            });
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual({ service: 'acne', date: '2026-03-01' });
        });

        test('does not set Content-Type when no body is provided', async ({ page }) => {
            const contentType = await page.evaluate(async () => {
                let captured;
                window.fetch = async (u, init) => {
                    captured = init.headers['Content-Type'];
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('health');
                return captured;
            });
            expect(contentType).toBeUndefined();
        });

        test('sends credentials: same-origin', async ({ page }) => {
            const credentials = await page.evaluate(async () => {
                let captured;
                window.fetch = async (u, init) => {
                    captured = init.credentials;
                    return new Response(JSON.stringify({ ok: true }), { status: 200 });
                };
                await window.PielApi.apiRequest('health');
                return captured;
            });
            expect(credentials).toBe('same-origin');
        });
    });

    // -----------------------------------------------------------------------
    // Successful responses
    // -----------------------------------------------------------------------
    test.describe('Successful responses', () => {
        test('returns payload on 200 OK', async ({ page }) => {
            await mockFetch(page, 200, { ok: true, data: [1, 2, 3] });
            const result = await page.evaluate(() => window.PielApi.apiRequest('reviews'));
            expect(result.ok).toBe(true);
            expect(result.data).toEqual([1, 2, 3]);
        });

        test('returns empty object for empty response body', async ({ page }) => {
            await page.evaluate(() => {
                window.fetch = async () => new Response('', { status: 200 });
            });
            const result = await page.evaluate(() => window.PielApi.apiRequest('health'));
            expect(result).toEqual({});
        });
    });

    // -----------------------------------------------------------------------
    // Error responses
    // -----------------------------------------------------------------------
    test.describe('Error responses', () => {
        test('throws on HTTP 404 with status, message, and code', async ({ page }) => {
            await mockFetch(page, 404, { error: 'Not found' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('missing');
                } catch (e) {
                    return { message: e.message, status: e.status, code: e.code };
                }
            });
            expect(error.message).toBe('Not found');
            expect(error.status).toBe(404);
            expect(error.code).toBe('http_error');
        });

        test('throws when payload.ok=false even for HTTP 200', async ({ page }) => {
            await mockFetch(page, 200, { ok: false, error: 'Validation failed' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('appointments');
                } catch (e) {
                    return { message: e.message, code: e.code };
                }
            });
            expect(error.message).toBe('Validation failed');
            expect(error.code).toBe('http_error');
        });

        test('throws with code=invalid_json when response is not valid JSON', async ({ page }) => {
            await page.evaluate(() => {
                window.fetch = async () => new Response('not-json-at-all{{', { status: 200 });
            });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('broken');
                } catch (e) {
                    return { code: e.code };
                }
            });
            expect(error.code).toBe('invalid_json');
        });

        test('marks 503 as retryable', async ({ page }) => {
            await mockFetch(page, 503, { error: 'Service unavailable' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { retryable: e.retryable };
                }
            });
            expect(error.retryable).toBe(true);
        });

        test('marks 500 as retryable', async ({ page }) => {
            await mockFetch(page, 500, { error: 'Internal server error' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { retryable: e.retryable };
                }
            });
            expect(error.retryable).toBe(true);
        });

        test('marks 400 as non-retryable', async ({ page }) => {
            await mockFetch(page, 400, { error: 'Bad request' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { retryable: e.retryable };
                }
            });
            expect(error.retryable).toBe(false);
        });

        test('marks 404 as non-retryable', async ({ page }) => {
            await mockFetch(page, 404, { error: 'Not found' });
            const error = await page.evaluate(async () => {
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { retryable: e.retryable };
                }
            });
            expect(error.retryable).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Timeout (AbortController)
    // -----------------------------------------------------------------------
    test.describe('Timeout', () => {
        test('throws code=timeout when fetch does not respond within timeoutMs', async ({ page }) => {
            const error = await page.evaluate(async () => {
                // Mock fetch that respects AbortSignal (like the real fetch API)
                window.fetch = (url, init) =>
                    new Promise((resolve, reject) => {
                        if (init && init.signal) {
                            init.signal.addEventListener('abort', () => {
                                reject(new DOMException('The operation was aborted.', 'AbortError'));
                            });
                        }
                        // Never resolves — waits for abort
                    });
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { code: e.code, retryable: e.retryable };
                }
            });
            expect(error.code).toBe('timeout');
            expect(error.retryable).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Retry logic
    // -----------------------------------------------------------------------
    test.describe('Retry logic', () => {
        test('retries on retryable error and succeeds on second attempt (GET)', async ({ page }) => {
            const result = await page.evaluate(async () => {
                let attempt = 0;
                window.fetch = async () => {
                    attempt++;
                    if (attempt === 1) {
                        return new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
                    }
                    return new Response(JSON.stringify({ ok: true, attempt }), { status: 200 });
                };
                return window.PielApi.apiRequest('health');
            });
            expect(result.ok).toBe(true);
            expect(result.attempt).toBe(2);
        });

        test('does not retry on non-retryable error (400)', async ({ page }) => {
            const fetchCallCount = await page.evaluate(async () => {
                let count = 0;
                window.fetch = async () => {
                    count++;
                    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
                };
                try { await window.PielApi.apiRequest('health'); } catch { /* expected error */ }
                return count;
            });
            expect(fetchCallCount).toBe(1);
        });

        test('does not retry POST requests by default', async ({ page }) => {
            const fetchCallCount = await page.evaluate(async () => {
                let count = 0;
                window.fetch = async () => {
                    count++;
                    return new Response(JSON.stringify({ error: 'Server error' }), { status: 503 });
                };
                try {
                    await window.PielApi.apiRequest('appointments', { method: 'POST', body: {} });
                } catch { /* expected error */ }
                return count;
            });
            expect(fetchCallCount).toBe(1);
        });

        test('respects retries=0 option for GET (no retry)', async ({ page }) => {
            const fetchCallCount = await page.evaluate(async () => {
                let count = 0;
                window.fetch = async () => {
                    count++;
                    return new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
                };
                try { await window.PielApi.apiRequest('health', { retries: 0 }); } catch { /* expected error */ }
                return count;
            });
            expect(fetchCallCount).toBe(1);
        });

        test('respects retries=2 option (3 total attempts)', async ({ page }) => {
            const fetchCallCount = await page.evaluate(async () => {
                let count = 0;
                window.fetch = async () => {
                    count++;
                    return new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
                };
                try { await window.PielApi.apiRequest('health', { retries: 2 }); } catch { /* expected error */ }
                return count;
            });
            expect(fetchCallCount).toBe(3); // 1 original + 2 retries
        });
    });

    // -----------------------------------------------------------------------
    // Slow notice
    // -----------------------------------------------------------------------
    test.describe('Slow notice', () => {
        test('shows info toast when request exceeds slow notice threshold', async ({ page }) => {
            const toasts = await page.evaluate(async () => {
                const captured = [];
                window.__captureToast = (msg, type) => captured.push({ msg, type });
                // Fetch resolves after 120ms (> API_SLOW_NOTICE_MS=60ms)
                window.fetch = () =>
                    new Promise((r) =>
                        setTimeout(
                            () => r(new Response(JSON.stringify({ ok: true }), { status: 200 })),
                            120
                        )
                    );
                await window.PielApi.apiRequest('health');
                return captured;
            });
            expect(toasts.length).toBeGreaterThan(0);
            expect(toasts[0].type).toBe('info');
        });

        test('does not show toast when silentSlowNotice=true', async ({ page }) => {
            const toasts = await page.evaluate(async () => {
                const captured = [];
                window.__captureToast = (msg, type) => captured.push({ msg, type });
                window.fetch = () =>
                    new Promise((r) =>
                        setTimeout(
                            () => r(new Response(JSON.stringify({ ok: true }), { status: 200 })),
                            120
                        )
                    );
                await window.PielApi.apiRequest('health', { silentSlowNotice: true });
                return captured;
            });
            expect(toasts.length).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Network errors
    // -----------------------------------------------------------------------
    test.describe('Network errors', () => {
        test('throws the original TypeError when fetch rejects', async ({ page }) => {
            const error = await page.evaluate(async () => {
                window.fetch = async () => { throw new TypeError('Network failure'); };
                try {
                    await window.PielApi.apiRequest('health', { retries: 0 });
                } catch (e) {
                    return { message: e.message, retryable: e.retryable };
                }
            });
            expect(error.message).toBe('Network failure');
            expect(error.retryable).toBe(false);
        });
    });
});
