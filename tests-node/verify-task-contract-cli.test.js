const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = resolve(__dirname, '..');
const scriptPath = resolve(repoRoot, 'bin/verify-task-contract.js');

function runCli(args, agentsContent) {
    const tempDir = mkdtempSync(join(tmpdir(), 'verify-task-contract-'));
    const agentsFile = join(tempDir, 'AGENTS.md');
    writeFileSync(agentsFile, agentsContent);

    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: repoRoot,
        env: {
            ...process.env,
            AURORA_AGENTS_FILE: agentsFile,
        },
        encoding: 'utf8',
    });

    rmSync(tempDir, { recursive: true, force: true });
    return result;
}

test('verify-task-contract soporta IDs actuales y estados [/] [~]', () => {
    const result = runCli(
        ['--json'],
        `
## Sprint
- [ ] **GOV-02** \`[M]\` Add state. Verificable: grep "\\[~\\]" AGENTS.md
- [/] **DEBT-03** \`[L]\` Missing contract
- [~] **S35-99** \`[M]\` Ready in main. Verificable: curl 200
- [ ] **UX-10** \`[S]\` Missing warning
- [x] **OPS-03** \`[M]\` Done item without contract
        `
    );

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);

    assert.equal(payload.total, 4);
    assert.deepEqual(
        payload.violations.map((task) => task.id),
        ['DEBT-03']
    );
    assert.deepEqual(
        payload.warnings.map((task) => task.id),
        ['UX-10']
    );
    assert.deepEqual(
        payload.ok.map((task) => task.id).sort(),
        ['GOV-02', 'S35-99']
    );
    assert.equal(payload.fail_on_warning, false);
});

test('verify-task-contract --fail-on-warning eleva warnings [S] a exit code 1', () => {
    const agents = `
## Sprint
- [ ] **UX-10** \`[S]\` Missing warning
    `;

    const softResult = runCli([], agents);
    assert.equal(softResult.status, 0);

    const strictResult = runCli(['--fail-on-warning'], agents);
    assert.equal(strictResult.status, 1);
    assert.match(strictResult.stdout, /fail-on-warning/i);
});

test('hook husky pre-push ejecuta verify-task-contract estricto', () => {
    const hook = readFileSync(resolve(repoRoot, '.husky/pre-push'), 'utf8');
    assert.match(hook, /verify-task-contract\.js --fail-on-warning/);
});
