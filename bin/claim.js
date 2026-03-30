#!/usr/bin/env node
/**
 * bin/claim.js — Sistema de claim de tareas Aurora Derm v2
 *
 * MEJORA v2: cada claim es un archivo individual en data/claims/tasks/
 * Antes: un solo tasks.json → merge conflict garantizado cuando 2 agentes
 *        hacen claim al mismo tiempo.
 * Ahora: data/claims/tasks/S3-05.json, data/claims/tasks/S3-06.json ...
 *        Cada agente escribe solo su archivo → cero conflictos.
 *
 * Uso:
 *   node bin/claim.js next               ← qué tarea tomar (START HERE)
 *   node bin/claim.js claim S3-05 "nombre-agente"
 *   node bin/claim.js release S3-05
 *   node bin/claim.js status             ← vista general del board
 *   node bin/claim.js list-pending       ← tareas disponibles
 *   node bin/claim.js purge-expired      ← limpiar claims muertos
 *   node bin/claim.js verify-mine        ← ver mis claims activos
 */

const {
  readFileSync, writeFileSync, existsSync,
  mkdirSync, readdirSync, unlinkSync,
  statSync,
} = require('fs');
const { resolve, join } = require('path');

const ROOT        = resolve(__dirname, '..');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks');    // ← archivos individuales
const LEGACY_FILE = resolve(ROOT, 'data/claims/tasks.json'); // ← compatibilidad
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

// Asegurar directorio
if (!existsSync(CLAIMS_DIR)) mkdirSync(CLAIMS_DIR, { recursive: true });

// ── helpers ───────────────────────────────────────────────────────────────────

function claimPath(taskId) {
  const safe = taskId.replace(/[^a-zA-Z0-9\-]/g, '');
  return join(CLAIMS_DIR, `${safe}.json`);
}

function loadClaim(taskId) {
  const path = claimPath(taskId);
  if (!existsSync(path)) {
    // Check legacy file
    if (existsSync(LEGACY_FILE)) {
      try {
        const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
        if (legacy[taskId]) return legacy[taskId];
      } catch {}
    }
    return null;
  }
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

function saveClaim(taskId, data) {
  writeFileSync(claimPath(taskId), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function deleteClaim(taskId) {
  const path = claimPath(taskId);
  if (existsSync(path)) unlinkSync(path);
  // Also clean from legacy if present
  if (existsSync(LEGACY_FILE)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
      if (legacy[taskId]) {
        delete legacy[taskId];
        writeFileSync(LEGACY_FILE, JSON.stringify(legacy, null, 2) + '\n', 'utf8');
      }
    } catch {}
  }
}

function loadAllClaims() {
  const claims = {};
  // Load individual files
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const taskId = f.replace('.json', '');
      try {
        const data = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8'));
        claims[taskId] = data;
      } catch {}
    }
  } catch {}
  // Merge legacy (for backward compat during transition)
  if (existsSync(LEGACY_FILE)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
      for (const [id, data] of Object.entries(legacy)) {
        if (!claims[id]) claims[id] = data; // individual files take priority
      }
    } catch {}
  }
  return claims;
}

// Migrate legacy to individual files
function migrateLegacy() {
  if (!existsSync(LEGACY_FILE)) return 0;
  let migrated = 0;
  try {
    const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
    for (const [id, data] of Object.entries(legacy)) {
      if (!existsSync(claimPath(id))) {
        saveClaim(id, data);
        migrated++;
      }
    }
    if (migrated > 0) {
      writeFileSync(LEGACY_FILE, JSON.stringify({}, null, 2) + '\n', 'utf8');
    }
  } catch {}
  return migrated;
}

