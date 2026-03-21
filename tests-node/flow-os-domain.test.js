'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadFlowOsManifest,
} = require('../src/domain/flow-os/load-manifest.js');
const {
    canTransition,
    listJourneyStages,
    resolveCaseStatusStage,
    summarizeJourney,
} = require('../src/domain/flow-os/patient-journey.js');

test('flow os manifest loads with version and stages', () => {
    const manifest = loadFlowOsManifest();

    assert.equal(manifest.version, 1);
    assert.equal(manifest.contract, 'flow-os-first-slice');
    assert.equal(manifest.scope, 'patient_journey_minimum');
    assert.ok(Array.isArray(manifest.journeyStages));
    assert.equal(manifest.journeyStages.length, 5);
});

test('journey transitions are explicit', () => {
    assert.equal(canTransition('captured', 'triaged'), true);
    assert.equal(canTransition('scheduled', 'closed'), true);
    assert.equal(canTransition('captured', 'closed'), false);
});

test('journey stages expose the paid pilot loop in order', () => {
    const stages = listJourneyStages();

    assert.deepEqual(
        stages.map((stage) => stage.id),
        ['captured', 'triaged', 'scheduled', 'in_consult', 'closed']
    );
});

test('case statuses resolve to the canonical paid pilot stages', () => {
    assert.equal(resolveCaseStatusStage('intake')?.stage ?? resolveCaseStatusStage('intake')?.id, 'captured');
    assert.equal(resolveCaseStatusStage('qualified')?.stage ?? resolveCaseStatusStage('qualified')?.id, 'triaged');
    assert.equal(resolveCaseStatusStage('booked')?.stage ?? resolveCaseStatusStage('booked')?.id, 'scheduled');
    assert.equal(resolveCaseStatusStage('queued')?.stage ?? resolveCaseStatusStage('queued')?.id, 'in_consult');
    assert.equal(resolveCaseStatusStage('closed')?.stage ?? resolveCaseStatusStage('closed')?.id, 'closed');
    assert.equal(resolveCaseStatusStage('follow_up_pending'), null);
});

test('journey summary exposes next stages and mapped statuses', () => {
    const summary = summarizeJourney('scheduled');

    assert.equal(summary.stage, 'scheduled');
    assert.deepEqual(summary.nextStages, ['in_consult', 'closed']);
    assert.deepEqual(summary.mapsToCaseStatuses, ['booked', 'pre_visit_ready']);
    assert.equal(summary.isTerminal, false);
});
