'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadProgramOfficeModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-program-office.js'
    );
}

async function loadProgramOfficeStoreModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-program-office-store.js'
    );
}

async function loadQueueSectionModule() {
    return loadModule(
        'src/apps/admin-v3/ui/frame/templates/sections/queue/index.js'
    );
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.innerHTML = '';
        this.__panel = null;
        this.value = '';
        this.checked = false;
        this.style = {};
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
        this.__child = node;
        return node;
    }

    querySelector(selector) {
        if (selector === '#queueRegionalProgramOfficePanel') {
            return this.__panel;
        }
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener() {}

    remove() {}

    click() {
        this.clicked = true;
    }
}

function setGlobalValue(name, value) {
    Object.defineProperty(global, name, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
    });
}

async function withGlobals(setup, callback) {
    const previous = {};
    for (const key of Object.keys(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        setGlobalValue(key, setup[key]);
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

function buildMultiClinicData() {
    const clinics = [
        {
            clinicId: 'north-01',
            clinicLabel: 'North 01',
            region: 'regional-hub',
            ownerTeam: 'ops-a',
            cohort: 'pilot',
            decision: 'ready',
            score: 88,
            blockingCount: 0,
            incidentLoad: 0,
        },
        {
            clinicId: 'south-01',
            clinicLabel: 'South 01',
            region: 'regional-hub',
            ownerTeam: 'ops-b',
            cohort: 'wave-1',
            decision: 'ready',
            score: 84,
            blockingCount: 0,
            incidentLoad: 0,
        },
        {
            clinicId: 'east-01',
            clinicLabel: 'East 01',
            region: 'regional-hub',
            ownerTeam: 'ops-c',
            cohort: 'wave-2',
            decision: 'review',
            score: 79,
            blockingCount: 0,
            incidentLoad: 0,
        },
    ];

    return {
        clinics,
        plans: clinics.map((clinic) => ({
            ...clinic,
            planId: `${clinic.clinicId}-plan`,
            targetTrafficPercent: 25,
        })),
    };
}

test('program office store persists and resets by scope', async () => {
    const storeModule = await loadProgramOfficeStoreModule();
    const storage = createLocalStorageStub();

    await withGlobals(
        {
            localStorage: storage,
            HTMLElement: HTMLElementStub,
        },
        async () => {
            const defaults = storeModule.readProgramOfficeState('clinica-demo');
            assert.equal(defaults.presetId, 'stabilize-core');
            assert.equal(defaults.freeze, false);
            assert.equal(defaults.lastRunAt, null);

            const written = storeModule.writeProgramOfficeState(
                'clinica-demo',
                {
                    presetId: 'regional-expand',
                    notes: 'Listo para wave 1',
                    trafficLimitPercent: 35,
                    freeze: true,
                }
            );

            assert.equal(written.presetId, 'regional-expand');
            assert.equal(written.notes, 'Listo para wave 1');
            assert.equal(written.trafficLimitPercent, 35);
            assert.equal(written.freeze, true);
            assert.match(written.lastRunAt, /T/);

            const reread = storeModule.readProgramOfficeState('clinica-demo');
            assert.equal(reread.presetId, 'regional-expand');
            assert.equal(reread.freeze, true);

            const reset = storeModule.resetProgramOfficeState('clinica-demo');
            assert.equal(reset.presetId, 'stabilize-core');
            assert.equal(reset.notes, '');
            assert.equal(reset.freeze, false);
            assert.equal(reset.lastRunAt, null);
        }
    );
});

test('regional program office degrada limpio con una sola clínica y monta el host', async () => {
    const module = await loadProgramOfficeModule();
    const storage = createLocalStorageStub();
    const clinicProfile = buildClinicProfile();
    const host = new HTMLElementStub('queueRegionalProgramOfficeHost');
    const panel = new HTMLElementStub('queueRegionalProgramOfficePanel');
    host.__panel = panel;

    await withGlobals(
        {
            localStorage: storage,
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            HTMLInputElement: HTMLElementStub,
            HTMLTextAreaElement: HTMLElementStub,
            document: {
                getElementById(id) {
                    return id === 'queueRegionalProgramOfficeHost'
                        ? host
                        : null;
                },
            },
        },
        async () => {
            const model = module.buildRegionalProgramOffice({
                scope: clinicProfile.clinic_id,
                turneroClinicProfile: clinicProfile,
            });

            assert.equal(model.portfolioMode, 'single-clinic-fallback');
            assert.equal(model.presets.recommendedPresetId, 'stabilize-core');
            assert.equal(model.capacity.owners.length, 1);
            assert.equal(model.capacity.regions.length, 1);
            assert.equal(model.waveCalendar.windows.length, 6);
            assert.match(
                model.executivePack.executiveBrief,
                /Program Office preset:/
            );

            const html = module.renderRegionalProgramOfficeCard(model);
            assert.match(html, /queueRegionalProgramOfficePanel/);
            assert.match(html, /queueRegionalProgramOfficeNotes/);
            assert.match(
                html,
                /queueRegionalProgramOfficePreset_stabilize-core/
            );
            assert.match(html, /data-program-office-action="download-json"/);

            const mounted = module.mountRegionalProgramOfficeCard(host, {
                scope: clinicProfile.clinic_id,
                turneroClinicProfile: clinicProfile,
            });

            assert.equal(mounted, panel);
            assert.equal(
                host.dataset.turneroRegionalProgramOfficeScope,
                clinicProfile.clinic_id
            );
            assert.equal(
                host.dataset.turneroRegionalProgramOfficeMode,
                'single-clinic-fallback'
            );
        }
    );
});

test('regional program office calcula forecast multi-clinico y ejecuta acciones locales', async () => {
    const module = await loadProgramOfficeModule();
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloads = [];

    class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    }

    const documentStub = {
        body: new HTMLElementStub('document-body'),
        createElement(tag) {
            if (tag === 'a') {
                return {
                    href: '',
                    download: '',
                    rel: '',
                    style: {},
                    click() {
                        this.clicked = true;
                    },
                    remove() {
                        this.removed = true;
                    },
                };
            }

            return new HTMLElementStub(tag);
        },
    };

    const navigatorStub = {
        clipboard: {
            writeText: async (text) => {
                clipboard.push(text);
            },
        },
    };

    const URLStub = {
        createObjectURL(blob) {
            downloads.push(blob);
            return 'blob:turnero-regional-program-office';
        },
        revokeObjectURL() {},
    };

    const { clinics, plans } = buildMultiClinicData();

    await withGlobals(
        {
            localStorage: storage,
            navigator: navigatorStub,
            document: documentStub,
            Blob: BlobStub,
            URL: URLStub,
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            HTMLInputElement: HTMLElementStub,
            HTMLTextAreaElement: HTMLElementStub,
        },
        async () => {
            const storeModule = await loadProgramOfficeStoreModule();

            storeModule.writeProgramOfficeState('clinica-demo', {
                presetId: 'regional-expand',
                notes: 'Preparar wave 1',
                trafficLimitPercent: 35,
                freeze: false,
            });

            const model = module.buildRegionalProgramOffice({
                scope: 'clinica-demo',
                turneroClinicProfile: buildClinicProfile(),
                clinics,
                plans,
            });

            assert.equal(model.portfolioMode, 'regional-rollout');
            assert.equal(model.activePresetId, 'regional-expand');
            assert.equal(model.forecast.recommendedDecision, 'promote');
            assert.equal(model.forecast.active.promotableClinics, 2);
            assert.equal(model.forecast.forecasts.length, 4);
            assert.match(
                model.executivePack.executiveBrief,
                /Program Office preset: Regional Expand/
            );

            const html = module.renderRegionalProgramOfficeCard(model);
            assert.match(
                html,
                /data-program-office-action="copy-executive-brief"/
            );
            assert.match(html, /queueRegionalProgramOfficeTrafficLimit/);

            const actions = module.createRegionalProgramOfficeActions({
                scope: 'clinica-demo',
                turneroClinicProfile: buildClinicProfile(),
                clinics,
                plans,
            });

            await actions.copyExecutiveBrief();
            assert.ok(
                clipboard.some((entry) =>
                    String(entry).includes(
                        'Program Office preset: Regional Expand'
                    )
                )
            );

            actions.setNotes('Nueva nota');
            actions.setTrafficLimitPercent('42');
            actions.setFreeze(true);
            actions.setPreset('aggressive-scale');

            const persisted =
                storeModule.readProgramOfficeState('clinica-demo');
            assert.equal(persisted.notes, 'Nueva nota');
            assert.equal(persisted.trafficLimitPercent, 42);
            assert.equal(persisted.freeze, true);
            assert.equal(persisted.presetId, 'aggressive-scale');
            assert.match(persisted.lastRunAt, /T/);

            const downloaded = actions.downloadJson(
                'turnero-regional-program-office.json'
            );
            assert.equal(downloaded, true);
            assert.equal(downloads.length, 1);
            assert.equal(
                downloads[0].options.type,
                'application/json;charset=utf-8'
            );

            const reset = actions.resetState();
            assert.equal(reset.presetId, 'stabilize-core');
            assert.equal(reset.freeze, false);
            assert.equal(
                storeModule.readProgramOfficeState('clinica-demo').presetId,
                'stabilize-core'
            );
        }
    );
});

test('renderQueueSection expone el host del Regional Program Office', async () => {
    const sectionModule = await loadQueueSectionModule();
    const html = sectionModule.renderQueueSection();

    assert.match(html, /queueRegionalProgramOfficeHost/);
});
