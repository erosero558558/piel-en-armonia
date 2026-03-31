#!/usr/bin/env node
'use strict';

/**
 * bin/resolve-turnero-release-plan.js — S15-03
 * Aurora Derm — Turnero Release Plan Resolver
 *
 * Genera un plan de release del turnero, checando el estado de las
 * superficies (admin, operador, kiosco, sala) contra el manifest actual.
 *
 * Uso:
 *   node bin/resolve-turnero-release-plan.js
 *   node bin/resolve-turnero-release-plan.js --json
 *   node bin/resolve-turnero-release-plan.js --domain https://pielarmonia.com
 *
 * Salida: governance/turnero-release-plan.json
 */

const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const getArg   = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const hasFlag  = (f) => args.includes(f);
const jsonMode = hasFlag('--json');

const ROOT    = path.resolve(__dirname, '..');
const GOV_DIR = path.join(ROOT, 'governance');

/* ── Superficies del turnero ── */
const SURFACES = [
  { id: 'admin',    label: 'Consola Admin',  file: 'admin.html' },
  { id: 'operator', label: 'Operador',       file: 'queue-operator.html' },
  { id: 'kiosk',    label: 'Kiosco Paciente',file: 'queue-kiosk.html' },
  { id: 'display',  label: 'Sala / TV',      file: 'queue-display.html' },
];

/* ── Checks de scripts de turnero ── */
const TURNERO_SCRIPTS = [
  'js/queue-operator.js',
  'js/queue-kiosk.js',
  'js/queue-display.js',
];

/* ── Release manifest ── */
function readReleaseManifest() {
  const manifestPath = path.join(ROOT, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch(_) { return null; }
}

/* ── Check de surface ── */
function checkSurface(surface) {
  const filePath = path.join(ROOT, surface.file);
  const exists   = fs.existsSync(filePath);
  let   sizeKb   = 0;
  let   hasAuth  = false;

  if (exists) {
    const stat = fs.statSync(filePath);
    sizeKb = Math.round(stat.size / 1024);

    // Quick check for auth gate
    const content = fs.readFileSync(filePath, 'utf8');
    hasAuth = content.includes('require_admin_auth') ||
              content.includes('login-screen') ||
              content.includes('operator-pin') ||
              content.includes('data-admin-ready');
  }

  return {
    id:     surface.id,
    label:  surface.label,
    file:   surface.file,
    exists,
    sizeKb,
    hasAuth,
    ready:  exists && sizeKb > 5,
  };
}

/* ── Check de scripts ── */
function checkScripts() {
  return TURNERO_SCRIPTS.map(relPath => {
    const full   = path.join(ROOT, relPath);
    const exists = fs.existsSync(full);
    const sizeKb = exists ? Math.round(fs.statSync(full).size / 1024) : 0;
    return { path: relPath, exists, sizeKb };
  });
}

/* ── Plan principal ── */
function generatePlan() {
  const manifest  = readReleaseManifest();
  const surfaces  = SURFACES.map(checkSurface);
  const scripts   = checkScripts();
  const allReady  = surfaces.every(s => s.ready);

  const plan = {
    generatedAt:      new Date().toISOString(),
    releaseVersion:   manifest?.version || 'unknown',
    releaseChannel:   manifest?.channel || 'unknown',
    allSurfacesReady: allReady,
    gate:             allReady ? 'READY' : 'BLOCKED',
    surfaces,
    scripts,
    blockers:         surfaces.filter(s => !s.ready).map(s => ({
      surface: s.id,
      reason:  !s.exists ? 'file_missing' : 'file_too_small',
    })),
    recommendation:   allReady
      ? 'Todas las superficies del turnero están listas. Proceder con el release.'
      : `${surfaces.filter(s => !s.ready).length} superficie(s) no listas. Verificar build.`,
  };

  if (!fs.existsSync(GOV_DIR)) fs.mkdirSync(GOV_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(GOV_DIR, 'turnero-release-plan.json'),
    JSON.stringify(plan, null, 2)
  );

  return plan;
}

/* ── Main ── */
const plan = generatePlan();

if (jsonMode) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  const gateIcon = plan.gate === 'READY' ? '✅' : '❌';
  console.log(`🎯 Aurora Derm — Turnero Release Plan`);
  console.log(`   Release: ${plan.releaseVersion} · Canal: ${plan.releaseChannel}`);
  console.log('');
  console.log('Superficies:');
  plan.surfaces.forEach(s => {
    const icon = s.ready ? '✅' : '❌';
    console.log(`  ${icon} ${s.label.padEnd(20)} ${s.file} (${s.sizeKb} KB)${s.hasAuth ? ' [auth-gated]' : ''}`);
  });
  console.log('');
  console.log('Scripts del turnero:');
  plan.scripts.forEach(s => {
    const icon = s.exists ? '✅' : '❌';
    console.log(`  ${icon} ${s.path} (${s.sizeKb} KB)`);
  });
  console.log('');
  console.log(`${gateIcon} Gate: ${plan.gate}`);
  console.log(`   ${plan.recommendation}`);
  console.log('');
  console.log(`📄 Plan guardado en governance/turnero-release-plan.json`);
}

process.exit(plan.gate === 'READY' ? 0 : 1);
