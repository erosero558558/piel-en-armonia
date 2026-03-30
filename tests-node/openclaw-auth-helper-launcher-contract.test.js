#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const LAUNCHER_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'INICIAR-OPENCLAW-AUTH-HELPER.ps1'
);
const START_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'ARRANCAR-HOSTING-WINDOWS.ps1'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('launcher local de OpenClaw importa putenv desde env.php antes del preflight', () => {
    const raw = load(LAUNCHER_PATH);
    const requiredSnippets = [
        "$envPhpPath = Join-Path $repoRoot 'env.php'",
        'function Import-EnvPhpProcessVariables',
        "[void](Import-EnvPhpProcessVariables -Path $envPhpPath)",
        "PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN",
        "PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta compatibilidad env.php en launcher auth: ${snippet}`
        );
    }
});

test('arranque de hosting respeta aliases PIELARMONIA_* para resolver web_broker desde env.php', () => {
    const raw = load(START_SCRIPT_PATH);
    const requiredSnippets = [
        "$effective['AURORADERM_OPERATOR_AUTH_MODE'] = [string]$effective['PIELARMONIA_OPERATOR_AUTH_MODE']",
        "$effective['AURORADERM_OPERATOR_AUTH_TRANSPORT'] = [string]$effective['PIELARMONIA_OPERATOR_AUTH_TRANSPORT']",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta fallback alias en arranque hosting: ${snippet}`
        );
    }
});
