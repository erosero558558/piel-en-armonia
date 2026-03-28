'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readScripts() {
    return JSON.parse(read('package.json')).scripts;
}

const {
    COMMANDS,
    OUTPUT_JSON,
    OUTPUT_MD,
    runCommand,
    runGateCommands,
} = require('../bin/gate-turnero-presentation-local.js');

test('turnero presentation cut usa el wrapper local con build publico, engine node y runtime root explicito', () => {
    const scripts = readScripts();
    const command = String(scripts['test:turnero:presentation-cut'] || '');

    assert.match(
        command,
        /^npm run build:public:v6 && node bin\/run-playwright-local\.js /u
    );
    assert.match(command, /--server-engine node/u);
    assert.match(command, /--runtime-root src\/apps\/astro\/dist/u);
    assert.match(command, /tests\/turnero-presentation-cut\.spec\.js/u);
});

test('turnero sony premium usa el wrapper local y evita raw playwright directo', () => {
    const scripts = readScripts();
    const command = String(scripts['test:turnero:sony-premium'] || '');

    assert.match(command, /^node bin\/run-playwright-local\.js /u);
    assert.match(command, /tests\/turnero-sony-premium-contract\.spec\.js/u);
    assert.doesNotMatch(command, /npx playwright test/u);
});

test('gate local de presentacion mantiene el orden canonico y persiste reportes esperados', () => {
    assert.deepEqual(COMMANDS, [
        'npm run build',
        'npm run test:frontend:qa:v6',
        'npm run audit:public:v6:visual-contract',
        'npm run audit:public:v6:sony-evidence',
        'npm run test:turnero:presentation-cut',
        'npm run test:turnero:sony-premium',
        'npm run test:turnero:web-pilot:ui',
    ]);
    assert.match(
        OUTPUT_JSON,
        /verification\/turnero-presentation-local\/gate-report\.json$/
    );
    assert.match(
        OUTPUT_MD,
        /verification\/turnero-presentation-local\/gate-report\.md$/
    );
});

test('runCommand reenvia stdout y stderr mientras conserva tails resumidos', async () => {
    let stdout = '';
    let stderr = '';
    const io = {
        stdout: {
            write(chunk) {
                stdout += String(chunk);
                return true;
            },
        },
        stderr: {
            write(chunk) {
                stderr += String(chunk);
                return true;
            },
        },
    };

    const command =
        process.platform === 'win32'
            ? `${JSON.stringify(process.execPath)} -e "process.stdout.write('alpha\\\\n'); process.stderr.write('beta\\\\n')"`
            : "printf 'alpha\\n'; printf 'beta\\n' >&2";
    const result = await runCommand(command, process.env, io);

    assert.equal(result.success, true);
    assert.equal(result.exitCode, 0);
    assert.match(stdout, /alpha/);
    assert.match(stderr, /beta/);
    assert.equal(result.stdoutTail, 'alpha');
    assert.equal(result.stderrTail, 'beta');
});

test('runGateCommands muestra progreso visible y marca skipped despues del primer fallo', async () => {
    let stdout = '';
    const io = {
        stdout: {
            write(chunk) {
                stdout += String(chunk);
                return true;
            },
        },
        stderr: {
            write() {
                return true;
            },
        },
    };

    const results = await runGateCommands(
        ['cmd-a', 'cmd-b', 'cmd-c'],
        process.env,
        io,
        async (command) => ({
            command,
            startedAt: '2026-03-27T00:00:00.000Z',
            endedAt: '2026-03-27T00:00:01.000Z',
            durationMs: 1000,
            exitCode: command === 'cmd-b' ? 1 : 0,
            success: command !== 'cmd-b',
            stdoutTail: '',
            stderrTail: '',
            error: '',
        })
    );

    assert.match(stdout, /\[turnero-presentation-local\] Running cmd-a/);
    assert.match(stdout, /\[turnero-presentation-local\] PASS cmd-a \(1000ms\)/);
    assert.match(stdout, /\[turnero-presentation-local\] FAIL cmd-b \(1000ms\)/);
    assert.equal(results[0].skipped, false);
    assert.equal(results[1].skipped, false);
    assert.equal(results[2].skipped, true);
});
