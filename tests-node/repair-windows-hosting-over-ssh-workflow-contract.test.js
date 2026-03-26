#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const REPO_ROOT = resolve(__dirname, '..');
const WORKFLOW_PATH = resolve(
    REPO_ROOT,
    '.github',
    'workflows',
    'repair-windows-hosting-over-ssh.yml'
);
const COMMON_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'windows-hosting-ssh-common.sh'
);
const DOC_PATH = resolve(REPO_ROOT, 'docs', 'WINDOWS_HOSTING_REMOTE_SSH.md');

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('repair-windows-hosting-over-ssh expone inputs manuales y usa ubuntu-latest con SSH del repo', () => {
    const { raw, parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const job = parsed?.jobs?.repair || {};
    const env = job.env || {};
    const outputs = job.outputs || {};

    for (const inputName of [
        'target_commit',
        'preflight_only',
        'public_domain',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(
        job['runs-on'],
        'ubuntu-latest',
        'debe correr en ubuntu-latest'
    );
    assert.equal(
        parsed?.permissions?.contents,
        'read',
        'solo requiere contents: read'
    );
    assert.equal(
        parsed?.concurrency?.group,
        'repair-windows-hosting-over-ssh',
        'falta el candado de concurrencia'
    );

    for (const key of [
        'SSH_HOST',
        'SSH_PORT',
        'SSH_USERNAME',
        'SSH_PASSWORD',
    ]) {
        assert.equal(
            typeof env[key] === 'string',
            true,
            `falta env SSH: ${key}`
        );
    }

    for (const key of [
        'target_commit',
        'current_commit',
        'desired_commit',
        'health_ok',
        'auth_mode',
        'auth_transport',
    ]) {
        assert.equal(
            typeof outputs[key] === 'string',
            true,
            `falta output del job: ${key}`
        );
    }

    for (const snippet of [
        'Install sshpass',
        './scripts/ops/setup/DIAGNOSTICAR-HOSTING-WINDOWS-SSH.sh',
        './scripts/ops/setup/EXECUTAR-HOSTING-WINDOWS-SSH.sh',
        'repair-windows-hosting-over-ssh-artifacts',
        'public-runtime-before.json',
        'public-runtime-after.json',
        'public-health-after.json',
        'public-admin-auth-after.json',
        'runtime_current_commit_mismatch',
        'runtime_desired_commit_mismatch',
        'public_sync_unhealthy',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo: ${snippet}`
        );
    }
});

test('windows-hosting-ssh-common soporta fallback por SSH_PASSWORD y el runbook lo documenta', () => {
    const commonRaw = readFileSync(COMMON_SCRIPT_PATH, 'utf8');
    const docRaw = readFileSync(DOC_PATH, 'utf8');

    for (const snippet of [
        'export SSH_PASSWORD="${SSH_PASSWORD:-}"',
        'windows_hosting_require_command sshpass',
        'ssh_prefix=(sshpass -p "${SSH_PASSWORD}")',
        '-o PreferredAuthentications=password',
        '-o PubkeyAuthentication=no',
        'windows_hosting_log "SSH auth mode=${auth_mode}"',
    ]) {
        assert.equal(
            commonRaw.includes(snippet),
            true,
            `falta soporte password fallback en common.sh: ${snippet}`
        );
    }

    for (const snippet of [
        '- `SSH_PASSWORD`',
        'export SSH_PASSWORD=',
        'o, si el host expone solo password',
    ]) {
        assert.equal(
            docRaw.includes(snippet),
            true,
            `falta documentacion SSH password fallback: ${snippet}`
        );
    }
});
