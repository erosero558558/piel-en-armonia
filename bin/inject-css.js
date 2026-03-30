#!/usr/bin/env node
/**
 * bin/inject-css.js — UI2-01 / Problema 2
 *
 * El partial head-links.html existe pero 0 páginas lo incluyen.
 * La solución correcta para sitios estáticos: inyectar los CSS
 * directamente en cada HTML en lugar de depender de includes.
 *
 * Lo que hace:
 * 1. Encuentra todos los index.html bajo es/ y en/
 * 2. Asegura que carguen el Design System completo (en orden correcto)
 * 3. Elimina referencias al CSS legacy (styles.css, styles-deferred.css)
 * 4. Añade aurora-service.css en páginas de servicios
 *
 * npm run inject:css [--dry-run]
 */

const { readFileSync, writeFileSync, readdirSync, statSync, existsSync } = require('fs');
const { resolve, relative } = require('path');

const ROOT    = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─────────────────────────────────────────────────────────────
// El bloque de CSS canónico del Design System "Clinical Luxury"
// ─────────────────────────────────────────────────────────────
const DESIGN_SYSTEM_BLOCK = `  <!-- Aurora Derm Design System — Clinical Luxury -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/tokens.css">
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
  <link rel="stylesheet" href="/styles/aurora-public.css">`;

const SERVICE_CSS_LINE = `  <link rel="stylesheet" href="/styles/aurora-service.css">`;

// CSS legacy a eliminar
const LEGACY_PATTERNS = [
  /\s*<link[^>]*href="[^"]*styles\.css[^"]*"[^>]*\/?>(\s*\n)?/g,
  /\s*<link[^>]*href="[^"]*styles-deferred\.css[^"]*"[^>]*\/?>(\s*\n)?/g,
  /\s*<link[^>]*(preload)[^>]*styles-deferred\.css[^>]*\/?>(\s*\n)?/g,
];

// Marcadores para detectar si el DS ya está inyectado
const DS_MARKER = 'Aurora Derm Design System';
const TOKEN_MARKER = '/styles/tokens.css';

// ─────────────────────────────────────────────────────────────
// Walk directories
// ─────────────────────────────────────────────────────────────
const EXCLUDE = ['node_modules', '_archive', '.git', '.codex', 'worktree'];

function walk(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const entry of entries) {
    if (EXCLUDE.some(ex => entry.startsWith(ex) || entry.startsWith('.'))) continue;
    const abs = resolve(dir, entry);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.isDirectory()) walk(abs, files);
    else if (entry === 'index.html') files.push(abs);
  }
  return files;
}

const htmlFiles = [
  ...walk(resolve(ROOT, 'es')),
  ...walk(resolve(ROOT, 'en')),
];

// ─────────────────────────────────────────────────────────────
// Procesar cada archivo
// ─────────────────────────────────────────────────────────────
let updated = 0, skipped = 0, errors = 0;
const log = [];

for (const file of htmlFiles) {
  const rel = relative(ROOT, file);
  let html;
  try { html = readFileSync(file, 'utf8'); } catch { errors++; continue; }

  const isServicePage = rel.includes('/servicios/');

  // ¿Ya tiene el Design System correcto?
  const hasDS = html.includes(DS_MARKER) || html.includes(TOKEN_MARKER);

  // ¿Tiene legacy CSS?
  const hasLegacy = html.includes('styles.css') || html.includes('styles-deferred.css');

  // ¿Necesita aurora-service.css?
  const needsServiceCss = isServicePage && !html.includes('aurora-service.css');

  if (hasDS && !hasLegacy && !needsServiceCss) {
    skipped++;
    continue; // Ya está correcto
  }

  let newHtml = html;

  // 1. Eliminar CSS legacy
  for (const pattern of LEGACY_PATTERNS) {
    newHtml = newHtml.replace(pattern, '\n');
  }

  // 2. Inyectar Design System si no está
  if (!newHtml.includes(TOKEN_MARKER)) {
    // Buscar el primer </head> o la primera <link rel="stylesheet"> existente
    const insertBefore = newHtml.indexOf('</head>');
    if (insertBefore !== -1) {
      // Insertar antes de </head>
      newHtml = newHtml.slice(0, insertBefore) +
        DESIGN_SYSTEM_BLOCK + '\n' +
        newHtml.slice(insertBefore);
    } else {
      // Fallback: insertar después de <head>
      const headIdx = newHtml.indexOf('<head>');
      if (headIdx !== -1) {
        newHtml = newHtml.slice(0, headIdx + 6) + '\n' + DESIGN_SYSTEM_BLOCK + '\n' + newHtml.slice(headIdx + 6);
      }
    }
  }

  // 3. Añadir aurora-service.css en páginas de servicios (después de aurora-public.css)
  if (isServicePage && !newHtml.includes('aurora-service.css')) {
    newHtml = newHtml.replace(
      '</styles/aurora-public.css">',
      '</styles/aurora-public.css">\n' + SERVICE_CSS_LINE
    );
    // Alternativa si el replace anterior no funcionó:
    if (!newHtml.includes('aurora-service.css')) {
      newHtml = newHtml.replace(
        /(<link[^>]*aurora-public\.css[^>]*>)/,
        `$1\n${SERVICE_CSS_LINE}`
      );
    }
  }

  if (newHtml === html) {
    skipped++;
    continue;
  }

  log.push({ file: rel, hasLegacy, hadDS: hasDS, isService: isServicePage });

  if (!DRY_RUN) {
    try {
      writeFileSync(file, newHtml, 'utf8');
      updated++;
    } catch (e) {
      console.error(`❌ Error escribiendo ${rel}:`, e.message);
      errors++;
    }
  } else {
    updated++;
    console.log(`  [dry] Would update: ${rel}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Reporte
// ─────────────────────────────────────────────────────────────
console.log(`\n${DRY_RUN ? '🔍 DRY RUN — ' : ''}✅ inject:css completado`);
console.log(`   Actualizados: ${updated}`);
console.log(`   Ya correctos: ${skipped}`);
console.log(`   Errores:      ${errors}`);
console.log(`   Total HTML:   ${htmlFiles.length}\n`);

if (log.length > 0 && !DRY_RUN) {
  const legacyFixed = log.filter(l => l.hasLegacy).length;
  const dsInjected  = log.filter(l => !l.hadDS).length;
  const svcFixed    = log.filter(l => l.isService).length;
  console.log(`   CSS legacy eliminado en: ${legacyFixed} páginas`);
  console.log(`   Design System inyectado en: ${dsInjected} páginas`);
  console.log(`   aurora-service.css añadido en: ${svcFixed} servicios`);
}

if (updated > 0 && !DRY_RUN) {
  console.log('\n📋 Próximo paso:');
  console.log('   npm run inject:css dry-run → para verificar');
  console.log('   git add -A && git commit -m "fix(UI): propagate Design System CSS to all pages"');
  console.log('   gh workflow run deploy-hosting.yml → para publicar\n');
}
