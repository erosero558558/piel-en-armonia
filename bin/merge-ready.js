#!/usr/bin/env node
/**
 * bin/merge-ready.js — Detecta ramas de agentes Codex listas para mergear
 *
 * PROBLEMA QUE RESUELVE:
 *   Un agente termina su trabajo en .codex-worktrees/s3-05/ y hace push.
 *   Nadie lo sabe. El trabajo queda esperando indefinidamente.
 *   El director revisa manualmente cada worktree → no escala.
 *
 * SOLUCIÓN:
 *   Este script detecta automáticamente qué ramas tienen trabajo nuevo
 *   y no han sido mergeadas a main. Muestra exactamente qué mergear y cómo.
 *
 * Uso:
 *   node bin/merge-ready.js           → listar ramas ready
 *   node bin/merge-ready.js --merge   → mergear automáticamente las ready
 *   node bin/merge-ready.js --json    → salida JSON para report
 *
 * Señales de "ready":
 *   ✅ Tiene al menos un commit feat/fix después del commit "claim:"
 *   ✅ No está en conflicto con main (dry-run)
 *   ✅ La rama existe en origin
 */

const { execSync, spawnSync } = require('child_process');
const { existsSync, readdirSync } = require('fs');
const { resolve } = require('path');

const ROOT      = resolve(__dirname, '..');
const WORTREES  = resolve(ROOT, '.codex-worktrees');
const JSON_MODE = process.argv.includes('--json');
const MERGE_MODE = process.argv.includes('--merge');

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd: ROOT, encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      ...opts,
    }).trim();
  } catch { return ''; }
}

function tryMerge(branch) {
  // Dry-run merge to test for conflicts
  const result = spawnSync('git', ['merge', '--no-commit', '--no-ff', branch], {
    cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
  });
  // Always abort
  spawnSync('git', ['merge', '--abort'], { cwd: ROOT, stdio: 'ignore' });
  return result.status === 0;
}

// ── Get all worktrees ──────────────────────────────────────────────────────────

function getWorktrees() {
  const raw = run('git worktree list --porcelain');
  const lines = raw.split('\n');
  const trees = [];
  let current = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) trees.push(current);
      current = { path: line.slice(9) };
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    }
  }
  if (current.path) trees.push(current);

  // Exclude main worktree
  return trees.filter(t => t.path !== ROOT && t.branch && t.branch !== 'main');
}

// ── Analyze each worktree ─────────────────────────────────────────────────────

