'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadModule,
    createLocalStorageStub,
    buildClinicProfile,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
    buildEvidenceSnapshot,
} = require('./turnero-release-test-fixtures.js');

async function loadTelemetryOptimizationHubModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-telemetry-optimization-hub.js'
    );
}

class StubElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
        this.download = '';
        this.href = '';
        this.rel = '';
        this.clicked = false;
        this.removed = false;
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
            this.dataset[normalizedName.slice(5)] = normalizedValue;
        }
    }

    getAttribute(name) {
        const normalizedName = String(name);
        if (this.attributes.has(normalizedName)) {
            return this.attributes.get(normalizedName);
        }

        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName.slice(5);
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

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            let node;
            if (key === '#turneroReleaseTelemetryOptimizationHub') {
                node = new StubElement(
                    'section',
                    'turneroReleaseTelemetryOptimizationHub'
                );
            } else if (key.startsWith('#')) {
                node = new StubElement('div', key.slice(1));
            } else {
                node = new StubElement(
                    key.includes('input') ? 'input' : 'span'
                );
            }

            if (key.includes('[data-field=')) {
                node.value = '';
            }

            if (key.includes('[data-role=')) {
                node.textContent = '';
            }

            this.nodes.set(key, node);
        }

        return this.nodes.get(key);
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
        if (this.parentNode && Array.isArray(this.parentNode.children)) {
            this.parentNode.children = this.parentNode.children.filter(
                (child) => child !== this
            );
        }
    }
}

function setGlobalValue(name, value) {
    try {
        Object.defineProperty(global, name, {
            configurable: true,
            enumerable: true,
            writable: true,
            value,
        });
    } catch (_error) {
        global[name] = value;
    }
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

            try {
                Object.defineProperty(global, key, descriptor);
            } catch (_error) {
                global[key] = descriptor.value;
            }
        }
    }
}

