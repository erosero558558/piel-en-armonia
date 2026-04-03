#!/usr/bin/env node
/**
 * bin/prune.js — Aurora Derm dead-code detector & remover
 *
 * Uso:
 *   node bin/prune.js                → reporte completo (dry-run)
 *   node bin/prune.js --delete       → borra + auto-commit
 *   node bin/prune.js --only=agents  → solo patrones de agentes
 *   node bin/prune.js --only=ctrl    → solo controllers huérfanos
 *   node bin/prune.js --only=lib     → solo lib sin referencias
 *   node bin/prune.js --only=tests   → solo tests de código eliminado
 *   node bin/prune.js --only=junk    → logs, .ps1, .txt, output files
 *   node bin/prune.js --only=versions → dirs/archivos con versión acumulada
 *   node bin/prune.js --only=subprojects → sub-proyectos embebidos
 *   node bin/prune.js --only=docs    → docs de coordinación de agentes
 *   node bin/prune.js --only=wrongtype → JS en lib/, PHP en src/
 */

'use strict';

const { execSync }  = require('child_process');
const fs            = require('fs');
const path          = require('path');

const ROOT  = path.resolve(__dirname, '..');
const DRY   = !process.argv.includes('--delete');
const ONLY  = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '') || 'all';

// ── colores ──────────────────────────────────────────────────────────────────
const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  gray:   s => `\x1b[90m${s}\x1b[0m`,
};

// ── helpers ───────────────────────────────────────────────────────────────────
const abs   = p => path.join(ROOT, p);
const read  = p => { try { return fs.readFileSync(abs(p), 'utf8'); } catch { return ''; } };
const exist = p => fs.existsSync(abs(p));

function walk(dir, ext, maxDepth, _depth) {
  if (maxDepth === undefined) maxDepth = 4;
  if (_depth === undefined) _depth = 0;
  const full = abs(dir);
  if (!fs.existsSync(full)) return [];
  const skip = ['node_modules', '.git', 'vendor', '.generated'];
  const results = [];
  for (const entry of fs.readdirSync(full)) {
    if (skip.includes(entry)) continue;
    const rel  = path.join(dir, entry);
    const stat = fs.statSync(abs(rel));
    if (stat.isDirectory()) {
      if (_depth < maxDepth) results.push(...walk(rel, ext, maxDepth, _depth + 1));
    } else if (!ext || entry.endsWith(ext)) {
      results.push(rel);
    }
  }
  return results;
}

function gitRm(file) {
  try { execSync(`git rm -r --cached "${abs(file)}" 2>/dev/null`, { stdio: 'pipe' }); } catch {}
  const p = abs(file);
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) { fs.rmSync(p, { recursive: true, force: true }); }
  else { fs.unlinkSync(p); }
}

function section(title) {
  const pad = Math.max(0, 52 - title.length);
  console.log('\n' + C.bold(C.cyan(`── ${title} ${'─'.repeat(pad)}`)));
}

