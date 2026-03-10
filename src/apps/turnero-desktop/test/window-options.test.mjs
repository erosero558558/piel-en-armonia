import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getBrowserWindowOptions,
    shouldPreventDisplaySleep,
    shouldUseKioskMode,
} from '../src/runtime/window-options.mjs';

test('kiosk fullscreen uses kiosk mode and prevents display sleep', () => {
    const options = getBrowserWindowOptions(
        { surface: 'kiosk', launchMode: 'fullscreen' },
        '/tmp/preload.cjs',
        { packaged: false }
    );
    assert.equal(shouldUseKioskMode({ surface: 'kiosk', launchMode: 'fullscreen' }), true);
    assert.equal(options.kiosk, true);
    assert.equal(options.fullscreen, true);
    assert.equal(options.webPreferences.devTools, true);
    assert.equal(options.webPreferences.preload, '/tmp/preload.cjs');
    assert.equal(shouldPreventDisplaySleep({ surface: 'kiosk' }), true);
});

test('operator keeps windowed fallback without kiosk lock', () => {
    const options = getBrowserWindowOptions(
        { surface: 'operator', launchMode: 'windowed' },
        '/tmp/preload.cjs',
        { packaged: true }
    );
    assert.equal(shouldPreventDisplaySleep({ surface: 'operator' }), false);
    assert.equal(options.kiosk, false);
    assert.equal(options.fullscreen, false);
    assert.equal(options.frame, true);
    assert.equal(options.webPreferences.devTools, false);
});
