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
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.className = '';
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this.parentNode = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
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
        this._innerHTML = '';
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

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('[data-role="brief"]')
                    ? 'pre'
                    : key.includes('[data-action="')
                      ? 'button'
                      : key.includes('[data-field="')
                        ? 'input'
                        : 'div'
            );
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
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }
}

function createFormStub(root, surfaceKey) {
    return {
        dataset: {
            surface: surfaceKey,
        },
        querySelector(selector) {
            return root.querySelector(selector);
        },
    };
}

function createSurfaceNode(surfaceKey) {
    return {
        dataset: {
            surface: surfaceKey,
        },
        getAttribute(name) {
            return String(name) === 'data-surface' ? surfaceKey : null;
        },
    };
}

function createActionTarget(action, { surfaceKey, form } = {}) {
    const selectedSurfaceKey = surfaceKey || 'operator-turnos';
    const surfaceNode = createSurfaceNode(selectedSurfaceKey);
    return {
        getAttribute(name) {
            const normalizedName = String(name);
            if (normalizedName === 'data-action') {
                return action;
            }
            if (normalizedName === 'data-surface') {
                return selectedSurfaceKey;
            }
            if (normalizedName === 'data-evidence-id') {
                return form?.evidenceId || null;
            }
            if (normalizedName === 'data-signoff-id') {
                return form?.signoffId || null;
            }
            return null;
        },
        closest(selector) {
            if (selector === '[data-action]') {
                return this;
            }
            if (selector === '[data-surface]') {
                return surfaceNode;
            }
            if (
                selector === '[data-role="evidence-form"]' &&
                action.includes('evidence')
            ) {
                return form || null;
            }
            if (
                selector === '[data-role="signoff-form"]' &&
                action.includes('signoff')
            ) {
                return form || null;
            }
            return null;
        },
    };
}

function createDocumentStub(host, downloadClicks, downloadEvents) {
    const head = new HTMLElementStub('head', 'head');
    const body = new HTMLElementStub('body', 'body');

    return {
        head,
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
        getElementById(id) {
            return String(id) === 'queueSurfaceAcceptanceConsoleHost'
                ? host
                : null;
        },
        querySelector() {
            return null;
        },
        execCommand(command) {
            downloadEvents.push({ kind: 'execCommand', command });
            return false;
        },
    };
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

function buildConsoleInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-consola',
        branding: {
            name: 'Clínica Consola',
            short_name: 'Consola',
        },
    });

    return {
        clinicProfile,
        scope: 'regional',
        telemetryMap: {
            operator: {
                state: 'watch',
                summary: 'Operador en observación.',
            },
            kiosk: {
                state: 'watch',
                summary: 'Kiosco pendiente.',
            },
            display: {
                state: 'ready',
                summary: 'Sala lista.',
            },
        },
        surfaceRegistry: {
            operator: {
                label: 'Turnero Operador',
                title: 'Operador',
                acceptanceOwner: 'ops-lead',
                truth: 'watch',
                runtimeState: 'ready',
                siteStatus: 'ready',
                trainingStatus: 'ready',
                signoffMode: 'manual',
            },
            kiosk: {
                label: 'Turnero Kiosco',
                title: 'Kiosco',
                acceptanceOwner: '',
                truth: 'watch',
                runtimeState: 'ready',
                siteStatus: 'watch',
                trainingStatus: 'pending',
                signoffMode: 'manual',
            },
            display: {
                label: 'Turnero Sala',
                title: 'Sala',
                acceptanceOwner: 'ops-display',
                truth: 'aligned',
                runtimeState: 'ready',
                siteStatus: 'ready',
                trainingStatus: 'ready',
                signoffMode: 'broadcast',
            },
        },
        releaseManifest: {},
        now: () => Date.parse('2026-03-20T12:00:00.000Z'),
    };
}

