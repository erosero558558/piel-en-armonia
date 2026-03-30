'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'stuck.js');
const BLOCKERS_TEMPLATE = readFileSync(resolve(REPO_ROOT, 'BLOCKERS.md'), 'utf8');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeJson(filePath, payload) {
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function setupTempRepo(taskId = 'S9-99') {
  const repoDir = mkdtempSync(join(tmpdir(), 'aurora-stuck-'));
  mkdirSync(join(repoDir, 'data', 'claims', 'tasks'), { recursive: true });
  writeFileSync(join(repoDir, 'BLOCKERS.md'), BLOCKERS_TEMPLATE, 'utf8');
  writeJson(join(repoDir, 'data', 'claims', 'tasks', `${taskId}.json`), {
    agent: 'TestAgent',
    claimedAt: '2026-03-29T00:00:00.000Z',
    expiresAt: '2026-03-29T04:00:00.000Z',
    sprint: 'Sprint Test',
    section: 'Seccion Test',
    size: 'S',
  });

  git(repoDir, ['init']);
  git(repoDir, ['config', 'user.name', 'Test Bot']);
  git(repoDir, ['config', 'user.email', 'test@example.com']);
  git(repoDir, ['add', 'BLOCKERS.md', 'data']);
  git(repoDir, ['commit', '-m', 'test: baseline']);

  return repoDir;
}

function runStuck(repoDir, args, extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AURORA_DERM_ROOT: repoDir,
      AURORADERM_SKIP_ENV_FILE: '1',
      PIELARMONIA_SKIP_ENV_FILE: '1',
      PIELARMONIA_DATA_DIR: join(repoDir, 'data'),
      ...extraEnv,
    },
  });
}

test('bin/stuck.js releases the claim, updates BLOCKERS.md, and auto-commits', () => {
  const repoDir = setupTempRepo('S9-99');

  try {
    const result = runStuck(repoDir, ['S9-99', 'Calendar caido']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Claim released for S9-99/);
    assert.match(result.stdout, /Commit automático creado/);

    const blockers = readFileSync(join(repoDir, 'BLOCKERS.md'), 'utf8');
    const stuckJson = JSON.parse(readFileSync(join(repoDir, 'data', 'claims', 'stuck.json'), 'utf8'));
    const lastCommit = git(repoDir, ['log', '-1', '--pretty=%s']);
    const changedFiles = git(repoDir, ['show', '--name-only', '--pretty=', 'HEAD']);

    assert.equal(stuckJson['S9-99'].agent, 'TestAgent');
    assert.equal(stuckJson['S9-99'].reason, 'Calendar caido');
    assert.equal(stuckJson['S9-99'].resolved, false);
    assert.match(blockers, /## 🚧 Blockers activos/);
    assert.match(blockers, /### S9-99/);
    assert.match(blockers, /- Agente: TestAgent/);
    assert.match(blockers, /- Razón: Calendar caido/);
    assert.doesNotMatch(blockers, /## Sin blockers activos/);
    assert.equal(lastCommit, 'stuck: S9-99 - Calendar caido');
    assert.match(changedFiles, /BLOCKERS\.md/);
    assert.match(changedFiles, /data\/claims\/stuck\.json/);
    assert.match(changedFiles, /data\/claims\/tasks\/S9-99\.json/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('bin/stuck.js clear removes the active blocker section and auto-commits the resolution', () => {
  const repoDir = setupTempRepo('S9-98');

  try {
    const markResult = runStuck(repoDir, ['S9-98', 'Falta decision']);
    assert.equal(markResult.status, 0, markResult.stderr);

    const clearResult = runStuck(repoDir, ['clear', 'S9-98']);
    assert.equal(clearResult.status, 0, clearResult.stderr);
    assert.match(clearResult.stdout, /marked as resolved/);
    assert.match(clearResult.stdout, /Auto-commit: fix: resolved blocker S9-98/);

    const blockers = readFileSync(join(repoDir, 'BLOCKERS.md'), 'utf8');
    const stuckJson = JSON.parse(readFileSync(join(repoDir, 'data', 'claims', 'stuck.json'), 'utf8'));
    const lastCommit = git(repoDir, ['log', '-1', '--pretty=%s']);

    assert.equal(stuckJson['S9-98'].resolved, true);
    assert.match(blockers, /_No hay blockers activos generados por `bin\/stuck\.js`\._/);
    assert.doesNotMatch(blockers, /### S9-98/);
    assert.equal(lastCommit, 'fix: resolved blocker S9-98');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('bin/stuck.js list re-syncs BLOCKERS.md from stuck.json when the markdown is stale', () => {
  const repoDir = setupTempRepo('S9-96');

  try {
    writeJson(join(repoDir, 'data', 'claims', 'stuck.json'), {
      'S9-96': {
        agent: 'TestAgent',
        reason: 'Necesita decision',
        stuckAt: '2026-03-29T12:00:00.000Z',
        resolved: false,
        resolvedAt: null,
      },
    });

    writeFileSync(
      join(repoDir, 'BLOCKERS.md'),
      BLOCKERS_TEMPLATE.replace(
        '_No hay blockers activos generados por `bin/stuck.js`._',
        '### S0-00\n- Fecha: stale\n- Agente: stale\n- Razón: stale'
      ),
      'utf8'
    );

    const listResult = runStuck(repoDir, ['list']);
    assert.equal(listResult.status, 0, listResult.stderr);
    assert.match(listResult.stdout, /🚧 Tareas bloqueadas/);
    assert.match(listResult.stdout, /S9-96/);

    const blockers = readFileSync(join(repoDir, 'BLOCKERS.md'), 'utf8');
    assert.match(blockers, /### S9-96/);
    assert.match(blockers, /- Agente: TestAgent/);
    assert.match(blockers, /- Razón: Necesita decision/);
    assert.doesNotMatch(blockers, /### S0-00/);
    assert.doesNotMatch(blockers, /Agente: stale/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('bin/stuck.js queues a director WhatsApp notification when AURORADERM_DIRECTOR_PHONE is configured', () => {
  const repoDir = setupTempRepo('S9-97');

  try {
    const result = runStuck(
      repoDir,
      ['S9-97', 'Necesita decision del director'],
      { AURORADERM_DIRECTOR_PHONE: '+593999000001' }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /WhatsApp al director encolado:/);

    const outboxDir = join(repoDir, 'data', 'whatsapp-openclaw', 'outbox');
    const files = readdirSync(outboxDir);
    assert.equal(files.length, 1);

    const record = JSON.parse(readFileSync(join(outboxDir, files[0]), 'utf8'));
    assert.equal(record.phone, '593999000001');
    assert.equal(record.type, 'text');
    assert.equal(record.status, 'pending');
    assert.match(String(record.text || ''), /Tarea: S9-97/);
    assert.match(String(record.text || ''), /Agente: TestAgent/);
    assert.match(String(record.text || ''), /Razon: Necesita decision del director/);
    assert.equal(record.meta.taskId, 'S9-97');
    assert.equal(record.meta.agent, 'TestAgent');
    assert.equal(record.meta.source, 'bin/stuck.js');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
