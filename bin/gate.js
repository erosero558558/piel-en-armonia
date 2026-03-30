#!/usr/bin/env node
/**
 * bin/gate.js — Validación de calidad antes de marcar una tarea como done
 *
 * Un agente DEBE pasar este gate antes de:
 *   1. Marcar [x] en AGENTS.md
 *   2. Hacer el commit de cierre
 *
 * Uso:
 *   node bin/gate.js S2-18        ← valida la tarea S2-18
 *   node bin/gate.js S2-18 --fix  ← intenta corregir problemas automáticamente
 *
 * Exit code:
 *   0 = PASS (ok para marcar done)
 *   1 = FAIL (no marcar done todavía)
 */

const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { createTaskCheckDefinitions } = require('./lib/gate-checks');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

function syncBacklog() {
  try {
    execSync('node bin/sync-backlog.js', { cwd: ROOT, stdio: 'pipe' });
  } catch { /* non-fatal */ }
}

const taskId = process.argv[2];
const fix = process.argv.includes('--fix');

if (!taskId || !taskId.match(/^(S\d+|UI\d*)-[A-Z0-9]+$/)) {
  console.error('Usage: node bin/gate.js <TASK-ID> [--fix]');
  console.error('Example: node bin/gate.js S3-19');
  console.error('Example: node bin/gate.js S3-OC3');
  console.error('Example: node bin/gate.js UI2-17');
  process.exit(1);
}

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }
function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch (e) { return ''; }
}
function fileExists(p) { return existsSync(resolve(ROOT, p)); }

const agentsMd = read(AGENTS_FILE);

// Find the task in AGENTS.md
function getTask(id) {
  const lines = agentsMd.split('\n');
  for (const line of lines) {
    const m = line.match(new RegExp(`- \\[([ x])\\] \\*\\*${id}\\*\\*(.+)`));
    if (m) return { done: m[1] === 'x', description: m[2], line };
  }
  return null;
}

const task = getTask(taskId);
if (!task) {
  console.error(`❌ Task ${taskId} not found in AGENTS.md`);
  process.exit(1);
}

console.log(`\n🔍 Gate check: ${taskId}`);
console.log(`   ${task.line.replace(/^- \[.\] /, '').slice(0, 100)}\n`);

const checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, fn, { warn = false, required = true } = {}) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      checks.push({ status: 'pass', name });
      passed++;
    } else if (result && typeof result === 'object' && !Array.isArray(result)) {
      const isPass = result.ok === true || result.status === 'pass';
      const detail = typeof result.detail === 'string' ? result.detail : '';
      if (isPass) {
        checks.push({ status: 'pass', name, detail });
        passed++;
      } else if (warn) {
        checks.push({ status: 'warn', name, detail: detail || 'Warning' });
        warnings++;
      } else {
        checks.push({ status: 'fail', name, detail: detail || (required ? 'Required' : 'Recommended') });
        if (required) failed++;
        else warnings++;
      }
    } else if (result === false) {
      if (warn) {
        checks.push({ status: 'warn', name, detail: 'Warning' });
        warnings++;
      } else {
        checks.push({ status: 'fail', name, detail: required ? 'Required' : 'Recommended' });
        if (required) failed++;
        else warnings++;
      }
    } else if (typeof result === 'string') {
      checks.push({ status: warn ? 'warn' : 'fail', name, detail: result });
      if (!warn && required) failed++;
      else warnings++;
    }
  } catch (e) {
    checks.push({ status: 'fail', name, detail: e.message.slice(0, 60) });
    if (required) failed++;
  }
}

// ── Universal checks (apply to ALL tasks) ─────────────────────────────────────

check('Git working tree is clean', () => {
  const status = run('git status --short');
  if (status) return `Uncommitted changes: ${status.split('\n').length} files. Commit or stash first.`;
  return true;
}, { warn: true });

check('Task has no active [HUMAN] flag', () => {
  if (task.line.includes('[HUMAN]')) {
    return 'Task is tagged [HUMAN] — check BLOCKERS.md for required owner input';
  }
  return true;
});

check('No prohibited vocabulary in changed HTML files', () => {
  const changedHtml = run('git diff --name-only HEAD').split('\n')
    .filter(f => f.endsWith('.html'));
  const prohibited = ['oferta especial', 'haz clic', '¡aprovecha', 'precio especial'];
  for (const file of changedHtml) {
    const content = read(resolve(ROOT, file)).toLowerCase();
    for (const word of prohibited) {
      if (content.includes(word)) return `Prohibited word "${word}" in ${file}`;
    }
  }
  return true;
}, { warn: true });

