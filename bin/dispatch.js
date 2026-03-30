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
    description: 'PHP, APIs, servicios, lógica de negocio',
    prefer: [
      'S8-05',
      'S8-06',
      'S8-07',
      'S8-12',
      'S8-20',
      'S9-08',
      'S10-06',
      'S14-13',
      'S3-19',
      'S3-20',
      'S3-25',
      'S3-27',
      'S3-11',
      'S3-14',
      'S3-09',
      'S3-10',
      'S3-34',
      'S3-33',
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
    description: 'HTML, CSS, UI, vistas en admin y público',
    prefer: [
      'S9-01',
      'S9-09',
      'S10-01',
      'S10-25',
      'S12-17',
      'S3-15',
      'S3-09',
      'S3-28',
      'S3-18',
      'S3-13',
      'S3-17',
      'S3-26',
      'S3-30',
      'S3-32',
      'S4-08',
      'S4-13',
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
    description: 'CI/CD, limpieza, auditorías, performance, testing',
    prefer: [
      'S14-00',
      'S14-02',
      'S14-06',
      'S14-07',
      'S14-09',
      'S13-04',
      'S4-21',
      'S4-22',
      'S4-23',
      'S4-24',
      'S4-25',
      'S1-12',
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
    description: 'Cualquier tarea disponible — prioridad junio',
    prefer: [
      'S3-19', 'S3-20', 'S3-15', 'S3-24', 'S3-09',
      'S3-11', 'S3-18', 'S3-25', 'S3-28', 'S3-16',
      'S3-10', 'S3-12', 'S3-13',
    ],
    keywords: [],
    sprints: ['Sprint 3', 'Sprint 4', 'Sprint 2', 'Sprint 5', 'Sprint 6'],
    avoid: [],
    sizes: ['S', 'M', 'L', 'XL'],
  },

  ui: {
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
  // Hard filter inverso: rutas excludes chat no aplican cuando ya se tiene
  // el uiTag — ui tasks never avoid php/controller in keywords scan below

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

function formatNoTasksMessage(roleArg, tasks) {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = tasks.filter(t => !t.done && !t.human).length;
  const pct     = Math.round((done / total) * 100);
  const lines = [];

  lines.push(`\n🎉 Sin tareas asignadas para rol "${roleArg}".`);
  lines.push(`   Progreso: ${done}/${total} (${pct}%) — ${pending} pendientes globales\n`);

  if (pending === 0 && done >= total) {
    lines.push(`╔══════════════════════════════════════════════════════════════╗`);
    lines.push(`║  🏁  BACKLOG COMPLETADO — INICIO DEL CICLO DE MEJORA        ║`);
    lines.push(`╚══════════════════════════════════════════════════════════════╝\n`);
  }

  lines.push(`╔══════════════════════════════════════════════════════════════╗`);
  lines.push(`║  QUÉ HACER CUANDO NO HAY TAREAS DISPONIBLES                 ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════╝`);
  lines.push(`
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
  return lines.join('\n');
}

function buildDispatchResult({
  roleArg = 'fullstack',
  listAll = false,
  md = read(AGENTS_FILE),
  claims = loadAllClaims(),
} = {}) {
  if (!ROLE_AFFINITY[roleArg]) {
    return {
      ok: false,
      exitCode: 1,
      error: `❌ Rol desconocido: "${roleArg}". Usa: ${Object.keys(ROLE_AFFINITY).join(', ')}`,
    };
  }

  const tasks = parseTasks(md);
  const config = ROLE_AFFINITY[roleArg];
  const scored = tasks
    .map(t => ({ ...t, score: scoreTask(t, roleArg, claims) }))
    .filter(t => t.score > -500)
    .sort((a, b) => b.score - a.score);
  const blocked = tasks.filter(t => !t.done && t.human);

  return {
    ok: true,
    exitCode: 0,
    roleArg,
    listAll,
    config,
    tasks,
    claims,
    scored,
    blocked,
    best: scored[0] || null,
  };
}

function formatDispatchText(result) {
  if (!result.ok) {
    return `${result.error}\n`;
  }

  const { roleArg, config, tasks, claims, blocked, scored, best, listAll } = result;
  const lines = [];

  lines.push(`\n🎭 Dispatch — rol: ${roleArg}`);
  lines.push(`   ${config.description}`);

  if (blocked.length > 0) {
    lines.push(`\n⚠️  Tareas bloqueadas [HUMAN] (${blocked.length}) — el director debe resolverlas:`);
    blocked.forEach(t => lines.push(`   ${t.id} [${t.size}] ${t.description.slice(0, 60)}...`));
  }

  if (scored.length === 0) {
    lines.push(formatNoTasksMessage(roleArg, tasks));
    return `${lines.join('\n')}\n`;
  }

  lines.push(`\n📋 Tarea recomendada:`);
  lines.push(`   ID:      ${best.id}  [${best.size}]${best.critical ? '  🔴 CRÍTICA PARA JUNIO' : ''}`);
  lines.push(`   Sprint:  ${best.sprint.replace(/^### /, '')}`);
  lines.push(`   Tarea:   ${best.line.replace(/^- \[[ x]\] /, '').slice(0, 130)}`);
  lines.push(`\n   ── Flujo completo ──`);
  lines.push(`   1. git pull origin main`);
  lines.push(`   2. node bin/claim.js claim ${best.id} "<tu-nombre>"`);
  lines.push(`   3. git add data/claims/tasks/${best.id}.json && HUSKY=0 git commit --no-verify -m "claim: ${best.id}" && git push`);
  lines.push(`   4. Leer AGENTS.md → buscar **${best.id}** para contexto completo`);
  lines.push(`   5. Leer PRODUCT.md si es tu primera tarea (entiende el producto)`);
  lines.push(`   6. Hacer el trabajo`);
  lines.push(`   7. node bin/gate.js ${best.id}     ← validar ANTES de marcar done`);
  lines.push(`   8. node bin/claim.js release ${best.id}`);
  lines.push(`   9. Marcar [x] en AGENTS.md`);
  lines.push(`  10. git add . && HUSKY=0 git commit --no-verify -m "feat(${best.id}): descripción" && git push`);
  lines.push(`\n   Si te bloqueas: node bin/stuck.js ${best.id} "razón exacta"\n`);

  if (listAll && scored.length > 1) {
    lines.push(`📊 Top 10 para rol "${roleArg}":`);
    scored.slice(0, 10).forEach((t, i) => {
      const claimed = claims[t.id] && !isExpired(claims[t.id]);
      const status = claimed ? '🔒' : (t.critical ? '🔴' : '✅');
      const description = t.line.replace(/^- \[[ x]\] /, '').slice(0, 65);
      lines.push(`   ${i + 1}. ${status} ${t.id} [${t.size}] (${t.score}pts) ${description}...`);
    });
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const roleArg = argv.find(a => a.startsWith('--role='))?.split('=')[1]
    || (argv.indexOf('--role') !== -1 ? argv[argv.indexOf('--role') + 1] : null)
    || 'fullstack';
  const listAll = argv.includes('--all');

  if (roleArg === 'list-roles') {
    console.log('\n🎭 Roles disponibles:\n');
    Object.entries(ROLE_AFFINITY).forEach(([role, cfg]) => {
      console.log(`  ${role.padEnd(12)} — ${cfg.description}`);
    });
    console.log('\n  Uso: node bin/dispatch.js --role <rol> [--all]\n');
    return 0;
  }

  const result = buildDispatchResult({ roleArg, listAll });
  const output = formatDispatchText(result);

  if (result.ok) {
    console.log(output.trimEnd());
  } else {
    console.error(output.trimEnd());
  }

  return result.exitCode;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  AGENTS_FILE,
  CLAIMS_DIR,
  LEGACY_FILE,
  ROLE_AFFINITY,
  buildDispatchResult,
  formatDispatchText,
  isExpired,
  loadAllClaims,
  main,
  parseTasks,
  read,
  scoreTask,
};
