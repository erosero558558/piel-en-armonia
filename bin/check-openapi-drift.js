#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'openapi-openclaw.yaml');
const ROUTES_PATH = path.join(ROOT, 'lib', 'routes.php');

/** Extract operationIds from YAML */
function extractYamlOperations(content) {
  const operations = new Set();
  const regex = /operationId:\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    operations.add(match[1]);
  }
  return operations;
}

/**
 * Convert kebab route resource → camelCase operationId used in YAML.
 * openclaw-patient         → patient
 * openclaw-cie10-suggest   → cie10Suggest
 * openclaw-save-diagnosis  → saveDiagnosis
 * openclaw-save-evolution  → saveEvolution
 * openclaw-prescription    → getPrescriptionPdf (manual exception)
 */
// Route resource → YAML operationId(s). One resource may serve multiple operations (GET + POST)
const RESOURCE_TO_OPERATION = {
  'openclaw-patient':             ['patient'],
  'openclaw-cie10-suggest':       ['cie10Suggest'],
  'openclaw-protocol':            ['protocol'],
  'openclaw-chat':                ['chat'],
  'openclaw-save-diagnosis':      ['saveDiagnosis'],
  'openclaw-save-chronic':        ['saveChronicCondition'],
  'openclaw-save-evolution':      ['saveEvolution'],
  // GET openclaw-prescription → getPrescriptionPdf; POST openclaw-prescription → savePrescription
  'openclaw-prescription':        ['getPrescriptionPdf', 'savePrescription'],
  // GET openclaw-certificate → getCertificatePdf; POST openclaw-certificate → generateCertificate
  'openclaw-certificate':         ['getCertificatePdf', 'generateCertificate'],
  'openclaw-interactions':        ['checkInteractions'],
  'openclaw-summarize':           ['summarizeSession'],
  'openclaw-close-telemedicine':  ['closeTelemedicine'],
  'openclaw-fast-close':          ['fastClose'],
  'openclaw-router-status':       ['routerStatus'],
};

/**
 * Extract OpenClaw route resources from routes.php and map to operationIds.
 * Matches: $router->add('METHOD', 'openclaw-xxx', [OpenclawController::class, ...])
 */
function extractPhpOperationIds(content) {
  const ops = new Set();
  const regex = /\$router->add\(\s*'[A-Z]+',\s*'(openclaw-[a-z0-9-]+)',\s*\[OpenclawController/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const resource = match[1];
    if (RESOURCE_TO_OPERATION[resource]) {
      // Array of operationIds (GET + POST on same resource)
      const mapped = RESOURCE_TO_OPERATION[resource];
      (Array.isArray(mapped) ? mapped : [mapped]).forEach(op => ops.add(op));
    } else {
      // Fallback: strip 'openclaw-' prefix and auto-camelCase
      const stripped = resource.replace(/^openclaw-/, '');
      const camel = stripped.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
      ops.add(camel);
    }
  }
  return ops;
}

function run() {
  console.log('🔍 Detectando drift entre openapi-openclaw.yaml y lib/routes.php...');

  if (!fs.existsSync(YAML_PATH)) {
    console.error(`❌ NO ENCONTRADO: ${YAML_PATH}`);
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(ROUTES_PATH)) {
    console.error(`❌ NO ENCONTRADO: ${ROUTES_PATH}`);
    process.exitCode = 1;
    return;
  }

  const yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
  const phpContent = fs.readFileSync(ROUTES_PATH, 'utf8');

  const yamlOps = extractYamlOperations(yamlContent);
  const phpOps = extractPhpOperationIds(phpContent);

  const missingInYaml = [...phpOps].filter(op => !yamlOps.has(op));
  const missingInPhp = [...yamlOps].filter(op => !phpOps.has(op));

  const total = new Set([...yamlOps, ...phpOps]).size;

  if (missingInYaml.length === 0 && missingInPhp.length === 0) {
    console.log(`✅ [OK] Paridad estricta 1:1. Todas las operaciones coinciden (Count: ${yamlOps.size}).`);
    process.exitCode = 0;
    return;
  }

  console.error(`🔴 [DRIFT DETECTADO] La declaración en YAML y en el servidor no coinciden.`);
  console.error(`---`);
  if (missingInYaml.length > 0) {
    console.error(`⚠️ Endpoints vivos en lib/routes.php y NO documentados en yaml:\n   - ${missingInYaml.join('\n   - ')}`);
  }
  if (missingInPhp.length > 0) {
    console.error(`⚠️ Endpoints zombis documentados en yaml y NO implementados/enrutados en PHP:\n   - ${missingInPhp.join('\n   - ')}`);
  }

  process.exitCode = 1;
}

run();
