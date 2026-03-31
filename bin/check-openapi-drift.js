#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'openapi-openclaw.yaml');
const ROUTES_PATH = path.join(ROOT, 'lib', 'routes.php');

function extractYamlOperations(content) {
  const operations = new Set();
  const regex = /operationId:\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    operations.add(match[1]);
  }
  return operations;
}

function extractPhpMethods(content) {
  const methods = new Set();
  const regex = /\bOpenclawController::class,\s*'([a-zA-Z0-9_]+)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.add(match[1]);
  }
  return methods;
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
  const phpOps = extractPhpMethods(phpContent);

  const missingInYaml = [...phpOps].filter(op => !yamlOps.has(op));
  const missingInPhp = [...yamlOps].filter(op => !phpOps.has(op));

  const countYaml = yamlOps.size;
  const countPhp = phpOps.size;

  if (missingInYaml.length === 0 && missingInPhp.length === 0) {
    console.log(`✅ [OK] Paridad estricta 1:1. Todas las operaciones coinciden (Count: ${countYaml}).`);
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
