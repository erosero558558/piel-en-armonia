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

class FakeElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.children = [];
        this.className = '';
        this.hidden = false;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._innerHTML = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    querySelector() {
        return null;
    }
}

function withGlobals(setup, callback) {
    const previous = {};
    for (const [key, value] of Object.entries(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        Object.defineProperty(global, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value,
        });
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const [key, descriptor] of Object.entries(previous)) {
                if (!descriptor) {
                    delete global[key];
                    continue;
                }

                Object.defineProperty(global, key, descriptor);
            }
        });
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

test('expansion snapshot normalizes clinic data and aliases', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceExpansionSnapshot({
        surfaceKey: 'operador-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
    });

    assert.equal(snapshot.surfaceKey, 'operator');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clinica Demo');
    assert.equal(snapshot.demandSignal, 'medium');
    assert.equal(snapshot.gapState, 'triage-plus');
    assert.equal(snapshot.nextModuleHint, 'historia-clinica-lite');
});

test('expansion ledger and owner store isolate clinic and scope', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-ledger.js'
    );
    const ownerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-owner-store.js'
    );

    const regionalLedger = ledgerModule.createTurneroSurfaceExpansionLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameScopeLedger = ledgerModule.createTurneroSurfaceExpansionLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherScopeLedger = ledgerModule.createTurneroSurfaceExpansionLedger(
        'local',
        CLINIC_PROFILE
    );
    const otherClinicLedger = ledgerModule.createTurneroSurfaceExpansionLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const regionalOwners = ownerModule.createTurneroSurfaceExpansionOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameScopeOwners = ownerModule.createTurneroSurfaceExpansionOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherScopeOwners = ownerModule.createTurneroSurfaceExpansionOwnerStore(
        'local',
        CLINIC_PROFILE
    );
    const otherClinicOwners = ownerModule.createTurneroSurfaceExpansionOwnerStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    regionalLedger.add({
        surfaceKey: 'operator-turnos',
        kind: 'module-hint',
        status: 'ready',
        owner: 'ops-lead',
        title: 'Historia clinica lite',
        note: 'Modulo sugerido.',
    });
    regionalOwners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'expansion',
        status: 'active',
        note: 'Owner expansion.',
    });

    assert.equal(sameScopeLedger.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(otherScopeLedger.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(otherClinicLedger.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(sameScopeOwners.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(otherScopeOwners.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(otherClinicOwners.list({ surfaceKey: 'operator' }).length, 0);
});

test('expansion gate and readout expose band, decision and three checkpoints', async () => {
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-gate.js'
    );
    const readoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-readout.js'
    );
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-snapshot.js'
    );

    const readySnapshot = snapshotModule.buildTurneroSurfaceExpansionSnapshot({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
        opportunityState: 'ready',
        demandSignal: 'medium',
        gapState: 'voice-announcer',
        expansionOwner: 'ops-display',
        nextModuleHint: 'analytics-board',
    });
    const readyGate = gateModule.buildTurneroSurfaceExpansionGate({
        snapshot: readySnapshot,
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: [
            {
                surfaceKey: 'display',
                kind: 'module-hint',
                status: 'ready',
            },
        ],
        owners: [
            {
                surfaceKey: 'display',
                actor: 'ops-display',
                role: 'expansion',
                status: 'active',
            },
        ],
    });
    const readout = readoutModule.buildTurneroSurfaceExpansionReadout({
        snapshot: readySnapshot,
        gate: readyGate,
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });
    const blockedGate = gateModule.buildTurneroSurfaceExpansionGate({
        snapshot: readySnapshot,
        checklist: {
            summary: {
                all: 4,
                pass: 2,
                fail: 2,
            },
        },
        ledger: [],
        owners: [],
    });

    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'expansion-ready');
    assert.equal(readout.checkpoints.length, 3);
    assert.deepEqual(
        readout.checkpoints.map((chip) => chip.label),
        ['demand', 'expansion', 'score']
    );
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-expansion-readiness');
});

test('expansion pack assembles brief and normalized fields', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-pack.js'
    );

    const pack = packModule.buildTurneroSurfaceExpansionPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'medium',
        gapState: 'triage-plus',
        expansionOwner: 'ops-lead',
        nextModuleHint: 'historia-clinica-lite',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: [
            {
                surfaceKey: 'operator',
                kind: 'module-hint',
                status: 'ready',
                owner: 'ops',
                title: 'Historia clinica lite',
                note: 'Modulo sugerido.',
            },
        ],
        owners: [
            {
                surfaceKey: 'operator',
                actor: 'ops-lead',
                role: 'expansion',
                status: 'active',
                note: 'Owner expansion.',
            },
        ],
    });

    assert.equal(pack.snapshot.surfaceKey, 'operator');
    assert.equal(pack.readout.nextModuleHint, 'historia-clinica-lite');
    assert.match(pack.brief, /Surface Expansion Upsell/);
    assert.match(pack.brief, /Historia clinica lite/);
});

test('expansion banner stays visible when band is ready', async () => {
    const bannerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-banner.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-expansion-pack.js'
    );
    const host = new FakeElement('div', 'expansionBannerHost');

    await withGlobals(
        {
            HTMLElement: FakeElement,
            document: {
                head: new FakeElement('head', 'head'),
                createElement(tagName) {
                    return new FakeElement(tagName);
                },
                getElementById() {
                    return null;
                },
            },
        },
        async () => {
            const pack = packModule.buildTurneroSurfaceExpansionPack({
                surfaceKey: 'sala-turnos',
                clinicProfile: CLINIC_PROFILE,
                runtimeState: 'ready',
                truth: 'aligned',
                opportunityState: 'ready',
                demandSignal: 'medium',
                gapState: 'voice-announcer',
                expansionOwner: 'ops-display',
                nextModuleHint: 'analytics-board',
                checklist: {
                    summary: {
                        all: 4,
                        pass: 4,
                        fail: 0,
                    },
                },
                ledger: [{ status: 'ready' }],
                owners: [{ status: 'active' }],
            });

            const node = bannerModule.mountTurneroSurfaceExpansionBanner(host, {
                pack,
                title: 'Display expansion',
            });

            assert.ok(node);
            assert.equal(host.hidden, false);
            assert.equal(host.dataset.band, 'ready');
            assert.match(host.innerHTML, /Display expansion/);
        }
    );
});
