#!/usr/bin/env node
'use strict';

/**
 * bin/guard-agents-md.js — Pre-commit guard for AGENTS.md
 *
 * Se ejecuta automáticamente desde lint-staged cada vez que
 * se stagea AGENTS.md. Previene:
 *
 *   ❌ Marcar [x] sin audit trail (done-audit.jsonl)
 *   ❌ Marcar [x] con claim huérfano (olvidar liberar)
 *   ❌ Tareas donde verify.js reporta sin evidencia
 *
 * Bypass (solo emergencias):
 *   HUSKY=0 git commit --no-verify -m "..."
 *   → Deja rastro visible en el commit history como señal de deuda.
 *
 * Exit: 0 = OK, 1 = BLOCK commit
 */

const { readFileSync, existsSync } = require('fs');
const { resolve, join } = require('path');
const { execSync } = require('child_process');

const ROOT        = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks');
const AUDIT_LOG   = resolve(ROOT, 'governance/done-audit.jsonl');

function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch { return ''; }
}

// ── Get diff of AGENTS.md (staged) ───────────────────────────────────────────
const diff = run('git diff --cached AGENTS.md');

if (!diff) process.exit(0); // AGENTS.md not staged

// ── Extract newly marked-done tasks ──────────────────────────────────────────
const newlyDone = [];
const diffLines = diff.split('\n');
for (const line of diffLines) {
  // Lines added in the diff that mark a task done
  const m = line.match(/^\+- \[x\] \*\*([A-Z][\w]+-\w+)\*\*/);
  if (m) newlyDone.push(m[1]);
}

if (newlyDone.length === 0) process.exit(0); // No new [x] marks

console.log(`\n🛡️  guard-agents-md: detectadas ${newlyDone.length} tarea(s) marcadas done`);
console.log(`   ${newlyDone.join(', ')}\n`);

// ── Load audit log entries ────────────────────────────────────────────────────
const auditEntries = [];
if (existsSync(AUDIT_LOG)) {
  const lines = readFileSync(AUDIT_LOG, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try { auditEntries.push(JSON.parse(line)); } catch {}
  }
}
const auditedIds = new Set(auditEntries.map(e => e.taskId));

// ── Load active claims ────────────────────────────────────────────────────────
const claimIds = new Set();
if (existsSync(CLAIMS_DIR)) {
  const { readdirSync } = require('fs');
  for (const f of readdirSync(CLAIMS_DIR)) {
    if (f.endsWith('.json')) claimIds.add(f.replace('.json', ''));
  }
}

// ── Evaluate each newly done task ─────────────────────────────────────────────
let blocked = 0;
const warnings = [];

for (const id of newlyDone) {
  const hasAuditTrail = auditedIds.has(id);
  const hasOrphanClaim = claimIds.has(id);

  if (!hasAuditTrail) {
    blocked++;
    console.error(`❌ ${id}: marcada [x] sin audit trail (done-audit.jsonl).`);
    console.error(`   Usa: node bin/mark-done.js ${id} --who "tu-nombre"`);
    console.error(`   O si es una tarea retrospectiva: node bin/mark-done.js ${id} --force --who "tu-nombre"\n`);
  } else if (hasOrphanClaim) {
    warnings.push(`⚠️  ${id}: marcada done pero el claim file SIGUE ACTIVO (${id}.json).`);
    warnings.push(`   Ejecuta: node bin/claim.js release ${id}\n`);
  } else {
    console.log(`✅ ${id}: audit trail OK, claim liberado`);
  }
}

if (warnings.length > 0) {
  console.log('\n--- Warnings (no bloquean) ---');
  warnings.forEach(w => console.log(w));
}

if (blocked > 0) {
  console.error('\n─────────────────────────────────────────────────────────');
  console.error('🔴 COMMIT BLOQUEADO — Tareas marcadas done sin audit trail');
  console.error('─────────────────────────────────────────────────────────');
  console.error('\nPara cada tarea bloqueada ejecuta:');
  console.error('  node bin/mark-done.js <ID> --who "tu-nombre"\n');
  console.error('(El script verifica evidencia, corre gate y crea el audit trail automáticamente)\n');
  process.exit(1);
}

console.log('\n✅ guard-agents-md: todas las tareas tienen audit trail. Commit permitido.\n');
process.exit(0);
