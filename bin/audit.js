#!/usr/bin/env node
/**
 * bin/audit.js — gov:audit  Sistema de salud completo en 1 comando
 *
 * Ejecuta todos los checks de gobernanza en secuencia y devuelve
 * un scorecard con semáforos. Los agentes deben correr esto al inicio
 * de su sesión para saber si el sistema está sano antes de trabajar.
 *
 * Uso:
 *   node bin/audit.js           ← scorecard completo
 *   npm run gov:audit           ← alias
 *   node bin/audit.js --json    ← JSON para CI/alertas
 *   node bin/audit.js --fix     ← intenta auto-fix donde sea posible
 *
 * Exit codes:
 *   0 = todo verde o solo warnings
 *   1 = al menos 1 check RED (requiere atención antes de trabajar)
 */

const { execSync } = require('child_process');
const { existsSync, readdirSync, readFileSync } = require('fs');
const { resolve, join } = require('path');

const ROOT       = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks');

const asJson = process.argv.includes('--json');
const fix    = process.argv.includes('--fix');
const t0     = Date.now();

function run(cmd, opts = {}) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim(); }
  catch (e) { return e.stdout?.trim() || e.message || ''; }
}
function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }

// ── Checks ────────────────────────────────────────────────────────────────────

const results = [];

function emit(name, status, detail = '', fix_hint = '') {
  results.push({ name, status, detail, fix_hint });
}

// 1. Board consistency
(function checkBoard() {
  const agents = read(AGENTS_FILE);
  const done    = (agents.match(/^- \[x\] \*\*S\d+-[A-Z0-9]+\*\*/gm) || []).length;
  const pending = (agents.match(/^- \[ \] \*\*S\d+-[A-Z0-9]+\*\*/gm) || []).length;
  const total   = done + pending;

  // claim.js status
  const claimOut = run('node bin/claim.js status 2>/dev/null');
  const claimTotal = parseInt((claimOut.match(/Total:\s*(\d+)/) || [])[1] || '0');
  const claimDone  = parseInt((claimOut.match(/Done:\s*(\d+)/) || [])[1] || '0');

  const drift = Math.abs(total - claimTotal) + Math.abs(done - claimDone);
  if (drift === 0) {
    emit('Board consistency', 'green', `${done}/${total} done — AGENTS.md y claim.js coinciden`);
  } else {
    emit('Board consistency', 'red',
      `Drift detectado: AGENTS.md=${done}/${total} vs claim.js=${claimDone}/${claimTotal}`,
      'node bin/sync-backlog.js && node bin/claim.js status');
  }
})();

// 2. BACKLOG.md sync
(function checkBacklog() {
  const out = run('node bin/sync-backlog.js --check 2>/dev/null');
  if (out.includes('up to date')) {
    emit('BACKLOG.md sync', 'green', 'BACKLOG.md está al día con AGENTS.md');
  } else {
    emit('BACKLOG.md sync', 'yellow', 'BACKLOG.md desactualizado', 'node bin/sync-backlog.js');
    if (fix) run('node bin/sync-backlog.js');
  }
})();

// 3. Active claims
(function checkClaims() {
  const claims = [];
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const c = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8'));
        if (c?.expiresAt) {
          const expired = new Date(c.expiresAt) < new Date();
          claims.push({ id: f.replace('.json',''), agent: c.agent, expired });
        }
      } catch {}
    }
  } catch {}
  const active  = claims.filter(c => !c.expired);
  const expired = claims.filter(c => c.expired);
  const detail  = [
    active.length  ? `${active.length} activos: ${active.map(c=>c.id).join(', ')}` : '',
    expired.length ? `⚠️ ${expired.length} expirados sin limpiar` : '',
  ].filter(Boolean).join(' | ');

  if (expired.length > 3) {
    emit('Claims activos', 'yellow', detail, 'node bin/claim.js purge-expired');
    if (fix) run('node bin/claim.js purge-expired 2>/dev/null');
  } else {
    emit('Claims activos', 'green', detail || 'Sin claims activos');
  }
})();

// 4. Conflict scan
(function checkConflicts() {
  const out = run('node bin/conflict.js --json 2>/dev/null');
  try {
    const data = JSON.parse(out);
    const highs = (data.conflicts || []).filter(c => c.severity === 'HIGH');
    if (highs.length > 0) {
      emit('Conflict check', 'red',
        `${highs.length} conflictos HIGH: ${highs.map(c=>c.zone||c.file).join(', ')}`,
        'node bin/conflict.js para ver detalle');
    } else if ((data.conflicts || []).length > 0 || (data.warnings || []).length > 0) {
      emit('Conflict check', 'yellow',
        `${data.conflicts.length} conflictos MEDIUM, ${data.warnings.length} warnings`);
    } else {
      emit('Conflict check', 'green', 'Sin conflictos detectados');
    }
  } catch {
    emit('Conflict check', 'yellow', 'No se pudo parsear output de conflict.js');
  }
})();

