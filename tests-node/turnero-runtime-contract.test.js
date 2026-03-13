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

test('shared turnero runtime contract normalizes operator shell state and query params', async () => {
    const contract = await importRepoModule(
        'src/apps/queue-shared/turnero-runtime-contract.mjs'
    );

    assert.equal(contract.normalizeLaunchMode('windowed'), 'windowed');
    assert.equal(contract.normalizeLaunchMode('anything'), 'fullscreen');
    assert.equal(contract.normalizeStationMode('locked'), 'locked');
    assert.equal(contract.normalizeStationMode('random'), 'free');
    assert.equal(contract.normalizeStationConsultorio(2), 2);
    assert.equal(contract.normalizeStationConsultorio(7), 1);
    assert.equal(contract.normalizeOneTap('yes', false), true);
    assert.equal(contract.normalizeAutoStart('off', true), false);
    assert.equal(contract.normalizeUpdateChannel('', 'beta'), 'stable');
    assert.equal(contract.normalizeUpdateChannel('', 'pilot'), 'pilot');
    assert.equal(contract.normalizeUpdateChannel('legacy', 'pilot'), 'pilot');
    assert.equal(contract.normalizeUpdateChannel('', ''), 'stable');

    const surfaceState = contract.buildOperatorSurfaceState({
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: 'yes',
    });

    assert.deepEqual(surfaceState, {
        stationConsultorio: 2,
        stationMode: 'locked',
        oneTap: true,
        locked: true,
        stationKey: 'c2',
        instance: 'c2',
    });

    const params = contract.applyOperatorSurfaceSearchParams(
        new URLSearchParams('surface=operator'),
        surfaceState
    );

    assert.equal(
        params.toString(),
        'surface=operator&station=c2&lock=1&one_tap=1'
    );
});

test('desktop turnero contracts reuse the shared operator query serialization', async () => {
    const contracts = await importRepoModule(
        'src/apps/turnero-desktop/src/config/contracts.mjs'
    );

    const config = contracts.createBuildConfig({
        surface: 'operator',
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: true,
    });

    assert.equal(
        contracts.createSurfaceUrl(config),
        'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    assert.equal(
        contracts.buildSupportGuideUrl(config, 'win32'),
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.equal(config.updateChannel, 'pilot');
});
