#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SMOKE_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'SMOKE-PRODUCCION.ps1'
);
const VERIFY_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);
const GATE_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'GATE-POSTDEPLOY.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'RUNBOOK_TURNERO_APPS_RELEASE.md'
);
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const DESKTOP_README_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'turnero-desktop',
    'README.md'
);
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod smoke soporta gate de superficies turnero y piloto Windows', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        '[switch]$RequireTurneroWebSurfaces',
        '[switch]$RequireTurneroOperatorPilot',
        "$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'",
        '. $commonHttpPath',
        '$turneroOperatorSurfaceUrl = "$base/operador-turnos.html"',
        '$turneroOperatorPilotFeedUrl = "$base/desktop-updates/pilot/operator/win/latest.yml"',
        '$turneroOperatorPilotInstallerUrl = "$base/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"',
        'function Invoke-StrictGetCheck {',
        "Invoke-StrictGetCheck -Name 'Turnero operador web' -Url $turneroOperatorSurfaceUrl",
        "Invoke-StrictGetCheck -Name 'Turnero kiosco web' -Url $turneroKioskSurfaceUrl",
        "Invoke-StrictGetCheck -Name 'Turnero sala web' -Url $turneroDisplaySurfaceUrl",
        "Invoke-StrictGetCheck -Name 'Turnero operador pilot center' -Url $turneroOperatorPilotCenterUrl",
        "Invoke-StrictGetCheck -Name 'Turnero operador pilot feed' -Url $turneroOperatorPilotFeedUrl",
        "Invoke-HeadCheck -Name 'Turnero operador pilot installer' -Url $turneroOperatorPilotInstallerUrl",
        "$expectedStatusByName['Turnero operador pilot installer'] = 200",
        'Turnero operador pilot center no muestra el instalador canonico',
        'Turnero operador pilot feed no apunta a TurneroOperadorSetup.exe',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turnero/operator pilot en SMOKE-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod verify propaga fallas de superficies turnero y piloto Windows', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        '[switch]$RequireTurneroWebSurfaces',
        '[switch]$RequireTurneroOperatorPilot',
        '$turneroOperatorSurfaceUrl = "$base/operador-turnos.html"',
        '$turneroOperatorPilotCenterUrl = "$base/app-downloads/?surface=operator&platform=win"',
        '$turneroOperatorPilotFeedUrl = "$base/desktop-updates/pilot/operator/win/latest.yml"',
        '$turneroOperatorPilotInstallerUrl = "$base/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"',
        'function Invoke-HeadCheck {',
        'function Add-DeployFailure {',
        "-Asset 'turnero-operator-surface'",
        "-Asset 'turnero-kiosk-surface'",
        "-Asset 'turnero-display-surface'",
        "-Asset 'turnero-operator-pilot-center'",
        "-Asset 'turnero-operator-pilot-feed'",
        "-Asset 'turnero-operator-pilot-installer'",
        '[FAIL] turnero operador web ausente',
        '[FAIL] turnero operador pilot center incompleto',
        '[FAIL] turnero operador pilot feed incompleto',
        '[FAIL] turnero operador pilot installer ausente',
        'health-diagnostics protegido y sin token local; se omite validacion profunda.',
        '-RequireTurneroWebSurfaces:$RequireTurneroWebSurfaces',
        '-RequireTurneroOperatorPilot:$RequireTurneroOperatorPilot',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turnero/operator pilot en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('gate y scripts npm exponen un carril dedicado para operador Windows pilot', () => {
    const gateRaw = load(GATE_PATH);
    for (const snippet of [
        '[switch]$RequireTurneroWebSurfaces',
        '[switch]$RequireTurneroOperatorPilot',
        '-RequireTurneroWebSurfaces:$RequireTurneroWebSurfaces',
        '-RequireTurneroOperatorPilot:$RequireTurneroOperatorPilot',
    ]) {
        assert.equal(
            gateRaw.includes(snippet),
            true,
            `falta passthrough turnero/operator pilot en GATE-POSTDEPLOY.ps1: ${snippet}`
        );
    }

    const pkg = JSON.parse(load(PACKAGE_PATH));
    const scripts = pkg.scripts || {};
    assert.equal(
        String(scripts['verify:prod:turnero:operator:pilot'] || '').includes(
            '-AllowDegradedFigo -RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe permitir figo degradado en verify:prod:turnero:operator:pilot'
    );
    assert.equal(
        String(scripts['verify:prod:turnero:operator:pilot'] || '').includes(
            '-RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe exponer verify:prod:turnero:operator:pilot'
    );
    assert.equal(
        String(scripts['smoke:prod:turnero:operator:pilot'] || '').includes(
            '-TestFigoPost -AllowDegradedFigo -RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe permitir figo degradado en smoke:prod:turnero:operator:pilot'
    );
    assert.equal(
        String(scripts['smoke:prod:turnero:operator:pilot'] || '').includes(
            '-RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe exponer smoke:prod:turnero:operator:pilot'
    );
    assert.equal(
        String(scripts['gate:prod:turnero:operator:pilot'] || '').includes(
            '-AllowDegradedFigo -RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe permitir figo degradado en gate:prod:turnero:operator:pilot'
    );
    assert.equal(
        String(scripts['gate:prod:turnero:operator:pilot'] || '').includes(
            '-RequireTurneroWebSurfaces -RequireTurneroOperatorPilot'
        ),
        true,
        'package.json debe exponer gate:prod:turnero:operator:pilot'
    );
});

test('runbooks documentan el gate de hosting del operador Windows pilot', () => {
    for (const [filePath, requiredSnippets] of [
        [
            README_PATH,
            [
                'RequireTurneroWebSurfaces',
                'RequireTurneroOperatorPilot',
                'npm run verify:prod:turnero:operator:pilot',
                'npm run smoke:prod:turnero:operator:pilot',
                'npm run gate:prod:turnero:operator:pilot',
            ],
        ],
        [
            RUNBOOK_PATH,
            [
                'npm run verify:prod:turnero:operator:pilot',
                'npm run smoke:prod:turnero:operator:pilot',
            ],
        ],
        [
            OPERATIONS_INDEX_PATH,
            [
                'npm run verify:prod:turnero:operator:pilot',
                'npm run smoke:prod:turnero:operator:pilot',
            ],
        ],
        [
            DESKTOP_README_PATH,
            [
                'npm run verify:prod:turnero:operator:pilot',
                'npm run smoke:prod:turnero:operator:pilot',
            ],
        ],
    ]) {
        const raw = load(filePath);
        for (const snippet of requiredSnippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta documentacion del gate turnero/operator pilot en ${filePath}: ${snippet}`
            );
        }
    }
});
