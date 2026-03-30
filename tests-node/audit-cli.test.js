'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const packageJson = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')
);

const { AUDIT_STEPS, formatAuditText, runAudit } = require('../bin/audit.js');

test('AUDIT_STEPS preserve the required command sequence for S7-23', () => {
    assert.deepEqual(
        AUDIT_STEPS.map((step) => [step.command, ...step.args].join(' ')),
        [
            'node bin/velocity.js',
            'node bin/verify.js',
            'node bin/conflict.js --json',
            'php -l lib/email.php',
            'php -l controllers/OpenclawController.php',
        ]
    );
});

test('runAudit fails when one wrapped command exits non-zero', () => {
    const report = runAudit((command, args) => {
        const preview = [command, ...args].join(' ');
        if (preview === 'node bin/verify.js') {
            return { status: 5, stdout: 'verify failed', stderr: '' };
        }
        return { status: 0, stdout: `${preview} ok`, stderr: '' };
    });

    assert.equal(report.ok, false);
    assert.equal(report.passedCount, 4);
    assert.equal(report.failedCount, 1);
    assert.equal(report.steps[1].ok, false);
    assert.match(formatAuditText(report), /node bin\/verify\.js/);
    assert.match(formatAuditText(report), /1 failed/);
});

test('package scripts route audit and gov:audit through the shared wrapper', () => {
    assert.equal(packageJson.scripts.audit, 'node bin/audit.js');
    assert.equal(packageJson.scripts['gov:audit'], 'node bin/audit.js');
    assert.equal(
        packageJson.scripts['gov:audit:json'],
        'node bin/audit.js --json'
    );
});
