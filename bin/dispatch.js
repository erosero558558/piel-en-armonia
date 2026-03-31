#!/usr/bin/env node
/**
 * bin/dispatch.js v2 — Asignación de tareas por tipo de agente
 *
 * MEJORAS v2:
 *   - Regex ampliado: captura S3-OC1, S3-OC2, etc.
 *   - Usa sistema de claims v2 (archivos individuales)
 *   - Prioridades actualizadas para junio 2026
 *   - Criticidad desde LAUNCH.md baked in
 *   - Sprint actual siempre primero
 *
 * Uso:
 *   node bin/dispatch.js --role backend    ← PHP, APIs
 *   node bin/dispatch.js --role frontend   ← HTML, CSS, UI
 *   node bin/dispatch.js --role content    ← blog, SEO
 *   node bin/dispatch.js --role devops     ← CI, auditoría
 *   node bin/dispatch.js --role fullstack  ← cualquier tarea
 *   node bin/dispatch.js --role backend --all   ← ver todas con score
 *   node bin/dispatch.js list-roles        ← ver todos los roles
 */

const { readFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT        = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks');
const LEGACY_FILE = resolve(ROOT, 'data/claims/tasks.json');

function read(f) {
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
}

// ── Claims — usa v2 (archivos individuales) + fallback legacy ─────────────────

function loadAllClaims() {
  const claims = {};
  // v2: individual files
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const id = f.replace('.json', '');
      try { claims[id] = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8')); } catch {}
    }
  } catch {}
  // legacy fallback
  try {
    const legacy = JSON.parse(read(LEGACY_FILE));
    for (const [id, data] of Object.entries(legacy)) {
      if (!claims[id]) claims[id] = data;
    }
  } catch {}
  return claims;
}

function isExpired(claim) {
  return claim?.expiresAt && new Date(claim.expiresAt) < new Date();
}

