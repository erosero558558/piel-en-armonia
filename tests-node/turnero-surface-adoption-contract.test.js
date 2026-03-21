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
    region: 'sierra',
    surfaces: {
        operator: {
            label: 'Turnero Operador',
            route: '/operador-turnos.html',
        },
        kiosk: {
            label: 'Turnero Kiosco',
            route: '/kiosco-turnos.html',
        },
        display: {
            label: 'Turnero Sala TV',
            route: '/sala-turnos.html',
        },
    },
});

const REGISTRY = Object.freeze({
    mode: 'ready',
    manifestSource: 'primary',
    manifest: {
        version: '0.1.0',
    },
    surfaces: [
        {
            id: 'operator',
            route: '/operador-turnos.html',
            webFallbackUrl: '/operador-turnos.html',
            productName: 'Turnero Operador',
        },
        {
            id: 'kiosk',
            route: '/kiosco-turnos.html',
            webFallbackUrl: '/kiosco-turnos.html',
            productName: 'Turnero Kiosco',
        },
        {
            id: 'sala_tv',
            route: '/sala-turnos.html',
            webFallbackUrl: '/sala-turnos.html',
            productName: 'Turnero Sala TV',
        },
    ],
    warnings: [],
    errors: [],
    loadedAt: '2026-03-20T10:00:00.000Z',
});

function buildReadySurfaceEvidence(stores, surfaceKey, labelSuffix) {
    stores.trainingLedger.addTraining({
        surfaceKey,
        title: `Training ${labelSuffix}`,
        detail: `Training evidence for ${labelSuffix}.`,
        owner: 'ops',
        source: 'manual',
        state: 'recorded',
    });
    stores.trainingLedger.addManualHandoff({
        surfaceKey,
        title: `Manual handoff ${labelSuffix}`,
        detail: `Manual handoff evidence for ${labelSuffix}.`,
        owner: 'ops',
        source: 'manual',
        state: 'recorded',
    });
    stores.ackStore.addAck({
        surfaceKey,
        title: `Operator acknowledgement ${labelSuffix}`,
        note: `Acknowledged for ${labelSuffix}.`,
        owner: 'ops',
        source: 'manual',
        state: 'recorded',
    });
}

test('surface adoption pack normalizes operator/kiosk/display keys and chips', async () => {
    const adoptionModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-adoption-pack.js'
    );

    const operatorPack = adoptionModule.buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        registry: REGISTRY,
        currentRoute: '/operador-turnos.html',
    });
    const kioskPack = adoptionModule.buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'kiosco-turnos',
        clinicProfile: CLINIC_PROFILE,
        registry: REGISTRY,
        currentRoute: '/kiosco-turnos.html',
    });
    const displayPack = adoptionModule.buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        registry: REGISTRY,
        currentRoute: '/sala-turnos.html',
    });

    assert.equal(operatorPack.surfaceKey, 'operator');
    assert.equal(operatorPack.surfaceId, 'operator');
    assert.equal(operatorPack.readout.roleLabel, 'Operador');
    assert.equal(operatorPack.readout.handoffMode, 'guided');
    assert.equal(operatorPack.gate.band, 'watch');
    assert.deepEqual(
        operatorPack.chips.map((chip) => chip.label),
        ['Role', 'Adoption', 'Score']
    );
    assert.equal(operatorPack.chips[0].state, 'ready');
    assert.equal(operatorPack.chips[1].state, 'warning');
    assert.equal(operatorPack.chips[2].state, 'warning');

    assert.equal(kioskPack.surfaceKey, 'kiosk');
    assert.equal(kioskPack.surfaceId, 'kiosk');
    assert.equal(kioskPack.readout.roleLabel, 'Recepcion');
    assert.equal(kioskPack.readout.handoffMode, 'manual');

    assert.equal(displayPack.surfaceKey, 'display');
    assert.equal(displayPack.surfaceId, 'sala_tv');
    assert.equal(displayPack.readout.roleLabel, 'Pantalla');
    assert.equal(displayPack.readout.handoffMode, 'broadcast');
});

