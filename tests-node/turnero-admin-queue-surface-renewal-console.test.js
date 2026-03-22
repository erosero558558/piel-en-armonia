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

class FakeElement {
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
        this.hidden = false;
        this.value = '';
        this.clicked = false;
        this.parentElement = null;
        this._innerHTML = '';
        this._textContent = '';
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
        const normalizedType = String(type || '');
        if (this.listeners.get(normalizedType) === handler) {
            this.listeners.delete(normalizedType);
        }
    }

    closest(selector) {
        const normalizedSelector = String(selector || '');
        if (
            (normalizedSelector === '[data-action]' ||
                normalizedSelector === 'form[data-action]') &&
            this.dataset.action
        ) {
            return this;
        }

        return null;
    }

    querySelector(selector) {
        const normalizedSelector = String(selector || '');
        if (!this.nodes.has(normalizedSelector)) {
            this.nodes.set(
                normalizedSelector,
                this.createNodeForSelector(normalizedSelector)
            );
        }

        return this.nodes.get(normalizedSelector);
    }

    createNodeForSelector(selector) {
        const normalizedSelector = String(selector || '');
        let tagName = 'div';

        if (normalizedSelector.includes('[data-role="brief"]')) {
            tagName = 'pre';
        } else if (normalizedSelector.includes('[data-field="')) {
            tagName = normalizedSelector.includes('textarea') ? 'textarea' : 'input';
        } else if (
            normalizedSelector.includes('form[data-action]') ||
            normalizedSelector.includes('[data-action="')
        ) {
            tagName = normalizedSelector.includes('form[data-action]')
                ? 'form'
                : 'button';
        } else if (normalizedSelector.includes('[data-surface-key="')) {
            tagName = 'article';
        }

        const node = new FakeElement(tagName);

        if (normalizedSelector.includes('[data-surface-key="')) {
            const match = normalizedSelector.match(/\[data-surface-key="([^"]+)"\]/);
            if (match) {
                node.dataset.surfaceKey = match[1];
            }
        }

        if (normalizedSelector.includes('[data-action="')) {
            const match = normalizedSelector.match(/\[data-action="([^"]+)"\]/);
            if (match) {
                node.dataset.action = match[1];
            }
        }

        return node;
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

function createDocumentStub(host, downloadClicks) {
    const head = new FakeElement('head', 'head');
    const body = new FakeElement('body', 'body');

    return {
        head,
        body,
        createElement(tagName) {
            if (String(tagName || '').toLowerCase() === 'a') {
                const anchor = new FakeElement('a');
                anchor.click = () => {
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                    });
                };
                return anchor;
            }

            return new FakeElement(tagName);
        },
        getElementById(id) {
            return String(id) === String(host.id) ? host : null;
        },
        querySelector() {
            return null;
        },
    };
}

function buildConsoleInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-console',
        branding: {
            name: 'Clinica Console',
            short_name: 'Console',
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

    return {
        clinicProfile,
        scope: 'regional',
        snapshots: [
            {
                surfaceKey: 'operator-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                renewalValueBand: 'high',
                retentionSignal: 'stable',
                feedbackState: 'good',
                activityState: 'active',
                pendingCorrections: 0,
                renewalOwner: 'renewal-lead',
                commercialOwner: 'ernesto',
                successOwner: 'ops-lead',
                nextRenewalWindow: '30 dias',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
            {
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                renewalValueBand: 'medium',
                retentionSignal: 'fragile',
                feedbackState: 'mixed',
                activityState: 'watch',
                pendingCorrections: 2,
                renewalOwner: '',
                commercialOwner: '',
                successOwner: 'ops-kiosk',
                nextRenewalWindow: '15 dias',
                checklist: { summary: { all: 4, pass: 2, fail: 2 } },
            },
            {
                surfaceKey: 'sala-turnos',
                runtimeState: 'ready',
                truth: 'aligned',
                renewalValueBand: 'high',
                retentionSignal: 'stable',
                feedbackState: 'good',
                activityState: 'active',
                pendingCorrections: 0,
                renewalOwner: 'ops-display',
                commercialOwner: 'ernesto',
                successOwner: 'ops-display',
                nextRenewalWindow: '45 dias',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
        ],
        checklist: { summary: { all: 6, pass: 4, fail: 2 } },
    };
}

function createActionButton(action) {
    const button = new FakeElement('button');
    button.dataset.action = action;
    return button;
}

function createActionForm(action) {
    const form = new FakeElement('form');
    form.dataset.action = action;
    return form;
}

function setFieldValue(form, selector, value) {
    form.querySelector(selector).value = value;
}

test('console html renders renewal surfaces and actions', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-renewal-console.js'
    );

    const html = module.buildTurneroAdminQueueSurfaceRenewalConsoleHtml(
        buildConsoleInput()
    );

    assert.match(html, /Surface Renewal Retention Console/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add evidence/);
    assert.match(html, /Add owner/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
});

test('mount wires copy, download, add-evidence and add-owner flows', async () => {
    const clipboardTexts = [];
    const downloadClicks = [];
    const consoleInput = buildConsoleInput();
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-renewal-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-renewal-owner-store.js'
    );
    const host = new FakeElement('div', 'queueSurfaceRenewalConsoleHost');

    await withGlobals(
        {
            HTMLElement: FakeElement,
            document: createDocumentStub(host, downloadClicks),
            navigator: {
                clipboard: {
                    writeText: async (text) => {
                        clipboardTexts.push(String(text));
                    },
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                }
            },
            URL: {
                createObjectURL() {
                    return 'blob:turnero-surface-renewal-console';
                },
                revokeObjectURL() {},
            },
            setTimeout(fn) {
                fn();
                return 0;
            },
        },
        async () => {
            const module = await loadModule(
                'src/apps/queue-shared/turnero-admin-queue-surface-renewal-console.js'
            );

            const result = module.mountTurneroAdminQueueSurfaceRenewalConsole(
                host,
                consoleInput
            );

            assert.ok(result);
            assert.equal(result.root, host.children[0]);
            assert.equal(result.state.surfacePacks.length, 3);
            assert.match(result.root.innerHTML, /Surface Renewal Retention Console/);
            assert.match(result.root.innerHTML, /Add evidence/);
            assert.match(result.root.innerHTML, /Add owner/);

            const clickHandler = result.root.listeners.get('click');
            const submitHandler = result.root.listeners.get('submit');

            await clickHandler({
                preventDefault() {},
                target: createActionButton('copy-brief'),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionButton('download-json'),
            });

            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Surface Renewal Retention/);
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-surface-renewal-console.json'
            );

            const evidenceForm = createActionForm('add-ledger');
            setFieldValue(
                evidenceForm,
                '[data-field="ledger-surface-key"]',
                'kiosco-turnos'
            );
            setFieldValue(
                evidenceForm,
                '[data-field="ledger-kind"]',
                'renewal-note'
            );
            setFieldValue(evidenceForm, '[data-field="ledger-status"]', 'watch');
            setFieldValue(
                evidenceForm,
                '[data-field="ledger-signal"]',
                'correction'
            );
            setFieldValue(evidenceForm, '[data-field="ledger-owner"]', 'renewal');
            setFieldValue(
                evidenceForm,
                '[data-field="ledger-note"]',
                'Correccion pendiente en kiosko.'
            );

            submitHandler({
                preventDefault() {},
                target: evidenceForm,
            });

            const freshLedgerStore =
                ledgerModule.createTurneroSurfaceRenewalLedger(
                    'regional',
                    consoleInput.clinicProfile
                );
            assert.equal(
                freshLedgerStore.list({ surfaceKey: 'kiosco-turnos' }).length,
                1
            );
            assert.equal(
                freshLedgerStore.list({ surfaceKey: 'kiosco-turnos' })[0].signal,
                'correction'
            );

            const ownerForm = createActionForm('add-owner');
            setFieldValue(
                ownerForm,
                '[data-field="owner-surface-key"]',
                'kiosco-turnos'
            );
            setFieldValue(ownerForm, '[data-field="owner-actor"]', 'carla');
            setFieldValue(ownerForm, '[data-field="owner-role"]', 'renewal');
            setFieldValue(ownerForm, '[data-field="owner-status"]', 'active');
            setFieldValue(
                ownerForm,
                '[data-field="owner-note"]',
                'Primary renewal owner.'
            );

            submitHandler({
                preventDefault() {},
                target: ownerForm,
            });

            const freshOwnerStore =
                ownerModule.createTurneroSurfaceRenewalOwnerStore(
                    'regional',
                    consoleInput.clinicProfile
                );
            assert.equal(
                freshOwnerStore.list({ surfaceKey: 'kiosco-turnos' }).length,
                1
            );
            assert.equal(
                freshOwnerStore.list({ surfaceKey: 'kiosco-turnos' })[0].actor,
                'carla'
            );

            result.destroy();
            assert.equal(result.root.listeners.has('click'), false);
            assert.equal(result.root.listeners.has('submit'), false);
        }
    );
});
