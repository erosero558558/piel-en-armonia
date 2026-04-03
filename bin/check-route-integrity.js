#!/usr/bin/env node
/**
 * bin/check-route-integrity.js
 *
 * Verifica que cada controller referenciado en lib/routes.php
 * existe como archivo en controllers/ClassName.php en disco.
 *
 * Compatible con autoloader (spl_autoload_register) — no busca require_once manual.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const ROUTES_FILE = path.join(ROOT, 'lib', 'routes.php');
const CTRL_DIR    = path.join(ROOT, 'controllers');

if (!fs.existsSync(ROUTES_FILE)) {
  console.error('❌  lib/routes.php no encontrado');
  process.exit(1);
}

const routesContent = fs.readFileSync(ROUTES_FILE, 'utf8');

// Extraer todos los controllers/facades mencionados en routes.php
const re = /\[([A-Za-z0-9_]+(?:Controller|Facade))::class/g;
const referenced = new Set();
let m;
while ((m = re.exec(routesContent)) !== null) referenced.add(m[1]);

// Verificar que el archivo existe en controllers/
const missing  = [];
const present  = [];

for (const cls of referenced) {
  const file = path.join(CTRL_DIR, `${cls}.php`);
  if (fs.existsSync(file)) {
    present.push(cls);
  } else {
    missing.push(cls);
  }
}

// Detectar controllers en disco que NO están en routes (informativo, no error)
const onDisk = fs.readdirSync(CTRL_DIR)
  .filter(f => f.endsWith('.php'))
  .map(f => f.replace('.php', ''));
const orphans = onDisk.filter(cls => !referenced.has(cls));

// Reporte
console.log(`\n📋  Route Integrity Check`);
console.log(`    routes.php menciona : ${referenced.size} controllers`);
console.log(`    en disco            : ${onDisk.length} controllers`);

if (missing.length > 0) {
  console.error('\n❌  Controllers en routes.php que NO existen en disco:');
  missing.forEach(c => console.error(`    - ${c}`));
}

if (orphans.length > 0) {
  console.warn('\n⚠️   Controllers en disco sin ruta activa (candidatos a prune):');
  orphans.forEach(c => console.warn(`    - ${c}  →  controllers/${c}.php`));
  console.warn('    Ejecuta: npm run prune --only=ctrl');
}

if (missing.length === 0) {
  console.log('\n✅  Todos los controllers referenciados existen en disco.\n');
  process.exit(0);
} else {
  console.error(`\n    ${missing.length} controller(s) faltante(s). Agrega el archivo o retira la ruta.\n`);
  process.exit(1);
}
