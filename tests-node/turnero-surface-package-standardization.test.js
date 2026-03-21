#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const storage = createLocalStorageStub();
global.localStorage = storage;

test.beforeEach(() => {
    storage.clear();
});

class HTMLElementStub {
    constructor(tagName = 'div') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.hidden = false;
        this.listeners = new Map();
        this.style = {};
        this.className = '';
        this._innerHTML = '';
        this._textContent = '';
        this.value = '';
        this.parentElement = null;
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set textContent(value) {
        this._textContent = String(value ?? '');
        this._innerHTML = '';
        this.children = [];
    }

    get textContent() {
        if (this._textContent) {
            return this._textContent;
        }

        if (this.children.length > 0) {
            return this.children
                .map((child) => String(child.textContent || ''))
                .join('');
        }

        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalizedName = String(name || '');
        const normalizedValue = String(value ?? '');
        if (normalizedName === 'class') {
            this.className = normalizedValue;
            return;
        }
        if (normalizedName === 'id') {
            this.id = normalizedValue;
            return;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalizedValue;
        }
        this.attributes.set(normalizedName, normalizedValue);
    }

    getAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'class') {
            return this.className || null;
        }
        if (normalizedName === 'id') {
            return this.id || null;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            return Object.prototype.hasOwnProperty.call(this.dataset, datasetKey)
                ? this.dataset[datasetKey]
                : null;
        }
        return this.attributes.has(normalizedName)
            ? this.attributes.get(normalizedName)
            : null;
    }

    removeAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'class') {
            this.className = '';
            return;
        }
        if (normalizedName === 'id') {
            this.id = '';
            return;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            delete this.dataset[datasetKey];
        }
        this.attributes.delete(normalizedName);
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._innerHTML = '';
        this._textContent = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type || ''), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type || '')) === handler) {
            this.listeners.delete(String(type || ''));
        }
    }

    querySelector() {
        return null;
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(
                (child) => child !== this
            );
            this.parentElement = null;
        }
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

