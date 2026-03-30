'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync, readFileSync } = require('fs');
const { tmpdir } = require('node:os');
const { resolve } = require('path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin/gen-readme-stats.js');
const {
  buildStatsBlock,
  parseTaskCounts,
  replaceStatsBlock,
} = require('../bin/gen-readme-stats.js');

function write(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
}

test('parseTaskCounts reads done, pending, total, and percent from AGENTS markdown', () => {
  assert.deepEqual(
    parseTaskCounts(`
- [x] **S1-01** \`[S]\` ejemplo
- [ ] **S1-02** \`[M]\` ejemplo
- [x] **UI2-03** \`[S]\` ejemplo
`),
    {
      done: 2,
      pending: 1,
      total: 3,
      percent: 67,
    }
  );
});

test('replaceStatsBlock swaps only the generated region inside README', () => {
  const updated = replaceStatsBlock(
    `# README\n\n<!-- STATS_START -->\nold\n<!-- STATS_END -->\n\ntexto`,
    buildStatsBlock({
      done: 2,
      pending: 1,
      total: 3,
      percent: 67,
      activeSprint: 'Sprint 3 — Demo',
    })
  );

  assert.match(updated, /2\/3/);
  assert.match(updated, /Sprint 3 — Demo/);
  assert.match(updated, /texto/);
});

test('CLI updates README markers from AGENTS data in a temporary root', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'aurora-readme-stats-'));

  try {
    write(
      resolve(dir, 'AGENTS.md'),
      `
### 🎯 Sprint 3 — Demo
- [x] **S3-01** \`[S]\` demo
- [ ] **S3-02** \`[M]\` demo
`
    );
    write(
      resolve(dir, 'README.md'),
      `# README\n\n## Estado actual del proyecto\n\n<!-- STATS_START -->\nplaceholder\n<!-- STATS_END -->\n`
    );

    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      encoding: 'utf8',
      env: { ...process.env, AURORA_DERM_ROOT: dir },
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /README\.md stats updated/);

    const readme = readFileSync(resolve(dir, 'README.md'), 'utf8');
    assert.match(readme, /\*\*1\/2\*\*/);
    assert.match(readme, /50%/);
    assert.match(readme, /Sprint 3 — Demo/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
