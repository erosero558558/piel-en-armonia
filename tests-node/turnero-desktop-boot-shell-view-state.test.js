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

test('boot shell view state composes packaged operator summary and support metadata', async () => {
    const viewState = await importRepoModule(
        'src/apps/turnero-desktop/src/renderer/boot-shell-view-state.mjs'
    );

    const snapshot = {
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            launchMode: 'windowed',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
            autoStart: false,
            updateChannel: 'stable',
        },
        phase: 'settings',
        message: 'Configura este equipo',
        surfaceLabel: 'Operador',
        surfaceDesktopLabel: 'Turnero Operador',
        packaged: true,
        platform: 'win32',
        version: '0.1.0',
        name: 'Turnero Operador',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/stable/operator/win/',
        configPath:
            'C:\\Users\\Ernesto\\AppData\\Roaming\\turnero-desktop\\turnero-desktop.json',
        firstRun: true,
        settingsMode: true,
    };

    assert.deepEqual(viewState.getBootConfigFormView(snapshot), {
        baseUrl: 'https://pielarmonia.com',
        profile: 'c2_locked',
        oneTap: true,
        launchMode: 'windowed',
        autoStart: false,
        operator: true,
    });

    const shellView = viewState.getBootShellView(snapshot);
    assert.equal(shellView.title, 'Configura este equipo');
    assert.equal(
        shellView.message,
        'Configura este equipo. Turnero Operador v0.1.0.'
    );
    assert.equal(shellView.surface, 'operator');
    assert.equal(shellView.baseUrl, 'https://pielarmonia.com');
    assert.equal(shellView.phase, 'settings');
    assert.equal(shellView.configMode, 'Primer arranque · Windows');
    assert.match(
        shellView.configHintHtml,
        /Mismo instalador para <code>C1<\/code>/
    );
    assert.equal(shellView.openSurfaceHidden, true);
    assert.equal(shellView.openSurfaceLabel, 'Abrir operador Windows');
    assert.equal(
        shellView.support.summary,
        'Windows · Desktop instalada · Canal stable · Config: C:\\Users\\Ernesto\\AppData\\Roaming\\turnero-desktop\\turnero-desktop.json. Confirma feed, guía y perfil local antes de clonar esta desktop en otra PC.'
    );
    assert.equal(shellView.support.profile, 'Operador C2 fijo · 1 tecla ON');
    assert.equal(shellView.support.provisioning, 'Ventana · Autoarranque OFF');
    assert.equal(
        shellView.support.feedUrl,
        'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        shellView.support.guideUrl,
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.equal(
        shellView.support.configPath,
        'C:\\Users\\Ernesto\\AppData\\Roaming\\turnero-desktop\\turnero-desktop.json'
    );
});

test('boot shell view state preserves development fallback and kiosk form defaults', async () => {
    const viewState = await importRepoModule(
        'src/apps/turnero-desktop/src/renderer/boot-shell-view-state.mjs'
    );

    const snapshot = {
        config: {
            surface: 'kiosk',
            baseUrl: 'https://demo.test',
            launchMode: 'fullscreen',
            oneTap: true,
            autoStart: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'loading',
            message: 'Conectando kiosk a https://demo.test',
        },
        surfaceLabel: 'Kiosco',
        packaged: false,
        platform: 'darwin',
        firstRun: false,
        settingsMode: false,
    };

    assert.deepEqual(viewState.getBootConfigFormView(snapshot), {
        baseUrl: 'https://demo.test',
        profile: 'free',
        oneTap: true,
        launchMode: 'fullscreen',
        autoStart: true,
        operator: false,
    });

    const shellView = viewState.getBootShellView(snapshot);
    assert.equal(shellView.title, 'Inicializando shell operativo');
    assert.equal(
        shellView.message,
        'Conectando kiosk a https://demo.test. Turnero Kiosco en validacion local.'
    );
    assert.equal(shellView.surface, 'kiosk');
    assert.equal(shellView.baseUrl, 'https://demo.test');
    assert.equal(shellView.phase, 'loading');
    assert.equal(shellView.configMode, 'Perfil persistido · macOS');
    assert.match(
        shellView.configHintHtml,
        /Desktop en desarrollo · Canal stable/
    );
    assert.equal(shellView.openSurfaceHidden, false);
    assert.equal(shellView.openSurfaceLabel, 'Abrir superficie');
    assert.equal(
        shellView.support.summary,
        'macOS · Desktop en desarrollo · Canal stable. Usa esta tarjeta para validar la configuración local aunque el updater nativo no aplique en desarrollo.'
    );
    assert.equal(shellView.support.profile, 'Turnero Kiosco');
    assert.equal(
        shellView.support.provisioning,
        'Pantalla completa · Autoarranque ON'
    );
    assert.equal(shellView.support.feedUrl, '');
    assert.equal(
        shellView.support.guideUrl,
        'https://demo.test/app-downloads/?surface=kiosk&platform=mac'
    );
    assert.equal(shellView.support.configPath, '');
});
