#!/usr/bin/env node
/**
 * bin/verify-scripts.js — S14-06: Detector de scripts rotos en package.json
 *
 * Encuentra scripts que referencian archivos node que no existen en disco.
 * npm run verify:scripts
 *
 * Salida: lista de scripts rotos por dominio, exit 1 si hay alguno.
 */

const { existsSync, readFileSync } = require('fs');
const { resolve, dirname }         = require('path');

const ROOT    = resolve(__dirname, '..');
const PKG     = require(resolve(ROOT, 'package.json'));
const scripts = Object.entries(PKG.scripts || {});

const BROKEN  = [];
const DOMAINS = {};

for (const [name, cmd] of scripts) {
  // Captura: node bin/foo.js | node src/apps/foo.js
  const matches = [...cmd.matchAll(/node\s+([\w\.\-\/]+\.js)/g)];
  for (const m of matches) {
    const rel  = m[1];
    const abs  = resolve(ROOT, rel);
    if (!existsSync(abs)) {
      BROKEN.push({ name, ref: rel, cmd: cmd.slice(0, 60) });
      // Agrupar por dominio (primer token del nombre del script)
      const domain = name.split(':')[0];
      (DOMAINS[domain] = DOMAINS[domain] || []).push(name);
    }
  }
}

// ── Reporte ────────────────────────────────────────────────────────────────────

if (BROKEN.length === 0) {
  console.log('✅ verify:scripts — 0 referencias rotas en package.json');
  process.exit(0);
}

console.log(`\n❌ verify:scripts — ${BROKEN.length} scripts con referencias a archivos inexistentes\n`);

const domainList = Object.entries(DOMAINS);
domainList.sort((a, b) => b[1].length - a[1].length);

for (const [domain, names] of domainList) {
  console.log(`  📦 ${domain}/ (${names.length})`);
  for (const n of names) {
    const entry = BROKEN.find(b => b.name === n);
    console.log(`     ❌ ${n.padEnd(45)} → ${entry?.ref}`);
  }
}

console.log(`
Acciones sugeridas por script:
  repair  → crear el archivo faltante
  remove  → eliminar la entrada de package.json
  archive → mover a scripts/deprecated/ y actualizar ref

Ver: docs/SCRIPTS_AUDIT.md para el plan de remediación (S14-06).
`);

// Guardar reporte JSON para audit.js
const { writeFileSync, mkdirSync } = require('fs');
mkdirSync(resolve(ROOT, 'governance'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'governance/broken-scripts.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: BROKEN.length, broken: BROKEN, domains: DOMAINS }, null, 2)
);
console.log(`📄 Reporte guardado en governance/broken-scripts.json\n`);

process.exit(BROKEN.length > 0 ? 1 : 0);
