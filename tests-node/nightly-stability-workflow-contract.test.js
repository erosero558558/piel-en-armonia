#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'nightly-stability.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('nightly-stability habilita permisos para incidentes', () => {
    const { parsed } = loadWorkflow();
    const permissions = parsed?.permissions || {};

    assert.equal(
        permissions.issues,
        'write',
        'nightly-stability debe tener issues: write para incidentes automaticos'
    );
});

test('nightly-stability incluye cierre de ciclo de incidente', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.nightly?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Crear/actualizar incidente nightly'),
        true,
        'falta step de crear/actualizar incidente nightly'
    );
    assert.equal(
        stepNames.includes('Cerrar incidente nightly al recuperar'),
        true,
        'falta step de cierre de incidente nightly'
    );
    assert.equal(
        stepNames.includes('Crear/actualizar incidente telemedicina nightly'),
        true,
        'falta step de incidente dedicado telemedicina nightly'
    );
    assert.equal(
        stepNames.includes(
            'Cerrar incidente telemedicina nightly al recuperar'
        ),
        true,
        'falta step de cierre de incidente dedicado telemedicina nightly'
    );

    assert.equal(
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura solo en fallo no manual'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre solo en ejecucion no manual'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && ((env.TELEMEDICINE_NIGHTLY_STATUS != 'degraded_only' && env.TELEMEDICINE_NIGHTLY_STATUS != 'unknown') || env.TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES != '0')"
        ),
        true,
        'falta condicion de incidente nightly generico excluyendo tele-only unknown/degraded_only'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_NIGHTLY_STATUS == 'degraded_only' || env.TELEMEDICINE_NIGHTLY_STATUS == 'degraded_mixed' || env.TELEMEDICINE_NIGHTLY_STATUS == 'unknown')"
        ),
        true,
        'falta condicion de incidente telemedicina dedicada/mixta/unknown en nightly'
    );
    assert.equal(
        raw.includes('Nightly stability fallando'),
        true,
        'falta titulo canonico de incidente nightly'
    );
    assert.equal(
        raw.includes('Nightly stability telemedicina degradado'),
        true,
        'falta titulo canonico de incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes('nightly-telemedicine-signal:'),
        true,
        'falta marker de dedupe por senal en incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes(
            "non_tele:${process.env.TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta non_tele en signal de dedupe para incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes(
            "telemedicine_nightly_non_tele_failures: ${process.env.TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta trazabilidad de non_tele_failures en updates de incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes('severity:critical'),
        true,
        'falta severidad critical en incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes('severity:warning'),
        true,
        'falta severidad warning en incidente telemedicina nightly'
    );
    assert.equal(
        raw.includes(
            "baseLabels = ['production-alert', 'nightly-stability', 'telemedicine', severity]"
        ),
        true,
        'falta labels base con severidad en incidente telemedicina nightly'
    );
});

test('nightly-stability evalua y resume estado telemedicina', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.nightly?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Evaluar estado telemedicina nightly'),
        true,
        'falta step de evaluacion telemedicina nightly'
    );
    assert.equal(
        raw.includes('Telemedicine nightly status:'),
        true,
        'falta linea de estado telemedicina en summary nightly'
    );
    assert.equal(
        raw.includes('Telemedicine nightly step outcome:'),
        true,
        'falta linea de outcome telemedicina en summary nightly'
    );
    assert.equal(
        raw.includes('TELEMEDICINE_NIGHTLY_NON_TELE_FAILURES'),
        true,
        'falta trazabilidad de non-tele failures en nightly'
    );
    assert.equal(
        raw.includes('health-telemedicine-*'),
        true,
        'falta clasificacion de fallas telemedicina por prefijo de asset en nightly'
    );
});
