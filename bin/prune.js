#!/usr/bin/env node
/**
 * bin/prune.js — Aurora Derm dead-code detector & remover
 *
 * Aprendido de todo lo que vivimos: agentes que creaban sin borrar,
 * sub-proyectos embebidos, versiones acumuladas, docs de coordinación,
 * PowerShell suelto, CSS duplicado, worktrees huérfanos.
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

import { execSync }   from 'node:child_process';
import fs             from 'node:fs';
import path           from 'node:path';

const ROOT  = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DRY   = !process.argv.includes('--delete');
const ONLY  = (process.argv.find(a => a.startsWith('--only=')) ?? '').replace('--only=', '') || 'all';

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

function walk(dir, ext = null, maxDepth = 4, _depth = 0) {
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

function report(label, items, fmt = x => ({ file: x, note: '' })) {
  section(label);
  if (!items.length) { console.log(C.green('  ✓ Ninguno')); return []; }
  const toDelete = [];
  for (const item of items) {
    const { file, note, reason } = fmt(item);
    const noteStr = note  ? C.gray(` ← ${note}`) : '';
    const reaStr  = reason? C.dim(` [${reason}]`) : '';
    console.log(`  ${C.red('✗')} ${file}${noteStr}${reaStr}`);
    toDelete.push(file);
  }
  console.log(C.yellow(`\n  ${items.length} detectado(s)`));
  return toDelete;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 1 — Controllers sin rutas activas
// ════════════════════════════════════════════════════════════════════════════
function checkOrphanControllers() {
  const routes  = read('lib/routes.php');
  const inRoutes = new Set([...routes.matchAll(/([A-Za-z]+(?:Controller|Facade))::/g)].map(m => m[1]));
  return walk('controllers', '.php')
    .map(f => ({ file: f, cls: path.basename(f, '.php') }))
    .filter(({ cls }) => !inRoutes.has(cls));
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

  // Solo archivos raíz de lib/ (los subdirectorios ya tienen sus propias referencias)
  const libRoot = fs.readdirSync(abs('lib'))
    .filter(f => f.endsWith('.php'))
    .map(f => `lib/${f}`);

  return libRoot.filter(f => {
    const cls   = path.basename(f, '.php');
    const self  = (read(f).match(new RegExp(`\\b${cls}\\b`, 'g')) ?? []).length;
    const total = (corpus.match(new RegExp(`\\b${cls}\\b`, 'g')) ?? []).length;
    return total <= self; // solo se menciona dentro de sí mismo
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 3 — Tests de clases/servicios que ya no existen
// ════════════════════════════════════════════════════════════════════════════
function checkStaleTests() {
  const stale = [];
  for (const f of walk('tests', '.php')) {
    const content = read(f);
    const refs    = [...content.matchAll(/(?:use|new)\s+\\?([A-Za-z\\]+)/g)].map(m => m[1].split('\\').pop());
    for (const cls of refs) {
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
// CHECK 4 — Patrones de agentes (lo que más daño causó)
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
  /agent-handoff/i,
];

function checkAgentFiles() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  return tracked.filter(f =>
    AGENT_PATTERNS.some(re => re.test(f)) &&
    !f.startsWith('bin/') && !f.startsWith('.github/')
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 5 — Sub-proyectos embebidos (el error más grave)
// ════════════════════════════════════════════════════════════════════════════
const SUBPROJECT_SIGNALS = [
  'package.json', 'composer.json', 'build.gradle.kts',
  'AndroidManifest.xml', 'electron.js', 'main.mjs',
  'docker-compose.yml', 'tsconfig.json', 'settings.gradle.kts',
];

function checkEmbeddedSubprojects() {
  const IGNORE_ROOTS = [ROOT]; // el package.json raíz está bien
  const found = [];
  for (const signal of SUBPROJECT_SIGNALS) {
    for (const f of walk('.', null, 3)) {
      const base = path.basename(f);
      const dir  = path.dirname(f);
      if (base === signal && dir !== '.' && !dir.startsWith('vendor') && !dir.startsWith('node_modules')) {
        if (!found.includes(dir)) found.push(dir);
      }
    }
  }
  return found;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 6 — Versiones acumuladas (v1/v2/v3 cuando ya existe v-mayor)
// ════════════════════════════════════════════════════════════════════════════
function checkVersionAccumulation() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  const versioned = tracked.filter(f => /[-_]v(\d+)[-_/.]/.test(f));

  // Agrupar por base (sin versión)
  const groups = {};
  for (const f of versioned) {
    const base = f.replace(/[-_]v\d+/, '');
    if (!groups[base]) groups[base] = [];
    const match = f.match(/[-_]v(\d+)/);
    if (match) groups[base].push({ file: f, v: parseInt(match[1]) });
  }

  const dead = [];
  for (const [, versions] of Object.entries(groups)) {
    if (versions.length < 2) continue;
    const maxV = Math.max(...versions.map(x => x.v));
    versions.filter(x => x.v < maxV).forEach(x => dead.push(x.file));
  }
  return dead;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 7 — Documentación de coordinación de agentes / ops spam
// ════════════════════════════════════════════════════════════════════════════
const DOCS_SPAM_PATTERNS = [
  /^(BLOCKERS|LAUNCH|CALENDAR-CUTOVER|CHECKLIST|ESTADO_|GATE-|PLAN_ESTABILIDAD|MONITOR-|REPORTE-|VERIFICAR-|SMOKE-|CONFIGURAR-|BENCH-|PREPARAR-|DESPLIEGUE-|SERVIDOR-LOCAL|CONTRIBUTING|CRONS|SECURITY_AUDIT|GITHUB-ACTIONS-DEPLOY)\.md$/i,
  /\.ps1$/,                    // PowerShell — esto no es Windows
  /AGENT[S_-]/i,               // docs de agentes
  /governance\//,
  /verification\//,
];

function checkDocSpam() {
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
  const KEEP_MD = new Set(['README.md']);
  return tracked.filter(f => {
    const base = path.basename(f);
    if (KEEP_MD.has(base)) return false;
    return DOCS_SPAM_PATTERNS.some(re => re.test(f));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 8 — Archivos basura / logs / output / temporales
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
// CHECK 9 — Tipos de archivos en lugares incorrectos
// ════════════════════════════════════════════════════════════════════════════
function checkWrongType() {
  const wrong = [];
  // JS en lib/ (PHP land)
  for (const f of walk('lib', '.js')) wrong.push({ file: f, note: 'JS en directorio PHP' });
  for (const f of walk('lib', '.ts')) wrong.push({ file: f, note: 'TS en directorio PHP' });
  // PHP en src/ (JS land)
  for (const f of walk('src', '.php')) wrong.push({ file: f, note: 'PHP en directorio JS/Astro' });
  // PHP de test sueltos en raíz
  const rootPhp = fs.existsSync(ROOT) ? fs.readdirSync(ROOT).filter(f => f.startsWith('test') && f.endsWith('.php')) : [];
  rootPhp.forEach(f => wrong.push({ file: f, note: 'test PHP en raíz' }));
  return wrong;
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 10 — Git worktrees huérfanos
// ════════════════════════════════════════════════════════════════════════════
function checkStaleWorktrees() {
  try {
    const out   = execSync('git worktree list', { cwd: ROOT }).toString().trim().split('\n');
    const stale = out.filter(line => line.includes('.codex-worktrees') || line.includes('(detached HEAD)'));
    return stale.map(line => line.trim().split(/\s+/)[0]);
  } catch { return []; }
}

// ════════════════════════════════════════════════════════════════════════════
// CHECK 11 — Archivos duplicados / alias de features (mismo feature, dos nombres)
// ════════════════════════════════════════════════════════════════════════════
function checkDuplicateFeatureFiles() {
  // Pares conocidos por experiencia: si ambos existen, eliminar el alias/antiguo
  const KNOWN_PAIRS = [
    ['queue-kiosk.html',    'kiosco-turnos.html'],
    ['queue-display.html',  'sala-turnos.html'],
    ['queue-operator.html', 'operador-turnos.html'],
    ['kiosk.html',          'kiosco-turnos.html'],
  ];
  const dupes = [];
  for (const [alias, canonical] of KNOWN_PAIRS) {
    if (exist(alias) && exist(canonical)) dupes.push({ file: alias, note: `alias de ${canonical}` });
    if (exist(alias) && !exist(canonical)) dupes.push({ file: alias, note: `huérfano — ${canonical} ya no existe` });
  }
  return dupes;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

const TITLE = '🔍  Aurora Derm — Pruner v2';
console.log('\n' + C.bold(TITLE));
console.log('─'.repeat(54));
console.log(C.dim(`  Modo    : ${DRY ? 'dry-run  (sin cambios)' : C.red('⚠  DELETE MODE')}`));
console.log(C.dim(`  Filtro  : ${ONLY === 'all' ? 'todos los checks' : `--only=${ONLY}`}`));
console.log(C.dim(`  Proyecto: ${ROOT}`));

const toDelete = [];
const run = (key, label, fn, formatter) => {
  if (ONLY !== 'all' && ONLY !== key) return;
  const items = fn();
  toDelete.push(...report(label, items, formatter));
};

run('ctrl',        'Controllers huérfanos (sin ruta activa)',
    checkOrphanControllers,
    x => ({ file: x.file, note: `clase: ${x.cls}` }));

run('lib',         'Lib PHP sin referencias',
    checkUnreferencedLib,
    x => ({ file: x }));

run('tests',       'Tests de clases eliminadas',
    checkStaleTests,
    x => ({ file: x.file, note: `clase inexistente: ${x.missing}` }));

run('agents',      '⚠  Patrones de agentes / orquestación (CAUSA RAÍZ)',
    checkAgentFiles,
    x => ({ file: x, reason: 'generado por agente' }));

run('subprojects', '⚠  Sub-proyectos embebidos (repos dentro del repo)',
    checkEmbeddedSubprojects,
    x => ({ file: x, note: 'tiene su propio package.json / composer.json / build.gradle' }));

run('versions',    'Versiones acumuladas (v1/v2/v3 cuando existe v-mayor)',
    checkVersionAccumulation,
    x => ({ file: x, reason: 'versión obsoleta' }));

run('docs',        'Docs de coordinación de agentes / PowerShell',
    checkDocSpam,
    x => ({ file: x }));

run('junk',        'Archivos basura (logs, output, temporales)',
    checkJunk,
    x => ({ file: x }));

run('wrongtype',   'Tipos de archivos en lugar incorrecto',
    checkWrongType,
    x => ({ file: x.file, note: x.note }));

run('dupes',       'Archivos duplicados / aliases del mismo feature',
    checkDuplicateFeatureFiles,
    x => ({ file: x.file, note: x.note }));

// worktrees: no se borran como archivos, se limpian con git worktree
if (ONLY === 'all' || ONLY === 'worktrees') {
  section('Git worktrees huérfanos');
  const wt = checkStaleWorktrees();
  if (wt.length === 0) {
    console.log(C.green('  ✓ Ninguno'));
  } else {
    for (const w of wt) console.log(`  ${C.red('✗')} ${w}`);
    console.log(C.yellow(`\n  ${wt.length} detectado(s)`));
    if (!DRY) {
      for (const w of wt) {
        try {
          execSync(`git worktree remove --force "${w}"`, { cwd: ROOT, stdio: 'pipe' });
          console.log(`  eliminado: ${w}`);
        } catch {
          fs.rmSync(w, { recursive: true, force: true });
          console.log(`  eliminado (forzado): ${w}`);
        }
      }
      execSync('git worktree prune', { cwd: ROOT, stdio: 'pipe' });
    }
  }
}

// ── Resumen ───────────────────────────────────────────────────────────────────
const unique = [...new Set(toDelete)];
console.log('\n' + '═'.repeat(54));

if (unique.length === 0) {
  console.log(C.green(C.bold('\n  ✓ Proyecto limpio. Nada que borrar.\n')));
  process.exit(0);
}

console.log(C.bold(`\n  Total: ${C.red(unique.length)} archivo(s) detectado(s)\n`));

if (DRY) {
  console.log(C.yellow('  Dry-run activo. Para ejecutar el borrado:'));
  console.log(C.bold('    node bin/prune.js --delete'));
  console.log(C.dim('    # o: npm run prune:delete\n'));
} else {
  console.log(C.red(C.bold('  Borrando...\n')));
  let deleted = 0;
  for (const f of unique) {
    if (exist(f)) {
      gitRm(f);
      console.log(`  ${C.red('✗')} ${f}`);
      deleted++;
    }
  }
  try {
    execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
    execSync(
      `HUSKY=0 git commit --no-verify -m "chore(prune): remove ${deleted} dead files [auto]"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    console.log(C.green(`\n  ✓ ${deleted} archivo(s) eliminados y commiteados.`));
  } catch {
    console.log(C.yellow(`\n  ✓ ${deleted} archivo(s) eliminados. Sin cambios nuevos o commitea manualmente.`));
  }
}
