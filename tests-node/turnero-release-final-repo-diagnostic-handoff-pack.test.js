'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const BlobCtor =
    typeof Blob !== 'undefined' ? Blob : require('node:buffer').Blob;

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
        this.clicked = false;
        this.removed = false;
        this.download = '';
        this.href = '';
        this.rel = '';
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
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
                key.includes('[data-field=') ? 'input' : 'span',
                key.startsWith('#') ? key.slice(1) : ''
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

    focus() {}

    select() {}

    click() {
        this.clicked = true;
    }

    remove() {
        this.removed = true;
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

function createDocumentStub(host, downloadCalls) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            if (String(tag).toLowerCase() === 'a') {
                const anchor = new HTMLElementStub('a');
                anchor.click = () => {
                    anchor.clicked = true;
                    downloadCalls.push({
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
            return String(id) === 'queueFinalRepoDiagnosticHandoffPackHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-final-repo-diagnostic-handoff-pack]'
                ? host
                : null;
        },
    };
}

function buildReadyEvidenceRows() {
    return [
        {
            id: 'ev-1',
            label: 'Mainline audit pack',
            kind: 'audit',
            owner: 'program',
            status: 'ready',
            exportKey: 'mainline-audit',
        },
        {
            id: 'ev-2',
            label: 'Closure cockpit pack',
            kind: 'closure',
            owner: 'ops',
            status: 'ready',
            exportKey: 'closure-cockpit',
        },
        {
            id: 'ev-3',
            label: 'Honest diagnosis pack',
            kind: 'verdict',
            owner: 'program',
            status: 'ready',
            exportKey: 'honest-diagnosis',
        },
        {
            id: 'ev-4',
            label: 'Runtime/source comparison',
            kind: 'runtime',
            owner: 'infra',
            status: 'ready',
            exportKey: 'runtime-diff',
        },
    ];
}

function buildCurrentSnapshot(clinicProfile, overrides = {}) {
    return {
        clinicId: 'clinica-demo',
        clinicLabel: 'Clínica Demo',
        clinicShortName: 'Demo',
        region: 'north',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        evidence: buildReadyEvidenceRows(),
        blockers: [],
        launchGate: {
            decision: 'launch-honest-diagnostic',
        },
        workspaceVerdict: {
            verdict: 'ready-for-honest-diagnostic',
        },
        generatedAt: '2026-03-19T12:00:00.000Z',
        ...overrides,
    };
}

test('persists the diagnostic session and audit queue per scope', async () => {
    const sessionRegistryModule = await loadModule(
        'src/apps/queue-shared/turnero-release-diagnostic-session-registry.js'
    );
    const auditQueueModule = await loadModule(
        'src/apps/queue-shared/turnero-release-repo-audit-queue.js'
    );

    await withGlobals(
        {
            localStorage: createLocalStorageStub(),
        },
        async () => {
            const sessionRegistry =
                sessionRegistryModule.createTurneroReleaseDiagnosticSessionRegistry(
                    'north'
                );
            sessionRegistry.clear();

            const storedSession = sessionRegistry.set({
                status: 'prepared',
                operator: 'program',
                note: 'Final repo handoff prepared',
            });

            assert.equal(storedSession.scope, 'north');
            assert.equal(storedSession.status, 'prepared');
            assert.equal(storedSession.operator, 'program');
            assert.equal(storedSession.note, 'Final repo handoff prepared');

            const sameScopeSession =
                sessionRegistryModule.createTurneroReleaseDiagnosticSessionRegistry(
                    'north'
                );
            assert.equal(sameScopeSession.get()?.status, 'prepared');
            assert.equal(
                sameScopeSession.get()?.note,
                'Final repo handoff prepared'
            );

            const otherScopeSession =
                sessionRegistryModule.createTurneroReleaseDiagnosticSessionRegistry(
                    'south'
                );
            assert.equal(otherScopeSession.get(), null);

            const auditQueue =
                auditQueueModule.createTurneroReleaseRepoAuditQueue('north');
            auditQueue.clear();

            const added = auditQueue.add({
                title: 'Repo audit task',
                owner: 'program',
                area: 'repo',
                status: 'queued',
                note: 'Queue the final diagnostic handoff',
            });

            assert.equal(added.scope, 'north');
            assert.equal(added.title, 'Repo audit task');
            assert.equal(added.owner, 'program');
            assert.equal(added.area, 'repo');
            assert.equal(added.status, 'queued');

            const rows = auditQueue.list();
            assert.equal(rows.length, 1);
            assert.equal(rows[0].id, added.id);
            assert.equal(rows[0].note, 'Queue the final diagnostic handoff');

            const sameScopeQueue =
                auditQueueModule.createTurneroReleaseRepoAuditQueue('north');
            assert.equal(sameScopeQueue.list().length, 1);

            const otherScopeQueue =
                auditQueueModule.createTurneroReleaseRepoAuditQueue('south');
            assert.equal(otherScopeQueue.list().length, 0);
        }
    );
});

test('builds the empty-state defaults for the final repo handoff pack', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-release-final-repo-diagnostic-handoff-pack.js'
    );

    await withGlobals(
        {
            localStorage: createLocalStorageStub(),
        },
        async () => {
            const pack =
                module.buildTurneroReleaseFinalRepoDiagnosticHandoffPack();

            assert.equal(pack.exportIndex.summary.all, 4);
            assert.equal(pack.exportIndex.summary.pending, 1);
            assert.equal(pack.verdict.decision, 'blocked');
            assert.equal(pack.verdict.openBlockers, 2);
            assert.equal(pack.verdict.highOpen, 1);
            assert.equal(pack.packageScore.score, 65.8);
            assert.equal(pack.packageScore.band, 'review');
            assert.equal(pack.packageScore.decision, 'hold-pack');
            assert.equal(pack.timeline.rows.length, 4);
            assert.equal(
                pack.downloadFileName,
                'turnero-release-final-repo-diagnostic-handoff-pack.json'
            );
            assert.match(
                pack.packageReport.markdown,
                /# Final Repo Diagnostic Handoff Pack/
            );
        }
    );
});

