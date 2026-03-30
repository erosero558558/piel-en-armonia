#!/usr/bin/env node
/**
 * bin/stuck.js — Control de calidad: agente bloqueado en una tarea
 *
 * Cuando un agente no puede terminar una tarea (API breaks, contexto faltante,
 * archivo que no existe, duda clínica), usa este comando para:
 * 1. Registrar el bloqueo con descripción
 * 2. Liberar el claim para que otro agente pueda tomarlo
 * 3. Aparecer en "npm run report" como item que el dueño debe ver
 *
 * Uso:
 *   node bin/stuck.js <TASK-ID> "<razón del bloqueo>"
 *   node bin/stuck.js list        ← ver todos los bloqueos activos
 *   node bin/stuck.js clear <ID>  ← marcar un bloqueo como resuelto
 *
 * Ejemplos:
 *   node bin/stuck.js S3-24 "CalendarAvailabilityService no tiene endpoint GET /slots"
 *   node bin/stuck.js S5-15 "Jitsi requiere servidor propio - necesito decisión de infraestructura"
 *   node bin/stuck.js S6-11 "Stripe secret key no está en .env - necesita el dueño"
 */

const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT       = resolve(__dirname, '..');
const STUCK_FILE = resolve(ROOT, 'data/claims/stuck.json');
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks'); // v2

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : '{}'; }
function write(f, d) {
  mkdirSync(resolve(ROOT, 'data/claims'), { recursive: true });
  writeFileSync(f, JSON.stringify(d, null, 2) + '\n', 'utf8');
}
function loadStuck() { try { return JSON.parse(read(STUCK_FILE)); } catch { return {}; } }

// v2: load a single claim from individual file
function loadClaim(id) {
  const f = resolve(CLAIMS_DIR, `${id}.json`);
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch { return null; }
}
function deleteClaim(id) {
  const f = resolve(CLAIMS_DIR, `${id}.json`);
  try { if (existsSync(f)) require('fs').unlinkSync(f); } catch {}
}

const [,, command, ...args] = process.argv;

// ── list ───────────────────────────────────────────────────────────────────────
if (!command || command === 'list') {
  const stuck = loadStuck();
  const ids = Object.keys(stuck).filter(k => !stuck[k].resolved);
  if (ids.length === 0) {
    console.log('\n✅ No hay tareas bloqueadas actualmente.\n');
    process.exit(0);
  }

  console.log(`\n🚧 Tareas bloqueadas — requieren atención (${ids.length})\n`);
  ids.forEach(id => {
    const s = stuck[id];
    const age = Math.round((Date.now() - new Date(s.stuckAt).getTime()) / 60000);
    const ageStr = age < 60 ? `${age}min` : `${Math.round(age/60)}h`;
    console.log(`  ❌ ${id} — bloqueado hace ${ageStr}`);
    console.log(`     Agente: ${s.agent}`);
    console.log(`     Razón:  ${s.reason}`);
    console.log(`     Para resolver: edita BLOCKERS.md con la respuesta y haz commit`);
    console.log();
  });
  process.exit(0);
}

// ── clear ──────────────────────────────────────────────────────────────────────
if (command === 'clear') {
  const taskId = args[0];
  if (!taskId) { console.error('Usage: node bin/stuck.js clear <TASK-ID>'); process.exit(1); }
  const stuck = loadStuck();
  if (!stuck[taskId]) { console.error(`Not found: ${taskId}`); process.exit(1); }
  stuck[taskId].resolved = true;
  stuck[taskId].resolvedAt = new Date().toISOString();
  write(STUCK_FILE, stuck);
  console.log(`✅ ${taskId} marked as resolved.`);
  console.log(`   Don't forget: git add data/claims/ && HUSKY=0 git commit --no-verify -m "fix: resolved blocker ${taskId}"`);
  process.exit(0);
}

// ── mark stuck ────────────────────────────────────────────────────────────────
const taskId = command;
const reason = args.join(' ');

if (!taskId.match(/^S\d+-[A-Z0-9]+$/)) {
  console.error(`\nUsage: node bin/stuck.js <TASK-ID> "<razón>"`);
  console.error(`       node bin/stuck.js list`);
  console.error(`       node bin/stuck.js clear <TASK-ID>`);
  console.error(`\nExample: node bin/stuck.js S3-24 "No encuentro el endpoint de disponibilidad"`);
  process.exit(1);
}

if (!reason) {
  console.error(`\nError: debes explicar por qué estás bloqueado.`);
  console.error(`Ejemplo: node bin/stuck.js ${taskId} "Falta variable de entorno STRIPE_KEY"`);
  process.exit(1);
}

// Get agent name from claim if available
const claim = loadClaim(taskId);
const agent = claim?.agent || process.env.AGENT_NAME || 'unknown';

// Release the claim so another agent can try (v2: delete individual file)
if (claim) {
  deleteClaim(taskId);
  console.log(`🔓 Claim released for ${taskId}`);
}

// Register the blocker
const stuck = loadStuck();
stuck[taskId] = {
  agent,
  reason,
  stuckAt: new Date().toISOString(),
  resolved: false,
  resolvedAt: null,
};
write(STUCK_FILE, stuck);

console.log(`\n🚧 Bloqueado registrado: ${taskId}`);
console.log(`   Razón: ${reason}`);
console.log(`   El claim ha sido liberado para que otro agente pueda intentarlo.`);
console.log(`\n   Próximos pasos:`);
console.log(`   1. git add data/claims/ && HUSKY=0 git commit --no-verify -m "stuck: ${taskId} — ${reason.slice(0,50)}" && git push origin main`);
console.log(`   2. El dueño verá este bloqueo en: npm run report`);
console.log(`   3. El dueño responde en BLOCKERS.md o en el commit`);
console.log(`   4. Cuando esté resuelto: node bin/stuck.js clear ${taskId}\n`);

