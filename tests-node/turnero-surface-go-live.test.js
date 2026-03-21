#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');
const ORIGINAL_GLOBALS = {
    document: global.document,
    HTMLElement: global.HTMLElement,
    localStorage: global.localStorage,
};

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
        entries() {
            return Array.from(store.entries());
        },
    };
    return store;
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.ownerDocument = ownerDocument || null;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.className = '';
        this.hidden = false;
        this.style = {};
        this.attributes = new Map();
        this.eventListeners = new Map();
        this._id = '';
        this._textContent = '';
        this._innerHTML = '';
        this._value = '';
        this._type = '';
    }

    set id(value) {
        this._id = String(value || '');
        if (this.ownerDocument) {
            this.ownerDocument.registerId(this);
        }
    }

    get id() {
        return this._id;
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

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set value(value) {
        this._value = String(value ?? '');
    }

    get value() {
        return this._value;
    }

    set type(value) {
        this._type = String(value ?? '');
    }

    get type() {
        return this._type;
    }

    appendChild(child) {
        if (!(child instanceof FakeElement)) {
            throw new TypeError(
                'FakeElement only accepts FakeElement children'
            );
        }

        child.parentElement = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        if (child.id && child.ownerDocument) {
            child.ownerDocument.registerId(child);
        }
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._textContent = '';
        this._innerHTML = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    remove() {
        if (this.parentElement) {
            const index = this.parentElement.children.indexOf(this);
            if (index >= 0) {
                this.parentElement.children.splice(index, 1);
            }
            this.parentElement = null;
        }
        if (this.ownerDocument) {
            this.ownerDocument.unregisterId(this);
        }
    }

    setAttribute(name, value) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = value;
            return;
        }
        if (normalizedName === 'class') {
            this.className = String(value || '');
            return;
        }
        this.attributes.set(normalizedName, String(value || ''));
    }

    getAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            return this.id || null;
        }
        if (normalizedName === 'class') {
            return this.className || null;
        }
        return this.attributes.has(normalizedName)
            ? this.attributes.get(normalizedName)
            : null;
    }

    removeAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = '';
            return;
        }
        if (normalizedName === 'class') {
            this.className = '';
            return;
        }
        this.attributes.delete(normalizedName);
    }

    addEventListener(type, handler) {
        const normalizedType = String(type || '');
        if (!this.eventListeners.has(normalizedType)) {
            this.eventListeners.set(normalizedType, []);
        }
        this.eventListeners.get(normalizedType).push(handler);
    }

    dispatchEvent(event) {
        const normalizedType = String(event?.type || '');
        const listeners = this.eventListeners.get(normalizedType) || [];
        listeners.forEach((listener) => {
            listener.call(this, event);
        });
        return true;
    }

    click() {
        this.dispatchEvent({
            type: 'click',
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
        });
    }
}

class FakeDocument {
    constructor() {
        this._ids = new Map();
        this.head = new FakeElement('head', this);
        this.body = new FakeElement('body', this);
        this.documentElement = new FakeElement('html', this);
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    getElementById(id) {
        return this._ids.get(String(id || '')) || null;
    }

    querySelector(selector) {
        if (String(selector || '').startsWith('#')) {
            return this.getElementById(String(selector).slice(1));
        }
        return null;
    }

    registerId(element) {
        if (element && element.id) {
            this._ids.set(element.id, element);
        }
    }

    unregisterId(element) {
        if (element && element.id && this._ids.get(element.id) === element) {
            this._ids.delete(element.id);
        }
    }
}

function installFakeDom() {
    const document = new FakeDocument();
    global.HTMLElement = FakeElement;
    global.document = document;
    return document;
}

function restoreGlobals() {
    global.document = ORIGINAL_GLOBALS.document;
    global.HTMLElement = ORIGINAL_GLOBALS.HTMLElement;
    global.localStorage = ORIGINAL_GLOBALS.localStorage;
}

function buildClinicProfile(overrides = {}) {
    return {
        clinic_id: 'clinica-demo',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
        },
        ...overrides,
    };
}

test.beforeEach(() => {
    installLocalStorageMock();
});