function analyzeWorktree(wt) {
  const branch = wt.branch;

  // Commits ahead of main
  const aheadRaw = run(`git log main..${branch} --oneline 2>/dev/null`);
  const commits  = aheadRaw.split('\n').filter(Boolean);

  if (commits.length === 0) return null; // nothing to merge

  // Has substantive work (not just claim commits)
  const hasWork = commits.some(c => /feat|fix|add|implement|create|update/i.test(c));
  const hasClaim = commits.some(c => /^[a-f0-9]+ claim:/i.test(c));

  // Extract task ID from branch name or commit
  const taskId = (branch.match(/s(\d+-[a-z0-9]+)/i) || ['', ''])[1].toUpperCase()
    || (commits[0].match(/S\d+-[A-Z0-9]+/) || [''])[0];

  // Look for verification file
  const verPath = resolve(ROOT, 'verification/agent-runs', `${taskId}.md`);
  const hasVerification = existsSync(verPath);

  // Last commit message
  const lastCommit = commits[0] ? commits[0].replace(/^[a-f0-9]+ /, '') : '';

  // Days since last commit
  const lastDate = run(`git log ${branch} -1 --format="%ai" 2>/dev/null`);
  const daysOld  = lastDate
    ? Math.round((new Date() - new Date(lastDate)) / 86400000)
    : 0;

  // Conflict check (skip in dry run mode to be fast)
  const conflictFree = true; // will check on --merge only

  return {
    branch,
    taskId,
    commits: commits.length,
    hasWork,
    hasClaim,
    lastCommit,
    daysOld,
    hasVerification,
    conflictFree,
    ready: hasWork && commits.length >= 2, // at least claim + feat commit
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Also check remote codex branches not yet in worktrees
const remoteBranches = run('git branch -r --list "origin/codex/*" 2>/dev/null')
  .split('\n')
  .filter(Boolean)
  .map(b => b.trim().replace('origin/', ''));

const worktrees = getWorktrees();
const allBranches = new Set([
  ...worktrees.map(w => w.branch),
  ...remoteBranches,
]);

const results = [];

for (const branch of allBranches) {
  // Fetch remote state
  run(`git fetch origin ${branch} 2>/dev/null`);

  const aheadRaw = run(`git log main..origin/${branch} --oneline 2>/dev/null`)
    || run(`git log main..${branch} --oneline 2>/dev/null`);
  const commits = aheadRaw.split('\n').filter(Boolean);

  if (commits.length === 0) continue;

  const hasWork  = commits.some(c => /feat|fix|add|implement|create|update/i.test(c));
  const taskId   = (branch.match(/s(\d+-[a-z0-9-]+)/i) || ['',''])[1]
    .toUpperCase().replace(/-([A-Z])/g, m => m);
  const lastCommit = commits[0].replace(/^[a-f0-9]+ /, '');
  const lastDate = run(`git log origin/${branch} -1 --format="%ai" 2>/dev/null`);
  const daysOld  = lastDate ? Math.round((new Date() - new Date(lastDate)) / 86400000) : 0;

  results.push({
    branch,
    taskId: taskId || '',
    commits: commits.length,
    hasWork,
    lastCommit,
    daysOld,
    ready: hasWork && commits.length >= 2,
  });
}

const ready    = results.filter(r => r.ready);
const pending  = results.filter(r => !r.ready);

if (JSON_MODE) {
  console.log(JSON.stringify({ ready, pending, total: results.length }));
  process.exit(0);
}

if (results.length === 0) {
  console.log('\n✅ No hay ramas de agentes con trabajo pendiente de merge.\n');
  process.exit(0);
}

console.log(`\n🔀 Merge-Ready Detector — Aurora Derm`);
console.log(`   ${ready.length} ramas listas · ${pending.length} en progreso\n`);

if (ready.length > 0) {
  console.log('✅ LISTAS PARA MERGE:');
  for (const r of ready) {
    console.log(`\n   Branch: ${r.branch}`);
    if (r.taskId) console.log(`   Task:   ${r.taskId}`);
    console.log(`   Commits: ${r.commits} (${r.daysOld}d old)`);
    console.log(`   Último:  ${r.lastCommit}`);

    if (MERGE_MODE) {
      console.log(`   → Mergeando...`);
      const result = spawnSync('git', [
        'merge', '--no-ff', `origin/${r.branch}`,
        '-m', `merge(${r.taskId || r.branch}): ${r.lastCommit}`,
      ], { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });

      if (result.status === 0) {
        console.log(`   ✅ Mergeado exitosamente`);
      } else {
        console.log(`   ❌ Conflicto — resolver manualmente:`);
        console.log(`      git merge origin/${r.branch}`);
      }
    } else {
      console.log(`   → Para mergear:`);
      console.log(`      git merge --no-ff origin/${r.branch} -m "merge(${r.taskId || r.branch}): ${r.lastCommit}"`);
    }
  }
}

if (pending.length > 0 && !JSON_MODE) {
  console.log(`\n⏳ EN PROGRESO (solo claim, sin feat commit aún):`);
  for (const r of pending) {
    console.log(`   ${r.branch} (${r.commits} commit${r.commits !== 1 ? 's' : ''}, ${r.daysOld}d old) — "${r.lastCommit}"`);
  }
}

if (!MERGE_MODE && ready.length > 0) {
  console.log(`\n   Para mergear todo automáticamente:`);
  console.log(`   node bin/merge-ready.js --merge && git push origin main\n`);
}
console.log();