// 5. PHP lint crítico
(function checkPhpLint() {
  const critical = [
    'lib/email.php',
    'controllers/OpenclawController.php',
    'controllers/CertificateController.php',
    'lib/clinical_history/ClinicalHistoryService.php',
    'lib/routes.php',
    'api.php',
  ];
  const errors = [];
  for (const file of critical) {
    if (!existsSync(resolve(ROOT, file))) continue;
    const out = run(`php -l "${resolve(ROOT, file)}" 2>&1`);
    if (!out.includes('No syntax errors')) {
      errors.push(`${file}: ${out.split('\n')[0]}`);
    }
  }
  if (errors.length > 0) {
    emit('PHP lint crítico', 'red', errors.join(' | '), 'Corregir antes de cualquier merge');
  } else {
    emit('PHP lint crítico', 'green', `${critical.length} archivos críticos — sin errores`);
  }
})();

// 6. Git state
(function checkGit() {
  const uncommitted = run('git status --short').split('\n').filter(Boolean).length;
  const ahead = (run('git status --branch --short').match(/ahead (\d+)/) || [])[1] || '0';

  if (uncommitted > 20) {
    emit('Git state', 'yellow', `${uncommitted} archivos sin commit`, 'git add -A && git commit');
  } else if (parseInt(ahead) > 5) {
    emit('Git state', 'yellow', `${ahead} commits sin push`, 'git push origin main');
  } else {
    emit('Git state', 'green', `${uncommitted} sin commit | ${ahead} sin push`);
  }
})();

// 7. Sprint velocity
(function checkVelocity() {
  const agents = read(AGENTS_FILE);
  const done    = (agents.match(/^- \[x\] \*\*S\d+-[A-Z0-9]+\*\*/gm) || []).length;
  const total   = done + (agents.match(/^- \[ \] \*\*S\d+-[A-Z0-9]+\*\*/gm) || []).length;
  const pct     = Math.round((done / total) * 100);

  // Commits last 24h
  const commits24h = run('git log --oneline --since="24 hours ago"').split('\n').filter(Boolean).length;

  const status = commits24h >= 10 ? 'green' : commits24h >= 3 ? 'yellow' : 'red';
  emit('Sprint velocity', status,
    `${pct}% del backlog completado (${done}/${total}) | ${commits24h} commits/24h`);
})();

// 8. Email parse (S3-55 — el blocker histórico)
(function checkEmailPhp() {
  const out = run('php -l lib/email.php 2>&1');
  if (out.includes('No syntax errors')) {
    emit('lib/email.php parse', 'green', 'S3-55 cerrado — sin parse errors');
  } else {
    emit('lib/email.php parse', 'red', out.split('\n')[0], 'Ver S3-55 en AGENTS.md');
  }
})();

// ── Output ────────────────────────────────────────────────────────────────────

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const icons = { green: '✅', yellow: '⚠️ ', red: '❌' };
const counts = { green: 0, yellow: 0, red: 0 };
results.forEach(r => counts[r.status]++);

if (asJson) {
  console.log(JSON.stringify({ results, counts, elapsed_s: parseFloat(elapsed) }, null, 2));
  process.exit(counts.red > 0 ? 1 : 0);
}

const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil', hour12: false });
console.log(`\n🩺 Aurora Derm — System Health Audit`);
console.log(`   ${now} | ${elapsed}s\n`);

results.forEach(r => {
  const icon = icons[r.status];
  console.log(`  ${icon} ${r.name}`);
  if (r.detail) console.log(`     ${r.detail}`);
  if (r.fix_hint && r.status !== 'green') console.log(`     → ${r.fix_hint}`);
});

console.log(`\n  ${counts.green} ✅  ${counts.yellow} ⚠️   ${counts.red} ❌\n`);

if (counts.red === 0 && counts.yellow === 0) {
  console.log(`  🚀 Todo verde — sistema listo para trabajar.\n`);
} else if (counts.red > 0) {
  console.log(`  🚨 Sistema degradado — resolver los rojos antes de continuar.\n`);
} else {
  console.log(`  🔧 Sistema operativo con warnings. Puedes trabajar, pero revisa los amarillos.\n`);
}

process.exit(counts.red > 0 ? 1 : 0);
