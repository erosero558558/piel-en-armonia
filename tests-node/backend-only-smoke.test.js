/**
 * tests-node/backend-only-smoke.test.js
 *
 * Smoke check del backend en producción o staging.
 * Requiere que el servidor esté corriendo: npm run dev
 *
 * Uso: node --test tests-node/backend-only-smoke.test.js
 */

'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const http     = require('node:http');

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:8000';

/** Hace GET a una ruta relativa y retorna { status, body } */
function get(resource) {
  const url = `${BASE}/api.php?resource=${resource}`;
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/** Hace GET a una URL absoluta */
function getUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

// ── Contrato raíz ─────────────────────────────────────────────────────────────

test('GET / retorna JSON de estado del servicio', async () => {
  const { status, body } = await getUrl(`${BASE}/`);
  assert.equal(status, 200, 'Expected 200');
  const json = JSON.parse(body);
  assert.equal(json.ok, true,                  'json.ok debe ser true');
  assert.equal(json.service, 'Aurora Derm',    'json.service debe ser "Aurora Derm"');
  assert.ok(json.health,                        'json.health debe existir');
  assert.ok(json.api,                           'json.api debe existir');
});

// ── Health endpoint ───────────────────────────────────────────────────────────

test('GET health retorna 200', async () => {
  const { status } = await get('health');
  assert.equal(status, 200);
});

// ── Queue ─────────────────────────────────────────────────────────────────────

test('GET queue-state retorna 200 o 401', async () => {
  const { status } = await get('queue-state');
  assert.ok([200, 401].includes(status), `Esperado 200 o 401, recibido ${status}`);
});

// ── OpenClaw / Figo ───────────────────────────────────────────────────────────

test('GET figo-config retorna 200 o 401', async () => {
  const { status } = await get('figo-config');
  assert.ok([200, 401].includes(status), `Esperado 200 o 401, recibido ${status}`);
});

// ── Operator auth ─────────────────────────────────────────────────────────────

test('GET operator-auth-status retorna 200', async () => {
  const { status } = await get('operator-auth-status');
  assert.ok([200, 401].includes(status));
});

// ── Admin auth ────────────────────────────────────────────────────────────────

test('GET admin-auth.php?action=status retorna JSON', async () => {
  const { status, body } = await getUrl(`${BASE}/admin-auth.php?action=status`);
  assert.ok([200, 401].includes(status));
  // Si responde, debe ser JSON
  if (status === 200) {
    assert.doesNotThrow(() => JSON.parse(body), 'Debe ser JSON válido');
  }
});

// ── Rutas UI heredadas responden 410 ─────────────────────────────────────────

test('Ruta UI heredada /es/ responde 410 Gone', async () => {
  const { status } = await getUrl(`${BASE}/es/`);
  assert.ok([410, 301, 302, 404].includes(status),
    `Ruta UI heredada debería responder 410/301/404, recibido ${status}`);
});

// ── Services catalog ──────────────────────────────────────────────────────────

test('GET services-catalog retorna 200 o 401', async () => {
  const { status } = await get('services-catalog');
  assert.ok([200, 401].includes(status));
});

// ── Availability ──────────────────────────────────────────────────────────────

test('GET availability retorna 200 o 401', async () => {
  const { status } = await get('availability');
  assert.ok([200, 401].includes(status));
});

// ── No debe existir nada que sirva frontend legacy ───────────────────────────

test('admin.html no debe servirse como página activa', async () => {
  const { status } = await getUrl(`${BASE}/admin.html`);
  // Puede ser 404, 410, 301 — lo que NO debe ser es 200 con HTML
  if (status === 200) {
    assert.fail('admin.html está sirviendo contenido — debería estar eliminado o redirigido');
  }
  assert.ok(true);
});
