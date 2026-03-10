import test from 'node:test';
import assert from 'node:assert/strict';
import { readBuildMetadata } from '../src/config/store.mjs';

test('env overrides package defaults for surface-specific development', () => {
    const config = readBuildMetadata({
        TURNERO_DESKTOP_SURFACE: 'operator',
        TURNERO_BASE_URL: 'https://staging.pielarmonia.com',
        TURNERO_LAUNCH_MODE: 'windowed',
        TURNERO_STATION_MODE: 'locked',
        TURNERO_STATION: '2',
        TURNERO_ONE_TAP: 'true',
        TURNERO_AUTO_START: 'false',
    });

    assert.equal(config.surface, 'operator');
    assert.equal(config.baseUrl, 'https://staging.pielarmonia.com');
    assert.equal(config.launchMode, 'windowed');
    assert.equal(config.stationMode, 'locked');
    assert.equal(config.stationConsultorio, 2);
    assert.equal(config.oneTap, true);
    assert.equal(config.autoStart, false);
});
