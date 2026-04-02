'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const AGENTS_MD = readFileSync(resolve(REPO_ROOT, 'AGENTS.md'), 'utf8');

const {
    CLINICAL_SAMPLE_PHOTOS,
    OPENCLAW_ENDPOINTS,
    PHASE_TWO_AUDIT_CHECK_KEYS,
    VERIFY_ALLOWED_EVIDENCE_TYPES,
    createLaunchGateChecks,
    createPhaseTwoAuditChecks,
    createVerificationChecks,
    createVerificationRegistry,
    evaluateLaunchGate,
    evaluateVerificationRegistry,
    getServiceAuroraCssCoverage,
    parseTaskLines,
    routeExists,
    verificationEvidenceTypeFor,
} = require('../bin/verify.js');

test('parseTaskLines captures current done task ids from AGENTS.md', () => {
    const taskLines = parseTaskLines(AGENTS_MD);

    assert.equal(taskLines['S36-05'].done, true);
    assert.equal(taskLines['S36-09'].done, true);
    assert.equal(taskLines['S37-01'].done, true);
    assert.equal(taskLines['S44-05'].done, true);
});

test('routeExists validates Sprint 3 controller routes with controller actions', () => {
    assert.equal(OPENCLAW_ENDPOINTS.length, 16);
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
    assert.equal(checks.baseCssReducedMotion(), true);
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

test('launch gate exposes 13 stable checks for release preflight', () => {
    const checks = createLaunchGateChecks();

    assert.equal(checks.length, 13);
    assert.deepEqual(
        checks.map((check) => check.id),
        [
            'auth.endpoint',
            'auth.surface',
            'booking.endpoint',
            'booking.surface',
            'consent.endpoint',
            'consent.surface',
            'payments.endpoint',
            'payments.surface',
            'documents.endpoint',
            'documents.surface',
            'analytics.ga4_head',
            'governance.done_without_rule',
            'health.endpoint',
        ]
    );
});

test('launch gate passes on the current repository snapshot', () => {
    const gate = evaluateLaunchGate(AGENTS_MD);

    assert.equal(gate.gate, 'launch');
    assert.equal(gate.ok, true);
    assert.equal(gate.summary.total, 13);
    assert.equal(gate.summary.failed, 0);
    assert.deepEqual(gate.blockers, []);
    assert.equal(gate.verification.doneWithoutRule < 100, true);
});

test('verify CLI returns launch gate JSON when requested', () => {
    const stdout = execFileSync(
        process.execPath,
        [resolve(REPO_ROOT, 'bin/verify.js'), '--gate', 'launch', '--json'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    const payload = JSON.parse(stdout);

    assert.equal(payload.gate, 'launch');
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.total, 13);
    assert.equal(payload.summary.failed, 0);
});

test('verify CLI JSON exposes noCheckTasks and single-task results for tooling', () => {
    const result = spawnSync(
        process.execPath,
        [resolve(REPO_ROOT, 'bin/verify.js'), '--task', 'S44-01', '--json'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    const payload = JSON.parse(result.stdout || '{}');

    assert.equal(result.status, 1);
    assert.equal(Array.isArray(payload.noCheckTasks), true);
    assert.equal(Array.isArray(payload.withoutEvidence), true);
    assert.equal(payload.taskId, 'S44-01');
    assert.equal(payload.taskHasRule, true);
    assert.equal(payload.taskResult, true);
});