test.afterEach(() => {
    restoreGlobals();
});

test('go-live snapshot, checklist, ledger, gate and readout compose a ready pack', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-snapshot.js'
    );
    const checklistModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-hardware-checklist.js'
    );
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-ledger.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-pack.js'
    );
    const readoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-readout.js'
    );

    const clinicProfile = buildClinicProfile();
    const snapshot = snapshotModule.buildTurneroSurfaceGoLiveSnapshot({
        scope: 'operator',
        surfaceKey: 'operator',
        surfaceLabel: 'Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'ready',
        printerState: 'ready',
        bellState: 'ready',
        signageState: 'ready',
        operatorReady: true,
        updatedAt: '2026-03-20T10:00:00.000Z',
    });
    const checklist = checklistModule.buildTurneroSurfaceHardwareChecklist({
        snapshot,
    });
    const ledger = ledgerModule.createTurneroSurfaceGoLiveLedger(
        'operator',
        clinicProfile
    );
    ledger.add({
        surfaceKey: 'operator',
        kind: 'go-live-evidence',
        status: 'ready',
        owner: 'ops',
        note: 'Ready evidence',
    });
    const pack = packModule.buildTurneroSurfaceGoLivePack({
        ...snapshot,
        clinicProfile,
        evidence: ledger.list({ surfaceKey: 'operator' }),
    });
    const readout = readoutModule.buildTurneroSurfaceGoLiveReadout({
        snapshot: pack.snapshot,
        checklist: pack.checklist,
        gate: pack.gate,
        evidence: pack.evidence,
    });

    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clinica Demo');
    assert.equal(checklist.summary.all, 6);
    assert.equal(checklist.summary.pass, 6);
    assert.equal(checklist.summary.fail, 0);
    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.gate.score, 100);
    assert.equal(readout.gateBand, 'ready');
    assert.match(readout.brief, /Surface Go-Live Readiness/);
    assert.match(readout.brief, /Ready evidence/);
});

test('go-live gate classifies watch, degraded and blocked thresholds', async () => {
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-gate.js'
    );

    const watchGate = gateModule.buildTurneroSurfaceGoLiveGate({
        checklist: {
            checks: new Array(6).fill(null).map((_, index) => ({
                key: `check-${index + 1}`,
                label: `Check ${index + 1}`,
                pass: true,
            })),
            summary: {
                all: 6,
                pass: 6,
                fail: 0,
            },
        },
        evidence: [],
    });
    const degradedGate = gateModule.buildTurneroSurfaceGoLiveGate({
        checklist: {
            checks: new Array(6).fill(null).map((_, index) => ({
                key: `check-${index + 1}`,
                label: `Check ${index + 1}`,
                pass: index < 4,
            })),
            summary: {
                all: 6,
                pass: 4,
                fail: 2,
            },
        },
        evidence: [],
    });
    const blockedGate = gateModule.buildTurneroSurfaceGoLiveGate({
        checklist: {
            checks: new Array(6).fill(null).map((_, index) => ({
                key: `check-${index + 1}`,
                label: `Check ${index + 1}`,
                pass: index < 1,
            })),
            summary: {
                all: 6,
                pass: 1,
                fail: 5,
            },
        },
        evidence: [],
    });
    const readyGate = gateModule.buildTurneroSurfaceGoLiveGate({
        checklist: {
            checks: new Array(6).fill(null).map((_, index) => ({
                key: `check-${index + 1}`,
                label: `Check ${index + 1}`,
                pass: true,
            })),
            summary: {
                all: 6,
                pass: 6,
                fail: 0,
            },
        },
        evidence: [{ status: 'ready' }],
    });

    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.score, 75);
    assert.equal(degradedGate.band, 'degraded');
    assert.equal(degradedGate.score, 50);
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.score, 100);
});

