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
    'deploy-frontend-selfhosted.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('deploy-frontend-selfhosted no depende de label kimi y mantiene runner windows self-hosted', () => {
    const { raw } = loadWorkflow();
    assert.equal(raw.includes('runs-on: [self-hosted, Windows]'), true);
    assert.equal(raw.includes('runs-on: [self-hosted, Windows, kimi]'), false);
});

test('deploy-frontend-selfhosted evalua y gestiona incidente dedicado de telemedicina', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.deploy?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        parsed?.permissions?.issues,
        'write',
        'falta permiso issues: write en deploy-frontend-selfhosted'
    );

    for (const expectedStep of [
        'Evaluate telemedicine health after frontend deploy',
        'Create or update telemedicine incident (self-hosted deploy)',
        'Close telemedicine incident when recovered (self-hosted deploy)',
        'Deployment summary',
    ]) {
        assert.equal(
            stepNames.includes(expectedStep),
            true,
            `falta step telemedicina en deploy-frontend-selfhosted: ${expectedStep}`
        );
    }

    for (const snippet of [
        'TELEMEDICINE_SELFHOSTED_STATUS',
        'TELEMEDICINE_SELFHOSTED_REASON',
        'TELEMEDICINE_SELFHOSTED_FAILURES',
        'TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES',
        'id: build_astro_routes',
        'id: deploy_frontend_bundle',
        'id: validate_public_frontend',
        'BUILD_ASTRO_OUTCOME: ${{ steps.build_astro_routes.outcome }}',
        'DEPLOY_BUNDLE_OUTCOME: ${{ steps.deploy_frontend_bundle.outcome }}',
        'VALIDATE_PUBLIC_FRONTEND_OUTCOME: ${{ steps.validate_public_frontend.outcome }}',
        'function Count-NonTeleFailures',
        '$nonTeleFailures = Count-NonTeleFailures @(',
        "non_tele:${process.env.TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES || '-1'}",
        '[ALERTA PROD] Deploy Frontend Self-Hosted telemedicina degradada',
        'deploy-frontend-selfhosted-telemedicine-signal:',
        "(env.TELEMEDICINE_SELFHOSTED_STATUS == 'degraded' || env.TELEMEDICINE_SELFHOSTED_STATUS == 'unknown')",
        "env.TELEMEDICINE_SELFHOSTED_STATUS == 'healthy'",
        'telemedicine_selfhosted_non_tele_failures: ``$env:TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES``',
        'telemedicine_selfhosted_step_outcome',
        "reason.includes('diagnostics_critical')",
        "reason.includes('hard_failures:')",
        "reason.includes('hard_failures_invalid')",
        "reason.includes('health_unavailable')",
        "reason.includes('health_parse_error')",
        "reason.includes('telemedicine_missing')",
        "reason.includes('not_configured')",
        ": 'severity:warning';",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring telemedicina self-hosted: ${snippet}`
        );
    }
});
