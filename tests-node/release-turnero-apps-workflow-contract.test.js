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
    'release-turnero-apps.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('release-turnero-apps expone inputs operativos de release y publicacion', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'release_version',
        'base_url',
        'update_base_url',
        'surface_filter',
        'target_filter',
        'skip_android',
        'publish_to_hosting',
        'protocol',
        'server_port',
        'security',
        'server_dir',
        'dry_run',
        'publish_github_release',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }
});

test('release-turnero-apps habilita contents write y jobs canonicos', () => {
    const { parsed } = loadWorkflow();
    const jobs = parsed?.jobs || {};

    assert.equal(parsed?.permissions?.contents, 'write');
    assert.equal(typeof jobs['resolve-release-plan'], 'object');
    assert.equal(typeof jobs['build-desktop'], 'object');
    assert.equal(typeof jobs['build-android'], 'object');
    assert.equal(typeof jobs['package-release-desktop-only'], 'object');
    assert.equal(typeof jobs['package-release-full'], 'object');
    assert.equal(typeof jobs['publish-to-hosting'], 'object');
    assert.equal(typeof jobs['publish-github-release'], 'object');
});

test('release-turnero-apps empaqueta bundle, publica APK y deja rutas de hosting listas', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'node bin/resolve-turnero-release-plan.js',
        '--github-output "$GITHUB_OUTPUT"',
        'node bin/stage-turnero-app-release.js',
        'turnero-apps-release-bundle',
        'actions/download-artifact@v4',
        'actions/upload-artifact@v4',
        'SamKirkland/FTP-Deploy-Action@v4.3.5',
        'softprops/action-gh-release@v2',
        'desktop-updates/pilot/**/*',
        'desktop-updates/stable/**/*',
        'app-downloads/pilot/**/*',
        'app-downloads/stable/**/*',
        '--surface-filter "${{ inputs.surface_filter }}"',
        '--target-filter "${{ inputs.target_filter }}"',
        '--skip-android "${{ inputs.skip_android }}"',
        '--surfaces "${{ inputs.surface_filter }}"',
        '--targets "${{ inputs.target_filter }}"',
        "needs.resolve-release-plan.outputs.android_count == '0'",
        "needs.resolve-release-plan.outputs.android_count != '0'",
        "needs.build-android.result == 'success'",
        "needs.package-release-desktop-only.result == 'success'",
        "needs.package-release-full.result == 'success'",
        'package-release-desktop-only',
        'package-release-full',
        'gradle -p "${{ matrix.gradle_project }}" "${{ matrix.build_task }}"',
        '${{ matrix.source_artifact }}',
        '${{ matrix.staged_artifact_path }}',
        'npm run build:surface --',
        'pattern: turnero-desktop-*',
        'pattern: turnero-android-*',
        '--androidRoot artifacts/android',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en release-turnero-apps: ${snippet}`
        );
    }
});
