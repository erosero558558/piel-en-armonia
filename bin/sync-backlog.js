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

const { execFileSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT        = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const BACKLOG_FILE = resolve(ROOT, 'BACKLOG.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks'); // v2

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }
function loadClaims() {
  const claims = {};
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const id = f.replace('.json', '');
      try { claims[id] = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8')); } catch {}
    }
  } catch {}
  return claims;
}
function isExpired(c) { return c?.expiresAt && new Date(c.expiresAt) < new Date(); }
function syncReadmeStats() {
  try {
    execFileSync(process.execPath, [resolve(__dirname, 'gen-readme-stats.js')], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch {}
}

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
  // Sprint 2
  'S2-24': ['S2-23'],            // EN pages need ES page audit first
  // Sprint 3
  'S3-09': ['S3-08'],            // payment ledger needs payment capture
  'S3-25': ['S3-24'],            // confirm booking → booking must exist
  'S3-26': ['S3-24'],            // reschedule → booking must exist
  'S3-27': ['S3-24'],            // waitlist → booking must exist
  'S3-31': ['S3-29', 'S3-30'],   // photo triage → tele flow must exist
  // Sprint 4
  'S4-22': ['S4-21'],            // delete orphans → must audit first
  'S4-23': ['S4-21'],            // package.json audit → after surface audit
  'S4-10': ['S4-06'],            // multi-clinic dashboard → tenant isolation first
  'S4-11': ['S4-06'],            // whitelabel → tenant isolation first
  // Sprint 5 — Patient portal
  'S5-03': ['S5-02'],            // patient dashboard → login must exist
  'S5-04': ['S5-02'],            // historial → login must exist
  'S5-05': ['S5-02'],            // fotos → login must exist
  'S5-06': ['S5-02'],            // receta → login must exist
  'S5-07': ['S5-02'],            // plan → login must exist
  'S5-08': ['S5-01'],            // push notifications → PWA manifest first
  'S5-15': ['S5-16'],            // video room → pre-consult first
  'S5-19': ['S5-05'],            // before/after → patient photos first
  'S5-21': ['S5-04'],            // red flags patient → historial must exist
  // Sprint 6 — SaaS platform
  'S6-03': ['S6-02'],            // invite staff → clinic profile must exist
  'S6-04': ['S6-02'],            // activate modules → clinic profile must exist
  'S6-05': ['S6-01'],            // demo data → onboarding wizard must exist
  'S6-06': ['S6-02'],            // theme engine → clinic profile must exist
  'S6-07': ['S6-02'],            // custom domain → clinic profile must exist
  'S6-08': ['S6-06'],            // email branding → theme engine first
  'S6-09': ['S6-01'],            // app name → onboarding first
  'S6-11': ['S6-10'],            // Stripe billing → pricing defined first
  'S6-12': ['S6-11'],            // 14-day trial → billing must exist
  'S6-13': ['S6-11'],            // revenue dashboard → billing data must exist
  'S6-15': ['S6-14'],            // demo interactiva → landing must exist
  'S6-16': ['S6-14'],            // referral program → landing must exist
  'S6-17': ['S6-14'],            // case study → landing must exist
  'S6-19': ['S6-18'],            // API docs → API must exist
  'S6-20': ['S6-18'],            // webhooks → API must exist
  'S6-24': ['S6-23'],            // knowledge base → support tickets first
};


lines.forEach(line => {
  // Match ALL sprint headers: "### {emoji} Sprint N — description"
  // Use string approach to avoid emoji regex encoding issues
  const trimmed = line.trim();
  if (trimmed.startsWith('### ') && trimmed.includes(' Sprint ')) {
    // Extract "Sprint N — description" from "### {emoji} Sprint N — description"
    const after = trimmed.replace(/^###\s+\S+\s+/, '');  // remove "### {emoji} "
    if (after.startsWith('Sprint ')) {
      currentSprint = after.trim();
      if (!sprints[currentSprint]) {
        sprints[currentSprint] = { tasks: [], done: 0, total: 0 };
        sprintOrder.push(currentSprint);
      }
      return;
    }
  }


  if (!currentSprint) return;


  // Parse task lines — regex extendido: S3-09, S3-OC1, S4-21, etc.
  const taskMatch = line.match(/^- \[([ x])\] \*\*((S\d+|UI\d*)-[A-Z0-9]+)\*\*\s+`\[([SMLX]+)\]`(.*)/);
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
syncReadmeStats();
console.log(`✅ BACKLOG.md regenerated — ${totalDone}/${totalAll} done (${pct}%)`);
console.log(`   Active sprint: ${activeSprintName}`);
console.log(`   Available tasks: ${sprints[activeSprintName]?.tasks.filter(t => !t.human && !t.claimed && t.blocked.length === 0).length || 0}`);

// S13-16: Auto-regenerar sitemap.xml después de cada sync
try {
  const { spawnSync } = require('child_process');
  const r = spawnSync('node', [resolve(__dirname, 'gen-sitemap.js')], { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) {
    console.log('⚠️  gen-sitemap falló:', (r.stderr || '').trim().split('\n')[0]);
  }
} catch { /* gen-sitemap es opcional, no romper sync si falla */ }
