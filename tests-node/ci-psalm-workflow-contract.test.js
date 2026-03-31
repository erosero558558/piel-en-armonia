#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const REPO_ROOT = resolve(__dirname, '..');
const CI_WORKFLOW_PATH = resolve(REPO_ROOT, '.github', 'workflows', 'ci.yml');

function loadWorkflow() {
    const raw = readFileSync(CI_WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

function findStep(steps, name) {
    return steps.find((step) => String(step?.name || '') === name);
}

test('ci declara un carril psalm para cambios PHP sensibles', () => {
    const { parsed } = loadWorkflow();
    const psalmJob = parsed?.jobs?.psalm;
    const steps = psalmJob?.steps || [];
    const filterStep = findStep(steps, 'Detect Psalm relevant changes');
    const filters = String(filterStep?.with?.filters || '');

    assert.ok(psalmJob, 'falta job psalm en CI');
    assert.equal(
        psalmJob['continue-on-error'],
        true,
        'psalm debe seguir como allowed failure en este bootstrap'
    );
    assert.equal(
        filters.includes("- 'controllers/**'"),
        true,
        'psalm debe activarse si el PR toca controllers/**'
    );
    assert.equal(
        filters.includes("- 'lib/**'"),
        true,
        'psalm debe activarse si el PR toca lib/**'
    );
});

test('ci falla con mensaje accionable si falta vendor/bin/psalm', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.psalm?.steps || [];
    const assertStep = findStep(steps, 'Assert Psalm binary is available');

    assert.ok(assertStep, 'falta guardrail para vendor/bin/psalm');
    assert.equal(
        String(assertStep?.if || '').includes("steps.changes.outputs.psalm == 'true'"),
        true,
        'el guardrail debe evaluarse cuando hay cambios Psalm-relevant'
    );
    assert.equal(
        String(assertStep?.run || '').includes('vendor/bin/psalm'),
        true,
        'el guardrail debe validar vendor/bin/psalm'
    );
    assert.equal(
        raw.includes('::error::Instala Psalm: composer require --dev vimeo/psalm'),
        true,
        'CI debe emitir un mensaje accionable cuando falta Psalm'
    );
});

test('ci no hace skip silencioso cuando hay cambios relevantes para psalm', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.psalm?.steps || [];
    const runStep = findStep(steps, 'Run Psalm Static Analysis');
    const skipStep = findStep(steps, 'Skip Psalm (no relevant changes)');

    assert.ok(runStep, 'falta step Run Psalm Static Analysis');
    assert.equal(
        String(runStep?.if || '').includes("steps.changes.outputs.psalm == 'true'"),
        true,
        'Psalm debe ejecutarse cuando detecta cambios relevantes'
    );
    assert.equal(
        String(skipStep?.if || '').includes("steps.changes.outputs.psalm != 'true'"),
        true,
        'el skip solo debe aplicar cuando no hay cambios relevantes'
    );
    assert.equal(
        raw.includes('run: php -d max_execution_time=0 ./vendor/bin/psalm --no-cache'),
        true,
        'CI debe ejecutar Psalm en el job dedicado'
    );
});
