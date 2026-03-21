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

const CANONICAL_SURFACES = Object.freeze([
    {
        id: 'operator',
        key: 'operator-turnos',
        route: '/operador-turnos.html',
        label: 'Turnero Operador',
    },
    {
        id: 'kiosk',
        key: 'kiosco-turnos',
        route: '/kiosco-turnos.html',
        label: 'Turnero Kiosco',
    },
    {
        id: 'sala_tv',
        key: 'sala-turnos',
        route: '/sala-turnos.html',
        label: 'Turnero Sala TV',
    },
]);

const READY_MANIFEST = Object.freeze({
    schema: 'turnero-release-bundle/v1',
    version: '2026.03.20',
    apps: {
        operator: {
            version: '1.0.0',
            files: ['operator.js'],
            targets: {
                web: { url: '/operator.js' },
            },
        },
        kiosk: {
            version: '1.0.0',
            files: ['kiosk.js'],
            targets: {
                web: { url: '/kiosk.js' },
            },
        },
        sala_tv: {
            version: '1.0.0',
            files: ['display.js'],
            targets: {
                web: { url: '/display.js' },
            },
        },
    },
});

const CLINIC_PROFILE = Object.freeze({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clínica Demo',
        short_name: 'Demo',
    },
    release: {
        mode: 'suite_v2',
    },
    runtime_meta: {
        source: 'remote',
    },
});

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, handler) {
        const key = String(type || '');
        if (!key || typeof handler !== 'function') {
            return;
        }
        const handlers = this.listeners.get(key) || [];
        handlers.push(handler);
        this.listeners.set(key, handlers);
    }

    dispatchEvent(event) {
        const payload =
            event && typeof event === 'object'
                ? event
                : { type: String(event || '') };
        const handlers = this.listeners.get(String(payload.type || '')) || [];
        handlers.forEach((handler) => {
            handler.call(this, payload);
        });
        return true;
    }
}

class FakeElement extends FakeEventTarget {
    constructor(tagName = 'div') {
        super();
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = '';
        this.parentElement = null;
        this.children = [];
        this.firstElementChild = null;
        this.dataset = {};
        this.attributes = {};
        this.style = {};
        this.className = '';
        this._innerHTML = '';
        this._textContent = '';
        this.clicked = false;
    }

    setAttribute(name, value) {
        const key = String(name || '').trim();
        const normalized = String(value ?? '');
        if (!key) {
            return;
        }

        this.attributes[key] = normalized;
        if (key === 'id') {
            this.id = normalized;
        }
        if (key === 'class') {
            this.className = normalized;
        }
        if (key.startsWith('data-')) {
            const dataKey = key
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[dataKey] = normalized;
        }
    }

    getAttribute(name) {
        const key = String(name || '').trim();
        if (!key) {
            return null;
        }
        if (key === 'id') {
            return this.id || null;
        }
        if (key === 'class') {
            return this.className || null;
        }
        return Object.hasOwn(this.attributes, key)
            ? this.attributes[key]
            : null;
    }

    appendChild(child) {
        if (!child) {
            return child;
        }
        child.parentElement = this;
        this.children.push(child);
        this._innerHTML = this.children
            .map((node) => node.outerHTML || node.innerHTML || '')
            .join('');
        this.firstElementChild = this.children[0] || null;
        return child;
    }

    replaceChildren(...children) {
        this.children = children.filter(Boolean);
        this.children.forEach((child) => {
            child.parentElement = this;
        });
        this._innerHTML = this.children
            .map((node) => node.outerHTML || node.innerHTML || '')
            .join('');
        this.firstElementChild = this.children[0] || null;
    }

    prepend(child) {
        if (!child) {
            return child;
        }
        child.parentElement = this;
        this.children.unshift(child);
        this._innerHTML = this.children
            .map((node) => node.outerHTML || node.innerHTML || '')
            .join('');
        this.firstElementChild = this.children[0] || null;
        return child;
    }

    remove() {
        if (!this.parentElement) {
            return;
        }
        const parent = this.parentElement;
        parent.children = parent.children.filter((child) => child !== this);
        parent._innerHTML = parent.children
            .map((node) => node.outerHTML || node.innerHTML || '')
            .join('');
        parent.firstElementChild = parent.children[0] || null;
        this.parentElement = null;
    }

