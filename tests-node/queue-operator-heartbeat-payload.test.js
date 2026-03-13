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

test('operator heartbeat payload carries desktop shell metadata for locked stations', async () => {
    const heartbeatModule = await importRepoModule(
        'src/apps/queue-operator/heartbeat-payload.mjs'
    );

    const payload = heartbeatModule.buildOperatorHeartbeatPayload({
        queueState: {
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
        },
        online: true,
        appMode: 'desktop',
        syncHealth: {
            syncMode: 'live',
            fallbackPartial: false,
            degraded: false,
        },
        numpadStatus: {
            callKeyLabel: 'Numpad Enter',
            ready: true,
            seen: true,
            validatedCount: 4,
            requiredCount: 4,
            pendingLabels: [],
            label: 'Numpad listo',
            summary: 'Numpad listo · Numpad Enter, +, .,-',
            lastCode: 'NumpadSubtract',
            lastAt: '2026-03-12T14:00:00.000Z',
        },
        shell: {
            available: true,
            packaged: true,
            name: 'Turnero Operador',
            version: '0.1.0',
            platform: 'win32',
            updateChannel: 'stable',
            launchMode: 'windowed',
            autoStart: false,
            statusPhase: 'ready',
            statusLevel: 'info',
            statusPercent: 0,
            statusVersion: '0.1.0',
            updateFeedUrl:
                'https://pielarmonia.com/desktop-updates/stable/operator/win/',
            updateMetadataUrl:
                'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml',
            installGuideUrl:
                'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
            configPath:
                'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
            statusMessage: 'Operador listo',
        },
        now: '2026-03-12T14:01:00.000Z',
    });

    assert.equal(payload.instance, 'c2');
    assert.equal(payload.deviceLabel, 'Operador C2 fijo');
    assert.equal(payload.appMode, 'desktop');
    assert.equal(payload.status, 'ready');
    assert.equal(payload.summary, 'Equipo listo para operar en C2 fijo.');
    assert.equal(payload.networkOnline, true);
    assert.equal(payload.lastEvent, 'numpad_detected');
    assert.equal(payload.lastEventAt, '2026-03-12T14:00:00.000Z');
    assert.equal(payload.details.station, 'c2');
    assert.equal(payload.details.stationMode, 'locked');
    assert.equal(payload.details.oneTap, true);
    assert.equal(payload.details.queueSyncMode, 'live');
    assert.equal(payload.details.shellLaunchMode, 'windowed');
    assert.equal(payload.details.shellAutoStart, false);
    assert.equal(payload.details.shellPackaged, true);
    assert.equal(
        payload.details.shellUpdateMetadataUrl,
        'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        payload.details.shellInstallGuideUrl,
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
});

test('operator heartbeat payload degrades gracefully when fallback web is offline and numpad is incomplete', async () => {
    const heartbeatModule = await importRepoModule(
        'src/apps/queue-operator/heartbeat-payload.mjs'
    );

    const payload = heartbeatModule.buildOperatorHeartbeatPayload({
        queueState: {
            stationMode: 'free',
            stationConsultorio: 1,
            oneTap: false,
        },
        online: false,
        appMode: 'web',
        syncHealth: {
            syncMode: 'fallback',
            fallbackPartial: true,
            degraded: true,
        },
        numpadStatus: {
            callKeyLabel: 'Numpad Enter',
            ready: false,
            seen: false,
            validatedCount: 1,
            requiredCount: 4,
            pendingLabels: ['+', '.', '-'],
            label: 'Numpad 1/4',
            summary: 'Numpad 1/4 · faltan +, . y -',
            lastCode: '',
            lastAt: '',
        },
        shell: {
            available: false,
        },
        now: '2026-03-12T14:05:00.000Z',
    });

    assert.equal(payload.instance, 'free');
    assert.equal(payload.deviceLabel, 'Operador modo libre');
    assert.equal(payload.appMode, 'web');
    assert.equal(payload.status, 'alert');
    assert.equal(
        payload.summary,
        'Equipo sin red; recupera conectividad antes de operar.'
    );
    assert.equal(payload.networkOnline, false);
    assert.equal(payload.lastEvent, 'heartbeat');
    assert.equal(payload.lastEventAt, '2026-03-12T14:05:00.000Z');
    assert.equal(payload.details.station, 'c1');
    assert.equal(payload.details.stationMode, 'free');
    assert.equal(payload.details.oneTap, false);
    assert.equal(payload.details.queueSyncMode, 'fallback');
    assert.equal(payload.details.queueFallbackPartial, true);
    assert.equal(payload.details.numpadReady, false);
    assert.equal(payload.details.shellMode, 'web');
    assert.ok(!Object.hasOwn(payload.details, 'shellLaunchMode'));
    assert.ok(!Object.hasOwn(payload.details, 'shellAutoStart'));
});
