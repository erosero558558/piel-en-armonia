import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildUpdateFeedUrl,
    createBuildConfig,
    createSurfaceUrl,
    getSurfaceRoute,
    mergeRuntimeConfig,
} from '../src/config/contracts.mjs';

test('operator defaults point to production operator route', () => {
    const config = createBuildConfig({ surface: 'operator' });
    assert.equal(config.surface, 'operator');
    assert.equal(getSurfaceRoute(config.surface), '/operador-turnos.html');
    assert.equal(createSurfaceUrl(config), 'https://pielarmonia.com/operador-turnos.html');
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
    assert.equal(merged.autoStart, false);
});

test('update feed url resolves stable channel by surface and platform', () => {
    const config = createBuildConfig({
        surface: 'operator',
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
});
