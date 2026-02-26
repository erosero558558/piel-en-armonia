#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseArgs,
    parseLines,
    normalizePath,
    isOnlyBoardConflict,
} = require('../bin/sync-main-safe');

test('sync-main-safe parseArgs aplica defaults', () => {
    const opts = parseArgs([]);
    assert.equal(opts.remote, 'origin');
    assert.equal(opts.branch, 'main');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, true);
    assert.equal(opts.push, true);
    assert.equal(opts.dryRun, false);
    assert.equal(opts.json, false);
});

test('sync-main-safe parseArgs reconoce flags principales', () => {
    const opts = parseArgs([
        '--remote',
        'upstream',
        '--branch',
        'release',
        '--board',
        'AGENT_BOARD.yaml',
        '--no-stash',
        '--no-push',
        '--dry-run',
        '--json',
    ]);
    assert.equal(opts.remote, 'upstream');
    assert.equal(opts.branch, 'release');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, false);
    assert.equal(opts.push, false);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.json, true);
});

test('sync-main-safe parseLines limpia salida vacia de git', () => {
    assert.deepEqual(parseLines('\r\n \n'), []);
    assert.deepEqual(parseLines('A\nB\r\nC'), ['A', 'B', 'C']);
});

test('sync-main-safe detecta conflicto exclusivo de AGENT_BOARD', () => {
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml']), true);
    assert.equal(isOnlyBoardConflict(['agent_board.yaml']), true);
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml', 'README.md']), false);
    assert.equal(isOnlyBoardConflict(['README.md']), false);
});

test('sync-main-safe normaliza paths en formato cross-platform', () => {
    assert.equal(normalizePath('AGENT_BOARD.yaml'), 'agent_board.yaml');
    assert.equal(normalizePath('a\\b\\C.md'), 'a/b/c.md');
});