test('surface adoption stores persist evidence per clinic and surface', async () => {
    const trainingModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-training-ledger.js'
    );
    const ackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-operator-ack-store.js'
    );

    const firstTrainingLedger =
        trainingModule.createTurneroSurfaceTrainingLedger(
            'regional',
            CLINIC_PROFILE
        );
    firstTrainingLedger.addTraining({
        surfaceKey: 'operator-turnos',
        title: 'Training operator',
        detail: 'Operator training evidence.',
        owner: 'ops',
    });
    firstTrainingLedger.addManualHandoff({
        surfaceKey: 'operator-turnos',
        title: 'Manual handoff operator',
        detail: 'Operator handoff evidence.',
        owner: 'ops',
    });

    const secondTrainingLedger =
        trainingModule.createTurneroSurfaceTrainingLedger(
            'regional',
            CLINIC_PROFILE
        );
    assert.equal(
        secondTrainingLedger.list({ surfaceKey: 'operator-turnos' }).length,
        2
    );
    assert.equal(
        secondTrainingLedger.summary({ surfaceKey: 'operator-turnos' })
            .training,
        1
    );
    assert.equal(
        secondTrainingLedger.summary({ surfaceKey: 'operator-turnos' })
            .manualHandoff,
        1
    );

    const otherClinicTrainingLedger =
        trainingModule.createTurneroSurfaceTrainingLedger('regional', {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        });
    assert.equal(otherClinicTrainingLedger.list().length, 0);

    const firstAckStore = ackModule.createTurneroSurfaceOperatorAckStore(
        'regional',
        CLINIC_PROFILE
    );
    firstAckStore.addAck({
        surfaceKey: 'operator-turnos',
        title: 'Operator acknowledgement',
        note: 'Acknowledged by operator.',
        owner: 'ops',
    });

    const secondAckStore = ackModule.createTurneroSurfaceOperatorAckStore(
        'regional',
        CLINIC_PROFILE
    );
    assert.equal(
        secondAckStore.list({ surfaceKey: 'operator-turnos' }).length,
        1
    );
    assert.equal(
        secondAckStore.summary({ surfaceKey: 'operator-turnos' })
            .acknowledgements,
        1
    );
    assert.equal(
        secondAckStore.snapshot().schema,
        'turnero-surface-operator-ack-store/v1'
    );
});

test('surface adoption pack becomes ready with complete evidence', async () => {
    const adoptionModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-adoption-pack.js'
    );
    const trainingModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-training-ledger.js'
    );
    const ackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-operator-ack-store.js'
    );

    const trainingLedger = trainingModule.createTurneroSurfaceTrainingLedger(
        'regional',
        CLINIC_PROFILE
    );
    const ackStore = ackModule.createTurneroSurfaceOperatorAckStore(
        'regional',
        CLINIC_PROFILE
    );

    buildReadySurfaceEvidence(
        { trainingLedger, ackStore },
        'operator-turnos',
        'operator'
    );

    const readyPack = adoptionModule.buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        registry: REGISTRY,
        trainingLedger,
        ackStore,
        currentRoute: '/operador-turnos.html',
        runtimeState: {
            state: 'ready',
            summary: 'Runtime listo.',
        },
    });

    assert.equal(readyPack.gate.band, 'ready');
    assert.equal(readyPack.gate.decision, 'adoption-go');
    assert.ok(readyPack.gate.score >= 90);
    assert.match(readyPack.readout.summary, /listo/i);
});

test('admin queue adoption console html renders three cards and rerenders after evidence is added', async () => {
    const trainingModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-training-ledger.js'
    );
    const ackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-operator-ack-store.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-adoption-console.js'
    );

    const trainingLedger = trainingModule.createTurneroSurfaceTrainingLedger(
        'regional',
        CLINIC_PROFILE
    );
    const ackStore = ackModule.createTurneroSurfaceOperatorAckStore(
        'regional',
        CLINIC_PROFILE
    );

    const emptyHtml =
        consoleModule.buildTurneroAdminQueueSurfaceAdoptionConsoleHtml({
            scope: 'sierra',
            clinicProfile: CLINIC_PROFILE,
            registry: REGISTRY,
            trainingLedger,
            ackStore,
        });

    assert.match(emptyHtml, /turnero-admin-queue-surface-adoption-console/);
    assert.match(emptyHtml, /Copy brief/);
    assert.match(emptyHtml, /Download JSON/);
    assert.match(emptyHtml, /Operador/);
    assert.match(emptyHtml, /Recepcion/);
    assert.match(emptyHtml, /Pantalla/);
    assert.match(emptyHtml, /Clear selected surface/);
    assert.match(emptyHtml, /data-state="watch"/);

    for (const [surfaceKey, labelSuffix] of [
        ['operator-turnos', 'operator'],
        ['kiosco-turnos', 'kiosk'],
        ['sala-turnos', 'display'],
    ]) {
        buildReadySurfaceEvidence(
            { trainingLedger, ackStore },
            surfaceKey,
            labelSuffix
        );
    }

    const readyHtml =
        consoleModule.buildTurneroAdminQueueSurfaceAdoptionConsoleHtml({
            scope: 'sierra',
            clinicProfile: CLINIC_PROFILE,
            registry: REGISTRY,
            trainingLedger,
            ackStore,
        });

    assert.match(readyHtml, /data-state="ready"/);
    assert.match(readyHtml, /Training operator/);
    assert.match(readyHtml, /Manual handoff kiosk/);
    assert.match(readyHtml, /Operator acknowledgement display/);
    assert.match(readyHtml, /Recent evidence/);
});