function createDomDocument() {
    return {
        head: {
            appendChild() {},
        },
        body: {
            appendChild() {},
        },
        createElement(tagName) {
            return new HTMLElementStub(tagName);
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
}

const CLINIC_PROFILE = buildClinicProfile({
    clinic_id: 'clinica-package',
    branding: {
        name: 'Clinica Package',
        short_name: 'Package',
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

test('snapshot normalizes aliases and clinic metadata', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-snapshot.js'
    );

    const operator = module.buildTurneroSurfacePackageSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });
    const kiosk = module.buildTurneroSurfacePackageSnapshot({
        surfaceKey: 'kiosco-turnos',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });
    const display = module.buildTurneroSurfacePackageSnapshot({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });

    assert.equal(operator.surfaceKey, 'operator');
    assert.equal(operator.surfaceLabel, 'Turnero Operador');
    assert.equal(operator.clinicId, 'clinica-package');
    assert.equal(operator.clinicLabel, 'Clinica Package');
    assert.equal(operator.scope, 'regional');

    assert.equal(kiosk.surfaceKey, 'kiosk');
    assert.equal(kiosk.surfaceLabel, 'Turnero Kiosco');

    assert.equal(display.surfaceKey, 'display');
    assert.equal(display.surfaceLabel, 'Turnero Sala TV');
});

test('ledger and owner stores persist by clinic scope', async () => {
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-owner-store.js'
    );
    const otherClinic = buildClinicProfile({
        clinic_id: 'clinica-package-2',
        branding: {
            name: 'Clinica Package 2',
            short_name: 'Package 2',
            city: 'Guayaquil',
        },
        region: 'costa',
    });

    const ledger = ledgerModule.createTurneroSurfacePackageLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherLedger = ledgerModule.createTurneroSurfacePackageLedger(
        'regional',
        otherClinic
    );
    const owners = ownerModule.createTurneroSurfacePackageOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherOwners = ownerModule.createTurneroSurfacePackageOwnerStore(
        'regional',
        otherClinic
    );

    ledger.add({
        surfaceKey: 'operator-turnos',
        kind: 'bundle',
        status: 'ready',
        owner: 'ops',
        title: 'Operator bundle',
        note: 'Bundle ready.',
    });
    ledger.add({
        surfaceKey: 'kiosco-turnos',
        kind: 'provisioning',
        status: 'watch',
        owner: 'ops',
        title: 'Kiosk provisioning',
        note: 'Provisioning in review.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'carla',
        role: 'package',
        status: 'active',
        note: 'Primary owner.',
    });

    assert.equal(ledger.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(ledger.list({ surfaceKey: 'kiosk' }).length, 1);
    assert.equal(otherLedger.list().length, 0);
    assert.equal(
        ledger.snapshot().schema,
        'turnero-surface-package-ledger/v1'
    );

    assert.equal(owners.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(otherOwners.list().length, 0);
    assert.equal(
        owners.snapshot().schema,
        'turnero-surface-package-owner-store/v1'
    );

    const ledgerEnvelope = JSON.parse(
        storage.getItem('turneroSurfacePackageLedgerV1')
    );
    const ownerEnvelope = JSON.parse(
        storage.getItem('turneroSurfacePackageOwnerStoreV1')
    );

    assert.deepEqual(Object.keys(ledgerEnvelope.values).sort(), [
        'clinica-package',
    ]);
    assert.deepEqual(Object.keys(ownerEnvelope.values).sort(), [
        'clinica-package',
    ]);
});

test('gate resolves ready, watch, degraded and blocked bands', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-gate.js'
    );

    const readyGate = module.buildTurneroSurfacePackageGate({
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [
            { kind: 'bundle', status: 'ready' },
            { kind: 'provisioning', status: 'ready' },
            { kind: 'onboarding-kit', status: 'ready' },
        ],
        owners: [{ status: 'active' }],
    });
    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'package-ready');
    assert.equal(readyGate.readyArtifactCount, 3);
    assert.equal(readyGate.activeOwnerCount, 1);

    const watchGate = module.buildTurneroSurfacePackageGate({
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [
            { kind: 'bundle', status: 'ready' },
            { kind: 'provisioning', status: 'ready' },
            { kind: 'onboarding-kit', status: 'draft' },
        ],
        owners: [{ status: 'active' }],
    });
    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.decision, 'review-package-standardization');
    assert.ok(watchGate.score >= 70);
    assert.equal(watchGate.readyArtifactCount, 2);

    const degradedGate = module.buildTurneroSurfacePackageGate({
        checklist: { summary: { all: 4, pass: 1, fail: 0 } },
        ledger: [
            { kind: 'bundle', status: 'ready' },
            { kind: 'provisioning', status: 'draft' },
            { kind: 'onboarding-kit', status: 'draft' },
        ],
        owners: [{ status: 'active' }],
    });
    assert.equal(degradedGate.band, 'degraded');
    assert.equal(degradedGate.decision, 'stabilize-package-standardization');
    assert.ok(degradedGate.score < 70);

    const blockedGate = module.buildTurneroSurfacePackageGate({
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [],
        owners: [{ status: 'active' }],
    });
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-package-standardization');
    assert.equal(blockedGate.readyArtifactCount, 0);
    assert.ok(blockedGate.missingArtifactKinds.includes('bundle'));
});

