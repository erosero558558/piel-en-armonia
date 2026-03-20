'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

async function loadFreshModule(relativePath, token = Date.now()) {
    const url = pathToFileURL(resolve(REPO_ROOT, relativePath)).href;
    return import(`${url}?t=${token}`);
}

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.nodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalizedName = String(name);
        const normalizedValue = String(value);
        this.attributes.set(normalizedName, normalizedValue);
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalizedValue;
        }
    }

    getAttribute(name) {
        const normalizedName = String(name);
        if (this.attributes.has(normalizedName)) {
            return this.attributes.get(normalizedName);
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            return Object.prototype.hasOwnProperty.call(
                this.dataset,
                datasetKey
            )
                ? this.dataset[datasetKey]
                : null;
        }
        return null;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    replaceChildren(...nodes) {
        this.children = [];
        nodes.forEach((node) => {
            this.children.push(node);
            node.parentNode = this;
        });
        return nodes[0] || null;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('[data-field=') ? 'input' : 'span'
            );
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=') || key.startsWith('#')) {
                node.textContent = '';
            }
            this.nodes.set(key, node);
        }

        return this.nodes.get(key);
    }

    querySelectorAll() {
        return [];
    }

    click() {
        this.clicked = true;
    }

    remove() {
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }
}

function setGlobalValue(name, value) {
    Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
}

async function withGlobals(setup, callback) {
    const previous = {};
    for (const [key, value] of Object.entries(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        setGlobalValue(key, value);
    }

    try {
        return await callback();
    } finally {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (!descriptor) {
                delete global[key];
                continue;
            }

            Object.defineProperty(global, key, descriptor);
        }
    }
}

function createActionTarget(action) {
    return {
        closest() {
            return this;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(host, downloadClicks) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new HTMLElementStub('a');
                anchor.click = () => {
                    anchor.clicked = true;
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                        rel: anchor.rel,
                        clicked: true,
                    });
                };
                return anchor;
            }

            return new HTMLElementStub(tag);
        },
        execCommand() {
            return false;
        },
        getElementById(id) {
            return String(id) === 'queueReleaseMainlineClosureCockpitHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-mainline-closure-cockpit]'
                ? host
                : null;
        },
    };
}

function buildMainlineClosureCurrentSnapshot() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-mainline',
        region: 'north',
        branding: {
            name: 'Clínica Mainline',
            short_name: 'Mainline',
            base_url: 'https://mainline.example',
        },
        runtime_meta: {
            source: 'file',
            profileFingerprint: 'mainline-1234',
        },
    });

    return {
        clinicId: 'clinica-mainline',
        clinicLabel: 'Clínica Mainline',
        clinicShortName: 'Mainline',
        region: 'north',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        generatedAt: '2026-03-19T12:00:00.000Z',
    };
}

