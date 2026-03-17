#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');
const CI_WORKFLOW_PATH = resolve(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const NIGHTLY_WORKFLOW_PATH = resolve(
    REPO_ROOT,
    '.github',
    'workflows',
    'nightly-stability.yml'
);
const DEPLOY_DOC_PATH = resolve(REPO_ROOT, 'docs', 'GITHUB_ACTIONS_DEPLOY.md');
const STABILITY_PLAN_PATH = resolve(
    REPO_ROOT,
    'docs',
    'STABILITY_14_DAYS_PLAN.md'
);

function loadPackage() {
    return JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
}

function loadWorkflow(workflowPath) {
    const raw = readFileSync(workflowPath, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('package.json declara gate critico de pagos y lo integra al nightly', () => {
    const pkg = loadPackage();
    const paymentsGate = pkg?.scripts?.['test:critical:payments'] || '';
    const nightly = pkg?.scripts?.['nightly:stability'] || '';

    assert.equal(
        typeof paymentsGate,
        'string',
        'falta script test:critical:payments en package.json'
    );

    for (const snippet of [
        'php tests/StripeServiceIntegrationTest.php',
        'php tests/BookingPaymentsContractTest.php',
        'tests/payments-card-booking.spec.js',
        'tests/Unit/payment-engine.spec.js',
    ]) {
        assert.equal(
            paymentsGate.includes(snippet),
            true,
            `falta snippet del gate critico de pagos: ${snippet}`
        );
    }

    assert.equal(
        nightly.includes('npm run test:critical:payments'),
        true,
        'nightly:stability debe incluir test:critical:payments'
    );
});

test('ci ejecuta el critical payments gate dentro del carril e2e', () => {
    const { raw, parsed } = loadWorkflow(CI_WORKFLOW_PATH);
    const steps = parsed?.jobs?.['e2e-tests']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Run Critical Payments Gate'),
        true,
        'falta step Run Critical Payments Gate en CI'
    );
    assert.equal(
        raw.includes('run: npm run test:critical:payments'),
        true,
        'CI debe ejecutar npm run test:critical:payments'
    );
});

test('ci alinea el carril e2e con el foco admin operativo y mantenimiento publico condicionado', () => {
    const { raw, parsed } = loadWorkflow(CI_WORKFLOW_PATH);
    const blockingSteps = parsed?.jobs?.['e2e-tests']?.steps || [];
    const reportSteps = parsed?.jobs?.['e2e-noncritical-report']?.steps || [];
    const blockingNames = blockingSteps.map((step) => String(step?.name || ''));
    const reportNames = reportSteps.map((step) => String(step?.name || ''));

    for (const expectedStep of [
        'Check Runtime Artifacts (focus-aware)',
        'Run Focus Admin Operativo Gate',
        'Run Public Maintenance Smoke',
        'Skip focus/public extras (critical lane only)',
    ]) {
        assert.equal(
            blockingNames.includes(expectedStep),
            true,
            `falta step bloqueante del foco en CI: ${expectedStep}`
        );
    }

    for (const expectedStep of [
        'Run Public Maintenance Report',
        'Skip public maintenance report (focus admin or critical-only diff)',
    ]) {
        assert.equal(
            reportNames.includes(expectedStep),
            true,
            `falta step de reporte condicionado en CI: ${expectedStep}`
        );
    }

    for (const snippet of [
        'focus_admin:',
        'public_maintenance:',
        'run: npm run gate:focus:admin-operativo',
        'run: npm run check:runtime:artifacts',
        'run: npm run smoke:public:routing && npm run smoke:public:conversion',
        'npm run test:frontend:qa:public',
        'Heavy public V4/V5/V6 suites stay in focused workflows/nightly unless those surfaces changed.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring foco admin/public maintenance en CI: ${snippet}`
        );
    }
});

test('nightly-stability ejecuta y resume el critical payments gate', () => {
    const { raw, parsed } = loadWorkflow(NIGHTLY_WORKFLOW_PATH);
    const steps = parsed?.jobs?.nightly?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Setup PHP'),
        true,
        'nightly-stability debe preparar PHP para el gate de pagos'
    );
    assert.equal(
        stepNames.includes('Suite critica pagos'),
        true,
        'falta step Suite critica pagos en nightly-stability'
    );
    assert.equal(
        raw.includes('run: npm run test:critical:payments'),
        true,
        'nightly-stability debe ejecutar npm run test:critical:payments'
    );
    assert.equal(
        raw.includes(
            '- Flujo: ``gate:prod`` + ``test:critical:agenda`` + ``test:critical:funnel`` + ``test:critical:payments``'
        ),
        true,
        'falta trazabilidad del gate de pagos en el summary nightly'
    );
    assert.equal(
        raw.includes(
            '- Semaforo pagos: ``${{ steps.payments_critical.outcome }}``'
        ),
        true,
        'falta outcome del gate de pagos en el summary nightly'
    );
    assert.equal(
        raw.includes(
            'PAYMENTS_CRITICAL_OUTCOME: ${{ steps.payments_critical.outcome }}'
        ),
        true,
        'falta wiring del outcome de pagos para incidentes nightly'
    );
});

test('docs operativas mencionan el carril critico de pagos', () => {
    const deployDoc = readFileSync(DEPLOY_DOC_PATH, 'utf8');
    const stabilityPlan = readFileSync(STABILITY_PLAN_PATH, 'utf8');

    assert.equal(
        deployDoc.includes('`test:critical:payments`'),
        true,
        'docs/GITHUB_ACTIONS_DEPLOY.md debe documentar test:critical:payments'
    );
    assert.equal(
        stabilityPlan.includes('`npm run test:critical:payments`'),
        true,
        'docs/STABILITY_14_DAYS_PLAN.md debe incluir npm run test:critical:payments'
    );
});
