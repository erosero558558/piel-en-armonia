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
}

installLocalStorageMock();

test.beforeEach(() => {
    global.localStorage.clear();
});

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
        },
        kiosk: {
            label: 'Turnero Kiosco',
        },
        display: {
            label: 'Turnero Sala TV',
        },
    },
});

test('surface integrity pack normalizes snapshot, mask and drift states', async () => {
    const integrityModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-integrity-pack.js'
    );

    const pack = integrityModule.buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'operator-turnos',
        queueVersion: 'qv-1',
        visibleTurn: 'A-202',
        announcedTurn: 'A-202',
        ticketDisplay: 'A202',
        maskedTicket: 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live',
        },
        evidence: [],
    });

    assert.equal(pack.snapshot.surfaceKey, 'operator-turnos');
    assert.equal(pack.snapshot.queueVersion, 'qv-1');
    assert.equal(pack.snapshot.visibleTurn, 'A-202');
    assert.equal(pack.snapshot.announcedTurn, 'A-202');
    assert.equal(pack.snapshot.ticketDisplay, 'A202');
    assert.equal(pack.snapshot.maskedTicket, 'A**2');
    assert.equal(pack.maskState.ticketDisplay, 'A202');
    assert.equal(pack.maskState.maskedTicket, 'A**2');
    assert.equal(pack.maskState.state, 'protected');
    assert.equal(pack.drift.state, 'aligned');
    assert.equal(pack.drift.severity, 'none');
    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.gate.decision, 'queue-integrity-ok');
});

test('surface ticket mask falls back to watch state and opens in full mode', async () => {
    const maskModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-ticket-mask.js'
    );

    assert.equal(maskModule.maskTurneroTicket('A202', 'masked'), 'A**2');

    const watchState = maskModule.buildTurneroSurfaceTicketMaskState({
        ticketDisplay: 'A201',
        maskedTicket: 'A201',
        privacyMode: 'masked',
    });
    assert.equal(watchState.state, 'watch');
    assert.equal(watchState.maskedTicket, 'A201');

    const openState = maskModule.buildTurneroSurfaceTicketMaskState({
        ticketDisplay: 'A202',
        privacyMode: 'full',
    });
    assert.equal(openState.state, 'open');
    assert.equal(openState.maskedTicket, 'A202');
});

test('surface announce drift detects kiosk and display scenarios', async () => {
    const integrityModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-integrity-pack.js'
    );

    const kioskPack = integrityModule.buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'kiosco-turnos',
        queueVersion: 'qv-1',
        visibleTurn: 'A-201',
        announcedTurn: '',
        ticketDisplay: 'A201',
        maskedTicket: 'A201',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live',
        },
        evidence: [],
    });
    assert.equal(kioskPack.drift.state, 'degraded');
    assert.equal(kioskPack.drift.severity, 'medium');
    assert.ok(
        kioskPack.drift.driftFlags.includes('missing-announced-turn'),
        'kiosk drift should flag the missing announcement'
    );
    assert.ok(
        kioskPack.drift.driftFlags.includes('ticket-not-masked'),
        'kiosk drift should flag the missing mask'
    );
    assert.equal(kioskPack.gate.band, 'degraded');

    const displayPack = integrityModule.buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'sala-turnos',
        queueVersion: 'qv-1',
        visibleTurn: 'A-202',
        announcedTurn: 'A-201',
        ticketDisplay: 'A202',
        maskedTicket: 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live',
        },
        evidence: [],
    });
    assert.equal(displayPack.drift.state, 'watch');
    assert.equal(displayPack.drift.severity, 'low');
    assert.ok(
        displayPack.drift.driftFlags.includes('announce-visible-mismatch'),
        'display drift should flag the visible/announced mismatch'
    );
    assert.equal(displayPack.gate.band, 'watch');
});

test('surface integrity banner html accepts a direct drift payload', async () => {
    const integrityModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-integrity-pack.js'
    );
    const bannerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-integrity-banner.js'
    );

    const pack = integrityModule.buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'operator-turnos',
        queueVersion: 'qv-1',
        visibleTurn: 'A-202',
        announcedTurn: 'A-202',
        ticketDisplay: 'A202',
        maskedTicket: 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: 'ready',
            channel: 'queue-state-live',
        },
        evidence: [],
    });

    const html = bannerModule.buildTurneroSurfaceIntegrityBannerHtml({
        drift: pack.drift,
        title: 'Operator surface integrity',
    });

    assert.match(html, /Operator surface integrity/);
    assert.match(html, /data-state="ready"/);
    assert.match(html, /A\*\*2/);
});

test('surface integrity ledger is clinic-scoped and filters by surface key', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-integrity-ledger.js'
    );

    const operatorLedger = ledgerModule.createTurneroSurfaceIntegrityLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherLedger = ledgerModule.createTurneroSurfaceIntegrityLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const first = operatorLedger.add({
        surfaceKey: 'operator-turnos',
        kind: 'manual-check',
        status: 'pass',
        owner: 'ops',
        note: 'Visible y anuncio alineados.',
    });
    operatorLedger.add({
        surfaceKey: 'kiosco-turnos',
        kind: 'manual-check',
        status: 'review',
        owner: 'ops',
        note: 'Mask pendiente de revisión.',
    });

    assert.equal(
        operatorLedger.list({ surfaceKey: 'operator-turnos' }).length,
        1
    );
    assert.equal(operatorLedger.list().length, 2);
    assert.equal(otherLedger.list().length, 0);
    assert.equal(
        operatorLedger.snapshot().schema,
        'turnero-surface-integrity-ledger/v1'
    );

    operatorLedger.remove(first.id);
    assert.equal(
        operatorLedger.list({ surfaceKey: 'operator-turnos' }).length,
        0
    );
    operatorLedger.clear({ surfaceKey: 'kiosco-turnos' });
    assert.equal(operatorLedger.list().length, 0);
});

test('admin queue integrity console html renders all surfaces and actions', async () => {
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-integrity-console.js'
    );

    const html =
        consoleModule.buildTurneroAdminQueueSurfaceIntegrityConsoleHtml({
            scope: 'regional',
            clinicProfile: CLINIC_PROFILE,
            drifts: [
                {
                    surfaceKey: 'operator-turnos',
                    queueVersion: 'qv-1',
                    visibleTurn: 'A-202',
                    announcedTurn: 'A-202',
                    ticketDisplay: 'A202',
                    maskedTicket: 'A**2',
                    privacyMode: 'masked',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'queue-state-live',
                },
                {
                    surfaceKey: 'kiosco-turnos',
                    queueVersion: 'qv-1',
                    visibleTurn: 'A-201',
                    announcedTurn: '',
                    ticketDisplay: 'A201',
                    maskedTicket: 'A201',
                    privacyMode: 'masked',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'queue-state-live',
                },
                {
                    surfaceKey: 'sala-turnos',
                    queueVersion: 'qv-1',
                    visibleTurn: 'A-202',
                    announcedTurn: 'A-201',
                    ticketDisplay: 'A202',
                    maskedTicket: 'A**2',
                    privacyMode: 'masked',
                    heartbeatState: 'ready',
                    heartbeatChannel: 'queue-state-live',
                },
            ],
        });

    assert.match(html, /turnero-admin-queue-surface-integrity-console/);
    assert.match(html, /Surface Queue Integrity Console/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-state="ready"/);
    assert.match(html, /data-state="degraded"/);
    assert.match(html, /data-state="degraded"/);
    assert.match(html, /A\*\*2/);
});
