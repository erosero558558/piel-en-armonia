'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

let modulePromise = null;

async function loadIntegrationModule() {
    if (!modulePromise) {
        modulePromise = loadModule(
            'src/apps/queue-shared/turnero-release-integration-command-center.js'
        );
    }

    return modulePromise;
}

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.style = {};
        this.className = '';
        this.value = '';
        this.checked = false;
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
        this.__queries = new Map();
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
        this.__queries = new Map();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        const value = this.attributes.get(String(name));
        return value === undefined ? null : value;
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
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

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.__queries.has(key)) {
            if (key === '#turneroReleaseIntegrationCommandCenter') {
                const root = new HTMLElementStub(
                    'section',
                    'turneroReleaseIntegrationCommandCenter'
                );
                this.__queries.set(key, root);
                return root;
            }

            const node = new HTMLElementStub('span');
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=')) {
                node.textContent = '';
            }
            this.__queries.set(key, node);
        }

        return this.__queries.get(key);
    }

    querySelectorAll() {
        return [];
    }

    focus() {
        this.focused = true;
    }

    select() {
        this.selected = true;
    }

    click() {
        this.clicked = true;
    }

    remove() {
        this.removed = true;
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
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(downloadClicks) {
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
                        clicked: true,
                    });
                };
                return anchor;
            }

            return new HTMLElementStub(tag);
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
}

function buildReleaseIncidents() {
    return [
        {
            id: 'incident-1',
            title: 'Health ping lag',
            severity: 'warning',
            owner: 'infra',
        },
        {
            id: 'incident-2',
            title: 'Public sync note',
            severity: 'critical',
            owner: 'web',
        },
    ];
}

function buildHealthyIntegrationInputs() {
    return {
        contracts: [
            {
                id: 'contract-health',
                label: 'Health Public Contract',
                source: 'admin queue',
                target: 'api.php?resource=health',
                owner: 'infra',
                version: 'v1',
                criticality: 'critical',
                freshnessSlaMinutes: 10,
                state: 'active',
            },
            {
                id: 'contract-public-sync',
                label: 'Public Sync Contract',
                source: 'public shell',
                target: 'public_main_sync',
                owner: 'web',
                version: 'v1',
                criticality: 'high',
                freshnessSlaMinutes: 15,
                state: 'active',
            },
            {
                id: 'contract-figo-bridge',
                label: 'Figo Bridge Contract',
                source: 'queue surfaces',
                target: 'figo bridge',
                owner: 'backend',
                version: 'v1',
                criticality: 'critical',
                freshnessSlaMinutes: 12,
                state: 'active',
            },
        ],
        exchanges: [
            {
                id: 'exchange-admin-health',
                label: 'Admin -> Health',
                source: 'admin queue',
                target: 'health endpoint',
                direction: 'read',
                payloadClass: 'operational',
                owner: 'infra',
            },
            {
                id: 'exchange-shell-sync',
                label: 'Public shell sync',
                source: 'public shell',
                target: 'public sync',
                direction: 'bidirectional',
                payloadClass: 'operational',
                owner: 'web',
            },
            {
                id: 'exchange-figo-queue',
                label: 'Queue -> Figo bridge',
                source: 'queue surfaces',
                target: 'figo bridge',
                direction: 'bidirectional',
                payloadClass: 'clinical-sensitive',
                owner: 'backend',
            },
        ],
        healthSignals: [
            { contractId: 'contract-health', lagMinutes: 4, successRate: 98 },
            {
                contractId: 'contract-public-sync',
                lagMinutes: 5,
                successRate: 97,
            },
            {
                contractId: 'contract-figo-bridge',
                lagMinutes: 6,
                successRate: 96,
            },
        ],
        bridgeSignals: [
            {
                id: 'bridge-figo',
                label: 'Figo bridge',
                latencyMs: 940,
                errorRate: 1.2,
                freshnessLag: 8,
            },
            {
                id: 'bridge-public',
                label: 'Public sync bridge',
                latencyMs: 1180,
                errorRate: 1.8,
                freshnessLag: 12,
            },
        ],
    };
}

