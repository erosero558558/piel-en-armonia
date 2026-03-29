#!/usr/bin/env node
/**
 * bin/sync-backlog.js — Genera BACKLOG.md: índice lean de tareas pendientes
 *
 * AGENTS.md tiene ~1100 líneas de contexto, reglas, historia.
 * BACKLOG.md solo tiene las tareas [ ] pendientes, agrupadas por sprint.
 * Los agentes leen BACKLOG.md para encontrar trabajo rápido.
 *
 * Uso:
 *   node bin/sync-backlog.js         ← genera/actualiza BACKLOG.md
 *   node bin/sync-backlog.js --check ← solo verifica si está sincronizado
 *
 * Se debe ejecutar:
 *   - Después de marcar tareas [x] en AGENTS.md
 *   - Por el workflow /status automáticamente
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const BACKLOG_FILE = resolve(ROOT, 'BACKLOG.md');
const CLAIMS_FILE = resolve(ROOT, 'data/claims/tasks.json');

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }
function loadClaims() { try { return JSON.parse(read(CLAIMS_FILE)); } catch { return {}; } }
function isExpired(c) { return c?.expiresAt && new Date(c.expiresAt) < new Date(); }

const CHECK_MODE = process.argv.includes('--check');

const md = read(AGENTS_FILE);
const claims = loadClaims();
const lines = md.split('\n');

// ── Parse tasks grouped by sprint ─────────────────────────────────────────────
const sprints = {};
const sprintOrder = [];
let currentSprint = null;
let inHuman = false;

// Dependency map: task → must-be-done-before starting
const DEPENDS_ON = {
  'S2-24': ['S2-23'],            // EN pages need ES page audit first
  'S3-09': ['S3-08'],            // payment ledger needs payment capture
  'S3-25': ['S3-24'],            // confirm booking → booking must exist
  'S3-26': ['S3-24'],            // reschedule → booking must exist
  'S3-27': ['S3-24'],            // waitlist → booking must exist
  'S3-31': ['S3-29', 'S3-30'],   // photo triage → tele flow must exist
  'S4-22': ['S4-21'],            // delete orphans → must audit first
  'S4-23': ['S4-21'],            // package.json audit → after surface audit
  'S4-10': ['S4-06'],            // multi-clinic dashboard → tenant isolation first
  'S4-11': ['S4-06'],            // whitelabel → tenant isolation first
};

lines.forEach(line => {
  // Match ALL sprint headers including Sprint 0 (✅) and active sprints (🔴🟡🟢🔵)
  const sprintMatch = line.match(/^### [✅🔴🟡🟢🔵] (Sprint \d+.*?)$/);
  if (sprintMatch) {
    currentSprint = sprintMatch[1].trim();
    if (!sprints[currentSprint]) {
      sprints[currentSprint] = { tasks: [], done: 0, total: 0 };
      sprintOrder.push(currentSprint);
    }
    return;
  }


  if (!currentSprint) return;


  // Parse task lines
  const taskMatch = line.match(/^- \[([ x])\] \*\*(S\d+-\d+)\*\*\s+`\[([SMLX]+)\]`(.*)/);
  if (!taskMatch) return;

  const [, status, id, size, rest] = taskMatch;
  const done = status === 'x';
  const human = line.includes('[HUMAN]');
  const blocked = !done && DEPENDS_ON[id] ? DEPENDS_ON[id] : [];
  const claim = claims[id];
  const claimed = claim && !isExpired(claim);

  sprints[currentSprint].total++;
  if (done) sprints[currentSprint].done++;

  if (!done) {
    sprints[currentSprint].tasks.push({
      id, size, human, claimed, blocked,
      description: rest.replace(/^\s+/, '').replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim(),
      agent: claimed ? claim.agent : null,
    });
  }
});

// ── Find current active sprint ─────────────────────────────────────────────
// Active sprint = first sprint that has pending (non [x]) tasks
const activeSprintName = sprintOrder.find(s => {
  const sp = sprints[s];
  // Sprint is active if it has tasks and any are pending
  return sp.total > 0 && (sp.total - sp.done) > 0;
}) || sprintOrder[sprintOrder.length - 1];


// ── Generate BACKLOG.md ───────────────────────────────────────────────────────
const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
const totalDone = sprintOrder.reduce((a, s) => a + sprints[s].done, 0);
const totalAll = sprintOrder.reduce((a, s) => a + sprints[s].total, 0);

const output = [];

output.push(`# BACKLOG.md — Tareas Pendientes Aurora Derm`);
output.push(`_Generado: ${now} | Fuente: AGENTS.md_`);
output.push(`_Para contexto completo de cada tarea → lee **AGENTS.md**_`);
output.push(``);
output.push(`> **Para agentes:** usa \`npm run dispatch:<rol>\` para obtener tu tarea.`);
output.push(`> Luego \`node bin/claim.js claim <ID> "<nombre>"\` antes de empezar.`);
output.push(``);

// Progress overview
output.push(`## Estado General`);
output.push(``);
const pct = Math.round((totalDone / totalAll) * 100);
const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
output.push(`\`${bar}\` **${pct}%** completado (${totalDone}/${totalAll})`);
output.push(``);
output.push(`| Sprint | Hecho | Pendiente | % |`);
output.push(`|--------|-------|-----------|---|`);
sprintOrder.forEach(s => {
  const { done, total, tasks } = sprints[s];
  const pending = total - done;
  const p = total > 0 ? Math.round((done / total) * 100) : 0;
  const emoji = p === 100 ? '✅' : s === activeSprintName ? '🎯' : '⏸';
  output.push(`| ${emoji} ${s.split(' — ')[0]} | ${done} | ${pending} | ${p}% |`);
});
output.push(``);

// Tasks by sprint — only show active sprint fully, others summarized
sprintOrder.forEach(s => {
  const { tasks, done, total } = sprints[s];
  const pending = total - done;
  const isActive = s === activeSprintName;
  const isDone = pending === 0;

  if (isDone) {
    output.push(`## ✅ ${s}`);
    output.push(`_Sprint completado. ${done}/${total} tareas._`);
    output.push(``);
    return;
  }

  output.push(`## ${isActive ? '🎯 ' : '⏸ '}${s}`);
  if (!isActive) {
    output.push(`_Esperando que Sprint anterior esté completo. ${pending} tareas pendientes._`);
    // Still show the first 5 so agents can plan
  }
  output.push(``);

  if (tasks.length === 0) {
    output.push(`_Sin tareas pendientes._`);
    output.push(``);
    return;
  }

  // Categorize tasks
  const available   = tasks.filter(t => !t.human && !t.claimed && t.blocked.length === 0);
  const claimed     = tasks.filter(t => t.claimed);
  const blocked     = tasks.filter(t => !t.human && !t.claimed && t.blocked.length > 0);
  const human       = tasks.filter(t => t.human);

  const sizeOrder = { S: 0, M: 1, L: 2, XL: 3 };
  available.sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]);

  if (available.length > 0) {
    output.push(`### 🟢 Disponibles (${available.length})`);
    output.push(``);
    output.push(`| ID | Tamaño | Tarea |`);
    output.push(`|----|--------|-------|`);
    available.slice(0, isActive ? 999 : 5).forEach(t => {
      const desc = t.description.slice(0, 70) + (t.description.length > 70 ? '...' : '');
      output.push(`| **${t.id}** | \`[${t.size}]\` | ${desc} |`);
    });
    if (!isActive && available.length > 5) output.push(`| ... | | _+${available.length - 5} más_ |`);
    output.push(``);
  }

  if (claimed.length > 0) {
    output.push(`### 🔒 En progreso — NO tomar`);
    output.push(``);
    claimed.forEach(t => {
      const mins = Math.round((new Date(claims[t.id].expiresAt) - new Date()) / 60000);
      output.push(`- **${t.id}** \`[${t.size}]\` → _${t.agent}_ (expira en ${mins}min)`);
    });
    output.push(``);
  }

  if (blocked.length > 0) {
    output.push(`### 🔗 Bloqueadas (necesitan prerequisito)`);
    output.push(``);
    blocked.forEach(t => {
      output.push(`- **${t.id}** \`[${t.size}]\` — necesita: ${t.blocked.join(', ')} primero`);
    });
    output.push(``);
  }

  if (human.length > 0) {
    output.push(`### 🙋 Requieren respuesta del dueño → ver BLOCKERS.md`);
    output.push(``);
    human.forEach(t => {
      output.push(`- **${t.id}** \`[${t.size}]\` ${t.description.slice(0, 60)}...`);
    });
    output.push(``);
  }
});

output.push(`---`);
output.push(`_Este archivo es generado automáticamente. No editarlo a mano._`);
output.push(`_Para actualizar: \`node bin/sync-backlog.js\`_`);

const result = output.join('\n') + '\n';

if (CHECK_MODE) {
  const current = read(BACKLOG_FILE);
  if (current === result) {
    console.log('✅ BACKLOG.md is up to date');
    process.exit(0);
  } else {
    console.log('⚠️  BACKLOG.md is out of date. Run: node bin/sync-backlog.js');
    process.exit(1);
  }
}

writeFileSync(BACKLOG_FILE, result, 'utf8');
console.log(`✅ BACKLOG.md regenerated — ${totalDone}/${totalAll} done (${pct}%)`);
console.log(`   Active sprint: ${activeSprintName}`);
console.log(`   Available tasks: ${sprints[activeSprintName]?.tasks.filter(t => !t.human && !t.claimed && t.blocked.length === 0).length || 0}`);
