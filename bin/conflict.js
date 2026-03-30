#!/usr/bin/env node
/**
 * bin/conflict.js — Detector de conflictos entre agentes
 *
 * Detecta cuando dos agentes están tocando la misma zona de código,
 * ANTES de que ocurra un merge conflict. Se ejecuta automáticamente
 * antes de que un agente haga claim de una tarea, y se puede correr
 * manualmente para auditar el estado del repo.
 *
 * Uso:
 *   node bin/conflict.js                  ← escaneo completo
 *   node bin/conflict.js --task S3-19     ← ¿puedo tomar esta tarea?
 *   node bin/conflict.js --zone controllers/  ← ¿quién toca esta zona?
 *   node bin/conflict.js --json           ← output JSON para CI
 *
 * Exit codes:
 *   0 = sin conflictos
 *   1 = conflicto detectado (bloquear antes de continuar)
 */

const { execSync } = require('child_process');
const { readFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join, relative } = require('path');

const ROOT      = resolve(__dirname, '..');
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

const asJson  = process.argv.includes('--json');
const taskArg = (process.argv.indexOf('--task') !== -1)
  ? process.argv[process.argv.indexOf('--task') + 1] : null;
const zoneArg = (process.argv.indexOf('--zone') !== -1)
  ? process.argv[process.argv.indexOf('--zone') + 1] : null;

function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return ''; }
}
function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }

// ── File zones — qué archivos pertenecen a qué área de responsabilidad ────────
// Si dos claims activos tocan la misma zona, hay riesgo de conflicto

const FILE_ZONES = {
  'controllers':  ['controllers/'],
  'lib':          ['lib/', 'inc/'],
  'frontend_js':  ['js/'],
  'frontend_css': ['styles/', 'css/'],
  'templates':    ['templates/', 'partials/'],
  'public_pages': ['es/', 'en/'],
  'data':         ['data/'],
  'bin':          ['bin/'],
  'config':       ['.env', 'api.php', 'lib/routes.php', 'lib/common.php'],
  'queue':        ['src/apps/queue-', 'kiosco-', 'operador-', 'sala-'],
  'openclaw':     ['lib/openclaw/', 'js/openclaw-', 'controllers/OpenclawController'],
  'clinical':     ['lib/clinical_history/', 'controllers/ClinicalHistory'],
  'agents_md':    ['AGENTS.md', 'BACKLOG.md'],
};

function getZonesForTask(taskId, agentsMd) {
  // Parse the task description to infer which zones it touches
  const lines = agentsMd.split('\n');
  const taskLine = lines.find(l => l.includes(`**${taskId}**`)) || '';
  const zones = new Set();

  for (const [zone, patterns] of Object.entries(FILE_ZONES)) {
    if (patterns.some(p => taskLine.toLowerCase().includes(p.toLowerCase()))) {
      zones.add(zone);
    }
  }
  return Array.from(zones);
}

function getZonesForFiles(files) {
  const zones = new Set();
  for (const file of files) {
    for (const [zone, patterns] of Object.entries(FILE_ZONES)) {
      if (patterns.some(p => file.includes(p))) {
        zones.add(zone);
        break;
      }
    }
  }
  return Array.from(zones);
}

// ── Load all active claims ─────────────────────────────────────────────────────

function loadAllClaims() {
  const claims = {};
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const id = f.replace('.json', '');
      try {
        const c = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8'));
        if (c?.expiresAt && new Date(c.expiresAt) > new Date()) {
          claims[id] = c;
        }
      } catch {}
    }
  } catch {}
  return claims;
}

// ── Get changed files per claim (via git log) ──────────────────────────────────

function getFilesChangedByClaim(claimId, agentName) {
  // Look at recent commits that mention this task ID
  const commits = run(`git log --oneline --since="8 hours ago"`).split('\n').filter(Boolean);
  const taskCommits = commits.filter(c => c.includes(claimId) || c.includes(`(${claimId})`));

  if (taskCommits.length === 0) return [];

  const hashes = taskCommits.map(c => c.split(' ')[0]);
  const files = new Set();

  for (const hash of hashes.slice(0, 5)) {
    const changed = run(`git diff-tree --no-commit-id -r --name-only ${hash}`)
      .split('\n').filter(Boolean);
    changed.forEach(f => files.add(f));
  }

  return Array.from(files);
}

// ── Conflict detection ────────────────────────────────────────────────────────

const claims    = loadAllClaims();
const agentsMd  = read(AGENTS_FILE);
const conflicts = [];
const warnings  = [];

const claimList = Object.entries(claims);

// Check 1: Same file zone touched by multiple claims
const zoneToClaimants = {};
for (const [taskId, claim] of claimList) {
  const zones = getZonesForTask(taskId, agentsMd);
  for (const zone of zones) {
    if (!zoneToClaimants[zone]) zoneToClaimants[zone] = [];
    zoneToClaimants[zone].push({ taskId, agent: claim.agent, expiresAt: claim.expiresAt });
  }
}

for (const [zone, claimants] of Object.entries(zoneToClaimants)) {
  if (claimants.length > 1) {
    conflicts.push({
      type: 'zone_overlap',
      zone,
      claimants: claimants.map(c => `${c.taskId} (${c.agent})`),
      severity: zone === 'config' || zone === 'agents_md' ? 'HIGH' : 'MEDIUM',
      message: `Zona "${zone}" reclamada por ${claimants.length} agentes en paralelo`,
      action: `Coordinar quién termina primero. El segundo debe hacer git pull antes de push.`,
    });
  }
}

