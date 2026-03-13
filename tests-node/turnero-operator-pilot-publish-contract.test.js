#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'turnero',
    'PUBLICAR-OPERADOR-WINDOWS-PILOTO.ps1'
);
const TURNERO_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'turnero',
    'README.md'
);
const OPS_README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const TURNERO_RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'RUNBOOK_TURNERO_APPS_RELEASE.md'
);
const TURNERO_NATIVE_DOC_PATH = resolve(
    REPO_ROOT,
    'docs',
    'TURNERO_NATIVE_SURFACES.md'
);
const DESKTOP_README_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'turnero-desktop',
    'README.md'
);
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('publisher local del piloto operador windows valida bundle y credenciales canonicas', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$BundleRoot = 'release/turnero-apps-pilot-local'",
        "[string]$ServerBaseUrl = 'https://pielarmonia.com'",
        "ValidateSet('ftp', 'ftps', 'sftp')",
        'FTP_SERVER',
        'FTP_USERNAME',
        'FTP_PASSWORD',
        'FTP_SERVER_DIR',
        'FTP_PROTOCOL',
        'FTP_SERVER_PORT',
        'FTP_SECURITY',
        'verify-turnero-release-bundle.js',
        'CHECKLIST-OPERADOR-WINDOWS-PILOTO.ps1',
        'app-downloads/pilot/release-manifest.json',
        'app-downloads/pilot/SHA256SUMS.txt',
        'app-downloads/pilot/operator/win/',
        'desktop-updates/pilot/operator/win/',
        'FtpWebRequest',
        'DRY RUN. No se subieron archivos.',
        'La publicacion local del piloto soporta ftp/ftps.',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo en PUBLICAR-OPERADOR-WINDOWS-PILOTO.ps1: ${snippet}`
        );
    }
});

test('package y docs publican el comando canonico de publish del piloto', () => {
    const pkg = JSON.parse(load(PACKAGE_JSON_PATH));
    const turneroReadme = load(TURNERO_README_PATH);
    const opsReadme = load(OPS_README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const turneroRunbook = load(TURNERO_RUNBOOK_PATH);
    const turneroNativeDoc = load(TURNERO_NATIVE_DOC_PATH);
    const desktopReadme = load(DESKTOP_README_PATH);

    assert.equal(
        String(pkg.scripts?.['publish:turnero:operator:pilot'] || '').includes(
            './scripts/ops/turnero/PUBLICAR-OPERADOR-WINDOWS-PILOTO.ps1'
        ),
        true,
        'package.json debe exponer publish:turnero:operator:pilot'
    );

    for (const snippet of ['publish:turnero:operator:pilot']) {
        assert.equal(
            turneroReadme.includes(snippet),
            true,
            `README de turnero ops debe documentar publish: ${snippet}`
        );
        assert.equal(
            opsReadme.includes(snippet),
            true,
            `README general de ops debe documentar publish: ${snippet}`
        );
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `OPERATIONS_INDEX debe documentar publish: ${snippet}`
        );
        assert.equal(
            turneroRunbook.includes(snippet),
            true,
            `RUNBOOK_TURNERO_APPS_RELEASE debe documentar publish: ${snippet}`
        );
        assert.equal(
            turneroNativeDoc.includes(snippet),
            true,
            `TURNERO_NATIVE_SURFACES debe documentar publish: ${snippet}`
        );
        assert.equal(
            desktopReadme.includes(snippet),
            true,
            `turnero-desktop README debe documentar publish: ${snippet}`
        );
    }
});
