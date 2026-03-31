#!/usr/bin/env node
'use strict';

/**
 * bin/mark-done.js — v1.0 — Aurora Derm Orchestration Guard
 *
 * EL ÚNICO FLUJO APROBADO para marcar una tarea como [x].
 *
 * Previene:
 *   ✗ marcar done sin evidencia verificable
 *   ✗ marcar done sin claim activo
 *   ✗ marcar done sin haber corrido gate.js
 *   ✗ claims huérfanos post-merge
 *
 * Uso:
 *   node bin/mark-done.js <TASK-ID> [--who "nombre-agente"] [--skip-gate] [--force]
 *
 * Flujo:
 *   1. Verifica que hay un claim activo para la tarea
 *   2. Corre verify.js y confirma que la tarea tiene evidencia
 *   3. Si hay regla en verify.js, la evalúa
 *   4. Actualiza AGENTS.md: [ ] → [x]
 *   5. Libera el claim
 *   6. Escribe entrada en governance/done-audit.jsonl
 *
 * Exit code:
 *   0 = OK (tarea marcada, claim liberado)
 *   1 = FAIL (no marcar — ver razón)
 */

const { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } = require('fs');
const { resolve, join } = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT        = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks');
const GOV_DIR     = resolve(ROOT, 'governance');
const AUDIT_LOG   = join(GOV_DIR, 'done-audit.jsonl');

// ── helpers ──────────────────────────────────────────────────────────────────

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }
function run(cmd, { silent = true } = {}) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' }).trim(); }
  catch (e) { return ''; }
}

function die(msg) {
  console.error(`\n❌ mark-done ABORT: ${msg}\n`);
  console.error('   Corrige el problema y vuelve a intentar.\n');
  process.exit(1);
}

function claimPath(id) {
  const safe = id.replace(/[^a-zA-Z0-9\-]/g, '');
  return join(CLAIMS_DIR, `${safe}.json`);
}

function loadClaim(id) {
  const p = claimPath(id);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function deleteClaim(id) {
  const p = claimPath(id);
  if (existsSync(p)) {
    const fs = require('fs');
    fs.unlinkSync(p);
  }
}

function getTaskLine(id, content) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`- \\[([ x])\\] \\*\\*${id}\\*\\*(.+)`));
    if (m) return { idx: i, done: m[1] === 'x', line: lines[i] };
  }
  return null;
}

// ── parse args ───────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const taskId  = args.find(a => /^[A-Z][\w]+-\w+$/.test(a));
const who     = (() => { const i = args.indexOf('--who'); return i !== -1 ? args[i+1] : process.env.AGENT_NAME || 'unknown'; })();
const force   = args.includes('--force');
const skipGate = args.includes('--skip-gate');
const dryRun  = args.includes('--dry-run');

if (!taskId) {
  console.error('Uso: node bin/mark-done.js <TASK-ID> [--who "agente"] [--skip-gate] [--dry-run]');
  console.error('Ejemplo: node bin/mark-done.js S3-19 --who "Antigravity"');
  process.exit(1);
}

// ── STEP 1: Verify task exists and is not already done ───────────────────────

const agentsMd = read(AGENTS_FILE);
const task = getTaskLine(taskId, agentsMd);

if (!task) {
  die(`Tarea "${taskId}" no encontrada en AGENTS.md.`);
}
if (task.done) {
  console.log(`ℹ️  ${taskId} ya está marcada [x]. Nada que hacer.`);
  process.exit(0);
}

// ── STEP 2: Require active claim ─────────────────────────────────────────────

const claim = loadClaim(taskId);
if (!claim && !force) {
  die(
    `No hay claim activo para "${taskId}".\n` +
    `   Primero ejecuta:\n` +
    `   node bin/claim.js claim ${taskId} "${who}"\n` +
    `   git add data/claims/tasks/${taskId}.json && git commit -m "claim: ${taskId}" && git push`
  );
}
if (claim && claim.who && claim.who !== who && !force) {
  die(
    `La tarea "${taskId}" está reclamada por "${claim.who}", no por "${who}".\n` +
    `   Solo el owner puede marcarla done. Usa --force solo en emergencias (deja rastro).`
  );
}

// ── STEP 3: Run verify.js to check evidence ──────────────────────────────────

console.log(`\n🔍 Verificando evidencia para ${taskId}...`);
const verifyResult = spawnSync(process.execPath, ['bin/verify.js', '--json'], {
  cwd: ROOT, encoding: 'utf8',
});

