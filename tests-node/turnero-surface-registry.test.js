#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildTurneroCatalogDefaults,
    buildTurneroReleaseArtifactName,
    getTurneroSurfaceDefinition,
    listTurneroSurfaceDefinitions,
    normalizeTurneroSurfaceId,
    resolveTurneroUpdatePublicFeedPath,
} = require('../lib/turnero-surface-registry.js');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

test('turnero surface registry expone las superficies canonicas actuales', () => {
    const ids = listTurneroSurfaceDefinitions().map((surface) => surface.id);
    assert.deepEqual(ids, ['operator', 'kiosk', 'sala_tv']);
    assert.equal(
        normalizeTurneroSurfaceId('KIOSK', { family: 'desktop' }),
        'kiosk'
    );
    assert.equal(
        normalizeTurneroSurfaceId('desconocido', { family: 'desktop' }),
        'operator'
    );
});

test('turnero surface registry resuelve metadata y rutas publicas desde una sola fuente', () => {
    const operator = getTurneroSurfaceDefinition('operator');
    assert.equal(operator.productName, 'Turnero Operador');
    assert.equal(operator.ops.installHub.recommendedFor, 'PC operador');
    assert.equal(operator.ops.telemetry.title, 'Operador');
    assert.equal(
        resolveTurneroUpdatePublicFeedPath('operator', 'win'),
        '/desktop-updates/pilot/operator/win/latest.yml'
    );
    assert.equal(
        buildTurneroReleaseArtifactName('sala_tv', 'android_tv'),
        'turnero-android-sala-tv-android-tv'
    );
});

test('turnero surface registry genera defaults del catalogo sin hardcodes paralelos', () => {
    const catalog = buildTurneroCatalogDefaults();
    assert.equal(
        catalog.operator.targets.win.url,
        '/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe'
    );
    assert.equal(
        catalog.kiosk.targets.mac.url,
        '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg'
    );
    assert.equal(
        catalog.sala_tv.targets.android_tv.url,
        '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk'
    );
    assert.equal(
        getTurneroSurfaceDefinition('sala_tv').ops.installHub.recommendedFor,
        'TCL C655 / Google TV'
    );
});

test('turnero surface registry source normaliza el manifest apps object-shaped', async () => {
    const registrySourceModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-registry-source.js'
    );

    const objectShapedManifest = {
        schema: 'turnero-release-bundle/v1',
        version: '2026.03.20',
        apps: {
            operator: {
                version: '1.0.0',
                files: ['operator.js'],
                targets: {
                    web: { url: '/operator.js' },
                },
            },
            kiosk: {
                version: '1.0.0',
                files: ['kiosk.js'],
                targets: {
                    web: { url: '/kiosk.js' },
                },
            },
            sala_tv: {
                version: '1.0.0',
                files: ['display.js'],
                targets: {
                    web: { url: '/display.js' },
                },
            },
        },
    };
    const normalized =
        registrySourceModule.normalizeManifestPayload(objectShapedManifest);

    assert.equal(normalized.apps.operator.id, 'operator');
    assert.equal(normalized.apps.operator.key, 'operator');
    assert.equal(normalized.apps.operator.enabled, true);
    assert.equal(normalized.apps.kiosk.targets.web.url, '/kiosk.js');
    assert.equal(normalized.apps.kiosk.label, 'kiosk');
    assert.equal(normalized.apps.sala_tv.id, 'sala_tv');
});
