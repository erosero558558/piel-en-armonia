import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    OFFLINE_SNAPSHOT_MAX_AGE_MS,
    createShellStateStore,
} from '../src/runtime/shell-state.mjs';

function createTempStore(t, runtimeConfig = {}) {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-shell-state-')
    );
    const filePath = path.join(directory, 'turnero-shell-state.json');

    t.after(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    return createShellStateStore(filePath, () => runtimeConfig);
}

function createSnapshot(savedAt) {
    return {
        healthy: true,
        snapshot: {
            queueTickets: [
                {
                    id: 1,
                    ticketCode: 'A-001',
                    status: 'waiting',
                    assignedConsultorio: null,
                },
            ],
            queueMeta: {
                waitingCount: 1,
                calledCount: 0,
                updatedAt: savedAt,
            },
            station: 'c1',
            savedAt,
        },
    };
}

test('shell state normalizes operator update channel to pilot or stable', (t) => {
    const pilotStore = createTempStore(t, { updateChannel: 'pilot' });
    assert.equal(pilotStore.getStatus().updateChannel, 'pilot');

    const stableStore = createTempStore(t, { updateChannel: 'legacy' });
    assert.equal(stableStore.getStatus().updateChannel, 'stable');
});

test('shell state enables offline mode only with prior auth and fresh snapshot', (t) => {
    const store = createTempStore(t, { updateChannel: 'pilot' });
    const now = new Date().toISOString();

    store.markSessionAuthenticated({
        authenticated: true,
        at: now,
    });
    store.saveOfflineSnapshot(createSnapshot(now));
    store.reportShellState({ connectivity: 'offline' });

    const status = store.getStatus();
    assert.equal(status.mode, 'offline');
    assert.equal(status.offlineEnabled, true);
    assert.equal(status.updateChannel, 'pilot');
});

test('shell state drops to safe mode when snapshot expires', (t) => {
    const store = createTempStore(t);
    const staleAt = new Date(
        Date.now() - OFFLINE_SNAPSHOT_MAX_AGE_MS - 2000
    ).toISOString();

    store.markSessionAuthenticated({
        authenticated: true,
        at: staleAt,
    });
    store.saveOfflineSnapshot(createSnapshot(staleAt));
    store.reportShellState({ connectivity: 'offline' });

    const status = store.getStatus();
    assert.equal(status.mode, 'safe');
    assert.equal(status.offlineEnabled, false);
    assert.equal(status.reason, 'snapshot_expired');
});

test('shell state blocks offline mode while reconciliation is pending', (t) => {
    const store = createTempStore(t);
    const now = new Date().toISOString();

    store.markSessionAuthenticated({
        authenticated: true,
        at: now,
    });
    store.saveOfflineSnapshot(createSnapshot(now));
    store.reportShellState({ connectivity: 'offline' });
    store.enqueueQueueAction({
        idempotencyKey: 'call-next-1',
        type: 'call_next',
        ticketId: 1,
        station: 'c1',
        createdAt: now,
    });
    store.flushQueueOutbox({
        conflicts: [
            {
                idempotencyKey: 'call-next-1',
                type: 'call_next',
                ticketId: 1,
                station: 'c1',
                createdAt: now,
                reason: 'Ticket ya atendido remotamente',
                failedAt: now,
            },
        ],
    });

    const status = store.getStatus();
    assert.equal(status.mode, 'safe');
    assert.equal(status.offlineEnabled, false);
    assert.equal(status.reason, 'reconciliation_pending');
    assert.equal(status.reconciliationSize, 1);
});