check('No hardcoded hex colors in changed CSS/HTML', () => {
  const changed = run('git diff --name-only HEAD').split('\n')
    .filter(f => f.endsWith('.css') || f.endsWith('.html'));
  for (const file of changed) {
    const content = read(resolve(ROOT, file));
    // Check for hardcoded hex colors that aren't in CSS variable definitions
    const hardcoded = content.match(/(color|background):\s*#[0-9a-fA-F]{3,6}(?!\s*;?\s*\/\*)/g);
    if (hardcoded && hardcoded.length > 0) {
      return `Hardcoded colors in ${file}: ${hardcoded.slice(0, 2).join(', ')}. Use CSS variables from styles/main-aurora.css`;
    }
  }
  return true;
}, { warn: true });

check('PHP Syntax Check (php -l)', () => {
  const changed = run('git diff --name-only HEAD').split('\n')
    .filter(f => f.endsWith('.php'));
  for (const file of changed) {
    if (fileExists(file)) {
      try {
        const output = run(`php -l "${resolve(ROOT, file)}"`);
        if (!output.includes('No syntax errors detected')) {
          return `Parse error in ${file}: ${output}`;
        }
      } catch (err) {
        return `Parse error in ${file}`;
      }
    }
  }
  return true;
});

check('PHPUnit Smoke Baseline', () => {
  const changed = run('git diff --name-only HEAD').split('\n')
    .filter(f => f.endsWith('.php'));
  if (changed.length > 0) {
    try {
      run('php vendor/bin/phpunit --testsuite Smoke --stop-on-failure --no-coverage');
    } catch (err) {
      return 'Smoke tests failed. Run `php vendor/bin/phpunit --testsuite Smoke` for details.';
    }
  }
  return true;
});

// ── Task-specific checks ───────────────────────────────────────────────────────

const taskChecks = createTaskCheckDefinitions({ ROOT, read, fileExists, execSync });

// Run task-specific check if it exists
if (taskChecks[taskId]) {
  taskChecks[taskId].forEach(({ name, evaluate, warn = false, required = true }) => {
    check(name, evaluate, { warn, required });
  });
} else {
  checks.push({ status: 'warn', name: `No specific check for ${taskId} — manual review recommended` });
  warnings++;
}

// ── Results ───────────────────────────────────────────────────────────────────

const icons = { pass: '✅', fail: '❌', warn: '⚠️ ' };
checks.forEach(c => {
  const detail = c.detail ? ` — ${c.detail}` : '';
  console.log(`   ${icons[c.status]} ${c.name}${detail}`);
});

console.log(`\n   ${passed} passed, ${warnings} warnings, ${failed} failed`);

if (failed === 0) {
  console.log(`\n✅ GATE PASSED — ${taskId} is ready to mark [x]\n`);
  console.log(`╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  PASOS OBLIGATORIOS — HACERLOS EN ORDEN                     ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log();
  console.log(`  1. Liberar el claim:`);
  console.log(`     node bin/claim.js release ${taskId}`);
  console.log();
  console.log(`  2. Marcar [x] en AGENTS.md:`);
  console.log(`     (editar manualmente la línea de ${taskId} en AGENTS.md)`);
  console.log(`     O ejecutar: sed -i '' 's/^- \\[ \\] \\*\\*${taskId}\\*\\*/- [x] **${taskId}**/' AGENTS.md`);
  console.log();
  console.log(`  3. Commit + PUSH A ORIGIN MAIN (⚠️ SIN ESTO NADIE VE TU TRABAJO):`);
  console.log(`     git add .`);
  console.log(`     HUSKY=0 git commit --no-verify -m "feat(${taskId}): descripción de lo que hiciste"`);
  console.log(`     git push origin main`);
  console.log();
  console.log(`  4. Verificar que llegó:`);
  console.log(`     git log origin/main -1 --oneline`);
  console.log();
  console.log(`⚠️  git push origin main ES OBLIGATORIO.`);
  console.log(`   Si no haces push, tu trabajo no existe para nadie más.`);
  console.log(`   El director usa 'npm run merge-ready' para ver ramas listas.\n`);
  // Auto-sync BACKLOG.md silently so it's always current
  syncBacklog();

  process.exit(0);
} else {
  console.log(`\n❌ GATE FAILED — Fix the issues above before marking ${taskId} as done\n`);
  console.log(`   No hagas push hasta que todos los checks pasen.\n`);
  process.exit(1);
}
