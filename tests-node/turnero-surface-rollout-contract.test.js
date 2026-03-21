#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { readJson } = require('./turnero-surface-rollout-test-helpers.js');
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
const READY_MANIFEST = {
    ...PILOT_MANIFEST,
    apps: {
        ...PILOT_MANIFEST.apps,
        kiosk: {
            version: '0.1.0',
            targets: {
                win: {
                    url: '/app-downloads/pilot/kiosk/win/TurneroKioscoSetup.exe',
                },
            },
            files: [
                {
                    path: '/app-downloads/pilot/kiosk/win/TurneroKioscoSetup.exe',
                },
            ],
        },
        sala_tv: {
            version: '0.1.0',
            targets: {
                android_tv: {
                    url: '/app-downloads/pilot/sala_tv/android/TurneroSalaTV.apk',
                },
            },
            files: [
                {
                    path: '/app-downloads/pilot/sala_tv/android/TurneroSalaTV.apk',
                },
            ],
        },
    },
};

test('rollout snapshot normalizes surface ids and reaches ready when registry, manifest and checklist align', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-snapshot.js'
    );
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-gate.js'
    );
    const readoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-readout.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceRolloutSnapshot({
        surfaceKey: 'sala_tv',
        clinicProfile: CLINIC_PROFILE,
        surfaceRegistry: SURFACE_REGISTRY,
        releaseManifest: READY_MANIFEST,
        currentRoute: '/sala-turnos.html',
        runtimeState: {
            state: 'ready',
            summary: 'Runtime online',
        },
        truth: 'aligned',
        ledger: [],
    });
    const gate = gateModule.buildTurneroSurfaceRolloutGate({ snapshot });
    const readout = readoutModule.buildTurneroSurfaceRolloutReadout({
        snapshot,
        gate,
    });

    assert.equal(snapshot.surfaceId, 'display');
    assert.equal(snapshot.surfaceKey, 'sala-turnos');
    assert.equal(snapshot.surfaceFamily, 'android');
    assert.equal(snapshot.visitDate, '2026-04-02');
    assert.equal(snapshot.stationLabel, 'Sala de espera');
    assert.equal(snapshot.installMode, 'broadcast');
    assert.equal(snapshot.manifestState, 'ready');
    assert.equal(snapshot.checklistState, 'ready');
    assert.equal(gate.band, 'ready');
    assert.equal(gate.decision, 'proceed-rollout');
    assert.equal(readout.gateBand, 'ready');
    assert.equal(readout.checkpointChips.length, 3);
    assert.deepEqual(
        readout.checkpointChips.map((chip) => chip.label),
        ['asset', 'rollout', 'score']
    );
    assert.match(readout.summary, /listo/i);
    assert.match(readout.detail, /Scope regional/);
});

test('rollout snapshot stays conservative on missing manifest coverage and required checklist gaps', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-snapshot.js'
    );
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-gate.js'
    );
    const readoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-rollout-readout.js'
    );

    const watchSnapshot = snapshotModule.buildTurneroSurfaceRolloutSnapshot({
        surfaceKey: 'kiosco-turnos',
        clinicProfile: CLINIC_PROFILE,
        surfaceRegistry: SURFACE_REGISTRY,
        releaseManifest: PILOT_MANIFEST,
        currentRoute: '/kiosco-turnos.html',
        runtimeState: {
            state: 'ready',
            summary: 'Runtime online',
        },
        truth: 'watch',
        ledger: [],
    });
    const watchGate = gateModule.buildTurneroSurfaceRolloutGate({
        snapshot: watchSnapshot,
    });
    const watchReadout = readoutModule.buildTurneroSurfaceRolloutReadout({
        snapshot: watchSnapshot,
        gate: watchGate,
    });

    assert.equal(watchSnapshot.surfaceId, 'kiosk');
    assert.equal(watchSnapshot.manifestState, 'pending');
    assert.equal(watchSnapshot.checklistState, 'watch');
    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.state, 'watch');
    assert.ok(
        watchGate.issues.some((issue) => /Manifest pendiente/i.test(issue)),
        'expected the kiosk rollout to call out the missing manifest entry'
    );
    assert.match(watchReadout.summary, /observacion/i);

    const blockedSnapshot = snapshotModule.buildTurneroSurfaceRolloutSnapshot({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
        surfaceRegistry: SURFACE_REGISTRY,
        releaseManifest: READY_MANIFEST,
        currentRoute: '/operador-turnos.html',
        runtimeState: {
            state: 'ready',
            summary: 'Runtime online',
        },
        truth: 'aligned',
        stationLabel: '',
        installMode: '',
        ledger: [],
    });
    const blockedGate = gateModule.buildTurneroSurfaceRolloutGate({
        snapshot: blockedSnapshot,
    });

    assert.equal(blockedSnapshot.checklistState, 'blocked');
    assert.ok(blockedSnapshot.checklist.requiredFail > 0);
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.state, 'blocked');
    assert.match(blockedGate.summary, /Bloqueado/i);
});