test('builds the default mainline closure pack and score bands', async () => {
    const module = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-mainline-closure-cockpit.js',
        'mainline-closure-pack'
    );

    const manifest = module.buildTurneroReleaseFinalTruthManifest();
    assert.equal(manifest.rows.length, 8);
    assert.equal(manifest.summary.all, 8);
    assert.equal(manifest.summary.surfaces, 4);
    assert.equal(manifest.summary.integrations, 3);
    assert.equal(manifest.summary.diagnostics, 1);

    const evidence = module.buildTurneroReleaseCloseoutEvidencePack({
        manifestRows: manifest.rows,
    });
    assert.equal(evidence.summary.all, 8);
    assert.equal(evidence.summary.complete, 5);
    assert.equal(evidence.summary.partial, 3);
    assert.equal(evidence.summary.missing, 0);

    const handoff = module.buildTurneroReleaseSurfaceHandoffAudit({
        evidenceRows: evidence.rows,
    });
    assert.equal(handoff.summary.all, 4);
    assert.equal(handoff.summary.ready, 1);
    assert.equal(handoff.summary.watch, 0);
    assert.equal(handoff.summary.blocked, 3);

    const plan = module.buildTurneroReleaseMainlineClosurePlan({
        blockedSurfaces: handoff.rows.filter((row) => row.state !== 'ready'),
    });
    assert.equal(plan.summary.all, 3);
    assert.equal(plan.summary.p1, 3);
    assert.equal(plan.summary.p2, 0);

    const readout = module.buildTurneroReleaseDiagnosticReadoutScore({
        evidenceSummary: evidence.summary,
        handoffSummary: handoff.summary,
        ledgerRows: [],
        closureRows: plan.rows,
    });
    assert.equal(readout.score, 58);
    assert.equal(readout.band, 'blocked');
    assert.equal(readout.decision, 'closeout-first');

    const finalHandoff = module.buildTurneroReleaseFinalDiagnosticHandoff({
        scope: 'north',
        region: 'north',
        clinicLabel: 'Clínica Mainline',
        evidence,
        handoff,
        closeoutLedger: [],
        closurePlan: plan,
        readout,
    });
    assert.match(finalHandoff.markdown, /Mainline Closure Cockpit/);
    assert.match(finalHandoff.markdown, /Closure score: 58/);
    assert.match(finalHandoff.markdown, /Open closeout items: 0/);
    assert.match(finalHandoff.markdown, /Ready surfaces: 1\/4/);
});

test('mounts, copies, downloads and updates closeout ledger idempotently', async () => {
    const clipboardTexts = [];
    const downloadClicks = [];
    const storage = createLocalStorageStub();
    const host = new HTMLElementStub(
        'div',
        'queueReleaseMainlineClosureCockpitHost'
    );
    const clinicProfile =
        buildMainlineClosureCurrentSnapshot().turneroClinicProfile;
    const currentSnapshot = buildMainlineClosureCurrentSnapshot();

    const blob = class MockBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    };

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host, downloadClicks),
            localStorage: storage,
            navigator: {
                clipboard: {
                    writeText: async (text) => {
                        clipboardTexts.push(String(text));
                    },
                },
            },
            Blob: blob,
            URL: {
                createObjectURL: () => 'blob:mainline-closure',
                revokeObjectURL: () => {},
            },
        },
        async () => {
            const store = await loadModule(
                'src/apps/admin-v3/shared/core/store.js'
            );
            const wrapper = await loadFreshModule(
                'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/mainline-closure-cockpit.js',
                'mainline-closure-wrapper'
            );

            const state = store.getState();
            store.setState({
                ...state,
                data: {
                    ...state.data,
                    turneroClinicProfile: clinicProfile,
                    turneroReleaseEvidenceBundle: currentSnapshot,
                    turneroReleaseSnapshot: currentSnapshot,
                    currentSnapshot,
                },
            });

            try {
                const result = wrapper.renderQueueMainlineClosureCockpit(
                    { id: 'queue' },
                    'web'
                );

                assert.ok(result);
                assert.equal(host.children.length, 1);

                const root = host.children[0];
                assert.equal(root.id, 'turneroReleaseMainlineClosureCockpit');
                assert.equal(
                    root.dataset.turneroReleaseMainlineClosureCockpit,
                    'mounted'
                );
                assert.equal(
                    root.dataset.turneroReleaseMainlineClosureScope,
                    'north'
                );
                assert.equal(
                    root.dataset.turneroReleaseMainlineClosureBand,
                    'blocked'
                );
                assert.equal(
                    root.dataset.turneroReleaseMainlineClosureScore,
                    '58'
                );
                assert.match(root.innerHTML, /Mainline Closure Cockpit/);
                assert.match(root.innerHTML, /Copy closure brief/);
                assert.match(root.innerHTML, /Download closure JSON/);
                assert.match(root.innerHTML, /Add closeout item/);
                assert.equal(
                    root.querySelector('[data-role="score"]').textContent,
                    '58'
                );
                assert.equal(
                    root.querySelector('[data-role="open-count"]').textContent,
                    '0'
                );

                const clickHandler = root.listeners.get('click');
                assert.equal(typeof clickHandler, 'function');

                await clickHandler({
                    target: createActionTarget('copy-closure-brief'),
                });
                assert.equal(clipboardTexts.length, 1);
                assert.match(clipboardTexts[0], /# Mainline Closure Cockpit/);
                assert.match(clipboardTexts[0], /Closure score: 58/);

                await clickHandler({
                    target: createActionTarget('download-closure-pack'),
                });
                assert.equal(downloadClicks.length, 1);
                assert.equal(
                    downloadClicks[0].download,
                    'turnero-release-mainline-closure-pack.json'
                );
                assert.equal(downloadClicks[0].clicked, true);

                root.querySelector('[data-field="closeout-title"]').value =
                    'Closeout sync for admin queue';
                root.querySelector('[data-field="closeout-owner"]').value =
                    'ops';
                root.querySelector('[data-field="closeout-surface"]').value =
                    'admin-queue';

                await clickHandler({
                    target: createActionTarget('add-closeout-item'),
                });

                assert.equal(result.pack.closeoutLedger.length, 1);
                assert.equal(
                    result.pack.closeoutLedger[0].title,
                    'Closeout sync for admin queue'
                );
                assert.equal(result.pack.handoff.summary.all, 4);
                assert.equal(result.pack.handoff.summary.ready, 0);
                assert.equal(result.pack.handoff.summary.watch, 1);
                assert.equal(
                    result.pack.handoff.rows.find(
                        (row) => row.surfaceId === 'admin-queue'
                    ).closeoutOpen,
                    1
                );
                assert.equal(result.pack.closurePlan.summary.all, 5);
                assert.equal(result.pack.readout.score, 49.8);
                assert.equal(result.pack.readout.band, 'blocked');
                assert.equal(
                    root.dataset.turneroReleaseMainlineClosureScore,
                    '49.8'
                );
                assert.equal(
                    root.querySelector('[data-role="score"]').textContent,
                    '49.8'
                );
                assert.equal(
                    root.querySelector('[data-role="open-count"]').textContent,
                    '1'
                );
                assert.match(
                    root.querySelector('[data-role="closure-brief"]')
                        .textContent,
                    /Closure score: 49\.8/
                );
                assert.match(
                    result.pack.finalHandoff.markdown,
                    /Open closeout items: 1/
                );
                assert.match(
                    result.pack.finalHandoff.markdown,
                    /Closure score: 49\.8/
                );

                const rerendered = wrapper.renderQueueMainlineClosureCockpit(
                    { id: 'queue' },
                    'web'
                );
                assert.ok(rerendered);
                assert.equal(host.children.length, 1);
                assert.equal(
                    host.children[0].id,
                    'turneroReleaseMainlineClosureCockpit'
                );
            } finally {
                store.resetState();
            }
        }
    );
});

