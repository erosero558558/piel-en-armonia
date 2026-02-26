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
    'post-deploy-fast.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('post-deploy-fast habilita permisos para incidentes', () => {
    const { parsed } = loadWorkflow();
    const permissions = parsed?.permissions || {};

    assert.equal(
        permissions.issues,
        'write',
        'post-deploy-fast debe tener issues: write para incidentes automaticos'
    );
});

test('post-deploy-fast incluye cierre de ciclo de incidente', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['gate-fast']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Crear/actualizar incidente fast lane'),
        true,
        'falta step de crear/actualizar incidente fast lane'
    );
    assert.equal(
        stepNames.includes('Cerrar incidente fast lane al recuperar'),
        true,
        'falta step de cierre de incidente fast lane'
    );
    assert.equal(
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura de incidente en fallo no manual'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre de incidente en recuperacion no manual'
    );
    assert.equal(
        raw.includes('Post-Deploy Fast Lane fallando'),
        true,
        'falta titulo canonico de incidente fast lane'
    );
});
