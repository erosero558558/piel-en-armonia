'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin/dispatch.js');
const {
  buildDispatchResult,
  formatDispatchText,
  resolveWipLimit,
} = require('../bin/dispatch.js');

function write(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

function createFixtureRoot() {
  const dir = mkdtempSync(resolve(tmpdir(), 'aurora-dispatch-wip-'));
  mkdirSync(resolve(dir, 'data/claims/tasks'), { recursive: true });
  return dir;
}

test('resolveWipLimit accepts per-role env overrides', () => {
  assert.equal(
    resolveWipLimit('backend', {
      argv: [],
      env: { DISPATCH_WIP_LIMIT_BACKEND: '3' },
    }),
    3
  );
});

test('buildDispatchResult blocks a role when active claims hit the configured WIP limit', () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const result = buildDispatchResult({
    roleArg: 'backend',
    md: `
### Sprint 3
- [ ] **S3-19** \`[M]\` Receta digital — php y pdf.
- [ ] **S3-25** \`[M]\` Confirmación WhatsApp+email al agendar.
- [ ] **S3-34** \`[M]\` Estado de cuenta por paciente.
`.trim(),
    claims: {
      'S3-19': { agent: 'Codex-A', expiresAt: future },
      'S3-25': { agent: 'Codex-B', expiresAt: future },
    },
    wipLimit: 2,
  });

  assert.equal(result.wipLimited, true);
  assert.equal(result.activeClaimsForRole.length, 2);
  assert.equal(result.best, null);
  assert.match(formatDispatchText(result), /WIP limit reached/);
});

test('CLI shows WIP limit message for a saturated backend lane and allows override', () => {
  const dir = createFixtureRoot();
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  try {
    write(
      resolve(dir, 'AGENTS.md'),
      `
### Sprint 3
- [ ] **S3-19** \`[M]\` Receta digital — php y pdf.
- [ ] **S3-25** \`[M]\` Confirmación WhatsApp+email al agendar.
- [ ] **S3-34** \`[M]\` Estado de cuenta por paciente.
`.trim()
    );
    write(
      resolve(dir, 'data/claims/tasks/S3-19.json'),
      JSON.stringify({ agent: 'Codex-A', expiresAt: future }, null, 2)
    );
    write(
      resolve(dir, 'data/claims/tasks/S3-25.json'),
      JSON.stringify({ agent: 'Codex-B', expiresAt: future }, null, 2)
    );

    const blocked = spawnSync(process.execPath, [SCRIPT_PATH, '--role', 'backend'], {
      encoding: 'utf8',
      env: { ...process.env, AURORA_DERM_ROOT: dir },
    });
    assert.equal(blocked.status, 0);
    assert.match(blocked.stdout, /WIP limit reached/);
    assert.match(blocked.stdout, /S3-19/);
    assert.match(blocked.stdout, /S3-25/);

    const overridden = spawnSync(
      process.execPath,
      [SCRIPT_PATH, '--role', 'backend', '--wip-limit', '3'],
      {
        encoding: 'utf8',
        env: { ...process.env, AURORA_DERM_ROOT: dir },
      }
    );
    assert.equal(overridden.status, 0);
    assert.match(overridden.stdout, /Tarea recomendada/);
    assert.match(overridden.stdout, /S3-34/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
