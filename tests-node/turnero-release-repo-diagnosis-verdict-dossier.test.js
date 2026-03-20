'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const {
    loadModule,
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
        closest() {
            return this;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(host, downloadClicks) {
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
        getElementById(id) {
            return String(id) === 'queueReleaseRepoDiagnosisVerdictDossierHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-repo-diagnosis-verdict-dossier]'
                ? host
                : null;
        },
    };
}

function buildCurrentSnapshot() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-dossier',
        region: 'north',
        branding: {
            name: 'Clínica Dossier',
            short_name: 'Dossier',
            base_url: 'https://dossier.example',
        },
        runtime_meta: {
            source: 'file',
            profileFingerprint: 'dossier-1234',
        },
    });

    return {
        clinicId: 'clinica-dossier',
        clinicLabel: 'Clínica Dossier',
        clinicShortName: 'Dossier',
        region: 'north',
        blockers: [
            {
                id: 'blk-1',
                kind: 'runtime-source-drift',
                owner: 'infra',
                severity: 'high',
                status: 'open',
            },
            {
                id: 'blk-2',
                kind: 'signoff-gap',
                owner: 'program',
                severity: 'low',
                status: 'closed',
            },
        ],
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        generatedAt: '2026-03-19T12:00:00.000Z',
    };
}

test('builds the default dossier manifest, persists stores without localStorage and scores the pack', async () => {
    const module = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-repo-diagnosis-verdict-dossier.js',
        'repo-diagnosis-dossier-shared'
    );

    const manifest = module.buildTurneroReleaseVerdictDossierManifest();
    assert.equal(manifest.rows.length, 5);
    assert.equal(manifest.summary.all, 5);
    assert.equal(manifest.summary.critical, 3);
    assert.equal(manifest.summary.high, 2);

    const previousLocalStorage = Object.getOwnPropertyDescriptor(
        global,
        'localStorage'
    );

    try {
        delete global.localStorage;

        const consensusStore =
            module.createTurneroReleaseFinalEvidenceConsensusStore('north');
        const disagreementStore =
            module.createTurneroReleaseHumanReviewDisagreementLedger('north');

        for (const row of manifest.rows) {
            consensusStore.add({
                key: row.key,
                label: row.label,
                owner: row.owner,
                verdict: 'accepted',
                note: `${row.key} accepted`,
            });
        }
        disagreementStore.add({
            reviewer: 'reviewer-1',
            key: 'review-1',
            severity: 'medium',
            note: 'Open human review',
            status: 'open',
        });

        const secondConsensusStore =
            module.createTurneroReleaseFinalEvidenceConsensusStore('north');
        const secondDisagreementStore =
            module.createTurneroReleaseHumanReviewDisagreementLedger('north');

        assert.equal(secondConsensusStore.list().length, 5);
        assert.equal(secondDisagreementStore.list().length, 1);

        disagreementStore.clear();
        assert.equal(
            module
                .createTurneroReleaseHumanReviewDisagreementLedger('north')
                .list().length,
            0
        );

        const blockers = buildCurrentSnapshot().blockers;
        const casefile = module.buildTurneroReleaseRepoDiagnosisCasefile({
            manifestRows: manifest.rows,
            consensusRows: secondConsensusStore.list(),
            blockers,
        });
        assert.equal(casefile.summary.all, 5);
        assert.equal(casefile.summary.closed, 4);
        assert.equal(casefile.summary.review, 1);
        assert.equal(casefile.summary.open, 0);

        const riskResidual = module.buildTurneroReleaseFinalRiskResidualMap({
            blockers,
        });
        assert.equal(riskResidual.summary.all, 2);
        assert.equal(riskResidual.summary.elevated, 1);
        assert.equal(riskResidual.summary.mitigated, 1);

        const score = module.buildTurneroReleaseVerdictDossierScore({
            casefileSummary: casefile.summary,
            riskSummary: riskResidual.summary,
            disagreements: [],
            consensus: secondConsensusStore.list(),
        });
        assert.equal(score.score, 89);
        assert.equal(score.band, 'near-ready');
        assert.equal(score.decision, 'resolve-last-comments');

        const report = module.buildTurneroReleaseFinalVerdictDossier({
            scope: 'north',
            region: 'north',
            clinicLabel: 'Clínica Dossier',
            casefile,
            consensus: secondConsensusStore.list(),
            riskResidual,
            disagreements: [],
            dossierScore: score,
            generatedAt: '2026-03-19T12:00:00.000Z',
        });
        assert.match(report.markdown, /Repo Diagnosis Verdict Dossier/);
        assert.match(report.markdown, /Dossier score: 89/);
        assert.match(report.markdown, /Open disagreements: 0/);
    } finally {
        if (previousLocalStorage) {
            Object.defineProperty(global, 'localStorage', previousLocalStorage);
        } else {
            delete global.localStorage;
        }
    }
});

