#!/usr/bin/env node
/**
 * bin/velocity.js — Proyección de velocidad hacia junio 2026
 *
 * Responde la pregunta más importante: ¿llegamos a junio con OpenClaw funcionando?
 *
 * Uso:
 *   node bin/velocity.js           → proyección completa
 *   node bin/velocity.js --json    → salida JSON para integrar en report
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { execSync } = require('child_process');

const ROOT       = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z'); // objetivo de lanzamiento

const JSON_MODE = process.argv.includes('--json');
const TASK_ID_PATTERN = /(?:S\d+|UI\d*)-[A-Z0-9]+/;
const TASK_ID_GLOBAL_PATTERN = /(?:S\d+|UI\d*)-[A-Z0-9]+/g;
const TASK_LINE_PATTERN = /^- \[([ x])\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/;
const SPRINT_HEADING_PATTERN = /^### (.*Sprint (\d+|UI).*)/;
const CRITICAL_JUNE_SPRINTS = [3, 8, 9];

// ── Parsear tareas ────────────────────────────────────────────────────────────

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let currentSprint = '';

  for (const line of lines) {
    const sm = line.match(SPRINT_HEADING_PATTERN);
    if (sm) currentSprint = sm[1].trim();

    const tm = line.match(TASK_LINE_PATTERN);
    if (tm) {
      const done   = tm[1] === 'x';
      const id     = tm[2];
      const size   = (line.match(/`\[(S|M|L|XL)\]`/) || [, 'M'])[1];
      const human  = line.includes('[HUMAN]');
      const sprintStr = (currentSprint.match(/Sprint (\d+|UI)/) || [0, 0])[1];
      const sprint = sprintStr === 'UI' ? 99 : parseInt(sprintStr);

      const hours = { S: 2, M: 4, L: 8, XL: 16 }[size] || 4;

      tasks.push({ id, done, sprint, size, human, hours, sprintName: currentSprint });
    }
  }
  return tasks;
}

function extractTaskIdsFromGitLog(log) {
  const taskIds = new Set();
  for (const line of String(log || '').split('\n')) {
    const matches = line.match(TASK_ID_GLOBAL_PATTERN);
    if (matches) matches.forEach(id => taskIds.add(id));
  }
  return [...taskIds];
}

// ── Calcular velocidad real desde git log ─────────────────────────────────────

function getGitVelocity(now = new Date(), runGitLog = defaultGitLog) {
  try {
    const since = new Date(now);
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().split('T')[0];

    const log = runGitLog(sinceStr);

    const commits = log.trim().split('\n').filter(Boolean);
    const taskCommits = commits.filter(c =>
      /feat|fix|done:|claim:/i.test(c) || TASK_ID_PATTERN.test(c)
    );

    return {
      totalCommits: commits.length,
      taskCommits: taskCommits.length,
      daysObserved: 14,
      commitsPerDay: Math.round((commits.length / 14) * 10) / 10,
    };
  } catch {
    return { totalCommits: 0, taskCommits: 0, daysObserved: 0, commitsPerDay: 0 };
  }
}

// ── Calcular tasks completadas por semana ─────────────────────────────────────

function getTasksCompletedLastWeek(now = new Date(), runGitLog = defaultGitLog) {
  try {
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split('T')[0];

    const log = runGitLog(sinceStr);
    const taskIds = extractTaskIdsFromGitLog(log);
    return taskIds.length || 1;
  } catch {
    return 1;
  }
}

function defaultGitLog(sinceStr) {
  return execSync(
    `git log --oneline --since="${sinceStr}" 2>/dev/null`,
    { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
  );
}

function buildVelocitySnapshot({
  md = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '',
  now = new Date(),
  launchDate = LAUNCH_DATE,
  gitVelocity = getGitVelocity(now),
  tasksLastWeek = getTasksCompletedLastWeek(now),
} = {}) {
  const tasks = parseTasks(md);
  const weeksToJune  = Math.max(1, Math.round((launchDate - now) / (7 * 24 * 3600 * 1000)));
  const daysToJune   = Math.round((launchDate - now) / (24 * 3600 * 1000));

  const totalTasks   = tasks.length;
  const doneTasks    = tasks.filter(t => t.done).length;
  const pendingTasks = totalTasks - doneTasks;
  const pctDone      = Math.round(doneTasks / Math.max(totalTasks, 1) * 100);

  const sprint3Tasks   = tasks.filter(t => t.sprint === 3);
  const sprint3Done    = sprint3Tasks.filter(t => t.done).length;
  const sprint3Pending = sprint3Tasks.filter(t => !t.done && !t.human).length;

  const criticalTasks = tasks.filter(t => CRITICAL_JUNE_SPRINTS.includes(t.sprint));
  const criticalDone = criticalTasks.filter(t => t.done).length;
  const criticalPending = criticalTasks.filter(t => !t.done && !t.human).length;

  const uiTaskTotal = tasks.filter(t => t.id.startsWith('UI')).length;
  const sprint8To14Total = tasks.filter(t => t.sprint >= 8 && t.sprint <= 14).length;

  const openclawTasks = tasks.filter(t => t.id.includes('OC') || t.id.includes('oc'));
  const openclawDone  = openclawTasks.filter(t => t.done).length;

  const velocity = Math.max(1, tasksLastWeek);

  const weeksNeededAll = Math.ceil(pendingTasks / velocity);
  const weeksNeededSprint3 = Math.ceil(sprint3Pending / velocity);
  const weeksNeededCritical = Math.ceil(criticalPending / velocity);
  const projectedDoneAll = Math.round(doneTasks + (velocity * weeksToJune));
  const projectedPct = Math.min(100, Math.round(projectedDoneAll / Math.max(totalTasks, 1) * 100));

  const willFinishSprint3 = weeksNeededSprint3 <= weeksToJune;
  const willFinishCritical = weeksNeededCritical <= weeksToJune;
  const willFinishAll = weeksNeededAll <= weeksToJune;

  function getSignal() {
    if (willFinishCritical && velocity >= 3) return { color: '🟢', label: 'EN CAMINO' };
    if (willFinishCritical && velocity >= 1) return { color: '🟡', label: 'EN RIESGO' };
    return { color: '🔴', label: 'ATRASADO' };
  }

  const signal = getSignal();

  return {
    signal: signal.label,
    signalColor: signal.color,
    daysToJune,
    weeksToJune,
    velocity,
    doneTasks,
    totalTasks,
    pendingTasks,
    pctDone,
    sprint3Done,
    sprint3Pending,
    sprint3Total: sprint3Tasks.length,
    criticalSprintIds: [...CRITICAL_JUNE_SPRINTS],
    criticalDone,
    criticalPending,
    criticalTotal: criticalTasks.length,
    willFinishSprint3,
    willFinishCritical,
    projectedPct,
    projectedDoneAll,
    openclawDone,
    openclawTotal: openclawTasks.length,
    uiTaskTotal,
    sprint8To14Total,
    commitsPerDay: gitVelocity.commitsPerDay,
    weeksNeededAll,
    weeksNeededSprint3,
    weeksNeededCritical,
    willFinishAll,
  };
}

function formatVelocityText(snapshot, now = new Date()) {
  return `
╔════════════════════════════════════════════════════════╗
║  Aurora Derm — Proyección de Velocidad hacia Junio 2026 ║
╚════════════════════════════════════════════════════════╝

  ${snapshot.signalColor}  Estado: ${snapshot.signal}

  📅  Hoy: ${now.toLocaleDateString('es-EC')}
  🎯  Objetivo: 1 junio 2026 (${snapshot.daysToJune} días · ${snapshot.weeksToJune} semanas)

  ══ Progreso General ══
  Total tareas:    ${snapshot.totalTasks}
  Completadas:     ${snapshot.doneTasks} (${snapshot.pctDone}%)
  Pendientes:      ${snapshot.pendingTasks}

  ══ Sprints Críticos para Junio (S3 + S8 + S9) ══
  Completadas:     ${snapshot.criticalDone}/${snapshot.criticalTotal} (${Math.round(snapshot.criticalDone / Math.max(snapshot.criticalTotal, 1) * 100)}%)
  Pendientes:      ${snapshot.criticalPending}
  ¿Terminan a tiempo?: ${snapshot.willFinishCritical ? '✅ SÍ' : '❌ NO — requiere acelerar'}

  ══ Sprint 3 — Referencia histórica ══
  Completadas:     ${snapshot.sprint3Done}/${snapshot.sprint3Total} (${Math.round(snapshot.sprint3Done / Math.max(snapshot.sprint3Total, 1) * 100)}%)
  Pendientes:      ${snapshot.sprint3Pending}

  ══ Cobertura del parser ══
  Tasks UI/Fases:  ${snapshot.uiTaskTotal}
  Tasks S8-S14:    ${snapshot.sprint8To14Total}

  ══ OpenClaw Core ══
  Completadas:     ${snapshot.openclawDone}/${snapshot.openclawTotal}

  ══ Velocidad Real (últimos 7 días) ══
  Tareas/semana:   ${snapshot.velocity}
  Commits/día:     ${snapshot.commitsPerDay}
  Semanas para críticos: ${snapshot.weeksNeededCritical} semanas necesarias
  Disponibles:     ${snapshot.weeksToJune} semanas hasta junio

  ══ Proyección al 1 junio ══
  Tareas que se completarán: ~${snapshot.projectedDoneAll}/${snapshot.totalTasks} (${snapshot.projectedPct}%)
  Todo el backlog en: ${snapshot.weeksNeededAll} semanas (${snapshot.willFinishAll ? '✅ antes de junio' : '❌ después de junio'})

${snapshot.signalColor === '🔴' ? `
  ⚠️  ACCIÓN REQUERIDA:
  Si los sprints críticos no terminan antes de junio, el lanzamiento falla.
  Opciones:
  1. Aumentar agentes paralelos en Sprint 3/S8/S9
  2. Reducir alcance — ver LAUNCH.md para prioridades críticas
  3. Posponer Sprint 4+ hasta después de junio (ya está en el plan)
` : ''}${snapshot.signalColor === '🟡' ? `
  💡  RECOMENDACIÓN:
  Velocidad baja pero aún posible. Necesitas ${Math.ceil(snapshot.criticalPending / snapshot.weeksToJune)} tareas/semana
  para llegar a tiempo. Actual: ${snapshot.velocity}/semana.
  Foco en tareas marcadas 🔴 CRÍTICO en S3/S8/S9.
` : ''}${snapshot.signalColor === '🟢' ? `
  ✅  Todo en orden. Mantén el ritmo de ${snapshot.velocity}+ tareas/semana.
  Siguiente revisión: ${(() => { const d = new Date(now); d.setDate(d.getDate() + 7); return d.toLocaleDateString('es-EC'); })()}
` : ''}
`;
}

function main() {
  const now = new Date();
  const snapshot = buildVelocitySnapshot({ now });

  if (JSON_MODE) {
    console.log(JSON.stringify(snapshot));
    return 0;
  }

  console.log(formatVelocityText(snapshot, now));
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  AGENTS_FILE,
  CRITICAL_JUNE_SPRINTS,
  LAUNCH_DATE,
  TASK_ID_PATTERN,
  buildVelocitySnapshot,
  defaultGitLog,
  extractTaskIdsFromGitLog,
  formatVelocityText,
  getGitVelocity,
  getTasksCompletedLastWeek,
  main,
  parseTasks,
};
