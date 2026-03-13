import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildScheduledRetryState,
    createEmptyRetryState,
    getRetryRemainingMs,
    getRetrySnapshot,
} from '../src/runtime/retry-state.mjs';

test('buildScheduledRetryState programa intento y nextRetryAt', () => {
    const retryState = buildScheduledRetryState({
        retryCount: 1,
        delayMs: 5000,
        reason: 'No se pudo abrir operador',
        now: Date.parse('2026-03-12T05:00:00.000Z'),
    });

    assert.equal(retryState.active, true);
    assert.equal(retryState.attempt, 2);
    assert.equal(retryState.delayMs, 5000);
    assert.equal(retryState.reason, 'No se pudo abrir operador');
    assert.equal(retryState.nextRetryAt, '2026-03-12T05:00:05.000Z');
});

test('getRetrySnapshot calcula remainingMs y normaliza estado vacio', () => {
    const empty = getRetrySnapshot(createEmptyRetryState());
    assert.deepEqual(empty, {
        active: false,
        attempt: 0,
        delayMs: 0,
        nextRetryAt: '',
        reason: '',
        remainingMs: 0,
    });

    const scheduled = buildScheduledRetryState({
        retryCount: 0,
        delayMs: 3000,
        reason: 'Surface offline',
        now: Date.parse('2026-03-12T05:10:00.000Z'),
    });
    assert.equal(
        getRetryRemainingMs(scheduled, Date.parse('2026-03-12T05:10:01.500Z')),
        1500
    );

    const snapshot = getRetrySnapshot(
        scheduled,
        Date.parse('2026-03-12T05:10:02.000Z')
    );
    assert.equal(snapshot.active, true);
    assert.equal(snapshot.attempt, 1);
    assert.equal(snapshot.remainingMs, 1000);
});
