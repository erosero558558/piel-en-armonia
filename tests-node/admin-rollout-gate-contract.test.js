#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const SCRIPT_PATH = resolve(__dirname, '..', 'GATE-ADMIN-ROLLOUT.ps1');

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

test('admin rollout gate expone stage estable y contrato v3-only', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes("[ValidateSet('stable')]"),
        true,
        'falta stage estable canonico'
    );
    assert.equal(
        raw.includes('url = "$base/admin.html"'),
        true,
        'falta chequeo canonico de admin.html'
    );
    assert.equal(
        raw.includes('has_admin_v3_css = $false'),
        true,
        'falta flag de admin-v3.css en el reporte'
    );
    assert.equal(
        raw.includes('references_legacy_styles = $false'),
        true,
        'falta flag de referencias legacy en el reporte'
    );
});

test('admin rollout gate registra suites runtime v3-only', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('runtime_smoke = [ordered]@{'),
        true,
        'falta bloque runtime_smoke en el reporte'
    );
    assert.equal(
        raw.includes('suites = @()'),
        true,
        'falta coleccion de suites runtime en el reporte'
    );
    assert.equal(
        raw.includes("Name = 'admin-ui-runtime'"),
        true,
        'falta suite base admin-ui-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-ui-runtime-smoke.spec.js')"),
        true,
        'falta spec base admin-ui-runtime-smoke'
    );
    assert.equal(
        raw.includes("Name = 'admin-v3-runtime'"),
        true,
        'falta suite estable admin-v3-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-v3-canary-runtime.spec.js')"),
        true,
        'falta spec estable de runtime V3'
    );
});

test('admin rollout gate persiste resultados suite por suite', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('$suiteResult = Invoke-PlaywrightSmokeSuite'),
        true,
        'falta ejecucion de suites runtime via helper reusable'
    );
    assert.equal(
        raw.includes('$report.runtime_smoke.suites += [ordered]@{'),
        true,
        'falta persistencia de resultado por suite'
    );
    assert.equal(
        raw.includes('exit_code = [int]$suiteResult.exit_code'),
        true,
        'falta exit_code por suite en el reporte'
    );
    assert.equal(
        raw.includes('specs = @($suiteResult.specs)'),
        true,
        'falta lista de specs por suite en el reporte'
    );
});