test('mounts the verdict dossier in the admin queue host and recomputes idempotently', async () => {
    const clipboardTexts = [];
    const downloadClicks = [];
    const storage = createLocalStorageStub();
    const host = new HTMLElementStub(
        'div',
        'queueReleaseRepoDiagnosisVerdictDossierHost'
    );
    const currentSnapshot = buildCurrentSnapshot();

    const blob = class MockBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    };

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host, downloadClicks),
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
                createObjectURL: () => 'blob:repo-diagnosis-dossier',
                revokeObjectURL: () => {},
            },
        },
        async () => {
            const store = await loadModule(
                'src/apps/admin-v3/shared/core/store.js'
            );
            const wrapper = await loadFreshModule(
                'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/repo-diagnosis-verdict-dossier.js',
                'repo-diagnosis-dossier-wrapper'
            );
            const shared = await loadFreshModule(
                'src/apps/queue-shared/turnero-release-repo-diagnosis-verdict-dossier.js',
                'repo-diagnosis-dossier-shared-runtime'
            );

            const manifest = shared.buildTurneroReleaseVerdictDossierManifest();
            const consensusStore =
                shared.createTurneroReleaseFinalEvidenceConsensusStore('north');
            manifest.rows.forEach((row, index) => {
                consensusStore.add({
                    key: row.key,
                    label: row.label,
                    owner: row.owner,
                    verdict: 'accepted',
                    note: `Consensus ${index + 1}`,
                });
            });

            const state = store.getState();
            store.setState({
                ...state,
                data: {
                    ...state.data,
                    turneroClinicProfile: currentSnapshot.turneroClinicProfile,
                    turneroReleaseEvidenceBundle: currentSnapshot,
                    turneroReleaseSnapshot: currentSnapshot,
                    currentSnapshot,
                },
            });

            try {
                const result = wrapper.renderQueueRepoDiagnosisVerdictDossier(
                    { id: 'queue' },
                    'web'
                );

                assert.ok(result);
                assert.equal(host.children.length, 1);

                const root = host.children[0];
                assert.equal(
                    root.id,
                    'turneroReleaseRepoDiagnosisVerdictDossier'
                );
                assert.equal(
                    root.dataset.turneroReleaseRepoDiagnosisVerdictDossier,
                    'mounted'
                );
                assert.equal(
                    root.dataset.turneroReleaseRepoDiagnosisVerdictDossierScope,
                    'north'
                );
                assert.equal(
                    root.dataset.turneroReleaseRepoDiagnosisVerdictDossierBand,
                    'near-ready'
                );
                assert.equal(
                    root.dataset.turneroReleaseRepoDiagnosisVerdictDossierScore,
                    '89'
                );
                assert.match(root.innerHTML, /Repo Diagnosis Verdict Dossier/);
                assert.match(root.innerHTML, /Copy dossier brief/);
                assert.match(root.innerHTML, /Download dossier JSON/);
                assert.equal(
                    root.querySelector('[data-role="score"]').textContent,
                    '89'
                );

                const clickHandler = root.listeners.get('click');
                assert.equal(typeof clickHandler, 'function');

                await clickHandler({
                    target: createActionTarget('copy-dossier-brief'),
                });
                assert.equal(clipboardTexts.length, 1);
                assert.match(
                    clipboardTexts[0],
                    /# Repo Diagnosis Verdict Dossier/
                );
                assert.match(clipboardTexts[0], /Dossier score: 89/);

                await clickHandler({
                    target: createActionTarget('download-dossier-pack'),
                });
                assert.equal(downloadClicks.length, 1);
                assert.equal(
                    downloadClicks[0].download,
                    'turnero-release-repo-diagnosis-verdict-dossier-pack.json'
                );
                assert.equal(downloadClicks[0].clicked, true);

                root.querySelector('[data-field="consensus-key"]').value =
                    'launch-verdict';
                root.querySelector('[data-field="consensus-owner"]').value =
                    'program';
                root.querySelector('[data-field="consensus-note"]').value =
                    'Need more evidence';

                await clickHandler({
                    target: createActionTarget('add-consensus'),
                });

                root.querySelector(
                    '[data-field="disagreement-reviewer"]'
                ).value = 'Ana';
                root.querySelector('[data-field="disagreement-key"]').value =
                    'launch-verdict';
                root.querySelector('[data-field="disagreement-note"]').value =
                    'Still pending signoff';

                await clickHandler({
                    target: createActionTarget('add-disagreement'),
                });

                assert.equal(result.pack.consensus.length, 6);
                assert.equal(result.pack.disagreements.length, 1);
                assert.equal(result.pack.dossierScore.score, 92.5);
                assert.equal(
                    root.dataset.turneroReleaseRepoDiagnosisVerdictDossierScore,
                    '92.5'
                );
                assert.equal(
                    root.querySelector('[data-role="score"]').textContent,
                    '92.5'
                );
                assert.equal(host.children.length, 1);

                const rerendered =
                    wrapper.renderQueueRepoDiagnosisVerdictDossier(
                        { id: 'queue' },
                        'web'
                    );
                assert.ok(rerendered);
                assert.equal(host.children.length, 1);
                assert.equal(
                    host.children[0].id,
                    'turneroReleaseRepoDiagnosisVerdictDossier'
                );
            } finally {
                store.resetState();
            }
        }
    );
});