    click() {
        this.clicked = true;
    }

    closest(selector) {
        const normalized = String(selector || '').trim();
        if (!normalized) {
            return null;
        }

        let current = this;
        while (current) {
            if (
                normalized === '[data-action]' &&
                current.dataset &&
                current.dataset.action !== undefined
            ) {
                return current;
            }
            if (
                normalized.startsWith('#') &&
                current.id === normalized.slice(1)
            ) {
                return current;
            }
            current = current.parentElement;
        }

        return null;
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        const trimmed = this._innerHTML.trim();
        if (!trimmed) {
            this.children = [];
            this.firstElementChild = null;
            return;
        }

        const match = trimmed.match(/<\s*([a-z0-9-]+)/i);
        const child = new FakeElement(match ? match[1] : 'div');
        child._innerHTML = this._innerHTML;
        child.parentElement = this;
        this.children = [child];
        this.firstElementChild = child;
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set textContent(value) {
        this._textContent = String(value ?? '');
        this._innerHTML = this._textContent;
        this.children = [];
        this.firstElementChild = null;
    }

    get textContent() {
        return this._textContent || this._innerHTML;
    }

    get outerHTML() {
        const attrs = [];
        if (this.id) {
            attrs.push(`id="${this.id}"`);
        }
        if (this.className) {
            attrs.push(`class="${this.className}"`);
        }
        Object.entries(this.attributes).forEach(([key, value]) => {
            if (key === 'id' || key === 'class') {
                return;
            }
            attrs.push(`${key}="${value}"`);
        });

        return `<${this.tagName.toLowerCase()}${
            attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
        }>${this._innerHTML}</${this.tagName.toLowerCase()}>`;
    }
}

class FakeDocument {
    constructor() {
        this.body = new FakeElement('body');
    }

    createElement(tagName) {
        return new FakeElement(tagName);
    }
}

function buildRegistry({
    manifestSource = 'primary',
    surfaces = CANONICAL_SURFACES,
    manifest = READY_MANIFEST,
    mode = 'ready',
    resolvedManifestUrl = '/release-manifest.json',
    warnings = [],
    errors = [],
} = {}) {
    return {
        surfacesUrl: '/data/turnero-surfaces.json',
        requestedManifestUrl: '/release-manifest.json',
        resolvedManifestUrl,
        manifestUrl: resolvedManifestUrl,
        manifestSource,
        surfaces: surfaces.map((surface) => ({ ...surface })),
        manifest,
        mode,
        warnings: [...warnings],
        errors: [...errors],
        loadedAt: '2026-03-20T12:00:00.000Z',
    };
}

function buildReadyRegistry() {
    return buildRegistry();
}

function buildWatchRegistry() {
    return buildRegistry({
        manifestSource: 'fallback',
        mode: 'watch',
        resolvedManifestUrl: '/app-downloads/pilot/release-manifest.json',
        warnings: ['manifest_root_fallback:/release-manifest.json'],
    });
}

function buildDegradedRegistry() {
    return buildRegistry({
        mode: 'degraded',
        surfaces: CANONICAL_SURFACES.map((surface) =>
            surface.id === 'kiosk'
                ? { ...surface, enabled: false }
                : { ...surface }
        ),
    });
}

function installFakeDom() {
    const previous = {
        document: global.document,
        HTMLElement: global.HTMLElement,
        Element: global.Element,
        navigatorDescriptor: Object.getOwnPropertyDescriptor(
            global,
            'navigator'
        ),
        Blob: global.Blob,
        URL: global.URL,
    };
    const clipboardWrites = [];
    const createdAnchors = [];
    const fakeDocument = new FakeDocument();

    global.document = fakeDocument;
    global.HTMLElement = FakeElement;
    global.Element = FakeElement;
    Object.defineProperty(global, 'navigator', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: {
            clipboard: {
                writeText: async (value) => {
                    clipboardWrites.push(String(value));
                },
            },
        },
    });
    global.Blob = class FakeBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    };
    global.URL = {
        createObjectURL(blob) {
            createdAnchors.push({ type: 'blob', blob });
            return `blob:turnero-${createdAnchors.length}`;
        },
        revokeObjectURL() {},
    };

    const originalCreateElement = fakeDocument.createElement.bind(fakeDocument);
    fakeDocument.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (String(tagName).toLowerCase() === 'a') {
            createdAnchors.push(element);
        }
        return element;
    };

    return {
        document: fakeDocument,
        clipboardWrites,
        createdAnchors,
        restore() {
            global.document = previous.document;
            global.HTMLElement = previous.HTMLElement;
            global.Element = previous.Element;
            if (previous.navigatorDescriptor) {
                Object.defineProperty(
                    global,
                    'navigator',
                    previous.navigatorDescriptor
                );
            } else {
                delete global.navigator;
            }
            global.Blob = previous.Blob;
            global.URL = previous.URL;
        },
    };
}