test('wires the host, rerenders idempotently and supports copy/download actions', async () => {
    const wrapperModule = await loadModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/final-repo-diagnostic-handoff-pack.js'
    );
    const sessionRegistryModule = await loadModule(
        'src/apps/queue-shared/turnero-release-diagnostic-session-registry.js'
    );

    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-demo',
        region: 'north',
        branding: {
            name: 'Clínica Demo',
            short_name: 'Demo',
            base_url: 'https://demo.example',
        },
    });
    const manifest = {
        id: 'turnero-final-repo-handoff-manifest',
        label: 'Final repo diagnostic handoff pack',
    };
    const currentSnapshot = buildCurrentSnapshot(clinicProfile, {
        blockers: [
            {
                id: 'blk-1',
                kind: 'release-clean',
                owner: 'program',
                severity: 'low',
                status: 'closed',
                note: 'All blockers cleared.',
            },
        ],
    });
    const host = new HTMLElementStub(
        'div',
        'queueFinalRepoDiagnosticHandoffPackHost'
    );
    const downloadCalls = [];
    const clipboardWrites = [];
    const downloadedBlobs = [];
    const revokedUrls = [];

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host, downloadCalls),
            navigator: {
                clipboard: {
                    writeText: async (value) => {
                        clipboardWrites.push(String(value));
                        return true;
                    },
                },
            },
            localStorage: createLocalStorageStub(),
            Blob: BlobCtor,
            URL: {
                createObjectURL(blob) {
                    downloadedBlobs.push(blob);
                    return 'blob:turnero-final-handoff';
                },
                revokeObjectURL(url) {
                    revokedUrls.push(url);
                },
            },
            setTimeout: (fn) => {
                fn();
                return 0;
            },
        },
        async () => {
            sessionRegistryModule
                .createTurneroReleaseDiagnosticSessionRegistry('north')
                .set({
                    status: 'draft',
                    operator: 'program',
                    note: 'Waiting for final preparation',
                });

            const mounted =
                wrapperModule.wireTurneroReleaseFinalRepoDiagnosticHandoffPack({
                    manifest,
                    detectedPlatform: 'web',
                    currentSnapshot,
                    clinicProfile,
                });

            assert.ok(mounted);
            assert.equal(mounted.pack.detectedPlatform, 'web');
            assert.equal(
                mounted.pack.sourceManifest.id,
                'turnero-final-repo-handoff-manifest'
            );
            assert.equal(host.children.length, 1);

            const firstRoot = host.children[0];
            assert.equal(
                firstRoot.id,
                'turneroReleaseFinalRepoDiagnosticHandoffPack'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffPack,
                'mounted'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffScope,
                'north'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffRegion,
                'north'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffClinicId,
                'clinica-demo'
            );
            assert.equal(
                firstRoot.dataset
                    .turneroReleaseFinalRepoDiagnosticHandoffDecision,
                'finish-audit-queue'
            );
            assert.equal(
                firstRoot.dataset.turneroReleaseFinalRepoDiagnosticHandoffBand,
                'near-ready'
            );
            assert.equal(
                firstRoot.dataset
                    .turneroReleaseFinalRepoDiagnosticHandoffSessionStatus,
                'draft'
            );
            assert.match(
                firstRoot.innerHTML,
                /Final Repo Diagnostic Handoff Pack/
            );

            const prepareClick = firstRoot.listeners.get('click');
            assert.equal(typeof prepareClick, 'function');

            await prepareClick({
                target: createActionTarget('prepare-session'),
            });

            assert.equal(
                host.dataset
                    .turneroReleaseFinalRepoDiagnosticHandoffSessionStatus,
                'prepared'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffScore,
                '97.5'
            );
            assert.equal(
                host.dataset.turneroReleaseFinalRepoDiagnosticHandoffDecision,
                'ship-final-diagnostic-pack'
            );

            const rerenderedRoot = host.children[0];
            assert.equal(
                rerenderedRoot.dataset
                    .turneroReleaseFinalRepoDiagnosticHandoffSessionStatus,
                'prepared'
            );

            const activeClick = rerenderedRoot.listeners.get('click');
            assert.equal(typeof activeClick, 'function');

            await activeClick({
                target: createActionTarget('copy-handoff-pack'),
            });
            assert.equal(clipboardWrites.length, 1);
            assert.match(
                clipboardWrites[0],
                /# Final Repo Diagnostic Handoff Pack/
            );
            assert.match(clipboardWrites[0], /Session status: prepared/);
            assert.match(clipboardWrites[0], /Package score: 97\.5 \(ready\)/);

            await activeClick({
                target: createActionTarget('download-handoff-pack'),
            });
            assert.equal(downloadCalls.length, 1);
            assert.equal(
                downloadCalls[0].download,
                'turnero-release-final-repo-diagnostic-handoff-pack.json'
            );
            assert.equal(downloadedBlobs.length, 1);
            const downloadedJson = await downloadedBlobs[0].text();
            assert.match(downloadedJson, /"clinicLabel": "Clínica Demo"/);
            assert.match(
                downloadedJson,
                /"decision": "ship-final-diagnostic-pack"/
            );
            assert.deepEqual(revokedUrls, ['blob:turnero-final-handoff']);

            mounted.recompute();
            assert.equal(host.children.length, 1);
            assert.equal(
                host.children[0].dataset
                    .turneroReleaseFinalRepoDiagnosticHandoffDecision,
                'ship-final-diagnostic-pack'
            );
        }
    );
});
