#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const API_PATH = resolve(REPO_ROOT, 'api.php');
const ROUTES_PATH = resolve(REPO_ROOT, 'lib', 'routes.php');
const CONTROLLER_PATH = resolve(REPO_ROOT, 'controllers', 'ClinicProfileController.php');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('clinic-profile route carga su controller antes de registrarse', () => {
    const apiRaw = load(API_PATH);
    const routesRaw = load(ROUTES_PATH);
    const controllerRaw = load(CONTROLLER_PATH);

    assert.match(
        apiRaw,
        /require_once __DIR__ \. '\/controllers\/ClinicProfileController\.php';/
    );
    assert.match(
        routesRaw,
        /\$router->add\('GET', 'clinic-profile', \[ClinicProfileController::class, 'show'\]\);/
    );
    assert.match(
        controllerRaw,
        /public static function show\(array \$context\): void/
    );
});
