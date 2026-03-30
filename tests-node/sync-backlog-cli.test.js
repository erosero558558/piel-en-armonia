'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'sync-backlog.js');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function agentsMarkdown(state) {
  return `# AGENTS.md

### 🧪 Sprint 15 — Prueba backlog

- [${state}] **S15-06** \`[S]\` Detector de commits done sin claim — fixture de prueba.
`;
}

function setupTempRepo() {
  const repoDir = mkdtempSync(join(tmpdir(), 'aurora-sync-backlog-'));
  mkdirSync(join(repoDir, 'data', 'claims', 'tasks'), { recursive: true });
  writeFileSync(join(repoDir, 'AGENTS.md'), agentsMarkdown(' '), 'utf8');

  git(repoDir, ['init']);
  git(repoDir, ['config', 'user.name', 'Test Bot']);
  git(repoDir, ['config', 'user.email', 'test@example.com']);
  git(repoDir, ['add', 'AGENTS.md']);
  git(repoDir, ['commit', '-m', 'test: baseline']);

  return repoDir;
}

function runSync(repoDir) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AURORA_DERM_ROOT: repoDir,
    },
  });
}

test('sync-backlog warns when a task is marked done without claim evidence', () => {
  const repoDir = setupTempRepo();

  try {
    writeFileSync(join(repoDir, 'AGENTS.md'), agentsMarkdown('x'), 'utf8');

    const result = runSync(repoDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /⚠️\s+Done sin claim detectado \(1\):/);
    assert.match(result.stdout, /S15-06 fue marcada \[x\] en AGENTS\.md sin claim asociado en este cambio/);
    assert.match(readFileSync(join(repoDir, 'BACKLOG.md'), 'utf8'), /Sprint 15 — Prueba backlog/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('sync-backlog does not warn when the same change set includes claim evidence release', () => {
  const repoDir = setupTempRepo();

  try {
    const claimPath = join(repoDir, 'data', 'claims', 'tasks', 'S15-06.json');
    writeFileSync(claimPath, JSON.stringify({
      agent: 'TestAgent',
      claimedAt: '2026-03-30T00:00:00.000Z',
      expiresAt: '2026-03-30T04:00:00.000Z',
      sprint: 'Sprint 15',
      section: 'Convergencia',
      size: 'S',
    }, null, 2) + '\n', 'utf8');
    git(repoDir, ['add', 'data/claims/tasks/S15-06.json']);
    git(repoDir, ['commit', '-m', 'claim: S15-06']);

    unlinkSync(claimPath);
    writeFileSync(join(repoDir, 'AGENTS.md'), agentsMarkdown('x'), 'utf8');

    const result = runSync(repoDir);

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Done sin claim detectado/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
