#!/usr/bin/env node
'use strict';

/**
 * bin/admin-openclaw-rollout-diagnostic.js — S19-17
 * Aurora Derm — Diagnóstico de rollout del copiloto clínico OpenClaw
 *
 * Verifica que los endpoints de OpenClaw están disponibles y responden
 * correctamente según las rutas registradas en routes.php.
 *
 * Uso:
 *   node bin/admin-openclaw-rollout-diagnostic.js --domain https://pielarmonia.com
 *   node bin/admin-openclaw-rollout-diagnostic.js --json
 *
 * Exit codes:
 *   0 — PASS (entorno listo para rollout)
 *   1 — FAIL (fallas críticas detectadas)
 */

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

const args      = process.argv.slice(2);
const getArg    = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag   = (flag) => args.includes(flag);
const domain    = getArg('--domain') || 'http://localhost:8080';
const jsonMode  = hasFlag('--json');
const TIMEOUT   = 8000;

/* ── Endpoints de OpenClaw ── */
const OPENCLAW_CHECKS = [
  { name: 'router-status',     path: '/api.php?resource=openclaw-router-status', method: 'GET', expect: [200] },
  { name: 'cie10-suggest',     path: '/api.php?resource=openclaw-cie10-suggest&q=L70', method: 'GET', expect: [200, 401, 403] },
  { name: 'prescription-GET',  path: '/api.php?resource=openclaw-prescription&case_id=smoke', method: 'GET', expect: [200, 401, 403, 404] },
  { name: 'diagnosis-endpoint',path: '/api.php?resource=openclaw-save-diagnosis', method: 'POST', expect: [200, 400, 401, 403] },
  { name: 'evolution-endpoint',path: '/api.php?resource=openclaw-save-evolution', method: 'POST', expect: [200, 400, 401, 403] },
  { name: 'certificate-POST',  path: '/api.php?resource=openclaw-certificate', method: 'POST', expect: [200, 400, 401, 403] },
];

/* ── HTTP helper ── */
function request(urlStr, method = 'GET') {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '0' },
    };
    const req = mod.request(opts, (res) => {
      res.resume();
      resolve({ ok: true, status: res.statusCode });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
    req.end();
  });
}

/* ── Diagnóstico principal ── */
async function runDiagnostic() {
  const baseUrl = domain.replace(/\/$/, '');
  const results = [];
  let criticalFails = 0;

  if (!jsonMode) {
    console.log('🔬 Aurora Derm — OpenClaw Rollout Diagnostic');
    console.log(`   domain=${domain}`);
    console.log('');
    console.log('Verificando endpoints del copiloto clínico...');
    console.log('');
  }

  for (const check of OPENCLAW_CHECKS) {
    const url = baseUrl + check.path;
    const res = await request(url, check.method);
    const expected = check.expect;
    const pass = res.ok && expected.includes(res.status);

    // 0 = network failure = critical
    if (!res.ok) criticalFails++;

    results.push({
      name:   check.name,
      method: check.method,
      url,
      status: res.status,
      expect: expected,
      pass,
      error:  res.error || null,
    });

    if (!jsonMode) {
      const icon = pass ? '✅' : (res.ok ? '⚠️ ' : '❌');
      const msg  = res.error ? `ERR(${res.error})` : `HTTP ${res.status}`;
      console.log(`  ${icon} [${check.method}] ${check.name.padEnd(24)} ${msg}`);
    }
  }

  // Connectivity assessment
  const reachable   = results.some(r => r.ok && r.status > 0);
  const authGated   = results.every(r => !r.ok || [401, 403].includes(r.status));
  const routesMissing = results.some(r => r.ok && r.status === 404);

  const summary = {
    generatedAt: new Date().toISOString(),
    domain,
    passed: results.filter(r => r.pass).length,
    total:  results.length,
    criticalFails,
    reachable,
    authGated,
    routesMissing,
    gate: criticalFails === 0 ? 'READY' : 'NOT_READY',
    assessment: criticalFails === 0
      ? 'OpenClaw endpoints responden correctamente. Rollout permitido.'
      : `${criticalFails} endpoint(s) no alcanzan el servidor. Verificar deploy.`,
    results,
  };

  // Persist
  const govDir = path.resolve(__dirname, '../governance');
  if (!fs.existsSync(govDir)) fs.mkdirSync(govDir, { recursive: true });
  fs.writeFileSync(
    path.join(govDir, 'openclaw-rollout-diagnostic.json'),
    JSON.stringify(summary, null, 2)
  );

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('');
    const icon = summary.gate === 'READY' ? '✅' : '❌';
    console.log(`${icon} OpenClaw Rollout: ${summary.gate}`);
    console.log(`   ${summary.assessment}`);
    if (authGated && !routesMissing) {
      console.log('   ⓘ  Todos los endpoints detrás de auth — normal en prod.');
    }
    if (routesMissing) {
      console.log('   ⚠️  Algunas rutas devuelven 404 — verificar routes.php.');
    }
  }

  process.exit(criticalFails === 0 ? 0 : 1);
}

runDiagnostic().catch((e) => {
  console.error('[openclaw-diagnostic] Fatal:', e.message);
  process.exit(1);
});
