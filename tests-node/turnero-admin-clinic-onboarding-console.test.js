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
        this.children = [];
        this.className = '';
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this.parentNode = null;
        this._innerHTML = '';
        this.nodes = new Map();
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
    }

    get innerHTML() {
        return this._innerHTML;
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

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('[data-field="') ? 'input' : key === '[data-role="brief"]' ? 'pre' : 'div'
            );
            this.nodes.set(key, node);
        }
        return this.nodes.get(key);
    }

    remove() {
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }

    click() {
        this.clicked = true;
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
            } else {
                Object.defineProperty(global, key, descriptor);
            }
        }
    }
}

function createDocumentStub(host, downloadClicks) {
    const head = new HTMLElementStub('head', 'head');
    const body = new HTMLElementStub('body', 'body');

    return {
        head,
        body,
        createElement(tag) {
            const node = new HTMLElementStub(tag);
            if (tag === 'a') {
                node.click = () => {
                    downloadClicks.push({
                        download: node.download,
                        href: node.href,
                    });
                };
            }
            return node;
        },
        getElementById(id) {
            return String(id) === 'queueClinicOnboardingConsoleHost' ? host : null;
        },
        querySelector() {
            return null;
        },
    };
}

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

test('mount clinic onboarding console generates profile, staff, services and urls', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-admin-clinic-onboarding-console.js'
    );

    const host = new HTMLElementStub('div', 'queueClinicOnboardingConsoleHost');
    const clipboardWrites = [];
    const downloadClicks = [];
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-base',
        branding: {
            name: 'Clinica Base',
            short_name: 'Base',
            city: 'Quito',
            base_url: 'https://clinica-base.example',
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: false,
        },
    });

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host, downloadClicks),
            navigator: {
                clipboard: {
                    async writeText(value) {
                        clipboardWrites.push(String(value));
                    },
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                }
            },
            URL: Object.assign(global.URL, {
                createObjectURL() {
                    return 'blob:turnero-clinic-onboarding';
                },
                revokeObjectURL() {},
            }),
            setTimeout(callback) {
                if (typeof callback === 'function') {
                    callback();
                }
                return 0;
            },
        },
        async () => {
            const mounted = module.mountTurneroAdminClinicOnboardingConsole(
                host,
                {
                    clinicProfile,
                }
            );

            assert.ok(mounted);
            assert.equal(host.dataset.state, 'blocked');
            assert.match(host.innerHTML, /Clinic Onboarding Studio/);

            host.querySelector('[data-field="clinic-brand-name"]').value =
                'Clinica Tenant Uno';
            host.querySelector('[data-field="clinic-short-name"]').value =
                'Tenant Uno';
            host.querySelector('[data-field="clinic-city"]').value = 'Quito';
            host.querySelector('[data-field="clinic-id"]').value = 'tenant-uno';
            host.querySelector('[data-field="clinic-base-url"]').value =
                'https://tenant-uno.flowos.ec';
            await host.onclick({ target: createActionTarget('save-clinic') });

            host.querySelector('[data-field="staff-name"]').value =
                'Dra. Maria Perez';
            host.querySelector('[data-field="staff-role"]').value = 'doctor';
            host.querySelector('[data-field="staff-station"]').value = 'c1';
            host.querySelector('[data-field="staff-shift"]').value = 'am';
            await host.onclick({ target: createActionTarget('add-staff') });

            host.querySelector('[data-field="staff-name"]').value =
                'Andrea Frontdesk';
            host.querySelector('[data-field="staff-role"]').value = 'frontdesk';
            host.querySelector('[data-field="staff-station"]').value =
                'frontdesk';
            host.querySelector('[data-field="staff-shift"]').value = 'full';
            await host.onclick({ target: createActionTarget('add-staff') });

            host.querySelector('[data-field="service-label"]').value =
                'Dermatologia general';
            host.querySelector('[data-field="service-category"]').value =
                'dermatologia';
            host.querySelector('[data-field="service-mode"]').value =
                'presencial';
            host.querySelector('[data-field="service-duration"]').value = '45';
            await host.onclick({ target: createActionTarget('add-service') });

            host.querySelector('[data-field="service-label"]').value =
                'Teledermatologia';
            host.querySelector('[data-field="service-category"]').value =
                'telemedicina';
            host.querySelector('[data-field="service-mode"]').value = 'virtual';
            host.querySelector('[data-field="service-duration"]').value = '30';
            await host.onclick({ target: createActionTarget('add-service') });

            await host.onclick({ target: createActionTarget('copy-brief') });
            await host.onclick({ target: createActionTarget('download-json') });

            assert.equal(host.dataset.state, 'ready');
            assert.equal(mounted.state.pack.staff.length, 2);
            assert.equal(mounted.state.pack.services.length, 2);
            assert.equal(
                mounted.state.pack.turneroClinicProfile.clinic_id,
                'tenant-uno'
            );
            assert.equal(
                mounted.state.pack.urls[0].url,
                'https://tenant-uno.flowos.ec/admin.html#queue'
            );
            assert.equal(clipboardWrites.length, 1);
            assert.equal(downloadClicks.length, 1);
            assert.match(host.innerHTML, /tenant-uno\.flowos\.ec\/admin\.html#queue/);
            assert.match(host.innerHTML, /tenant-uno/);
        }
    );
});
