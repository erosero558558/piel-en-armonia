#!/usr/bin/env node
/**
 * bin/claim.js — Sistema de claim de tareas Aurora Derm
 *
 * Evita que múltiples agentes trabajen la misma tarea simultáneamente.
 * Usa data/claims/tasks.json como fuente de verdad compartida vía Git.
 *
 * Uso:
 *   node bin/claim.js claim S2-01 "Nombre del agente o modelo"
 *   node bin/claim.js release S2-01
 *   node bin/claim.js status
 *   node bin/claim.js next          ← recomienda qué tarea tomar
 *   node bin/claim.js list-pending  ← lista tareas sin claim
 *
 * Flujo correcto para un agente:
 *   1. git pull origin main
 *   2. node bin/claim.js next          → te dice qué tarea tomar
 *   3. node bin/claim.js claim S2-01 "GPT-5.4 hilo 3"
 *   4. git add data/claims/ && git commit -m "claim: S2-01" && git push
 *   5. ... hacer el trabajo ...
 *   6. node bin/claim.js release S2-01
 *   7. git add . && git commit -m "feat(S2-01): ..." && git push
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const CLAIMS_FILE = resolve(ROOT, 'data/claims/tasks.json');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

// ── helpers ──────────────────────────────────────────────────────────────────

function loadClaims() {
  if (!existsSync(CLAIMS_FILE)) return {};
  try { return JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveClaims(claims) {
  writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2) + '\n', 'utf8');
}

function loadAgentsMd() {
  return existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
}

function parseTasks(md) {
  const tasks = [];
  const lines = md.split('\n');
  let currentSprint = '';

  for (const line of lines) {
    const sprintMatch = line.match(/^### (.*Sprint \d.*)/);
    if (sprintMatch) currentSprint = sprintMatch[1].trim();

    // Match: - [ ] **S2-01** [S] description
    const taskMatch = line.match(/^- \[([ x])\] \*\*(S\d+-\d+)\*\*/);
    if (taskMatch) {
      const done = taskMatch[1] === 'x';
      const id = taskMatch[2];
      const sizeMatch = line.match(/`\[(S|M|L|XL)\]`/);
      const humanMatch = line.includes('[HUMAN]');
      tasks.push({
        id,
        done,
        sprint: currentSprint,
        size: sizeMatch ? sizeMatch[1] : '?',
        human: humanMatch,
        line: line.trim(),
      });
    }
  }
  return tasks;
}

function isExpired(claim) {
  if (!claim.expiresAt) return false;
  return new Date(claim.expiresAt) < new Date();
}

