#!/usr/bin/env node
/**
 * bin/dispatch.js — Asignación de tareas por tipo de agente
 *
 * Cada agente tiene un ROL. El dispatch encuentra la mejor tarea
 * disponible para su tipo, evitando que un agente de contenido
 * tome tareas de PHP o viceversa.
 *
 * Uso:
 *   node bin/dispatch.js --role content     ← blog, SEO, textos
 *   node bin/dispatch.js --role frontend    ← HTML, CSS, páginas
 *   node bin/dispatch.js --role backend     ← PHP, API, controladores
 *   node bin/dispatch.js --role devops      ← CI, limpieza, auditoría
 *   node bin/dispatch.js --role fullstack   ← cualquier tarea
 *
 * El output es el ID de tarea recomendado para ese rol.
 * Seguir con: node bin/claim.js claim <ID> "<agente>"
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_FILE = resolve(ROOT, 'data/claims/tasks.json');

function read(f) {
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
}

function loadClaims() {
  try { return JSON.parse(read(CLAIMS_FILE)); } catch { return {}; }
}

function isExpired(claim) {
  return claim?.expiresAt && new Date(claim.expiresAt) < new Date();
}

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let sprint = '';
  lines.forEach((line, i) => {
    if (line.match(/^### .*Sprint \d/)) sprint = line.trim();
    const m = line.match(/^- \[([ x])\] \*\*(S\d+-\d+)\*\*\s+`\[([SMLX]+)\]`(.*)/);
    if (m) tasks.push({
      id: m[2], done: m[1]==='x', size: m[3],
      human: line.includes('[HUMAN]'),
      sprint, description: m[4].trim(), line
    });
  });
  return tasks;
}

// ── Role → task affinity rules ────────────────────────────────────────────────
// Each role gets an ordered list of task ID patterns and keywords
// Higher in the array = higher priority for that role

const ROLE_AFFINITY = {
  content: {
    description: 'Blog posts, SEO copy, textos de servicio',
    prefer: ['S2-1', 'S2-11', 'S2-12', 'S2-13', 'S2-14', 'S2-15', 'S2-16', 'S2-17', 'S2-18'],
    keywords: ['blog', 'rss', 'feed', 'disclaimer', 'seo', 'contenido', 'texto', 'artículo', 'copy'],
    sprints: ['Sprint 2'],
    avoid: ['controlador', 'controller', 'php', 'api', 'queue', 'turnero', 'backend'],
  },
  frontend: {
    description: 'Páginas HTML, CSS, componentes UI',
    prefer: ['S2-19', 'S2-21', 'S2-22', 'S2-23', 'S3-05', 'S3-30', 'S3-32', 'S4-08', 'S4-13'],
    keywords: ['página', 'page', 'html', 'css', 'componente', 'vista', 'modal', 'formulario', 'form', 'booking', 'agendar', 'checkout', 'interfaz', 'badge', 'hero'],
    sprints: ['Sprint 2', 'Sprint 3', 'Sprint 4'],
    avoid: ['ClinicalHistoryService', 'QueueService', '.php', 'conductor', 'endpoint'],
  },
  backend: {
    description: 'PHP, APIs, servicios, lógica de negocio',
    prefer: ['S3-03', 'S3-04', 'S3-08', 'S3-09', 'S3-10', 'S3-14', 'S3-21', 'S3-25', 'S3-27'],
    keywords: ['php', 'api', 'controller', 'service', 'endpoint', 'backend', 'turnero', 'queue', 'journey', 'flow os', 'hce', 'clínica'],
    sprints: ['Sprint 3', 'Sprint 4'],
    avoid: ['blog', 'html estático', 'css', 'texto', 'contenido'],
  },
  devops: {
    description: 'CI/CD, limpieza de código, auditorías, performance',
    prefer: ['S4-21', 'S4-22', 'S4-23', 'S4-24', 'S4-25', 'S4-26', 'S1-12'],
    keywords: ['audit', 'limpieza', 'dead code', 'surface', 'ci', 'pipeline', 'lighthouse', 'performance', 'cache'],
    sprints: ['Sprint 4', 'Sprint 1'],
    avoid: ['blog', 'página', 'texto', 'contenido'],
  },
  fullstack: {
    description: 'Cualquier tarea disponible en orden de sprint',
    prefer: [],
    keywords: [],
    sprints: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'],
    avoid: [],
  },
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreTask(task, role, claims) {
  const config = ROLE_AFFINITY[role];
  if (!config) return -1000;

  let score = 0;

  // Already claimed → skip
  const claim = claims[task.id];
  if (claim && !isExpired(claim)) return -1000;

  // Done → skip
  if (task.done) return -1000;

  // Human → skip (handled separately)
  if (task.human) return -500;

  // Preferred task IDs for this role
  const prefIndex = config.prefer.indexOf(task.id);
  if (prefIndex !== -1) score += 100 - prefIndex;

  // Keyword match in description
  const desc = task.description.toLowerCase();
  config.keywords.forEach(kw => {
    if (desc.includes(kw.toLowerCase())) score += 20;
  });

  // Avoid keywords
  config.avoid.forEach(kw => {
    if (desc.includes(kw.toLowerCase())) score -= 30;
  });

  // Sprint preference
  const sprintIndex = config.sprints.findIndex(s => task.sprint.includes(s.replace('Sprint ', '')));
  if (sprintIndex !== -1) score += (config.sprints.length - sprintIndex) * 10;
  else score -= 20; // wrong sprint

  // Size preference: roles prefer different sizes
  const sizeBonus = { S: 5, M: 10, L: 8, XL: 2 };
  score += sizeBonus[task.size] || 0;

  return score;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const roleArg = process.argv.find(a => a.startsWith('--role='))?.split('=')[1]
  || (process.argv.indexOf('--role') !== -1 ? process.argv[process.argv.indexOf('--role') + 1] : null)
  || 'fullstack';

const listAll = process.argv.includes('--all');

if (roleArg === 'list-roles') {
  console.log('\n🎭 Roles disponibles:\n');
  Object.entries(ROLE_AFFINITY).forEach(([role, config]) => {
    console.log(`  ${role.padEnd(12)} — ${config.description}`);
  });
  console.log();
  process.exit(0);
}

if (!ROLE_AFFINITY[roleArg]) {
  console.error(`❌ Rol desconocido: "${roleArg}". Usa: ${Object.keys(ROLE_AFFINITY).join(', ')}`);
  process.exit(1);
}

const md = read(AGENTS_FILE);
const tasks = parseTasks(md);
const claims = loadClaims();
const config = ROLE_AFFINITY[roleArg];

// Score all tasks for this role
const scored = tasks
  .map(t => ({ ...t, score: scoreTask(t, roleArg, claims) }))
  .filter(t => t.score > -500)
  .sort((a, b) => b.score - a.score);

console.log(`\n🎭 Dispatch para rol: ${roleArg}`);
console.log(`   ${config.description}\n`);

if (scored.length === 0) {
  console.log('✅ No hay tareas disponibles para este rol. Todo está en proceso o completo.\n');
  process.exit(0);
}

const best = scored[0];
console.log(`📋 Tarea recomendada:`);
console.log(`   ID:     ${best.id}  [${best.size}]  (score: ${best.score})`);
console.log(`   Sprint: ${best.sprint.replace(/^### /, '')}`);
console.log(`   Tarea:  ${best.line.replace(/^- \[[ x]\] /, '').slice(0, 120)}...`);
console.log(`\n   Para tomar:`);
console.log(`   1. git pull origin main`);
console.log(`   2. node bin/claim.js claim ${best.id} "<tu-nombre>"`);
console.log(`   3. git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: ${best.id}" && git push`);
console.log(`   4. [hacer el trabajo — ver AGENTS.md para contexto completo]`);
console.log(`   5. node bin/claim.js release ${best.id}`);
console.log(`   6. git add . && HUSKY=0 git commit --no-verify -m "feat(${best.id}): ..." && git push\n`);

if (listAll && scored.length > 1) {
  console.log(`📊 Todas las tareas disponibles para rol "${roleArg}":`);
  scored.slice(0, 10).forEach(t => {
    const claimed = claims[t.id] && !isExpired(claims[t.id]);
    const status = claimed ? '🔒' : '✅';
    console.log(`   ${status} ${t.id} [${t.size}] (${t.score}) ${t.line.slice(0, 60).replace(/^- \[[ x]\] /, '')}...`);
  });
  console.log();
}
