const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const PORT = process.env.PORT || 8000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function fetchUrl(path) {
    return new Promise((resolve, reject) => {
        http.get(`${BASE_URL}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        }).on('error', reject);
    });
}

test('S36 Smoke Test Suite', async (t) => {
    
    await t.test('(1) GET /es/telemedicina/consulta/ responds with 200', async () => {
        const res = await fetchUrl('/es/telemedicina/consulta/');
        assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    });

    let homeHtml = '';
    await t.test('(2) /es/ contains data-v6-header', async () => {
        const res = await fetchUrl('/es/');
        assert.strictEqual(res.statusCode, 200, 'Expected 200 OK for /es/');
        homeHtml = res.data;
        assert.ok(homeHtml.includes('data-v6-header'), 'Missing data-v6-header attribute');
    });

    await t.test('(3) GET /es/portal/ responds with 200', async () => {
        const res = await fetchUrl('/es/portal/');
        assert.strictEqual(res.statusCode, 200, 'Expected 200 OK for portal auth wall / landing');
    });

    await t.test('(4) Key v6 data attributes are present in home', () => {
        assert.ok(homeHtml.includes('data-v6-header'), 'data-v6-header should be present');
        assert.ok(homeHtml.includes('data-v6-theme-toggle') || homeHtml.includes('data-v6-drawer-open') || homeHtml.includes('v6'), 'Should have v6 specific architecture references');
    });

    await t.test('(5) GET /api.php?resource=health responds with {ok: true}', async () => {
        const res = await fetchUrl('/api.php?resource=health');
        assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
        const json = JSON.parse(res.data);
        assert.strictEqual(json.ok, true, 'Expected {ok: true} in response payload');
    });

    await t.test('(6) GET /api.php?resource=monitoring-config responds with {ok: true}', async () => {
        const res = await fetchUrl('/api.php?resource=monitoring-config');
        assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
        const json = JSON.parse(res.data);
        assert.strictEqual(json.ok, true, 'Expected {ok: true} in config payload');
    });
});