function installLocalStorageMock() {
    const previous = global.localStorage;
    const store = new Map();
    global.localStorage = {
        getItem(key) {
            const normalizedKey = String(key || '');
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
        },
        setItem(key, value) {
            store.set(String(key || ''), String(value));
        },
        removeItem(key) {
            store.delete(String(key || ''));
        },
        clear() {
            store.clear();
        },
    };

    return {
        restore() {
            if (typeof previous === 'undefined') {
                delete global.localStorage;
                return;
            }
            global.localStorage = previous;
        },
    };
}

test('turnero surface registry source usa manifest primario y fallback visible', async () => {
    const registrySourceModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-registry-source.js'
    );

    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url) => {
        const requestUrl = String(url);
        calls.push(requestUrl);
        if (requestUrl === '/data/turnero-surfaces.json') {
            return {
                ok: true,
                status: 200,
                async json() {
                    return CANONICAL_SURFACES;
                },
            };
        }

        if (requestUrl === '/release-manifest.json') {
            return {
                ok: true,
                status: 200,
                async json() {
                    return READY_MANIFEST;
                },
            };
        }

        throw new Error(`unexpected_fetch:${requestUrl}`);
    };

    try {
        registrySourceModule.clearTurneroSurfaceRegistrySourceCache();
        const result =
            await registrySourceModule.loadTurneroSurfaceRegistrySource({
                refresh: true,
            });

        assert.equal(result.manifestSource, 'primary');
        assert.equal(result.mode, 'ready');
        assert.equal(result.resolvedManifestUrl, '/release-manifest.json');
        assert.equal(result.surfaces.length, 3);
        assert.equal(calls.length, 2);
    } finally {
        global.fetch = originalFetch;
    }
});

test('turnero surface registry source hace fallback visible al manifest del piloto', async () => {
    const registrySourceModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-registry-source.js'
    );

    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url) => {
        const requestUrl = String(url);
        calls.push(requestUrl);
        if (requestUrl === '/data/turnero-surfaces.json') {
            return {
                ok: true,
                status: 200,
                async json() {
                    return CANONICAL_SURFACES;
                },
            };
        }

        if (requestUrl === '/release-manifest.json') {
            return {
                ok: false,
                status: 404,
                async json() {
                    return {};
                },
            };
        }

        if (requestUrl === '/app-downloads/pilot/release-manifest.json') {
            return {
                ok: true,
                status: 200,
                async json() {
                    return READY_MANIFEST;
                },
            };
        }

        throw new Error(`unexpected_fetch:${requestUrl}`);
    };

    try {
        registrySourceModule.clearTurneroSurfaceRegistrySourceCache();
        const result =
            await registrySourceModule.loadTurneroSurfaceRegistrySource({
                refresh: true,
            });

        assert.equal(result.manifestSource, 'fallback');
        assert.equal(
            result.resolvedManifestUrl,
            '/app-downloads/pilot/release-manifest.json'
        );
        assert.equal(result.mode, 'watch');
        assert.ok(
            result.warnings.includes(
                'manifest_root_fallback:/release-manifest.json'
            )
        );
        assert.equal(calls.length, 3);
    } finally {
        global.fetch = originalFetch;
    }
});

