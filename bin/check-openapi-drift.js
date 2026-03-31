#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const ROOT = resolve(__dirname, '..');

const DEFAULT_PATHS = {
  spec: resolve(ROOT, 'openapi-openclaw.yaml'),
  routes: resolve(ROOT, 'lib', 'routes.php'),
  controller: resolve(ROOT, 'controllers', 'OpenclawController.php'),
};

const EXPECTED_OPENCLAW_OPERATIONS = [
  {
    method: 'GET',
    resource: 'openclaw-patient',
    controllerMethod: 'patient',
    openapiMethod: 'GET',
    openapiPath: '/patient/{patient_id}',
  },
  {
    method: 'GET',
    resource: 'openclaw-cie10-suggest',
    controllerMethod: 'cie10Suggest',
    openapiMethod: 'GET',
    openapiPath: '/cie10/suggest',
  },
  {
    method: 'GET',
    resource: 'openclaw-protocol',
    controllerMethod: 'protocol',
    openapiMethod: 'GET',
    openapiPath: '/protocol/{cie10_code}',
  },
  {
    method: 'POST',
    resource: 'openclaw-chat',
    controllerMethod: 'chat',
    openapiMethod: 'POST',
    openapiPath: '/chat',
  },
  {
    method: 'POST',
    resource: 'openclaw-save-diagnosis',
    controllerMethod: 'saveDiagnosis',
    openapiMethod: 'POST',
    openapiPath: '/save/diagnosis',
  },
  {
    method: 'POST',
    resource: 'openclaw-save-evolution',
    controllerMethod: 'saveEvolution',
    openapiMethod: 'POST',
    openapiPath: '/save/evolution',
  },
  {
    method: 'POST',
    resource: 'openclaw-prescription',
    controllerMethod: 'savePrescription',
    openapiMethod: 'POST',
    openapiPath: '/save/prescription',
  },
  {
    method: 'GET',
    resource: 'openclaw-prescription',
    controllerMethod: 'getPrescriptionPdf',
    openapiMethod: 'GET',
    openapiPath: '/prescription/{id}',
  },
  {
    method: 'POST',
    resource: 'openclaw-certificate',
    controllerMethod: 'generateCertificate',
    openapiMethod: 'POST',
    openapiPath: '/generate/certificate',
  },
  {
    method: 'GET',
    resource: 'openclaw-certificate',
    controllerMethod: 'getCertificatePdf',
    openapiMethod: 'GET',
    openapiPath: '/certificate/{id}',
  },
  {
    method: 'POST',
    resource: 'openclaw-interactions',
    controllerMethod: 'checkInteractions',
    openapiMethod: 'POST',
    openapiPath: '/check/interactions',
  },
  {
    method: 'POST',
    resource: 'openclaw-summarize',
    controllerMethod: 'summarizeSession',
    openapiMethod: 'POST',
    openapiPath: '/summarize/session',
  },
  {
    method: 'GET',
    resource: 'openclaw-router-status',
    controllerMethod: 'routerStatus',
    openapiMethod: 'GET',
    openapiPath: '/router/status',
  },
];

function parseArgs(argv) {
  const options = {
    ...DEFAULT_PATHS,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (!['--spec', '--routes', '--controller'].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value) {
      throw new Error(`Missing value for ${arg}`);
    }

    index += 1;

    if (arg === '--spec') {
      options.spec = resolve(process.cwd(), value);
    } else if (arg === '--routes') {
      options.routes = resolve(process.cwd(), value);
    } else if (arg === '--controller') {
      options.controller = resolve(process.cwd(), value);
    }
  }

  return options;
}

function readText(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }

  return readFileSync(filePath, 'utf8');
}

function collectRuntimeRoutes(routesSource) {
  const routePattern =
    /\$router->add\('([A-Z]+)',\s*'([^']+)',\s*\[OpenclawController::class,\s*'([^']+)'\](?:,\s*'[^']+')?\);/g;
  const routes = [];
  let match = routePattern.exec(routesSource);

  while (match) {
    const method = String(match[1] || '').toUpperCase();
    const resource = String(match[2] || '');
    const controllerMethod = String(match[3] || '');

    if (resource.startsWith('openclaw-')) {
      routes.push({ method, resource, controllerMethod });
    }

    match = routePattern.exec(routesSource);
  }

  return routes;
}

function collectOpenApiOperations(openApiSource) {
  const parsed = yaml.parse(openApiSource) || {};
  const paths = parsed.paths || {};
  const operations = [];

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (pathItem[method]) {
        operations.push({
          method: method.toUpperCase(),
          path: pathKey,
        });
      }
    }
  }

  return operations;
}

