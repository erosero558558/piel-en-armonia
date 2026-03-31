'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const AGENTS_MD = readFileSync(resolve(REPO_ROOT, 'AGENTS.md'), 'utf8');

const {
    CLINICAL_SAMPLE_PHOTOS,
    OPENCLAW_ENDPOINTS,
    PHASE_TWO_AUDIT_CHECK_KEYS,
    VERIFY_ALLOWED_EVIDENCE_TYPES,
    createPhaseTwoAuditChecks,
    createVerificationChecks,
    createVerificationRegistry,
    evaluateVerificationRegistry,
    getServiceAuroraCssCoverage,
    parseTaskLines,
    routeExists,
    verificationEvidenceTypeFor,
} = require('../bin/verify.js');

test('parseTaskLines captures OpenClaw task ids from AGENTS.md', () => {
    const taskLines = parseTaskLines(AGENTS_MD);

    assert.equal(taskLines['S3-OC1'].done, true);
    assert.equal(taskLines['S3-OC4'].done, true);
    assert.equal(taskLines['S7-22'].done, true);
    assert.equal(taskLines['UI2-20'].done, true);
});

test('routeExists validates Sprint 3 controller routes with controller actions', () => {
    assert.equal(OPENCLAW_ENDPOINTS.length, 13);
    assert.equal(
        OPENCLAW_ENDPOINTS.every((endpoint) =>
            routeExists(
                endpoint.method,
                endpoint.resource,
                'OpenclawController',
                endpoint.action
            )
        ),
        true
    );
    assert.equal(
        routeExists(
            'POST',
            'clinical-media-upload',
            'ClinicalHistoryController',
            'uploadMedia'
        ),
        true
    );
    assert.equal(
        routeExists('GET', 'doctor-profile', 'DoctorProfileController', 'show'),
        true
    );
});

test('Sprint 3 structural checks cover clinical media, OpenClaw, and telemedicine surfaces', () => {
    const checks = createVerificationChecks();

    assert.deepEqual(
        CLINICAL_SAMPLE_PHOTOS.filter((relativePath) =>
            relativePath.endsWith('.jpg')
        ).length,
        3
    );
    assert.equal(checks['S3-16'](), true);
    assert.equal(checks['S3-29'](), true);
    assert.equal(checks['S3-OC4'](), true);
});

test('Phase 2 UI audit checks capture the current repo gaps explicitly', () => {
    const checks = createPhaseTwoAuditChecks();
    const coverage = getServiceAuroraCssCoverage();

    assert.deepEqual(
        Object.keys(checks).sort(),
        PHASE_TWO_AUDIT_CHECK_KEYS.slice().sort()
    );
    assert.equal(coverage.total, 0);
    assert.equal(coverage.matched, 0);
    assert.equal(coverage.missing.length, 0);
    assert.equal(checks.serviceCssCoverage(), false);
    assert.equal(checks.salaTurnosAriaLive(), true);
    assert.equal(checks.baseCssReducedMotion(), false);
    assert.equal(checks.manifestShortcuts(), true);
    assert.equal(checks.portalFetch(), false);
});

test('UI2-20 verification rule exists once the Phase 2 audit checks are wired', () => {
    const checks = createVerificationChecks();

    assert.equal(typeof checks['UI2-20'], 'function');
    assert.equal(checks['UI2-20'](), true);
});

test('verification registry expands to at least 100 tasks with explicit evidence types', () => {
    const registry = createVerificationRegistry();
    const keys = Object.keys(registry);

    assert.equal(keys.length >= 100, true);
    assert.equal(VERIFY_ALLOWED_EVIDENCE_TYPES.includes('file_exists'), true);
    assert.equal(VERIFY_ALLOWED_EVIDENCE_TYPES.includes('grep'), true);
    assert.equal(VERIFY_ALLOWED_EVIDENCE_TYPES.includes('json_key'), true);
    assert.equal(verificationEvidenceTypeFor('S1-04'), 'json_key');
    assert.equal(verificationEvidenceTypeFor('S4-14'), 'file_exists');
    assert.equal(verificationEvidenceTypeFor('S13-14'), 'grep');
    assert.equal(
        keys.every((taskId) =>
            VERIFY_ALLOWED_EVIDENCE_TYPES.includes(registry[taskId].evidence)
        ),
        true
    );
});

test('evaluation reports done tasks without verification rule explicitly', () => {
    const markdown = '- [x] **S99-99** placeholder';
    const evaluation = evaluateVerificationRegistry(markdown);

    assert.deepEqual(evaluation.results.doneWithoutRule, ['S99-99']);
});