let verifyData = null;
try { verifyData = JSON.parse(verifyResult.stdout || '{}'); } catch { /* parse error */ }

const withoutEvidence = verifyData?.withoutEvidence ?? [];
const noCheckTasks    = verifyData?.noCheckTasks ?? [];

if (withoutEvidence.includes(taskId) && !force) {
  die(
    `"${taskId}" está marcada [x] sin evidencia en verify.js.\n` +
    `   Opciones:\n` +
    `   a) Verificar que el archivo/feature realmente existe\n` +
    `   b) Añadir un criterio en bin/verify.js para esta tarea\n` +
    `   c) Usar --force si la evidencia es no-verificable por archivo (deja rastro de auditoría)`
  );
}

// Check if task has a verify rule
const hasVerifyRule = !noCheckTasks.includes(taskId);
if (!hasVerifyRule) {
  console.warn(`  ⚠️  Sin regla de verificación en verify.js para ${taskId}.`);
  console.warn(`     Considera añadir un check. Continúa sin bloquear (deuda técnica).`);
} else {
  // Try to actually evaluate the verify check for this task
  const singleCheck = spawnSync(process.execPath, ['bin/verify.js', '--task', taskId, '--json'], {
    cwd: ROOT, encoding: 'utf8',
  });
  let checkResult = null;
  try { checkResult = JSON.parse(singleCheck.stdout || '{}'); } catch {}
  if (checkResult?.taskResult === false && !force) {
    die(
      `La verificación de "${taskId}" FALLÓ.\n` +
      `   El criterio en verify.js dice que la evidencia no está completa.\n` +
      `   Completa el trabajo antes de marcar done.`
    );
  }
  if (checkResult?.taskResult === true) {
    console.log(`  ✅ Evidencia confirmada por verify.js`);
  }
}

// ── STEP 4: Run gate if not skipped ──────────────────────────────────────────

if (!skipGate) {
  console.log(`\n🚦 Corriendo gate.js para ${taskId}...`);
  const gateResult = spawnSync(process.execPath, ['bin/gate.js', taskId], {
    cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (gateResult.status !== 0) {
    const gateOut = (gateResult.stdout + gateResult.stderr).slice(0, 400);
    die(
      `gate.js falló para "${taskId}":\n${gateOut}\n` +
      `   Corrige los checks o usa --skip-gate (con justificación en el commit message).`
    );
  }
  console.log(`  ✅ gate.js pasó`);
} else {
  console.warn(`  ⚠️  --skip-gate activado. La tarea se marcará sin gate. Justifica en el commit.`);
}

// ── STEP 5: Mark [x] in AGENTS.md ────────────────────────────────────────────

if (dryRun) {
  console.log(`\n🧪 DRY RUN — Se marcaría done: ${taskId} por ${who}`);
  console.log(`   (No se escribió ningún archivo)`);
  process.exit(0);
}

const lines = agentsMd.split('\n');
const lineIdx = task.idx;
lines[lineIdx] = lines[lineIdx].replace(`- [ ] **${taskId}**`, `- [x] **${taskId}**`);
const updated = lines.join('\n');
writeFileSync(AGENTS_FILE, updated, 'utf8');
console.log(`\n✅ AGENTS.md actualizado: ${taskId} → [x]`);

// ── STEP 6: Release claim ─────────────────────────────────────────────────────

deleteClaim(taskId);
console.log(`   Claim liberado`);

// ── STEP 7: Write audit log ───────────────────────────────────────────────────

if (!existsSync(GOV_DIR)) mkdirSync(GOV_DIR, { recursive: true });
const auditEntry = {
  taskId,
  who,
  markedAt: new Date().toISOString(),
  skipGate,
  force,
  hasVerifyRule,
  gitCommit: run('git rev-parse --short HEAD'),
  gitBranch: run('git rev-parse --abbrev-ref HEAD'),
};
appendFileSync(AUDIT_LOG, JSON.stringify(auditEntry) + '\n', 'utf8');
console.log(`   Audit log: governance/done-audit.jsonl`);

// ── STEP 8: Remind agent of next steps ───────────────────────────────────────

console.log(`\n📋 Próximos pasos:
   git add AGENTS.md
   git commit -m "done(${taskId}): [descripción del trabajo]"
   git push origin main\n`);

process.exit(0);