test('pack readout and banner expose three checkpoints', async () => {
    const packModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-pack.js'
    );
    const bannerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-package-banner.js'
    );

    const watchPack = packModule.buildTurneroSurfacePackagePack({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        packageTier: 'pilot-plus',
        bundleState: 'watch',
        provisioningState: 'ready',
        onboardingKitState: 'draft',
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [
            {
                surfaceKey: 'sala-turnos',
                kind: 'bundle',
                status: 'ready',
                title: 'Sala bundle',
                owner: 'ops',
                note: 'Bundle ready.',
                updatedAt: '2026-03-20T10:00:00.000Z',
            },
            {
                surfaceKey: 'sala-turnos',
                kind: 'provisioning',
                status: 'ready',
                title: 'Sala provisioning',
                owner: 'ops',
                note: 'Provisioning ready.',
                updatedAt: '2026-03-20T10:05:00.000Z',
            },
            {
                surfaceKey: 'sala-turnos',
                kind: 'onboarding-kit',
                status: 'draft',
                title: 'Sala onboarding',
                owner: 'ops',
                note: 'Kit pending.',
                updatedAt: '2026-03-20T10:10:00.000Z',
            },
        ],
        owners: [
            {
                surfaceKey: 'sala-turnos',
                actor: 'lucia',
                role: 'package',
                status: 'active',
                note: 'Primary owner.',
            },
        ],
    });

    assert.equal(watchPack.snapshot.surfaceKey, 'display');
    assert.equal(watchPack.readout.packageOwner, 'lucia');
    assert.equal(watchPack.readout.checkpoints.length, 3);
    assert.deepEqual(
        watchPack.readout.checkpoints.map((chip) => chip.label),
        ['tier', 'package', 'score']
    );
    assert.equal(watchPack.readout.checkpoints[0].state, 'ready');
    assert.equal(watchPack.readout.checkpoints[1].state, 'warning');
    assert.equal(watchPack.readout.checkpoints[2].state, 'warning');
    assert.match(watchPack.readout.brief, /# Surface Package Standardization/);
    assert.match(watchPack.readout.brief, /Package owner: lucia/);

    assert.equal(watchPack.latestArtifacts.bundle.status, 'ready');
    assert.equal(watchPack.latestArtifacts.provisioning.status, 'ready');
    assert.equal(watchPack.latestArtifacts.onboardingKit.status, 'watch');

    const watchHtml = bannerModule.buildTurneroSurfacePackageBannerHtml({
        pack: watchPack,
        title: 'Display package gate',
        eyebrow: 'Package gate',
    });
    assert.match(watchHtml, /data-state="warning"/);
    assert.match(watchHtml, /Display package gate/);

    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const watchHost = new HTMLElementStub('watchBannerHost');
    const readyHost = new HTMLElementStub('readyBannerHost');

    try {
        await withGlobals(
            {
                HTMLElement: HTMLElementStub,
                document: createDomDocument(),
            },
            async () => {
                const mounted = bannerModule.mountTurneroSurfacePackageBanner(
                    watchHost,
                    {
                        pack: watchPack,
                        title: 'Display package gate',
                        eyebrow: 'Package gate',
                    }
                );

                assert.equal(mounted, watchHost);
                assert.equal(watchHost.hidden, false);
                assert.match(watchHost.innerHTML, /Display package gate/);
                assert.match(watchHost.innerHTML, /data-band="watch"/);

                const readyPack = packModule.buildTurneroSurfacePackagePack({
                    surfaceKey: 'operator-turnos',
                    clinicProfile: CLINIC_PROFILE,
                    runtimeState: 'ready',
                    truth: 'watch',
                    packageTier: 'pilot-plus',
                    bundleState: 'ready',
                    provisioningState: 'ready',
                    onboardingKitState: 'ready',
                    checklist: { summary: { all: 4, pass: 4, fail: 0 } },
                    ledger: [
                        { kind: 'bundle', status: 'ready' },
                        { kind: 'provisioning', status: 'ready' },
                        { kind: 'onboarding-kit', status: 'ready' },
                    ],
                    owners: [{ status: 'active' }],
                });

                const readyResult =
                    bannerModule.mountTurneroSurfacePackageBanner(readyHost, {
                        pack: readyPack,
                        title: 'Operator package gate',
                    });

                assert.equal(readyResult, null);
                assert.equal(readyHost.hidden, true);
                assert.equal(readyHost.innerHTML, '');
            }
        );
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
