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
        raw.includes('Nightly stability fallando'),
        true,
        'falta titulo canonico de incidente nightly'
    );
});
