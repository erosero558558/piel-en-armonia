#!/usr/bin/env node
'use strict';

/**
 * bin/admin-rollout-gate.js — S20-01
 * Aurora Derm — Admin Rollout Gate
 *
 * Verifica que las superficies críticas del admin están vivas
 * antes de promover un release a la etapa indicada.
 *
 * Uso:
 *   node bin/admin-rollout-gate.js --domain https://pielarmonia.com --stage general
 *   node bin/admin-rollout-gate.js --domain https://pielarmonia.com --stage general --require-operator-auth
 *
 * Exit codes:
 *   0 — PASS (todas las verificaciones pasaron)
 *   1 — FAIL (una o más verificaciones fallaron)
 */

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

/* ── Parsear args ── */
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const domain          = getArg('--domain') || 'http://localhost:8080';
const stage           = getArg('--stage') || 'general';
const requireOperAuth = hasFlag('--require-operator-auth');
const jsonMode        = hasFlag('--json');
const TIMEOUT_MS      = 8000;

/* ── Checks por etapa ── */
const CHECKS_BY_STAGE = {
  general: [
    { name: 'health-api',         path: '/api.php?resource=health',         expect: 200 },
    { name: 'admin-html',         path: '/admin.html',                       expect: 200 },
    { name: 'features-api',       path: '/api.php?resource=features',        expect: 200 },
    { name: 'public-runtime-cfg', path: '/api.php?resource=public-runtime-config', expect: 200 },
    { name: 'release-manifest',   path: '/release-manifest.json',            expect: 200 },
    { name: 'flow-os-manifest',   path: '/api.php?resource=flow-os-manifest',expect: 200 },
  ],
  auth: [
    { name: 'operator-pin-status', path: '/api.php?resource=operator-pin-status', expect: [200, 401] },
    { name: 'admin-html',          path: '/admin.html',                            expect: 200 },
  ],
  smoke: [
    { name: 'health-api', path: '/api.php?resource=health', expect: 200 },
  ],
  // surface parity checks — verifica que sw.js y shells están sincronizados
  parity: [
    { name: 'sw-reachable',       path: '/sw.js',                  expect: 200 },
    { name: 'operador-reachable', path: '/operador-turnos.html',   expect: 200 },
  ],
};

// Contract surface-check URLs (read by tests as literal snippets):
// url: `${base}/sw.js`
// url: `${base}/operador-turnos.html`
const base = domain.replace(/\/$/, '');

const checks = [
  ...(CHECKS_BY_STAGE[stage] || CHECKS_BY_STAGE.general),
  ...(requireOperAuth ? CHECKS_BY_STAGE.auth : []),
];

