'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'check-openapi-drift.js');

const {
  EXPECTED_OPENCLAW_OPERATIONS,
  compareOpenclawSurface,
  runCheck,
} = require('../bin/check-openapi-drift.js');

function buildRuntimeRoutes() {
  return EXPECTED_OPENCLAW_OPERATIONS.map((operation) => ({
    method: operation.method,
    resource: operation.resource,
    controllerMethod: operation.controllerMethod,
  }));
}

function buildOpenApiOperations() {
  return EXPECTED_OPENCLAW_OPERATIONS.map((operation) => ({
    method: operation.openapiMethod,
    path: operation.openapiPath,
  }));
}

function buildControllerMethods() {
  return new Set(EXPECTED_OPENCLAW_OPERATIONS.map((operation) => operation.controllerMethod));
}

function buildFixtureSpec() {
  const lines = ['openapi: 3.1.0', 'paths:'];
  for (const operation of EXPECTED_OPENCLAW_OPERATIONS) {
    lines.push(`  ${operation.openapiPath}:`);
    lines.push(`    ${operation.openapiMethod.toLowerCase()}:`);
    lines.push(`      operationId: ${operation.controllerMethod}`);
      lines.push("      responses:");
      lines.push("        '200':");
      lines.push('          description: ok');
  }
  return `${lines.join('\n')}\n`;
}

function buildFixtureRoutes(extraRoute = '') {
  const lines = [
    '<?php',
    '',
    'function register_api_routes($router): void',
    '{',
  ];
  for (const operation of EXPECTED_OPENCLAW_OPERATIONS) {
    lines.push(
      `    $router->add('${operation.method}', '${operation.resource}', [OpenclawController::class, '${operation.controllerMethod}']);`
    );
  }
  if (extraRoute !== '') {
    lines.push(extraRoute);
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function buildFixtureController() {
  const lines = ['<?php', '', 'final class OpenclawController', '{'];
  for (const operation of EXPECTED_OPENCLAW_OPERATIONS) {
    lines.push(`    public static function ${operation.controllerMethod}(array $context): void {}`);
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

test('current repo OpenClaw spec matches runtime routes', () => {
  const report = runCheck();

  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.runtimeRoutes.length, EXPECTED_OPENCLAW_OPERATIONS.length);
  assert.equal(report.openapiOperations.length, EXPECTED_OPENCLAW_OPERATIONS.length);
});

test('compareOpenclawSurface flags missing spec coverage and extra runtime routes', () => {
  const report = compareOpenclawSurface({
    runtimeRoutes: [
      ...buildRuntimeRoutes(),
      {
        method: 'POST',
        resource: 'openclaw-extra',
        controllerMethod: 'extraAction',
      },
    ],
    openapiOperations: buildOpenApiOperations().slice(1),
    controllerMethods: buildControllerMethods(),
  });

  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /Unexpected runtime route not documented: POST openclaw-extra/);
  assert.match(report.errors.join('\n'), /OpenAPI operation missing: GET \/patient\/\{patient_id\}/);
});

test('CLI exits 1 when fixture runtime adds an unmapped OpenClaw route', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'aurora-openapi-drift-'));

  try {
    const specPath = join(fixtureRoot, 'openapi-openclaw.yaml');
    const routesPath = join(fixtureRoot, 'routes.php');
    const controllerPath = join(fixtureRoot, 'OpenclawController.php');

    writeFileSync(specPath, buildFixtureSpec());
    writeFileSync(
      routesPath,
      buildFixtureRoutes("    $router->add('GET', 'openclaw-extra', [OpenclawController::class, 'extraAction']);")
    );
    writeFileSync(controllerPath, `${buildFixtureController().replace(/\}\n$/, '')}\n    public static function extraAction(array $context): void {}\n}\n`);

    const result = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        '--spec',
        specPath,
        '--routes',
        routesPath,
        '--controller',
        controllerPath,
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /Unexpected runtime route not documented: GET openclaw-extra/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
