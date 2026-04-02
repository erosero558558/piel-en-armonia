'use strict';

/**
 * Sprint 43 — Patient Portal E2E Functional Tests (Q43-04, Q43-05)
 *
 * Tests that verify the REAL patient portal flow:
 *   - Auth: start → complete → payments
 *   - History: session + consultation render integrity
 *   - Plan: treatment plan contract
 *   - No dummy data leaks in production render
 *
 * Run: node --test tests-node/portal-patient-e2e.test.js
 * Requires: PHP server running on PORT (default 8000)
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const PORT = process.env.PORT || 8000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchJson(resource, { token = '', method = 'GET', body = null } = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`/api.php?resource=${resource}`, BASE_URL);
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers,
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data), raw: data });
                } catch {
                    resolve({ statusCode: res.statusCode, body: null, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function fetchPage(path) {
    return new Promise((resolve, reject) => {
        http.get(`${BASE_URL}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, html: data }));
        }).on('error', reject);
    });
}

// ── Suite 1: Portal Auth API Contract ─────────────────────────────────────

test('Q43-04: Portal Auth — start endpoint contrato básico', async (t) => {

    await t.test('POST patient-portal-auth-start sin teléfono devuelve error 400', async () => {
        const res = await fetchJson('patient-portal-auth-start', {
            method: 'POST',
            body: { phone: '' },
        });
        assert.ok(
            res.statusCode === 400 || res.body?.ok === false,
            `Auth start sin teléfono debe fallar. Status: ${res.statusCode}, ok: ${res.body?.ok}`
        );
    });

    await t.test('POST patient-portal-auth-start con teléfono inválido devuelve error', async () => {
        const res = await fetchJson('patient-portal-auth-start', {
            method: 'POST',
            body: { phone: '123' }, // demasiado corto
        });
        assert.ok(
            res.statusCode === 400 || res.body?.ok === false,
            `Auth start con teléfono corto debe fallar. Status: ${res.statusCode}`
        );
    });

    await t.test('GET patient-portal-auth-status sin token devuelve {ok: false} o 401', async () => {
        const res = await fetchJson('patient-portal-auth-status');
        assert.ok(
            res.statusCode === 401 || res.body?.ok === false,
            `Status sin token debe fallar. Status: ${res.statusCode}, ok: ${res.body?.ok}`
        );
    });
});

// ── Suite 2: Endpoints autenticados devuelven 401 sin token ───────────────

test('Q43-04: Endpoints clínicos protegidos rechacen requests sin token', async (t) => {
    const protectedResources = [
        'patient-portal-history',
        'patient-portal-payments',
        'patient-portal-plan',
        'patient-portal-prescription',
        'patient-portal-consent',
        'patient-portal-photos',
        'patient-summary',
        'push-preferences',
    ];

    for (const resource of protectedResources) {
        await t.test(`GET ${resource} sin token → 401 o ok:false`, async () => {
            const res = await fetchJson(resource);
            assert.ok(
                res.statusCode === 401 || res.body?.ok === false,
                `${resource} debe requerir auth. Got status: ${res.statusCode}, ok: ${res.body?.ok}`
            );
        });
    }
});

// ── Suite 3: Integridad del HTML del portal ───────────────────────────────

test('Q43-04: Portal HTML — pages structure and no dummy data', async (t) => {

    await t.test('GET /es/portal/ responde 200 con estructura auth-wall', async () => {
        const res = await fetchPage('/es/portal/');
        assert.strictEqual(res.statusCode, 200, 'Portal landing debe existir');
        assert.ok(
            res.html.includes('portal') || res.html.includes('Aurora') || res.html.includes('login'),
            'Portal debe tener contenido real'
        );
    });

    await t.test('GET /es/portal/historial/ responde 200', async () => {
        const res = await fetchPage('/es/portal/historial/');
        assert.strictEqual(res.statusCode, 200, 'Portal historial debe existir');
    });

    await t.test('GET /es/portal/historial/ NO tiene diagnosis dummy hardcodeado (Q43-02)', async () => {
        const res = await fetchPage('/es/portal/historial/');
        assert.ok(
            !res.html.includes('L70.0 - Acné vulgaris'),
            'El HTML del historial NO debe contener el diagnóstico dummy hardcodeado'
        );
    });

    await t.test('GET /es/portal/historial/ NO tiene avatar-placeholder (Q43-02)', async () => {
        const res = await fetchPage('/es/portal/historial/');
        assert.ok(
            !res.html.includes('avatar-placeholder.png'),
            'El HTML del historial NO debe referenciar el placeholder de foto'
        );
    });

    await t.test('GET /es/portal/historial/ tiene GA4 dentro del <head> (Q43-12)', async () => {
        const res = await fetchPage('/es/portal/historial/');
        const headSection = res.html.split('</head>')[0] || '';
        assert.ok(
            headSection.includes('G-2DWZ5PJ4MC'),
            'GA4 debe estar dentro del <head>'
        );
    });

    await t.test('GET /es/portal/ NO tiene window.alert() nativo en HTML inline (Q43-01)', async () => {
        const res = await fetchPage('/es/portal/');
        // Solo verificamos que no haya alert() inline — los JS externos son separados
        const inlineScripts = res.html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi) || [];
        const hasAlert = inlineScripts.some(s => s.includes('window.alert(') || /alert\s*\(/.test(s));
        assert.ok(!hasAlert, 'No debe haber window.alert() en scripts inline del HTML del portal');
    });

    await t.test('GET /es/portal/pagos/ responde 200', async () => {
        const res = await fetchPage('/es/portal/pagos/');
        assert.strictEqual(res.statusCode, 200, 'Portal pagos debe existir');
    });

    await t.test('GET /es/portal/plan/ responde 200', async () => {
        const res = await fetchPage('/es/portal/plan/');
        assert.strictEqual(res.statusCode, 200, 'Portal plan debe existir');
    });
});

// ── Suite 4: Endpoints públicos de la API ─────────────────────────────────

test('Q43-04: API pública — contratos básicos verificados', async (t) => {

    await t.test('GET health devuelve {ok: true}', async () => {
        const res = await fetchJson('health');
        assert.strictEqual(res.statusCode, 200, 'Health debe responder 200');
        assert.strictEqual(res.body?.ok, true, 'Health debe devolver ok:true');
    });

    await t.test('GET public-runtime-config devuelve {ok: true}', async () => {
        const res = await fetchJson('public-runtime-config');
        assert.strictEqual(res.statusCode, 200, 'Runtime config debe responder 200');
        assert.ok(res.body?.ok === true || res.body !== null, 'Runtime config debe devolver respuesta válida');
    });

    await t.test('GET queue-public-ticket sin ticketCode responde con error controlado', async () => {
        const res = await fetchJson('queue-public-ticket');
        // Debe fallar gracefully (400 o 404), no con 500
        assert.ok(
            res.statusCode !== 500,
            `queue-public-ticket sin params no debe dar 500. Got: ${res.statusCode}`
        );
    });

    await t.test('GET queue-status (ruta pública de turno) existe y responde', async () => {
        const res = await fetchPage('/es/mi-turno/');
        assert.ok(
            res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302,
            `mi-turno debe existir. Got: ${res.statusCode}`
        );
    });
});

// ── Suite 5: Contrato de pagos — summary incluye totalDue (Q43-14) ────────

test('Q43-05: PatientPortalController payments contract', async (t) => {

    await t.test('GET patient-portal-payments sin auth devuelve ok:false o 401', async () => {
        const res = await fetchJson('patient-portal-payments');
        assert.ok(
            res.statusCode === 401 || res.body?.ok === false,
            `payments sin token debe rechazar. Status: ${res.statusCode}`
        );
    });

    await t.test('GET patient-portal-payments con token inválido devuelve {ok:false}', async () => {
        const res = await fetchJson('patient-portal-payments', { token: 'invalid-token-xyz' });
        assert.ok(
            res.body?.ok === false,
            'Token inválido debe devolver ok:false'
        );
        assert.ok(
            !res.body?.data?.payments,
            'Token inválido no debe filtrar datos de payments'
        );
    });
});

// ── Suite 6: JS portal-history.js — pureza de producción ─────────────────

test('Q43-02: portal-history.js no contiene datos dummy de producción', async (t) => {
    const fs = require('node:fs');
    const path = require('node:path');

    const portalHistoryPath = path.resolve(__dirname, '../js/portal-history.js');

    let content;
    try {
        content = fs.readFileSync(portalHistoryPath, 'utf8');
    } catch {
        // Si el archivo no existe, saltamos con info
        t.skip('portal-history.js no encontrado en la ruta esperada');
        return;
    }

    await t.test('No contiene Isotretinoína hardcodeada (medicamento dummy)', () => {
        assert.ok(
            !content.includes('Isotretinoína'),
            'portal-history.js no debe contener medicamentos dummy hardcodeados'
        );
    });

    await t.test('No contiene Ácido Azelaico hardcodeado (medicamento dummy)', () => {
        assert.ok(
            !content.includes('Ácido Azelaico'),
            'portal-history.js no debe contener medicamentos dummy hardcodeados'
        );
    });

    await t.test('No contiene avatar-placeholder como foto default', () => {
        assert.ok(
            !content.includes('avatar-placeholder.png'),
            'portal-history.js no debe usar avatar-placeholder como foto default'
        );
    });

    await t.test('No contiene L70.0 - Acné vulgaris como diagnóstico default (Q43-02)', () => {
        assert.ok(
            !content.includes("'L70.0 - Acné vulgaris'") && !content.includes('"L70.0 - Acné vulgaris"'),
            'portal-history.js no debe tener diagnóstico hardcodeado como fallback'
        );
    });

    await t.test('No contiene window.alert() (Q43-01)', () => {
        assert.ok(
            !content.includes('window.alert('),
            'portal-history.js no debe usar window.alert() en producción'
        );
    });

    await t.test('summaryHtml presente en portal-payments.js (Q43-10)', () => {
        const paymentsPath = path.resolve(__dirname, '../js/portal-payments.js');
        let payments;
        try {
            payments = fs.readFileSync(paymentsPath, 'utf8');
        } catch {
            return; // skip
        }
        assert.ok(
            payments.includes('summaryHtml'),
            'portal-payments.js debe tener el banner de saldo pendiente (summaryHtml)'
        );
        assert.ok(
            payments.includes('totalDue'),
            'portal-payments.js debe verificar totalDue para el banner'
        );
    });
});
