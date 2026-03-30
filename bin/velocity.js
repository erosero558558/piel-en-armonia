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

// ── Parsear tareas ────────────────────────────────────────────────────────────

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let currentSprint = '';

  for (const line of lines) {
    // Fix: captura Sprint UI (Fase 1/2/3) además de Sprint \d+
    const sm = line.match(/^### (.*Sprint (\d+|UI).*)/);
    if (sm) currentSprint = sm[1].trim();

    // Fix: captura S\d+, UI-01 (sin número), UI2-XX, UI3-XX, S14-00
    const tm = line.match(/^- \[([ x])\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/);
    if (tm) {
      const done   = tm[1] === 'x';
      const id     = tm[2];
      const size   = (line.match(/`\[(S|M|L|XL)\]`/) || [, 'M'])[1];
      const human  = line.includes('[HUMAN]');
      // Sprint UI → 99, otros → número real
      const sprintStr = (currentSprint.match(/Sprint (\d+|UI)/) || [0, 0])[1];
      const sprint = sprintStr === 'UI' ? 99 : parseInt(sprintStr);

      // Estimate hours by size
      const hours = { S: 2, M: 4, L: 8, XL: 16 }[size] || 4;

      tasks.push({ id, done, sprint, size, human, hours, sprintName: currentSprint });
    }
  }
  return tasks;
}

// ── Calcular velocidad real desde git log ─────────────────────────────────────

function getGitVelocity() {
  try {
    // Commits with feat/fix in last 14 days
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().split('T')[0];

    const log = execSync(
      `git log --oneline --since="${sinceStr}" 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const commits = log.trim().split('\n').filter(Boolean);
    // Fix: detecta UI-XX, UI2-XX, UI3-XX además de S\d+ en commits
    const taskCommits = commits.filter(c =>
      /feat|fix|done:|claim:|S\d+-|UI\d*-/i.test(c)
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

function getTasksCompletedLastWeek(tasks) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split('T')[0];

    const log = execSync(
      `git log --oneline --since="${sinceStr}" 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const taskIds = new Set();
    for (const line of log.split('\n')) {
      // Fix: captura UI-01, UI2-20, UI3-15, S14-00 además de S\d+
      const m = line.match(/(?:S\d+|UI\d*)-[A-Z0-9]+/g);
      if (m) m.forEach(id => taskIds.add(id));
    }
    return taskIds.size || 1; // mínimo 1 para no dividir por 0
  } catch {
    return 1;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const md    = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
const tasks = parseTasks(md);

const now          = new Date();
const weeksToJune  = Math.max(1, Math.round((LAUNCH_DATE - now) / (7 * 24 * 3600 * 1000)));
const daysToJune   = Math.round((LAUNCH_DATE - now) / (24 * 3600 * 1000));

const totalTasks   = tasks.length;
const doneTasks    = tasks.filter(t => t.done).length;
const pendingTasks = totalTasks - doneTasks;

// Tareas críticas para junio (Sprint 3, no bloqueadas)
const sprint3Tasks  = tasks.filter(t => t.sprint === 3);
const sprint3Done   = sprint3Tasks.filter(t => t.done).length;
const sprint3Pending = sprint3Tasks.filter(t => !t.done && !t.human).length;

// Tareas de OpenClaw (core del producto)
const openclawTasks = tasks.filter(t => t.id.includes('OC') || t.id.includes('oc'));
const openclawDone  = openclawTasks.filter(t => t.done).length;

// Velocidad real
const gitVelocity   = getGitVelocity();
const tasksLastWeek = getTasksCompletedLastWeek(tasks);
const velocity      = Math.max(1, tasksLastWeek); // tareas/semana

// Proyección
const weeksNeededAll    = Math.ceil(pendingTasks / velocity);
const weeksNeededSprint3 = Math.ceil(sprint3Pending / velocity);
const projectedDoneAll  = Math.round(doneTasks + (velocity * weeksToJune));
const projectedPct      = Math.min(100, Math.round(projectedDoneAll / totalTasks * 100));

const willFinishSprint3 = weeksNeededSprint3 <= weeksToJune;
const willFinishAll     = weeksNeededAll <= weeksToJune;

// Estado del semáforo
function getSignal() {
  if (willFinishSprint3 && velocity >= 3) return { color: '🟢', label: 'EN CAMINO' };
  if (willFinishSprint3 && velocity >= 1) return { color: '🟡', label: 'EN RIESGO' };
  return { color: '🔴', label: 'ATRASADO' };
}

const signal = getSignal();

if (JSON_MODE) {
  console.log(JSON.stringify({
    signal: signal.label,
    daysToJune,
    weeksToJune,
    velocity,
    doneTasks,
    totalTasks,
    pctDone: Math.round(doneTasks / totalTasks * 100),
    sprint3Done,
    sprint3Pending,
    openclawDone,
    openclawTotal: openclawTasks.length,
    willFinishSprint3,
    projectedPct,
    commitsPerDay: gitVelocity.commitsPerDay,
  }));
  process.exit(0);
}

// ── Salida legible ────────────────────────────────────────────────────────────

console.log(`
╔════════════════════════════════════════════════════════╗
║  Aurora Derm — Proyección de Velocidad hacia Junio 2026 ║
╚════════════════════════════════════════════════════════╝

  ${signal.color}  Estado: ${signal.label}

  📅  Hoy: ${now.toLocaleDateString('es-EC')}
  🎯  Objetivo: 1 junio 2026 (${daysToJune} días · ${weeksToJune} semanas)

  ══ Progreso General ══
  Total tareas:    ${totalTasks}
  Completadas:     ${doneTasks} (${Math.round(doneTasks/totalTasks*100)}%)
  Pendientes:      ${pendingTasks}

  ══ Sprint 3 — Crítico para Junio ══
  Completadas:     ${sprint3Done}/${sprint3Tasks.length} (${Math.round(sprint3Done/Math.max(sprint3Tasks.length,1)*100)}%)
  Pendientes:      ${sprint3Pending}
  ¿Termina a tiempo?: ${willFinishSprint3 ? '✅ SÍ' : '❌ NO — requiere acelerar'}

  ══ OpenClaw Core ══
  Completadas:     ${openclawDone}/${openclawTasks.length}

  ══ Velocidad Real (últimos 7 días) ══
  Tareas/semana:   ${velocity}
  Commits/día:     ${gitVelocity.commitsPerDay}
  Semanas para Sprint 3: ${weeksNeededSprint3} semanas necesarias
  Disponibles:     ${weeksToJune} semanas hasta junio

  ══ Proyección al 1 junio ══
  Tareas que se completarán: ~${projectedDoneAll}/${totalTasks} (${projectedPct}%)
  Todo el backlog en: ${weeksNeededAll} semanas (${willFinishAll ? '✅ antes de junio' : '❌ después de junio'})

${signal.color === '🔴' ? `
  ⚠️  ACCIÓN REQUERIDA:
  Si Sprint 3 no termina antes de junio, el lanzamiento falla.
  Opciones:
  1. Aumentar agentes paralelos en Sprint 3
  2. Reducir alcance — ver LAUNCH.md para prioridades críticas
  3. Posponer Sprint 4+ hasta después de junio (ya está en el plan)
` : ''}${signal.color === '🟡' ? `
  💡  RECOMENDACIÓN:
  Velocidad baja pero aún posible. Necesitas ${Math.ceil(sprint3Pending/weeksToJune)} tareas/semana
  para llegar a tiempo. Actual: ${velocity}/semana.
  Foco en tareas marcadas 🔴 CRÍTICO en LAUNCH.md.
` : ''}${signal.color === '🟢' ? `
  ✅  Todo en orden. Mantén el ritmo de ${velocity}+ tareas/semana.
  Siguiente revisión: ${(() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toLocaleDateString('es-EC'); })()}
` : ''}
`);
