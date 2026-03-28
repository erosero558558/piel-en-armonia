#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildLocalDependencyMissingMessage,
    buildPhpRuntimeMissingMessage,
    resolveRepoPath,
} = require('./runtime-contract-helpers.js');

test('runtime contract helpers describen dependencias locales faltantes con hint accionable', () => {
    const message = buildLocalDependencyMissingMessage(
        'node_modules/rollup/dist/bin/rollup'
    );

    assert.match(message, /node_modules\/rollup\/dist\/bin\/rollup/);
    assert.match(message, /npm ci/);
    assert.match(message, /worktree/i);
});

test('runtime contract helpers describen ausencia de PHP con PATH y PHP_BIN', () => {
    const message = buildPhpRuntimeMissingMessage(
        'HealthController publicSync',
        ['php', '/tmp/php']
    );

    assert.match(message, /HealthController publicSync/);
    assert.match(message, /PHP_BIN/);
    assert.match(message, /PATH/);
    assert.match(message, /php, \/tmp\/php/);
});

test('runtime contract helpers resuelven rutas desde el worktree actual', () => {
    const resolved = resolveRepoPath(
        'node_modules',
        'rollup',
        'dist',
        'bin',
        'rollup'
    );

    assert.match(
        resolved.replace(/\\/g, '/'),
        /\/node_modules\/rollup\/dist\/bin\/rollup$/
    );
});