test('source wiring covers the host, wrapper and shared cockpit module', () => {
    const headerPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
    );
    const installHubPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
    );
    const wrapperPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/mainline-closure-cockpit.js'
    );
    const sharedPath = resolve(
        REPO_ROOT,
        'src/apps/queue-shared/turnero-release-mainline-closure-cockpit.js'
    );

    const headerSource = readFileSync(headerPath, 'utf8');
    const installHubSource = readFileSync(installHubPath, 'utf8');
    const wrapperSource = readFileSync(wrapperPath, 'utf8');
    const sharedSource = readFileSync(sharedPath, 'utf8');

    assert.match(headerSource, /queueReleaseMainlineClosureCockpitHost/);
    assert.match(headerSource, /data-turnero-release-mainline-closure-cockpit/);
    assert.match(installHubSource, /renderQueueMainlineClosureCockpit/);
    assert.match(installHubSource, /queueReleaseMainlineClosureCockpitHost/);
    assert.match(wrapperSource, /wireTurneroMainlineClosureCockpit/);
    assert.match(wrapperSource, /renderQueueMainlineClosureCockpit/);
    assert.match(sharedSource, /mountTurneroReleaseMainlineClosureCockpit/);
    assert.match(sharedSource, /buildTurneroReleaseFinalTruthManifest/);
});
