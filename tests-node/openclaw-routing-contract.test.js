#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const ROUTES_PATH = resolve(REPO_ROOT, 'lib', 'routes.php');
const OPENCLAW_CONTROLLER_PATH = resolve(REPO_ROOT, 'controllers', 'OpenclawController.php');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('openclaw certificate route points to a callable PDF handler', () => {
    const routesRaw = load(ROUTES_PATH);
    const controllerRaw = load(OPENCLAW_CONTROLLER_PATH);

    assert.match(
        routesRaw,
        /\$router->add\('GET',\s+'openclaw-certificate',\s+\[OpenclawController::class,\s+'getCertificatePdf'\]\);/
    );
    assert.match(
        controllerRaw,
        /public static function getCertificatePdf\(array \$context\): void/
    );
});
