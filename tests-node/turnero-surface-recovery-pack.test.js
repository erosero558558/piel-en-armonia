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
            const normalizedKey = String(key);
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
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

installLocalStorageMock();

test.beforeEach(() => {
    global.localStorage.clear();
});

const CLINIC_PROFILE = Object.freeze({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clínica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    release: {
        mode: 'suite_v2',
        notes: [],
    },
    region: 'sierra',
    runtime_meta: {
        source: 'remote',
        profileFingerprint: 'demo-fingerprint',
    },
    surfaces: {
        operator: {
            label: 'Turnero Operador',
            route: '/operador-turnos.html',
            enabled: true,
        },
        kiosk: {
            label: 'Turnero Kiosco',
            route: '/kiosco-turnos.html',
            enabled: true,
        },
        display: {
            label: 'Turnero Sala TV',
            route: '/sala-turnos.html',
            enabled: true,
        },
    },
});

function buildAlignedInput(surfaceKey, currentRoute, summaryPrefix) {
    return {
        surfaceKey,
        clinicProfile: CLINIC_PROFILE,
        currentRoute,
        runtimeState: {
            state: 'ready',
            status: 'ready',
            summary: `${summaryPrefix} alineado`,
            online: true,
            connectivity: 'online',
            mode: 'live',
            reason: '',
            pendingCount: 0,
            outboxSize: 0,
            reconciliationSize: 0,
            updateChannel: 'stable',
        },
        heartbeat: {
            state: 'ready',
            summary: 'Heartbeat alineado.',
            channel: 'telemetry',
            lastBeatAt: '2026-03-20T10:00:00.000Z',
            lastEvent: 'heartbeat',
            lastEventAt: '2026-03-20T10:00:00.000Z',
            online: true,
        },
    };
}

test('surface recovery pack normalizes snapshot, drift, gate and readout', async () => {
    const recoveryModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-recovery-pack.js'
    );

    const pack = recoveryModule.buildTurneroSurfaceRecoveryPack(
        buildAlignedInput('operator', '/operador-turnos.html', 'Operador')
    );

    assert.equal(pack.snapshot.surfaceKey, 'operator');
    assert.equal(pack.snapshot.contract.state, 'ready');
    assert.equal(pack.snapshot.contract.reason, 'ready');
    assert.equal(pack.snapshot.readiness.state, 'ready');
    assert.equal(pack.drift.state, 'aligned');
    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.gate.openActionCount, 0);
    assert.equal(pack.readout.contractTone, 'ready');
    assert.equal(pack.readout.driftTone, 'warning');
    assert.equal(pack.readout.gateTone, 'ready');
    assert.equal(pack.readout.chips.length, 3);
    assert.match(pack.readout.summary, /alineado/i);
    assert.match(pack.readout.detail, /Ruta canónica verificada/i);
});

test('surface recovery action store persists across instances and affects gate state', async () => {
    const storeModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-recovery-action-store.js'
    );
    const recoveryModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-recovery-pack.js'
    );

    const firstStore =
        storeModule.createTurneroSurfaceRecoveryActionStore(CLINIC_PROFILE);
    const action = firstStore.add({
        surfaceKey: 'operator',
        title: 'Verificar ruta',
        detail: 'Revisar la ruta del host recovery.',
        severity: 'medium',
    });

    const secondStore =
        storeModule.createTurneroSurfaceRecoveryActionStore(CLINIC_PROFILE);
    assert.equal(
        secondStore.list({ surfaceKey: 'operator', includeClosed: false })
            .length,
        1
    );

    const watchPack = recoveryModule.buildTurneroSurfaceRecoveryPack({
        ...buildAlignedInput('operator', '/operador-turnos.html', 'Operador'),
        actionStore: secondStore,
    });

    assert.equal(watchPack.snapshot.openActionCount, 1);
    assert.equal(watchPack.drift.state, 'watch');
    assert.equal(watchPack.gate.band, 'watch');
    assert.ok(
        watchPack.drift.driftFlags.some((flag) => flag.scope === 'actions'),
        'la acción abierta debe aparecer como drift de acciones'
    );

    const closedAction = secondStore.close(action.id);
    assert.equal(closedAction.state, 'closed');
    assert.equal(
        secondStore.list({ surfaceKey: 'operator', includeClosed: false })
            .length,
        0
    );
});

test('admin recovery console html renders recovery surfaces and action controls', async () => {
    const recoveryModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-recovery-pack.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-recovery-console.js'
    );

    const surfacePacks = [
        recoveryModule.buildTurneroSurfaceRecoveryPack(
            buildAlignedInput('operator', '/operador-turnos.html', 'Operador')
        ),
        recoveryModule.buildTurneroSurfaceRecoveryPack(
            buildAlignedInput('kiosk', '/kiosco-turnos.html', 'Kiosco')
        ),
        recoveryModule.buildTurneroSurfaceRecoveryPack(
            buildAlignedInput('display', '/sala-turnos.html', 'Sala')
        ),
    ].map((pack) => ({
        surfaceKey: pack.surfaceKey,
        label: pack.readout.surfaceLabel,
        pack,
    }));

    const html = consoleModule.buildTurneroAdminQueueSurfaceRecoveryConsoleHtml(
        {
            scope: 'sierra',
            clinicProfile: CLINIC_PROFILE,
            surfacePacks,
        }
    );

    assert.match(html, /turnero-admin-queue-surface-recovery-console/);
    assert.match(html, /data-state="ready"/);
    assert.match(html, /Copy summary/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /Open actions/);
});