test('truth pack y readiness pack distinguen ready, watch, degraded y unknown', async () => {
    const truthModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-release-truth.js'
    );
    const readinessModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-release-readiness-pack.js'
    );

    const readyPack = truthModule.buildTurneroSurfaceReleaseTruthPack({
        registry: buildReadyRegistry(),
    });
    const watchPack = truthModule.buildTurneroSurfaceReleaseTruthPack({
        registry: buildWatchRegistry(),
    });
    const degradedPack = truthModule.buildTurneroSurfaceReleaseTruthPack({
        registry: buildDegradedRegistry(),
    });
    const unknownPack = truthModule.buildTurneroSurfaceReleaseTruthPack({
        registry: {
            surfaces: [],
            manifest: null,
            manifestSource: 'missing',
        },
    });

    const readyReadiness =
        readinessModule.buildTurneroSurfaceReleaseReadinessPack({
            registry: buildReadyRegistry(),
            clinicProfile: CLINIC_PROFILE,
            surfaceKey: 'operator',
        });
    const watchReadiness =
        readinessModule.buildTurneroSurfaceReleaseReadinessPack({
            registry: buildWatchRegistry(),
            clinicProfile: CLINIC_PROFILE,
            surfaceKey: 'operator',
        });
    const degradedReadiness =
        readinessModule.buildTurneroSurfaceReleaseReadinessPack({
            registry: buildDegradedRegistry(),
            clinicProfile: CLINIC_PROFILE,
            surfaceKey: 'kiosk',
        });
    const unknownReadiness =
        readinessModule.buildTurneroSurfaceReleaseReadinessPack({
            registry: {
                surfaces: [],
                manifest: null,
                manifestSource: 'missing',
            },
            clinicProfile: {},
        });

    assert.equal(readyPack.summary.mode, 'ready');
    assert.equal(readyPack.summary.aligned, 3);
    assert.equal(watchPack.summary.mode, 'watch');
    assert.equal(degradedPack.summary.mode, 'degraded');
    assert.equal(unknownPack.summary.mode, 'unknown');

    assert.equal(readyReadiness.band, 'ready');
    assert.equal(readyReadiness.summary.state, 'ready');
    assert.equal(watchReadiness.band, 'watch');
    assert.equal(watchReadiness.summary.state, 'watch');
    assert.equal(degradedReadiness.band, 'degraded');
    assert.equal(degradedReadiness.summary.state, 'degraded');
    assert.equal(unknownReadiness.band, 'unknown');
    assert.equal(unknownReadiness.summary.state, 'unknown');
    assert.equal(unknownReadiness.smoke.summary.score, 0);
});

