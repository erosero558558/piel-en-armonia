#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    existsSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'bin',
    'check-public-runtime-artifacts.js'
);

function createSandboxRoot(prefix = 'public-runtime-artifacts-') {
    const base = mkdtempSync(resolve(tmpdir(), prefix));
    const chunksDir = resolve(base, 'js', 'chunks');
    const enginesDir = resolve(base, 'js', 'engines');
    const adminChunksDir = resolve(base, 'js', 'admin-chunks');
    mkdirSync(chunksDir, { recursive: true });
    mkdirSync(enginesDir, { recursive: true });
    mkdirSync(adminChunksDir, { recursive: true });
    return { base, chunksDir, enginesDir, adminChunksDir };
}

function writeFile(filePath, content) {
    writeFileSync(filePath, content, 'utf8');
}

function runChecker(
    rootPath,
    outputPath,
    extraArgs = [],
    publishedRootPath = rootPath
) {
    return spawnSync(
        'node',
        [
            SCRIPT_PATH,
            '--root',
            rootPath,
            '--published-root',
            publishedRootPath,
            '--output',
            outputPath,
            ...extraArgs,
        ],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
}

function removeSandbox(path) {
    rmSync(path, { recursive: true, force: true });
}

function seedGatewaySupportAssets(sandbox, options = {}) {
    const referencedEngine = options.referencedEngine || 'ui-bundle.js';

    writeFile(resolve(sandbox.base, 'styles.css'), 'body { color: #111; }\n');
    writeFile(
        resolve(sandbox.base, 'styles-deferred.css'),
        '.deferred { display: block; }\n'
    );

    if (referencedEngine) {
        writeFile(
            resolve(sandbox.enginesDir, referencedEngine),
            'window.Piel = window.Piel || {};\n'
        );
    }
}

function seedHealthyAdminRuntime(sandbox) {
    writeFile(
        resolve(sandbox.base, 'admin.js'),
        "import('./js/admin-chunks/index-live.js');\n"
    );
    writeFile(
        resolve(sandbox.adminChunksDir, 'index-live.js'),
        'export const adminLive = true;\n'
    );
}

test('check-public-runtime-artifacts writes the canonical report for a healthy runtime graph', () => {
    const sandbox = createSandboxRoot();
    const reportPath = resolve(sandbox.base, 'runtime-artifacts-report.json');

    try {
        seedGatewaySupportAssets(sandbox);
        seedHealthyAdminRuntime(sandbox);
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                'void engine;',
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            "import('./shared-live.js');\nexport const shell = true;\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shared-live.js'),
            'export const shared = true;\n'
        );

        const result = runChecker(sandbox.base, reportPath);
        assert.equal(
            result.status,
            0,
            `checker sano fallo: ${result.stderr || result.stdout}`
        );
        assert.equal(existsSync(reportPath), true, 'falta reporte runtime');

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        assert.equal(report.passed, true, 'el reporte debe quedar en verde');
        assert.equal(
            report.adminPublished?.passed,
            true,
            'admin published parity debe quedar en verde'
        );
        assert.deepEqual(report.staleChunks, [], 'no debe haber chunks huerfanos');
        assert.deepEqual(
            report.activeShellChunks,
            ['shell-live.js'],
            'debe haber exactamente un shell activo'
        );
        assert.deepEqual(
            report.reachableChunks,
            ['shared-live.js', 'shell-live.js'],
            'el grafo debe incluir los chunks alcanzables'
        );
        assert.deepEqual(
            report.referencedEngineFiles,
            ['ui-bundle.js'],
            'el reporte debe recoger los engines referenciados por script.js'
        );
        assert.deepEqual(
            report.missingSupportAssets,
            [],
            'los support assets no deben faltar en el escenario sano'
        );
        assert.deepEqual(
            report.legacyRootRuntimeArtifactsPresent,
            [],
            'el escenario sano no debe exponer runtime legacy en raiz'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('check-public-runtime-artifacts fails when published admin.js drifts and points to a missing root chunk', () => {
    const stageSandbox = createSandboxRoot('public-runtime-artifacts-admin-stage-');
    const publishedSandbox = createSandboxRoot(
        'public-runtime-artifacts-admin-published-'
    );
    const reportPath = resolve(
        stageSandbox.base,
        'runtime-artifacts-report.json'
    );

    try {
        seedGatewaySupportAssets(stageSandbox);
        writeFile(
            resolve(stageSandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(stageSandbox.chunksDir, 'shell-live.js'),
            'export const shell = true;\n'
        );
        writeFile(
            resolve(stageSandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-live.js');\n"
        );
        writeFile(
            resolve(stageSandbox.base, 'js', 'admin-chunks', 'index-live.js'),
            'export const adminLive = true;\n'
        );

        writeFile(
            resolve(publishedSandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-broken.js');\n"
        );

        const result = runChecker(
            stageSandbox.base,
            reportPath,
            [],
            publishedSandbox.base
        );
        assert.notEqual(
            result.status,
            0,
            'el checker debe fallar si el admin publicado deriva del staged root'
        );

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        const adminCodes = report.adminPublished.diagnostics
            .map((entry) => entry.code)
            .sort();
        assert.deepEqual(
            adminCodes,
            [
                'published_admin_entry_drift',
                'published_admin_graph_drift',
                'published_admin_missing_referenced_chunks',
            ],
            'el reporte debe clasificar drift y chunks faltantes del admin publicado'
        );
    } finally {
        removeSandbox(stageSandbox.base);
        removeSandbox(publishedSandbox.base);
    }
});

test('check-public-runtime-artifacts fails when published admin chunks differ from the staged active graph', () => {
    const stageSandbox = createSandboxRoot(
        'public-runtime-artifacts-admin-content-stage-'
    );
    const publishedSandbox = createSandboxRoot(
        'public-runtime-artifacts-admin-content-published-'
    );
    const reportPath = resolve(
        stageSandbox.base,
        'runtime-artifacts-report.json'
    );

    try {
        seedGatewaySupportAssets(stageSandbox);
        writeFile(
            resolve(stageSandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(stageSandbox.chunksDir, 'shell-live.js'),
            'export const shell = true;\n'
        );
        writeFile(
            resolve(stageSandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-live.js');\n"
        );
        writeFile(
            resolve(stageSandbox.base, 'js', 'admin-chunks', 'index-live.js'),
            'export const adminLive = true;\n'
        );

        writeFile(
            resolve(publishedSandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-live.js');\n"
        );
        writeFile(
            resolve(
                publishedSandbox.base,
                'js',
                'admin-chunks',
                'index-live.js'
            ),
            'export const adminLive = false;\n'
        );

        const result = runChecker(
            stageSandbox.base,
            reportPath,
            [],
            publishedSandbox.base
        );
        assert.notEqual(
            result.status,
            0,
            'el checker debe fallar si cambia el contenido del chunk admin activo'
        );

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        assert.deepEqual(
            report.adminPublished.chunkContentDrift,
            ['js/admin-chunks/index-live.js'],
            'debe identificar el chunk admin activo con drift'
        );
        assert.equal(
            report.adminPublished.diagnostics.some(
                (entry) => entry.code === 'published_admin_content_drift'
            ),
            true,
            'debe clasificar el drift de contenido del grafo admin publicado'
        );
    } finally {
        removeSandbox(stageSandbox.base);
        removeSandbox(publishedSandbox.base);
    }
});

test('check-public-runtime-artifacts fails when stale chunks or multiple active shells remain', () => {
    const sandbox = createSandboxRoot('public-runtime-artifacts-drift-');
    const reportPath = resolve(sandbox.base, 'runtime-artifacts-report.json');

    try {
        seedGatewaySupportAssets(sandbox);
        seedHealthyAdminRuntime(sandbox);
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-a.js');",
                "import('./js/chunks/shell-b.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-a.js'),
            'export const shellA = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-b.js'),
            'export const shellB = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runChecker(sandbox.base, reportPath);
        assert.notEqual(result.status, 0, 'el checker debe fallar con drift');

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        const codes = report.diagnostics.map((entry) => entry.code).sort();
        assert.deepEqual(
            codes,
            ['active_shell_count_mismatch', 'stale_chunks_detected'],
            'el reporte debe clasificar shells multiples y chunks huerfanos'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('check-public-runtime-artifacts reports merge markers in active assets', () => {
    const sandbox = createSandboxRoot('public-runtime-artifacts-merge-');
    const reportPath = resolve(sandbox.base, 'runtime-artifacts-report.json');

    try {
        seedGatewaySupportAssets(sandbox);
        seedHealthyAdminRuntime(sandbox);
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            [
                'const live = true;',
                '<<<<<<<< HEAD',
                'const broken = 1;',
                '========',
                'const broken = 2;',
                '>>>>>>>> branch',
                'export { live, broken };',
                '',
            ].join('\n')
        );

        const result = runChecker(sandbox.base, reportPath);
        assert.notEqual(
            result.status,
            0,
            'el checker debe fallar con marcadores de merge'
        );

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        assert.equal(
            report.diagnostics.some(
                (entry) => entry.code === 'merge_conflicts_detected'
            ),
            true,
            'el reporte debe diagnosticar merge conflicts activos'
        );
        assert.deepEqual(
            report.mergeConflictFindings,
            [
                {
                    filePath: 'js/chunks/shell-live.js',
                    lineNumber: 2,
                    marker: '<<<<<<<< HEAD',
                },
            ],
            'el reporte debe ubicar el conflicto en el chunk activo'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('check-public-runtime-artifacts fails when a referenced engine or support asset is missing', () => {
    const sandbox = createSandboxRoot('public-runtime-artifacts-support-');
    const reportPath = resolve(sandbox.base, 'runtime-artifacts-report.json');

    try {
        seedHealthyAdminRuntime(sandbox);
        writeFile(resolve(sandbox.base, 'styles.css'), 'body { color: #111; }\n');
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            'export const live = true;\n'
        );

        const result = runChecker(sandbox.base, reportPath);
        assert.notEqual(
            result.status,
            0,
            'el checker debe fallar si faltan engines o estilos de soporte'
        );

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        const codes = report.diagnostics.map((entry) => entry.code).sort();
        assert.deepEqual(
            codes,
            [
                'missing_referenced_engine_files',
                'missing_support_assets',
                'no_engines_on_disk',
            ],
            'el reporte debe clasificar engines faltantes y assets de soporte ausentes'
        );
        assert.deepEqual(
            report.missingSupportAssets,
            ['styles-deferred.css'],
            'debe reportar el stylesheet de soporte faltante'
        );
        assert.deepEqual(
            report.missingReferencedEngineFiles,
            ['ui-bundle.js'],
            'debe reportar el engine faltante'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('check-public-runtime-artifacts fails when root legacy runtime files reappear', () => {
    const sandbox = createSandboxRoot('public-runtime-artifacts-root-legacy-');
    const reportPath = resolve(sandbox.base, 'runtime-artifacts-report.json');

    try {
        seedGatewaySupportAssets(sandbox);
        seedHealthyAdminRuntime(sandbox);
        writeFile(resolve(sandbox.base, 'booking-engine.js'), 'window.legacy = true;\n');
        writeFile(resolve(sandbox.base, 'utils.js'), 'window.legacyUtils = true;\n');
        writeFile(
            resolve(sandbox.base, 'script.js'),
            [
                "const engine = '/js/engines/ui-bundle.js';",
                "import('./js/chunks/shell-live.js');",
                '',
            ].join('\n')
        );
        writeFile(
            resolve(sandbox.chunksDir, 'shell-live.js'),
            'export const live = true;\n'
        );

        const result = runChecker(sandbox.base, reportPath);
        assert.notEqual(
            result.status,
            0,
            'el checker debe fallar si reaparecen artefactos runtime legacy en raiz'
        );

        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        assert.deepEqual(
            report.legacyRootRuntimeArtifactsPresent,
            ['booking-engine.js', 'utils.js'],
            'debe reportar los residuos runtime legacy detectados en raiz'
        );
        assert.equal(
            report.diagnostics.some(
                (entry) =>
                    entry.code === 'legacy_root_runtime_artifacts_present'
            ),
            true,
            'el reporte debe clasificar runtime legacy de raiz'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});
