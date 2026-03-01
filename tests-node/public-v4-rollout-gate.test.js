#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    'bin',
    'run-public-v4-rollout-gate.js'
);

function writeTempFile(name, content) {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v4-rollout-gate-'));
    const filePath = path.join(baseDir, name);
    fs.writeFileSync(filePath, content, 'utf8');
    return { baseDir, filePath };
}

function runGate(args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
    });
}

test('public-v4 rollout gate passes when canary stays within thresholds', () => {
    const metrics = [
        'conversion_funnel_events_total{event="view_booking",source="booking_form",public_surface="v4"} 80',
        'conversion_funnel_events_total{event="start_checkout",source="booking_form",public_surface="v4"} 40',
        'conversion_funnel_events_total{event="booking_confirmed",source="booking_form",public_surface="v4"} 20',
        'conversion_funnel_events_total{event="view_booking",source="booking_form",public_surface="legacy"} 120',
        'conversion_funnel_events_total{event="start_checkout",source="booking_form",public_surface="legacy"} 60',
        'conversion_funnel_events_total{event="booking_confirmed",source="booking_form",public_surface="legacy"} 33',
        '',
    ].join('\n');

    const { baseDir, filePath } = writeTempFile('metrics.prom', metrics);
    const outPath = path.join(baseDir, 'report.json');
    const result = runGate([
        '--metrics-file',
        filePath,
        '--out',
        outPath,
        '--min-view-booking',
        '20',
        '--min-start-checkout',
        '10',
        '--max-confirmed-drop-pp',
        '8',
        '--min-confirmed-rate-pct',
        '20',
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(outPath), true, 'missing rollout gate report');
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(report.passed, true);
    assert.equal(report.evaluation.testSurface, 'v4');
    assert.equal(report.evaluation.controlSurface, 'legacy');
});

test('public-v4 rollout gate fails when confirmed rate drop exceeds threshold', () => {
    const metrics = [
        'conversion_funnel_events_total{event="view_booking",source="booking_form",public_surface="v4"} 100',
        'conversion_funnel_events_total{event="start_checkout",source="booking_form",public_surface="v4"} 50',
        'conversion_funnel_events_total{event="booking_confirmed",source="booking_form",public_surface="v4"} 10',
        'conversion_funnel_events_total{event="view_booking",source="booking_form",public_surface="legacy"} 100',
        'conversion_funnel_events_total{event="start_checkout",source="booking_form",public_surface="legacy"} 50',
        'conversion_funnel_events_total{event="booking_confirmed",source="booking_form",public_surface="legacy"} 25',
        '',
    ].join('\n');

    const { baseDir, filePath } = writeTempFile('metrics.prom', metrics);
    const outPath = path.join(baseDir, 'report.json');
    const result = runGate([
        '--metrics-file',
        filePath,
        '--out',
        outPath,
        '--max-confirmed-drop-pp',
        '8',
        '--min-confirmed-rate-pct',
        '20',
    ]);

    assert.notEqual(result.status, 0, 'expected gate failure');
    assert.equal(fs.existsSync(outPath), true, 'missing rollout gate report');
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(report.passed, false);
    assert.equal(
        report.failures.some((item) =>
            String(item).includes('Drop de conversion superior al umbral')
        ),
        true,
        'expected drop-based failure'
    );
});
