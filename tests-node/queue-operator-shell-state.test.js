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

test('operator shell state hydrates desktop snapshot and keeps support metadata stable', async () => {
    const shellState = await importRepoModule(
        'src/apps/queue-operator/shell-state.mjs'
    );

    const hydrated = shellState.hydrateOperatorShellState({
        packaged: true,
        appMode: 'packaged',
        version: '0.1.0',
        name: 'Turnero Operador',
        platform: 'win32',
        arch: 'x64',
        configPath:
            'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/stable/operator/win/',
        installGuideUrl:
            'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
        config: {
            launchMode: 'windowed',
            autoStart: false,
            updateChannel: 'stable',
        },
        status: {
            phase: 'ready',
            message: 'Operador listo',
        },
    });

    assert.equal(hydrated.launchMode, 'windowed');
    assert.equal(hydrated.autoStart, false);
    assert.equal(hydrated.updateChannel, 'stable');
    assert.equal(
        shellState.buildOperatorShellUpdateMetadataUrl(hydrated),
        'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        shellState.getOperatorShellSupportLabel(hydrated),
        'Feed https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml · Guía https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1 · Config C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json'
    );

    assert.deepEqual(shellState.getOperatorShellSettingsButtonCopy(hydrated), {
        text: 'Configurar este equipo (F10)',
        title: 'Reabre la configuración local de Turnero Operador (Windows). Atajos: F10 o Ctrl/Cmd + ,',
    });
});

test('operator shell labels keep fallback, download and error copy stable', async () => {
    const shellState = await importRepoModule(
        'src/apps/queue-operator/shell-state.mjs'
    );

    const fallback = shellState.createEmptyOperatorShellState();
    assert.equal(
        shellState.getOperatorShellModeLabel(fallback),
        'Usando navegador'
    );
    assert.equal(
        shellState.getOperatorShellMetaLabel(fallback),
        'La app del equipo ayuda con arranque automático, actualizaciones y ajustes locales.'
    );
    assert.deepEqual(shellState.getOperatorShellReadiness(fallback), {
        state: 'warning',
        detail: 'Estás usando navegador. La app del equipo ayuda con arranque automático y actualizaciones.',
    });

    const download = shellState.hydrateOperatorShellState({
        packaged: true,
        version: '0.1.0',
        name: 'Turnero Operador',
        platform: 'win32',
        config: {
            launchMode: 'fullscreen',
            autoStart: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'download',
            message: 'Descargando update 42%',
            percent: 42,
            version: '0.2.0',
        },
    });

    assert.equal(
        shellState.getOperatorShellModeLabel(download),
        'App del equipo lista · Actualización 42%'
    );
    assert.match(
        shellState.getOperatorShellMetaLabel(download),
        /Descargando update 42%/
    );
    assert.equal(
        shellState.getOperatorShellReadiness(download).state,
        'warning'
    );

    const failure = shellState.hydrateOperatorShellState({
        packaged: true,
        version: '0.1.0',
        name: 'Turnero Operador',
        platform: 'win32',
        config: {
            launchMode: 'fullscreen',
            autoStart: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'error',
            level: 'error',
            message: 'Update fallida',
        },
    });

    assert.equal(
        shellState.getOperatorShellStatusLabel(failure),
        'Actualización con error'
    );
    assert.equal(
        shellState.getOperatorShellStatusDetail(failure),
        'Update fallida'
    );
    assert.equal(shellState.getOperatorShellReadiness(failure).state, 'danger');
});

test('operator shell support derives feed and guide urls from runtime config when snapshot metadata is absent', async () => {
    const shellState = await importRepoModule(
        'src/apps/queue-operator/shell-state.mjs'
    );

    const hydrated = shellState.hydrateOperatorShellState({
        packaged: true,
        version: '0.1.0',
        name: 'Turnero Operador',
        platform: 'win32',
        configPath:
            'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/stable/operator/win/',
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
            launchMode: 'fullscreen',
            autoStart: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'ready',
            message: 'Operador listo',
        },
    });

    assert.equal(
        shellState.getOperatorShellSupportLabel(hydrated),
        'Feed https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml · Guía https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1 · Config C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json'
    );
});
