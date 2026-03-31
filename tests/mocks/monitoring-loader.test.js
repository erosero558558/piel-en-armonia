const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert');

const SRC_PATH = path.resolve(__dirname, '../../js/monitoring-loader.js');
const sourceCode = fs.readFileSync(SRC_PATH, 'utf8');

function createSandbox() {
    const sandbox = {
        window: {
            Piel: {},
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            requestIdleCallback: (cb) => cb(),
            addEventListener: () => {},
        },
        document: {
            readyState: 'complete',
            head: {
                appendChild: (child) => {
                    sandbox.document._appendedChildren.push(child);
                }
            },
            createElement: (tag) => {
                return { tag };
            },
            _appendedChildren: []
        },
        fetch: () => Promise.resolve({
            json: () => Promise.resolve({})
        })
    };
    return sandbox;
}

function runScript(sandbox) {
    const fn = new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout', sourceCode);
    fn(sandbox.window, sandbox.document, sandbox.fetch, setTimeout, clearTimeout);
}

test('MonitoringLoader: no-config scenario', async () => {
    const sandbox = createSandbox();
    
    // Config returns empty
    sandbox.fetch = async () => ({
        json: async () => ({})
    });

    runScript(sandbox);
    
    // Wait for event loop to process idle/timeout (simulated bootstrap)
    await new Promise(r => setTimeout(r, 100));

    // Script should fallback to noop immediately without loading CDN
    assert.ok(sandbox.window.Sentry, 'Fallback window.Sentry should be created');
    assert.strictEqual(typeof sandbox.window.Sentry.init, 'function');
    assert.strictEqual(sandbox.document._appendedChildren.length, 0, 'Should not inject Sentry script');
});

test('MonitoringLoader: cdn-fail scenario', async () => {
    const sandbox = createSandbox();
    
    // Config returns valid keys
    sandbox.fetch = async () => ({
        json: async () => ({
            sentry_dsn_frontend: 'https://foo@sentry.io/1'
        })
    });

    runScript(sandbox);
    
    await new Promise(r => setTimeout(r, 50));

    // It should have appended the script tag
    assert.strictEqual(sandbox.document._appendedChildren.length, 1);
    const script = sandbox.document._appendedChildren[0];
    assert.strictEqual(script.src, 'https://browser.sentry-cdn.com/7.114.0/bundle.min.js');
    assert.strictEqual(script.integrity, 'sha384-ZI11RF8XfI7ic0+HK1UnGkClkyjeQrHLUX+42WJHeu8+O94vBhb5Wivro/pn5lhG');

    // Simulate CDN fail
    assert.ok(script.onerror);
    script.onerror();

    // Verify fallback is applied
    assert.ok(sandbox.window.Sentry);
    assert.strictEqual(typeof sandbox.window.Sentry.captureException, 'function');
});

test('MonitoringLoader: init-once scenario (double init guard)', async () => {
    const sandbox = createSandbox();
    
    // First run
    runScript(sandbox);
    assert.strictEqual(sandbox.window.__auroraSentryLoaded, true);

    // Override fetch to detect second run
    let fetchCalls = 0;
    sandbox.fetch = async () => {
        fetchCalls++;
        return { json: async () => ({}) };
    };

    // Second run
    runScript(sandbox);

    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(sandbox.window.__auroraSentryLoaded, true);
    assert.strictEqual(fetchCalls, 0, 'Should have early exited due to guard');
});
