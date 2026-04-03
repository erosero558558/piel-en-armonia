#!/usr/bin/env node
/**
 * bin/prune.js — Aurora Derm dead-code detector
 *
 * Uso:
 *   node bin/prune.js              → muestra qué borraría (dry-run)
 *   node bin/prune.js --delete     → borra lo detectado
 *   node bin/prune.js --only=ctrl  → solo controladores huérfanos
 *   node bin/prune.js --only=lib   → solo lib sin referencias
 *   node bin/prune.js --only=tests → solo tests de código eliminado
 *   node bin/prune.js --only=junk  → solo archivos basura (logs, .txt)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT   = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DRY    = !process.argv.includes('--delete');
const ONLY   = (process.argv.find(a => a.startsWith('--only=')) ?? '').replace('--only=', '') || 'all';

const C = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ── helpers ─────────────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch { return ''; }
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function listFiles(dir, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => !ext || f.endsWith(ext))
    .map(f => path.join(dir, f));
}

function gitRm(file) {
  try { execSync(`git rm --cached "${path.join(ROOT, file)}" 2>/dev/null`, { stdio: 'pipe' }); } catch {}
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

function sectionHeader(title) {
  console.log('\n' + C.bold(C.cyan(`── ${title} ${'─'.repeat(50 - title.length)}`)));
}

// ── análisis 1: controllers huérfanos (no en routes.php) ────────────────────

function orphanControllers() {
  const routes   = readFile('lib/routes.php');
  const inRoutes = new Set([...routes.matchAll(/([A-Za-z]+(?:Controller|Facade))::/g)].map(m => m[1]));
  const onDisk   = listFiles('controllers', '.php');

  return onDisk
    .map(f => ({ file: f, cls: path.basename(f, '.php') }))
    .filter(({ cls }) => !inRoutes.has(cls));
}

// ── análisis 2: clases lib/ no referenciadas en ningún lado ─────────────────

function unreferencedLib() {
  // Construir el corpus de todo el código PHP del proyecto
  const allPhp = [
    ...listFiles('controllers', '.php'),
    ...listFiles('lib', '.php'),
    'api.php', 'cron.php', 'admin-auth.php', 'payment-lib.php',
  ];

  const corpus = allPhp.map(f => readFile(f)).join('\n');

  // Solo archivos lib/ raíz (los subdirectorios se analizan por separado)
  const libRoot = listFiles('lib', '.php');

  return libRoot.filter(f => {
    const cls = path.basename(f, '.php');
    // Buscar usos: new Cls, Cls::, use ...\Cls, typehints: Cls $
    const pattern = new RegExp(`\\b${cls}\\b`);
    const usages  = (corpus.match(new RegExp(`\\b${cls}\\b`, 'g')) ?? []).length;
    // Si la única mención es dentro del propio archivo → no está referenciado
    const selfCount = (readFile(f).match(pattern) ?? []).length;
    return usages <= selfCount;
  });
}

// ── análisis 3: tests que prueban controllers/clases eliminadas ──────────────

function staleTests() {
  const testFiles = [
    ...listFiles('tests', '.php'),
    ...listFiles('tests/Unit', '.php'),
    ...listFiles('tests/Integration', '.php'),
    ...listFiles('tests/Smoke', '.php'),
  ];

  const stale = [];
  for (const f of testFiles) {
    const content = readFile(f);
    // Busca referencias a clases con require / use / new que no existen en disco
    const classRefs = [...content.matchAll(/(?:use|new|class)\s+\\?([A-Za-z\\]+)/g)]
      .map(m => m[1].split('\\').pop());

    for (const cls of classRefs) {
      const candidate = `controllers/${cls}.php`;
      const lib1      = `lib/${cls}.php`;
      // Si el nombre parece un Controller o Service y no existe
      if ((cls.endsWith('Controller') || cls.endsWith('Service') || cls.endsWith('Facade')) &&
          !exists(candidate) && !exists(lib1)) {
        stale.push({ file: f, missing: cls });
        break;
      }
    }
  }
  return stale;
}

// ── análisis 4: archivos basura en raíz ─────────────────────────────────────

const JUNK_PATTERNS = [
  /\.(log|txt|ps1|bak|tmp)$/,
  /^(out|out2|status|error|audit-output|playwright-error)\./,
  /^(fix_|patch-|tmp-|test-lab-|test-s\d+)/,
  /^refactor_.*\.py$/,
];

function junkFiles() {
  const rootFiles = fs.readdirSync(ROOT).filter(f =>
    fs.statSync(path.join(ROOT, f)).isFile()
  );
  return rootFiles.filter(f => JUNK_PATTERNS.some(re => re.test(f)));
}

// ── análisis 5: archivos PHP duplicados/alias en raíz ───────────────────────

function duplicatePhp() {
  const keep  = new Set(['api.php','admin-auth.php','cron.php','backup-receiver.php',
                         'payment-lib.php','index.php','env.php','env.example.php',
                         'figo-ai-bridge.php','figo-backend.php','figo-brain.php','figo-chat.php']);
  const rootPhp = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.php') && fs.statSync(path.join(ROOT, f)).isFile());
  return rootPhp.filter(f => !keep.has(f));
}

// ── reporte ──────────────────────────────────────────────────────────────────

function report(label, items, getFile = x => x.file ?? x, getNote = x => x.missing ?? '') {
  sectionHeader(label);
  if (items.length === 0) {
    console.log(C.green('  ✓ Ninguno'));
    return [];
  }
  for (const item of items) {
    const f    = getFile(item);
    const note = getNote(item);
    console.log(`  ${C.red('✗')} ${f}${note ? C.dim(` ← prueba clase inexistente: ${note}`) : ''}`);
  }
  console.log(C.yellow(`\n  ${items.length} archivo(s) detectado(s)`));
  return items.map(getFile);
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(C.bold('\n🔍 Aurora Derm — Pruner'));
console.log(C.dim(`  Modo: ${DRY ? 'dry-run (solo reporte)' : C.red('⚠ DELETE MODE')}`));
if (ONLY !== 'all') console.log(C.dim(`  Filtro: --only=${ONLY}`));

const toDelete = [];

if (ONLY === 'all' || ONLY === 'ctrl') {
  const items = orphanControllers();
  toDelete.push(...report('Controllers huérfanos (en disco, sin ruta)', items, x => x.file, x => x.cls));
}

if (ONLY === 'all' || ONLY === 'lib') {
  const items = unreferencedLib();
  toDelete.push(...report('Lib PHP sin referencias en el proyecto', items, x => x, () => ''));
}

if (ONLY === 'all' || ONLY === 'tests') {
  const items = staleTests();
  toDelete.push(...report('Tests de clases eliminadas', items, x => x.file, x => x.missing));
}

if (ONLY === 'all' || ONLY === 'junk') {
  const items = junkFiles();
  toDelete.push(...report('Archivos basura en raíz', items, x => x, () => ''));

  const dupes = duplicatePhp();
  toDelete.push(...report('PHP en raíz fuera del set canónico', dupes, x => x, () => ''));
}

// ── resumen ───────────────────────────────────────────────────────────────────

const unique = [...new Set(toDelete)];

console.log('\n' + '─'.repeat(54));
if (unique.length === 0) {
  console.log(C.green(C.bold('✓ El proyecto está limpio. Nada que borrar.')));
  process.exit(0);
}

console.log(C.bold(`\nTotal detectado: ${C.red(unique.length)} archivo(s)\n`));

if (DRY) {
  console.log(C.yellow('Dry-run activo. Para borrar ejecuta:'));
  console.log(C.bold('  node bin/prune.js --delete\n'));
} else {
  console.log(C.red(C.bold('Borrando...')));
  let deleted = 0;
  for (const f of unique) {
    if (exists(f)) {
      gitRm(f);
      console.log(`  ${C.red('✗')} eliminado: ${f}`);
      deleted++;
    }
  }
  // Auto-commit
  try {
    execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
    execSync(`git commit --no-verify -m "chore(prune): auto-remove ${deleted} dead files via bin/prune.js"`,
             { cwd: ROOT, stdio: 'pipe' });
    console.log(C.green(`\n✓ ${deleted} archivo(s) eliminados y commiteados.`));
  } catch {
    console.log(C.yellow(`\n✓ ${deleted} archivo(s) eliminados. Commitea manualmente.`));
  }
}