test('mounts the acceptance console and wires copy/download plus evidence and signoff actions', async () => {
    const host = new HTMLElementStub(
        'div',
        'queueSurfaceAcceptanceConsoleHost'
    );
    const clipboardTexts = [];
    const downloadClicks = [];
    const downloadEvents = [];

    const blobStub = class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
            downloadEvents.push({ kind: 'blob', parts, options });
        }
    };

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            document: createDocumentStub(host, downloadClicks, downloadEvents),
            navigator: {
                clipboard: {
                    writeText: async (text) => {
                        clipboardTexts.push(String(text));
                    },
                },
            },
            Blob: blobStub,
            URL: {
                createObjectURL: (blob) => {
                    downloadEvents.push({ kind: 'url', blob });
                    return 'blob:turnero-surface-acceptance-console';
                },
                revokeObjectURL: (href) => {
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
            const module = await loadModule(
                'src/apps/queue-shared/turnero-admin-queue-surface-acceptance-console.js'
            );

            const result =
                module.mountTurneroAdminQueueSurfaceAcceptanceConsole(
                    host,
                    buildConsoleInput()
                );

            assert.ok(result);
            assert.equal(result.root, host);
            assert.equal(
                host.dataset.turneroAdminQueueSurfaceAcceptanceConsole,
                'mounted'
            );
            assert.equal(
                host.dataset.turneroAdminQueueSurfaceAcceptanceBand,
                'watch'
            );
            assert.equal(
                host.dataset.turneroAdminQueueSurfaceAcceptanceScope,
                'regional'
            );
            assert.equal(
                host.dataset.turneroAdminQueueSurfaceAcceptanceSurfaceCount,
                '3'
            );
            assert.match(host.innerHTML, /Consola de aceptación clínica/);
            assert.match(host.innerHTML, /Copiar brief/);
            assert.match(host.innerHTML, /Descargar snapshot/);
            assert.match(host.innerHTML, /Registrar evidencia/);
            assert.match(host.innerHTML, /Registrar signoff/);
            assert.match(host.innerHTML, /Turnero Operador/);
            assert.equal(result.state.surfacePacks.length, 3);
            assert.equal(result.state.overallGate.band, 'watch');
            assert.equal(result.state.overallGate.score >= 0, true);

            const evidenceForm = createFormStub(host, 'operator-turnos');
            const signoffForm = createFormStub(host, 'operator-turnos');

            host.querySelector('[data-field="evidence-surface-key"]').value =
                'operator-turnos';
            host.querySelector('[data-field="evidence-title"]').value =
                'Captura de pantalla';
            host.querySelector('[data-field="evidence-status"]').value =
                'captured';
            host.querySelector('[data-field="evidence-note"]').value =
                'Pantalla verificada manualmente.';

            host.querySelector('[data-field="signoff-surface-key"]').value =
                'operator-turnos';
            host.querySelector('[data-field="signoff-stakeholder"]').value =
                'Jefa clínica';
            host.querySelector('[data-field="signoff-role"]').value =
                'reviewer';
            host.querySelector('[data-field="signoff-verdict"]').value =
                'approve';
            host.querySelector('[data-field="signoff-note"]').value =
                'Lista para operar.';

            const clickHandler = host.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                preventDefault() {},
                target: createActionTarget('add-evidence', {
                    surfaceKey: 'operator-turnos',
                    form: evidenceForm,
                }),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionTarget('add-signoff', {
                    surfaceKey: 'operator-turnos',
                    form: signoffForm,
                }),
            });

            assert.equal(
                result.ledger.list({ surfaceKey: 'operator' }).length,
                1
            );
            assert.equal(
                result.signoffStore.list({ surfaceKey: 'operator' }).length,
                1
            );
            assert.equal(
                result.state.surfacePacks.find(
                    (pack) => pack.surfaceKey === 'operator'
                ).pack.gate.evidenceState,
                'ready'
            );
            assert.equal(
                result.state.surfacePacks.find(
                    (pack) => pack.surfaceKey === 'operator'
                ).pack.gate.signoffState,
                'ready'
            );

            await clickHandler({
                preventDefault() {},
                target: createActionTarget('copy-surface', {
                    surfaceKey: 'operator-turnos',
                }),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionTarget('download-surface', {
                    surfaceKey: 'operator-turnos',
                }),
            });

            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Surface acceptance/);
            assert.match(clipboardTexts[0], /Scope: operator/);
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-surface-acceptance-operator.json'
            );
            assert.ok(downloadEvents.some((event) => event.kind === 'blob'));
            assert.ok(downloadEvents.some((event) => event.kind === 'url'));

            await clickHandler({
                preventDefault() {},
                target: createActionTarget('copy-all', {
                    surfaceKey: 'operator-turnos',
                }),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionTarget('download-all', {
                    surfaceKey: 'operator-turnos',
                }),
            });

            assert.equal(clipboardTexts.length, 2);
            assert.match(clipboardTexts[1], /# Surface Acceptance Console/);
            assert.equal(downloadClicks.length, 2);
            assert.equal(
                downloadClicks[1].download,
                'turnero-admin-queue-surface-acceptance-console.json'
            );

            const operatorEvidenceId = result.ledger.list({
                surfaceKey: 'operator',
            })[0].id;
            const operatorSignoffId = result.signoffStore.list({
                surfaceKey: 'operator',
            })[0].id;
            evidenceForm.evidenceId = operatorEvidenceId;
            signoffForm.signoffId = operatorSignoffId;

            await clickHandler({
                preventDefault() {},
                target: createActionTarget('remove-evidence', {
                    surfaceKey: 'operator-turnos',
                    form: evidenceForm,
                    evidenceId: operatorEvidenceId,
                }),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionTarget('remove-signoff', {
                    surfaceKey: 'operator-turnos',
                    form: signoffForm,
                    signoffId: operatorSignoffId,
                }),
            });

            assert.equal(
                result.ledger.list({ surfaceKey: 'operator' }).length,
                0
            );
            assert.equal(
                result.signoffStore.list({ surfaceKey: 'operator' }).length,
                0
            );

            result.destroy();
        }
    );
});
