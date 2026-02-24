#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildPhpCsFixerArgs,
    findPhpCsFixerConfig,
} = require('../bin/run-php-cs-fixer.js');

test('run-php-cs-fixer wrapper injecta config y path-mode para fix multi-file', () => {
    const args = buildPhpCsFixerArgs([
        'fix',
        'bin/validate-agent-governance.php',
        'api.php',
    ]);

    assert.equal(args[0], 'fix');
    assert.equal(args.includes('--path-mode=intersection'), true);

    const configArg = args.find((arg) => String(arg).startsWith('--config='));
    assert.ok(configArg, 'debe inyectar --config cuando no viene definido');
    assert.match(configArg, /^--config=\.(php-cs-fixer(\.dist)?\.php)$/);
});

test('run-php-cs-fixer wrapper no duplica --config ni --path-mode si ya vienen', () => {
    const args = buildPhpCsFixerArgs([
        'fix',
        '--config=.php-cs-fixer.dist.php',
        '--path-mode=override',
        'a.php',
        'b.php',
    ]);

    assert.equal(
        args.filter((arg) => String(arg).startsWith('--config')).length,
        1
    );
    assert.equal(
        args.filter((arg) => String(arg).startsWith('--path-mode')).length,
        1
    );
    assert.equal(args.includes('--path-mode=override'), true);
    assert.equal(args.includes('--path-mode=intersection'), false);
});

test('run-php-cs-fixer wrapper no altera comandos distintos de fix', () => {
    const original = ['--version'];
    const args = buildPhpCsFixerArgs(original);
    assert.deepEqual(args, original);
});

test('run-php-cs-fixer wrapper encuentra config del repo', () => {
    const config = findPhpCsFixerConfig();
    assert.ok(config, 'debe encontrar archivo de config php-cs-fixer');
    assert.match(config, /^\.php-cs-fixer(\.dist)?\.php$/);
});
