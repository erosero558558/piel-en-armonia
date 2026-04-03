const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = resolve(__dirname, '..');
const scriptPath = resolve(repoRoot, 'bin/sync-backlog.js');

function runSyncBacklog(agentsContent) {
    const tempDir = mkdtempSync(join(tmpdir(), 'sync-backlog-statuses-'));
    const agentsFile = join(tempDir, 'AGENTS.md');
    const backlogFile = join(tempDir, 'BACKLOG.md');
    const claimsDir = join(tempDir, 'claims');
    mkdirSync(claimsDir, { recursive: true });
    writeFileSync(agentsFile, agentsContent);

    const result = spawnSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        env: {
            ...process.env,
            AURORA_AGENTS_FILE: agentsFile,
            AURORA_BACKLOG_FILE: backlogFile,
            AURORA_CLAIMS_DIR: claimsDir,
        },
        encoding: 'utf8',
    });

    const backlog = readFileSync(backlogFile, 'utf8');
    rmSync(tempDir, { recursive: true, force: true });
    return { result, backlog };
}

test('sync-backlog distingue [ ], [/] [~] y [x]', () => {
    const { result, backlog } = runSyncBacklog(`
## Sprint 35 — Demo
- [ ] **DEBT-03** \`[L]\` trabajo pendiente. Verificable: grep foo
- [/] **GOV-02** \`[M]\` trabajo en progreso. Verificable: grep bar
- [~] **GOV-03** \`[M]\` cayó en main, falta producción. Verificable: grep baz
- [x] **OPS-03** \`[M]\` ya verificado. Verificable: grep qux
`);

    assert.equal(result.status, 0);
    assert.match(backlog, /Verificado \| Main ~ \| Pendiente \| % verificado/);
    assert.match(backlog, /### 🟢 Disponibles \(1\)/);
    assert.match(backlog, /\*\*DEBT-03\*\*/);
    assert.match(backlog, /### 🟡 En progreso/);
    assert.match(backlog, /\*\*GOV-02\*\*/);
    assert.match(backlog, /### 🟣 En main, pendiente de producción/);
    assert.match(backlog, /\*\*GOV-03\*\*/);
    assert.doesNotMatch(backlog, /\*\*OPS-03\*\*.*Disponibles/);
});
