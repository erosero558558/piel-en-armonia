#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} = require('node:fs');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { dirname, resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'clean-local-artifacts.js');

function createSandboxRoot(prefix = 'local-artifacts-') {
    return mkdtempSync(resolve(tmpdir(), prefix));
}

function writeFile(filePath, content) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
}

function runCleaner(rootPath, extraArgs = []) {
    return spawnSync('node', [SCRIPT_PATH, '--root', rootPath, ...extraArgs], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

function removeSandbox(rootPath) {
    rmSync(rootPath, { recursive: true, force: true });
}

test('clean-local-artifacts dry-run reporta sin borrar artefactos locales', () => {
    const sandbox = createSandboxRoot('local-artifacts-dry-');
    try {
        writeFile(resolve(sandbox, 'cookies.txt'), 'session=local\n');
        writeFile(
            resolve(sandbox, '.lighthouseci', 'premium-01.report.html'),
            '<html></html>\n'
        );
        writeFile(
            resolve(sandbox, '_deploy_bundle', 'bundle.zip'),
            'zip payload\n'
        );
        writeFile(
            resolve(sandbox, 'playwright-report', 'index.html'),
            '<html></html>\n'
        );
        writeFile(resolve(sandbox, 'test-results', '.last-run.json'), '{}\n');
        writeFile(resolve(sandbox, 'php_server.log'), 'log\n');
        writeFile(resolve(sandbox, '.php-cs-fixer.cache'), '{}\n');
        writeFile(resolve(sandbox, '.phpunit.cache', 'test-results'), '{}\n');
        writeFile(resolve(sandbox, 'coverage.xml'), '<coverage />\n');
        writeFile(resolve(sandbox, '.tmp-calendar-write-report.json'), '{}\n');
        writeFile(resolve(sandbox, '.codex-public-paths.txt'), 'es/\nen/\n');
        writeFile(resolve(sandbox, 'build_analysis.txt'), 'build log\n');
        writeFile(resolve(sandbox, 'conflict_branches.txt'), 'branch list\n');
        writeFile(resolve(sandbox, 'stats.html'), '<html></html>\n');
        writeFile(resolve(sandbox, 'styles.min.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles.optimized.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles-critical.min.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles-deferred.min.css'), 'body{}\n');

        const result = runCleaner(sandbox, ['--dry-run']);
        assert.equal(
            result.status,
            0,
            `dry-run fallo: ${result.stderr || result.stdout}`
        );
        assert.equal(
            existsSync(resolve(sandbox, 'cookies.txt')),
            true,
            'dry-run no debe borrar cookies.txt'
        );
        assert.equal(
            existsSync(resolve(sandbox, '.lighthouseci')),
            true,
            'dry-run no debe borrar .lighthouseci/'
        );
        assert.equal(
            existsSync(resolve(sandbox, '_deploy_bundle')),
            true,
            'dry-run no debe borrar _deploy_bundle/'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'playwright-report')),
            true,
            'dry-run no debe borrar playwright-report/'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'test-results')),
            true,
            'dry-run no debe borrar test-results/'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'php_server.log')),
            true,
            'dry-run no debe borrar php_server.log'
        );
        assert.equal(
            existsSync(resolve(sandbox, '.php-cs-fixer.cache')),
            true,
            'dry-run no debe borrar .php-cs-fixer.cache'
        );
        assert.equal(
            existsSync(resolve(sandbox, '.phpunit.cache')),
            true,
            'dry-run no debe borrar .phpunit.cache/'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'coverage.xml')),
            true,
            'dry-run no debe borrar coverage.xml'
        );
        assert.equal(
            existsSync(resolve(sandbox, '.tmp-calendar-write-report.json')),
            true,
            'dry-run no debe borrar .tmp-calendar-write-report.json'
        );
        assert.equal(
            existsSync(resolve(sandbox, '.codex-public-paths.txt')),
            true,
            'dry-run no debe borrar .codex-public-paths.txt'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'build_analysis.txt')),
            true,
            'dry-run no debe borrar build_analysis.txt'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'conflict_branches.txt')),
            true,
            'dry-run no debe borrar conflict_branches.txt'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'stats.html')),
            true,
            'dry-run no debe borrar stats.html'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'styles.min.css')),
            true,
            'dry-run no debe borrar styles.min.css'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'styles.optimized.css')),
            true,
            'dry-run no debe borrar styles.optimized.css'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'styles-critical.min.css')),
            true,
            'dry-run no debe borrar styles-critical.min.css'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'styles-deferred.min.css')),
            true,
            'dry-run no debe borrar styles-deferred.min.css'
        );
        assert.match(
            result.stdout,
            /DRY RUN.*cookies\.txt.*\.lighthouseci\/.*_deploy_bundle\/.*playwright-report\/.*test-results\/.*php_server\.log.*\.php-cs-fixer\.cache.*\.phpunit\.cache\/.*coverage\.xml.*\.tmp-calendar-write-report\.json.*\.codex-public-paths\.txt.*build_analysis\.txt.*conflict_branches\.txt.*stats\.html.*styles\.min\.css.*styles\.optimized\.css.*styles-critical\.min\.css.*styles-deferred\.min\.css/s,
            'dry-run debe reportar los artefactos detectados'
        );
    } finally {
        removeSandbox(sandbox);
    }
});

