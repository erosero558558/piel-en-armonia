'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    buildVerifiedSnapshot,
} = require('../bin/write-turnero-pilot-remote-status.js');

function withEnv(overrides, fn) {
    const previous = new Map();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === null) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return fn();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

function writeJson(dirPath, fileName, payload) {
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
}

test('write-turnero-pilot-remote-status bloquea verify-remote redactado aunque ok=true', () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-pilot-remote-status-')
    );
    const remotePath = writeJson(tempDir, 'remote.json', {
        ok: true,
        remoteResource: 'health',
        diagnosticsAuthorized: false,
        publicHealthRedacted: true,
        turneroPilot: null,
        publicSync: null,
        errors: [],
        warnings: [
            'Health remoto redactado sin diagnostics token; se omite validacion profunda.',
        ],
    });

    const snapshot = withEnv(
        {
            TURNERO_PILOT_RECOVERY_TARGETS:
                '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado|[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado',
        },
        () =>
            buildVerifiedSnapshot({
                'remote-path': remotePath,
                'raw-path': path.join(tempDir, 'remote.stderr.txt'),
                'verify-exit': '0',
            })
    );

    assert.equal(snapshot.status, 'blocked');
    assert.equal(snapshot.verified, false);
    assert.equal(snapshot.postdeploy_allowed, false);
    assert.match(snapshot.reason, /public_health_redacted:health/);
    assert.match(snapshot.reason, /remote_clinic_id_missing/);
    assert.match(snapshot.reason, /remote_deployed_commit_missing/);
    assert.deepEqual(snapshot.recovery_targets, [
        '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado',
        '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado',
    ]);
});

test('write-turnero-pilot-remote-status exige identidad remota y commit desplegado para quedar ready', () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-pilot-remote-status-')
    );
    const remotePath = writeJson(tempDir, 'remote.json', {
        ok: true,
        remoteResource: 'health-diagnostics',
        diagnosticsAuthorized: true,
        publicHealthRedacted: false,
        turneroPilot: {
            clinicId: 'piel-armonia-quito',
            profileFingerprint: 'a10c5b7f',
            catalogReady: true,
        },
        publicSync: {
            deployedCommit: '75291b13095c5b82008328c7b807247ad08dc5e5',
        },
        errors: [],
        warnings: [],
    });

    const snapshot = withEnv(
        {
            TURNERO_PILOT_RECOVERY_TARGETS: 'none',
        },
        () =>
            buildVerifiedSnapshot({
                'remote-path': remotePath,
                'raw-path': path.join(tempDir, 'remote.stderr.txt'),
                'verify-exit': '0',
            })
    );

    assert.equal(snapshot.status, 'ready');
    assert.equal(snapshot.reason, 'ok');
    assert.equal(snapshot.verified, true);
    assert.equal(snapshot.postdeploy_allowed, true);
    assert.equal(snapshot.clinic_id, 'piel-armonia-quito');
    assert.equal(snapshot.profile_fingerprint, 'a10c5b7f');
    assert.equal(
        snapshot.deployed_commit,
        '75291b13095c5b82008328c7b807247ad08dc5e5'
    );
});
