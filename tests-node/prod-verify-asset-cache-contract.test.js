#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const VERIFY_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);

const raw = readFileSync(VERIFY_PATH, 'utf8');

test('prod verify usa refs remotas para cache-header de estilos publicados', () => {
    for (const snippet of [
        '$criticalCssRemoteUrl = Get-Url -Base $base -Ref $remoteStyleRef',
        '$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $remoteDeferredStyleRef',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring remoto en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }

    for (const legacySnippet of [
        '$criticalCssRemoteUrl = Get-Url -Base $base -Ref $localStyleRef',
        '$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $localDeferredStyleRef',
    ]) {
        assert.equal(
            raw.includes(legacySnippet),
            false,
            `VERIFICAR-DESPLIEGUE.ps1 no debe usar refs locales para cache-header remoto: ${legacySnippet}`
        );
    }
});
test('prod verify agrega assets GitHub de deploy para incidentes de transporte y conectividad', () => {
    for (const snippet of [
        '$githubDeployAlerts = Get-GitHubProductionAlertSummary',
        "Asset = 'github-deploy-alerts-open'",
        "Asset = 'github-deploy-transport-blocked'",
        "Asset = 'github-deploy-connectivity-blocked'",
        "Asset = 'github-deploy-repair-git-sync-blocked'",
        "Asset = 'github-deploy-self-hosted-runner-blocked'",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring GitHub deploy alerts en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod verify expone parity admin/operator contra service worker y falla con nombres canonicos', () => {
    for (const snippet of [
        '$adminSurfaceUrl = "$base/admin.html"',
        '$serviceWorkerUrl = "$base/sw.js"',
        '$adminSurfaceAssetList = @(',
        "'admin-v3.css'",
        "'js/admin-preboot-shortcuts.js'",
        '$operatorSurfaceAssetList = @(',
        "'js/queue-operator.js'",
        '$serviceWorkerCacheName = Get-ServiceWorkerCacheName',
        "Compare-AssetVersionMaps -ParityKey 'admin_shell_vs_sw'",
        "Compare-AssetVersionMaps -ParityKey 'operator_shell_vs_sw'",
        "Asset = 'admin-sw-version-drift'",
        "Asset = 'operator-sw-version-drift'",
        '$adminSurfaceParityReport = [ordered]@{',
        'adminShellVsSwOk = $adminSurfaceVsSwOk',
        'operatorShellVsSwOk = $operatorSurfaceVsSwOk',
        'cacheName = $serviceWorkerCacheName',
        'adminSurfaceParity = [pscustomobject]$adminSurfaceParityReport',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta parity admin/operator->sw en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});