function buildContractSummaryFixture() {
    return {
        contracts: [
            {
                id: 'contract-health',
                label: 'Health Public Contract',
                source: 'admin queue',
                target: 'api.php?resource=health',
                owner: 'infra',
                version: 'v1',
                criticality: 'critical',
                freshnessSlaMinutes: 10,
                state: 'active',
            },
            {
                id: 'contract-public-sync',
                label: 'Public Sync Contract',
                source: 'public shell',
                target: 'public_main_sync',
                owner: 'web',
                version: 'v1',
                criticality: 'high',
                freshnessSlaMinutes: 15,
                state: 'watch',
            },
            {
                id: 'contract-figo-bridge',
                label: 'Figo Bridge Contract',
                source: 'queue surfaces',
                target: 'figo bridge',
                owner: 'backend',
                version: 'v1',
                criticality: 'critical',
                freshnessSlaMinutes: 12,
                state: 'degraded',
            },
        ],
        exchanges: [
            {
                id: 'exchange-admin-health',
                label: 'Admin -> Health',
                source: 'admin queue',
                target: 'health endpoint',
                direction: 'read',
                payloadClass: 'operational',
                owner: 'infra',
            },
            {
                id: 'exchange-shell-sync',
                label: 'Public shell sync',
                source: 'public shell',
                target: 'public sync',
                direction: 'bidirectional',
                payloadClass: 'operational',
                owner: 'web',
            },
            {
                id: 'exchange-figo-queue',
                label: 'Queue -> Figo bridge',
                source: 'queue surfaces',
                target: 'figo bridge',
                direction: 'bidirectional',
                payloadClass: 'clinical-sensitive',
                owner: 'backend',
            },
        ],
        healthSignals: [
            { contractId: 'contract-health', lagMinutes: 4, successRate: 98 },
            {
                contractId: 'contract-public-sync',
                lagMinutes: 18,
                successRate: 86,
            },
            {
                contractId: 'contract-figo-bridge',
                lagMinutes: 34,
                successRate: 74,
            },
        ],
        bridgeSignals: [
            {
                id: 'bridge-figo',
                label: 'Figo bridge',
                latencyMs: 980,
                errorRate: 1.2,
                freshnessLag: 8,
            },
            {
                id: 'bridge-public',
                label: 'Public sync bridge',
                latencyMs: 1680,
                errorRate: 3.5,
                freshnessLag: 19,
            },
        ],
    };
}

test('integration builders summarize contracts, exchanges, SLA, bridge and confidence', async () => {
    const module = await loadIntegrationModule();
    const summaryFixture = buildContractSummaryFixture();

    const contracts = module.buildTurneroReleaseIntegrationContractRegistry({
        contracts: summaryFixture.contracts,
    });
    assert.equal(contracts.summary.all, 3);
    assert.equal(contracts.summary.critical, 2);
    assert.equal(contracts.summary.active, 1);
    assert.equal(contracts.summary.watch, 1);
    assert.equal(contracts.summary.degraded, 1);

    const exchanges = module.buildTurneroReleaseDataExchangeMap({
        exchanges: summaryFixture.exchanges,
    });
    assert.equal(exchanges.summary.all, 3);
    assert.equal(exchanges.summary.bidirectional, 2);
    assert.equal(exchanges.summary.sensitive, 1);

    const sla = module.buildTurneroReleaseSyncSlaMonitor({
        contracts: summaryFixture.contracts,
        healthSignals: summaryFixture.healthSignals,
    });
    assert.equal(sla.summary.all, 3);
    assert.equal(sla.summary.healthy, 1);
    assert.equal(sla.summary.watch, 1);
    assert.equal(sla.summary.breach, 1);

    const bridge = module.buildTurneroReleaseBridgeObservabilityPack({
        bridgeSignals: summaryFixture.bridgeSignals,
    });
    assert.equal(bridge.summary.all, 2);
    assert.equal(bridge.summary.healthy, 1);
    assert.equal(bridge.summary.watch, 1);
    assert.equal(bridge.summary.degraded, 0);

    const confidence = module.buildTurneroReleaseIntegrationConfidenceScore({
        contractSummary: { degraded: 0, watch: 1 },
        slaSummary: { breach: 0, watch: 1 },
        replayQueue: [{ state: 'queued' }],
        mappingDebt: [],
        bridgeSummary: { watch: 1, degraded: 0 },
        releaseDecision: 'review',
    });
    assert.equal(confidence.score, 80);
    assert.equal(confidence.band, 'stable');
    assert.equal(confidence.decision, 'review');
    assert.equal(confidence.releaseDecision, 'review');
});

