#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const VERIFY_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);

const raw = readFileSync(VERIFY_PATH, 'utf8');

test('prod verify usa refs remotas para cache-header de estilos publicados', () => {
    for (const snippet of [
        '$criticalCssRemoteUrl = Get-Url -Base $base -Ref $remoteStyleRef',
        '$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $remoteDeferredStyleRef',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring remoto en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }

    for (const legacySnippet of [
        '$criticalCssRemoteUrl = Get-Url -Base $base -Ref $localStyleRef',
        '$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $localDeferredStyleRef',
    ]) {
        assert.equal(
            raw.includes(legacySnippet),
            false,
            `VERIFICAR-DESPLIEGUE.ps1 no debe usar refs locales para cache-header remoto: ${legacySnippet}`
        );
    }
});