// Check 2: routes.php / api.php being touched by multiple tasks (fragile files)
const fragileFiles = ['lib/routes.php', 'api.php', 'lib/common.php', 'AGENTS.md'];
for (const file of fragileFiles) {
  const claimantsForFile = claimList.filter(([taskId]) => {
    const zones = getZonesForTask(taskId, agentsMd);
    const taskLine = agentsMd.split('\n').find(l => l.includes(`**${taskId}**`)) || '';
    return taskLine.toLowerCase().includes(file.toLowerCase());
  });
  if (claimantsForFile.length > 1) {
    conflicts.push({
      type: 'fragile_file',
      file,
      claimants: claimantsForFile.map(([id, c]) => `${id} (${c.agent})`),
      severity: 'HIGH',
      message: `Archivo frágil "${file}" mencionado en ${claimantsForFile.length} tareas activas`,
      action: `Solo un agente debe tocar este archivo. Coordinar vía claims.`,
    });
  }
}

// Check 3: Uncommitted local changes that overlap with active claims
const uncommittedFiles = run('git status --short')
  .split('\n')
  .filter(Boolean)
  .map(l => l.slice(3).trim());

if (uncommittedFiles.length > 0) {
  const localZones = getZonesForFiles(uncommittedFiles);
  for (const [taskId, claim] of claimList) {
    const claimZones = getZonesForTask(taskId, agentsMd);
    const overlap = localZones.filter(z => claimZones.includes(z));
    if (overlap.length > 0) {
      warnings.push({
        type: 'local_vs_claim',
        zones: overlap,
        claimedBy: `${taskId} (${claim.agent})`,
        localFiles: uncommittedFiles.filter(f =>
          overlap.some(z => FILE_ZONES[z]?.some(p => f.includes(p)))
        ),
        message: `Cambios locales sin commit solapan con claim activo de ${claim.agent} (${taskId})`,
        action: `Commitea o stashe antes de continuar. Luego haz git pull.`,
      });
    }
  }
}

// ── Task-specific check: can I take this task? ─────────────────────────────────

if (taskArg) {
  const existing = claims[taskArg];
  if (existing) {
    const mins = Math.round((new Date(existing.expiresAt) - new Date()) / 60000);
    if (!asJson) {
      console.log(`\n❌ ${taskArg} ya está reclamado por ${existing.agent} (expira en ${mins}min)\n`);
      console.log(`   Espera a que expire o usa otra tarea.\n`);
    } else {
      console.log(JSON.stringify({ available: false, takenBy: existing.agent, expiresInMin: mins }));
    }
    process.exit(1);
  }

  const taskZones = getZonesForTask(taskArg, agentsMd);
  const zoneConflicts = taskZones.filter(z => (zoneToClaimants[z] || []).length > 0);

  if (zoneConflicts.length > 0 && !asJson) {
    console.log(`\n⚠️  ${taskArg} solaparía con tareas activas en zonas: ${zoneConflicts.join(', ')}`);
    console.log(`   Agentes trabajando en estas zonas:`);
    for (const z of zoneConflicts) {
      (zoneToClaimants[z] || []).forEach(c => console.log(`     ${c.taskId} → ${c.agent}`));
    }
    console.log(`\n   Puedes continuar, pero coordina con esos agentes al hacer push.\n`);
  } else if (!asJson) {
    console.log(`\n✅ ${taskArg} está disponible. Sin conflictos de zona detectados.\n`);
  }
  if (asJson) {
    console.log(JSON.stringify({ available: true, zoneConflicts, taskZones }));
  }
  process.exit(zoneConflicts.length > 0 ? 0 : 0); // warn but don't block
}

// ── Output ────────────────────────────────────────────────────────────────────

if (asJson) {
  console.log(JSON.stringify({ conflicts, warnings, activeClaims: claimList.length }, null, 2));
  process.exit(conflicts.some(c => c.severity === 'HIGH') ? 1 : 0);
}

console.log(`\n🔍 Conflict Scanner — Aurora Derm\n`);
console.log(`   Claims activos: ${claimList.length}`);
console.log(`   Archivos sin commit: ${uncommittedFiles.length}`);
console.log(`   Zonas con overlap: ${Object.values(zoneToClaimants).filter(c => c.length > 1).length}\n`);

if (conflicts.length === 0 && warnings.length === 0) {
  console.log(`✅ Sin conflictos detectados. Puedes trabajar con seguridad.\n`);
  process.exit(0);
}

if (conflicts.length > 0) {
  console.log(`❌ CONFLICTOS (${conflicts.length}):`);
  conflicts.forEach((c, i) => {
    console.log(`\n  ${i+1}. [${c.severity}] ${c.message}`);
    console.log(`     Involucrados: ${c.claimants?.join(', ')}`);
    console.log(`     Acción: ${c.action}`);
  });
  console.log();
}

if (warnings.length > 0) {
  console.log(`⚠️  ADVERTENCIAS (${warnings.length}):`);
  warnings.forEach((w, i) => {
    console.log(`\n  ${i+1}. ${w.message}`);
    console.log(`     Acción: ${w.action}`);
  });
  console.log();
}

const hasHighSeverity = conflicts.some(c => c.severity === 'HIGH');
if (hasHighSeverity) {
  console.log(`🚨 Hay conflictos HIGH severity — resuelve antes de hacer push.`);
  process.exit(1);
} else {
  console.log(`⚠️  Conflictos MEDIUM — puedes continuar con cuidado.`);
  process.exit(0);
}
