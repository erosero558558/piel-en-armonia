#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const SCRIPT_PATH = resolve(__dirname, '..', 'GATE-ADMIN-ROLLOUT.ps1');
const ADMIN_HTML_PATH = resolve(__dirname, '..', 'admin.html');
const ADMIN_RUNTIME_PATH = resolve(__dirname, '..', 'js', 'admin-runtime.js');
const SW_PATH = resolve(__dirname, '..', 'sw.js');

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

function loadFile(path) {
    return readFileSync(path, 'utf8');
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
        raw.includes('uses_canonical_runtime = $false'),
        true,
        'falta flag de runtime canonico en el reporte'
    );
    assert.equal(
        raw.includes('references_runtime_bridge = $false'),
        true,
        'falta flag de runtime bridge heredado en el reporte'
    );
    assert.equal(
        raw.includes('references_legacy_styles = $false'),
        true,
        'falta flag de referencias legacy en el reporte'
    );
});

test('admin shell usa el bundle canonico v3 y deja runtime bridge solo como alias', () => {
    const html = loadFile(ADMIN_HTML_PATH);
    const runtimeBridge = loadFile(ADMIN_RUNTIME_PATH);

    assert.match(
        html,
        /href="admin-v3\.css\?v=/,
        'admin.html debe cargar admin-v3.css'
    );
    assert.match(
        html,
        /src="admin\.js\?v=/,
        'admin.html debe cargar admin.js canonico'
    );
    assert.doesNotMatch(
        html,
        /js\/admin-runtime\.js/,
        'admin.html no debe cargar el runtime bridge heredado'
    );
    assert.doesNotMatch(
        html,
        /href="admin\.css|href="admin-v2\.css|href="admin\.min\.css/,
        'admin.html no debe referenciar hojas de estilo legacy'
    );

    assert.match(
        runtimeBridge,
        /import '\.\.\/admin\.js';/,
        'admin-runtime debe reenviar al bundle canonico'
    );
    assert.doesNotMatch(
        runtimeBridge,
        /src\/apps\/admin\/index\.js/,
        'admin-runtime ya no debe importar codigo fuente desde src'
    );
});

test('service worker precachea el shell admin canonico sin assets legacy', () => {
    const sw = loadFile(SW_PATH);

    assert.match(sw, /'\/admin\.html'/, 'sw debe precachear admin.html');
    assert.match(sw, /'\/admin-v3\.css\?v=/, 'sw debe precachear admin-v3.css');
    assert.match(sw, /'\/admin\.js\?v=/, 'sw debe precachear admin.js');
    assert.match(
        sw,
        /'\/js\/admin-preboot-shortcuts\.js\?v=/,
        'sw debe precachear el preboot admin'
    );
    assert.doesNotMatch(
        sw,
        /'\/admin\.css\?v=/,
        'sw no debe precachear admin.css legacy'
    );
    assert.doesNotMatch(
        sw,
        /'\/js\/admin-runtime\.js\?v=/,
        'sw no debe precachear el runtime bridge heredado'
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
