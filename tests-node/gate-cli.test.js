'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'gate.js');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function setupTempRoot({ taskId = 'S15-99', taskLine, files = {} }) {
  const repoDir = mkdtempSync(join(tmpdir(), 'aurora-gate-'));
  writeFileSync(
    join(repoDir, 'AGENTS.md'),
    [
      '# AGENTS',
      '',
      '### Sprint Test',
      taskLine || `- [ ] **${taskId}** \`[M]\` Demo task — \`js/aurora-toast.js\` debe existir.`,
      '',
    ].join('\n'),
    'utf8'
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(repoDir, relativePath);
    mkdirSync(resolve(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  git(repoDir, ['init']);
  git(repoDir, ['config', 'user.name', 'Test Bot']);
  git(repoDir, ['config', 'user.email', 'test@example.com']);
  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'test: baseline']);

  return repoDir;
}

function runGate(repoDir, taskId) {
  return spawnSync(process.execPath, [SCRIPT_PATH, taskId], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AURORA_DERM_ROOT: repoDir,
    },
  });
}

test('gate fails when a task references an explicit file that does not exist', () => {
  const repoDir = setupTempRoot({
    taskId: 'S15-99',
    taskLine:
      '- [ ] **S15-99** `[M]` Demo task — `js/aurora-toast.js` debe existir antes de marcar done.',
  });

  try {
    const result = runGate(repoDir, 'S15-99');

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Explicit file refs exist/);
    assert.match(result.stdout, /Task references missing file\(s\): js\/aurora-toast\.js/);
    assert.match(result.stdout, /GATE FAILED/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('gate passes the generic evidence check when the referenced file exists', () => {
  const repoDir = setupTempRoot({
    taskId: 'S15-98',
    taskLine:
      '- [ ] **S15-98** `[M]` Demo task — `js/aurora-toast.js` debe existir antes de marcar done.',
    files: {
      'js/aurora-toast.js': 'console.log("toast");\n',
    },
  });

  try {
    const result = runGate(repoDir, 'S15-98');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Explicit file refs exist — 1 explicit refs verified: js\/aurora-toast\.js/);
    assert.match(result.stdout, /GATE PASSED/);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