function createActionTarget(action) {
    return {
        closest() {
            return null;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(downloadClicks) {
    const body = new StubElement('body');

    return {
        body,
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new StubElement('a');
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

            return new StubElement(tag);
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

function buildTelemetryClinicProfile() {
    return buildClinicProfile({
        clinic_id: 'clinica-dual',
        region: 'regional',
        branding: {
            name: 'Clínica Dual',
            short_name: 'Clínica Dual',
            base_url: 'https://dual.example',
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin web',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: '/sala-turnos.html',
            },
        },
        regionalClinics: [
            {
                clinicId: 'clinica-dual',
                label: 'Clínica Dual',
                stations: 4,
                avgServiceMinutes: 12,
            },
            {
                clinicId: 'clinica-satelite',
                label: 'Clínica Satélite',
                stations: 4,
                avgServiceMinutes: 12,
            },
        ],
        runtime_meta: {
            source: 'remote',
            profileFingerprint: 'abcd1234',
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
        },
    });
}

test('builders normalize telemetry, persistence and readiness per scope', async () => {
    const module = await loadTelemetryOptimizationHubModule();
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const regionalExperimentRegistry =
            module.createTurneroReleaseExperimentRegistry('regional');
        const northExperimentRegistry =
            module.createTurneroReleaseExperimentRegistry('north');
        const regionalBacklogRegistry =
            module.createTurneroReleaseOptimizationBacklog('regional');
        const northBacklogRegistry =
            module.createTurneroReleaseOptimizationBacklog('north');

        regionalExperimentRegistry.add({
            id: 'exp-regional',
            title: 'Reduce no-show prompts',
            owner: 'ops',
            hypothesis: 'Send one reminder before peak hours.',
            status: 'planned',
            expectedGain: 7,
        });
        northExperimentRegistry.add({
            id: 'exp-north',
            title: 'Speed up kiosk sync',
            owner: 'product',
            hypothesis: 'Trim the first load by 20%.',
            status: 'planned',
            expectedGain: 4,
        });
        regionalBacklogRegistry.add({
            id: 'backlog-regional',
            title: 'Tune queue telemetry cards',
            owner: 'ops',
            impact: 'high',
            effort: 'small',
            status: 'open',
        });
        northBacklogRegistry.add({
            id: 'backlog-north',
            title: 'Refine regional roster labels',
            owner: 'ops',
            impact: 'medium',
            effort: 'medium',
            status: 'open',
        });

        const catalog = module.buildTurneroReleaseTelemetryEventCatalog({
            surfaces: [
                {
                    id: 'operator',
                    label: 'Operador web',
                    owner: 'ops',
                    events: ['open', 'queue_sync', 'handoff'],
                },
                {
                    id: 'kiosk',
                    label: 'Kiosco web',
                    owner: 'frontdesk',
                },
            ],
        });
        assert.equal(catalog.rows.length, 8);
        assert.equal(catalog.summary.all, 8);
        assert.equal(catalog.summary.high, 4);
        assert.equal(catalog.summary.medium, 4);

        const funnel = module.buildTurneroReleaseFunnelObservatory({
            metrics: {
                issued: 100,
                announced: 80,
                attended: 60,
                completed: 50,
            },
        });
        assert.equal(funnel.rows[0].value, 100);
        assert.equal(funnel.rows[1].conversionFromStart, 80);
        assert.equal(funnel.finalConversion, 50);

        const simulation = module.buildTurneroReleaseCapacitySimulationLab({
            clinics: [
                {
                    clinicId: 'clinica-dual',
                    stations: 4,
                    avgServiceMinutes: 12,
                },
                {
                    clinicId: 'clinica-satelite',
                    stations: 4,
                    avgServiceMinutes: 12,
                },
            ],
            baseArrivalsPerHour: 16,
        });
        assert.equal(simulation.totalStations, 8);
        assert.equal(simulation.avgServiceMinutes, 12);
        assert.equal(simulation.scenarios[0].arrivalsPerHour, 16);
        assert.equal(simulation.scenarios[0].utilization, 40);
        assert.equal(simulation.scenarios[0].state, 'healthy');

        const bench = module.buildTurneroReleaseQueuePerformanceBench({
            performanceMetrics: {
                averageWaitMinutes: 0,
                p95WaitMinutes: 0,
                abandonmentRate: 0,
                displayLatencyMs: 0,
            },
        });
        assert.equal(bench.score, 100);
        assert.equal(bench.band, 'strong');

        const readiness = module.buildTurneroReleaseOptimizationReadinessScore({
            funnel,
            bench,
            experiments: regionalExperimentRegistry.list(),
            backlog: regionalBacklogRegistry.list(),
            simulation,
        });
        assert.equal(readiness.activeExperiments, 1);
        assert.equal(readiness.openBacklog, 1);
        assert.equal(readiness.stressedScenarios, 0);
        assert.equal(readiness.score, 83.5);
        assert.equal(readiness.band, 'stable');
        assert.equal(readiness.decision, 'ready');

        const dump = storage.dump();
        assert.deepEqual(Object.keys(dump).sort(), [
            'turnero-release-experiment-registry:v1',
            'turnero-release-optimization-backlog:v1',
        ]);

        const experimentStore = JSON.parse(
            dump['turnero-release-experiment-registry:v1']
        );
        const backlogStore = JSON.parse(
            dump['turnero-release-optimization-backlog:v1']
        );

        assert.equal(experimentStore.regional.length, 1);
        assert.equal(experimentStore.north.length, 1);
        assert.equal(backlogStore.regional.length, 1);
        assert.equal(backlogStore.north.length, 1);
        assert.equal(experimentStore.regional[0].id, 'exp-regional');
        assert.equal(experimentStore.north[0].id, 'exp-north');
        assert.equal(backlogStore.regional[0].id, 'backlog-regional');
        assert.equal(backlogStore.north[0].id, 'backlog-north');
    });
});

test('mount renders the optimization hub, exports JSON and persists edits', async () => {
    const module = await loadTelemetryOptimizationHubModule();
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloadClicks = [];
    const blobs = [];

    class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    }

    const documentStub = createDocumentStub(downloadClicks);
    const navigatorStub = {
        clipboard: {
            writeText: async (text) => {
                clipboard.push(text);
            },
        },
    };
    const URLStub = {
        createObjectURL(blob) {
            blobs.push(blob);
            return 'blob:turnero-release-telemetry-optimization-hub';
        },
        revokeObjectURL() {},
    };
    const target = new StubElement('div');
    const clinicProfile = buildTelemetryClinicProfile();
    const pilotReadiness = buildPilotReadiness({
        clinicId: 'clinica-dual',
        profileFingerprint: 'abcd1234',
    });
    const remoteReadiness = buildRemoteReadiness({
        clinicId: 'clinica-dual',
        profileFingerprint: 'abcd1234',
    });
    const shellDrift = buildShellDrift({
        driftStatus: 'ready',
    });
    const evidenceBundle = buildEvidenceSnapshot({
        turneroClinicProfile: clinicProfile,
        pilotReadiness,
        remoteReleaseReadiness: remoteReadiness,
        publicShellDrift: shellDrift,
    });

    evidenceBundle.regionalClinics = clinicProfile.regionalClinics;

    const queueSurfaceStatus = {
        operator: {
            label: 'Operador',
            status: 'ready',
            summary: 'Operador listo para atención.',
            latest: {
                deviceLabel: 'Operador C1 fijo',
                ageSec: 4,
                details: {
                    summary: 'Equipo listo para operar en C1 fijo.',
                },
            },
        },
        kiosk: {
            label: 'Kiosco',
            status: 'ready',
            summary: 'Kiosco listo para emitir turnos.',
            latest: {
                deviceLabel: 'Kiosco principal',
                ageSec: 6,
                details: {
                    summary: 'Kiosco estable.',
                },
            },
        },
        display: {
            label: 'Sala',
            status: 'warning',
            summary: 'Sala a la espera de sincronización.',
            latest: {
                deviceLabel: 'Sala principal',
                ageSec: 9,
                details: {
                    displayLatencyMs: 180,
                    summary: 'Pintado en progreso.',
                },
            },
        },
    };
    const queueMeta = {
        updatedAt: new Date().toISOString(),
        waitingCount: 10,
        calledCount: 10,
        counts: {
            waiting: 10,
            called: 10,
            completed: 80,
            no_show: 0,
            cancelled: 0,
        },
        estimatedWaitMin: 3,
        assistancePendingCount: 0,
    };

    await withGlobals(
        {
            localStorage: storage,
            navigator: navigatorStub,
            document: documentStub,
            Blob: BlobStub,
            URL: URLStub,
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            HTMLInputElement: StubElement,
            HTMLTextAreaElement: StubElement,
            setTimeout: (fn) => {
                if (typeof fn === 'function') {
                    fn();
                }
                return 0;
            },
        },
        async () => {
            const experimentRegistry =
                module.createTurneroReleaseExperimentRegistry('regional');
            const backlogRegistry =
                module.createTurneroReleaseOptimizationBacklog('regional');
            experimentRegistry.add({
                id: 'exp-1',
                title: 'Reduce no-show prompts',
                owner: 'ops',
                hypothesis: 'Send one reminder before peak hours.',
                status: 'planned',
                expectedGain: 7,
            });
            backlogRegistry.add({
                id: 'backlog-1',
                title: 'Tune queue telemetry cards',
                owner: 'ops',
                impact: 'high',
                effort: 'small',
                status: 'open',
            });

            const result = module.mountTurneroReleaseTelemetryOptimizationHub(
                target,
                {
                    scope: 'regional',
                    region: 'regional',
                    turneroClinicProfile: clinicProfile,
                    queueMeta,
                    queueSurfaceStatus,
                    turneroReleaseEvidenceBundle: evidenceBundle,
                }
            );

            assert.ok(result);
            assert.equal(target.children.length, 1);
            assert.equal(target.children[0], result.root);
            assert.equal(
                result.root.className,
                'turnero-release-telemetry-optimization-hub-root'
            );

            const section = result.root.querySelector(
                '#turneroReleaseTelemetryOptimizationHub'
            );
            assert.equal(section.dataset.turneroScope, 'regional');
            assert.equal(section.dataset.turneroRegion, 'regional');

            assert.match(result.root.innerHTML, /Telemetry Optimization Hub/);
            assert.match(result.root.innerHTML, /Catálogo de eventos/);
            assert.match(result.root.innerHTML, /Readiness/);
            assert.match(result.root.innerHTML, /Copy brief/);
            assert.match(result.root.innerHTML, /Download JSON/);
            assert.match(result.root.innerHTML, /Clínica Dual/);
            assert.match(result.root.innerHTML, /data-state="ready"/);
            assert.match(result.root.innerHTML, /data-band="stable"/);
            assert.match(result.root.innerHTML, /1 experimento\(s\) activos/);
            assert.match(result.root.innerHTML, /1 item\(s\) pendientes\./);

            await result.root.listeners.get('click')({
                target: createActionTarget('copy-optimization-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /# Telemetry Optimization Hub/);
            assert.match(clipboard[0], /Scope: regional/);
            assert.match(clipboard[0], /Clinic: Clínica Dual/);

            await result.root.listeners.get('click')({
                target: createActionTarget('copy-optimization-json'),
            });
            assert.equal(clipboard.length, 2);
            const copiedSnapshot = JSON.parse(clipboard[1]);
            assert.equal(copiedSnapshot.scope, 'regional');
            assert.equal(copiedSnapshot.score.decision, 'ready');
            assert.equal(copiedSnapshot.experiments.length, 1);
            assert.equal(copiedSnapshot.backlog.length, 1);

            await result.root.listeners.get('click')({
                target: createActionTarget('download-optimization-json'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-telemetry-optimization-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);
            assert.equal(blobs.length, 1);
            const downloadedSnapshot = JSON.parse(blobs[0].parts[0]);
            assert.equal(downloadedSnapshot.region, 'regional');
            assert.equal(downloadedSnapshot.score.band, 'stable');
            assert.equal(downloadedSnapshot.surfaceSnapshots.length, 3);

            result.root.querySelector('[data-field="experiment-title"]').value =
                'Pilot copy on incident band';
            result.root.querySelector('[data-field="experiment-owner"]').value =
                'product';
            result.root.querySelector(
                '[data-field="experiment-hypothesis"]'
            ).value = 'Keeps the incident band compact.';
            result.root.querySelector('[data-field="experiment-gain"]').value =
                '5';
            await result.root.listeners.get('click')({
                target: createActionTarget('add-experiment'),
            });
            assert.equal(result.pack.experiments.length, 2);

            result.root.querySelector('[data-field="backlog-title"]').value =
                'Tighten telemetry grouping';
            result.root.querySelector('[data-field="backlog-owner"]').value =
                'ops';
            result.root.querySelector('[data-field="backlog-impact"]').value =
                'medium';
            result.root.querySelector('[data-field="backlog-effort"]').value =
                'small';
            await result.root.listeners.get('click')({
                target: createActionTarget('add-backlog-item'),
            });
            assert.equal(result.pack.backlog.length, 2);
            const experimentDump = JSON.parse(
                storage.dump()['turnero-release-experiment-registry:v1']
            );
            const backlogDump = JSON.parse(
                storage.dump()['turnero-release-optimization-backlog:v1']
            );
            assert.equal(experimentDump.regional.length, 2);
            assert.equal(backlogDump.regional.length, 2);
            assert.match(result.root.innerHTML, /2 experimento\(s\) activos/);
            assert.match(result.root.innerHTML, /2 item\(s\) pendientes\./);
            assert.match(result.root.innerHTML, /Telemetry Optimization Hub/);
        }
    );
});
