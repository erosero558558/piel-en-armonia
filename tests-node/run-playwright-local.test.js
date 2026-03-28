#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    DEFAULT_SERVER_ENGINE,
    DEFAULT_PHP_SERVER_WORKERS,
    buildPlaywrightCommandArgs,
    buildChildEnv,
    extractListeningPids,
    parseArgs,
    resolveLocalServerPort,
} = require('../bin/run-playwright-local.js');

const REPO_ROOT = path.resolve(__dirname, '..');

function readPackageScripts() {
    return JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
    ).scripts;
}

test('run-playwright-local arma el comando canonico de playwright test', () => {
    assert.equal(DEFAULT_PHP_SERVER_WORKERS, '1');
    assert.equal(DEFAULT_SERVER_ENGINE, 'php');
    assert.deepEqual(
        buildPlaywrightCommandArgs(['tests/admin-queue.spec.js']),
        ['playwright', 'test', 'tests/admin-queue.spec.js']
    );
    assert.deepEqual(buildPlaywrightCommandArgs(['--workers=1']), [
        'playwright',
        'test',
        '--workers=1',
    ]);
});

test('run-playwright-local parsea puerto auto, host y base URL sin mezclar flags de playwright', () => {
    const parsed = parseArgs(
        [
            '--port',
            'auto',
            '--host',
            '0.0.0.0',
            '--timeout-ms',
            '9000',
            '--base-url',
            'https://pielarmonia.com',
            'tests/queue-display.spec.js',
            '--workers=1',
        ],
        {}
    );

    assert.equal(parsed.port, 8011);
    assert.equal(parsed.portSource, 'default');
    assert.equal(parsed.host, '0.0.0.0');
    assert.equal(parsed.timeoutMs, 9000);
    assert.equal(parsed.baseUrl, 'https://pielarmonia.com');
    assert.deepEqual(parsed.playwrightArgs, [
        'tests/queue-display.spec.js',
        '--workers=1',
    ]);
});

test('run-playwright-local parsea runtime-root para server engine node sin mezclar flags de playwright', () => {
    const parsed = parseArgs(
        [
            '--server-engine',
            'node',
            '--runtime-root',
            'src/apps/astro/dist',
            'tests/turnero-presentation-cut.spec.js',
            '--workers=1',
        ],
        {}
    );

    assert.equal(parsed.serverEngine, 'node');
    assert.equal(parsed.runtimeRoot, 'src/apps/astro/dist');
    assert.deepEqual(parsed.playwrightArgs, [
        'tests/turnero-presentation-cut.spec.js',
        '--workers=1',
    ]);
});

test('run-playwright-local escanea el siguiente puerto libre cuando el preferido esta ocupado', async () => {
    const resolved = await resolveLocalServerPort(
        {
            host: '127.0.0.1',
            port: 8011,
            portSource: 'default',
            portWindow: 4,
            baseUrl: '',
        },
        async (_host, port) => port === 8013
    );

    assert.equal(resolved, 8013);
});

test('run-playwright-local extrae pids desde la salida de ss sin duplicados', () => {
    assert.deepEqual(
        extractListeningPids(
            'LISTEN 0 4096 127.0.0.1:8018 users:(("php",pid=60854,fd=4),(("php",pid=60854,fd=5)),("node",pid=70001,fd=9))'
        ),
        [60854, 70001]
    );
});

test('run-playwright-local fuerza TEST_BASE_URL y desactiva reuseExistingServer cuando levanta servidor propio', () => {
    const env = buildChildEnv(
        {
            TEST_REUSE_EXISTING_SERVER: '1',
            TEST_LOCAL_SERVER_PORT: '8011',
        },
        {
            host: '127.0.0.1',
            baseUrl: '',
        },
        9124
    );

    assert.equal(env.TEST_BASE_URL, 'http://127.0.0.1:9124');
    assert.equal(env.TEST_LOCAL_SERVER_PORT, '9124');
    assert.equal(env.TEST_REUSE_EXISTING_SERVER, '0');
});

test('run-playwright-local conserva un base URL explicito y limpia el puerto local heredado', () => {
    const env = buildChildEnv(
        {
            TEST_LOCAL_SERVER_PORT: '8011',
        },
        {
            host: '127.0.0.1',
            baseUrl: 'https://pielarmonia.com',
        },
        0
    );

    assert.equal(env.TEST_BASE_URL, 'https://pielarmonia.com');
    assert.equal('TEST_LOCAL_SERVER_PORT' in env, false);
    assert.equal(env.TEST_REUSE_EXISTING_SERVER, '0');
});

test('scripts de admin y turnero usan wrappers locales o runners canonicos para aislar Playwright del webServer', () => {
    const scripts = readPackageScripts();

    for (const scriptName of [
        'test:admin:auth',
        'test:admin:queue',
        'test:turnero:presentation-cut',
        'test:turnero:sony-premium',
        'test:turnero:ui',
    ]) {
        assert.equal(
            String(scripts[scriptName] || '').includes(
                'node bin/run-playwright-local.js'
            ),
            true,
            `${scriptName} debe usar bin/run-playwright-local.js`
        );
    }

    assert.equal(
        String(scripts['test:turnero:web-pilot:ui'] || '').includes(
            'node bin/run-turnero-web-pilot-ui.js'
        ),
        true,
        'test:turnero:web-pilot:ui debe usar bin/run-turnero-web-pilot-ui.js'
    );
});
