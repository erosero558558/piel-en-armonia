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
        name: 'Clinica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    region: 'sierra',
    surfaces: {
        operator: {
            label: 'Turnero Operador',
        },
        kiosk: {
            label: 'Turnero Kiosco',
        },
        display: {
            label: 'Turnero Sala TV',
        },
    },
});

test('renewal snapshot normalizes clinic data', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-renewal-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceRenewalSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        renewalValueBand: 'high',
        retentionSignal: 'stable',
        feedbackState: 'good',
        activityState: 'active',
        pendingCorrections: 1,
        renewalOwner: 'renewal-lead',
        commercialOwner: 'ernesto',
        successOwner: 'ops-lead',
        nextRenewalWindow: '30 dias',
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clinica Demo');
    assert.equal(snapshot.renewalValueBand, 'high');
    assert.equal(snapshot.pendingCorrections, 1);
});

test('renewal ledger and owner store are clinic-scoped', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-renewal-ledger.js'
    );
    const ownerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-renewal-owner-store.js'
    );

    const ledger = ledgerModule.createTurneroSurfaceRenewalLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicLedger = ledgerModule.createTurneroSurfaceRenewalLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherClinicLedger = ledgerModule.createTurneroSurfaceRenewalLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );
    const owners = ownerModule.createTurneroSurfaceRenewalOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicOwners = ownerModule.createTurneroSurfaceRenewalOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherClinicOwners = ownerModule.createTurneroSurfaceRenewalOwnerStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    ledger.add({
        surfaceKey: 'operator-turnos',
        kind: 'renewal-note',
        signal: 'renewal',
        status: 'ready',
        owner: 'renewal',
        note: 'Renovacion lista para seguimiento.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'renewal-lead',
        role: 'renewal',
        status: 'active',
        note: 'Owner principal.',
    });

    assert.equal(sameClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(sameClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 0);
});

test('renewal pack and console html expose renewal metadata', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-renewal-pack.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-renewal-console.js'
    );

    const pack = packModule.buildTurneroSurfaceRenewalPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
        renewalValueBand: 'high',
        retentionSignal: 'stable',
        feedbackState: 'good',
        activityState: 'active',
        pendingCorrections: 0,
        renewalOwner: 'ops-display',
        commercialOwner: 'ernesto',
        successOwner: 'ops-display',
        nextRenewalWindow: '45 dias',
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: [
            {
                surfaceKey: 'sala-turnos',
                kind: 'renewal-note',
                signal: 'renewal',
                status: 'ready',
                owner: 'renewal',
                note: 'Cuenta sana para renovacion.',
            },
        ],
        owners: [
            {
                surfaceKey: 'sala-turnos',
                actor: 'ops-display',
                role: 'renewal',
                status: 'active',
                note: 'Owner renewal.',
            },
            {
                surfaceKey: 'sala-turnos',
                actor: 'ernesto',
                role: 'commercial',
                status: 'active',
                note: 'Owner commercial.',
            },
            {
                surfaceKey: 'sala-turnos',
                actor: 'ops-display',
                role: 'success',
                status: 'active',
                note: 'Owner success.',
            },
        ],
    });

    const html = consoleModule.buildTurneroAdminQueueSurfaceRenewalConsoleHtml({
        scope: 'regional',
        clinicProfile: CLINIC_PROFILE,
        snapshots: [
            {
                label: 'Turnero Operador',
                surfaceKey: 'operator-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                renewalValueBand: 'high',
                retentionSignal: 'stable',
                feedbackState: 'good',
                activityState: 'active',
                pendingCorrections: 0,
                renewalOwner: 'renewal-lead',
                commercialOwner: 'ernesto',
                successOwner: 'ops-lead',
                nextRenewalWindow: '30 dias',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
            {
                label: 'Turnero Kiosco',
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                renewalValueBand: 'medium',
                retentionSignal: 'fragile',
                feedbackState: 'mixed',
                activityState: 'watch',
                pendingCorrections: 2,
                renewalOwner: '',
                commercialOwner: '',
                successOwner: 'ops-kiosk',
                nextRenewalWindow: '15 dias',
                checklist: { summary: { all: 4, pass: 2, fail: 2 } },
            },
        ],
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2,
            },
        },
    });

    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.readout.chips.length, 3);
    assert.equal(pack.readout.gateDecision, 'renewal-ready');
    assert.match(pack.brief, /Surface Renewal Retention/);
    assert.match(html, /Surface Renewal Retention Console/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
});