test('source wiring covers the host, wrapper and shared module', () => {
    const headerPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
    );
    const installHubPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
    );
    const wrapperPath = resolve(
        REPO_ROOT,
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/repo-diagnosis-verdict-dossier.js'
    );
    const sharedPath = resolve(
        REPO_ROOT,
        'src/apps/queue-shared/turnero-release-repo-diagnosis-verdict-dossier.js'
    );

    const headerSource = readFileSync(headerPath, 'utf8');
    const installHubSource = readFileSync(installHubPath, 'utf8');
    const wrapperSource = readFileSync(wrapperPath, 'utf8');
    const sharedSource = readFileSync(sharedPath, 'utf8');

    assert.match(headerSource, /queueReleaseRepoDiagnosisVerdictDossierHost/);
    assert.match(
        headerSource,
        /data-turnero-release-repo-diagnosis-verdict-dossier/
    );
    assert.match(installHubSource, /renderQueueRepoDiagnosisVerdictDossier/);
    assert.match(
        installHubSource,
        /queueReleaseRepoDiagnosisVerdictDossierHost/
    );
    assert.match(wrapperSource, /wireTurneroRepoDiagnosisVerdictDossier/);
    assert.match(wrapperSource, /renderQueueRepoDiagnosisVerdictDossier/);
    assert.match(
        sharedSource,
        /mountTurneroReleaseRepoDiagnosisVerdictDossier/
    );
    assert.match(sharedSource, /buildTurneroReleaseFinalVerdictDossier/);
});