test('runtime bootstrap y panel admin montan sus hosts y muestran degradado visible', async () => {
    const runtimeBootstrapModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-runtime-bootstrap.js'
    );
    const adminTruthPanelModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-truth-panel.js'
    );

    const fakeDom = installFakeDom();
    try {
        const bootstrapHost = fakeDom.document.createElement('section');
        bootstrapHost.id = 'kioskSurfaceRuntimeBootstrap';
        const bootstrapController =
            runtimeBootstrapModule.mountTurneroSurfaceRuntimeBootstrap(
                bootstrapHost,
                {
                    registry: buildDegradedRegistry(),
                    clinicProfile: CLINIC_PROFILE,
                    surfaceKey: 'kiosk',
                    runtimeState: {
                        state: 'degraded',
                        status: 'offline',
                        summary: 'snapshot missing',
                    },
                    heartbeat: {
                        status: 'degraded',
                        summary: 'heartbeat stalled',
                    },
                    storageInfo: {
                        state: 'degraded',
                        scope: 'kiosk',
                        key: 'offline-outbox',
                    },
                    currentRoute: '/kiosco-turnos.html',
                }
            );
        await bootstrapController.ready;
        assert.match(
            bootstrapController.root.outerHTML,
            /turnero-surface-runtime-bootstrap/
        );
        assert.match(bootstrapController.root.outerHTML, /Launch badge/);
        assert.match(
            bootstrapController.root.outerHTML,
            /Checklist de arranque/
        );
        assert.match(
            bootstrapController.root.outerHTML,
            /turnero-surface-safe-mode-banner/
        );
        assert.match(
            bootstrapController.root.outerHTML,
            /data-band="degraded"/
        );

        const panelHost = fakeDom.document.createElement('div');
        panelHost.id = 'queueSurfaceTruthPanel';
        const panelController =
            adminTruthPanelModule.mountTurneroAdminQueueSurfaceTruthPanel(
                panelHost,
                {
                    registry: buildReadyRegistry(),
                    clinicProfile: CLINIC_PROFILE,
                    surfaceKey: 'operator',
                    currentRoute: '/admin.html#queue',
                }
            );
        await panelController.ready;
        assert.match(
            panelController.root.outerHTML,
            /turnero-admin-queue-surface-truth-panel/
        );
        assert.match(panelController.root.outerHTML, /Copy brief/);
        assert.match(panelController.root.outerHTML, /Download JSON/);
        assert.match(panelController.root.outerHTML, /data-band="ready"/);

        const copyButton = fakeDom.document.createElement('button');
        copyButton.dataset.action = 'copy-brief';
        copyButton.closest = (selector) =>
            selector === '[data-action]' ? copyButton : null;
        panelController.root.dispatchEvent({
            type: 'click',
            target: copyButton,
            preventDefault() {},
        });
        assert.ok(fakeDom.clipboardWrites.length >= 1);
        assert.match(fakeDom.clipboardWrites[0], /# Turnero Surface Truth/);
        assert.match(fakeDom.clipboardWrites[0], /# Turnero Surface Readiness/);

        const downloadButton = fakeDom.document.createElement('button');
        downloadButton.dataset.action = 'download-json';
        downloadButton.closest = (selector) =>
            selector === '[data-action]' ? downloadButton : null;
        panelController.root.dispatchEvent({
            type: 'click',
            target: downloadButton,
            preventDefault() {},
        });
        const anchor = fakeDom.createdAnchors.find(
            (item) => item && item.tagName === 'A'
        );
        assert.ok(anchor);
        assert.equal(anchor.download, 'turnero-surface-truth.json');
        assert.equal(anchor.clicked, true);
    } finally {
        fakeDom.restore();
    }
});

test('smoke helpers alinean runtime snapshot, gate y readout', async () => {
    const releaseTruthModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-release-truth.js'
    );
    const runtimeSnapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-runtime-snapshot.js'
    );
    const smokeGateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-smoke-gate.js'
    );
    const smokeReadoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-smoke-readout.js'
    );
    const evidenceStoreModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-smoke-evidence-store.js'
    );
    const syncPackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-sync-pack.js'
    );

    const truthPack = releaseTruthModule.buildTurneroSurfaceReleaseTruthPack({
        registry: buildReadyRegistry(),
    });
    const surfacePacks = truthPack.rows.map((row) => ({
        label: row.label,
        surfaceKey: row.surfaceKey,
        remoteHandoffs: [],
        pack: syncPackModule.buildTurneroSurfaceSyncPack({
            surfaceKey: row.surfaceKey,
            queueVersion: row.manifestVersion,
            visibleTurn: row.surfaceKey === 'operator' ? 'A-100' : '',
            announcedTurn: row.surfaceKey === 'operator' ? 'A-100' : '',
            handoffState: 'clear',
            heartbeat: {
                state: 'ready',
                channel: 'browser',
            },
            updatedAt: '2026-03-20T12:00:00.000Z',
            expectedVisibleTurn: row.surfaceKey === 'operator' ? 'A-100' : '',
            expectedQueueVersion: row.manifestVersion,
            handoffs: [],
        }),
    }));
    const evidenceStore =
        evidenceStoreModule.createTurneroSurfaceSmokeEvidenceStore(
            'queue',
            CLINIC_PROFILE
        );
    evidenceStore.add({
        surfaceKey: 'operator',
        title: 'Printer check',
        note: 'Recepción térmica validada.',
        status: 'captured',
        author: 'admin',
    });
    const runtimeSnapshot =
        runtimeSnapshotModule.buildTurneroSurfaceRuntimeSnapshot({
            registry: buildReadyRegistry(),
            truthPack,
            surfaceKey: 'operator',
            currentRoute: '/operador-turnos.html',
            visibilityState: 'visible',
            online: true,
            readinessBand: 'ready',
            runtimeState: 'ready',
            visibleTurn: 'A-100',
            announcedTurn: 'A-100',
            handoffState: 'clear',
            heartbeat: {
                state: 'ready',
                channel: 'browser',
            },
            updatedAt: '2026-03-20T12:00:00.000Z',
        });
    const smokeGate = smokeGateModule.buildTurneroSurfaceSmokeGate({
        surfacePacks,
        runtimeSnapshot,
        evidenceSummary: evidenceStore.summary(),
        openHandoffs: 0,
        manifestSource: runtimeSnapshot.manifestSource,
    });
    const smokeReadout = smokeReadoutModule.buildTurneroSurfaceSmokeReadout({
        reconciler: runtimeSnapshot.reconciler,
        runtimeSnapshot,
        smokeGate,
        evidenceSummary: evidenceStore.summary(),
        surfacePacks,
        openHandoffs: 0,
    });

    assert.equal(runtimeSnapshot.ready, true);
    assert.equal(runtimeSnapshot.summary.state, 'ready');
    assert.equal(runtimeSnapshot.summary.manifestSource, 'primary');
    assert.equal(evidenceStore.summary().captured, 1);
    assert.equal(smokeGate.band, 'ready');
    assert.equal(smokeReadout.summary.state, 'ready');
    assert.equal(smokeReadout.summary.surfaceReadyCount, 3);
    assert.match(smokeReadout.summary.brief, /evidence/i);
});

