#!/usr/bin/env node
/**
 * bin/stuck.js — Control de calidad: agente bloqueado en una tarea
 *
 * Cuando un agente no puede terminar una tarea (API breaks, contexto faltante,
 * archivo que no existe, duda clínica), usa este comando para:
 * 1. Registrar el bloqueo con descripción
 * 2. Liberar el claim para que otro agente pueda tomarlo
 * 3. Escribir la entrada en BLOCKERS.md
 * 4. Hacer el commit automático del bloqueo
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

const { execFileSync, spawnSync } = require('child_process');
const {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} = require('fs');
const { resolve, join, relative } = require('path');

const SOURCE_ROOT = resolve(__dirname, '..');
const ROOT = process.env.AURORA_DERM_ROOT
  ? resolve(process.env.AURORA_DERM_ROOT)
  : SOURCE_ROOT;
const STUCK_FILE = resolve(ROOT, 'data/claims/stuck.json');
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks');
const BLOCKERS_FILE = resolve(ROOT, 'BLOCKERS.md');
const WHATSAPP_DATA_DIR = resolve(ROOT, 'data/whatsapp-openclaw');
const DIRECTOR_WHATSAPP_SCRIPT = resolve(__dirname, 'notify-director-blocker-whatsapp.php');
const AUTO_BLOCKERS_START = '<!-- AUTO-BLOCKERS:START -->';
const AUTO_BLOCKERS_END = '<!-- AUTO-BLOCKERS:END -->';

function read(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function writeJson(filePath, data) {
  mkdirSync(resolve(ROOT, 'data/claims'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadStuck() {
  try {
    return JSON.parse(read(STUCK_FILE));
  } catch {
    return {};
  }
}

function claimFilePath(taskId) {
  return resolve(CLAIMS_DIR, `${taskId}.json`);
}

function loadClaim(taskId) {
  const filePath = claimFilePath(taskId);
  try {
    return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : null;
  } catch {
    return null;
  }
}

function deleteClaim(taskId) {
  const filePath = claimFilePath(taskId);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function listActiveBlockers(stuck) {
  return Object.entries(stuck)
    .filter(([, entry]) => !entry.resolved)
    .sort((left, right) => new Date(right[1].stuckAt) - new Date(left[1].stuckAt));
}

function formatBlockerDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  });
}

function buildAutoBlockersSection(stuck) {
  const activeBlockers = listActiveBlockers(stuck);
  const lines = ['## 🚧 Blockers activos', AUTO_BLOCKERS_START];

  if (activeBlockers.length === 0) {
    lines.push('_No hay blockers activos generados por `bin/stuck.js`._');
    lines.push(AUTO_BLOCKERS_END);
    return lines.join('\n');
  }

  activeBlockers.forEach(([taskId, entry], index) => {
    if (index > 0) {
      lines.push('');
    }

    lines.push(`### ${taskId}`);
    lines.push(`- Fecha: ${formatBlockerDate(entry.stuckAt)}`);
    lines.push(`- Agente: ${entry.agent}`);
    lines.push(`- Razón: ${entry.reason}`);
  });

  lines.push(AUTO_BLOCKERS_END);
  return lines.join('\n');
}

function injectAutoBlockersSection(markdown, section) {
  const markersPattern = new RegExp(
    `${AUTO_BLOCKERS_START}[\\s\\S]*?${AUTO_BLOCKERS_END}`,
    'm'
  );

  if (markdown.includes(AUTO_BLOCKERS_START) && markdown.includes(AUTO_BLOCKERS_END)) {
    return markdown.replace(
      /## 🚧 Blockers activos\s*<!-- AUTO-BLOCKERS:START -->[\s\S]*?<!-- AUTO-BLOCKERS:END -->/m,
      section
    );
  }

  const noBlockersPattern =
    /## Sin blockers activos[\s\S]*?(?=\n---\n\n_Actualizado|\n_Actualizado|$)/m;
  if (noBlockersPattern.test(markdown)) {
    return markdown.replace(noBlockersPattern, section + '\n');
  }

  if (markersPattern.test(markdown)) {
    return markdown.replace(markersPattern, `${AUTO_BLOCKERS_START}\n${section}\n${AUTO_BLOCKERS_END}`);
  }

  if (markdown.includes('\n---\n')) {
    return markdown.replace('\n---\n', `\n---\n\n${section}\n\n`);
  }

  const trimmed = markdown.trimEnd();
  return `${trimmed}\n\n---\n\n${section}\n`;
}

function updateBlockersMarkdown(stuck) {
  const current = read(BLOCKERS_FILE);
  const next = injectAutoBlockersSection(current, buildAutoBlockersSection(stuck));
  writeFileSync(BLOCKERS_FILE, next, 'utf8');
}

function git(commandArgs, options = {}) {
  return execFileSync('git', commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}) },
  }).trim();
}

function isGitRepo() {
  try {
    return git(['rev-parse', '--is-inside-work-tree']) === 'true';
  } catch {
    return false;
  }
}

function hasStagedChanges() {
  try {
    git(['diff', '--cached', '--quiet']);
    return false;
  } catch {
    return true;
  }
}

function shortenReason(reason) {
  const compact = String(reason || '').replace(/\s+/g, ' ').trim();
  return compact.length <= 60 ? compact : `${compact.slice(0, 57)}...`;
}

function notifyDirector(taskId, reason, agent) {
  if (!existsSync(DIRECTOR_WHATSAPP_SCRIPT)) {
    return { ok: false, skipped: true, reason: 'helper_missing' };
  }

  const env = {
    ...process.env,
    PIELARMONIA_DATA_DIR: resolve(ROOT, 'data'),
  };

  if (ROOT !== SOURCE_ROOT) {
    env.AURORADERM_SKIP_ENV_FILE = '1';
    env.PIELARMONIA_SKIP_ENV_FILE = '1';
  }

  const result = spawnSync('php', [DIRECTOR_WHATSAPP_SCRIPT, taskId, agent, reason], {
    cwd: SOURCE_ROOT,
    encoding: 'utf8',
    env,
  });

  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  let payload = null;

  if (stdout !== '') {
    try {
      payload = JSON.parse(stdout);
    } catch {
      payload = null;
    }
  }

  if (result.status !== 0) {
    return {
      ok: false,
      skipped: false,
      reason: payload?.reason || 'notify_failed',
      error: payload?.error || stderr || stdout || `php_exit_${result.status}`,
    };
  }

  if (payload && typeof payload === 'object') {
    return payload;
  }

  return { ok: false, skipped: true, reason: 'empty_response' };
}

function autoCommit(taskId, reason, mode) {
  if (!isGitRepo()) {
    return { committed: false, message: 'skip: not a git repo' };
  }

  const pathsToStage = [
    relative(ROOT, BLOCKERS_FILE),
    relative(ROOT, STUCK_FILE),
    relative(ROOT, CLAIMS_DIR),
    relative(ROOT, WHATSAPP_DATA_DIR),
  ].filter((path) => existsSync(resolve(ROOT, path)));

  git(['add', '-A', ...pathsToStage]);

  if (!hasStagedChanges()) {
    return { committed: false, message: 'skip: no staged changes' };
  }

  const commitMessage = mode === 'clear'
    ? `fix: resolved blocker ${taskId}`
    : `stuck: ${taskId} - ${shortenReason(reason)}`;

  git(['commit', '--no-verify', '-m', commitMessage], {
    env: { HUSKY: '0' },
  });

  return { committed: true, message: commitMessage };
}

function ensureBlockersFile() {
  if (!existsSync(BLOCKERS_FILE)) {
    writeFileSync(
      BLOCKERS_FILE,
      [
        '# BLOCKERS.md — Preguntas que requieren respuesta del dueño del negocio',
        '',
        '> Los agentes NO pueden avanzar en estas tareas sin tu respuesta.',
        '> **Instrucciones:** responde debajo de cada pregunta → commit → push.',
        '',
        '---',
        '',
        '## Sin blockers activos',
        '',
        'No hay preguntas pendientes. Todos los blockers tienen respuesta.',
        'Los agentes pueden tomar cualquier tarea disponible en `BACKLOG.md`.',
        '',
      ].join('\n'),
      'utf8'
    );
  }
}

function listBlockers() {
  const stuck = loadStuck();
  const activeIds = Object.keys(stuck).filter((taskId) => !stuck[taskId].resolved);
  if (activeIds.length === 0) {
    console.log('\n✅ No hay tareas bloqueadas actualmente.\n');
    process.exit(0);
  }

  console.log(`\n🚧 Tareas bloqueadas — requieren atención (${activeIds.length})\n`);
  activeIds.forEach((taskId) => {
    const entry = stuck[taskId];
    const ageMinutes = Math.round((Date.now() - new Date(entry.stuckAt).getTime()) / 60000);
    const ageLabel = ageMinutes < 60 ? `${ageMinutes}min` : `${Math.round(ageMinutes / 60)}h`;
    console.log(`  ❌ ${taskId} — bloqueado hace ${ageLabel}`);
    console.log(`     Agente: ${entry.agent}`);
    console.log(`     Razón:  ${entry.reason}`);
    console.log(`     Para resolver: node bin/stuck.js clear ${taskId}`);
    console.log();
  });
}

function clearBlocker(taskId) {
  if (!taskId) {
    console.error('Usage: node bin/stuck.js clear <TASK-ID>');
    process.exit(1);
  }

  const stuck = loadStuck();
  if (!stuck[taskId]) {
    console.error(`Not found: ${taskId}`);
    process.exit(1);
  }

  ensureBlockersFile();
  stuck[taskId].resolved = true;
  stuck[taskId].resolvedAt = new Date().toISOString();
  writeJson(STUCK_FILE, stuck);
  updateBlockersMarkdown(stuck);

  const commit = autoCommit(taskId, '', 'clear');
  console.log(`✅ ${taskId} marked as resolved.`);
  if (commit.committed) {
    console.log(`   Auto-commit: ${commit.message}`);
  } else {
    console.log(`   Auto-commit skipped: ${commit.message}`);
  }
}

function markStuck(taskId, reason) {
  // Fix: acepta S3-09, UI-01, UI2-20, UI3-15, S14-00 — todos los formatos del board
  if (!taskId.match(/^(S\d+|UI\d*)-[A-Z0-9]+$/)) {
    console.error('\nUsage: node bin/stuck.js <TASK-ID> "<razón>"');
    console.error('       node bin/stuck.js list');
    console.error('       node bin/stuck.js clear <TASK-ID>');
    console.error(`\nEjemplos válidos:`);
    console.error(`  node bin/stuck.js S3-24 "No encuentro el endpoint"`);
    console.error(`  node bin/stuck.js UI2-07 "No tengo acceso a admin.html"`);
    console.error(`  node bin/stuck.js S14-00 "agent-orchestrator no converge"`);
    process.exit(1);
  }

  if (!reason) {
    console.error('\nError: debes explicar por qué estás bloqueado.');
    console.error(`Ejemplo: node bin/stuck.js ${taskId} "Falta variable de entorno STRIPE_KEY"`);
    process.exit(1);
  }

  ensureBlockersFile();

  const claim = loadClaim(taskId);
  const agent = claim?.agent || process.env.AGENT_NAME || 'unknown';
  if (claim) {
    deleteClaim(taskId);
    console.log(`🔓 Claim released for ${taskId}`);
  }

  const stuck = loadStuck();
  stuck[taskId] = {
    agent,
    reason,
    stuckAt: new Date().toISOString(),
    resolved: false,
    resolvedAt: null,
  };

  writeJson(STUCK_FILE, stuck);
  updateBlockersMarkdown(stuck);
  const directorNotification = notifyDirector(taskId, reason, agent);

  const commit = autoCommit(taskId, reason, 'stuck');

  console.log(`\n🚧 Bloqueado registrado: ${taskId}`);
  console.log(`   Razón: ${reason}`);
  console.log(`   BLOCKERS.md actualizado con tarea, fecha, agente y razón.`);
  if (directorNotification.ok) {
    console.log(`   WhatsApp al director encolado: ${directorNotification.phone} (${directorNotification.outboxId})`);
  } else if (directorNotification.skipped) {
    console.log(`   WhatsApp al director omitido: ${directorNotification.reason}`);
  } else {
    console.log(`   WhatsApp al director falló: ${directorNotification.error || directorNotification.reason || 'unknown_error'}`);
  }
  if (commit.committed) {
    console.log(`   Commit automático creado: ${commit.message}`);
    console.log(`   Siguiente paso: git push origin main`);
  } else {
    console.log(`   Auto-commit omitido: ${commit.message}`);
    console.log(`   Siguiente paso: git add BLOCKERS.md data/claims/ && HUSKY=0 git commit --no-verify -m "${shortenReason(`stuck: ${taskId} - ${reason}`)}"`);
  }
  console.log();
}

function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === 'list') {
    listBlockers();
    return;
  }

  if (command === 'clear') {
    clearBlocker(args[0]);
    return;
  }

  markStuck(command, args.join(' '));
}

if (require.main === module) {
  main();
}

module.exports = {
  AUTO_BLOCKERS_END,
  AUTO_BLOCKERS_START,
  buildAutoBlockersSection,
  injectAutoBlockersSection,
  updateBlockersMarkdown,
};
