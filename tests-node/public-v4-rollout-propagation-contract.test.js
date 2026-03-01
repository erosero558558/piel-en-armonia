#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const DEPLOY_HOSTING_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'deploy-hosting.yml'
);
const POST_DEPLOY_FAST_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'post-deploy-fast.yml'
);
const POST_DEPLOY_GATE_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'post-deploy-gate.yml'
);

const PUBLIC_V4_ROLLOUT_FIELDS = [
    'enable_public_v4_rollout_monitor',
    'public_v4_rollout_stage',
    'public_v4_rollout_surface_test',
    'public_v4_rollout_surface_control',
    'public_v4_rollout_min_view_booking',
    'public_v4_rollout_min_start_checkout',
    'public_v4_rollout_max_confirmed_drop_pp',
    'public_v4_rollout_min_confirmed_rate_pct',
    'public_v4_rollout_allow_missing_control',
];

function loadWorkflow(filePath) {
    const raw = readFileSync(filePath, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

function extractDispatchBlock(raw, workflowId) {
    const workflowIdNeedle = `workflow_id: '${workflowId}'`;
    const workflowIdIndex = raw.indexOf(workflowIdNeedle);
    assert.notEqual(
        workflowIdIndex,
        -1,
        `no se encontro dispatch hacia ${workflowId}`
    );

    const callStartNeedle =
        'await github.rest.actions.createWorkflowDispatch({';
    const callStartIndex = raw.lastIndexOf(callStartNeedle, workflowIdIndex);
    assert.notEqual(
        callStartIndex,
        -1,
        `no se encontro inicio del bloque dispatch para ${workflowId}`
    );

    const callEndNeedle = '});';
    const callEndIndex = raw.indexOf(callEndNeedle, workflowIdIndex);
    assert.notEqual(
        callEndIndex,
        -1,
        `no se encontro fin del bloque dispatch para ${workflowId}`
    );

    return raw.slice(callStartIndex, callEndIndex + callEndNeedle.length);
}

test('deploy-hosting propaga contrato public_v4 rollout completo a post-deploy-fast y post-deploy-gate', () => {
    const { raw } = loadWorkflow(DEPLOY_HOSTING_WORKFLOW_PATH);
    const fastDispatchBlock = extractDispatchBlock(raw, 'post-deploy-fast.yml');
    const gateDispatchBlock = extractDispatchBlock(raw, 'post-deploy-gate.yml');

    for (const fieldName of PUBLIC_V4_ROLLOUT_FIELDS) {
        assert.equal(
            fastDispatchBlock.includes(`${fieldName}: process.env.`),
            true,
            `falta campo ${fieldName} en dispatch de post-deploy-fast`
        );
        assert.equal(
            gateDispatchBlock.includes(`${fieldName}: process.env.`),
            true,
            `falta campo ${fieldName} en dispatch de post-deploy-gate`
        );
    }
});

test('post-deploy-fast y post-deploy-gate exponen los mismos inputs public_v4 rollout', () => {
    const { parsed: fastParsed } = loadWorkflow(POST_DEPLOY_FAST_WORKFLOW_PATH);
    const { parsed: gateParsed } = loadWorkflow(POST_DEPLOY_GATE_WORKFLOW_PATH);
    const fastInputs = fastParsed?.on?.workflow_dispatch?.inputs || {};
    const gateInputs = gateParsed?.on?.workflow_dispatch?.inputs || {};

    for (const fieldName of PUBLIC_V4_ROLLOUT_FIELDS) {
        assert.equal(
            typeof fastInputs[fieldName] === 'object',
            true,
            `falta input ${fieldName} en post-deploy-fast`
        );
        assert.equal(
            typeof gateInputs[fieldName] === 'object',
            true,
            `falta input ${fieldName} en post-deploy-gate`
        );
    }
});
