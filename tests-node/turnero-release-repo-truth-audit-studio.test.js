'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadModule,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadRepoTruthAuditStudioModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-repo-truth-audit-studio.js'
    );
}

const FULL_SURFACES = Object.freeze([
    { id: 'admin-queue', label: 'Admin Queue' },
    { id: 'operator-turnos', label: 'Operator Turnos' },
    { id: 'kiosco-turnos', label: 'Kiosco Turnos' },
    { id: 'sala-turnos', label: 'Sala Turnos' },
]);

const FULL_ACTUAL_MODULES = Object.freeze([
    {
        key: 'release-control',
        label: 'Release Control',
        domain: 'governance',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'assurance',
        label: 'Assurance',
        domain: 'assurance',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'reliability',
        label: 'Reliability',
        domain: 'reliability',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'service-excellence',
        label: 'Service Excellence',
        domain: 'service',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'safety-privacy',
        label: 'Safety Privacy',
        domain: 'privacy',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'integration',
        label: 'Integration',
        domain: 'integration',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'telemetry',
        label: 'Telemetry',
        domain: 'telemetry',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'strategy',
        label: 'Strategy',
        domain: 'strategy',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'orchestration',
        label: 'Orchestration',
        domain: 'orchestration',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'diagnostic',
        label: 'Diagnostic Prep',
        domain: 'diagnostic',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
]);

const PARTIAL_ACTUAL_MODULES = Object.freeze([
    {
        key: 'release-control',
        label: 'Release Control',
        domain: 'governance',
        surface: 'admin-queue',
        mounted: true,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
    {
        key: 'assurance',
        label: 'Assurance',
        domain: 'assurance',
        surface: 'admin-queue',
        mounted: false,
        sourcePath: 'src/apps/queue-shared',
        commitRef: '',
    },
]);

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.queryNodes = new Map();
        this.children = [];
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
        this.clicked = false;
        this.download = '';
        this.href = '';
        this.rel = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.queryNodes.clear();
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
        if (!this.queryNodes.has(key)) {
            const node = new HTMLElementStub(
                key.startsWith('[data-field=') ? 'input' : 'span'
            );
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=') || key.startsWith('#')) {
                node.textContent = '';
            }
            this.queryNodes.set(key, node);
        }
        return this.queryNodes.get(key);
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
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
}

test('builds repo truth catalog, intake, comparator and score bands', async () => {
    const module = await loadRepoTruthAuditStudioModule();

    const expected = module.buildTurneroReleaseExpectedModuleCatalog();
    assert.equal(expected.rows.length, 10);
    assert.equal(expected.summary.high, 7);

    const fullActual = module.buildTurneroReleaseActualRepoIntake({
        actualModules: FULL_ACTUAL_MODULES,
    });
    assert.equal(fullActual.summary.all, 10);
    assert.equal(fullActual.summary.mounted, 10);
    assert.equal(fullActual.summary.withCommitRef, 0);

    const compare = module.buildTurneroReleaseRepoTruthComparator({
        expectedRows: expected.rows,
        actualRows: fullActual.rows,
    });
    assert.equal(compare.summary.present, 10);
    assert.equal(compare.summary.partial, 0);
    assert.equal(compare.summary.missing, 0);

    const truthMatrix = module.buildTurneroReleaseWiringTruthMatrix({
        surfaces: FULL_SURFACES,
        compareRows: compare.rows,
    });
    assert.equal(truthMatrix.rows.length, 4);
    assert.equal(truthMatrix.rows[0].surfaceId, 'admin-queue');
    assert.equal(truthMatrix.rows[0].state, 'strong');
    assert.equal(truthMatrix.rows[0].truthPct, 100);
    assert.deepEqual(
        truthMatrix.rows.slice(1).map((row) => row.state),
        ['partial', 'partial', 'partial']
    );

    const drift = module.buildTurneroReleaseDriftWatchlist({
        compareRows: compare.rows,
        provenance: [],
    });
    assert.equal(drift.summary.all, 10);
    assert.equal(drift.summary.high, 0);

    const score = module.buildTurneroReleaseRepoTruthScore({
        compareSummary: compare.summary,
        truthRows: truthMatrix.rows,
        driftSummary: drift.summary,
        provenance: [],
    });
    assert.equal(score.score, 49.5);
    assert.equal(score.band, 'uncertain');
    assert.equal(score.decision, 'audit-main-first');
});

