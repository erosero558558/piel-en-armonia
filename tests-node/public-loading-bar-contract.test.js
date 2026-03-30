'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'js', 'aurora-nprogress.js');
const LAYOUTS = [
    resolve(REPO_ROOT, 'src', 'apps', 'astro', 'src', 'layouts', 'BaseLayout.astro'),
    resolve(REPO_ROOT, 'src', 'apps', 'astro', 'src', 'layouts', 'PublicShellV3.astro'),
    resolve(REPO_ROOT, 'src', 'apps', 'astro', 'src', 'layouts', 'PublicShellV5.astro'),
    resolve(REPO_ROOT, 'src', 'apps', 'astro', 'src', 'layouts', 'PublicShellV6.astro'),
];
const SHELLS = [
    resolve(REPO_ROOT, 'js', 'public-v3-shell.js'),
    resolve(REPO_ROOT, 'js', 'public-v5-shell.js'),
    resolve(REPO_ROOT, 'js', 'public-v6-shell.js'),
];

test('aurora loading bar script exists and exposes the loader markers', () => {
    assert.equal(existsSync(SCRIPT_PATH), true);
    const source = readFileSync(SCRIPT_PATH, 'utf8');

    assert.match(source, /aurora-loader/);
    assert.match(source, /__auroraPageLoader/);
    assert.match(source, /DOMContentLoaded/);
    assert.match(source, /sessionStorage/);
});

test('public layouts include the shared aurora loading bar script', () => {
    for (const filePath of LAYOUTS) {
        const source = readFileSync(filePath, 'utf8');
        assert.match(
            source,
            /\/js\/aurora-nprogress\.js\?v=aurora-nprogress-20260330-v1/
        );
    }
});

test('public shell runtimes bootstrap the shared loader when HTML does not include it yet', () => {
    for (const filePath of SHELLS) {
        const source = readFileSync(filePath, 'utf8');
        assert.match(source, /data-aurora-page-loader/);
        assert.match(source, /__auroraPageLoader/);
        assert.match(source, /aurora-loader/);
    }
});
