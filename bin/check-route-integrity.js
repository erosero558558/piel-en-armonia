#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROUTES_FILE = path.join(__dirname, '..', 'lib', 'routes.php');
const API_FILE = path.join(__dirname, '..', 'api.php');

const routesContent = fs.readFileSync(ROUTES_FILE, 'utf8');
const apiContent = fs.readFileSync(API_FILE, 'utf8');

const controllerRegex = /\[([A-Za-z0-9_]+Controller)::class/g;
const requiredControllers = new Set();

let match;
while ((match = controllerRegex.exec(routesContent)) !== null) {
  requiredControllers.add(match[1]);
}

const missing = [];

for (const ctrl of requiredControllers) {
  const reqStr = `require_once __DIR__ . '/controllers/${ctrl}.php';`;
  const reqStr2 = `require_once __DIR__ . '/../controllers/${ctrl}.php';`;
  if (!apiContent.includes(reqStr) && !apiContent.includes(reqStr2) && !routesContent.includes(reqStr2)) {
    missing.push(ctrl);
  }
}

if (missing.length > 0) {
  console.error('❌ Route Integrity Error: The following controllers are routed in lib/routes.php but not required in api.php:');
  missing.forEach(c => console.error(`  - ${c}`));
  process.exit(1);
}

console.log('✅ Route Integrity Check Passed: All routed controllers are properly required in api.php.');
process.exit(0);
