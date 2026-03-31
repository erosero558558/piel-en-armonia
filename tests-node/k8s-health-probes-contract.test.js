#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const DEPLOYMENT_PATH = resolve(__dirname, '..', 'k8s', 'deployment.yaml');

function loadDeployment() {
    const raw = readFileSync(DEPLOYMENT_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

function appContainer(parsed) {
    const containers = parsed?.spec?.template?.spec?.containers;
    assert.equal(Array.isArray(containers), true, 'deployment debe declarar containers');
    const app = containers.find((container) => container?.name === 'app');
    assert.ok(app, 'deployment debe incluir container app');
    return app;
}

function assertHealthProbe(probe, expectedFailureThreshold, label) {
    assert.equal(typeof probe, 'object', `${label} debe existir`);
    assert.equal(
        probe?.httpGet?.path,
        '/api.php?resource=health',
        `${label} debe apuntar al health endpoint canonico`
    );
    assert.equal(
        probe?.httpGet?.port,
        80,
        `${label} debe usar el puerto 80 del container`
    );
    assert.equal(
        probe?.failureThreshold,
        expectedFailureThreshold,
        `${label} debe mantener el failureThreshold pedido`
    );
    assert.equal(
        probe?.timeoutSeconds,
        2,
        `${label} debe tener timeout corto para detectar pods colgados`
    );
}

test('k8s deployment expone readinessProbe contra /api.php?resource=health', () => {
    const { parsed } = loadDeployment();
    const app = appContainer(parsed);

    assertHealthProbe(app.readinessProbe, 3, 'readinessProbe');
    assert.equal(
        app.readinessProbe?.periodSeconds,
        10,
        'readinessProbe debe sondear cada 10s'
    );
});

test('k8s deployment expone livenessProbe contra /api.php?resource=health', () => {
    const { parsed } = loadDeployment();
    const app = appContainer(parsed);

    assertHealthProbe(app.livenessProbe, 5, 'livenessProbe');
    assert.equal(
        app.livenessProbe?.periodSeconds,
        20,
        'livenessProbe debe evitar reinicios agresivos'
    );
});