test('mount renders actions, keeps clinic-scoped storage separate, and updates the pack', async () => {
    const module = await loadIntegrationModule();
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloadClicks = [];
    const blobs = [];
    const documentStub = createDocumentStub(downloadClicks);
    const clinicProfileA = buildClinicProfile({
        clinic_id: 'clinic-a',
        region: 'north',
        branding: {
            name: 'Clínica Norte',
            short_name: 'Norte',
        },
    });
    const clinicProfileB = buildClinicProfile({
        clinic_id: 'clinic-b',
        region: 'south',
        branding: {
            name: 'Clínica Sur',
            short_name: 'Sur',
        },
    });
    const currentSnapshotA = {
        generatedAt: '2026-03-18T12:00:00.000Z',
        clinicId: 'clinic-a',
        region: 'north',
        clinicName: 'Clínica Norte',
        clinicShortName: 'Norte',
        releaseDecision: 'review',
    };
    const currentSnapshotB = {
        generatedAt: '2026-03-18T12:05:00.000Z',
        clinicId: 'clinic-b',
        region: 'south',
        clinicName: 'Clínica Sur',
        clinicShortName: 'Sur',
        releaseDecision: 'review',
    };
    const healthyInputs = buildHealthyIntegrationInputs();
    const host = new HTMLElementStub(
        'div',
        'queueReleaseIntegrationCommandCenterHost'
    );

    await withGlobals(
        {
            localStorage: storage,
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            HTMLInputElement: HTMLElementStub,
            HTMLTextAreaElement: HTMLElementStub,
            Blob: global.Blob,
            URL: {
                createObjectURL(blob) {
                    blobs.push(blob);
                    return 'blob:turnero-release-integration-pack';
                },
                revokeObjectURL() {},
            },
            navigator: {
                clipboard: {
                    async writeText(text) {
                        clipboard.push(text);
                    },
                },
            },
            document: documentStub,
        },
        async () => {
            const mountedA = module.mountTurneroReleaseIntegrationCommandCenter(
                host,
                {
                    currentSnapshot: currentSnapshotA,
                    clinicProfile: clinicProfileA,
                    releaseDecision: 'review',
                    releaseIncidents: buildReleaseIncidents(),
                    contracts: healthyInputs.contracts,
                    exchanges: healthyInputs.exchanges,
                    healthSignals: healthyInputs.healthSignals,
                    bridgeSignals: healthyInputs.bridgeSignals,
                }
            );

            assert.ok(mountedA);
            assert.equal(
                host.dataset.turneroIntegrationCommandCenterMounted,
                'true'
            );
            assert.equal(
                host.dataset.turneroIntegrationCommandCenterClinicId,
                'clinic-a'
            );
            assert.equal(
                host.dataset.turneroIntegrationCommandCenterScope,
                'clinic-a'
            );
            assert.equal(
                host.dataset.turneroIntegrationCommandCenterReleaseDecision,
                'review'
            );
            assert.equal(
                mountedA.root.querySelector('[data-role="confidence-score"]')
                    .textContent,
                '94'
            );
            assert.equal(
                mountedA.root
                    .querySelector('[data-role="replay-summary"]')
                    .textContent.trim(),
                'Open 0 · Closed 0'
            );
            assert.equal(
                mountedA.root
                    .querySelector('[data-role="mapping-summary"]')
                    .textContent.trim(),
                'Open 0 · Closed 0'
            );

            const clickHandler = host.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: createActionTarget('copy-integration-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /Integration Command Center/);
            assert.match(clipboard[0], /Release decision: review/);
            assert.match(clipboard[0], /Confidence: 94 \(strong\) · review/);

            await clickHandler({
                target: createActionTarget('download-integration-pack'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-integration-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);
            const downloadedPack = JSON.parse(await blobs[0].text());
            assert.equal(downloadedPack.summary.confidenceScore, 94);
            assert.equal(downloadedPack.contracts.summary.all, 3);

            mountedA.root.querySelector('[data-field="replay-label"]').value =
                'Replay missing bridge';
            mountedA.root.querySelector('[data-field="replay-owner"]').value =
                'integration';
            mountedA.root.querySelector(
                '[data-field="replay-contract"]'
            ).value = 'contract-figo-bridge';
            await clickHandler({
                target: createActionTarget('add-replay-item'),
            });
            assert.equal(mountedA.pack.summary.replayOpenCount, 1);
            assert.equal(
                mountedA.root
                    .querySelector('[data-role="replay-summary"]')
                    .textContent.trim(),
                'Open 1 · Closed 0'
            );
            assert.equal(mountedA.pack.confidence.score, 91);
            assert.equal(
                mountedA.root.querySelector('[data-role="confidence-score"]')
                    .textContent,
                '91'
            );

            mountedA.root.querySelector('[data-field="mapping-label"]').value =
                'Clinic mapping debt';
            mountedA.root.querySelector('[data-field="mapping-owner"]').value =
                'backend';
            mountedA.root.querySelector('[data-field="mapping-flow"]').value =
                'figo bridge';
            await clickHandler({
                target: createActionTarget('add-mapping-debt'),
            });
            assert.equal(mountedA.pack.summary.mappingOpenCount, 1);
            assert.equal(
                mountedA.root
                    .querySelector('[data-role="mapping-summary"]')
                    .textContent.trim(),
                'Open 1 · Closed 0'
            );
            assert.equal(mountedA.pack.confidence.score, 87);
            assert.equal(
                mountedA.root.querySelector('[data-role="confidence-score"]')
                    .textContent,
                '87'
            );

            const dump = storage.dump();
            const replayEnvelope = JSON.parse(
                dump['turnero-release-replay-recovery-queue:v1']
            );
            const mappingEnvelope = JSON.parse(
                dump['turnero-release-mapping-debt-ledger:v1']
            );
            assert.equal(replayEnvelope.values['clinic-a'].length, 1);
            assert.equal(mappingEnvelope.values['clinic-a'].length, 1);

            const mountedB = module.mountTurneroReleaseIntegrationCommandCenter(
                host,
                {
                    currentSnapshot: currentSnapshotB,
                    clinicProfile: clinicProfileB,
                    releaseDecision: 'review',
                    releaseIncidents: buildReleaseIncidents(),
                    contracts: healthyInputs.contracts,
                    exchanges: healthyInputs.exchanges,
                    healthSignals: healthyInputs.healthSignals,
                    bridgeSignals: healthyInputs.bridgeSignals,
                }
            );

            assert.ok(mountedB);
            assert.equal(
                host.dataset.turneroIntegrationCommandCenterClinicId,
                'clinic-b'
            );
            assert.equal(mountedB.pack.summary.replayOpenCount, 0);
            assert.equal(mountedB.pack.summary.mappingOpenCount, 0);
            assert.equal(
                mountedB.root
                    .querySelector('[data-role="replay-summary"]')
                    .textContent.trim(),
                'Open 0 · Closed 0'
            );
            assert.equal(
                mountedB.root
                    .querySelector('[data-role="mapping-summary"]')
                    .textContent.trim(),
                'Open 0 · Closed 0'
            );

            const mountedAAgain =
                module.mountTurneroReleaseIntegrationCommandCenter(host, {
                    currentSnapshot: currentSnapshotA,
                    clinicProfile: clinicProfileA,
                    releaseDecision: 'review',
                    releaseIncidents: buildReleaseIncidents(),
                    contracts: healthyInputs.contracts,
                    exchanges: healthyInputs.exchanges,
                    healthSignals: healthyInputs.healthSignals,
                    bridgeSignals: healthyInputs.bridgeSignals,
                });

            assert.ok(mountedAAgain);
            assert.equal(mountedAAgain.pack.summary.replayOpenCount, 1);
            assert.equal(mountedAAgain.pack.summary.mappingOpenCount, 1);
            assert.equal(
                mountedAAgain.root
                    .querySelector('[data-role="replay-summary"]')
                    .textContent.trim(),
                'Open 1 · Closed 0'
            );
            assert.equal(
                mountedAAgain.root
                    .querySelector('[data-role="mapping-summary"]')
                    .textContent.trim(),
                'Open 1 · Closed 0'
            );
        }
    );
});

test('source files wire the new host and render path', () => {
    const headerSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
        ),
        'utf8'
    );
    const installHubSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
        ),
        'utf8'
    );
    const moduleSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/queue-shared/turnero-release-integration-command-center.js'
        ),
        'utf8'
    );

    assert.match(headerSource, /queueReleaseIntegrationCommandCenterHost/);
    assert.match(
        installHubSource,
        /mountTurneroReleaseIntegrationCommandCenter/
    );
    assert.match(
        installHubSource,
        /renderQueueReleaseIntegrationCommandCenter/
    );
    assert.match(moduleSource, /turneroReleaseIntegrationCommandCenter/);
    assert.match(moduleSource, /download-integration-pack/);
});
