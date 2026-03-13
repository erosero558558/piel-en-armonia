#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'turnero',
    'CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1'
);
const TURNERO_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'turnero',
    'README.md'
);
const OPS_README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const TURNERO_RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'RUNBOOK_TURNERO_APPS_RELEASE.md'
);
const TURNERO_NATIVE_DOC_PATH = resolve(
    REPO_ROOT,
    'docs',
    'TURNERO_NATIVE_SURFACES.md'
);
const DESKTOP_README_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'turnero-desktop',
    'README.md'
);
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('checklist del piloto operador windows cubre bundle, hosting y smoke clinico', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$BundleRoot = 'release/turnero-apps-pilot-local'",
        'app-downloads/pilot/operator/win/TurneroOperadorSetup.exe',
        'desktop-updates/pilot/operator/win/latest.yml',
        '/app-downloads/?surface=operator&platform=win',
        'operador-turnos.html',
        'Genius Numpad 1000',
        'F10',
        'Ctrl/Cmd + ,',
        'llamar / re-llamar / completar / no-show',
        'live, offline y safe',
        'checklist:turnero:operator:pilot -- -ServerBaseUrl https://pielarmonia.com',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo en CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1: ${snippet}`
        );
    }
});

test('package y docs publican el checklist canonico del piloto operador windows', () => {
    const pkg = JSON.parse(load(PACKAGE_JSON_PATH));
    const turneroReadme = load(TURNERO_README_PATH);
    const opsReadme = load(OPS_README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const turneroRunbook = load(TURNERO_RUNBOOK_PATH);
    const turneroNativeDoc = load(TURNERO_NATIVE_DOC_PATH);
    const desktopReadme = load(DESKTOP_README_PATH);

    assert.equal(
        String(
            pkg.scripts?.['checklist:turnero:operator:pilot'] || ''
        ).includes(
            './scripts/ops/turnero/CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1'
        ),
        true,
        'package.json debe exponer checklist:turnero:operator:pilot'
    );

    assert.equal(
        opsReadme.includes('turnero/'),
        true,
        'scripts/ops/README.md debe incluir la subcarpeta turnero/'
    );

    for (const snippet of ['checklist:turnero:operator:pilot']) {
        assert.equal(
            turneroReadme.includes(snippet),
            true,
            `README de turnero ops debe documentar el checklist: ${snippet}`
        );
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `OPERATIONS_INDEX debe documentar el checklist: ${snippet}`
        );
        assert.equal(
            turneroRunbook.includes(snippet),
            true,
            `RUNBOOK_TURNERO_APPS_RELEASE debe documentar el checklist: ${snippet}`
        );
        assert.equal(
            turneroNativeDoc.includes(snippet),
            true,
            `TURNERO_NATIVE_SURFACES debe documentar el checklist: ${snippet}`
        );
        assert.equal(
            desktopReadme.includes(snippet),
            true,
            `turnero-desktop README debe documentar el checklist: ${snippet}`
        );
    }

    for (const snippet of [
        'CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1',
        'scripts/ops/turnero/CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1',
    ]) {
        assert.equal(
            turneroReadme.includes(snippet) ||
                operationsIndex.includes(snippet),
            true,
            `La superficie operativa debe dejar visible el entrypoint canonico: ${snippet}`
        );
    }
});