function report(label, items, fmt) {
  if (!fmt) fmt = function(x) { return { file: x, note: '' }; };
  section(label);
  if (!items.length) { console.log(C.green('  ✓ Ninguno')); return []; }
  const toDelete = [];
  for (const item of items) {
    const r = fmt(item);
    const noteStr = r.note   ? C.gray(` ← ${r.note}`)     : '';
    const reaStr  = r.reason ? C.dim(` [${r.reason}]`)    : '';
    console.log(`  ${C.red('✗')} ${r.file}${noteStr}${reaStr}`);
    toDelete.push(r.file);
  }
  console.log(C.yellow(`\n  ${items.length} detectado(s)`));
  return toDelete;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 1 — Controllers sin rutas activas
// ════════════════════════════════════════════════════════════════════════════
function checkOrphanControllers() {
  const routes   = read('lib/routes.php');
  const inRoutes = new Set();
  let m;
  const re = /([A-Za-z]+(?:Controller|Facade))::/g;
  while ((m = re.exec(routes)) !== null) inRoutes.add(m[1]);
  return walk('controllers', '.php')
    .map(f => ({ file: f, cls: path.basename(f, '.php') }))
    .filter(function(x) { return !inRoutes.has(x.cls); });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 2 — Clases lib/ sin ninguna referencia
// ════════════════════════════════════════════════════════════════════════════
function checkUnreferencedLib() {
  const phpFiles = [
    ...walk('controllers', '.php'),
    ...walk('lib', '.php'),
    'api.php','cron.php','admin-auth.php','payment-lib.php',
    'figo-ai-bridge.php','figo-backend.php','figo-brain.php','figo-chat.php',
  ];
  const corpus = phpFiles.map(f => read(f)).join('\n');
  const libRoot = fs.readdirSync(abs('lib'))
    .filter(f => f.endsWith('.php'))
    .map(f => `lib/${f}`);
  return libRoot.filter(function(f) {
    const cls   = path.basename(f, '.php');
    const re    = new RegExp('\\b' + cls + '\\b', 'g');
    const self  = (read(f).match(re) || []).length;
    const total = (corpus.match(re) || []).length;
    return total <= self;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 3 — Tests de clases que ya no existen
// ════════════════════════════════════════════════════════════════════════════
function checkStaleTests() {
  const stale = [];
  for (const f of walk('tests', '.php')) {
    const content = read(f);
    const re = /(?:use|new)\s+\\?([A-Za-z\\]+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const cls = m[1].split('\\').pop();
      if (/(Controller|Service|Facade|Repository)$/.test(cls)) {
        const onDisk = exist(`controllers/${cls}.php`) || exist(`lib/${cls}.php`) ||
          walk('lib', '.php').some(p => path.basename(p, '.php') === cls);
        if (!onDisk) { stale.push({ file: f, missing: cls }); break; }
      }
    }
  }
  return stale;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 4 — Patrones de agentes (causa raíz del desastre)
// ════════════════════════════════════════════════════════════════════════════
const AGENT_PATTERNS = [
  /turnero-surface-/i,
  /[-_]surface[-_]/i,
  /(agent|governance|verification|dispatch|claim|handoff|velocity|workspace-hygiene)/i,
  /done-audit\.(jsonl|json)$/,
  /AGENTS\.md$/,
  /AGENT_BOARD/i,
  /(sprint-\d+|s\d{2}-\d{2})\.(md|yaml|json)$/i,
  /agent-orchestrat/i,
];

function checkAgentFiles() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  return tracked.filter(function(f) {
    return AGENT_PATTERNS.some(re => re.test(f)) &&
      !f.startsWith('bin/') && !f.startsWith('.github/');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 5 — Sub-proyectos embebidos
// ════════════════════════════════════════════════════════════════════════════
const SUBPROJECT_SIGNALS = [
  'build.gradle.kts','AndroidManifest.xml','electron.js',
  'main.mjs','tsconfig.json','settings.gradle.kts',
];

function checkEmbeddedSubprojects() {
  const found = [];
  for (const signal of SUBPROJECT_SIGNALS) {
    for (const f of walk('.', null, 3)) {
      if (path.basename(f) === signal) {
        const dir = path.dirname(f);
        if (!found.includes(dir)) found.push(dir);
      }
    }
  }
  // Also detect nested package.json (not root)
  for (const f of walk('.', 'package.json', 3)) {
    if (f !== 'package.json') {
      const dir = path.dirname(f);
      if (!found.includes(dir) && !dir.startsWith('node_modules') && !dir.startsWith('vendor')) {
        found.push(dir);
      }
    }
  }
  return found;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 6 — Versiones acumuladas
// ════════════════════════════════════════════════════════════════════════════
function checkVersionAccumulation() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  const groups  = {};
  for (const f of tracked) {
    const m = f.match(/[-_]v(\d+)/);
    if (!m) continue;
    const base = f.replace(/[-_]v\d+/, '');
    if (!groups[base]) groups[base] = [];
    groups[base].push({ file: f, v: parseInt(m[1]) });
  }
  const dead = [];
  for (const versions of Object.values(groups)) {
    if (versions.length < 2) continue;
    const maxV = Math.max.apply(null, versions.map(x => x.v));
    versions.filter(x => x.v < maxV).forEach(x => dead.push(x.file));
  }
  return dead;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 7 — Docs de coordinación / PowerShell
// ════════════════════════════════════════════════════════════════════════════
const DOCS_SPAM = [
  /^(BLOCKERS|LAUNCH|CALENDAR-CUTOVER|CHECKLIST|ESTADO_|GATE-|PLAN_ESTABILIDAD|MONITOR-|REPORTE-|VERIFICAR-|SMOKE-|CONFIGURAR-|BENCH-|PREPARAR-|DESPLIEGUE-|SERVIDOR-LOCAL|CONTRIBUTING|CRONS|SECURITY_AUDIT|GITHUB-ACTIONS-DEPLOY)\.md$/i,
  /\.ps1$/,
  /AGENT[S_-]/i,
  /governance\//,
  /verification\//,
];

function checkDocSpam() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  const KEEP = new Set(['README.md','TASKS.md']);
  return tracked.filter(function(f) {
    return !KEEP.has(path.basename(f)) && DOCS_SPAM.some(re => re.test(f));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 8 — Archivos basura
// ════════════════════════════════════════════════════════════════════════════
const JUNK_RE = [
  /\.(log|ps1|bak|tmp)$/,
  /^(out|out\d|status|error|audit-output|playwright-error)\.\w+$/,
  /^(fix_|patch-|tmp-|test-lab-|test-s\d+|refactor_)/,
  /^_debug/i,
];

function checkJunk() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  return tracked.filter(f => JUNK_RE.some(re => re.test(path.basename(f))));
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 9 — Tipos incorrectos
// ════════════════════════════════════════════════════════════════════════════
function checkWrongType() {
  const wrong = [];
  walk('lib', '.js').forEach(f => wrong.push({ file: f, note: 'JS en directorio PHP' }));
  walk('lib', '.ts').forEach(f => wrong.push({ file: f, note: 'TS en directorio PHP' }));
  if (fs.existsSync(abs('src'))) {
    walk('src', '.php').forEach(f => wrong.push({ file: f, note: 'PHP en src/' }));
  }
  return wrong;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 10 — Bin scripts que no tienen razón de existir post-limpieza
// ════════════════════════════════════════════════════════════════════════════
const DEAD_BIN_PATTERNS = [
  /optimize-images/,
  /generate-icons/,
  /release-android/,
  /deploy-public-v[2-9]/,   // versiones viejas de deploy
  /expand-cie10/,
  /extract-sections/,
  /generate-csp-hashes/,
  /generate_hash/,
  /run-benchmark/,
  /migrate-s\d/,
  /backfill-/,
  /validate-plan-operativo/,
  /whatsapp-funnel-summary/,
  /notify-director-blocker/,
  /notify-lab-critical/,
  /check-warnings/,
  /run-phpunit\.js/,
  /alert\.js/,
];

function checkDeadBinScripts() {
  const binFiles = fs.readdirSync(abs('bin'))
    .filter(f => !fs.statSync(abs(`bin/${f}`)).isDirectory())
    .map(f => `bin/${f}`);
  return binFiles.filter(f => DEAD_BIN_PATTERNS.some(re => re.test(path.basename(f))));
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 11 — Git worktrees huérfanos
// ════════════════════════════════════════════════════════════════════════════
function checkStaleWorktrees() {
  try {
    const lines = execSync('git worktree list', { cwd: ROOT }).toString().trim().split('\n');
    return lines.filter(l => l.includes('.codex-worktrees') || (l.includes('(detached HEAD)') && l.includes(ROOT)));
  } catch { return []; }
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
console.log('\n' + C.bold('🔍  Aurora Derm — Pruner v2'));
console.log('─'.repeat(54));
console.log(C.dim('  Modo    : ' + (DRY ? 'dry-run  (sin cambios)' : C.red('⚠  DELETE MODE'))));
console.log(C.dim('  Filtro  : ' + (ONLY === 'all' ? 'todos los checks' : '--only=' + ONLY)));

const toDelete = [];

function run(key, label, fn, fmt) {
  if (ONLY !== 'all' && ONLY !== key) return;
  toDelete.push(...report(label, fn(), fmt));
}

run('ctrl',        'Controllers huérfanos (sin ruta activa)',
    checkOrphanControllers,
    function(x) { return { file: x.file, note: 'clase: ' + x.cls }; });

run('lib',         'Lib PHP sin referencias',
    checkUnreferencedLib,
    function(x) { return { file: x }; });

run('tests',       'Tests de clases eliminadas',
    checkStaleTests,
    function(x) { return { file: x.file, note: 'clase inexistente: ' + x.missing }; });

run('agents',      '⚠  Patrones de agentes / orquestación (causa raíz)',
    checkAgentFiles,
    function(x) { return { file: x, reason: 'generado por agente' }; });

run('subprojects', '⚠  Sub-proyectos embebidos',
    checkEmbeddedSubprojects,
    function(x) { return { file: x, note: 'tiene su propio package.json / build.gradle' }; });

run('versions',    'Versiones acumuladas (v-N cuando existe v-mayor)',
    checkVersionAccumulation,
    function(x) { return { file: x, reason: 'versión obsoleta' }; });

run('docs',        'Docs de coordinación / PowerShell',
    checkDocSpam,
    function(x) { return { file: x }; });

run('junk',        'Archivos basura (logs, output, temporales)',
    checkJunk,
    function(x) { return { file: x }; });

run('wrongtype',   'Tipos en lugar incorrecto',
    checkWrongType,
    function(x) { return { file: x.file, note: x.note }; });

run('bin',         'Scripts de bin/ obsoletos post-limpieza',
    checkDeadBinScripts,
    function(x) { return { file: x, note: 'no aplica a backend-only' }; });

// worktrees
if (ONLY === 'all' || ONLY === 'worktrees') {
  section('Git worktrees huérfanos');
  const wt = checkStaleWorktrees();
  if (!wt.length) {
    console.log(C.green('  ✓ Ninguno'));
  } else {
    wt.forEach(w => console.log('  ' + C.red('✗') + ' ' + w));
    console.log(C.yellow('\n  ' + wt.length + ' detectado(s)'));
    if (!DRY) {
      wt.forEach(function(w) {
        try { execSync(`git worktree remove --force "${w}"`, { cwd: ROOT, stdio: 'pipe' }); }
        catch { fs.rmSync(w, { recursive: true, force: true }); }
      });
      execSync('git worktree prune', { cwd: ROOT, stdio: 'pipe' });
    }
  }
}

// ── Resumen ───────────────────────────────────────────────────────────────────
const unique = [...new Set(toDelete)];
console.log('\n' + '═'.repeat(54));

if (!unique.length) {
  console.log(C.green(C.bold('\n  ✓ Proyecto limpio. Nada que borrar.\n')));
  process.exit(0);
}

console.log(C.bold('\n  Total: ' + C.red(unique.length) + ' archivo(s) detectado(s)\n'));

if (DRY) {
  console.log(C.yellow('  Dry-run. Para borrar:'));
  console.log(C.bold('    npm run prune:delete\n'));
} else {
  console.log(C.red(C.bold('  Borrando...\n')));
  let deleted = 0;
  for (const f of unique) {
    if (exist(f)) { gitRm(f); console.log('  ' + C.red('✗') + ' ' + f); deleted++; }
  }
  try {
    execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
    execSync('HUSKY=0 git commit --no-verify -m "chore(prune): remove ' + deleted + ' dead files [auto]"',
             { cwd: ROOT, stdio: 'pipe' });
    console.log(C.green('\n  ✓ ' + deleted + ' archivo(s) eliminados y commiteados.'));
  } catch {
    console.log(C.yellow('\n  ✓ ' + deleted + ' eliminados. Sin cambios nuevos o commitea manualmente.'));
  }
}