test('clean-local-artifacts elimina solo artefactos efimeros permitidos', () => {
    const sandbox = createSandboxRoot('local-artifacts-live-');
    try {
        writeFile(resolve(sandbox, 'cookies.txt'), 'session=local\n');
        writeFile(
            resolve(sandbox, '.lighthouseci', 'premium-01.report.json'),
            '{}\n'
        );
        writeFile(
            resolve(sandbox, 'lhci_reports', 'summary.html'),
            '<html></html>'
        );
        writeFile(
            resolve(sandbox, '_deploy_bundle', 'pielarmonia-deploy.zip'),
            'zip payload\n'
        );
        writeFile(
            resolve(sandbox, 'playwright-report', 'index.html'),
            '<html></html>\n'
        );
        writeFile(resolve(sandbox, 'test-results', '.last-run.json'), '{}\n');
        writeFile(resolve(sandbox, 'php_server.log'), 'log\n');
        writeFile(resolve(sandbox, '.php-cs-fixer.cache'), '{}\n');
        writeFile(
            resolve(sandbox, '.phpunit.cache', 'code-coverage', 'index.html'),
            '<html></html>\n'
        );
        writeFile(resolve(sandbox, 'coverage.xml'), '<coverage />\n');
        writeFile(resolve(sandbox, '.tmp-calendar-write-report.json'), '{}\n');
        writeFile(resolve(sandbox, '.codex-public-paths.txt'), 'es/\nen/\n');
        writeFile(resolve(sandbox, 'build_analysis.txt'), 'build log\n');
        writeFile(resolve(sandbox, 'conflict_branches.txt'), 'branch list\n');
        writeFile(resolve(sandbox, 'stats.html'), '<html></html>\n');
        writeFile(resolve(sandbox, 'styles.min.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles.optimized.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles-critical.min.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'styles-deferred.min.css'), 'body{}\n');
        writeFile(resolve(sandbox, 'verification', 'keep.txt'), 'keep\n');
        writeFile(resolve(sandbox, 'notes.txt'), 'keep\n');

        const result = runCleaner(sandbox);
        assert.equal(
            result.status,
            0,
            `limpieza fallo: ${result.stderr || result.stdout}`
        );

        for (const target of [
            'cookies.txt',
            '.lighthouseci',
            'lhci_reports',
            '_deploy_bundle',
            'playwright-report',
            'test-results',
            'php_server.log',
            '.php-cs-fixer.cache',
            '.phpunit.cache',
            'coverage.xml',
            '.tmp-calendar-write-report.json',
            '.codex-public-paths.txt',
            'build_analysis.txt',
            'conflict_branches.txt',
            'stats.html',
            'styles.min.css',
            'styles.optimized.css',
            'styles-critical.min.css',
            'styles-deferred.min.css',
        ]) {
            assert.equal(
                existsSync(resolve(sandbox, target)),
                false,
                `el limpiador debe eliminar ${target}`
            );
        }

        assert.equal(
            existsSync(resolve(sandbox, 'verification', 'keep.txt')),
            true,
            'el limpiador no debe tocar verification/'
        );
        assert.equal(
            existsSync(resolve(sandbox, 'notes.txt')),
            true,
            'el limpiador no debe tocar archivos no listados'
        );
    } finally {
        removeSandbox(sandbox);
    }
});

test('clean-local-artifacts no falla cuando no hay residuos locales', () => {
    const sandbox = createSandboxRoot('local-artifacts-empty-');
    try {
        writeFile(resolve(sandbox, 'notes.txt'), 'keep\n');

        const result = runCleaner(sandbox, ['--dry-run']);
        assert.equal(
            result.status,
            0,
            `dry-run vacio fallo: ${result.stderr || result.stdout}`
        );
        assert.match(
            result.stdout,
            /No hay artefactos locales para limpiar\./,
            'debe reportar cuando no hay residuos locales'
        );
    } finally {
        removeSandbox(sandbox);
    }
});
