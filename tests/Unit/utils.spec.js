const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Preprocess js/utils.js for browser injection:
//   - Strip ES module imports (replace with inline mocks)
//   - Remove 'export' keywords (functions become regular globals)
//   - Expose all functions on window.PielUtils
// ---------------------------------------------------------------------------
function buildUtilsScript() {
    const utilsPath = path.resolve(__dirname, '../../js/utils.js');
    let src = fs.readFileSync(utilsPath, 'utf8');

    // Replace specific import lines with inline mocks
    src = src
        .replace("import { state } from './state.js';", '')
        .replace("import { COOKIE_CONSENT_KEY } from './config.js';", '');

    // Strip 'export' keyword so functions become plain globals
    src = src.replace(/^export\s+/gm, '');

    const preamble = `
// --- Injected mocks replacing ES module imports ---
var state = {
    get currentLang() {
        return (window.__testState && window.__testState.currentLang) || 'es';
    }
};
var COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';

// --- Mock localStorage for about:blank (which denies storage access) ---
(function() {
    var _needsMock = false;
    try { window.localStorage.getItem('__probe'); } catch (_e) { _needsMock = true; }
    if (_needsMock) {
        var _store = {};
        try {
            Object.defineProperty(window, 'localStorage', {
                configurable: true,
                writable: true,
                value: {
                    getItem: function(k) {
                        return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null;
                    },
                    setItem: function(k, v) { _store[k] = String(v); },
                    removeItem: function(k) { delete _store[k]; },
                    clear: function() { _store = {}; },
                },
            });
        } catch (_defineErr) {}
    }
})();
`;

    const suffix = `
// --- Expose all exported utilities globally for test access ---
window.PielUtils = {
    debugLog, escapeHtml, waitMs, formatDate, debounce,
    isConstrainedNetworkConnection, resolveDeployAssetVersion,
    withDeployAssetVersion, showToast, storageGetJSON, storageSetJSON,
    getInitials, getRelativeDateLabel, renderStars,
    getCookieConsent, setCookieConsent,
};
`;

    return preamble + src + suffix;
}

const utilsScript = buildUtilsScript();

