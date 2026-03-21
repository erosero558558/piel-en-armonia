'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const evidence = require('../../tools/agent-orchestrator/domain/evidence');

function writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

test('evidence-engine clasifica evidencia canónica alineada', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-aligned-'));
    writeText(
        path.join(rootDir, 'verification', 'agent-runs', 'AG-001.md'),
        '# AG-001\n'
    );

    const row = evidence.analyzeTerminalTaskEvidence(
        {
            id: 'AG-001',
            status: 'done',
            evidence_ref: 'verification/agent-runs/AG-001.md',
            acceptance_ref: 'verification/agent-runs/AG-001.md',
        },
        { rootDir }
    );

    assert.equal(row.expected_ref, 'verification/agent-runs/AG-001.md');
    assert.equal(row.expected_exists, true);
    assert.equal(row.refs_aligned, true);
    assert.equal(row.reason, 'aligned');
});

test('evidence-engine clasifica refs presentes pero no canónicos', () => {
    const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'evidence-noncanonical-')
    );
    writeText(
        path.join(rootDir, 'verification', 'agent-runs', 'AG-002.md'),
        '# AG-002\n'
    );
    writeText(path.join(rootDir, 'docs', 'summary.md'), '# Summary\n');

    const row = evidence.analyzeTerminalTaskEvidence(
        {
            id: 'AG-002',
            status: 'done',
            evidence_ref: 'docs/summary.md',
            acceptance_ref: 'docs/summary.md',
        },
        { rootDir }
    );

    assert.equal(row.expected_exists, true);
    assert.equal(row.refs_aligned, false);
    assert.equal(row.reason, 'noncanonical_ref');
});

test('evidence-engine clasifica archivo canónico faltante', () => {
    const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'evidence-missing-expected-')
    );
    writeText(path.join(rootDir, 'docs', 'summary.md'), '# Summary\n');

    const row = evidence.analyzeTerminalTaskEvidence(
        {
            id: 'AG-003',
            status: 'done',
            evidence_ref: 'docs/summary.md',
            acceptance_ref: 'docs/summary.md',
        },
        { rootDir }
    );

    assert.equal(row.expected_exists, false);
    assert.equal(row.refs_aligned, false);
    assert.equal(row.reason, 'missing_expected_file');
});

test('evidence-engine clasifica refs faltantes', () => {
    const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'evidence-missing-refs-')
    );

    const row = evidence.analyzeTerminalTaskEvidence(
        {
            id: 'AG-004',
            status: 'failed',
            evidence_ref: '',
            acceptance_ref: '',
        },
        { rootDir }
    );

    assert.equal(row.expected_ref, 'verification/agent-runs/AG-004.md');
    assert.equal(row.reason, 'missing_refs');
    assert.equal(row.has_refs, false);
});

test('evidence-engine clasifica evidencia reconstruida como deuda no definitiva', () => {
    const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'evidence-reconstructed-')
    );
    writeText(
        path.join(rootDir, 'verification', 'agent-runs', 'AG-005.md'),
        [
            '# AG-005 — Reconstructed Evidence',
            '',
            'Reconstructed on 2026-03-21 because the canonical evidence file was missing.',
            '',
        ].join('\n')
    );

    const row = evidence.analyzeTerminalTaskEvidence(
        {
            id: 'AG-005',
            status: 'done',
            evidence_ref: 'verification/agent-runs/AG-005.md',
            acceptance_ref: 'verification/agent-runs/AG-005.md',
        },
        { rootDir }
    );

    assert.equal(row.expected_exists, true);
    assert.equal(row.refs_aligned, true);
    assert.equal(row.reason, 'reconstructed_evidence');
    assert.equal(row.debt, true);
});
