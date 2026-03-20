'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const {
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

async function loadFreshModule(relativePath, token = Date.now()) {
    const url = pathToFileURL(resolve(REPO_ROOT, relativePath)).href;
    return import(`${url}?t=${token}`);
}

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
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
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

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('[data-field=') ? 'input' : 'span'
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
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }
}

function createActionTarget(action) {
    return {
        closest(selector) {
            return selector === '[data-action]' ? this : null;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(host, downloadClicks, downloadEvents) {
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
        getElementById(id) {
            return String(id) === 'queueFinalDiagnosticLaunchConsoleHost'
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

function buildLaunchInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-demo',
        region: 'north',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
        },
    });
    const blockers = [
        {
            id: 'blk-1',
            kind: 'runtime-source-drift',
            owner: 'infra',
            severity: 'high',
            status: 'open',
        },
        {
            id: 'blk-2',
            kind: 'commit-evidence-gap',
            owner: 'program',
            severity: 'medium',
            status: 'open',
        },
    ];
    const generatedAt = '2026-03-19T12:00:00.000Z';
    const releaseEvidenceBundle = {
        generatedAt,
        blockers,
        gaps: blockers,
        surfaces: [],
        contracts: [],
        registryRows: [],
        inventoryRows: [],
        clinicProfile,
        turneroClinicProfile: clinicProfile,
    };
    const currentSnapshot = {
        generatedAt,
        clinicId: 'clinica-demo',
        clinicLabel: 'Clinica Demo',
        clinicShortName: 'Demo',
        region: 'north',
        scope: 'north',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        releaseEvidenceBundle,
        blockers,
        gaps: blockers,
        parts: {
            clinicProfile,
            releaseEvidenceBundle,
        },
    };

    return {
        generatedAt,
        scope: 'north',
        region: 'north',
        clinicId: 'clinica-demo',
        clinicLabel: 'Clinica Demo',
        clinicShortName: 'Demo',
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        currentSnapshot,
        releaseEvidenceBundle,
        blockers,
    };
}

test('builds the final diagnostic launch pack, readout and gate', async () => {
    const module = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-diagnostic-launch-console.js',
        'diagnostic-launch-pack'
    );
    const manifestModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-diagnosis-launch-manifest.js',
        'diagnostic-launch-manifest'
    );
    const lockModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-diagnostic-evidence-lock.js',
        'diagnostic-launch-lock'
    );
    const freezeModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-verdict-freeze-board.js',
        'diagnostic-launch-freeze'
    );
    const readoutModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-readout-engine.js',
        'diagnostic-launch-readout'
    );
    const gateModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-diagnostic-launch-gate.js',
        'diagnostic-launch-gate'
    );
    const briefModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-repo-readout-builder.js',
        'diagnostic-launch-brief'
    );

    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const lockStore =
            lockModule.createTurneroReleaseDiagnosticEvidenceLock('north');
        const signoffModule = await loadFreshModule(
            'src/apps/queue-shared/turnero-release-owner-signoff-registry.js',
            'diagnostic-launch-signoffs'
        );
        const signoffStore =
            signoffModule.createTurneroReleaseOwnerSignoffRegistry('north');
        const input = buildLaunchInput();

        const manifest =
            manifestModule.buildTurneroReleaseFinalDiagnosisLaunchManifest();
        assert.equal(manifest.rows.length, 6);
        assert.equal(manifest.summary.all, 6);
        assert.equal(manifest.summary.critical, 4);

        const pack = module.buildTurneroReleaseDiagnosticLaunchConsolePack(
            input,
            {
                lockStore,
                signoffStore,
            }
        );
        const freezeBoard = freezeModule.buildTurneroReleaseVerdictFreezeBoard({
            blockers: input.blockers,
        });
        const readout = readoutModule.buildTurneroReleaseFinalReadoutEngine({
            manifestSummary: manifest.summary,
            lock: lockStore.get(),
            freezeSummary: freezeBoard.summary,
            signoffs: [],
        });
        const launchGate = gateModule.buildTurneroReleaseDiagnosticLaunchGate({
            readout,
            signoffs: [],
        });
        const finalReadout = briefModule.buildTurneroReleaseFinalRepoReadout({
            lock: lockStore.get(),
            freezeBoard,
            launchGate,
        });

        assert.equal(pack.manifest.rows.length, 6);
        assert.equal(pack.manifest.summary.critical, 4);
        assert.equal(pack.freezeBoard.summary.all, 2);
        assert.equal(pack.freezeBoard.summary.frozen, 2);
        assert.equal(pack.freezeBoard.summary.high, 1);
        assert.equal(pack.readout.lockStatus, 'unlocked');
        assert.equal(pack.readout.criticalChecks, 4);
        assert.equal(pack.launchGate.score, 33);
        assert.equal(pack.launchGate.band, 'blocked');
        assert.equal(pack.launchGate.decision, 'hold-launch');
        assert.equal(pack.launchGate.totalSignoffs, 0);
        assert.equal(pack.launchGate.approved, 0);
        assert.match(
            pack.finalReadout.markdown,
            /Final Diagnostic Launch Console/
        );
        assert.match(pack.finalReadout.markdown, /Launch gate: 33 \(blocked\)/);
        assert.match(pack.finalReadout.markdown, /Evidence lock: unlocked/);
        assert.match(pack.finalReadout.markdown, /Signoffs approved: 0\/0/);
        assert.equal(
            pack.downloadFileName,
            'turnero-release-final-launch-pack.json'
        );
        assert.equal(pack.clipboardSummary, pack.finalReadout.markdown);

        assert.equal(finalReadout.markdown, pack.finalReadout.markdown);
        assert.match(finalReadout.markdown, /Frozen blockers: 2/);
        assert.match(finalReadout.markdown, /High frozen blockers: 1/);
    });
});

