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

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.innerHTML = '';
        this.hidden = false;
        this.listeners = new Map();
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        return this.attributes.get(String(name));
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    replaceChildren(...children) {
        this.children = children;
        this.innerHTML = children
            .map((child) => child?.innerHTML || '')
            .join('');
    }

    appendChild(child) {
        if (!this.children) {
            this.children = [];
        }
        this.children.push(child);
        return child;
    }

    querySelector() {
        return null;
    }
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
        },
        kiosk: {
            label: 'Turnero Kiosco',
        },
        display: {
            label: 'Turnero Sala TV',
        },
    },
});

const SNAPSHOTS = [
    {
        surfaceKey: 'operator-turnos',
        label: 'Turnero Operador',
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-lead',
        scopeState: 'ready',
        pricingState: 'watch',
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
    },
    {
        surfaceKey: 'kiosco-turnos',
        label: 'Turnero Kiosco',
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot',
        commercialOwner: '',
        opsOwner: 'ops-kiosk',
        scopeState: 'draft',
        pricingState: 'draft',
        checklist: { summary: { all: 4, pass: 2, fail: 2 } },
    },
    {
        surfaceKey: 'sala-turnos',
        label: 'Turnero Sala TV',
        runtimeState: 'ready',
        truth: 'aligned',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-display',
        scopeState: 'ready',
        pricingState: 'ready',
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
    },
];

test('commercial snapshot normalizes clinic data', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceCommercialSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-lead',
        scopeState: 'ready',
        pricingState: 'watch',
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clínica Demo');
    assert.equal(snapshot.packageTier, 'pilot-plus');
    assert.equal(snapshot.opsOwner, 'ops-lead');
});

test('commercial ledger and owner store are clinic-scoped', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-ledger.js'
    );
    const ownerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-owner-store.js'
    );

    const ledger = ledgerModule.createTurneroSurfaceCommercialLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherLedger = ledgerModule.createTurneroSurfaceCommercialLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );
    const owners = ownerModule.createTurneroSurfaceCommercialOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherOwners = ownerModule.createTurneroSurfaceCommercialOwnerStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const first = ledger.add({
        surfaceKey: 'operator-turnos',
        kind: 'package-note',
        status: 'ready',
        owner: 'ops',
        note: 'Paquete listo.',
    });
    ledger.add({
        surfaceKey: 'kiosco-turnos',
        kind: 'scope-note',
        status: 'watch',
        owner: 'ops',
        note: 'Revisar alcance.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ernesto',
        role: 'commercial',
        status: 'active',
        note: 'Seguimiento comercial.',
    });

    assert.equal(first.surfaceKey, 'operator-turnos');
    assert.equal(ledger.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(ledger.list().length, 2);
    assert.equal(otherLedger.list().length, 0);
    assert.equal(
        ledger.snapshot().schema,
        'turnero-surface-commercial-ledger/v1'
    );

    assert.equal(owners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherOwners.list().length, 0);
    assert.equal(
        owners.snapshot().schema,
        'turnero-surface-commercial-owner-store/v1'
    );

    ledger.clear({ surfaceKey: 'kiosco-turnos' });
    assert.equal(ledger.list().length, 1);
    ledger.clear();
    owners.clear();
    assert.equal(ledger.list().length, 0);
    assert.equal(owners.list().length, 0);
});

test('commercial gate resolves ready, watch and blocked states', async () => {
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-gate.js'
    );

    const readyGate = gateModule.buildTurneroSurfaceCommercialGate({
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [{ status: 'ready' }, { status: 'done' }],
        owners: [{ status: 'active' }, { status: 'active' }],
    });
    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'commercial-ready');

    const watchGate = gateModule.buildTurneroSurfaceCommercialGate({
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });
    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.decision, 'review-package-readiness');

    const blockedGate = gateModule.buildTurneroSurfaceCommercialGate({
        checklist: { summary: { all: 4, pass: 2, fail: 2 } },
    });
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-commercial-readiness');
});

test('commercial pack and banner expose readiness state', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-pack.js'
    );
    const bannerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-commercial-banner.js'
    );

    const pack = packModule.buildTurneroSurfaceCommercialPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-lead',
        scopeState: 'ready',
        pricingState: 'watch',
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });

    assert.equal(pack.readout.gateBand, 'watch');
    assert.ok(pack.readout.gateScore > 0);
    assert.equal(pack.readout.packageTier, 'pilot-plus');

    const html = bannerModule.buildTurneroSurfaceCommercialBannerHtml({
        snapshot: pack.snapshot,
        gate: pack.gate,
        readout: pack.readout,
    });
    assert.match(html, /Commercial readiness visible/);
    assert.match(html, /data-state="warning"/);

    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const host = new HTMLElementStub('commercialBannerHost');
    global.HTMLElement = HTMLElementStub;
    global.document = {
        getElementById() {
            return null;
        },
        createElement(tagName) {
            return {
                tagName: String(tagName || '').toUpperCase(),
                id: '',
                textContent: '',
            };
        },
        head: {
            appendChild() {},
        },
    };

    try {
        const mounted = bannerModule.mountTurneroSurfaceCommercialBanner(host, {
            snapshot: pack.snapshot,
            gate: pack.gate,
            readout: pack.readout,
            title: 'Operator commercial',
        });
        assert.equal(mounted, host);
        assert.match(host.innerHTML, /Operator commercial/);
        assert.equal(host.hidden, false);

        const readyHost = new HTMLElementStub('commercialBannerReadyHost');
        const readyResult = bannerModule.mountTurneroSurfaceCommercialBanner(
            readyHost,
            {
                snapshot: pack.snapshot,
                gate: {
                    band: 'ready',
                    score: 100,
                    decision: 'commercial-ready',
                },
            }
        );
        assert.equal(readyResult, null);
        assert.equal(readyHost.hidden, true);
    } finally {
        if (previousDocument === undefined) {
            delete global.document;
        } else {
            global.document = previousDocument;
        }

        if (previousHTMLElement === undefined) {
            delete global.HTMLElement;
        } else {
            global.HTMLElement = previousHTMLElement;
        }
    }
});

test('commercial console html renders surface cards and actions', async () => {
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-commercial-console.js'
    );

    const html =
        consoleModule.buildTurneroAdminQueueSurfaceCommercialConsoleHtml({
            scope: 'regional',
            clinicProfile: CLINIC_PROFILE,
            snapshots: SNAPSHOTS,
            checklist: { summary: { all: 6, pass: 4, fail: 2 } },
        });

    assert.match(html, /Surface Commercial Readiness/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-state="degraded"/);
    assert.match(html, /data-role="banner"/);
});
