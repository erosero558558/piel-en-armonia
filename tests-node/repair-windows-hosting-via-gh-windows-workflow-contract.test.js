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
    'repair-windows-hosting-via-gh-windows.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('repair-windows-hosting-via-gh-windows usa windows-latest y fallback a FTP_*', () => {
    const { raw, parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const job = parsed?.jobs?.repair || {};
    const env = job.env || {};

    for (const inputName of [
        'target_commit',
        'preflight_only',
        'public_domain',
        'candidate_ports',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(
        job['runs-on'],
        'windows-latest',
        'debe correr en windows-latest'
    );
    assert.equal(
        parsed?.permissions?.contents,
        'read',
        'solo requiere contents: read'
    );
    assert.equal(
        parsed?.concurrency?.group,
        'repair-windows-hosting-via-gh-windows',
        'falta el candado de concurrencia'
    );

    for (const key of ['SSH_HOST', 'SSH_USERNAME', 'SSH_PASSWORD']) {
        assert.equal(
            typeof env[key] === 'string',
            true,
            `falta env remoto: ${key}`
        );
    }

    for (const snippet of [
        'secrets.FTP_SERVER',
        'secrets.FTP_USERNAME',
        'secrets.FTP_PASSWORD',
        'runs-on: windows-latest',
        'Install Posh-SSH',
        'Probe candidate SSH ports from GitHub Windows',
        'Test-NetConnection',
        'New-SSHSession',
        'Invoke-SSHCommand',
        'REPARAR-HOSTING-WINDOWS.ps1',
        'repair-windows-hosting-via-gh-windows-artifacts',
        'public-runtime-after.json',
        'public-health-after.json',
        'public-admin-auth-after.json',
        'runtime_current_commit_mismatch',
        'public_sync_unhealthy',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo: ${snippet}`
        );
    }
});
