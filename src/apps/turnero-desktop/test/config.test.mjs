import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSupportGuideUrl,
    buildGenericUpdateProvider,
    buildUpdateFeedUrl,
    buildUpdateMetadataUrl,
    createBuildConfig,
    createSurfaceUrl,
    getSurfaceRoute,
    mergeRuntimeConfig,
} from '../src/config/contracts.mjs';

test('operator defaults point to production operator route', () => {
    const config = createBuildConfig({ surface: 'operator' });
    assert.equal(config.surface, 'operator');
    assert.equal(config.updateChannel, 'pilot');
    assert.equal(getSurfaceRoute(config.surface), '/operador-turnos.html');
    assert.equal(
        createSurfaceUrl(config),
        'https://pielarmonia.com/operador-turnos.html?station=c1&lock=0&one_tap=0'
    );
});

test('runtime config keeps build surface fixed', () => {
    const buildConfig = createBuildConfig({ surface: 'operator' });
    const merged = mergeRuntimeConfig(buildConfig, {
        surface: 'kiosk',
        baseUrl: 'https://example.test',
        launchMode: 'windowed',
        autoStart: false,
    });
    assert.equal(merged.surface, 'operator');
    assert.equal(merged.baseUrl, 'https://example.test');
    assert.equal(merged.launchMode, 'windowed');
    assert.equal(merged.stationMode, 'free');
    assert.equal(merged.stationConsultorio, 1);
    assert.equal(merged.oneTap, false);
    assert.equal(merged.autoStart, false);
});

test('operator runtime config can lock consultorio and one tap for fixed stations', () => {
    const buildConfig = createBuildConfig({ surface: 'operator' });
    const merged = mergeRuntimeConfig(buildConfig, {
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: true,
    });

    assert.equal(merged.stationMode, 'locked');
    assert.equal(merged.stationConsultorio, 2);
    assert.equal(merged.oneTap, true);
    assert.equal(
        createSurfaceUrl(merged),
        'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    assert.equal(
        buildSupportGuideUrl(merged, 'win32'),
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
});

test('update feed url resolves stable channel by surface and platform', () => {
    const config = createBuildConfig({
        surface: 'operator',
        updateChannel: 'stable',
        updateBaseUrl: 'https://updates.pielarmonia.com/desktop/',
    });
    assert.equal(
        buildUpdateFeedUrl(config, 'darwin'),
        'https://updates.pielarmonia.com/desktop/stable/operator/mac/'
    );
    assert.equal(
        buildUpdateFeedUrl(config, 'win32'),
        'https://updates.pielarmonia.com/desktop/stable/operator/win/'
    );
    assert.equal(
        buildUpdateMetadataUrl(config, 'win32'),
        'https://updates.pielarmonia.com/desktop/stable/operator/win/latest.yml'
    );
});

test('generic update provider keeps stable path without forcing stable.yml metadata', () => {
    const config = createBuildConfig({
        surface: 'operator',
        updateChannel: 'stable',
        updateBaseUrl: 'https://updates.pielarmonia.com/desktop/',
    });

    assert.deepEqual(buildGenericUpdateProvider(config, 'win32'), {
        provider: 'generic',
        url: 'https://updates.pielarmonia.com/desktop/stable/operator/win/',
    });
});

test('operator build config defaults to pilot update channel for the Windows rollout', () => {
    const config = createBuildConfig({
        surface: 'operator',
        updateBaseUrl: 'https://updates.pielarmonia.com/desktop/',
    });

    assert.equal(
        buildUpdateFeedUrl(config, 'win32'),
        'https://updates.pielarmonia.com/desktop/pilot/operator/win/'
    );
    assert.equal(
        buildUpdateMetadataUrl(config, 'win32'),
        'https://updates.pielarmonia.com/desktop/pilot/operator/win/latest.yml'
    );
});

test('support guide url follows platform and strips operator-only params for kiosk', () => {
    const config = createBuildConfig({
        surface: 'kiosk',
        baseUrl: 'https://demo.pielarmonia.com',
    });

    assert.equal(
        buildSupportGuideUrl(config, 'darwin'),
        'https://demo.pielarmonia.com/app-downloads/?surface=kiosk&platform=mac'
    );
});
