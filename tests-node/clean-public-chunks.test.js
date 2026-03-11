#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    existsSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'clean-public-chunks.js');

function createSandboxRoot(prefix = 'public-chunks-') {
    const base = mkdtempSync(resolve(tmpdir(), prefix));
    const chunksDir = resolve(base, 'js', 'chunks');
    mkdirSync(chunksDir, { recursive: true });
    return { base, chunksDir };
}

function writeFile(filePath, content) {
    writeFileSync(filePath, content, 'utf8');
}

function runCleaner(rootPath, extraArgs = []) {
    return spawnSync(
        'node',
        [SCRIPT_PATH, '--root', rootPath, ...extraArgs],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
}

function removeSandbox(path) {
    rmSync(path, { recursive: true, force: true });
}

test('clean-public-chunks elimina solo chunks huerfanos con import graph recursivo', () => {
    const sandbox = createSandboxRoot();
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            "import('./js/chunks/shell-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            "import('./shared-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shared-live.js'),
            'export const ok = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base);
        assert.equal(
            result.status,
            0,
            `salida inesperada: ${result.stderr || result.stdout}`
        );

        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'shell-live.js')),
            true,
            'chunk live no debe eliminarse'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'shared-live.js')),
            true,
            'chunk recursivo no debe eliminarse'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            false,
            'chunk huerfano debe eliminarse'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-public-chunks conserva chunks compartidos importados desde codigo minificado', () => {
    const sandbox = createSandboxRoot('public-chunks-minified-');
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            "import('./js/chunks/shell-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            'import{a as live}from"./shared-live.js";export{live};\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shared-live.js'),
            'export const a = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base);
        assert.equal(
            result.status,
            0,
            `salida inesperada: ${result.stderr || result.stdout}`
        );

        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'shared-live.js')),
            true,
            'chunk compartido minificado no debe eliminarse'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            false,
            'chunk huerfano debe eliminarse'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-public-chunks dry-run reporta sin borrar archivos', () => {
    const sandbox = createSandboxRoot('public-chunks-dry-');
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            "import('./js/chunks/shell-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            'export const live = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--dry-run']);
        assert.equal(
            result.status,
            0,
            `dry-run fallo: ${result.stderr || result.stdout}`
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            true,
            'dry-run no debe eliminar chunks'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-public-chunks en strict falla cuando script.js no referencia chunks', () => {
    const sandbox = createSandboxRoot('public-chunks-strict-');
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            'console.log("sin imports");\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'old.js'),
            'export const old = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--strict']);
        assert.notEqual(
            result.status,
            0,
            'strict debe fallar sin referencias detectadas'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'old.js')),
            true,
            'sin referencias no debe borrar por seguridad'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-public-chunks falla si el chunk activo contiene marcadores de merge', () => {
    const sandbox = createSandboxRoot('public-chunks-conflict-chunk-');
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            "import('./js/chunks/shell-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            [
                'const live = true;',
                '<<<<<<<< HEAD',
                'const value = 1;',
                '========',
                'const value = 2;',
                '>>>>>>>> branch',
                'export { live, value };',
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--strict']);
        assert.notEqual(
            result.status,
            0,
            'el verificador debe fallar si el chunk activo contiene marcadores de merge'
        );
        assert.match(
            result.stderr,
            /Detectados marcadores de merge en assets publicos activos/,
            'debe reportar el hallazgo de merge conflict en el chunk activo'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            true,
            'si hay un chunk activo roto no debe borrar otros archivos'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-public-chunks falla si script.js contiene marcadores de merge', () => {
    const sandbox = createSandboxRoot('public-chunks-conflict-entry-');
    try {
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "import('./js/chunks/shell-live.js');",
                '<<<<<<<< HEAD',
                'const mode = "stable";',
                '========',
                'const mode = "broken";',
                '>>>>>>>> branch',
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            'export const live = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--strict']);
        assert.notEqual(
            result.status,
            0,
            'script.js con conflicto debe fallar'
        );
        assert.match(
            result.stderr,
            /script\.js:2/,
            'debe reportar la linea del conflicto en script.js'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});
