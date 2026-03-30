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

'use strict';

const { readFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT = process.env.AURORA_DERM_ROOT
  ? resolve(process.env.AURORA_DERM_ROOT)
  : resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks');
const LEGACY_FILE = resolve(ROOT, 'data/claims/tasks.json');

function read(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function loadAllClaims() {
  const claims = {};

  try {
    const files = readdirSync(CLAIMS_DIR).filter((file) => file.endsWith('.json'));
    for (const file of files) {
      const id = file.replace('.json', '');
      try {
        claims[id] = JSON.parse(readFileSync(join(CLAIMS_DIR, file), 'utf8'));
      } catch {}
    }
  } catch {}

  try {
    const legacy = JSON.parse(read(LEGACY_FILE));
    for (const [id, data] of Object.entries(legacy)) {
      if (!claims[id]) {
        claims[id] = data;
      }
    }
  } catch {}

  return claims;
}

function isExpired(claim, now = new Date()) {
  return claim?.expiresAt && new Date(claim.expiresAt) < now;
}

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let sprint = '';
  let sprintNum = 0;

  for (const line of lines) {
    if (line.match(/^### .*Sprint (\d+)/)) {
      sprint = line.trim();
      const match = line.match(/Sprint (\d+)/);
      if (match) {
        sprintNum = parseInt(match[1], 10);
      }
    }

    if (line.match(/^### .*Sprint UI/)) {
      sprint = line.trim();
      sprintNum = 99;
    }

    const match = line.match(
      /^- \[([ x])\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*\s+`\[([SMLX]+)\]`(.*)/
    );
    if (match) {
      tasks.push({
        id: match[2],
        done: match[1] === 'x',
        size: match[3],
        human: line.includes('[HUMAN]'),
        critical:
          line.includes('\uD83D\uDD34') ||
          line.toLowerCase().includes('cr\u00edtico') ||
          line.includes('**Es el documento'),
        uiTag: line.includes('[UI]'),
        sprint,
        sprintNum,
        description: match[4].trim(),
        line: line.trim(),
      });
    }
  }

  return tasks;
}

const ROLE_AFFINITY = {
  backend: {
    description: 'PHP, APIs, servicios, lógica de negocio',
    prefer: [
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
    wipLimit: 2,
  },

  frontend: {
    description: 'HTML, CSS, UI, vistas en admin y público',
    prefer: [
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
    wipLimit: 1,
  },

  content: {
    description: 'Blog posts, SEO copy, textos de servicio',
    prefer: [
      'S2-14',
      'S2-15',
      'S2-16',
      'S2-17',
      'S2-18',
      'S4-14',
      'S4-18',
    ],
    keywords: [
      'blog', 'rss', 'seo', 'contenido', 'texto', 'artículo', 'copy',
      'descripción', 'meta', 'schemaorg', 'faq', 'testimonios',
    ],
    sprints: ['Sprint 2', 'Sprint 4'],
    avoid: ['php', 'api', 'controller', 'queue', 'turnero', 'backend', 'hce'],
    sizes: ['S', 'M'],
    wipLimit: 1,
  },

  devops: {
    description: 'CI/CD, limpieza, auditorías, performance, testing',
    prefer: [
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
    wipLimit: 2,
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
    wipLimit: 2,
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
    sprints: ['Sprint UI'],
    avoid: ['php', 'controller', 'service', 'repository', 'api.php', 'routes.php'],
    sizes: ['S', 'M', 'L', 'XL'],
    exclusive: true,
    agent: 'Antigravity',
    wipLimit: 1,
  },
};

function scoreTask(task, role, claims) {
  const config = ROLE_AFFINITY[role];
  if (!config) {
    return -9999;
  }

  const claim = claims[task.id];
  if (claim && !isExpired(claim)) {
    return -9999;
  }
  if (task.done) {
    return -9999;
  }
  if (task.human) {
    return -500;
  }
  if (role === 'ui' && !task.uiTag) {
    return -9999;
  }

  let score = 0;

  if (task.uiTag) {
    score += 150;
  }

  const prefIdx = config.prefer.indexOf(task.id);
  if (prefIdx !== -1) {
    score += 200 - prefIdx * 3;
  }

  if (task.critical) {
    score += 50;
  }

  const desc = task.description.toLowerCase();
  if (!task.uiTag) {
    config.keywords.forEach((kw) => {
      if (desc.includes(kw.toLowerCase())) {
        score += 20;
      }
    });
    config.avoid.forEach((kw) => {
      if (desc.includes(kw.toLowerCase())) {
        score -= 40;
      }
    });
  } else {
    config.keywords.forEach((kw) => {
      if (desc.includes(kw.toLowerCase())) {
        score += 15;
      }
    });
  }

  const sprintOrder = config.sprints.map((s) => s.replace('Sprint ', ''));
  const spIdx = sprintOrder.findIndex(
    (s) => task.sprint.includes(s) || String(task.sprintNum) === s
  );
  if (spIdx !== -1) {
    score += (sprintOrder.length - spIdx) * 15;
  } else {
    score -= 25;
  }

  const sizePref = (config.sizes || ['S', 'M', 'L', 'XL']).indexOf(task.size);
  if (sizePref !== -1) {
    score += 10 - sizePref * 2;
  }

  return score;
}

function resolveRoleArg(argv = process.argv.slice(2)) {
  return argv.find((arg) => arg.startsWith('--role='))?.split('=')[1]
    || (argv.indexOf('--role') !== -1 ? argv[argv.indexOf('--role') + 1] : null)
    || 'fullstack';
}

function resolveWipLimit(roleArg, {
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const inlineArg = argv.find((arg) => arg.startsWith('--wip-limit='));
  const nextArgIndex = argv.indexOf('--wip-limit');
  const rawValue = inlineArg
    ? inlineArg.split('=')[1]
    : nextArgIndex !== -1
      ? argv[nextArgIndex + 1]
      : env[`DISPATCH_WIP_LIMIT_${String(roleArg).toUpperCase()}`]
        ?? env.DISPATCH_WIP_LIMIT_DEFAULT
        ?? ROLE_AFFINITY[roleArg]?.wipLimit
        ?? 0;

  const parsed = Number.parseInt(String(rawValue), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getActiveClaimsForRole(tasks, claims, roleArg, now = new Date()) {
  return tasks
    .filter((task) => {
      const claim = claims[task.id];
      if (!claim || isExpired(claim, now)) {
        return false;
      }

      return scoreTask(task, roleArg, {}) > -500;
    })
    .map((task) => ({
      ...task,
      claim: claims[task.id],
    }));
}

function formatNoTasksMessage(roleArg, tasks) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const pending = tasks.filter((task) => !task.done && !task.human).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
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

function formatMinutesRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return 'sin TTL';
  }
  const diffMinutes = Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60000)
  );
  return `${diffMinutes}m restantes`;
}

function buildDispatchResult({
  roleArg = 'fullstack',
  listAll = false,
  md = read(AGENTS_FILE),
  claims = loadAllClaims(),
  wipLimit = resolveWipLimit(roleArg),
  now = new Date(),
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
  const blocked = tasks.filter((task) => !task.done && task.human);
  const activeClaimsForRole = getActiveClaimsForRole(tasks, claims, roleArg, now);
  const wipLimited = wipLimit > 0 && activeClaimsForRole.length >= wipLimit;
  const scored = wipLimited
    ? []
    : tasks
      .map((task) => ({ ...task, score: scoreTask(task, roleArg, claims) }))
      .filter((task) => task.score > -500)
      .sort((a, b) => b.score - a.score);

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
    best: wipLimited ? null : scored[0] || null,
    wipLimit,
    wipLimited,
    activeClaimsForRole,
  };
}

function formatDispatchText(result) {
  if (!result.ok) {
    return `${result.error}\n`;
  }

  const {
    roleArg,
    listAll,
    config,
    tasks,
    claims,
    blocked,
    scored,
    best,
    wipLimit,
    wipLimited,
    activeClaimsForRole,
  } = result;
  const lines = [];

  lines.push(`\n🎭 Dispatch — rol: ${roleArg}`);
  lines.push(`   ${config.description}`);

  if (blocked.length > 0) {
    lines.push(`\n⚠️  Tareas bloqueadas [HUMAN] (${blocked.length}) — el director debe resolverlas:`);
    blocked.forEach((task) => {
      lines.push(`   ${task.id} [${task.size}] ${task.description.slice(0, 60)}...`);
    });
  }

  if (wipLimited) {
    lines.push(`\n⛔ WIP limit reached — termina una tarea antes.`);
    lines.push(`   Rol/lane: ${roleArg} | Límite: ${wipLimit} | Claims activos: ${activeClaimsForRole.length}`);
    lines.push(`\n   Claims activos en este rol:`);
    activeClaimsForRole.forEach((task) => {
      lines.push(
        `   - ${task.id} [${task.size}] → ${task.claim.agent || 'sin agente'} (${formatMinutesRemaining(task.claim.expiresAt)})`
      );
    });
    lines.push(`\n   Libera o cierra una tarea antes de pedir otra con dispatch.\n`);
    return `${lines.join('\n')}\n`;
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
    scored.slice(0, 10).forEach((task, index) => {
      const claimed = claims[task.id] && !isExpired(claims[task.id]);
      const status = claimed ? '🔒' : (task.critical ? '🔴' : '✅');
      const description = task.line.replace(/^- \[[ x]\] /, '').slice(0, 65);
      lines.push(`   ${index + 1}. ${status} ${task.id} [${task.size}] (${task.score}pts) ${description}...`);
    });
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const roleArg = resolveRoleArg(argv);
  const listAll = argv.includes('--all');

  if (roleArg === 'list-roles') {
    console.log('\n🎭 Roles disponibles:\n');
    Object.entries(ROLE_AFFINITY).forEach(([role, cfg]) => {
      console.log(`  ${role.padEnd(12)} — ${cfg.description}`);
    });
    console.log('\n  Uso: node bin/dispatch.js --role <rol> [--all] [--wip-limit <n>]\n');
    return 0;
  }

  const result = buildDispatchResult({
    roleArg,
    listAll,
    wipLimit: resolveWipLimit(roleArg, { argv }),
  });
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
  ROOT,
  buildDispatchResult,
  formatDispatchText,
  formatMinutesRemaining,
  getActiveClaimsForRole,
  isExpired,
  loadAllClaims,
  main,
  parseTasks,
  read,
  resolveRoleArg,
  resolveWipLimit,
  scoreTask,
};
