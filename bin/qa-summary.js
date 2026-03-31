#!/usr/bin/env node
'use strict';

/**
 * bin/qa-summary.js — S20-05
 * Aurora Derm — Semáforo unificado de QA
 *
 * Combina en una sola vista:
 *   1. gov:audit (governance checks)
 *   2. verify-scripts (broken bin refs)
 *   3. turnero release plan
 *   4. admin rollout gate (si hay domain)
 *   5. evidence health
 *   6. backlog snapshot
 *
 * Uso:
 *   node bin/qa-summary.js
 *   node bin/qa-summary.js --json
 *   node bin/qa-summary.js --domain https://pielarmonia.com
 *
 * Exit code:
 *   0 — Todos los checks críticos pasaron
 *   1 — Uno o más checks críticos fallaron
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const args      = process.argv.slice(2);
const hasFlag   = (f) => args.includes(f);
const getArg    = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const jsonMode  = hasFlag('--json');
const domain    = getArg('--domain');
const ROOT      = path.resolve(__dirname, '..');
const GOV_DIR   = path.join(ROOT, 'governance');

const NOW = new Date().toISOString();

/* ── Color helpers (no deps) ── */
const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  reset:  (s) => `\x1b[0m${s}\x1b[0m`,
};

/* ── Run a node script safely ── */
function run(script, extraArgs = [], timeout = 15000) {
  const result = spawnSync('node', [script, ...extraArgs], {
    cwd: ROOT,
    timeout,
    encoding: 'utf8',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    timedOut: result.status === null,
  };
}

/* ── Individual checks ── */

function checkVerifyScripts() {
  const r = run('bin/verify-scripts.js');
  const broken = r.stdout.match(/(\d+) scripts? con referencias/)?.[1];
  const count  = broken ? parseInt(broken, 10) : 0;
  return {
    name:        'verify-scripts',
    label:       'Scripts sin referencias rotas',
    pass:        r.exitCode === 0,
    critical:    true,
    detail:      r.exitCode === 0 ? '0 referencias rotas' : `${count} referencia(s) rota(s)`,
    raw:         r.stdout,
  };
}

function checkGovAudit() {
  // Use gov:audit:json which runs governance-specific checks (10 steps)
  const { spawnSync: sp } = require('child_process');
  const r = sp('npm', ['run', 'gov:audit:json', '--silent'], {
    cwd: ROOT, timeout: 20000, encoding: 'utf8',
  });
  const stdout = (r.stdout || '').trim();
  if (stdout) {
    try {
      // The JSON may be truncated due to long verificable regex strings — extract header
      // Find the first closing of the top-level keys before the first step
      const headerMatch = stdout.match(/\{[\s\S]*?"failedCount"\s*:\s*(\d+)[\s\S]*?"passedCount"\s*:\s*(\d+)[\s\S]*?"stepCount"\s*:\s*(\d+)/);
      const headerMatch2 = stdout.match(/\{[\s\S]*?"passedCount"\s*:\s*(\d+)[\s\S]*?"failedCount"\s*:\s*(\d+)[\s\S]*?"stepCount"\s*:\s*(\d+)/);
      const okMatch = stdout.match(/"ok"\s*:\s*(true|false)/);
      if (headerMatch || headerMatch2 || okMatch) {
        const failed  = headerMatch ? parseInt(headerMatch[1]) : (headerMatch2 ? parseInt(headerMatch2[2]) : 0);
        const passing = headerMatch ? parseInt(headerMatch[2]) : (headerMatch2 ? parseInt(headerMatch2[1]) : 0);
        const total   = headerMatch ? parseInt(headerMatch[3]) : (headerMatch2 ? parseInt(headerMatch2[3]) : 0);
        const ok      = okMatch ? okMatch[1] === 'true' : failed === 0;
        return {
          name:     'gov-audit',
          label:    'Governance audit',
          pass:     ok && failed === 0,
          critical: true,
          detail:   total > 0 ? `${passing}/${total} gov checks` : (ok ? 'PASS' : 'FAIL'),
        };
      }
    } catch (_) {}
  }
  // Fallback: derive from exit code
  return {
    name:     'gov-audit',
    label:    'Governance audit',
    pass:     r.status === 0,
    critical: true,
    detail:   r.status === 0 ? 'PASS' : 'FAIL (ver npm run gov:audit:json)',
  };
}

function checkTurneroReleasePlan() {
  const r = run('bin/resolve-turnero-release-plan.js');
  const pass = r.exitCode === 0;
  const match = r.stdout.match(/Gate:\s*(READY|BLOCKED)/);
  return {
    name:     'turnero-release-plan',
    label:    'Turnero surfaces listas',
    pass,
    critical: false,
    detail:   match ? match[1] : (pass ? 'READY' : 'BLOCKED'),
  };
}

function checkBrokenScripts() {
  // Re-run verify-scripts for a fresh count
  const r = run('bin/verify-scripts.js');
  const match = (r.stdout + r.stderr).match(/(\d+) scripts? con referencias/);
  const count = match ? parseInt(match[1], 10) : 0;
  return {
    name:     'broken-scripts-report',
    label:    'Script refs rotas (gov)',
    pass:     r.exitCode === 0 && count === 0,
    critical: false,
    detail:   r.exitCode === 0 ? '0 referencias rotas' : `${count} referencia(s) rota(s)`,
  };
}

function checkBacklog() {
  const backlogPath = path.join(ROOT, 'BACKLOG.md');
  if (!fs.existsSync(backlogPath)) {
    return { name: 'backlog', label: 'Backlog snapshot', pass: false, critical: false, detail: 'BACKLOG.md no existe' };
  }
  const content  = fs.readFileSync(backlogPath, 'utf8');
  const match    = content.match(/(\d+)\/(\d+)\s+done/i) || content.match(/\*\*(\d+)\/(\d+)\*\*/);
  const done     = match ? parseInt(match[1], 10) : null;
  const total    = match ? parseInt(match[2], 10) : null;
  const pct      = done && total ? Math.round((done / total) * 100) : null;
  return {
    name:     'backlog',
    label:    'Backlog progress',
    pass:     pct !== null && pct >= 50,
    critical: false,
    detail:   pct !== null ? `${done}/${total} (${pct}%)` : 'Sin datos de progreso',
  };
}

function checkAdminRolloutGate(domain) {
  if (!domain) return null;
  const r = run('bin/admin-rollout-gate.js', ['--domain', domain, '--stage', 'general']);
  const pass = r.exitCode === 0;
  const match = r.stdout.match(/(PASS|FAIL)/);
  return {
    name:     'admin-rollout-gate',
    label:    `Admin Rollout Gate (${domain})`,
    pass,
    critical: false,
    detail:   match ? match[1] : (pass ? 'PASS' : 'FAIL'),
  };
}

function checkEvidenceHealth() {
  const jsonPath = path.join(GOV_DIR, 'evidence-health.json');
  const r = run('bin/check-evidence-health.js');
  if (fs.existsSync(jsonPath)) {
    try {
      const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const reconstructed = d.counts?.reconstructed_evidence ?? 0;
      return {
        name:     'evidence-health',
        label:    'Evidencia reconstruida',
        pass:     reconstructed <= 10,
        critical: false,
        detail:   `${reconstructed} reconstruidas (umbral: ≤10)`,
      };
    } catch(_) {}
  }
  return {
    name:     'evidence-health',
    label:    'Evidencia reconstruida',
    pass:     r.exitCode === 0,
    critical: false,
    detail:   r.exitCode === 0 ? 'OK' : 'Error en check',
  };
}

/* ── Main ── */
async function main() {
  if (!jsonMode) {
    console.log(C.bold('\n🎯 Aurora Derm — QA Summary'));
    console.log(C.dim(`   ${NOW}`));
    console.log('');
  }

  const checks = [
    checkVerifyScripts(),
    checkGovAudit(),
    checkBrokenScripts(),
    checkTurneroReleasePlan(),
    checkBacklog(),
    checkEvidenceHealth(),
  ];

  // Optional: admin rollout gate (requires domain)
  const gateCheck = checkAdminRolloutGate(domain);
  if (gateCheck) checks.push(gateCheck);

  // Compute totals
  const criticals   = checks.filter(c => c.critical);
  const nonCritical = checks.filter(c => !c.critical);
  const critFailed  = criticals.filter(c => !c.pass).length;
  const allPassed   = checks.every(c => c.pass);
  const gate        = critFailed === 0 ? 'GREEN' : 'RED';

  // Display
  if (!jsonMode) {
    console.log(C.bold('  CHECKS CRÍTICOS'));
    criticals.forEach(c => {
      const icon = c.pass ? C.green('✅') : C.red('❌');
      console.log(`  ${icon} ${c.label.padEnd(36)} ${c.pass ? C.dim(c.detail) : C.red(c.detail)}`);
    });

    console.log('');
    console.log(C.bold('  CHECKS INFORMATIVOS'));
    nonCritical.forEach(c => {
      const icon = c.pass ? C.green('✅') : C.yellow('⚠️ ');
      console.log(`  ${icon} ${c.label.padEnd(36)} ${C.dim(c.detail)}`);
    });

    console.log('');
    console.log('─'.repeat(60));

    const gateColor = gate === 'GREEN' ? C.green : C.red;
    const gateIcon  = gate === 'GREEN' ? '🟢' : '🔴';
    console.log(`  ${gateIcon}  QA GATE: ${gateColor(C.bold(gate))}`);

    if (critFailed > 0) {
      console.log('');
      console.log(C.red(`  ${critFailed} check(s) crítico(s) fallaron. Corregir antes del release.`));
      const failed = criticals.filter(c => !c.pass);
      failed.forEach(c => console.log(C.red(`     → ${c.name}: ${c.detail}`)));
    } else {
      console.log(C.green(`  Todos los checks críticos pasaron. Sistema listo para operar.`));
    }
    console.log('');
  }

  // Write governance output
  const summary = {
    generatedAt: NOW,
    gate,
    criticalsFailed: critFailed,
    allPassed,
    checks,
  };

  if (!fs.existsSync(GOV_DIR)) fs.mkdirSync(GOV_DIR, { recursive: true });
  fs.writeFileSync(path.join(GOV_DIR, 'qa-summary.json'), JSON.stringify(summary, null, 2));

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(C.dim(`  📄 Reporte: governance/qa-summary.json`));
    console.log('');
  }

  process.exit(critFailed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('[qa-summary] Fatal:', e.message);
  process.exit(1);
});
