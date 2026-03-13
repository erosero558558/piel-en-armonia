#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const STAGE_SCRIPT_PATH = path.resolve(
    REPO_ROOT,
    'bin',
    'stage-turnero-app-release.js'
);
const VERIFY_SCRIPT_PATH = path.resolve(
    REPO_ROOT,
    'bin',
    'verify-turnero-release-bundle.js'
);

function writeFixture(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function createDesktopFixture(rootDir, surfaceKey, artifactBase) {
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', `${artifactBase}Setup.exe`),
        `${surfaceKey}-win-exe`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', 'latest.yml'),
        `version: 0.1.3\npath: ${artifactBase}Setup.exe\n`
    );
    writeFixture(
        path.join(
            rootDir,
            surfaceKey,
            'win',
            `${artifactBase}Setup.exe.blockmap`
        ),
        `${surfaceKey}-win-blockmap`
    );

    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.dmg`),
        `${surfaceKey}-mac-dmg`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.zip`),
        `${surfaceKey}-mac-zip`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', 'latest-mac.yml'),
        `version: 0.1.3\npath: ${artifactBase}.zip\n`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.zip.blockmap`),
        `${surfaceKey}-mac-zip-blockmap`
    );
}

function createDesktopWinOnlyFixture(rootDir, surfaceKey, artifactBase) {
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', `${artifactBase}Setup.exe`),
        `${surfaceKey}-win-exe`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', 'latest.yml'),
        `version: 0.1.3\npath: ${artifactBase}Setup.exe\n`
    );
    writeFixture(
        path.join(
            rootDir,
            surfaceKey,
            'win',
            `${artifactBase}Setup.exe.blockmap`
        ),
        `${surfaceKey}-win-blockmap`
    );
}

function stageBundle(args) {
    return spawnSync(process.execPath, [STAGE_SCRIPT_PATH, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

function verifyBundle(args) {
    return spawnSync(process.execPath, [VERIFY_SCRIPT_PATH, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

test('verify-turnero-release-bundle valida el bundle mixto generado por stage', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'turnero-verify-'));
    const desktopRoot = path.join(tempRoot, 'desktop');
    const androidRoot = path.join(tempRoot, 'android');
    const outputRoot = path.join(tempRoot, 'bundle');

    try {
        createDesktopFixture(desktopRoot, 'operator', 'TurneroOperador');
        createDesktopFixture(desktopRoot, 'kiosk', 'TurneroKiosco');
        writeFixture(path.join(androidRoot, 'TurneroSalaTV.apk'), 'tv-apk');

        const stageResult = stageBundle([
            '--version',
            '0.1.3',
            '--desktopRoot',
            desktopRoot,
            '--androidRoot',
            androidRoot,
            '--outputRoot',
            outputRoot,
            '--releasedAt',
            '2026-03-13T06:30:00Z',
        ]);
        assert.equal(stageResult.status, 0, stageResult.stderr);

        const verifyResult = verifyBundle(['--outputRoot', outputRoot]);
        assert.equal(
            verifyResult.status,
            0,
            verifyResult.stderr || verifyResult.stdout
        );
        assert.match(verifyResult.stdout, /pilot: operator/);
        assert.match(verifyResult.stdout, /stable: kiosk, sala_tv/);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('verify-turnero-release-bundle soporta el filtro del piloto local operator/win', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-verify-pilot-')
    );
    const desktopRoot = path.join(tempRoot, 'desktop');
    const outputRoot = path.join(tempRoot, 'bundle');

    try {
        createDesktopWinOnlyFixture(desktopRoot, 'operator', 'TurneroOperador');

        const stageResult = stageBundle([
            '--version',
            '0.1.3',
            '--desktopRoot',
            desktopRoot,
            '--outputRoot',
            outputRoot,
            '--surface',
            'operator',
            '--target',
            'win',
            '--releasedAt',
            '2026-03-13T06:30:00Z',
        ]);
        assert.equal(stageResult.status, 0, stageResult.stderr);

        const verifyResult = verifyBundle([
            '--outputRoot',
            outputRoot,
            '--channel',
            'pilot',
            '--surface',
            'operator',
            '--target',
            'win',
        ]);
        assert.equal(
            verifyResult.status,
            0,
            verifyResult.stderr || verifyResult.stdout
        );
        assert.match(verifyResult.stdout, /pilot: operator/);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('verify-turnero-release-bundle falla si alteran el instalador stageado', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-verify-mismatch-')
    );
    const desktopRoot = path.join(tempRoot, 'desktop');
    const outputRoot = path.join(tempRoot, 'bundle');

    try {
        createDesktopWinOnlyFixture(desktopRoot, 'operator', 'TurneroOperador');

        const stageResult = stageBundle([
            '--version',
            '0.1.3',
            '--desktopRoot',
            desktopRoot,
            '--outputRoot',
            outputRoot,
            '--surface',
            'operator',
            '--target',
            'win',
            '--releasedAt',
            '2026-03-13T06:30:00Z',
        ]);
        assert.equal(stageResult.status, 0, stageResult.stderr);

        fs.writeFileSync(
            path.join(
                outputRoot,
                'app-downloads',
                'pilot',
                'operator',
                'win',
                'TurneroOperadorSetup.exe'
            ),
            'tampered-payload'
        );

        const verifyResult = verifyBundle([
            '--outputRoot',
            outputRoot,
            '--channel',
            'pilot',
            '--surface',
            'operator',
            '--target',
            'win',
        ]);
        assert.notEqual(verifyResult.status, 0);
        assert.match(verifyResult.stderr, /SHA256 no coincide/);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
