#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    installFakeDom,
    installLocalStorageMock,
    readJson,
} = require('./turnero-surface-rollout-test-helpers.js');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

const CLINIC_PROFILE = Object.freeze({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clínica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    region: 'sierra',
    surfaces: {
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
});

const SURFACE_REGISTRY = readJson('data/turnero-surfaces.json');
const PILOT_MANIFEST = readJson('app-downloads/pilot/release-manifest.json');

let dom;
let storage;

test.beforeEach(() => {
    storage = installLocalStorageMock();
    dom = installFakeDom();
    global.__createdTurneroBlobs = [];
});

test.afterEach(() => {
    dom?.cleanup();
    storage?.cleanup();
    delete global.__createdTurneroBlobs;
});

test('admin rollout console renders regional summary, three snapshots and clipboard/download actions', async () => {
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-rollout-console.js'
    );

    const host = dom.document.createElement('div');
    const mounted = consoleModule.mountTurneroAdminQueueSurfaceRolloutConsole(
        host,
        {
            clinicProfile: CLINIC_PROFILE,
            scope: 'regional',
            surfaceRegistry: SURFACE_REGISTRY,
            releaseManifest: PILOT_MANIFEST,
            snapshots: [
                { surfaceKey: 'operator' },
                { surfaceKey: 'kiosk' },
                { surfaceKey: 'sala_tv' },
            ],
        }
    );

    assert.equal(mounted, host);
    assert.equal(host.dataset.scope, 'regional');
    assert.match(host.innerHTML, /Consola de rollout por clínica/);
    assert.match(host.innerHTML, /Scope regional/);
    assert.match(host.innerHTML, /data-surface="operator-turnos"/);
    assert.match(host.innerHTML, /data-surface="kiosco-turnos"/);
    assert.match(host.innerHTML, /data-surface="sala-turnos"/);

    const operatorBannerHost = host.querySelector(
        '[data-turnero-surface-rollout-banner="operator-turnos"]'
    );
    assert.ok(operatorBannerHost);
    assert.match(operatorBannerHost.innerHTML, /Turnero Operador/);
    assert.match(operatorBannerHost.innerHTML, /Scope regional/);

    const operatorChipsHost = host.querySelector(
        '[data-turnero-surface-rollout-chips="operator-turnos"]'
    );
    assert.ok(operatorChipsHost);
    assert.equal(operatorChipsHost.children.length, 3);
    assert.match(operatorChipsHost.children[0].innerHTML, /asset/i);

    const actionButtons = host
        .querySelectorAll('[data-action]')
        .filter((button) => button instanceof HTMLButtonElement);
    const copySummaryButton = actionButtons.find(
        (button) => button.dataset.action === 'copy-summary'
    );
    const downloadSummaryButton = actionButtons.find(
        (button) => button.dataset.action === 'download-summary'
    );
    const copySurfaceButton = actionButtons.find(
        (button) =>
            button.dataset.action === 'copy-surface' &&
            button.dataset.surface === 'operator-turnos'
    );
    const downloadSurfaceButton = actionButtons.find(
        (button) =>
            button.dataset.action === 'download-surface' &&
            button.dataset.surface === 'operator-turnos'
    );

    assert.ok(copySummaryButton);
    assert.ok(downloadSummaryButton);
    assert.ok(copySurfaceButton);
    assert.ok(downloadSurfaceButton);

    await copySummaryButton.click();
    assert.ok(
        dom.clipboardWrites.at(-1).includes('Scope: regional'),
        'summary copy should include the regional scope'
    );

    await downloadSummaryButton.click();
    assert.equal(global.__createdTurneroBlobs.length, 1);

    await copySurfaceButton.click();
    assert.match(dom.clipboardWrites.at(-1), /# Turnero Surface Rollout/);

    await downloadSurfaceButton.click();
    assert.equal(global.__createdTurneroBlobs.length, 2);
});
