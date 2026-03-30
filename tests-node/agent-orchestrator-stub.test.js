'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SCRIPT = resolve(REPO_ROOT, 'agent-orchestrator.js');

function writeJson(filePath, payload) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function setupTempRoot() {
  const rootDir = mkdtempSync(join(tmpdir(), 'aurora-orchestrator-'));
  writeFileSync(
    join(rootDir, 'AGENTS.md'),
    [
      '# AGENTS',
      '',
      '### Sprint 15 — Test',
      '- [x] **S15-01** `[S]` Cerrada.',
      '- [ ] **S15-05** `[M]` Alertas de claim expirado.',
      '',
    ].join('\n'),
    'utf8'
  );

  writeJson(join(rootDir, 'data', 'claims', 'tasks', 'S15-05.json'), {
    agent: 'Expired Agent',
    claimedAt: '2026-03-30T08:00:00.000Z',
    expiresAt: '2026-03-30T09:00:00.000Z',
    sprint: 'Sprint Test',
    section: 'Section Test',
    size: 'M',
  });

  return rootDir;
}

function runStatus(rootDir) {
  return spawnSync(process.execPath, [ORCHESTRATOR_SCRIPT, 'status'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AURORA_DERM_ROOT: rootDir,
    },
  });
}

test('agent-orchestrator status exposes expiryWarning for expired claims', () => {
  const rootDir = setupTempRoot();

  try {
    const result = runStatus(rootDir);
    assert.equal(result.status, 0, result.stderr);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.expiryWarning.count, 1);
    assert.deepEqual(payload.expiryWarning.claims[0], {
      taskId: 'S15-05',
      agent: 'Expired Agent',
      expiresAt: '2026-03-30T09:00:00.000Z',
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