test('lock and signoff registries persist in localStorage', async () => {
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const lockModule = await loadFreshModule(
            'src/apps/queue-shared/turnero-release-diagnostic-evidence-lock.js',
            'diagnostic-launch-lock-store'
        );
        const signoffModule = await loadFreshModule(
            'src/apps/queue-shared/turnero-release-owner-signoff-registry.js',
            'diagnostic-launch-signoff-store'
        );

        const lockStore =
            lockModule.createTurneroReleaseDiagnosticEvidenceLock('north');
        assert.equal(lockStore.get(), null);
        const savedLock = lockStore.set({
            status: 'locked',
            note: 'Final evidence snapshot locked',
        });
        assert.equal(savedLock.status, 'locked');
        assert.match(savedLock.id, /^lock-/);
        assert.equal(lockStore.get().status, 'locked');
        lockStore.clear();
        assert.equal(lockStore.get(), null);

        const registry =
            signoffModule.createTurneroReleaseOwnerSignoffRegistry('north');
        assert.deepEqual(registry.list(), []);
        registry.add({
            owner: 'Lead reviewer',
            verdict: 'approve',
            note: 'ready',
        });
        registry.add({
            owner: 'QA lead',
            verdict: 'watch',
            note: 'check once',
        });
        const rows = registry.list();
        assert.equal(rows.length, 2);
        assert.equal(rows[0].owner, 'QA lead');
        assert.equal(rows[0].verdict, 'review');
        assert.equal(rows[1].owner, 'Lead reviewer');
        assert.equal(rows[1].verdict, 'approve');
        registry.clear();
        assert.deepEqual(registry.list(), []);
    });
});

