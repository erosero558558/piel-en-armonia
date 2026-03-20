#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'frontend-premium-qa.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

function getStepNames(steps) {
    return (steps || []).map((step) => String(step?.name || ''));
}

test('frontend premium QA incluye baseline visual en ejecucion y artefactos', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Capture visual baseline (desktop + mobile)'),
        true,
        'falta step de captura baseline visual'
    );
    assert.equal(
        stepNames.includes('Upload Visual baseline'),
        true,
        'falta step de upload de baseline visual'
    );

    assert.equal(
        raw.includes(
            'node bin/capture-public-baseline.js --out-dir .visual-baseline --label ci'
        ),
        true,
        'falta comando baseline visual en workflow'
    );
    assert.equal(
        raw.includes('name: premium-visual-baseline'),
        true,
        'falta artefacto premium-visual-baseline'
    );
    assert.equal(
        raw.includes('path: .visual-baseline/'),
        true,
        'falta path de artefacto visual baseline'
    );
});

test('frontend premium QA incluye gate de performance con evidencia', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Run public performance gate (CWV + budgets)'),
        true,
        'falta step de gate de performance'
    );
    assert.equal(
        stepNames.includes('Upload Performance gate evidence'),
        true,
        'falta upload de evidencia de performance gate'
    );
    assert.equal(
        raw.includes('run: npm run test:frontend:performance:gate'),
        true,
        'falta comando de performance gate en workflow'
    );
    assert.equal(
        raw.includes('name: premium-performance-gate'),
        true,
        'falta artefacto premium-performance-gate'
    );
    assert.equal(
        raw.includes('path: verification/performance-gate/'),
        true,
        'falta path de artefacto de performance gate'
    );
});

test('frontend premium QA publica contrato de aprobacion Public V3 en el summary', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Summary'),
        true,
        'falta step Summary en frontend premium QA'
    );
    assert.equal(
        raw.includes(
            'echo "- approval_contract: \\`premium_frontend_qa + lighthouse + performance_gate + visual_baseline\\`";'
        ),
        true,
        'falta contrato de aprobacion Public V3 en summary de frontend premium QA'
    );
    assert.equal(
        raw.includes(
            'echo "- V4 hardening: \\`npm run test:frontend:qa:v4\\`";'
        ),
        true,
        'falta referencia de hardening V4 en summary de frontend premium QA'
    );
});

test('frontend premium QA reconstruye rutas publicas con el build canonico', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes('run: npm run build'),
        true,
        'frontend premium QA debe usar npm run build para reconstruir rutas publicas'
    );
    assert.equal(
        raw.includes('npm run build:html'),
        false,
        'frontend premium QA no debe depender de build:html legacy'
    );
    assert.equal(
        raw.includes('npm run services:build'),
        false,
        'frontend premium QA no debe depender de services:build legacy'
    );
    assert.equal(
        raw.includes('npm run astro:build'),
        false,
        'frontend premium QA no debe duplicar astro:build fuera del build canonico'
    );
    assert.equal(
        raw.includes('npm run astro:sync'),
        false,
        'frontend premium QA no debe duplicar astro:sync fuera del build canonico'
    );
});

test('frontend premium QA observa cambios en contratos V4 de contenido, rollout y analytics', () => {
    const { raw } = loadWorkflow();

    const expectedPaths = [
        'tests-node/public-v4-content-contract.test.js',
        'tests-node/public-v4-service-static-parity.test.js',
        'tests-node/public-v4-rollout-gate.test.js',
        'tests-node/analytics-rollout-contract.test.js',
        'bin/run-public-v4-rollout-gate.js',
        'bin/validate-public-v4-catalog.js',
    ];

    for (const expectedPath of expectedPaths) {
        assert.equal(
            raw.includes(`- '${expectedPath}'`),
            true,
            `falta trigger de workflow para ${expectedPath}`
        );
    }
});

test('frontend premium QA fija host y puertos canonicos para lighthouse y performance local', () => {
    const { raw, parsed } = loadWorkflow();
    const jobEnv = parsed?.jobs?.['premium-qa']?.env || {};

    assert.equal(
        jobEnv.TEST_LOCAL_SERVER_PORT,
        '8011',
        'frontend premium QA debe fijar TEST_LOCAL_SERVER_PORT=8011'
    );
    assert.equal(
        jobEnv.LIGHTHOUSE_LOCAL_SERVER_HOST,
        '127.0.0.1',
        'frontend premium QA debe fijar LIGHTHOUSE_LOCAL_SERVER_HOST=127.0.0.1'
    );
    assert.equal(
        jobEnv.LIGHTHOUSE_LOCAL_SERVER_PORT,
        '8011',
        'frontend premium QA debe fijar LIGHTHOUSE_LOCAL_SERVER_PORT=8011'
    );

    assert.equal(
        raw.includes("TEST_LOCAL_SERVER_PORT: '8011'"),
        true,
        'falta TEST_LOCAL_SERVER_PORT explicito en workflow'
    );
    assert.equal(
        raw.includes("LIGHTHOUSE_LOCAL_SERVER_PORT: '8011'"),
        true,
        'falta LIGHTHOUSE_LOCAL_SERVER_PORT explicito en workflow'
    );
});

test('frontend premium QA construye el stage canonico y no invoca scripts legacy inexistentes', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Build canonical staged frontend outputs'),
        true,
        'falta el build canonico del frontend stageado'
    );
    assert.equal(
        raw.includes('run: npm run build'),
        true,
        'frontend premium QA debe usar npm run build'
    );
    assert.doesNotMatch(
        raw,
        /npm run build:html|npm run services:build|npm run astro:sync/u,
        'frontend premium QA no debe seguir invocando scripts legacy de rebuild'
    );
});
