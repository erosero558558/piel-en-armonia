#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

test('desktop snapshot contract normalizes operator form payloads into runtime patch and launch url', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/snapshot-contract.mjs'
    );

    const runtimePatch = contract.buildDesktopRuntimePatchFromForm({
        surface: 'operator',
        baseUrl: 'https://pielarmonia.com',
        profile: 'c2_locked',
        launchMode: 'windowed',
        autoStart: false,
        oneTap: true,
    });

    assert.deepEqual(runtimePatch, {
        surface: 'operator',
        baseUrl: 'https://pielarmonia.com',
        launchMode: 'windowed',
        autoStart: false,
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: true,
    });
    assert.equal(
        contract.buildDesktopLaunchUrl(runtimePatch),
        'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    assert.equal(contract.getDesktopOperatorProfile(runtimePatch), 'c2_locked');
});

test('desktop snapshot contract normalizes kiosk context and launch urls without operator params', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/snapshot-contract.mjs'
    );

    const runtimePatch = contract.buildDesktopRuntimePatchFromForm({
        surface: 'kiosk',
        baseUrl: 'https://demo.pielarmonia.com',
        profile: 'c2_locked',
        launchMode: 'fullscreen',
        autoStart: true,
        oneTap: true,
    });
    const surfaceContext = contract.getDesktopSurfaceContext(runtimePatch);

    assert.deepEqual(runtimePatch, {
        surface: 'kiosk',
        baseUrl: 'https://demo.pielarmonia.com',
        launchMode: 'fullscreen',
        autoStart: true,
        stationMode: 'free',
        stationConsultorio: 1,
        oneTap: false,
    });
    assert.deepEqual(surfaceContext, {
        surface: 'kiosk',
        instance: 'main',
        deviceLabel: 'Kiosco local',
        station: 'c1',
        stationMode: 'free',
        stationConsultorio: 1,
        locked: false,
        oneTap: false,
    });
    assert.equal(
        contract.buildDesktopLaunchUrl(runtimePatch),
        'https://demo.pielarmonia.com/kiosco-turnos.html'
    );
});

test('desktop snapshot contract keeps preflight gate and fingerprint stable across packaged and dev modes', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/snapshot-contract.mjs'
    );

    const snapshot = {
        packaged: true,
        config: {
            surface: 'operator',
        },
    };
    const runtimePatch = contract.buildDesktopRuntimePatchFromForm({
        surface: 'operator',
        baseUrl: 'https://pielarmonia.com',
        profile: 'free',
        launchMode: 'fullscreen',
        autoStart: true,
        oneTap: false,
    });
    const fingerprint = contract.buildDesktopPreflightFingerprint(
        snapshot,
        runtimePatch
    );

    assert.equal(
        contract.getDesktopPreflightGateState({
            snapshot,
            preflightRunning: true,
            currentFingerprint: fingerprint,
        }).detail,
        'Espera a que termine la comprobación antes de abrir la superficie.'
    );
    assert.equal(
        contract.getDesktopPreflightGateState({
            snapshot,
            preflightReport: {
                state: 'danger',
            },
            preflightFingerprint: fingerprint,
            currentFingerprint: fingerprint,
        }).state,
        'danger'
    );
    assert.deepEqual(
        contract.getDesktopPreflightGateState({
            snapshot: {
                packaged: false,
                config: {
                    surface: 'operator',
                },
            },
            currentFingerprint: fingerprint,
        }),
        {
            blocked: false,
            state: 'warning',
            detail: 'El checklist remoto completo se valida solo en desktop instalada; en desarrollo puedes continuar.',
        }
    );
});

test('desktop snapshot contract builds a shared runtime snapshot base with labels, support urls and retry snapshot', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/snapshot-contract.mjs'
    );

    const snapshot = contract.buildDesktopRuntimeSnapshotBase({
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'settings',
            message: 'Configuracion local abierta.',
        },
        packaged: true,
        platform: 'win32',
        arch: 'x64',
        version: '0.1.0',
        name: 'Turnero Operador',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/stable/operator/win/',
        updateMetadataUrl: '',
        installGuideUrl: '',
        configPath:
            'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
        retry: {
            active: true,
            attempt: 2,
            delayMs: 5000,
            nextRetryAt: '2026-03-11T20:00:05.000Z',
            remainingMs: 5000,
            reason: 'No se pudo abrir la superficie operator',
        },
        firstRun: false,
        settingsMode: true,
    });

    assert.equal(snapshot.surfaceId, 'operator');
    assert.equal(snapshot.surfaceLabel, 'Operador');
    assert.equal(snapshot.surfaceDesktopLabel, 'Turnero Operador');
    assert.equal(snapshot.appMode, 'packaged');
    assert.equal(
        snapshot.updateMetadataUrl,
        'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        snapshot.installGuideUrl,
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.equal(snapshot.retry.active, true);
    assert.equal(snapshot.retry.attempt, 2);
    assert.equal(snapshot.retry.remainingMs, 5000);
});