test('smoke console admin persiste evidencia y expone copy/download/handoff actions', async () => {
    const smokeConsoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-smoke-console.js'
    );
    const releaseTruthModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-release-truth.js'
    );
    const syncPackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-sync-pack.js'
    );
    const evidenceStoreModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-smoke-evidence-store.js'
    );

    const fakeDom = installFakeDom();
    const storage = installLocalStorageMock();
    try {
        const truthPack =
            releaseTruthModule.buildTurneroSurfaceReleaseTruthPack({
                registry: buildReadyRegistry(),
            });
        const surfacePacks = truthPack.rows.map((row, index) => ({
            label: row.label,
            surfaceKey: row.surfaceKey,
            remoteHandoffs:
                index === 0
                    ? [
                          {
                              id: 'remote-handoff-1',
                              scope: 'queue',
                              surfaceKey: row.surfaceKey,
                              title: 'Operador C1 fijo',
                              note: 'Validar continuidad.',
                              status: 'open',
                              source: 'remote_surface',
                          },
                      ]
                    : [],
            pack: syncPackModule.buildTurneroSurfaceSyncPack({
                surfaceKey: row.surfaceKey,
                queueVersion: row.manifestVersion,
                visibleTurn: row.surfaceKey === 'operator' ? 'A-100' : '',
                announcedTurn: row.surfaceKey === 'operator' ? 'A-100' : '',
                handoffState: 'clear',
                heartbeat: {
                    state: 'ready',
                    channel: 'browser',
                },
                updatedAt: '2026-03-20T12:00:00.000Z',
                expectedVisibleTurn:
                    row.surfaceKey === 'operator' ? 'A-100' : '',
                expectedQueueVersion: row.manifestVersion,
                handoffs: [],
            }),
        }));
        const evidenceStore =
            evidenceStoreModule.createTurneroSurfaceSmokeEvidenceStore(
                'queue',
                CLINIC_PROFILE
            );
        evidenceStore.add({
            surfaceKey: 'operator',
            title: 'Printer check',
            note: 'Recepción térmica validada.',
            status: 'captured',
            author: 'admin',
        });

        const host = fakeDom.document.createElement('div');
        host.id = 'queueSurfaceSyncConsoleHost';
        const controller =
            smokeConsoleModule.mountTurneroAdminQueueSurfaceSmokeConsole(host, {
                registry: buildReadyRegistry(),
                clinicProfile: CLINIC_PROFILE,
                truthPack,
                surfacePacks,
                scope: 'queue',
            });
        await controller.ready;

        assert.match(controller.state.brief, /Printer check/);
        assert.equal(controller.state.openHandoffs.length, 1);
        assert.ok(
            controller.state.openHandoffs.some(
                (item) => item.title === 'Operador C1 fijo'
            )
        );

        controller.root.querySelector = (selector) => {
            switch (selector) {
                case '[data-field="evidence-surface-key"]':
                    return { value: 'kiosk' };
                case '[data-field="evidence-title"]':
                    return { value: 'Camera check' };
                case '[data-field="evidence-note"]':
                    return { value: 'La cámara responde.' };
                case '[data-field="evidence-status"]':
                    return { value: 'review' };
                case '[data-field="surface-key"]':
                    return { value: 'operator:c1' };
                case '[data-field="title"]':
                    return { value: 'Shift relay' };
                case '[data-field="note"]':
                    return {
                        value: 'Confirmar continuidad del handoff desde admin.',
                    };
                default:
                    return null;
            }
        };

        const addEvidenceButton = fakeDom.document.createElement('button');
        addEvidenceButton.dataset.action = 'add-evidence';
        addEvidenceButton.closest = (selector) =>
            selector === '[data-action]' ? addEvidenceButton : null;
        controller.root.dispatchEvent({
            type: 'click',
            target: addEvidenceButton,
            preventDefault() {},
        });
        assert.ok(controller.state.evidenceItems.length >= 2);
        assert.match(controller.state.brief, /Camera check/);

        const remountedHost = fakeDom.document.createElement('div');
        remountedHost.id = 'queueSurfaceSyncConsoleHostReload';
        const remountedController =
            smokeConsoleModule.mountTurneroAdminQueueSurfaceSmokeConsole(
                remountedHost,
                {
                    registry: buildReadyRegistry(),
                    clinicProfile: CLINIC_PROFILE,
                    truthPack,
                    surfacePacks,
                    scope: 'queue',
                }
            );
        await remountedController.ready;
        assert.ok(remountedController.state.evidenceItems.length >= 2);
        assert.ok(
            remountedController.state.evidenceItems.some(
                (item) => item.title === 'Camera check'
            )
        );
        assert.match(remountedController.state.brief, /Camera check/);

        const addHandoffButton = fakeDom.document.createElement('button');
        addHandoffButton.dataset.action = 'add-handoff';
        addHandoffButton.closest = (selector) =>
            selector === '[data-action]' ? addHandoffButton : null;
        controller.root.dispatchEvent({
            type: 'click',
            target: addHandoffButton,
            preventDefault() {},
        });
        assert.equal(controller.state.openHandoffs.length, 2);
        assert.ok(
            controller.state.openHandoffs.some(
                (item) => item.title === 'Shift relay'
            )
        );

        const copyButton = fakeDom.document.createElement('button');
        copyButton.dataset.action = 'copy-brief';
        copyButton.closest = (selector) =>
            selector === '[data-action]' ? copyButton : null;
        controller.root.dispatchEvent({
            type: 'click',
            target: copyButton,
            preventDefault() {},
        });
        assert.ok(fakeDom.clipboardWrites.length >= 1);
        assert.match(
            fakeDom.clipboardWrites.at(-1),
            /# Turnero Surface Release Sync/
        );
        assert.match(
            fakeDom.clipboardWrites.at(-1),
            /# Turnero Surface Smoke Readout/
        );

        const downloadButton = fakeDom.document.createElement('button');
        downloadButton.dataset.action = 'download-json';
        downloadButton.closest = (selector) =>
            selector === '[data-action]' ? downloadButton : null;
        controller.root.dispatchEvent({
            type: 'click',
            target: downloadButton,
            preventDefault() {},
        });
        const anchor = fakeDom.createdAnchors.find(
            (item) => item && item.tagName === 'A'
        );
        assert.ok(anchor);
        assert.equal(anchor.download, 'turnero-surface-smoke-console.json');
        assert.equal(anchor.clicked, true);
    } finally {
        storage.restore();
        fakeDom.restore();
    }
});