function collectControllerMethods(controllerSource) {
  const methodPattern = /public static function (\w+)\(array \$context\): void/g;
  const methods = new Set();
  let match = methodPattern.exec(controllerSource);

  while (match) {
    methods.add(String(match[1] || ''));
    match = methodPattern.exec(controllerSource);
  }

  return methods;
}

function runtimeKey(operation) {
  return `${operation.method} ${operation.resource}`;
}

function openApiKey(operation) {
  return `${operation.method} ${operation.path}`;
}

function compareOpenclawSurface({
  runtimeRoutes,
  openapiOperations,
  controllerMethods,
  expectedOperations = EXPECTED_OPENCLAW_OPERATIONS,
}) {
  const errors = [];
  const runtimeByKey = new Map(runtimeRoutes.map((route) => [runtimeKey(route), route]));
  const openApiByKey = new Map(openapiOperations.map((operation) => [openApiKey(operation), operation]));
  const expectedRuntimeKeys = new Set(expectedOperations.map((operation) => runtimeKey(operation)));
  const expectedOpenApiKeys = new Set(
    expectedOperations.map((operation) =>
      openApiKey({
        method: operation.openapiMethod,
        path: operation.openapiPath,
      })
    )
  );

  for (const operation of expectedOperations) {
    const runtimeOperation = runtimeByKey.get(runtimeKey(operation));
    if (!runtimeOperation) {
      errors.push(
        `Runtime route missing: ${operation.method} ${operation.resource} (expected OpenclawController::${operation.controllerMethod})`
      );
    } else if (runtimeOperation.controllerMethod !== operation.controllerMethod) {
      errors.push(
        `Runtime route drift: ${operation.method} ${operation.resource} should call OpenclawController::${operation.controllerMethod}, found ::${runtimeOperation.controllerMethod}`
      );
    }

    if (!controllerMethods.has(operation.controllerMethod)) {
      errors.push(`Controller method missing: OpenclawController::${operation.controllerMethod}`);
    }

    if (
      !openApiByKey.has(
        openApiKey({
          method: operation.openapiMethod,
          path: operation.openapiPath,
        })
      )
    ) {
      errors.push(
        `OpenAPI operation missing: ${operation.openapiMethod} ${operation.openapiPath} (expected for ${operation.method} ${operation.resource})`
      );
    }
  }

  for (const route of runtimeRoutes) {
    if (!expectedRuntimeKeys.has(runtimeKey(route))) {
      errors.push(
        `Unexpected runtime route not documented: ${route.method} ${route.resource} -> OpenclawController::${route.controllerMethod}`
      );
    }
  }

  for (const operation of openapiOperations) {
    if (!expectedOpenApiKeys.has(openApiKey(operation))) {
      errors.push(`Unexpected OpenAPI operation without runtime mapping: ${operation.method} ${operation.path}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    runtimeRoutes,
    openapiOperations,
    controllerMethods: Array.from(controllerMethods).sort(),
    expectedOperations,
  };
}

function runCheck(options = {}) {
  const resolved = {
    ...DEFAULT_PATHS,
    ...options,
  };

  const routesSource = readText(resolved.routes, 'Runtime routes file');
  const openApiSource = readText(resolved.spec, 'OpenAPI spec');
  const controllerSource = readText(resolved.controller, 'Openclaw controller');

  return compareOpenclawSurface({
    runtimeRoutes: collectRuntimeRoutes(routesSource),
    openapiOperations: collectOpenApiOperations(openApiSource),
    controllerMethods: collectControllerMethods(controllerSource),
  });
}

function formatReport(report) {
  if (report.ok) {
    return `✅ OpenClaw OpenAPI drift guard — ${report.runtimeRoutes.length} runtime routes and ${report.openapiOperations.length} OpenAPI operations aligned.`;
  }

  return [
    `❌ OpenClaw OpenAPI drift guard — ${report.errors.length} discrepancy(ies) detected.`,
    ...report.errors.map((error) => `- ${error}`),
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = runCheck(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\n`);
  }

  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`OpenClaw OpenAPI drift guard failed: ${message}\n`);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_OPENCLAW_OPERATIONS,
  collectControllerMethods,
  collectOpenApiOperations,
  collectRuntimeRoutes,
  compareOpenclawSurface,
  formatReport,
  parseArgs,
  runCheck,
};