test('provenance ledger isolates scope buckets', async () => {
    const module = await loadRepoTruthAuditStudioModule();
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const globalLedger =
            module.createTurneroReleaseProvenanceLedger('global');
        const regionalLedger =
            module.createTurneroReleaseProvenanceLedger('regional');

        assert.equal(globalLedger.list().length, 0);
        assert.equal(regionalLedger.list().length, 0);

        const entry = regionalLedger.add({
            moduleKey: 'release-control',
            commitRef: 'abc123',
            owner: 'program',
        });

        assert.equal(entry.moduleKey, 'release-control');
        assert.equal(globalLedger.list().length, 0);
        assert.equal(regionalLedger.list().length, 1);
        assert.match(
            storage.dump()['turnero-release-provenance-ledger:v1'],
            /"regional"/
        );

        regionalLedger.clear();
        assert.equal(regionalLedger.list().length, 0);
    });
});

test('mounts audit studio, supports copy/download and provenance recompute', async () => {
    const module = await loadRepoTruthAuditStudioModule();
    const clipboardTexts = [];
    const downloadClicks = [];
    const storage = createLocalStorageStub();
    const host = new HTMLElementStub(
        'div',
        'queueReleaseRepoTruthAuditStudioHost'
    );

    const blob = class MockBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    };

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(downloadClicks),
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
                createObjectURL: () => 'blob:repo-truth',
                revokeObjectURL: () => {},
            },
        },
        async () => {
            const result = module.mountTurneroReleaseRepoTruthAuditStudio(
                host,
                {
                    scope: 'regional',
                    region: 'north',
                    surfaces: FULL_SURFACES,
                    actualModules: FULL_ACTUAL_MODULES,
                }
            );

            assert.ok(result);
            assert.equal(result.root.id, 'turneroReleaseRepoTruthAuditStudio');
            assert.equal(
                result.root.dataset.turneroReleaseRepoTruthAuditStudio,
                'mounted'
            );
            assert.equal(
                result.root.dataset.turneroReleaseRepoTruthScore,
                '49.5'
            );
            assert.equal(
                result.root.dataset.turneroReleaseRepoTruthBand,
                'uncertain'
            );
            assert.equal(
                result.root.querySelector('[data-role="score"]').textContent,
                '49.5'
            );
            assert.equal(
                result.root.querySelector('[data-role="decision"]').textContent,
                'audit-main-first'
            );
            assert.match(
                result.root.querySelector('[data-role="truth-brief"]')
                    .textContent,
                /Repo Truth Audit Studio/
            );

            await result.root.listeners.get('click')({
                target: createActionTarget('copy-repo-truth-brief'),
            });
            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Repo Truth Audit Studio/);
            assert.match(clipboardTexts[0], /Truth score: 49\.5/);

            await result.root.listeners.get('click')({
                target: createActionTarget('download-repo-truth-pack'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-repo-truth-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);

            result.root.querySelector('[data-field="prov-module"]').value =
                'release-control';
            result.root.querySelector('[data-field="prov-commit"]').value =
                'abc123';
            result.root.querySelector('[data-field="prov-owner"]').value =
                'program';

            await result.root.listeners.get('click')({
                target: createActionTarget('add-provenance-entry'),
            });

            assert.equal(result.pack.provenance.length, 1);
            assert.equal(
                result.root.dataset.turneroReleaseRepoTruthScore,
                '51.5'
            );
            assert.equal(
                result.root.querySelector('[data-role="score"]').textContent,
                '51.5'
            );
            assert.match(
                result.root.querySelector('[data-role="truth-brief"]')
                    .textContent,
                /Truth score: 51\.5/
            );

            const storedLedger = JSON.parse(
                storage.dump()['turnero-release-provenance-ledger:v1']
            );
            assert.equal(storedLedger.regional.length, 1);
            assert.equal(storedLedger.regional[0].moduleKey, 'release-control');
            assert.equal(
                result.pack.drift.rows[0].driftKind,
                'commit-not-linked'
            );
        }
    );
});
