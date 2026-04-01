#!/usr/bin/env node
/**
 * bin/check-route-integrity.js
 * GOV-06: verifica que cada Controller referenciado en routes.php
 * tenga su require_once en api.php.
 * 
 * Uso: node bin/check-route-integrity.js
 * Exit 0 = OK, Exit 1 = hay controllers faltantes
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const routesFile = path.join(ROOT, 'lib', 'routes.php');
const apiFile = path.join(ROOT, 'api.php');

if (!fs.existsSync(routesFile) || !fs.existsSync(apiFile)) {
  console.error('❌ No se encontró lib/routes.php o api.php');
  process.exit(1);
}

const routesContent = fs.readFileSync(routesFile, 'utf8');
const apiContent = fs.readFileSync(apiFile, 'utf8');

// Extract controller class names from routes.php: [ControllerClass::class, ...]
const routeMatches = [...routesContent.matchAll(/\[([A-Za-z]+Controller)::class/g)];
const referencedControllers = [...new Set(routeMatches.map(m => m[1]))];

// Extract controller filenames loaded in api.php
const apiMatches = [...apiContent.matchAll(/require_once.*controllers\/([A-Za-z]+Controller)\.php/g)];
const loadedControllers = new Set(apiMatches.map(m => m[1]));

const missing = referencedControllers.filter(c => !loadedControllers.has(c));

if (missing.length === 0) {
  console.log(`✅ Route integrity OK — ${referencedControllers.length} controllers verificados`);
  process.exit(0);
} else {
  console.error(`❌ ${missing.length} controller(s) referenciados en routes.php sin require_once en api.php:`);
  missing.forEach(c => {
    const filePath = path.join(ROOT, 'controllers', `${c}.php`);
    const exists = fs.existsSync(filePath);
    console.error(`   → ${c} (archivo ${exists ? '✅ existe' : '❌ TAMBIÉN FALTA EN DISCO'})`);
  });
  process.exit(1);
}