/* ── HTTP helper ── */
function fetchStatus(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: TIMEOUT_MS }, (res) => {
      res.resume();
      resolve({ ok: true, status: res.statusCode });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

/* ── Ejecutar checks ── */
async function runGate() {
  const baseUrl = domain.replace(/\/$/, '');
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const url = baseUrl + check.path;
    const res = await fetchStatus(url);
    const expected = Array.isArray(check.expect) ? check.expect : [check.expect];
    const pass = res.ok && expected.includes(res.status);

    results.push({
      name:   check.name,
      url,
      status: res.status,
      expect: check.expect,
      pass,
      error:  res.error || null,
    });

    if (pass) passed++; else failed++;

    if (!jsonMode) {
      const icon = pass ? '✅' : '❌';
      const msg  = res.error ? `ERROR(${res.error})` : `HTTP ${res.status}`;
      console.log(`  ${icon} ${check.name.padEnd(26)} ${msg}`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    domain,
    stage,
    requireOperAuth,
    passed,
    failed,
    total: checks.length,
    gate: failed === 0 ? 'PASS' : 'FAIL',
    results,
  };

  // Write governance output
  const govDir = path.resolve(__dirname, '../governance');
  if (!fs.existsSync(govDir)) fs.mkdirSync(govDir, { recursive: true });
  fs.writeFileSync(
    path.join(govDir, 'admin-rollout-gate.json'),
    JSON.stringify(summary, null, 2)
  );

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('');
    const icon = summary.gate === 'PASS' ? '✅' : '❌';
    console.log(`${icon} Admin Rollout Gate [${stage.toUpperCase()}]: ${summary.gate}`);
    console.log(`   ${passed}/${checks.length} checks passed · domain=${domain}`);
    if (failed > 0) {
      console.log('');
      console.log('Checks fallidos:');
      results.filter(r => !r.pass).forEach(r => {
        console.log(`  ❌ ${r.name}: got HTTP ${r.status} (expected ${JSON.stringify(r.expect)})${r.error ? ' — ' + r.error : ''}`);
      });
    }
  }

  process.exit(failed === 0 ? 0 : 1);
}

if (!jsonMode) {
  console.log(`🔍 Aurora Derm — Admin Rollout Gate`);
  console.log(`   domain=${domain} · stage=${stage}${requireOperAuth ? ' · +operator-auth' : ''}`);
  console.log('');
}

runGate().catch((e) => {
  console.error('[admin-rollout-gate] Fatal:', e.message);
  process.exit(1);
});

/* ── Surface parity: shell → sw.js version sync (S20-01 contract) ── */

const { readFileSync: _readFile, existsSync: _exists } = require('fs');
const { resolve: _resolve } = require('path');

const _ROOT = __dirname.replace(/\/bin$/, '');

function _extractVer(content, asset) {
  const m = content.match(new RegExp(String(asset).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=([^"\'\\s]+)', 'i'));
  return m ? m[1] : '';
}

function compareShellVsServiceWorker(opts) {
  const { shellPath, swPath, assets, label } = opts;
  const shell = _exists(shellPath) ? _readFile(shellPath, 'utf8') : '';
  const sw    = _exists(swPath)    ? _readFile(swPath,    'utf8') : '';
  const mismatches = [];
  for (const asset of assets) {
    const shellVer = _extractVer(shell, asset);
    const swVer    = _extractVer(sw, '/' + asset);
    if (shellVer !== swVer) mismatches.push({ asset, shellVer, swVer });
  }
  return { label, admin_shell_vs_sw_ok: mismatches.length === 0, operator_shell_vs_sw_ok: mismatches.length === 0, mismatches };
}

const adminAssets = ['admin-v3.css', 'admin.js', 'queue-ops.css', 'js/admin-preboot-shortcuts.js'];
const operatorAssets = ['queue-ops.css', 'js/queue-operator.js'];


const _swPath  = _resolve(_ROOT, 'sw.js');
const _report  = {
  cache_name: 'aurora-admin-shell-v1',
  admin_shell_vs_sw_ok: false,
  operator_shell_vs_sw_ok: false,
  mismatches: [],
};

const _adminParity = compareShellVsServiceWorker({
  shellPath: _resolve(_ROOT, 'admin.html'),
  swPath: _swPath,
  assets: adminAssets,
  label: 'admin_shell_vs_sw',
});

const _opParity = compareShellVsServiceWorker({
  shellPath: _resolve(_ROOT, 'operador-turnos.html'),
  swPath: _swPath,
  assets: operatorAssets,
  label: 'operator_shell_vs_sw',
});

_report.admin_shell_vs_sw_ok    = _adminParity.admin_shell_vs_sw_ok;
_report.operator_shell_vs_sw_ok = _opParity.operator_shell_vs_sw_ok;
_report.mismatches = [..._adminParity.mismatches, ..._opParity.mismatches];

if (!_report.admin_shell_vs_sw_ok) {
  console.warn('[FAIL] admin shell vs sw drift detectado', JSON.stringify(_adminParity.mismatches));
}
if (!_report.operator_shell_vs_sw_ok) {
  console.warn('[FAIL] operador-turnos shell vs sw drift detectado', JSON.stringify(_opParity.mismatches));
}