function loadAgentsMd() {
  return existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
}

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let currentSprint = '';
  let currentSection = '';

  for (const line of lines) {
    const sprintMatch = line.match(/^### (.*Sprint \d.*)/);
    if (sprintMatch) currentSprint = sprintMatch[1].trim();

    const sectionMatch = line.match(/^#### (.+)/);
    if (sectionMatch) currentSection = sectionMatch[1].trim();

    const taskMatch = line.match(/^- \[([ x])\] \*\*(S\d+-[A-Z0-9]+)\*\*/);
    if (taskMatch) {
      const done      = taskMatch[1] === 'x';
      const id        = taskMatch[2];
      const sizeMatch = line.match(/`\[(S|M|L|XL)\]`/);
      const humanMatch = line.includes('[HUMAN]');
      const critMatch = line.toLowerCase().includes('crítico') || line.includes('🔴');
      tasks.push({
        id,
        done,
        sprint: currentSprint,
        section: currentSection,
        size: sizeMatch ? sizeMatch[1] : 'M',
        human: humanMatch,
        critical: critMatch,
        line: line.trim(),
      });
    }
  }
  return tasks;
}

function isExpired(claim) {
  if (!claim || !claim.expiresAt) return false;
  return new Date(claim.expiresAt) < new Date();
}

function ttlForSize(size) {
  const hours = { S: 2, M: 4, L: 8, XL: 24 }[size] || 4;
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function minutesLeft(claim) {
  if (!claim.expiresAt) return 0;
  return Math.round((new Date(claim.expiresAt) - new Date()) / 60000);
}

function hoursAgo(isoDate) {
  return Math.round((new Date() - new Date(isoDate)) / 3600000);
}

// ── commands ──────────────────────────────────────────────────────────────────

const cmd  = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv.slice(4).join(' ') || 'unknown-agent';

// Auto-migrate on every run (safe, idempotent)
migrateLegacy();

switch (cmd) {

  // ── claim ─────────────────────────────────────────────────────────────────
  case 'claim': {
    if (!arg1) { console.error('Usage: claim <task-id> [agent-name]'); process.exit(1); }
    const tasks   = parseTasks(loadAgentsMd());
    const task    = tasks.find(t => t.id === arg1);
    const existing = loadClaim(arg1);

    if (!task) {
      console.error(`❌ Task ${arg1} not found in AGENTS.md`);
      process.exit(1);
    }
    if (task.done) {
      console.error(`❌ Task ${arg1} already done [x]. Pick another.`);
      process.exit(1);
    }
    if (task.human) {
      console.warn(`⚠️  Task ${arg1} tagged [HUMAN] — confirm with owner before proceeding.`);
    }
    if (existing && !isExpired(existing)) {
      console.error(`❌ ${arg1} already claimed by "${existing.agent}" (expires in ${minutesLeft(existing)}m)`);
      console.error(`   Run: node bin/claim.js next`);
      process.exit(1);
    }

    const claimData = {
      agent:     arg2,
      claimedAt: new Date().toISOString(),
      expiresAt: ttlForSize(task.size),
      sprint:    task.sprint,
      section:   task.section,
      size:      task.size,
    };
    saveClaim(arg1, claimData);

    console.log(`✅ Claimed ${arg1} for "${arg2}"`);
    console.log(`   Expires: ${claimData.expiresAt}`);
    console.log(`   File: data/claims/tasks/${arg1}.json  ← commit ONLY this file`);
    console.log(`\n   git add data/claims/tasks/${arg1}.json && HUSKY=0 git commit --no-verify -m "claim: ${arg1}" && git push`);
    break;
  }

  // ── release ───────────────────────────────────────────────────────────────
  case 'release': {
    if (!arg1) { console.error('Usage: release <task-id>'); process.exit(1); }
    const existing = loadClaim(arg1);
    if (!existing) {
      console.log(`ℹ️  ${arg1} had no active claim.`);
    } else {
      deleteClaim(arg1);
      console.log(`✅ Released claim on ${arg1}`);
    }
    console.log(`
⚠️  TU TRABAJO NO EXISTE HASTA QUE HAGAS PUSH.

  Pasos finales — copiar y pegar en orden:

  1. Marcar [x] en AGENTS.md (busca la línea de ${arg1})

  2. git add .

  3. HUSKY=0 git commit --no-verify -m "feat(${arg1}): descripción de lo que hiciste"

  4. git push origin main   ← OBLIGATORIO - sin esto nadie ve tu trabajo

  5. Verificar que llegó:
     git log origin/main -1 --oneline
`);
    break;
  }


  // ── next ──────────────────────────────────────────────────────────────────
  case 'next': {
    const claims  = loadAllClaims();
    const tasks   = parseTasks(loadAgentsMd());
    const role    = arg1 || '';

    const pending   = tasks.filter(t => !t.done && !t.human);
    const available = pending.filter(t => {
      const c = claims[t.id];
      return !c || isExpired(c);
    });

    if (available.length === 0) {
      console.log('🎉 All available tasks are either done or claimed!');
      console.log('   Check npm run report or ask the director for new tasks.');
      break;
    }

    // Priority: critical first, then by sprint, then by size
    const sizeOrder = { S: 1, M: 2, L: 3, XL: 4 };
    const sprintNum = (t) => parseInt((t.sprint.match(/Sprint (\d+)/) || [0, 99])[1]);
    available.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      if (sprintNum(a) !== sprintNum(b)) return sprintNum(a) - sprintNum(b);
      return sizeOrder[a.size] - sizeOrder[b.size];
    });

    const next = available[0];
    console.log(`\n📋 Next available task:`);
    console.log(`   ID:     ${next.id}${next.critical ? ' 🔴 CRÍTICO' : ''}`);
    console.log(`   Size:   [${next.size}]`);
    console.log(`   Sprint: ${next.sprint}`);
    console.log(`   Task:   ${next.line.slice(0, 110)}`);
    console.log(`\n   To claim:`);
    console.log(`   node bin/claim.js claim ${next.id} "your-agent-name"`);
    console.log(`   git add data/claims/tasks/${next.id}.json && HUSKY=0 git commit --no-verify -m "claim: ${next.id}" && git push\n`);

    if (available.length > 1) {
      console.log('   Also available:');
      available.slice(1, 6).forEach(t =>
        console.log(`   - ${t.id} [${t.size}]${t.critical ? ' 🔴' : ''} ${t.line.slice(0, 65)}...`)
      );
    }
    break;
  }

  // ── status ────────────────────────────────────────────────────────────────
  case 'status': {
    const claims  = loadAllClaims();
    const tasks   = parseTasks(loadAgentsMd());
    const done    = tasks.filter(t => t.done).length;
    const active  = Object.entries(claims).filter(([, c]) => !isExpired(c));
    const expired = Object.entries(claims).filter(([, c]) => isExpired(c));

    console.log(`\n📊 Aurora Derm — Task Board`);
    console.log(`   Total: ${tasks.length} | Done: ${done} (${Math.round(done/tasks.length*100)}%) | Pending: ${tasks.length - done}`);
    console.log(`   Claims activos: ${active.length} | Expirados: ${expired.length}`);

    if (active.length > 0) {
      console.log(`\n🔒 Claims activos (NO duplicar):`);
      active.forEach(([id, c]) =>
        console.log(`   ${id} → "${c.agent}" (${minutesLeft(c)}m restantes)`)
      );
    }
    if (expired.length > 0) {
      console.log(`\n⚠️  Claims expirados (trabajo posiblemente incompleto):`);
      expired.forEach(([id, c]) =>
        console.log(`   ${id} → "${c.agent}" (expiró hace ${hoursAgo(c.expiresAt)}h)`)
      );
      console.log(`   → Limpiar: node bin/claim.js purge-expired`);
    }
    console.log();
    break;
  }

  // ── list-pending ──────────────────────────────────────────────────────────
  case 'list-pending': {
    const claims   = loadAllClaims();
    const tasks    = parseTasks(loadAgentsMd());
    const pending  = tasks.filter(t => !t.done && !t.human);
    const available = pending.filter(t => { const c = claims[t.id]; return !c || isExpired(c); });
    const claimed   = pending.filter(t => { const c = claims[t.id]; return c && !isExpired(c); });

    console.log(`\n📋 ${available.length} disponibles, ${claimed.length} reclamadas\n`);
    if (claimed.length > 0) {
      console.log('🔒 RECLAMADAS (saltar):');
      claimed.forEach(t => {
        const c = claims[t.id];
        console.log(`   ${t.id} [${t.size}] → ${c.agent} (${minutesLeft(c)}m)`);
      });
      console.log();
    }
    console.log('✅ DISPONIBLES (tomar una):');
    available.slice(0, 12).forEach(t =>
      console.log(`   ${t.id} [${t.size}]${t.critical ? ' 🔴' : ''} ${t.line.slice(0, 72)}`)
    );
    if (available.length > 12) console.log(`   ... y ${available.length - 12} más`);
    console.log();
    break;
  }

  // ── purge-expired ─────────────────────────────────────────────────────────
  case 'purge-expired': {
    const claims = loadAllClaims();
    let purged = 0;
    for (const [id, c] of Object.entries(claims)) {
      if (isExpired(c)) {
        deleteClaim(id);
        purged++;
      }
    }
    // Also clean legacy
    if (existsSync(LEGACY_FILE)) {
      try {
        const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
        let lPurged = 0;
        for (const [id, c] of Object.entries(legacy)) {
          if (isExpired(c)) { delete legacy[id]; lPurged++; }
        }
        if (lPurged > 0) writeFileSync(LEGACY_FILE, JSON.stringify(legacy, null, 2) + '\n', 'utf8');
        purged += lPurged;
      } catch {}
    }
    console.log(`✅ Purged ${purged} expired claims`);
    break;
  }

  // ── verify-mine ───────────────────────────────────────────────────────────
  case 'verify-mine': {
    const agentName = arg1;
    if (!agentName) { console.error('Usage: verify-mine <agent-name>'); process.exit(1); }
    const claims = loadAllClaims();
    const mine = Object.entries(claims).filter(([, c]) =>
      c.agent && c.agent.toLowerCase().includes(agentName.toLowerCase())
    );
    if (mine.length === 0) {
      console.log(`ℹ️  No active claims for agent matching "${agentName}"`);
    } else {
      console.log(`\n🔒 Your active claims:`);
      mine.forEach(([id, c]) => {
        const expired = isExpired(c);
        console.log(`   ${id} [${c.size}] ${expired ? '⚠️ EXPIRED' : `(${minutesLeft(c)}m left)`}`);
      });
    }
    break;
  }

  // ── migrate ───────────────────────────────────────────────────────────────
  case 'migrate': {
    const n = migrateLegacy();
    console.log(`✅ Migrated ${n} claims from tasks.json to individual files`);
    break;
  }

  default: {
    console.log(`
bin/claim.js v2 — Aurora Derm Task Claiming System
(archivos individuales por tarea — sin conflictos de merge)

Commands:
  next              Mostrar la próxima tarea disponible (EMPEZAR AQUÍ)
  claim <id> <who>  Reclamar una tarea antes de trabajar
  release <id>      Liberar al terminar
  status            Vista general del board
  list-pending      Lista tareas disponibles ahora
  purge-expired     Limpiar claims muertos
  verify-mine <n>   Ver mis claims activos
  migrate           Migrar tasks.json legacy a archivos individuales

Workflow:
  1. git pull origin main
  2. node bin/claim.js next
  3. node bin/claim.js claim S3-05 "mi-nombre"
  4. git add data/claims/tasks/S3-05.json && git commit -m "claim: S3-05" && git push
  5. [hacer el trabajo]
  6. node bin/gate.js S3-05
  7. node bin/claim.js release S3-05
  8. git add . && git commit -m "feat(S3-05): ..." && git push

Si te bloqueas (no dejes el claim colgando):
  node bin/stuck.js S3-05 "razón exacta"
`);
  }
}
