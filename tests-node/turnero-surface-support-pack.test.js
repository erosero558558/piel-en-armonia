#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');
const ORIGINAL_GLOBALS = {
    document: global.document,
    Element: global.Element,
    HTMLElement: global.HTMLElement,
    navigator: global.navigator,
    URL: global.URL,
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
    };
    return store;
}

function setGlobalValue(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
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
        this.querySelectorMap = new Map();
        this._id = '';
        this._textContent = '';
        this._innerHTML = '';
        this._value = '';
        this._type = '';
        this.clicked = false;
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
        this.clicked = true;
        this.dispatchEvent({
            type: 'click',
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
        });
    }

    closest(selector) {
        if (selector === '[data-action]') {
            return this.dataset.action ? this : null;
        }
        return null;
    }

    querySelector(selector) {
        return this.querySelectorMap.get(String(selector || '')) || null;
    }

    setQuerySelectorResult(selector, element) {
        this.querySelectorMap.set(String(selector || ''), element);
        return element;
    }
}

class FakeDocument {
    constructor() {
        this._ids = new Map();
        this.createdAnchors = [];
        this.createdElements = [];
        this.head = new FakeElement('head', this);
        this.body = new FakeElement('body', this);
        this.documentElement = new FakeElement('html', this);
    }

    createElement(tagName) {
        const element = new FakeElement(tagName, this);
        this.createdElements.push(element);
        if (String(tagName || '').toLowerCase() === 'a') {
            this.createdAnchors.push(element);
        }
        return element;
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
    setGlobalValue('document', document);
    setGlobalValue('HTMLElement', FakeElement);
    setGlobalValue('Element', FakeElement);
    return document;
}

function restoreRuntimeGlobals() {
    setGlobalValue('document', ORIGINAL_GLOBALS.document);
    setGlobalValue('Element', ORIGINAL_GLOBALS.Element);
    setGlobalValue('HTMLElement', ORIGINAL_GLOBALS.HTMLElement);
    setGlobalValue('navigator', ORIGINAL_GLOBALS.navigator);
    setGlobalValue('URL', ORIGINAL_GLOBALS.URL);
}

function buildClinicProfile(overrides = {}) {
    return {
        clinic_id: 'clinic-a',
        branding: {
            name: 'Clínica Demo',
            short_name: 'Demo',
            city: 'Quito',
        },
        region: 'sierra',
        release: {
            separate_deploy: true,
        },
        surfaces: {
            admin: {
                label: 'Turnero Admin',
                route: '/admin',
            },
            operator: {
                label: 'Turnero Operador',
                route: '/operador-turnos.html',
            },
            kiosk: {
                label: 'Turnero Kiosco',
                route: '/kiosco-turnos.html',
            },
            display: {
                label: 'Turnero Sala TV',
                route: '/sala-turnos.html',
            },
        },
        ...overrides,
    };
}

function makeActionButton(document, action, extras = {}) {
    const button = document.createElement('button');
    button.dataset.action = action;
    button.closest = (selector) =>
        selector === '[data-action]' ? button : null;
    Object.entries(extras).forEach(([key, value]) => {
        if (key.startsWith('data-')) {
            button.setAttribute(key, value);
        } else {
            button[key] = value;
        }
    });
    return button;
}

function createQueryField(value = '') {
    return { value: String(value ?? '') };
}

function installThrowingLocalStorage() {
    global.localStorage = {
        getItem() {
            throw new Error('localStorage unavailable');
        },
        setItem() {
            throw new Error('localStorage unavailable');
        },
        removeItem() {
            throw new Error('localStorage unavailable');
        },
        clear() {
            throw new Error('localStorage unavailable');
        },
    };
}

installLocalStorageMock();

test('surface support pack, stores, and admin console keep clinic scope and readiness aligned', async () => {
    const supportSnapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-support-snapshot.js'
    );
    const supportChecklistModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-support-checklist.js'
    );
    const supportPackModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-support-pack.js'
    );
    const contactStoreModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-support-contact-store.js'
    );
    const escalationLedgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-escalation-ledger.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-support-console.js'
    );

    const clinicProfile = buildClinicProfile();

    const supportScope = 'queue-support';
    const contactStore =
        contactStoreModule.createTurneroSurfaceSupportContactStore(
            supportScope,
            clinicProfile
        );
    const escalationLedger =
        escalationLedgerModule.createTurneroSurfaceEscalationLedger(
            supportScope,
            clinicProfile
        );

    const primaryContact = contactStore.add({
        surfaceKey: 'operator',
        name: 'Operador principal',
        role: 'ops',
        channel: 'phone',
        phone: '+593999111222',
        priority: 'primary',
        state: 'active',
        note: 'Contacto principal de la sala.',
    });
    const inactiveContact = contactStore.add({
        surfaceKey: 'kiosk',
        name: 'Kiosco inactivo',
        role: 'ops',
        channel: 'whatsapp',
        phone: '+593999333444',
        priority: 'backup',
        state: 'inactive',
        note: 'Solo para historial.',
    });
    const openEscalationA = escalationLedger.add({
        surfaceKey: 'operator',
        title: 'Operador sin cobertura',
        detail: 'Revisar cobertura de soporte del operador.',
        severity: 'high',
        owner: 'ops-a',
        state: 'open',
    });
    const openEscalationB = escalationLedger.add({
        surfaceKey: 'kiosk',
        title: 'Kiosco con cola',
        detail: 'La cola de soporte del kiosco no responde.',
        severity: 'medium',
        owner: 'ops-b',
        state: 'tracking',
    });
    const closedEscalation = escalationLedger.add({
        surfaceKey: 'display',
        title: 'Pantalla estabilizada',
        detail: 'La incidencia anterior ya fue resuelta.',
        severity: 'low',
        owner: 'ops-c',
        state: 'closed',
    });

    assert.ok(primaryContact.id);
    assert.ok(inactiveContact.id);
    assert.ok(openEscalationA.id);
    assert.ok(openEscalationB.id);
    assert.ok(closedEscalation.id);

    const contactSnapshot = contactStore.snapshot();
    assert.equal(contactSnapshot.contacts.length, 2);
    assert.equal(contactSnapshot.activeContacts.length, 1);
    assert.equal(contactSnapshot.summary.active, 1);
    assert.equal(contactSnapshot.summary.backup, 1);

    const otherClinicContactStore =
        contactStoreModule.createTurneroSurfaceSupportContactStore(
            supportScope,
            buildClinicProfile({ clinic_id: 'clinic-b' })
        );
    assert.equal(otherClinicContactStore.list().length, 0);

    const escalationSnapshot = escalationLedger.snapshot();
    assert.equal(escalationSnapshot.escalations.length, 3);
    assert.equal(escalationSnapshot.openEscalations.length, 2);
    assert.equal(escalationSnapshot.summary.open, 1);
    assert.equal(escalationSnapshot.summary.tracking, 1);
    assert.equal(escalationSnapshot.summary.closed, 1);

    const otherClinicEscalationLedger =
        escalationLedgerModule.createTurneroSurfaceEscalationLedger(
            supportScope,
            buildClinicProfile({ clinic_id: 'clinic-b' })
        );
    assert.equal(otherClinicEscalationLedger.list().length, 0);

    const snapshot = supportSnapshotModule.buildTurneroSurfaceSupportSnapshot({
        scope: supportScope,
        surfaceKey: 'admin',
        clinicProfile,
        contactStore,
        escalationLedger,
        currentRoute: '/admin',
    });

    assert.equal(snapshot.scope, supportScope);
    assert.equal(snapshot.surfaceKey, 'admin');
    assert.equal(snapshot.routeMatch, true);
    assert.equal(snapshot.contacts.length, 1);
    assert.equal(snapshot.allContacts.length, 2);
    assert.equal(snapshot.escalations.length, 2);
    assert.equal(snapshot.allEscalations.length, 3);
    assert.equal(snapshot.contactStore.activeContacts.length, 1);
    assert.equal(snapshot.escalationLedger.openEscalations.length, 2);
    assert.match(snapshot.summary, /soporte/i);

    const checklist =
        supportChecklistModule.buildTurneroSurfaceSupportChecklist({
            snapshot,
            contacts: snapshot.allContacts,
            escalations: snapshot.allEscalations,
            maintenanceWindow: { state: 'ready' },
            backupMode: { state: 'ready' },
            clinicProfile,
            surfaceKey: 'admin',
        });

    assert.equal(checklist.summary.all, 6);
    assert.equal(checklist.summary.pass, 5);
    assert.equal(checklist.summary.warn, 0);
    assert.equal(checklist.summary.fail, 1);
    assert.equal(
        checklist.checks.find((check) => check.key === 'open-escalations')
            .state,
        'fail'
    );

    const blockedPack = supportPackModule.buildTurneroSurfaceSupportPack({
        scope: supportScope,
        surfaceKey: 'admin',
        clinicProfile,
        contactStore,
        escalationLedger,
        currentRoute: '/admin',
    });

    assert.equal(blockedPack.gate.band, 'blocked');
    assert.equal(blockedPack.gate.decision, 'support-escalate');
    assert.equal(blockedPack.gate.blockers.includes('open-escalations'), true);
    assert.equal(blockedPack.readout.state, 'blocked');
    assert.equal(blockedPack.readout.chips.length, 4);
    assert.match(blockedPack.brief, /Surface Support Readiness/);
    assert.match(blockedPack.brief, /## Contacts/);
    assert.match(blockedPack.brief, /## Escalations/);
    assert.match(blockedPack.brief, /## Checklist/);

    const closedOne = escalationLedger.close(openEscalationA.id);
    assert.equal(closedOne.state, 'closed');

    const watchPack = supportPackModule.buildTurneroSurfaceSupportPack({
        scope: supportScope,
        surfaceKey: 'admin',
        clinicProfile,
        contactStore,
        escalationLedger,
        currentRoute: '/admin',
    });
    assert.equal(watchPack.gate.band, 'watch');
    assert.equal(watchPack.readout.state, 'watch');
    assert.equal(watchPack.gate.openEscalations, 1);

    const consoleScope = 'queue-support-admin';
    const consoleContactStore =
        contactStoreModule.createTurneroSurfaceSupportContactStore(
            consoleScope,
            clinicProfile
        );
    const consoleEscalationLedger =
        escalationLedgerModule.createTurneroSurfaceEscalationLedger(
            consoleScope,
            clinicProfile
        );

    consoleContactStore.add({
        surfaceKey: 'operator',
        name: 'Operador en guardia',
        role: 'ops',
        channel: 'phone',
        phone: '+593999777888',
        priority: 'primary',
        state: 'active',
        note: 'Contacto para brief.',
    });
    consoleEscalationLedger.add({
        surfaceKey: 'operator',
        title: 'Brief operativo pendiente',
        detail: 'Revisar brief de soporte antes del cierre.',
        severity: 'medium',
        owner: 'ops',
        state: 'open',
    });
    consoleEscalationLedger.add({
        surfaceKey: 'display',
        title: 'Incidencia cerrada',
        detail: 'Solo historial para el panel.',
        severity: 'low',
        owner: 'ops',
        state: 'closed',
    });

    const supportConsoleHtml =
        consoleModule.buildTurneroAdminQueueSurfaceSupportConsoleHtml({
            scope: consoleScope,
            clinicProfile,
            surfaceKey: 'admin',
            contactStore: consoleContactStore,
            escalationLedger: consoleEscalationLedger,
            currentRoute: '/admin',
        });

    assert.match(supportConsoleHtml, /Surface Support Console/);
    assert.match(supportConsoleHtml, /Copy brief/);
    assert.match(supportConsoleHtml, /Download JSON/);
    assert.match(supportConsoleHtml, /Contacts/);
    assert.match(supportConsoleHtml, /Escalations/);
    assert.match(supportConsoleHtml, /Checklist/);

    const fakeDom = installFakeDom();
    const clipboardWrites = [];
    const objectUrls = [];
    const revokedUrls = [];

    try {
        setGlobalValue('navigator', {
            clipboard: {
                writeText: async (text) => {
                    clipboardWrites.push(String(text));
                    return undefined;
                },
            },
        });
        setGlobalValue('URL', {
            createObjectURL(blob) {
                objectUrls.push(blob);
                return `blob:turnero-support-${objectUrls.length}`;
            },
            revokeObjectURL(href) {
                revokedUrls.push(href);
            },
        });

        const host = document.createElement('div');
        host.id = 'support-console-host';

        const contactFields = {
            '[data-field="contact-surface-key"]': createQueryField('kiosk'),
            '[data-field="contact-name"]': createQueryField('Soporte Kiosk'),
            '[data-field="contact-role"]': createQueryField('ops'),
            '[data-field="contact-channel"]': createQueryField('whatsapp'),
            '[data-field="contact-phone"]': createQueryField('+593999555666'),
            '[data-field="contact-priority"]': createQueryField('backup'),
            '[data-field="contact-note"]': createQueryField(
                'Guardia secundaria para soporte.'
            ),
        };
        const escalationFields = {
            '[data-field="escalation-surface-key"]':
                createQueryField('display'),
            '[data-field="escalation-title"]': createQueryField(
                'Pantalla con soporte pendiente'
            ),
            '[data-field="escalation-severity"]': createQueryField('high'),
            '[data-field="escalation-owner"]': createQueryField('ops-d'),
            '[data-field="escalation-detail"]': createQueryField(
                'Revisar la superficie de sala.'
            ),
        };
        const queryMap = {
            ...contactFields,
            ...escalationFields,
        };
        host.querySelector = (selector) =>
            Object.prototype.hasOwnProperty.call(queryMap, selector)
                ? queryMap[selector]
                : null;

        const controller =
            consoleModule.mountTurneroAdminQueueSurfaceSupportConsole(host, {
                scope: consoleScope,
                clinicProfile,
                surfaceKey: 'admin',
                contactStore: consoleContactStore,
                escalationLedger: consoleEscalationLedger,
                currentRoute: '/admin',
            });

        assert.ok(controller);
        assert.match(host.innerHTML, /Surface Support Console/);
        assert.match(host.innerHTML, /Copy brief/);
        assert.match(host.innerHTML, /Download JSON/);
        assert.match(host.innerHTML, /Checklist/);

        const copyButton = makeActionButton(fakeDom, 'copy-brief');
        host.dispatchEvent({
            type: 'click',
            target: copyButton,
            currentTarget: host,
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(clipboardWrites.length, 1);
        assert.equal(clipboardWrites[0], controller.state.brief);

        const downloadButton = makeActionButton(fakeDom, 'download-json');
        host.dispatchEvent({
            type: 'click',
            target: downloadButton,
            currentTarget: host,
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(objectUrls.length, 1);
        assert.equal(fakeDom.createdAnchors.length, 1);
        assert.equal(
            fakeDom.createdAnchors[0].download,
            'turnero-surface-support-console.json'
        );
        assert.equal(fakeDom.createdAnchors[0].clicked, true);
        assert.equal(revokedUrls.length, 1);
        const downloadPayload = JSON.parse(await objectUrls[0].text());
        assert.equal(downloadPayload.scope, consoleScope);
        assert.equal(downloadPayload.contacts.length, 1);
        assert.equal(downloadPayload.openEscalations.length, 1);

        const addContactButton = makeActionButton(fakeDom, 'add-contact');
        host.dispatchEvent({
            type: 'click',
            target: addContactButton,
            currentTarget: host,
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(consoleContactStore.snapshot().activeContacts.length, 2);
        assert.equal(consoleContactStore.snapshot().contacts.length, 2);
        assert.match(host.innerHTML, /Soporte Kiosk/);
        assert.equal(contactFields['[data-field="contact-name"]'].value, '');
        assert.equal(contactFields['[data-field="contact-note"]'].value, '');

        const addEscalationButton = makeActionButton(fakeDom, 'add-escalation');
        host.dispatchEvent({
            type: 'click',
            target: addEscalationButton,
            currentTarget: host,
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(
            consoleEscalationLedger.list({ includeClosed: false }).length,
            2
        );
        assert.match(host.innerHTML, /Pantalla con soporte pendiente/);
        assert.equal(
            escalationFields['[data-field="escalation-title"]'].value,
            ''
        );
        assert.equal(
            escalationFields['[data-field="escalation-detail"]'].value,
            ''
        );
        assert.equal(controller.state.pack.gate.band, 'blocked');

        const closingEscalationId = controller.state.openEscalations[0].id;
        const closeEscalationButton = makeActionButton(
            fakeDom,
            'close-escalation',
            {
                'data-escalation-id': closingEscalationId,
            }
        );
        host.dispatchEvent({
            type: 'click',
            target: closeEscalationButton,
            currentTarget: host,
            preventDefault() {},
            stopPropagation() {},
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(
            consoleEscalationLedger.list({ includeClosed: false }).length,
            1
        );
        assert.equal(controller.state.pack.gate.band, 'watch');
        assert.match(host.innerHTML, /Surface Support Console/);
    } finally {
        restoreRuntimeGlobals();
    }

    const fallbackScope = 'queue-support-fallback';
    const fallbackClinic = buildClinicProfile({ clinic_id: 'clinic-fallback' });
    const throwingLocalStorage = global.localStorage;

    try {
        installThrowingLocalStorage();
        const fallbackContactStore =
            contactStoreModule.createTurneroSurfaceSupportContactStore(
                fallbackScope,
                fallbackClinic
            );
        fallbackContactStore.add({
            surfaceKey: 'operator',
            name: 'Fallback support',
            role: 'ops',
            channel: 'phone',
            phone: '+593999000000',
            priority: 'primary',
            state: 'active',
        });

        const fallbackMirrorStore =
            contactStoreModule.createTurneroSurfaceSupportContactStore(
                fallbackScope,
                fallbackClinic
            );
        assert.equal(fallbackMirrorStore.list().length, 1);

        fallbackContactStore.clear();
        const clearedFallbackStore =
            contactStoreModule.createTurneroSurfaceSupportContactStore(
                fallbackScope,
                fallbackClinic
            );
        assert.equal(clearedFallbackStore.list().length, 0);
    } finally {
        global.localStorage = throwingLocalStorage;
    }
});
