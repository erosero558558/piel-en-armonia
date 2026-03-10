#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const SCRIPT_PATH = resolve(__dirname, '..', 'REPORTE-SEMANAL-PRODUCCION.ps1');

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

test('weekly report script expone parametros de ciclo semanal', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '[int]$CriticalFreeCycleTarget = 2',
        '[switch]$FailOnCycleNotReady',
        '$CriticalFreeCycleTarget -lt 1',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de parametro/guardrail: ${snippet}`
        );
    }
});

test('weekly report script publica weeklyCycle en markdown y JSON', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '## Weekly Cycle Guardrail',
        '$weeklyCycleHistoryBlock',
        '$weeklyCyclePayload = [ordered]@{}',
        '$weeklyCyclePayload.targetConsecutiveNoCritical = $weeklyCycleTarget',
        '$weeklyCyclePayload.consecutiveNoCritical = $weeklyCycleConsecutiveNoCritical',
        '$weeklyCyclePayload.ready = [bool]$weeklyCycleReady',
        '$reportPayload.weeklyCycle = $weeklyCyclePayload',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de salida weeklyCycle: ${snippet}`
        );
    }
});

test('weekly report script soporta fail opcional por ciclo no listo', () => {
    const raw = loadScript();
    const requiredSnippets = [
        'if ($FailOnCycleNotReady -and -not $weeklyCycleReady)',
        'FailOnCycleNotReady activo: ciclo semanal no listo',
        'Get-WeeklyCycleEvaluation',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de fail/gobernanza ciclo: ${snippet}`
        );
    }
});

test('weekly report script integra bloque telemedicina operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        '[int]$TelemedicineReviewQueueWarnCount = 12',
        '[int]$TelemedicineStagedUploadsWarnCount = 1',
        '[int]$TelemedicineUnlinkedIntakesWarnCount = 5',
        'telemedicine_diagnostics_status',
        'telemedicine_diagnostics_critical_',
        'telemedicine_case_photos_missing_private_path_',
    ];
    const requiredWarningsSnippets = [
        '## Telemedicine Ops',
        'telemedicine = [ordered]@{',
        "if ($WarningCode.StartsWith('telemedicine_')) {",
        'telemedicine = @()',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet telemedicina en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet telemedicina en Common.Warnings.ps1: ${snippet}`
        );
    }
});
