'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
} = require('./turnero-release-test-fixtures.js');

async function loadFinalDiagnosticModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-final-diagnostic-execution-console.js'
    );
}

const MANIFEST_ROWS = Object.freeze([
    { key: 'queue-core', label: 'Queue Core' },
    { key: 'remote-readiness', label: 'Remote Readiness' },
    { key: 'release-governance', label: 'Release Governance' },
    { key: 'assurance', label: 'Assurance' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'privacy', label: 'Safety Privacy' },
    { key: 'telemetry', label: 'Telemetry' },
    { key: 'strategy', label: 'Strategy' },
    { key: 'orchestration', label: 'Orchestration' },
]);

const SURFACES = Object.freeze([
    {
        key: 'admin',
        label: 'Admin web',
        owner: 'deploy',
        route: '/admin.html#queue',
        enabled: true,
    },
    {
        key: 'operator',
        label: 'Operador web',
        owner: 'ops',
        route: '/operador-turnos.html',
        enabled: true,
    },
    {
        key: 'kiosk',
        label: 'Kiosco web',
        owner: 'ops',
        route: '/kiosco-turnos.html',
        enabled: true,
    },
    {
        key: 'display',
        label: 'Sala web',
        owner: 'deploy',
        route: '/sala-turnos.html',
        enabled: true,
    },
]);

function buildContracts() {
    return SURFACES.map((surface) => ({
        id: `${surface.key}-contract`,
        key: `${surface.key}-contract`,
        label: `${surface.label} contract`,
        surfaceId: surface.key,
        owner: surface.owner,
        version: 'v1',
        criticality:
            surface.key === 'admin' || surface.key === 'display'
                ? 'critical'
                : 'high',
        state: 'pass',
        source: surface.key,
        target: surface.route,
    }));
}

function buildRegistryRows() {
    return MANIFEST_ROWS.map((row, index) => ({
        id: `registry-${index + 1}`,
        key: row.key,
        label: `${row.label} registry`,
        mounted: true,
        state: 'present',
        source: 'manual',
    }));
}

function buildInventoryRows() {
    return MANIFEST_ROWS.map((row, index) => ({
        id: `inventory-${index + 1}`,
        key: row.key,
        label: `${row.label} inventory`,
        readiness: 'present',
        state: 'ready',
        source: 'manual',
    }));
}

function buildFinalDiagnosticInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-demo',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
        },
    });
    const contracts = buildContracts();
    const registryRows = buildRegistryRows();
    const inventoryRows = buildInventoryRows();
    const releaseEvidenceBundle = {
        generatedAt: '2026-03-18T12:00:00.000Z',
        blockers: [],
        surfaces: SURFACES,
        contracts,
        registryRows,
        inventoryRows,
        gaps: [],
    };
    const currentSnapshot = {
        clinicId: 'clinica-demo',
        clinicName: 'Clinica Demo',
        brandName: 'Demo',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        releaseEvidenceBundle,
        parts: {
            clinicProfile,
            releaseEvidenceBundle,
        },
        surfaces: SURFACES,
        contracts,
        registryRows,
        inventoryRows,
        gaps: [],
    };

    return {
        generatedAt: '2026-03-18T12:00:00.000Z',
        clinicId: 'clinica-demo',
        clinicLabel: 'Clinica Demo',
        detectedPlatform: 'web',
        currentSnapshot,
        releaseEvidenceBundle,
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        surfaces: SURFACES,
        contracts,
        registryRows,
        inventoryRows,
        gaps: [],
    };
}

class StubElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.queryNodes = new Map();
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.className = '';
        this._innerHTML = '';
        this.parentNode = null;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.queryNodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const key = String(name);
        const normalized = String(value);
        this.attributes.set(key, normalized);
        if (key.startsWith('data-')) {
            const datasetKey = key
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalized;
        }
    }

    getAttribute(name) {
        const key = String(name);
        if (this.attributes.has(key)) {
            return this.attributes.get(key);
        }
        return null;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
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
        if (!this.queryNodes.has(key)) {
            const node = new StubElement('span');
            if (key.includes('[data-field=')) {
                node.value = '';
            } else if (key.includes('[data-role=') || key.startsWith('#')) {
                node.textContent = '';
            }
            this.queryNodes.set(key, node);
        }
        return this.queryNodes.get(key);
    }

    querySelectorAll() {
        return [];
    }

    focus() {}

    select() {}

    click() {
        if (typeof this.onclick === 'function') {
            this.onclick();
        }
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }
}

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
        closest(selector) {
            return selector === '[data-action]' ? this : null;
        },
    };
}

function createDocumentStub(downloadClicks, downloadEvents) {
    return {
        body: new StubElement('body'),
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new StubElement('a');
                anchor.click = () => {
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                    });
                };
                return anchor;
            }

            return new StubElement(tag);
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
        execCommand(command) {
            downloadEvents.push({ kind: 'execCommand', command });
            return true;
        },
    };
}