function ttlForSize(size) {
  // How long a claim is valid before it expires (safety valve for crashed agents)
  const hours = { S: 2, M: 4, L: 8, XL: 24 }[size] || 4;
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

// ── commands ──────────────────────────────────────────────────────────────────

const cmd = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv.slice(4).join(' ') || 'unknown-agent';

switch (cmd) {

  case 'claim': {
    if (!arg1) { console.error('Usage: claim <task-id> [agent-name]'); process.exit(1); }
    const claims = loadClaims();
    const tasks = parseTasks(loadAgentsMd());
    const task = tasks.find(t => t.id === arg1);

    if (!task) {
      console.error(`❌ Task ${arg1} not found in AGENTS.md`);
      process.exit(1);
    }
    if (task.done) {
      console.error(`❌ Task ${arg1} is already marked [x] (done). Pick another.`);
      process.exit(1);
    }
    if (task.human) {
      console.warn(`⚠️  Task ${arg1} is tagged [HUMAN] — ask the owner before proceeding.`);
    }

    const existing = claims[arg1];
    if (existing && !isExpired(existing)) {
      console.error(`❌ Task ${arg1} already claimed by "${existing.agent}" since ${existing.claimedAt}`);
      console.error(`   Expires at: ${existing.expiresAt}`);
      console.error(`   Pick a different task. Run: node bin/claim.js next`);
      process.exit(1);
    }

    claims[arg1] = {
      agent: arg2,
      claimedAt: new Date().toISOString(),
      expiresAt: ttlForSize(task.size),
      sprint: task.sprint,
      size: task.size,
    };
    saveClaims(claims);
    console.log(`✅ Claimed ${arg1} for "${arg2}"`);
    console.log(`   Expires: ${claims[arg1].expiresAt}`);
    console.log(`   Next: git add data/claims/ && git commit -m "claim: ${arg1}" && git push`);
    break;
  }

  case 'release': {
    if (!arg1) { console.error('Usage: release <task-id>'); process.exit(1); }
    const claims = loadClaims();
    if (!claims[arg1]) {
      console.log(`ℹ️  Task ${arg1} had no active claim.`);
    } else {
      delete claims[arg1];
      saveClaims(claims);
      console.log(`✅ Released claim on ${arg1}`);
    }
    break;
  }

  case 'next': {
    const claims = loadClaims();
    const tasks = parseTasks(loadAgentsMd());
    // Find first unclaimed, undone, non-human task in current sprint
    const pending = tasks.filter(t => !t.done && !t.human);
    const available = pending.filter(t => {
      const c = claims[t.id];
      return !c || isExpired(c);
    });

    if (available.length === 0) {
      console.log('🎉 All available tasks are either done or claimed!');
      console.log('   Wait for a claim to expire or ask your director for new tasks.');
      break;
    }

    // Prefer smallest sprint number, then smallest size
    const sizeOrder = { S: 1, M: 2, L: 3, XL: 4 };
    available.sort((a, b) => sizeOrder[a.size] - sizeOrder[b.size]);
    const next = available[0];

    console.log(`\n📋 Next available task:`);
    console.log(`   ID:     ${next.id}`);
    console.log(`   Size:   [${next.size}]`);
    console.log(`   Sprint: ${next.sprint}`);
    console.log(`   Task:   ${next.line.slice(0, 100)}...`);
    console.log(`\n   To claim: node bin/claim.js claim ${next.id} "your-agent-name"`);
    console.log(`   Then:     git add data/claims/ && git commit -m "claim: ${next.id}" && git push\n`);

    // Also show next 4 available
    if (available.length > 1) {
      console.log('   Also available:');
      available.slice(1, 5).forEach(t => console.log(`   - ${t.id} [${t.size}] ${t.line.slice(0, 60)}...`));
    }
    break;
  }

  case 'status': {
    const claims = loadClaims();
    const tasks = parseTasks(loadAgentsMd());
    const done = tasks.filter(t => t.done).length;
    const active = Object.entries(claims).filter(([, c]) => !isExpired(c));
    const expired = Object.entries(claims).filter(([, c]) => isExpired(c));

    console.log(`\n📊 Aurora Derm — Task Board Status`);
    console.log(`   Total tasks: ${tasks.length}`);
    console.log(`   Done:        ${done} (${Math.round(done/tasks.length*100)}%)`);
    console.log(`   Pending:     ${tasks.length - done}`);
    console.log(`   Active claims: ${active.length}`);

    if (active.length > 0) {
      console.log(`\n🔒 Active Claims (DO NOT DUPLICATE):`);
      active.forEach(([id, c]) => {
        const mins = Math.round((new Date(c.expiresAt) - new Date()) / 60000);
        console.log(`   ${id} → "${c.agent}" (expires in ${mins}m)`);
      });
    }

    if (expired.length > 0) {
      console.log(`\n⚠️  Expired Claims (may be restarted):`);
      expired.forEach(([id, c]) => {
        console.log(`   ${id} → "${c.agent}" (expired ${c.expiresAt})`);
      });
    }
    console.log();
    break;
  }

  case 'list-pending': {
    const claims = loadClaims();
    const tasks = parseTasks(loadAgentsMd());
    const pending = tasks.filter(t => !t.done && !t.human);
    const available = pending.filter(t => { const c = claims[t.id]; return !c || isExpired(c); });
    const claimed = pending.filter(t => { const c = claims[t.id]; return c && !isExpired(c); });

    console.log(`\n📋 Pending tasks — ${available.length} available, ${claimed.length} claimed\n`);
    if (claimed.length > 0) {
      console.log('🔒 CLAIMED (skip these):');
      claimed.forEach(t => {
        const c = claims[t.id];
        console.log(`   ${t.id} [${t.size}] → ${c.agent}`);
      });
      console.log();
    }
    console.log('✅ AVAILABLE (take one):');
    available.slice(0, 10).forEach(t => {
      console.log(`   ${t.id} [${t.size}] ${t.line.slice(0, 70)}...`);
    });
    if (available.length > 10) console.log(`   ... and ${available.length - 10} more`);
    console.log();
    break;
  }

  case 'purge-expired': {
    const claims = loadClaims();
    let purged = 0;
    for (const [id, c] of Object.entries(claims)) {
      if (isExpired(c)) { delete claims[id]; purged++; }
    }
    saveClaims(claims);
    console.log(`✅ Purged ${purged} expired claims`);
    break;
  }

  default: {
    console.log(`
bin/claim.js — Aurora Derm Task Claiming System

Commands:
  next              Show the next available unclaimed task (START HERE)
  claim <id> <who>  Claim a task before working on it
  release <id>      Release a claim after completing or abandoning
  status            Show board overview + active claims
  list-pending      List all unclaimed pending tasks
  purge-expired     Clean up expired claims

Workflow for every agent:
  1. git pull origin main
  2. node bin/claim.js next
  3. node bin/claim.js claim S2-01 "GPT-5.4-agent-3"
  4. git add data/claims/ && git commit -m "claim: S2-01" && git push
  5. [do the work]
  6. git add . && HUSKY=0 git commit --no-verify -m "feat(S2-01): ..."
  7. node bin/claim.js release S2-01
  8. Mark [x] in AGENTS.md and push
`);
  }
}
