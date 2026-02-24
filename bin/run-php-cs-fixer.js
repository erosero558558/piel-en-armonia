#!/usr/bin/env node
'use strict';

const { existsSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const args = process.argv.slice(2);

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function run(command, commandArgs, options = {}) {
    return spawnSync(command, commandArgs, {
        cwd: root,
        stdio: 'inherit',
        ...options,
    });
}

function tryPhpInPath() {
    const probe = spawnSync('php', ['-v'], {
        cwd: root,
        stdio: 'ignore',
        shell: false,
    });
    return !probe.error && probe.status === 0;
}

if (args.length === 0) {
    fail('Uso: node bin/run-php-cs-fixer.js <args...>');
}

// Prefer the Windows launcher to avoid "vendor/bin/php-cs-fixer" spawn issues in lint-staged.
if (isWin) {
    const batPath = resolve(root, 'vendor', 'bin', 'php-cs-fixer.bat');
    if (existsSync(batPath)) {
        const result = run(batPath, args, { shell: true });
        if (result.error) {
            fail(
                `no se pudo ejecutar php-cs-fixer.bat: ${result.error.message}`
            );
        }
        process.exit(result.status === null ? 1 : result.status);
    }
}

const fixerPath = resolve(root, 'vendor', 'bin', 'php-cs-fixer');
if (!existsSync(fixerPath)) {
    fail('No existe vendor/bin/php-cs-fixer. Ejecuta `composer install`.');
}

if (!tryPhpInPath()) {
    fail(
        'PHP no esta disponible en PATH. Configura PATH o instala PHP para ejecutar php-cs-fixer.'
    );
}

const result = run('php', [fixerPath, ...args]);
if (result.error) {
    fail(`no se pudo ejecutar php-cs-fixer: ${result.error.message}`);
}

process.exit(result.status === null ? 1 : result.status);
