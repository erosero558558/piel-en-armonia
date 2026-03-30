'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const REPO_ROOT = resolve(__dirname, '..');
const CLAIM_SCRIPT = resolve(REPO_ROOT, 'bin', 'claim.js');

function writeJson(filePath, payload) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function setupTempRoot() {
  const rootDir = mkdtempSync(join(tmpdir(), 'aurora-claim-'));
  writeFileSync(
    join(rootDir, 'AGENTS.md'),
    [
      '# AGENTS',
      '',
      '### Sprint Test',
      '- [ ] **S15-05** `[M]` Alerta de claim expirado.',
      '- [ ] **S15-06** `[S]` Otra tarea activa.',
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
  writeJson(join(rootDir, 'data', 'claims', 'tasks', 'S15-06.json'), {
    agent: 'Active Agent',
    claimedAt: '2026-03-30T10:00:00.000Z',
    expiresAt: '2099-03-30T12:00:00.000Z',
    sprint: 'Sprint Test',
    section: 'Section Test',
    size: 'S',
  });

  return rootDir;
}

function runClaim(rootDir, args) {
  return spawnSync(process.execPath, [CLAIM_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AURORA_DERM_ROOT: rootDir,
    },
  });
}

test('claim.js list shows active and expired claims with an explicit warning section', () => {
  const rootDir = setupTempRoot();

  try {
    const result = runClaim(rootDir, ['list']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Claims activos: 1 \| Expirados: 1/);
    assert.match(result.stdout, /🔒 Claims activos \(NO duplicar\):/);
    assert.match(result.stdout, /S15-06 → "Active Agent"/);
    assert.match(result.stdout, /⚠️ Claims expiradas:/);
    assert.match(result.stdout, /S15-05 → "Expired Agent"/);
    assert.doesNotMatch(result.stdout, /bin\/claim\.js v2/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
