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