test('mounts, copies, downloads and signs off the launch console', async () => {
    const storage = createLocalStorageStub();
    const host = new HTMLElementStub(
        'div',
        'queueFinalDiagnosticLaunchConsoleHost'
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
            localStorage: storage,
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
                    return 'blob:turnero-release-diagnostic-launch';
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
            const module = await loadFreshModule(
                'src/apps/queue-shared/turnero-release-diagnostic-launch-console.js',
                'diagnostic-launch-mount'
            );
            const lockModule = await loadFreshModule(
                'src/apps/queue-shared/turnero-release-diagnostic-evidence-lock.js',
                'diagnostic-launch-mount-lock'
            );
            const signoffModule = await loadFreshModule(
                'src/apps/queue-shared/turnero-release-owner-signoff-registry.js',
                'diagnostic-launch-mount-signoffs'
            );
            const lockStore =
                lockModule.createTurneroReleaseDiagnosticEvidenceLock('north');
            const signoffStore =
                signoffModule.createTurneroReleaseOwnerSignoffRegistry('north');

            signoffStore.add({
                owner: 'Release lead',
                verdict: 'approve',
                note: 'Ready to launch',
            });
            signoffStore.add({
                owner: 'QA lead',
                verdict: 'review',
                note: 'Minor note',
            });
            signoffStore.add({
                owner: 'Ops lead',
                verdict: 'approve',
                note: 'Green light',
            });

            const result = module.mountTurneroReleaseDiagnosticLaunchConsole(
                host,
                buildLaunchInput()
            );

            assert.ok(result);
            assert.equal(host.children.length, 1);
            assert.equal(
                result.root.id,
                'turneroReleaseDiagnosticLaunchConsole'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchConsole,
                'mounted'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchScope,
                'north'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchRegion,
                'north'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchScore,
                '49'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchBand,
                'blocked'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchDecision,
                'hold-launch'
            );
            assert.equal(
                result.root.dataset
                    .turneroReleaseDiagnosticLaunchApprovedSignoffs,
                '2'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchLockStatus,
                'unlocked'
            );
            assert.equal(
                result.root.dataset
                    .turneroReleaseDiagnosticLaunchFrozenBlockers,
                '2'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchHighFrozen,
                '1'
            );
            assert.equal(
                result.root.dataset
                    .turneroReleaseDiagnosticLaunchCriticalChecks,
                '4'
            );
            assert.match(
                result.root.innerHTML,
                /Final Diagnostic Launch Console/
            );
            assert.match(result.root.innerHTML, /Lock evidence/);
            assert.match(result.root.innerHTML, /Copy launch brief/);
            assert.match(result.root.innerHTML, /Download launch pack/);
            assert.match(result.root.innerHTML, /Add signoff/);
            assert.equal(result.pack.signoffs.length, 3);
            assert.equal(result.pack.launchGate.approved, 2);
            assert.equal(result.pack.launchGate.score, 49);
            assert.equal(result.pack.launchGate.band, 'blocked');

            const clickHandler = result.root.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: createActionTarget('lock-evidence'),
            });

            assert.equal(lockStore.get().status, 'locked');
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchLockStatus,
                'locked'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchScore,
                '69'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchBand,
                'review'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchDecision,
                'hold-launch'
            );
            assert.equal(result.pack.launchGate.approved, 2);
            assert.equal(result.pack.launchGate.score, 69);
            assert.match(
                result.root.querySelector('[data-role="launch-brief"]')
                    .textContent,
                /Launch gate: 69 \(review\)/
            );

            await clickHandler({
                target: createActionTarget('copy-launch-brief'),
            });

            assert.equal(clipboardTexts.length, 1);
            assert.match(
                clipboardTexts[0],
                /# Final Diagnostic Launch Console/
            );
            assert.match(clipboardTexts[0], /Evidence lock: locked/);
            assert.match(clipboardTexts[0], /Launch gate: 69 \(review\)/);

            await clickHandler({
                target: createActionTarget('download-launch-pack'),
            });

            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-final-launch-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);
            assert.ok(
                downloadClicks[0].href.startsWith(
                    'blob:turnero-release-diagnostic-launch'
                )
            );
            assert.equal(downloadClicks[0].rel, 'noopener');
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'url'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'revoke'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'timeout'));

            result.root.querySelector('[data-field="signoff-owner"]').value =
                'Dr. Ada';
            result.root.querySelector('[data-field="signoff-verdict"]').value =
                'approve';
            result.root.querySelector('[data-field="signoff-note"]').value =
                'Launch ready';

            await clickHandler({
                target: createActionTarget('add-signoff'),
            });

            assert.equal(result.pack.signoffs.length, 4);
            assert.equal(result.pack.signoffs[0].owner, 'Dr. Ada');
            assert.equal(result.pack.launchGate.approved, 3);
            assert.equal(result.pack.launchGate.score, 77);
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchScore,
                '77'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchBand,
                'near-ready'
            );
            assert.equal(
                result.root.dataset.turneroReleaseDiagnosticLaunchDecision,
                'collect-last-signoffs'
            );
            assert.equal(
                result.root.dataset
                    .turneroReleaseDiagnosticLaunchApprovedSignoffs,
                '3'
            );
            assert.match(
                result.root.querySelector('[data-role="launch-brief"]')
                    .textContent,
                /Launch gate: 77 \(near-ready\)/
            );
            assert.match(
                result.root.querySelector('[data-role="launch-brief"]')
                    .textContent,
                /Signoffs approved: 3\/4/
            );
            assert.match(
                result.pack.finalReadout.markdown,
                /Signoffs approved: 3\/4/
            );
        }
    );
});

test('source wiring covers the host, hub and shared launch console module', () => {
    const headerPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
    );
    const installHubPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
    );
    const sharedPath = resolve(
        REPO_ROOT,
        'src/apps/queue-shared/turnero-release-diagnostic-launch-console.js'
    );

    const headerSource = readFileSync(headerPath, 'utf8');
    const installHubSource = readFileSync(installHubPath, 'utf8');
    const sharedSource = readFileSync(sharedPath, 'utf8');

    assert.match(headerSource, /queueFinalDiagnosticLaunchConsoleHost/);
    assert.match(headerSource, /data-turnero-final-diagnostic-launch-console/);
    assert.match(
        installHubSource,
        /mountTurneroReleaseDiagnosticLaunchConsole/
    );
    assert.match(installHubSource, /renderQueueFinalDiagnosticLaunchConsole/);
    assert.match(installHubSource, /queueFinalDiagnosticLaunchConsoleHost/);
    assert.match(sharedSource, /mountTurneroReleaseDiagnosticLaunchConsole/);
    assert.match(
        sharedSource,
        /buildTurneroReleaseFinalDiagnosisLaunchManifest/
    );
    assert.match(sharedSource, /buildTurneroReleaseDiagnosticLaunchGate/);
    assert.match(sharedSource, /buildTurneroReleaseFinalRepoReadout/);
});