// ── Task parser — captura S3-09, S3-OC1, S2-14, UI-01, UI-19, etc. ─────────────

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let sprint = '';
  let sprintNum = 0;

  for (const line of lines) {
    // Sprint normal: ### Sprint 3
    if (line.match(/^### .*Sprint (\d+)/)) {
      sprint = line.trim();
      const m = line.match(/Sprint (\d+)/);
      if (m) sprintNum = parseInt(m[1]);
    }
    // Sprint UI: ### 🎨 Sprint UI — Fase 1 o Fase 2
    if (line.match(/^### .*Sprint UI/)) {
      sprint = line.trim();
      sprintNum = 99; // UI sprint always sorts last, Antigravity picks it first via role filter
    }

    // Captura: S3-09, S3-OC1, S2-14, S4-21, UI-01, UI-19, UI2-01, UI2-20, etc.
    const m = line.match(/^- \[([ x])\] \*\*((S\d+|UI\d*)-[A-Z0-9]+)\*\*\s+`\[([SMLX]+)\]`(.*)/);
    if (m) {
      tasks.push({
        id:          m[2],
        done:        m[1] === 'x',
        size:        m[4],
        human:       line.includes('[HUMAN]'),
        critical:    line.includes('\uD83D\uDD34') || line.toLowerCase().includes('cr\u00edtico') || line.includes('**Es el documento'),
        uiTag:       line.includes('[UI]'),
        sprint,
        sprintNum,
        description: m[5].trim(),
        line:        line.trim(),
      });
    }
  }
  return tasks;
}

// ── ROLE_AFFINITY — actualizado para junio 2026 ───────────────────────────────
//
// PRIORIDADES JUNIO 2026 (lo que el médico necesita el día 1):
//   S3-19  Receta digital PDF                    (backend+frontend)
//   S3-20  Evolución clínica append-only         (backend+frontend)
//   S3-15  Anamnesis en admin                    (frontend)
//   S3-09  Vista operador expandida               (frontend)
//   S3-11  Ticket con QR                         (backend+frontend)
//   S3-18  Plan de tratamiento PDF               (frontend)
//   S3-24  Booking público                       (fullstack, XL)
//   S3-25  Confirmación WhatsApp+email            (backend)
//   S3-28  Agenda diaria en admin                (frontend)

const ROLE_AFFINITY = {
  backend: {
    wipLimit: 2,
    description: 'PHP, APIs, servicios, lógica de negocio',
    // Ordenados por impacto en el médico del día 1
    prefer: [
      'S3-19', // Receta digital — genera PDF con membrete
      'S3-20', // Evolución clínica — append-only, HCE
      'S3-25', // Confirmación WhatsApp+email al agendar
      'S3-27', // Lista de espera de citas
      'S3-11', // Ticket QR backend (TicketPrinter)
      'S3-14', // Métricas de espera — QueueAssistantMetricsStore
      'S3-09', // Vista operador — PatientCaseService::hydrateStore
      'S3-10', // Acciones post-consulta (backend de botones)
      'S3-34', // Estado de cuenta por paciente
      'S3-33', // Verificación de transferencia
      // S8-S10 con mayor impacto (S15-03 fix)
      'S8-05', 'S8-06', 'S8-07', 'S8-12', 'S8-20',
      'S9-08', 'S10-06',
      'S14-13',
      // S17-S19
      'S17-06', 'S17-07', 'S17-08', 'S17-10',
      'S19-04', 'S19-05', 'S19-06', 'S19-07', 'S19-08',
      'S19-10', 'S19-16', 'S19-17', 'S19-18',
    ],
    keywords: [
      'php', 'controller', 'service', 'endpoint', 'api', 'backend',
      'queue', 'journey', 'hce', 'pdf', 'whatsapp', 'store', 'json',
      'medicamento', 'receta', 'diagnóstico', 'certificado', 'evolución',
    ],
    sprints: ['Sprint 3', 'Sprint 4'],
    avoid: ['blog', 'html estático', 'css', 'texto seo', 'contenido'],
    sizes: ['M', 'L', 'S'],
  },

  frontend: {
    wipLimit: 1,
    description: 'HTML, CSS, UI, vistas en admin y público',
    prefer: [
      'S3-15', // Anamnesis — formulario en admin
      'S3-09', // Vista operador expandida
      'S3-28', // Agenda diaria — vista en admin
      'S3-18', // Plan de tratamiento — template PDF
      'S3-13', // Sala inteligente (turnos pantalla TV)
      'S3-17', // Comparación before/after — slider
      'S3-26', // Reagendamiento self-service (vista pública)
      'S3-30', // Sala teleconsulta (UI premium)
      'S3-32', // Checkout integrado
      'S4-08', // Portal del paciente
      'S4-13', // App kiosco offline-first
      // S9-S12 frontend (S15-03 fix)
      'S9-01', 'S9-09', 'S10-01', 'S10-25', 'S12-17',
      // S18-S19 customer success y adopción
      'S18-11', 'S18-12',
      'S19-01', 'S19-02', 'S19-03', 'S19-09', 'S19-11', 'S19-12',
    ],
    keywords: [
      'html', 'css', 'vista', 'página', 'modal', 'form', 'formulario',
      'admin', 'interfaz', 'componente', 'booking', 'checkout', 'slider',
      'sala', 'kiosco', 'operador', 'turnos', 'anamnesis', 'agenda',
      'teleconsulta', 'portal', 'paciente',
    ],
    sprints: ['Sprint 3', 'Sprint 4'],
    avoid: ['ClinicalHistoryService::php', '\\$router->add', 'mutate_store'],
    sizes: ['M', 'L', 'S'],
  },

  content: {
    wipLimit: 1,
    description: 'Blog posts, SEO copy, textos de servicio',
    prefer: [
      'S2-14', // Blog dermatología
      'S2-15', // Blog acné
      'S2-16', // Blog manchas
      'S2-17', // Blog laser
      'S2-18', // Blog cuidado piel hombres
      'S4-14', // Página de precios
      'S4-18', // Referidos
    ],
    keywords: [
      'blog', 'rss', 'seo', 'contenido', 'texto', 'artículo', 'copy',
      'descripción', 'meta', 'schemaorg', 'faq', 'testimonios',
    ],
    sprints: ['Sprint 2', 'Sprint 4'],
    avoid: ['php', 'api', 'controller', 'queue', 'turnero', 'backend', 'hce'],
    sizes: ['S', 'M'],
  },

  devops: {
    wipLimit: 1,
    description: 'CI/CD, limpieza, auditorías, performance, testing',
    prefer: [
      'S4-21', // Auditoria final pre-launch
      'S4-22', // Lighthouse score
      'S4-23', // Cache headers
      'S4-24', // Security headers
      'S4-25', // Dead code cleanup
      'S1-12', // Tests de contrato
      // S13-S15 devops (S15-03 fix)
      'S14-00', 'S14-02', 'S14-06', 'S14-07', 'S14-09', 'S13-04',
      // S19 tooling
      'S19-13', 'S19-14', 'S19-15',
    ],
    keywords: [
      'audit', 'limpieza', 'dead code', 'ci', 'pipeline', 'lighthouse',
      'performance', 'cache', 'seguridad', 'headers', 'test', 'spec',
    ],
    sprints: ['Sprint 4', 'Sprint 1'],
    avoid: ['blog', 'html', 'texto', 'contenido', 'formulario'],
    sizes: ['S', 'M'],
  },

  fullstack: {
    wipLimit: 2,
    description: 'Cualquier tarea disponible — prioridad junio',
    prefer: [
      'S3-19', 'S3-20', 'S3-15', 'S3-24', 'S3-09',
      'S3-11', 'S3-18', 'S3-25', 'S3-28', 'S3-16',
      'S3-10', 'S3-12', 'S3-13',
      // S17-S19 fullstack
      'S17-10', 'S17-15', 'S17-16', 'S17-17',
      'S18-11', 'S18-12',
      'S19-01', 'S19-02', 'S19-04', 'S19-08', 'S19-09',
    ],
    keywords: [],
    sprints: ['Sprint 3', 'Sprint 4', 'Sprint 2', 'Sprint 5', 'Sprint 6'],
    avoid: [],
    sizes: ['S', 'M', 'L', 'XL'],
  },

  ui: {
    wipLimit: 1,
    description: '🎨 ANTIGRAVITY EXCLUSIVO — Rediseño total UI/UX Aurora Derm',
    prefer: [
      'UI-01', 'UI-02', 'UI-03', 'UI-04', 'UI-05',
      'UI-06', 'UI-07', 'UI-08', 'UI-09', 'UI-10',
      'UI-11', 'UI-12', 'UI-13', 'UI-14', 'UI-15',
      'UI-16', 'UI-17', 'UI-18', 'UI-19',
    ],
    keywords: [
      '[UI]', 'diseño', 'ui', 'ux', 'interfaz', 'visual', 'componente',
      'design system', 'token', 'css variable', 'layout', 'grid',
      'animación', 'hover', 'glassmorphism', 'dark mode', 'responsive',
    ],
    // UI tasks have sprintNum=99, this filter ensures ONLY Sprint UI comes back
    sprints: ['Sprint UI'],
    avoid: ['php', 'controller', 'service', 'repository', 'api.php', 'routes.php'],
    sizes: ['S', 'M', 'L', 'XL'],
    exclusive: true,
    agent: 'Antigravity',
  },
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreTask(task, role, claims) {
  const config = ROLE_AFFINITY[role];
  if (!config) return -9999;

  // Hard filters
  const claim = claims[task.id];
  if (claim && !isExpired(claim)) return -9999;
  if (task.done)  return -9999;
  if (task.human) return -500;

  // ── Hard filter: rol ui SOLO acepta tareas con [UI] tag ───────────────────
  if (role === 'ui' && !task.uiTag) return -9999;

  // ── Hard filter INVERSO: roles NO-ui NUNCA aceptan tareas [UI] ─────────────
  // Esto previene que Codex (fullstack/backend) tome tareas reservadas a Antigravity.
  if (role !== 'ui' && task.uiTag) return -9999;

  // ── Sprint-level scope enforcement (carencia #5) ───────────────────────────
  // S7: seguridad de infraestructura — solo devops (y el director)
  const isS7 = task.id.startsWith('S7-');
  if (isS7 && role === 'content') return -9999;

  // S10: AI/OpenClaw clínico — requiere conocimiento de dominio médico
  // Solo backend senior puede tomarlas, frontend y content no
  const isS10 = task.id.startsWith('S10-');
  if (isS10 && (role === 'frontend' || role === 'content')) return -9999;

  // RB: Sprint REBORN — exclusivo para UI (Gemini bajo dirección de Antigravity)
  const isRB = task.id.startsWith('RB-');
  if (isRB && role !== 'ui') return -9999;

  let score = 0;

  // UI tag bonus — garantiza que UI tasks flotan primero en el rol ui
  if (task.uiTag) score += 150;

  // Explicit priority list for this role
  const prefIdx = config.prefer.indexOf(task.id);
  if (prefIdx !== -1) score += 200 - prefIdx * 3;

  // Critical flag (from LAUNCH.md analysis)
  if (task.critical) score += 50;

  // Keyword affinity in description
  const desc = task.description.toLowerCase();
  if (!task.uiTag) { // skip avoid check for UI tasks
    config.keywords.forEach(kw => { if (desc.includes(kw.toLowerCase())) score += 20; });
    config.avoid.forEach(kw    => { if (desc.includes(kw.toLowerCase())) score -= 40; });
  } else {
    config.keywords.forEach(kw => { if (desc.includes(kw.toLowerCase())) score += 15; });
  }

  // Sprint preference (current sprint first)
  const sprintOrder = config.sprints.map(s => s.replace('Sprint ', ''));
  const spIdx = sprintOrder.findIndex(s => task.sprint.includes(s) || String(task.sprintNum) === s);
  if (spIdx !== -1) score += (sprintOrder.length - spIdx) * 15;
  else score -= 25;

  // Size affinity
  const sizePref = (config.sizes || ['S','M','L','XL']).indexOf(task.size);
  if (sizePref !== -1) score += 10 - sizePref * 2;

  return score;

}

// ── Main ──────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const roleArg = args.find(a => a.startsWith('--role='))?.split('=')[1]
  || (args.indexOf('--role') !== -1 ? args[args.indexOf('--role') + 1] : null)
  || 'fullstack';
const listAll = args.includes('--all');

if (roleArg === 'list-roles') {
  console.log('\n🎭 Roles disponibles:\n');
  Object.entries(ROLE_AFFINITY).forEach(([role, cfg]) => {
    console.log(`  ${role.padEnd(12)} — ${cfg.description}`);
  });
  console.log('\n  Uso: node bin/dispatch.js --role <rol> [--all]\n');
  process.exit(0);
}

if (!ROLE_AFFINITY[roleArg]) {
  console.error(`❌ Rol desconocido: "${roleArg}". Usa: ${Object.keys(ROLE_AFFINITY).join(', ')}`);
  process.exit(1);
}

const md     = read(AGENTS_FILE);
const tasks  = parseTasks(md);
const claims = loadAllClaims();
const config = ROLE_AFFINITY[roleArg];

let activeWip = 0;
for (const [taskId, claimData] of Object.entries(claims)) {
  if (isExpired(claimData)) continue;
  const t = tasks.find(x => x.id === taskId);
  if (!t) continue;
  let bestR = null;
  let bestScore = -99999;
  for (const r of Object.keys(ROLE_AFFINITY)) {
    if (r !== 'ui' && t.uiTag) continue;
    if (r === 'ui' && !t.uiTag) continue;
    const s = scoreTask(t, r, {});
    if (s > bestScore) {
      bestScore = s;
      bestR = r;
    }
  }
  if (bestR === roleArg) activeWip++;
}

if (config.wipLimit && activeWip >= config.wipLimit) {
  console.log(`\n🛑 WIP limit reached — termina una tarea antes (${activeWip}/${config.wipLimit} claims activas para ${roleArg}).\n`);
  process.exit(0);
}

const scored = tasks
  .map(t => ({ ...t, score: scoreTask(t, roleArg, claims) }))
  .filter(t => t.score > -500)
  .sort((a, b) => b.score - a.score);

console.log(`\n🎭 Dispatch — rol: ${roleArg}`);
console.log(`   ${config.description}`);

// Bloqueadas actualmente
const blocked = tasks.filter(t => !t.done && t.human);
if (blocked.length > 0) {
  console.log(`\n⚠️  Tareas bloqueadas [HUMAN] (${blocked.length}) — el director debe resolverlas:`);
  blocked.forEach(t => console.log(`   ${t.id} [${t.size}] ${t.description.slice(0, 60)}...`));
}

if (scored.length === 0) {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = tasks.filter(t => !t.done && !t.human).length;
  const pct     = Math.round((done / total) * 100);

  console.log(`\n🎉 Sin tareas asignadas para rol "${roleArg}".`);
  console.log(`   Progreso: ${done}/${total} (${pct}%) — ${pending} pendientes globales\n`);

  if (pending === 0 && done >= total) {
    console.log(`╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  🏁  BACKLOG COMPLETADO — INICIO DEL CICLO DE MEJORA        ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  }

  console.log(`╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  QUÉ HACER CUANDO NO HAY TAREAS DISPONIBLES                 ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`
  1. Cambiar de rol (si eres fullstack):
       node bin/dispatch.js --role backend
       node bin/dispatch.js --role frontend
       node bin/dispatch.js --role content

  2. Esperar que expiren claims (4h):
       Los claims expiran automáticamente. Ejecuta dispatch en 4 horas.

  3. Auditar el código y crear tareas nuevas  ← EL MÁS VALIOSO:
       a) Lee LAUNCH.md → ¿hay críticos sin tarea?
       b) php -l controllers/*.php lib/**/*.php → ¿syntax errors?
       c) Revisa js/*.js → ¿funciones mencionadas pero no implementadas?
       d) Revisa templates/ → ¿placeholders sin contenido?
       e) Añade tareas en AGENTS.md con ID S3-XX o S4-XX
       f) git add AGENTS.md && HUSKY=0 git commit --no-verify \\
            -m "docs: +N tareas de auditoría" && git push origin main

  4. Revisar BLOCKERS.md:
       cat BLOCKERS.md
       Si algún bloqueo fue resuelto → quitar [HUMAN] y añadir instrucciones

  5. Adelantar Sprint 4 o 5:
       Lee AGENTS.md → sección Sprint 4 / Sprint 5
       Tareas de sprint futuro también son válidas

  6. Verificar calidad del trabajo existente:
       node bin/velocity.js      → ¿llegaremos a junio?
       node bin/verify.js        → board vs evidencia real
       node bin/merge-ready.js   → ¿ramas listas para integrar?

  REGLA DE ORO: un agente nunca está sin trabajo.
  Si no hay tareas asignadas → audita → crea tareas → empuja.
`);
  process.exit(0);
}

const best = scored[0];
console.log(`\n📋 Tarea recomendada:`);
console.log(`   ID:      ${best.id}  [${best.size}]${best.critical ? '  🔴 CRÍTICA PARA JUNIO' : ''}`);
console.log(`   Sprint:  ${best.sprint.replace(/^### /, '')}`);
console.log(`   Tarea:   ${best.line.replace(/^- \[[ x]\] /, '').slice(0, 130)}`);

// Lookup full task description in AGENTS.md for context
const taskSection = (() => {
  const lines = md.split('\n');
  const idx   = lines.findIndex(l => l.includes(`**${best.id}**`));
  if (idx === -1) return '';
  // Grab up to 3 lines of context
  return lines.slice(idx, idx + 1).join('\n');
})();

console.log(`\n   ── Flujo completo ──`);
console.log(`   1. git pull origin main`);
console.log(`   2. node bin/claim.js claim ${best.id} "<tu-nombre>"`);
console.log(`   3. git add data/claims/tasks/${best.id}.json && HUSKY=0 git commit --no-verify -m "claim: ${best.id}" && git push`);
console.log(`   4. Leer AGENTS.md → buscar **${best.id}** para contexto completo`);
console.log(`   5. Leer PRODUCT.md si es tu primera tarea (entiende el producto)`);
console.log(`   6. Hacer el trabajo`);
console.log(`   7. node bin/gate.js ${best.id}     ← validar ANTES de marcar done`);
console.log(`   8. node bin/claim.js release ${best.id}`);
console.log(`   9. Marcar [x] en AGENTS.md`);
console.log(`  10. git add . && HUSKY=0 git commit --no-verify -m "feat(${best.id}): descripción" && git push`);
console.log(`\n   Si te bloqueas: node bin/stuck.js ${best.id} "razón exacta"\n`);

if (listAll && scored.length > 1) {
  console.log(`📊 Top 10 para rol "${roleArg}":`);
  scored.slice(0, 10).forEach((t, i) => {
    const claimed     = claims[t.id] && !isExpired(claims[t.id]);
    const status      = claimed ? '🔒' : (t.critical ? '🔴' : '✅');
    const description = t.line.replace(/^- \[[ x]\] /, '').slice(0, 65);
    console.log(`   ${i + 1}. ${status} ${t.id} [${t.size}] (${t.score}pts) ${description}...`);
  });
  console.log();
}
