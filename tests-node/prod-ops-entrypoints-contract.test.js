#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(...segments) {
    return readFileSync(resolve(REPO_ROOT, ...segments), 'utf8');
}

test('package.json usa scripts canonicos de prod ops como superficie primaria', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    const scripts = pkg.scripts || {};
    const expected = {
        'verify:prod': './scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1',
        'verify:prod:fast': './scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1',
        'smoke:prod': './scripts/ops/prod/SMOKE-PRODUCCION.ps1',
        'gate:prod': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'gate:prod:fast': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'gate:prod:backend': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'gate:prod:hash-strict': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'gate:prod:strict': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'monitor:prod': './scripts/ops/prod/MONITOR-PRODUCCION.ps1',
        'report:weekly:prod':
            './scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1',
    };

    for (const [scriptName, expectedPath] of Object.entries(expected)) {
        assert.equal(
            String(scripts[scriptName] || '').includes(expectedPath),
            true,
            `script npm debe apuntar a entrypoint canonico: ${scriptName} -> ${expectedPath}`
        );
    }
});

test('workflows de ops llaman scripts canonicos bajo scripts/ops/prod', () => {
    const expectations = {
        'post-deploy-fast.yml': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'post-deploy-gate.yml': './scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'prod-monitor.yml': './scripts/ops/prod/MONITOR-PRODUCCION.ps1',
        'repair-git-sync.yml': './scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1',
        'weekly-kpi-report.yml':
            './scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1',
    };

    for (const [file, expectedPath] of Object.entries(expectations)) {
        const raw = readRepoFile('.github', 'workflows', file);
        assert.equal(
            raw.includes(expectedPath),
            true,
            `workflow debe invocar entrypoint canonico: ${file} -> ${expectedPath}`
        );
    }

    const repairRaw = readRepoFile(
        '.github',
        'workflows',
        'repair-git-sync.yml'
    );
    assert.equal(
        repairRaw.includes('./scripts/ops/prod/SMOKE-PRODUCCION.ps1'),
        true,
        'repair-git-sync debe invocar smoke canonico bajo scripts/ops/prod'
    );
});

test('runbooks de prod muestran scripts canonicos antes que wrappers raiz', () => {
    const expectations = [
        ['docs/DEPLOYMENT.md', '.\\scripts\\ops\\prod\\GATE-POSTDEPLOY.ps1'],
        [
            'docs/DEPLOY_HOSTING_PLAYBOOK.md',
            '.\\scripts\\ops\\prod\\VERIFICAR-DESPLIEGUE.ps1',
        ],
        [
            'docs/PRODUCTION_TEST_CHECKLIST.md',
            '.\\scripts\\ops\\prod\\SMOKE-PRODUCCION.ps1',
        ],
        ['docs/RUNBOOKS.md', '.\\scripts\\ops\\prod\\GATE-POSTDEPLOY.ps1'],
        ['docs/RUNBOOKS.md', '.\\scripts\\ops\\prod\\BENCH-API-PRODUCCION.ps1'],
        ['docs/DISASTER_RECOVERY.md', 'scripts/ops/prod/GATE-POSTDEPLOY.ps1'],
    ];

    for (const [file, expectedSnippet] of expectations) {
        const raw = readRepoFile(file);
        assert.equal(
            raw.includes(expectedSnippet),
            true,
            `doc operativo debe mostrar surface canonica: ${file} -> ${expectedSnippet}`
        );
    }
});

test('security docs documentan validacion host-side de cifrado en produccion', () => {
    const raw = readRepoFile('docs', 'SECURITY.md');
    const requiredSnippets = [
        'PIELARMONIA_DATA_ENCRYPTION_KEY',
        'PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true',
        'health-diagnostics',
        'storeEncryptionConfigured=true',
        'storeEncryptionStatus=encrypted',
        'storeEncryptionCompliant=true',
        'curl -s http://127.0.0.1/api.php?resource=health-diagnostics',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `docs/SECURITY.md debe documentar validacion host-side de cifrado: ${snippet}`
        );
    }
});
