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

function installLocalStorageMock() {
    const store = new Map();
    global.localStorage = {
        getItem(key) {
            return store.has(String(key)) ? store.get(String(key)) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
    };
}

test('surface sync snapshot normalizes visible fields and preserves explicit queueVersion', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-sync-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceSyncSnapshot({
        surfaceKey: 'operator:c1',
        queueVersion: '2026-03-20T10:00:00.000Z',
        visibleTurn: 'a-001',
        announcedTurn: 'a-001',
        handoffState: 'clear',
        heartbeat: {
            state: 'ready',
            channel: 'desktop',
        },
        updatedAt: '2026-03-20T10:00:00.000Z',
    });

    assert.equal(snapshot.surfaceKey, 'operator:c1');
    assert.equal(snapshot.queueVersion, '2026-03-20T10:00:00.000Z');
    assert.equal(snapshot.visibleTurn, 'A-001');
    assert.equal(snapshot.announcedTurn, 'A-001');
    assert.equal(snapshot.handoffState, 'clear');
    assert.equal(snapshot.heartbeatState, 'ready');
    assert.equal(snapshot.heartbeatChannel, 'desktop');
});

test('surface sync queueVersion falls back to deterministic fingerprint when updatedAt is missing', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-sync-snapshot.js'
    );

    const baseInput = {
        counts: {
            waiting: 2,
            called: 1,
        },
        callingNow: [
            {
                id: 1,
                ticketCode: 'A-010',
                assignedConsultorio: 1,
                calledAt: '2026-03-20T10:00:00.000Z',
            },
        ],
        nextTickets: [
            {
                id: 2,
                ticketCode: 'A-011',
                position: 1,
            },
        ],
    };

    const firstVersion =
        snapshotModule.resolveTurneroSurfaceSyncQueueVersion(baseInput);
    const secondVersion =
        snapshotModule.resolveTurneroSurfaceSyncQueueVersion(baseInput);
    const changedVersion = snapshotModule.resolveTurneroSurfaceSyncQueueVersion(
        {
            ...baseInput,
            nextTickets: [
                {
                    id: 3,
                    ticketCode: 'A-099',
                    position: 1,
                },
            ],
        }
    );

    assert.equal(firstVersion, secondVersion);
    assert.notEqual(firstVersion, changedVersion);
});

test('surface sync pack covers aligned and blocked states with gate transitions', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-sync-pack.js'
    );

    const alignedPack = packModule.buildTurneroSurfaceSyncPack({
        surfaceKey: 'kiosk',
        queueVersion: '2026-03-20T10:00:00.000Z',
        visibleTurn: 'A-010',
        announcedTurn: 'A-010',
        handoffState: 'clear',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live',
        },
        updatedAt: '2026-03-20T10:00:00.000Z',
        expectedVisibleTurn: 'A-010',
        expectedQueueVersion: '2026-03-20T10:00:00.000Z',
        handoffs: [],
    });
    assert.equal(alignedPack.drift.state, 'aligned');
    assert.equal(alignedPack.gate.band, 'ready');

    const blockedPack = packModule.buildTurneroSurfaceSyncPack({
        surfaceKey: 'display',
        visibleTurn: '',
        announcedTurn: '',
        handoffState: 'unknown',
        heartbeat: {
            state: 'unknown',
            channel: 'unknown',
        },
        expectedVisibleTurn: 'A-055',
        expectedQueueVersion: '2026-03-20T10:00:00.000Z',
        handoffs: [
            {
                id: 'handoff_1',
                surfaceKey: 'display',
                status: 'open',
            },
        ],
    });
    assert.equal(blockedPack.drift.state, 'blocked');
    assert.equal(blockedPack.drift.severity, 'high');
    assert.equal(blockedPack.gate.band, 'blocked');
});

test('surface handoff ledger is clinic-scoped and can filter by surface key', async () => {
    installLocalStorageMock();
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-handoff-ledger.js'
    );

    const clinicA = { clinic_id: 'clinic-a' };
    const clinicB = { clinic_id: 'clinic-b' };
    const ledgerA = ledgerModule.createTurneroSurfaceHandoffLedger(
        'ops',
        clinicA
    );
    const ledgerB = ledgerModule.createTurneroSurfaceHandoffLedger(
        'ops',
        clinicB
    );

    const first = ledgerA.add({
        surfaceKey: 'kiosk',
        title: 'Printer pending',
        note: 'Validar térmica antes de abrir.',
    });
    ledgerA.add({
        surfaceKey: 'operator:c1',
        title: 'Station handoff',
        note: 'Confirmar teclado de C1.',
    });

    assert.equal(
        ledgerA.list({ includeClosed: false, surfaceKey: 'kiosk' }).length,
        1
    );
    assert.equal(ledgerA.list({ includeClosed: false }).length, 2);
    assert.equal(ledgerB.list({ includeClosed: false }).length, 0);

    ledgerA.close(first.id);
    assert.equal(
        ledgerA.list({ includeClosed: false, surfaceKey: 'kiosk' }).length,
        0
    );
    assert.equal(
        ledgerModule.resolveTurneroSurfaceHandoffState(
            ledgerA.list({ includeClosed: false })
        ),
        'open'
    );
});
