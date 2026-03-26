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
    'promote-windows-hosting-target.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('promote-windows-hosting-target expone inputs manuales y corre en self-hosted Windows', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const job = parsed?.jobs?.promote || {};
    const outputs = job.outputs || {};

    for (const inputName of [
        'target_commit',
        'promote_remote_head',
        'preflight_only',
        'public_domain',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.deepEqual(
        job['runs-on'],
        ['self-hosted', 'Windows'],
        'el workflow debe correr en el host Windows self-hosted'
    );

    for (const outputName of [
        'target_commit',
        'desired_commit',
        'current_commit',
        'auth_mode',
        'auth_transport',
        'health_ok',
    ]) {
        assert.equal(
            typeof outputs[outputName] === 'string',
            true,
            `falta output del job: ${outputName}`
        );
    }

    assert.equal(
        parsed?.permissions?.contents,
        'read',
        'el workflow solo debe requerir contents: read'
    );
    assert.equal(
        parsed?.concurrency?.group,
        'promote-windows-hosting-target',
        'falta candado de concurrencia del workflow'
    );
});

test('promote-windows-hosting-target usa REPARAR como entrypoint canonico y no llama sync directo', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.promote?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const stepName of [
        'Resolve promotion target commit',
        'Capture runtime fingerprint before promotion',
        'Run Windows hosting repair',
        'Collect Windows hosting promotion evidence',
        'Upload Windows hosting promotion artifacts',
        'Finalize Windows hosting promotion verdict',
    ]) {
        assert.equal(
            stepNames.includes(stepName),
            true,
            `falta step requerido: ${stepName}`
        );
    }

    for (const snippet of [
        '.\\scripts\\ops\\setup\\REPARAR-HOSTING-WINDOWS.ps1',
        '-PromoteCurrentRemoteHead',
        '-TargetCommit',
        '-PreflightOnly',
        'PreflightOnly activo: el workflow no pasa -TargetCommit ni -PromoteCurrentRemoteHead.',
        '__hosting/runtime',
        'admin-auth.php?action=status',
        'api.php?resource=health',
        'release_target_not_updated',
        'main_sync_not_applied_target',
        'operator_auth_invalid',
        'billing_gate: passed_to_manual_workflow',
        'runner_gate: self_hosted_windows_active',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo del workflow: ${snippet}`
        );
    }

    assert.equal(
        raw.includes('SINCRONIZAR-HOSTING-WINDOWS.ps1'),
        false,
        'el workflow no debe invocar SINCRONIZAR-HOSTING-WINDOWS.ps1 directamente'
    );
});

test('promote-windows-hosting-target recopila artefactos y valida el pin publico final', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'REPAIR_STATUS_PATH: C:\\ProgramData\\Pielarmonia\\hosting\\repair-hosting-status.json',
        'MAIN_SYNC_STATUS_PATH: C:\\ProgramData\\Pielarmonia\\hosting\\main-sync-status.json',
        'HOSTING_SUPERVISOR_STATUS_PATH: C:\\ProgramData\\Pielarmonia\\hosting\\hosting-supervisor-status.json',
        'uses: actions/upload-artifact@v4',
        'promote-windows-hosting-target-artifacts',
        'public-runtime-before.json',
        'public-runtime-after.json',
        'local-runtime-after.json',
        'public-health-after.json',
        'public-admin-auth-after.json',
        'public_sync_not_reporting_target',
        'health_ok=',
        'target_commit=',
        'desired_commit=',
        'current_commit=',
        'auth_mode=',
        'auth_transport=',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta evidencia/validacion del workflow: ${snippet}`
        );
    }
});
