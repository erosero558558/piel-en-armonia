#!/usr/bin/env node
/**
 * bin/fix-service-css.js — Fix emergency
 * 
 * 18 de 20 páginas de servicios tienen tokens.css+base.css
 * pero NO tienen aurora-public.css ni aurora-service.css.
 * Las páginas están "a medias" — tienen el sistema de tokens
 * pero no los estilos visuales del Clinical Luxury.
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { resolve } = require('path');

const ROOT     = resolve(__dirname, '..');
const SVCS_DIR = resolve(ROOT, 'es/servicios');

const entries = readdirSync(SVCS_DIR);
let fixed = 0, alreadyOk = 0;

for (const entry of entries) {
  const file = resolve(SVCS_DIR, entry, 'index.html');
  try { statSync(file); } catch { continue; }

  let html = readFileSync(file, 'utf8');

  const hasTokens     = html.includes('/styles/tokens.css');
  const hasPublic     = html.includes('aurora-public.css');
  const hasService    = html.includes('aurora-service.css');
  const hasComponents = html.includes('components.css');

  if (hasPublic && hasService) {
    alreadyOk++;
    continue;
  }

  if (!hasTokens) {
    console.log(`⚠️  Sin tokens.css - saltando: es/servicios/${entry}/`);
    continue;
  }

  let modified = html;

  // Insertar components.css + aurora-public.css + aurora-service.css
  // justo después del bloque de base.css
  const basePattern = /(<link[^>]*\/styles\/base\.css[^>]*>)/;
  const insertBlock = [
    !hasComponents ? '  <link rel="stylesheet" href="/styles/components.css">' : '',
    !hasPublic     ? '  <link rel="stylesheet" href="/styles/aurora-public.css">' : '',
    !hasService    ? '  <link rel="stylesheet" href="/styles/aurora-service.css">' : '',
  ].filter(Boolean).join('\n');

  if (basePattern.test(modified) && insertBlock) {
    modified = modified.replace(basePattern, `$1\n${insertBlock}`);
  } else if (insertBlock) {
    // Fallback: antes de </head>
    modified = modified.replace('</head>', `${insertBlock}\n</head>`);
  }

  writeFileSync(file, modified, 'utf8');
  console.log(`✅ Fixed: es/servicios/${entry}/index.html`);
  fixed++;
}

console.log(`\nResumen:`);
console.log(`  Ya correctas: ${alreadyOk}`);
console.log(`  Arregladas:   ${fixed}`);
console.log(`  Total:        ${alreadyOk + fixed}/20`);
