#!/usr/bin/env node
/**
 * bin/velocity.js — Proyeccion de velocidad hacia junio 2026
 *
 * Responde la pregunta mas importante: ¿llegamos a junio con OpenClaw funcionando?
 *
 * Uso:
 *   node bin/velocity.js           -> proyeccion completa
 *   node bin/velocity.js --json    -> salida JSON para integrar en report
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { execSync } = require('child_process');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');
const JSON_MODE = process.argv.includes('--json');

const SPRINT_HEADER_PATTERN = /^### (.*Sprint (\d+|UI).*)/;
const TASK_LINE_PATTERN = /^- \[([ x])\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/;
const CRITICAL_SPRINTS = [3, 8, 9];

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let currentSprint = '';

  for (const line of lines) {
    const sprintMatch = line.match(SPRINT_HEADER_PATTERN);
    if (sprintMatch) currentSprint = sprintMatch[1].trim();

    const taskMatch = line.match(TASK_LINE_PATTERN);
    if (!taskMatch) continue;

    const done = taskMatch[1] === 'x';
    const id = taskMatch[2];
    const size = (line.match(/`\[(S|M|L|XL)\]`/) || [, 'M'])[1];
    const human = line.includes('[HUMAN]');
    const sprintStr = (currentSprint.match(/Sprint (\d+|UI)/) || [0, 0])[1];
    const sprint = sprintStr === 'UI' ? 99 : parseInt(sprintStr, 10);
    const hours = { S: 2, M: 4, L: 8, XL: 16 }[size] || 4;

    tasks.push({
      id,
      done,
      sprint,
      size,
      human,
      hours,
      sprintName: currentSprint,
    });
  }

  return tasks;
}

function getGitVelocity() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().split('T')[0];

    const log = execSync(`git log --oneline --since="${sinceStr}" 2>/dev/null`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const commits = log.trim().split('\n').filter(Boolean);
    const taskCommits = commits.filter((commit) =>
      /feat|fix|done:|claim:|S\d+-|UI\d*-/i.test(commit)
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

function getTasksCompletedLastWeek(tasks) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split('T')[0];

    const log = execSync(`git log --oneline --since="${sinceStr}" 2>/dev/null`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const taskIds = new Set();
    for (const line of log.split('\n')) {
      const matches = line.match(/(?:S\d+|UI\d*)-[A-Z0-9]+/g);
      if (matches) matches.forEach((id) => taskIds.add(id));
    }
    return taskIds.size || 1;
  } catch {
    return 1;
  }
}

function countSprintTasks(tasks, sprint) {
  const sprintTasks = tasks.filter((task) => task.sprint === sprint);
  return {
    sprint,
    total: sprintTasks.length,
    done: sprintTasks.filter((task) => task.done).length,
    pending: sprintTasks.filter((task) => !task.done && !task.human).length,
  };
}

function getSignal({ willFinishCriticalSprints, velocity }) {
  if (willFinishCriticalSprints && velocity >= 3) {
    return { color: '🟢', label: 'EN CAMINO' };
  }
  if (willFinishCriticalSprints && velocity >= 1) {
    return { color: '🟡', label: 'EN RIESGO' };
  }
  return { color: '🔴', label: 'ATRASADO' };
}

function buildVelocityReport({
  tasks,
  now = new Date(),
  launchDate = LAUNCH_DATE,
  criticalSprints = CRITICAL_SPRINTS,
  gitVelocity = getGitVelocity(),
  tasksLastWeek = getTasksCompletedLastWeek(tasks),
} = {}) {
  const weeksToJune = Math.max(
    1,
    Math.round((launchDate - now) / (7 * 24 * 3600 * 1000))
  );
  const daysToJune = Math.round((launchDate - now) / (24 * 3600 * 1000));

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.done).length;
  const pendingTasks = totalTasks - doneTasks;

  const sprint3Tasks = tasks.filter((task) => task.sprint === 3);
  const sprint3Done = sprint3Tasks.filter((task) => task.done).length;
  const sprint3Pending = sprint3Tasks.filter(
    (task) => !task.done && !task.human
  ).length;

  const criticalSprintBreakdown = criticalSprints.map((sprint) =>
    countSprintTasks(tasks, sprint)
  );
  const criticalSprintsTotal = criticalSprintBreakdown.reduce(
    (total, sprint) => total + sprint.total,
    0
  );
  const criticalSprintsDone = criticalSprintBreakdown.reduce(
    (total, sprint) => total + sprint.done,
    0
  );
  const criticalSprintsPending = criticalSprintBreakdown.reduce(
    (total, sprint) => total + sprint.pending,
    0
  );

  const openclawTasks = tasks.filter(
    (task) => task.id.includes('OC') || task.id.includes('oc')
  );
  const openclawDone = openclawTasks.filter((task) => task.done).length;

  const velocity = Math.max(1, tasksLastWeek);
  const weeksNeededAll = Math.ceil(pendingTasks / velocity);
  const weeksNeededSprint3 = Math.ceil(sprint3Pending / velocity);
  const weeksNeededCriticalSprints = Math.ceil(criticalSprintsPending / velocity);
  const projectedDoneAll = Math.round(doneTasks + velocity * weeksToJune);
  const projectedPct = Math.min(
    100,
    Math.round((projectedDoneAll / Math.max(totalTasks, 1)) * 100)
  );

  const willFinishSprint3 = weeksNeededSprint3 <= weeksToJune;
  const willFinishCriticalSprints = weeksNeededCriticalSprints <= weeksToJune;
  const willFinishAll = weeksNeededAll <= weeksToJune;
  const signal = getSignal({ willFinishCriticalSprints, velocity });

  return {
    signal,
    now,
    launchDate,
    daysToJune,
    weeksToJune,
    velocity,
    doneTasks,
    totalTasks,
    pendingTasks,
    pctDone: Math.round((doneTasks / Math.max(totalTasks, 1)) * 100),
    sprint3Done,
    sprint3Pending,
    sprint3Total: sprint3Tasks.length,
    criticalSprints,
    criticalSprintsDone,
    criticalSprintsPending,
    criticalSprintsTotal,
    criticalSprintBreakdown,
    weeksNeededCriticalSprints,
    weeksNeededSprint3,
    willFinishSprint3,
    willFinishCriticalSprints,
    openclawDone,
    openclawTotal: openclawTasks.length,
    projectedDoneAll,
    projectedPct,
    commitsPerDay: gitVelocity.commitsPerDay,
    weeksNeededAll,
    willFinishAll,
  };
}

function formatVelocityText(report) {
  const {
    signal,
    now,
    daysToJune,
    weeksToJune,
    totalTasks,
    doneTasks,
    pendingTasks,
    criticalSprints,
    criticalSprintsDone,
    criticalSprintsTotal,
    criticalSprintsPending,
    criticalSprintBreakdown,
    willFinishCriticalSprints,
    openclawDone,
    openclawTotal,
    velocity,
    commitsPerDay,
    weeksNeededCriticalSprints,
    projectedDoneAll,
    projectedPct,
    weeksNeededAll,
    willFinishAll,
  } = report;

  const criticalLabel = criticalSprints.join(', ');
  const breakdownLabel = criticalSprintBreakdown
    .map(
      (sprint) =>
        `Sprint ${sprint.sprint}: ${sprint.done}/${sprint.total} (${sprint.pending} pendientes)`
    )
    .join(' | ');

  return `
╔════════════════════════════════════════════════════════╗
║  Aurora Derm — Proyección de Velocidad hacia Junio 2026 ║
╚════════════════════════════════════════════════════════╝

  ${signal.color}  Estado: ${signal.label}

  📅  Hoy: ${now.toLocaleDateString('es-EC')}
  🎯  Objetivo: 1 junio 2026 (${daysToJune} días · ${weeksToJune} semanas)

  ══ Progreso General ══
  Total tareas:    ${totalTasks}
  Completadas:     ${doneTasks} (${Math.round((doneTasks / Math.max(totalTasks, 1)) * 100)}%)
  Pendientes:      ${pendingTasks}

  ══ Sprints críticos para junio (${criticalLabel}) ══
  Completadas:     ${criticalSprintsDone}/${criticalSprintsTotal} (${Math.round((criticalSprintsDone / Math.max(criticalSprintsTotal, 1)) * 100)}%)
  Pendientes:      ${criticalSprintsPending}
  ¿Terminan a tiempo?: ${willFinishCriticalSprints ? '✅ SÍ' : '❌ NO — requiere acelerar'}
  Desglose:        ${breakdownLabel}

  ══ OpenClaw Core ══
  Completadas:     ${openclawDone}/${openclawTotal}

  ══ Velocidad Real (últimos 7 días) ══
  Tareas/semana:   ${velocity}
  Commits/día:     ${commitsPerDay}
  Semanas para sprints críticos: ${weeksNeededCriticalSprints} semanas necesarias
  Disponibles:     ${weeksToJune} semanas hasta junio

  ══ Proyección al 1 junio ══
  Tareas que se completarán: ~${projectedDoneAll}/${totalTasks} (${projectedPct}%)
  Todo el backlog en: ${weeksNeededAll} semanas (${willFinishAll ? '✅ antes de junio' : '❌ después de junio'})

${signal.color === '🔴' ? `
  ⚠️  ACCIÓN REQUERIDA:
  Si los sprints críticos no terminan antes de junio, el lanzamiento falla.
  Opciones:
  1. Aumentar agentes paralelos en Sprint 3/8/9
  2. Reducir alcance — ver LAUNCH.md para prioridades críticas
  3. Posponer Sprint 4+ hasta después de junio (ya está en el plan)
` : ''}${signal.color === '🟡' ? `
  💡  RECOMENDACIÓN:
  Velocidad baja pero aún posible. Necesitas ${Math.ceil(criticalSprintsPending / weeksToJune)} tareas/semana
  para llegar a tiempo. Actual: ${velocity}/semana.
  Foco en Sprint 3, Sprint 8 y Sprint 9.
` : ''}${signal.color === '🟢' ? `
  ✅  Todo en orden. Mantén el ritmo de ${velocity}+ tareas/semana.
  Siguiente revisión: ${(() => {
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString('es-EC');
  })()}
` : ''}
`;
}

function main() {
  const md = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
  const tasks = parseTasks(md);
  const report = buildVelocityReport({ tasks });

  if (JSON_MODE) {
    console.log(
      JSON.stringify({
        signal: report.signal.label,
        daysToJune: report.daysToJune,
        weeksToJune: report.weeksToJune,
        velocity: report.velocity,
        doneTasks: report.doneTasks,
        totalTasks: report.totalTasks,
        pctDone: report.pctDone,
        sprint3Done: report.sprint3Done,
        sprint3Pending: report.sprint3Pending,
        criticalSprints: report.criticalSprints,
        criticalSprintsDone: report.criticalSprintsDone,
        criticalSprintsPending: report.criticalSprintsPending,
        criticalSprintsTotal: report.criticalSprintsTotal,
        criticalSprintBreakdown: report.criticalSprintBreakdown,
        willFinishSprint3: report.willFinishSprint3,
        willFinishCriticalSprints: report.willFinishCriticalSprints,
        projectedPct: report.projectedPct,
        openclawDone: report.openclawDone,
        openclawTotal: report.openclawTotal,
        commitsPerDay: report.commitsPerDay,
      })
    );
    return;
  }

  console.log(formatVelocityText(report));
}

if (require.main === module) {
  main();
}

module.exports = {
  CRITICAL_SPRINTS,
  buildVelocityReport,
  formatVelocityText,
  getGitVelocity,
  getSignal,
  getTasksCompletedLastWeek,
  parseTasks,
};
