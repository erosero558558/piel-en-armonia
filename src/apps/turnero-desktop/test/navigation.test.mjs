import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNavigationPolicy,
    isAllowedNavigation,
} from '../src/runtime/navigation.mjs';

test('navigation allows same surface with hash and query', () => {
    const allowed = 'https://pielarmonia.com/kiosco-turnos.html';
    assert.equal(
        isAllowedNavigation(
            'https://pielarmonia.com/kiosco-turnos.html?station=1#ready',
            allowed
        ),
        true
    );
});

test('navigation blocks origin and path changes', () => {
    const policy = createNavigationPolicy({
        surface: 'operator',
        baseUrl: 'https://pielarmonia.com',
    });
    assert.equal(
        policy.isAllowedNavigation('https://pielarmonia.com/operador-turnos.html'),
        true
    );
    assert.equal(policy.isAllowedNavigation('https://pielarmonia.com/'), false);
    assert.equal(policy.isAllowedNavigation('https://example.com/operador-turnos.html'), false);
});
