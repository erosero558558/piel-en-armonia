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

async function loadAcceptanceModules() {
    const [
        snapshotModule,
        ledgerModule,
        signoffModule,
        gateModule,
        readoutModule,
        packModule,
    ] = await Promise.all([
        loadModule(
            'src/apps/queue-shared/turnero-surface-acceptance-snapshot.js'
        ),
        loadModule(
            'src/apps/queue-shared/turnero-surface-acceptance-ledger.js'
        ),
        loadModule(
            'src/apps/queue-shared/turnero-surface-stakeholder-signoff-store.js'
        ),
        loadModule('src/apps/queue-shared/turnero-surface-acceptance-gate.js'),
        loadModule(
            'src/apps/queue-shared/turnero-surface-acceptance-readout.js'
        ),
        loadModule('src/apps/queue-shared/turnero-surface-acceptance-pack.js'),
    ]);

    return {
        ...snapshotModule,
        ...ledgerModule,
        ...signoffModule,
        ...gateModule,
        ...readoutModule,
        ...packModule,
    };
}

test('acceptance stores persist by clinic and pack/readout normalize route-style surfaces', async () => {
    const {
        createTurneroSurfaceAcceptanceLedger,
        createTurneroSurfaceStakeholderSignoffStore,
        buildTurneroSurfaceAcceptancePack,
        formatTurneroSurfaceAcceptanceReadoutBrief,
    } = await loadAcceptanceModules();

    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-aceptacion',
        branding: {
            name: 'Clínica Aceptación',
            short_name: 'Aceptación',
        },
    });

    const evidenceLedger = createTurneroSurfaceAcceptanceLedger(clinicProfile);
    const signoffStore =
        createTurneroSurfaceStakeholderSignoffStore(clinicProfile);

    const olderEvidence = evidenceLedger.add({
        surfaceKey: 'operator-turnos',
        id: 'operator-evidence-1',
        title: 'Captura inicial',
        status: 'captured',
        note: 'Pantalla verificada.',
        createdAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
    });
    const newerEvidence = evidenceLedger.add({
        surfaceKey: 'operator-turnos',
        id: 'operator-evidence-2',
        title: 'Captura final',
        status: 'review',
        note: 'Validación final.',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
    });

    const olderSignoff = signoffStore.add({
        surfaceKey: 'operator-turnos',
        id: 'operator-signoff-1',
        stakeholder: 'ops-lead',
        role: 'reviewer',
        verdict: 'review',
        note: 'Pendiente de cierre.',
        createdAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
    });
    const newerSignoff = signoffStore.add({
        surfaceKey: 'operator-turnos',
        id: 'operator-signoff-2',
        stakeholder: 'qa-lead',
        role: 'reviewer',
        verdict: 'approve',
        note: 'Listo para operar.',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
    });

    assert.equal(evidenceLedger.remove(olderEvidence.id), true);
    assert.equal(signoffStore.remove(olderSignoff.id), true);
    assert.deepEqual(
        evidenceLedger
            .list({ surfaceKey: 'operator' })
            .map((entry) => entry.id),
        [newerEvidence.id]
    );
    assert.deepEqual(
        signoffStore.list({ surfaceKey: 'operator' }).map((entry) => entry.id),
        [newerSignoff.id]
    );

    const crossInstanceLedger =
        createTurneroSurfaceAcceptanceLedger(clinicProfile);
    const crossInstanceSignoffs =
        createTurneroSurfaceStakeholderSignoffStore(clinicProfile);

    assert.equal(
        crossInstanceLedger.list({ surfaceKey: 'operator-turnos' }).length,
        1
    );
    assert.equal(
        crossInstanceSignoffs.list({ surfaceKey: 'operator-turnos' }).length,
        1
    );

    const operatorPack = buildTurneroSurfaceAcceptancePack({
        surfaceKey: 'operator-turnos',
        clinicProfile,
        ledger: crossInstanceLedger,
        signoffStore: crossInstanceSignoffs,
    });

    assert.equal(operatorPack.surfaceKey, 'operator');
    assert.equal(operatorPack.snapshot.surfaceKey, 'operator');
    assert.equal(operatorPack.snapshot.truth.state, 'watch');
    assert.equal(operatorPack.gate.band, 'watch');
    assert.equal(operatorPack.gate.evidenceState, 'ready');
    assert.equal(operatorPack.gate.signoffState, 'ready');
    assert.equal(operatorPack.readout.chips.length, 6);
    assert.match(
        formatTurneroSurfaceAcceptanceReadoutBrief(operatorPack.readout),
        /Scope: operator/
    );
    assert.match(
        formatTurneroSurfaceAcceptanceReadoutBrief(operatorPack.readout),
        /Gate: watch/
    );

    const displayPack = buildTurneroSurfaceAcceptancePack({
        surfaceKey: 'sala-turnos',
        clinicProfile,
    });

    assert.equal(displayPack.surfaceKey, 'display');
    assert.equal(displayPack.snapshot.surfaceKey, 'display');
    assert.equal(displayPack.gate.band, 'ready');
    assert.equal(displayPack.gate.checklistState, 'watch');
    assert.equal(
        displayPack.readout.chips.find((chip) => chip.label === 'acceptance')
            .value,
        'ready'
    );
});