function withGlobals(setup, callback) {
    const previous = {};
    for (const key of Object.keys(setup)) {
        previous[key] = global[key];
        try {
            global[key] = setup[key];
        } catch (_error) {
            Object.defineProperty(global, key, {
                configurable: true,
                writable: true,
                value: setup[key],
            });
        }
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const key of Object.keys(setup)) {
                const value = previous[key];
                try {
                    if (value === undefined) {
                        delete global[key];
                    } else {
                        global[key] = value;
                    }
                } catch (_error) {
                    Object.defineProperty(global, key, {
                        configurable: true,
                        writable: true,
                        value,
                    });
                }
            }
        });
}

test('final diagnostic pack builds the full release chain', async () => {
    const module = await loadFinalDiagnosticModule();
    const input = buildFinalDiagnosticInput();
    const pack =
        module.buildTurneroReleaseFinalDiagnosticExecutionConsolePack(input);

    assert.equal(pack.manifest.rows.length, 9);
    assert.equal(pack.wiringAudit.summary.pass, 9);
    assert.equal(pack.surfaceContractAudit.summary.pass, 4);
    assert.equal(pack.registryRows.length, 9);
    assert.equal(pack.inventoryRows.length, 9);
    assert.ok(pack.registryRows.every((row) => row.state === 'present'));
    assert.ok(pack.inventoryRows.every((row) => row.readiness === 'present'));
    assert.equal(pack.domainConvergenceAudit.summary.converged, 9);
    assert.equal(pack.finalGaps.summary.all, 0);
    assert.equal(pack.closeoutPlan.summary.all, 0);
    assert.equal(pack.readiness.score, 100);
    assert.equal(pack.readiness.band, 'ready');
    assert.equal(pack.readiness.decision, 'run-final-diagnostic');
    assert.equal(pack.generatedAt, input.generatedAt);
    assert.match(pack.briefMarkdown, /Final Diagnostic Execution Console/);
    assert.match(pack.briefMarkdown, /Readiness score: 100 \(ready\)/);
    assert.match(pack.briefMarkdown, /Closeout items: 0/);
});

test('mountTurneroReleaseFinalDiagnosticExecutionConsole monta el host y ejecuta copy/download', async () => {
    const module = await loadFinalDiagnosticModule();
    const input = buildFinalDiagnosticInput();
    const clipboardTexts = [];
    const downloadClicks = [];
    const downloadEvents = [];
    const host = new StubElement(
        'div',
        'queueFinalDiagnosticExecutionConsoleHost'
    );
    const documentStub = createDocumentStub(downloadClicks, downloadEvents);

    await withGlobals(
        {
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            document: documentStub,
            navigator: {
                clipboard: {
                    async writeText(text) {
                        clipboardTexts.push(String(text));
                    },
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                    downloadEvents.push({ kind: 'blob', parts, options });
                }
            },
            URL: {
                createObjectURL(blob) {
                    downloadEvents.push({ kind: 'url', blob });
                    return 'blob:turnero-final-diagnostic';
                },
                revokeObjectURL(href) {
                    downloadEvents.push({ kind: 'revoke', href });
                },
            },
            setTimeout: (fn) => {
                downloadEvents.push({ kind: 'timeout' });
                fn();
                return 0;
            },
        },
        async () => {
            const result =
                module.mountTurneroReleaseFinalDiagnosticExecutionConsole(
                    host,
                    input
                );

            assert.ok(result);
            assert.equal(host.children.length, 1);
            assert.equal(
                result.root.id,
                'turneroReleaseFinalDiagnosticExecutionConsole'
            );
            assert.equal(
                result.root.dataset
                    .turneroReleaseFinalDiagnosticExecutionConsole,
                'mounted'
            );
            assert.equal(
                result.root.dataset.turneroReleaseFinalDiagnosticReadiness,
                'ready'
            );
            assert.equal(
                result.root.dataset.turneroReleaseFinalDiagnosticDecision,
                'run-final-diagnostic'
            );
            assert.equal(
                result.root.dataset.turneroReleaseFinalDiagnosticClinicId,
                'clinica-demo'
            );
            assert.match(
                result.root.innerHTML,
                /Final Diagnostic Execution Console/
            );
            assert.match(result.root.innerHTML, /Copy closeout brief/);
            assert.match(
                result.root.innerHTML,
                /Download final diagnostic JSON/
            );
            assert.equal(
                result.pack.downloadFileName,
                'turnero-release-final-diagnostic-pack.json'
            );

            const clickHandler = host.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: createActionTarget('copy-closeout-brief'),
            });

            assert.equal(clipboardTexts.length, 1);
            assert.match(
                clipboardTexts[0],
                /# Final Diagnostic Execution Console/
            );
            assert.match(clipboardTexts[0], /Clinic: Clinica Demo/);

            await clickHandler({
                target: createActionTarget('download-final-diagnostic-pack'),
            });

            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-final-diagnostic-pack.json'
            );
            assert.ok(
                downloadClicks[0].href.startsWith(
                    'blob:turnero-final-diagnostic'
                )
            );
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'url'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'revoke'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'timeout'));
        }
    );
});