test('go-live ledger is clinic-scoped and respects scope separation', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-ledger.js'
    );

    const clinicA = buildClinicProfile({ clinic_id: 'clinic-a' });
    const clinicB = buildClinicProfile({ clinic_id: 'clinic-b' });
    const operatorLedgerA = ledgerModule.createTurneroSurfaceGoLiveLedger(
        'operator',
        clinicA
    );
    const operatorLedgerB = ledgerModule.createTurneroSurfaceGoLiveLedger(
        'operator',
        clinicB
    );
    const displayLedgerA = ledgerModule.createTurneroSurfaceGoLiveLedger(
        'display',
        clinicA
    );

    operatorLedgerA.add({
        surfaceKey: 'operator',
        kind: 'go-live-evidence',
        note: 'Clinic A operator',
    });
    displayLedgerA.add({
        surfaceKey: 'display',
        kind: 'go-live-evidence',
        note: 'Clinic A display',
    });

    assert.equal(operatorLedgerA.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(displayLedgerA.list({ surfaceKey: 'display' }).length, 1);
    assert.equal(operatorLedgerB.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(operatorLedgerA.list({ surfaceKey: 'display' }).length, 0);
});

test('go-live banner hides itself when the pack is ready', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-snapshot.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-pack.js'
    );
    const bannerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-banner.js'
    );

    const clinicProfile = buildClinicProfile();
    const snapshot = snapshotModule.buildTurneroSurfaceGoLiveSnapshot({
        scope: 'operator',
        surfaceKey: 'operator',
        surfaceLabel: 'Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'ready',
        printerState: 'ready',
        bellState: 'ready',
        signageState: 'ready',
        operatorReady: true,
    });
    const pack = packModule.buildTurneroSurfaceGoLivePack({
        ...snapshot,
        clinicProfile,
        evidence: [
            {
                id: 'evidence-1',
                scope: 'operator',
                surfaceKey: 'operator',
                kind: 'go-live-evidence',
                status: 'ready',
                owner: 'ops',
                note: 'All good',
                createdAt: '2026-03-20T10:00:00.000Z',
                updatedAt: '2026-03-20T10:00:00.000Z',
            },
        ],
    });

    installFakeDom();
    const host = document.createElement('div');
    host.id = 'go-live-banner-host';
    const mounted = bannerModule.mountTurneroSurfaceGoLiveBanner(host, {
        pack,
    });

    assert.equal(mounted, null);
    assert.equal(host.hidden, true);
    assert.equal(host.innerHTML, '');
});

test('admin go-live console renders copy/download/evidence controls and stores evidence', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-go-live-snapshot.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-go-live-console.js'
    );

    installFakeDom();

    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinic-a',
    });
    const snapshot = snapshotModule.buildTurneroSurfaceGoLiveSnapshot({
        scope: 'operator',
        surfaceKey: 'operator',
        surfaceLabel: 'Operador',
        clinicProfile,
        runtimeState: 'ready',
        truth: 'ready',
        printerState: 'ready',
        bellState: 'ready',
        signageState: 'ready',
        operatorReady: true,
    });
    const host = document.createElement('div');
    const controller = consoleModule.mountTurneroAdminQueueSurfaceGoLiveConsole(
        host,
        {
            scope: 'clinic-a',
            clinicProfile,
            snapshots: [snapshot],
        }
    );

    assert.ok(controller);
    assert.equal(controller.refs.copyButton.textContent, 'Copy brief');
    assert.equal(controller.refs.downloadButton.textContent, 'Download JSON');
    assert.equal(controller.refs.addButton.textContent, 'Add evidence');
    assert.match(
        controller.refs.briefNode.textContent,
        /Surface Go-Live Readiness/
    );
    assert.match(
        controller.refs.evidenceList.innerHTML,
        /Sin evidencia manual/
    );

    controller.refs.noteInput.value = 'Chequeo manual';
    controller.refs.addButton.click();

    assert.match(controller.refs.evidenceList.innerHTML, /Chequeo manual/);
    assert.equal(controller.pack.gate.band, 'ready');
    assert.equal(controller.pack.gate.score, 100);

    const stored = JSON.parse(
        global.localStorage.getItem('turneroSurfaceGoLiveLedgerV1') || '{}'
    );
    assert.equal(
        stored.values['clinic-a'].scopes.operator[0].note,
        'Chequeo manual'
    );
});
