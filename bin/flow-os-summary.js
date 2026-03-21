#!/usr/bin/env node
'use strict';

const {
    loadFlowOsManifest,
} = require('../src/domain/flow-os/load-manifest.js');
const {
    listJourneyStages,
    resolveCaseStatusStage,
    summarizeJourney,
} = require('../src/domain/flow-os/patient-journey.js');

const manifest = loadFlowOsManifest();
const stageId = process.argv[2] || 'scheduled';
const summary = summarizeJourney(stageId);
const stages = listJourneyStages();
const lookupStatus = process.argv[3] || '';
const resolvedStage = lookupStatus
    ? resolveCaseStatusStage(lookupStatus)
    : null;

if (process.argv.includes('--json')) {
    console.log(
        JSON.stringify(
            {
                contract: manifest.contract,
                scope: manifest.scope,
                version: manifest.version,
                stages,
                stageSummary: summary,
                resolvedCaseStatus: lookupStatus
                    ? {
                          caseStatus: lookupStatus,
                          stage: resolvedStage,
                      }
                    : null,
            },
            null,
            2
        )
    );
    process.exit(0);
}

console.log(`Flow OS v${manifest.version}`);
console.log(`Contract: ${manifest.contract}`);
console.log(`Scope: ${manifest.scope}`);
console.log(`Stage: ${summary.stage} (${summary.label})`);
console.log(`Summary: ${summary.summary}`);
console.log(`Maps to: ${summary.mapsToCaseStatuses.join(', ') || 'none'}`);
console.log(`Next: ${summary.nextStages.join(', ') || 'none'}`);
if (lookupStatus) {
    console.log(
        `Resolved case status "${lookupStatus}": ${
            resolvedStage ? resolvedStage.id : 'none'
        }`
    );
}
