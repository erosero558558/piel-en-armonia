'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const GATE_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'GATE-POSTDEPLOY.ps1'
);

function load() {
    return readFileSync(GATE_PATH, 'utf8');
}

test('gate postdeploy hace preflight local del clinic-profile antes de verificar/smokear', () => {
    const raw = load();
    const requiredSnippets = [
        "$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\\..\\..')",
        "$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'",
        '$turneroPilotReleaseGateRequired = $false',
        '& node $turneroClinicProfileScriptPath status --json 2>&1',
        '[INFO] turneroPilot gate clinicId=$turneroPilotClinicId statusResolved=$turneroPilotProfileStatusResolved catalogMatch=$turneroPilotCatalogMatch verifyRemoteEnforced=$turneroPilotReleaseGateRequired',
        "Write-Host '[FAIL] turneroPilot clinic-profile status unresolved antes del gate.' -ForegroundColor Red",
        "Write-Host '[FAIL] turneroPilot clinic-profile inválido antes del gate.' -ForegroundColor Red",
        'Write-Host "[FAIL] turneroPilot catalog drift antes del gate (clinicId=$turneroPilotClinicId)." -ForegroundColor Red',
        "Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite preflight turneroPilot del gate.'",
        'Turnero pilot gate OK: clinicId=$turneroPilotClinicId, catalogMatch=$turneroPilotCatalogMatch, verifyRemoteEnforced=true.',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turneroPilot en GATE-POSTDEPLOY.ps1: ${snippet}`
        );
    }
});
