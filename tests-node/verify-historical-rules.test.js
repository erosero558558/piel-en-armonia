'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const VERIFY_SOURCE = readFileSync(resolve(REPO_ROOT, 'bin/verify.js'), 'utf8');

const {
    createVerificationChecks,
    evaluateVerificationRegistry,
} = require('../bin/verify.js');

const HISTORICAL_IDS = [
    'S14-00',
    'S14-02',
    'S14-06',
    'S14-08',
    'S14-09',
    'S14-11',
    'S14-13',
    'S15-07',
    'S16-01',
    'S16-02',
    'S16-03',
    'S16-04',
    'S16-05',
    'S16-07',
    'S16-11',
    'S17-01',
    'S17-02',
    'S17-05',
    'S17-06',
    'S17-07',
    'S17-08',
    'S17-10',
    'S18-02',
    'S18-03',
    'S18-11',
    'S18-12',
    'S19-04',
    'S19-15',
    'S19-17',
];

test('historical S14-S23 coverage uses explicit rules instead of dummy placeholders', () => {
    assert.equal(VERIFY_SOURCE.includes('const dummyRules = {}'), false);
    assert.equal(VERIFY_SOURCE.includes('for (let s = 24; s <= 23; s++)'), false);

    const checks = createVerificationChecks();
    HISTORICAL_IDS.forEach((taskId) => {
        assert.equal(typeof checks[taskId], 'function', `${taskId} should have an explicit verification rule`);
    });

    const markdown = HISTORICAL_IDS.map(
        (taskId) => `- [x] **${taskId}** \`[M]\` historical placeholder`
    ).join('\n');
    const evaluation = evaluateVerificationRegistry(markdown);

    assert.deepEqual(evaluation.results.doneWithoutRule, []);
});
