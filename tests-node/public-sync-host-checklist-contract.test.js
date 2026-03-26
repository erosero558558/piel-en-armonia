#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'CHECKLIST-HOST-PUBLIC-SYNC.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'PUBLIC_MAIN_UPDATE_RUNBOOK.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('public sync host checklist script expone comandos canonicos de triage host-side', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$RepoPath = '/var/www/figo'",
        "[string]$GeneratedSiteRoot = '/var/www/figo/.generated/site-root'",
        "[string]$DeployBundlePath = '/var/www/figo/_deploy_bundle'",
        "[string]$WrapperPath = '/root/sync-pielarmonia.sh'",
        "[string]$CanonicalWrapperPath = '/var/www/figo/bin/deploy-public-v3-cron-sync.sh'",
        "[string]$StatusPath = '/var/lib/pielarmonia/public-sync-status.json'",
        "[string]$ReleaseTargetPath = ''",
        "[string]$RuntimeUrl = ''",
        "[string]$MainSyncTaskName = ''",
        "[string]$LogPath = '/var/log/sync-pielarmonia.log'",
        "[string]$DiagnosticsUrl = 'http://127.0.0.1/api.php?resource=health-diagnostics'",
        'sha256sum $WrapperPath $CanonicalWrapperPath',
        'cmp -s $WrapperPath $CanonicalWrapperPath && echo wrapper_match || echo wrapper_diff',
        'ls -ld $GeneratedSiteRoot $DeployBundlePath 2>/dev/null || true',
        'git status --short',
        'git rev-parse HEAD',
        'git rev-parse origin/main',
        'find $GeneratedSiteRoot -maxdepth 2 -type f | head -n 20',
        'find $DeployBundlePath -maxdepth 2 -type f | head -n 20',
        "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, repoHygieneIssue, ageSeconds, expectedMaxLagSeconds, lastCheckedAt, lastSuccessAt, lastErrorAt, failureReason, lastErrorMessage, currentHead, remoteHead, dirtyPathsCount, dirtyPathsSample}'",
        "curl -s $DiagnosticsUrl | jq '.checks.storage | {backend, source, encrypted, encryptionConfigured, encryptionRequired, encryptionStatus, encryptionCompliant}'",
        "curl -s $DiagnosticsUrl | jq '.checks.auth | {mode, status, configured, hardeningCompliant, recommendedMode, recommendedModeActive, twoFactorEnabled, operatorAuthEnabled, operatorAuthConfigured, legacyPasswordConfigured}'",
        "curl -s $base/api.php?resource=health",
        "curl -s $base/api.php?resource=health | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, failureReason, lastErrorMessage}'",
        'health publico sin checks.publicSync o sin jobId',
        "StatusPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync-status.json'",
        "ReleaseTargetPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.runtime.json'",
        "RuntimeUrl = 'http://127.0.0.1/__hosting/runtime'",
        "MainSyncTaskName = 'Pielarmonia Hosting Main Sync'",
        "((Invoke-WebRequest -UseBasicParsing -Uri '$RuntimeUrl').Content | ConvertFrom-Json) | ConvertTo-Json -Depth 4",
        "Get-Content -LiteralPath '$ReleaseTargetPath'",
        "Get-ScheduledTask -TaskName '$MainSyncTaskName' | Format-List TaskName,State,LastRunTime,LastTaskResult,NextRunTime",
        "pwsh -File .\\scripts\\ops\\setup\\SINCRONIZAR-HOSTING-WINDOWS.ps1 -StatusPath '$StatusPath' -ReleaseTargetPath '$ReleaseTargetPath'",
        'main-sync-status.json',
        '__hosting/runtime',
        'install -m 0755 $CanonicalWrapperPath $WrapperPath',
        '/usr/bin/flock -n $LockPath $WrapperPath',
        'si dirtyPathsSample solo muestra `.generated/site-root/**` o `_deploy_bundle/**`',
        'PIELARMONIA_DATA_ENCRYPTION_KEY',
        'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
        'health publico expone checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674',
        'checks.storage.encryptionCompliant=true',
        'checks.publicSync.telemetryGap=false',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet canonico en CHECKLIST-HOST-PUBLIC-SYNC.ps1: ${snippet}`
        );
    }
});

test('surface operativa documenta el checklist host-side de public sync', () => {
    const readme = load(README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const runbook = load(RUNBOOK_PATH);
    const requiredReadmeSnippets = [
        'CHECKLIST-HOST-PUBLIC-SYNC.ps1',
        'npm run checklist:prod:public-sync:host',
        'main-sync-status.json',
        'release-target.runtime.json',
        '__hosting/runtime',
        'storeEncryptionCompliant',
        '.generated/site-root/',
        '_deploy_bundle/',
    ];
    const requiredOperationsSnippets = [
        'npm run checklist:prod:public-sync:host',
        'CHECKLIST-HOST-PUBLIC-SYNC.ps1',
    ];
    const requiredRunbookSnippets = [
        'pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1',
        'storeEncryptionCompliant=true',
        'checks.publicSync.jobId',
        'main-sync-status.json',
        'release-target.runtime.json',
        '__hosting/runtime',
        '.generated/site-root/',
        '_deploy_bundle/',
    ];

    for (const snippet of requiredReadmeSnippets) {
        assert.equal(
            readme.includes(snippet),
            true,
            `README de prod ops debe documentar checklist host-side: ${snippet}`
        );
    }

    for (const snippet of requiredOperationsSnippets) {
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `Operations Index debe documentar checklist host-side: ${snippet}`
        );
    }

    for (const snippet of requiredRunbookSnippets) {
        assert.equal(
            runbook.includes(snippet),
            true,
            `Runbook debe enlazar checklist host-side: ${snippet}`
        );
    }
});

test('package.json expone checklist host-side como script npm canonico', () => {
    const pkg = JSON.parse(load(resolve(REPO_ROOT, 'package.json')));
    assert.equal(
        String(pkg.scripts?.['checklist:prod:public-sync:host'] || '').includes(
            './scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1'
        ),
        true,
        'package.json debe exponer checklist:prod:public-sync:host con el entrypoint canonico'
    );
});
