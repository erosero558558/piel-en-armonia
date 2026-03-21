#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    installLocalStorageMock,
    readJson,
} = require('./turnero-surface-rollout-test-helpers.js');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

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

const SURFACE_REGISTRY = readJson('data/turnero-surfaces.json');
const PILOT_MANIFEST = readJson('app-downloads/pilot/release-manifest.json');

test.beforeEach(() => {
    installLocalStorageMock();
});

test('rollout pack persists ledger by clinic and survives new instances', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-ledger.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-pack.js'
    );

    const storageKey = 'turnero-surface-rollout-pack-test';
    const ledgerStore = ledgerModule.createTurneroSurfaceRolloutLedger(
        CLINIC_PROFILE,
        { storageKey }
    );

    ledgerStore.add({
        id: 'rollout-1',
        surfaceKey: 'operator-turnos',
        state: 'open',
        title: 'Instalacion operador',
        detail: 'Equipo validado para consultorio 1.',
        owner: 'ops-lead',
        assetTag: 'OPS-OP-01',
        stationLabel: 'Consultorio 1',
        installMode: 'guided',
        visitDate: '2026-04-01',
    });

    const firstPack = packModule.buildTurneroSurfaceRolloutPack({
        storageKey,
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
        surfaceRegistry: SURFACE_REGISTRY,
        releaseManifest: PILOT_MANIFEST,
        runtimeState: {
            state: 'ready',
            summary: 'Runtime online',
        },
        truth: 'aligned',
        ledgerStore,
    });
    const secondPack = packModule.buildTurneroSurfaceRolloutPack({
        storageKey,
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
        surfaceRegistry: SURFACE_REGISTRY,
        releaseManifest: PILOT_MANIFEST,
        runtimeState: {
            state: 'ready',
            summary: 'Runtime online',
        },
        truth: 'aligned',
    });
    const otherClinicLedger = ledgerModule.createTurneroSurfaceRolloutLedger(
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        },
        { storageKey }
    );

    assert.equal(firstPack.snapshot.clinicId, 'clinica-demo');
    assert.equal(firstPack.ledger.totalCount, 1);
    assert.equal(firstPack.ledger.openCount, 1);
    assert.equal(secondPack.ledger.totalCount, 1);
    assert.equal(secondPack.ledger.entries[0].id, 'rollout-1');
    assert.equal(secondPack.ledger.entries[0].surfaceKey, 'operator-turnos');
    assert.equal(secondPack.readout.checkpointChips.length, 3);
    assert.equal(
        otherClinicLedger.snapshot({ surfaceKey: 'operator-turnos' })
            .totalCount,
        0
    );
});