test.describe('Utils Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        // Reset Piel global and testState before each test
        await page.evaluate(() => {
            window.Piel = undefined;
            window.__testState = undefined;
        });
        await page.addScriptTag({ content: utilsScript });
        await page.waitForFunction(() => typeof window.PielUtils !== 'undefined');
    });

    // -----------------------------------------------------------------------
    // escapeHtml
    // -----------------------------------------------------------------------
    test.describe('escapeHtml', () => {
        test('escapes < and > characters', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.escapeHtml('<script>alert(1)</script>')
            );
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
        });

        test('escapes & character', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.escapeHtml('Piel & Armonia')
            );
            expect(result).toContain('&amp;');
        });

        test('returns empty string for empty input', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.escapeHtml(''));
            expect(result).toBe('');
        });

        test('returns empty string for null and undefined', async ({ page }) => {
            const results = await page.evaluate(() => [
                window.PielUtils.escapeHtml(null),
                window.PielUtils.escapeHtml(undefined),
            ]);
            expect(results).toEqual(['', '']);
        });

        test('passes through safe text unchanged', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.escapeHtml('Texto seguro 123')
            );
            expect(result).toBe('Texto seguro 123');
        });

        test('delegates to Piel.ChatUiEngine.escapeHtml when available', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = {
                    ChatUiEngine: { escapeHtml: () => '__delegated__' },
                };
                return window.PielUtils.escapeHtml('anything');
            });
            expect(result).toBe('__delegated__');
        });
    });

    // -----------------------------------------------------------------------
    // formatDate
    // -----------------------------------------------------------------------
    test.describe('formatDate', () => {
        test('formats valid ISO date string', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.formatDate('2025-12-25')
            );
            // es-EC locale: "25 dic. 2025" or similar
            expect(result).toMatch(/25/);
            expect(result).toMatch(/2025/);
        });

        test('returns original string for invalid date', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.formatDate('not-a-date')
            );
            expect(result).toBe('not-a-date');
        });

        test('returns empty string for empty input', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.formatDate(''));
            expect(result).toBe('');
        });
    });

    // -----------------------------------------------------------------------
    // debounce
    // -----------------------------------------------------------------------
    test.describe('debounce', () => {
        test('calls the function only once after rapid repeated calls', async ({ page }) => {
            const callCount = await page.evaluate(async () => {
                let count = 0;
                const fn = window.PielUtils.debounce(() => { count++; }, 50);
                fn(); fn(); fn(); fn();
                await new Promise((r) => setTimeout(r, 150));
                return count;
            });
            expect(callCount).toBe(1);
        });

        test('calls the function with the correct arguments', async ({ page }) => {
            const received = await page.evaluate(async () => {
                let args;
                const fn = window.PielUtils.debounce((...a) => { args = a; }, 30);
                fn('hello', 42);
                await new Promise((r) => setTimeout(r, 100));
                return args;
            });
            expect(received).toEqual(['hello', 42]);
        });
    });

    // -----------------------------------------------------------------------
    // waitMs
    // -----------------------------------------------------------------------
    test.describe('waitMs', () => {
        test('resolves after at least the specified delay', async ({ page }) => {
            const elapsed = await page.evaluate(async () => {
                const start = Date.now();
                await window.PielUtils.waitMs(50);
                return Date.now() - start;
            });
            expect(elapsed).toBeGreaterThanOrEqual(45);
        });
    });

    // -----------------------------------------------------------------------
    // withDeployAssetVersion
    // -----------------------------------------------------------------------
    test.describe('withDeployAssetVersion', () => {
        test('returns empty string for empty url', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.withDeployAssetVersion('')
            );
            expect(result).toBe('');
        });

        test('returns url unchanged when no deployVersion is set', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = { deployVersion: '' };
                return window.PielUtils.withDeployAssetVersion('/styles.css');
            });
            expect(result).toBe('/styles.css');
        });

        test('returns url unchanged when window.Piel is undefined', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = undefined;
                return window.PielUtils.withDeployAssetVersion('/app.js');
            });
            expect(result).toBe('/app.js');
        });

        test('appends cv param when deployVersion is set', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = { deployVersion: 'v1.2.3' };
                return window.PielUtils.withDeployAssetVersion('/styles.css');
            });
            expect(result).toContain('cv=v1.2.3');
        });

        test('appends cv param without duplicating existing query params', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = { deployVersion: 'v1.2.3' };
                return window.PielUtils.withDeployAssetVersion('/styles.css?v=base');
            });
            expect(result).toContain('cv=v1.2.3');
            expect(result).toContain('v=base');
        });
    });

    // -----------------------------------------------------------------------
    // showToast
    // -----------------------------------------------------------------------
    test.describe('showToast', () => {
        test('creates #toastContainer when it does not exist', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '';
                window.PielUtils.showToast('Hello');
            });
            await expect(page.locator('#toastContainer')).toBeVisible();
        });

        test('appends a toast element to the container', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '';
                window.PielUtils.showToast('Mensaje de prueba');
            });
            await expect(page.locator('#toastContainer .toast')).toBeVisible();
        });

        test('escapes HTML in the message to prevent XSS', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '';
                window.PielUtils.showToast('<img src=x onerror=alert(1)>');
            });
            const html = await page.locator('#toastContainer').innerHTML();
            expect(html).not.toContain('<img ');
            expect(html).toContain('&lt;img');
        });

        test('applies the correct CSS class for the given type', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '';
                window.PielUtils.showToast('Error message', 'error');
            });
            await expect(page.locator('#toastContainer .toast.error')).toBeVisible();
        });

        test('uses custom title when provided', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '';
                window.PielUtils.showToast('msg', 'info', 'Mi titulo');
            });
            const html = await page.locator('#toastContainer').innerHTML();
            expect(html).toContain('Mi titulo');
        });
    });

    // -----------------------------------------------------------------------
    // storageGetJSON
    // -----------------------------------------------------------------------
    test.describe('storageGetJSON', () => {
        test('returns fallback when key does not exist', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.clear();
                return window.PielUtils.storageGetJSON('nonexistent_key', { default: true });
            });
            expect(result).toEqual({ default: true });
        });

        test('returns stored value when key exists', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem('test_key', JSON.stringify({ value: 42 }));
                return window.PielUtils.storageGetJSON('test_key', null);
            });
            expect(result).toEqual({ value: 42 });
        });

        test('returns fallback when stored value is invalid JSON', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem('bad_json_key', 'not-json{{{');
                return window.PielUtils.storageGetJSON('bad_json_key', 'fallback');
            });
            expect(result).toBe('fallback');
        });

        test('returns fallback (not null) when stored value is JSON null', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem('null_key', 'null');
                return window.PielUtils.storageGetJSON('null_key', 'default');
            });
            expect(result).toBe('default');
        });
    });

    // -----------------------------------------------------------------------
    // storageSetJSON
    // -----------------------------------------------------------------------
    test.describe('storageSetJSON', () => {
        test('stores object as JSON string in localStorage', async ({ page }) => {
            const retrieved = await page.evaluate(() => {
                window.PielUtils.storageSetJSON('myKey', { id: 1, name: 'test' });
                return JSON.parse(localStorage.getItem('myKey'));
            });
            expect(retrieved).toEqual({ id: 1, name: 'test' });
        });

        test('stores arrays correctly', async ({ page }) => {
            const retrieved = await page.evaluate(() => {
                window.PielUtils.storageSetJSON('arrKey', [1, 2, 3]);
                return JSON.parse(localStorage.getItem('arrKey'));
            });
            expect(retrieved).toEqual([1, 2, 3]);
        });

        test('stores primitive values correctly', async ({ page }) => {
            const retrieved = await page.evaluate(() => {
                window.PielUtils.storageSetJSON('numKey', 42);
                return JSON.parse(localStorage.getItem('numKey'));
            });
            expect(retrieved).toBe(42);
        });
    });

    // -----------------------------------------------------------------------
    // getInitials
    // -----------------------------------------------------------------------
    test.describe('getInitials', () => {
        test('returns initials from a two-word name', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.getInitials('Maria Perez'));
            expect(result).toBe('MP');
        });

        test('returns single initial from a one-word name', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.getInitials('Juan'));
            expect(result).toBe('J');
        });

        test('returns P (first letter of Paciente fallback) for empty, null, or undefined name', async ({ page }) => {
            // Falsy inputs fall back to 'Paciente' (single word) → initial 'P'
            const results = await page.evaluate(() => [
                window.PielUtils.getInitials(''),
                window.PielUtils.getInitials(null),
                window.PielUtils.getInitials(undefined),
            ]);
            expect(results).toEqual(['P', 'P', 'P']);
        });

        test('uses only the first two words of a multi-word name', async ({ page }) => {
            const result = await page.evaluate(() =>
                window.PielUtils.getInitials('Ana Maria Clara Rios')
            );
            expect(result).toBe('AM');
        });

        test('uppercases the initials', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.getInitials('ana perez'));
            expect(result).toBe('AP');
        });
    });

    // -----------------------------------------------------------------------
    // getRelativeDateLabel
    // -----------------------------------------------------------------------
    test.describe('getRelativeDateLabel', () => {
        test('returns Reciente for invalid date in Spanish', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.__testState = { currentLang: 'es' };
                return window.PielUtils.getRelativeDateLabel('invalid-date');
            });
            expect(result).toBe('Reciente');
        });

        test('returns Recent for invalid date in English', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.__testState = { currentLang: 'en' };
                return window.PielUtils.getRelativeDateLabel('invalid-date');
            });
            expect(result).toBe('Recent');
        });

        test('returns Hoy for today in Spanish', async ({ page }) => {
            const today = new Date().toISOString();
            const result = await page.evaluate((date) => {
                window.__testState = { currentLang: 'es' };
                return window.PielUtils.getRelativeDateLabel(date);
            }, today);
            expect(result).toBe('Hoy');
        });

        test('returns Today for today in English', async ({ page }) => {
            const today = new Date().toISOString();
            const result = await page.evaluate((date) => {
                window.__testState = { currentLang: 'en' };
                return window.PielUtils.getRelativeDateLabel(date);
            }, today);
            expect(result).toBe('Today');
        });

        test('returns Hace N dias for a few days ago in Spanish', async ({ page }) => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const result = await page.evaluate((date) => {
                window.__testState = { currentLang: 'es' };
                return window.PielUtils.getRelativeDateLabel(date);
            }, threeDaysAgo.toISOString());
            expect(result).toMatch(/Hace 3 d/);
        });

        test('returns N days ago for a few days ago in English', async ({ page }) => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const result = await page.evaluate((date) => {
                window.__testState = { currentLang: 'en' };
                return window.PielUtils.getRelativeDateLabel(date);
            }, threeDaysAgo.toISOString());
            expect(result).toMatch(/3 day/);
        });
    });

    // -----------------------------------------------------------------------
    // renderStars
    // -----------------------------------------------------------------------
    test.describe('renderStars', () => {
        test('renders 5 filled stars for rating 5', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.renderStars(5));
            expect((result.match(/fas fa-star/g) || []).length).toBe(5);
            expect(result).not.toContain('far fa-star');
        });

        test('renders 3 filled and 2 empty stars for rating 3', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.renderStars(3));
            expect((result.match(/fas fa-star/g) || []).length).toBe(3);
            expect((result.match(/far fa-star/g) || []).length).toBe(2);
        });

        test('clamps minimum to 1 filled star for rating 0', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.renderStars(0));
            expect((result.match(/fas fa-star/g) || []).length).toBe(1);
            expect((result.match(/far fa-star/g) || []).length).toBe(4);
        });

        test('clamps maximum to 5 filled stars for rating above 5', async ({ page }) => {
            const result = await page.evaluate(() => window.PielUtils.renderStars(10));
            expect((result.match(/fas fa-star/g) || []).length).toBe(5);
            expect(result).not.toContain('far fa-star');
        });
    });

    // -----------------------------------------------------------------------
    // getCookieConsent
    // -----------------------------------------------------------------------
    test.describe('getCookieConsent', () => {
        test('returns empty string when no consent is stored', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.clear();
                return window.PielUtils.getCookieConsent();
            });
            expect(result).toBe('');
        });

        test('returns accepted when stored status is accepted', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem(
                    'pa_cookie_consent_v1',
                    JSON.stringify({ status: 'accepted' })
                );
                return window.PielUtils.getCookieConsent();
            });
            expect(result).toBe('accepted');
        });

        test('returns rejected when stored status is rejected', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem(
                    'pa_cookie_consent_v1',
                    JSON.stringify({ status: 'rejected' })
                );
                return window.PielUtils.getCookieConsent();
            });
            expect(result).toBe('rejected');
        });

        test('returns empty string for invalid stored JSON', async ({ page }) => {
            const result = await page.evaluate(() => {
                localStorage.setItem('pa_cookie_consent_v1', '{bad json}');
                return window.PielUtils.getCookieConsent();
            });
            expect(result).toBe('');
        });

        test('delegates to Piel.ConsentEngine.getCookieConsent when available', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.Piel = {
                    ConsentEngine: { getCookieConsent: () => 'delegated_value' },
                };
                return window.PielUtils.getCookieConsent();
            });
            expect(result).toBe('delegated_value');
        });
    });

    // -----------------------------------------------------------------------
    // setCookieConsent
    // -----------------------------------------------------------------------
    test.describe('setCookieConsent', () => {
        test('stores accepted status in localStorage', async ({ page }) => {
            const status = await page.evaluate(() => {
                localStorage.clear();
                window.PielUtils.setCookieConsent('accepted');
                return JSON.parse(localStorage.getItem('pa_cookie_consent_v1')).status;
            });
            expect(status).toBe('accepted');
        });

        test('stores rejected status in localStorage', async ({ page }) => {
            const status = await page.evaluate(() => {
                localStorage.clear();
                window.PielUtils.setCookieConsent('rejected');
                return JSON.parse(localStorage.getItem('pa_cookie_consent_v1')).status;
            });
            expect(status).toBe('rejected');
        });

        test('normalizes unknown status to rejected', async ({ page }) => {
            const status = await page.evaluate(() => {
                localStorage.clear();
                window.PielUtils.setCookieConsent('unknown_value');
                return JSON.parse(localStorage.getItem('pa_cookie_consent_v1')).status;
            });
            expect(status).toBe('rejected');
        });

        test('stores timestamp alongside status', async ({ page }) => {
            const data = await page.evaluate(() => {
                localStorage.clear();
                window.PielUtils.setCookieConsent('accepted');
                return JSON.parse(localStorage.getItem('pa_cookie_consent_v1'));
            });
            expect(data.at).toBeTruthy();
            expect(typeof data.at).toBe('string');
        });
    });

    // -----------------------------------------------------------------------
    // resolveDeployAssetVersion
    // -----------------------------------------------------------------------
    test.describe('resolveDeployAssetVersion', () => {
        test('returns empty string when no matching script element exists', async ({ page }) => {
            const result = await page.evaluate(() => {
                document.head.innerHTML = '';
                return window.PielUtils.resolveDeployAssetVersion();
            });
            expect(result).toBe('');
        });

        test('returns version from script[src*=script.js] element', async ({ page }) => {
            const result = await page.evaluate(() => {
                // Use an absolute URL so new URL(src, about:blank) resolves correctly
                const script = document.createElement('script');
                script.setAttribute('src', 'https://example.com/script.js?v=test-version-abc');
                document.head.appendChild(script);
                return window.PielUtils.resolveDeployAssetVersion();
            });
            expect(result).toBe('test-version-abc');
        });

        test('returns empty string when script.js has no v param', async ({ page }) => {
            const result = await page.evaluate(() => {
                const script = document.createElement('script');
                script.setAttribute('src', '/script.js');
                document.head.appendChild(script);
                return window.PielUtils.resolveDeployAssetVersion();
            });
            expect(result).toBe('');
        });
    });
});
