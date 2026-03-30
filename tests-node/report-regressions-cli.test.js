'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const REPORT_SCRIPT = resolve(REPO_ROOT, 'bin/report.js');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

function createTempRepo() {
  const dir = mkdtempSync(resolve(tmpdir(), 'aurora-report-regressions-'));
  git(dir, ['init']);
  git(dir, ['config', 'user.name', 'Codex']);
  git(dir, ['config', 'user.email', 'codex@example.com']);
  mkdirSync(resolve(dir, 'data/claims/tasks'), { recursive: true });
  return dir;
}

test('report shows regression section without failing when regression-watch finds suspicious changes', () => {
  const dir = createTempRepo();

  try {
    write(
      resolve(dir, 'AGENTS.md'),
      '- [x] **S3-40** `[M]` Integrar OpenClaw en `admin.html`\n'
    );
    write(resolve(dir, 'admin.html'), '<html>ok</html>\n');
    git(dir, ['add', 'AGENTS.md', 'admin.html']);
    git(dir, ['commit', '-m', 'feat: add admin']);

    git(dir, ['rm', 'admin.html']);
    git(dir, ['commit', '-m', 'refactor: remove admin']);

    const result = spawnSync(process.execPath, [REPORT_SCRIPT], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, AURORA_DERM_ROOT: dir },
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Regresiones sospechosas/);
    assert.match(result.stdout, /admin\.html mencionado en S3-40/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('markdown report renders an explicit no-regressions section when watchdog is green', () => {
  const dir = createTempRepo();

  try {
    write(
      resolve(dir, 'AGENTS.md'),
      '- [x] **S3-40** `[M]` Integrar OpenClaw en `admin.html`\n'
    );
    write(resolve(dir, 'admin.html'), '<html>ok</html>\n');
    git(dir, ['add', 'AGENTS.md', 'admin.html']);
    git(dir, ['commit', '-m', 'feat: add admin']);

    write(resolve(dir, 'admin.html'), '<html>better</html>\n');
    git(dir, ['add', 'admin.html']);
    git(dir, ['commit', '-m', 'chore: touch admin']);

    const result = spawnSync(process.execPath, [REPORT_SCRIPT, '--md'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, AURORA_DERM_ROOT: dir },
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /## Regresiones sospechosas/);
    assert.match(result.stdout, /Sin regresiones sospechosas/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
