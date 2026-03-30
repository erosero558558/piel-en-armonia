'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin/regression-watch.js');
const {
    buildRegressionReport,
    extractExplicitFiles,
    parseDoneTasks,
} = require('../bin/regression-watch.js');

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

test('extractExplicitFiles ignora rutas sin archivo y conserva paths explícitos', () => {
    assert.deepEqual(
        extractExplicitFiles(
            'crear `es/pre-consulta/` y tocar `admin.html`, `bin/regression-watch.js` y `src/apps/patient-flow-os/docs/WORKFLOW_CONTRACTS.md`'
        ),
        [
            'admin.html',
            'bin/regression-watch.js',
            'src/apps/patient-flow-os/docs/WORKFLOW_CONTRACTS.md',
        ]
    );
});

test('buildRegressionReport marca archivos borrados referenciados por tareas done', () => {
    const report = buildRegressionReport({
        agentsMarkdown:
            '- [x] **S3-40** `[M]` Integrar OpenClaw en `ghost-regression-watch.html` y `js/openclaw-chat.js`\n',
        diffStat:
            ' ghost-regression-watch.html | 10 ----------\n js/openclaw-chat.js | 2 +-\n',
        nameStatus: 'D\tghost-regression-watch.html\nM\tjs/openclaw-chat.js\n',
    });

    assert.equal(report.ok, false);
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].taskId, 'S3-40');
    assert.equal(report.findings[0].file, 'ghost-regression-watch.html');
    assert.equal(report.findings[0].reason, 'deleted');
});

test('CLI reports zero regressions when recent touches did not delete or empty tracked files', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'aurora-regression-watch-ok-'));

    try {
        git(dir, ['init']);
        git(dir, ['config', 'user.name', 'Codex']);
        git(dir, ['config', 'user.email', 'codex@example.com']);

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

        const result = spawnSync(process.execPath, [SCRIPT_PATH, '--json'], {
            cwd: dir,
            encoding: 'utf8',
            env: { ...process.env, AURORA_DERM_ROOT: dir },
        });
        const report = JSON.parse(result.stdout);

        assert.equal(result.status, 0);
        assert.equal(report.ok, true);
        assert.equal(report.findings.length, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('CLI reports a deleted tracked file as regression in a temporary repo', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'aurora-regression-watch-bad-'));

    try {
        git(dir, ['init']);
        git(dir, ['config', 'user.name', 'Codex']);
        git(dir, ['config', 'user.email', 'codex@example.com']);

        write(
            resolve(dir, 'AGENTS.md'),
            '- [x] **S3-40** `[M]` Integrar OpenClaw en `admin.html`\n'
        );
        write(resolve(dir, 'admin.html'), '<html>ok</html>\n');
        git(dir, ['add', 'AGENTS.md', 'admin.html']);
        git(dir, ['commit', '-m', 'feat: add admin']);

        git(dir, ['rm', 'admin.html']);
        git(dir, ['commit', '-m', 'refactor: remove admin']);

        const result = spawnSync(process.execPath, [SCRIPT_PATH, '--json'], {
            cwd: dir,
            encoding: 'utf8',
            env: { ...process.env, AURORA_DERM_ROOT: dir },
        });
        const report = JSON.parse(result.stdout);

        assert.equal(result.status, 1);
        assert.equal(report.ok, false);
        assert.equal(report.findings.length, 1);
        assert.equal(report.findings[0].file, 'admin.html');
        assert.equal(report.findings[0].reason, 'deleted');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('parseDoneTasks keeps only done tasks with explicit file references', () => {
    const tasks = parseDoneTasks(`
- [x] **S3-40** [M] Integrar OpenClaw en \`admin.html\`
- [ ] **S3-41** [M] pendiente en \`admin.js\`
- [x] **S3-42** [S] sin archivo explícito
`);

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 'S3-40');
    assert.deepEqual(tasks[0].files, ['admin.html']);
});
