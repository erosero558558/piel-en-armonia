#!/usr/bin/env node
/**
 * bin/gen-sitemap.js — S13-16: Generador automático de sitemap.xml
 *
 * Recorre es/**/index.html y genera sitemap.xml con lastmod real
 * (fecha del último commit de git para ese archivo).
 *
 * npm run gen:sitemap
 */

const { execSync, spawnSync } = require('child_process');
const { writeFileSync, readdirSync, statSync, existsSync } = require('fs');
const { resolve, relative } = require('path');

const ROOT        = resolve(__dirname, '..');
const DOMAIN      = 'https://pielarmonia.com';
const OUTPUT_FILE = resolve(ROOT, 'sitemap.xml');
const CHANGEFREQS = {
  default:  'monthly',
  servicios: 'weekly',
  blog:     'weekly',
  index:    'daily',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function gitLastmod(absPath) {
  try {
    const rel = relative(ROOT, absPath);
    const out = spawnSync('git', ['log', '-1', '--format=%cI', '--', rel], {
      cwd: ROOT, encoding: 'utf8'
    });
    const date = (out.stdout || '').trim().split('T')[0];
    return date || new Date().toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getPriority(urlPath) {
  if (urlPath === '/' || urlPath === '/es/')  return '1.0';
  if (urlPath.includes('/servicios/'))         return '0.9';
  if (urlPath.includes('/blog/'))              return '0.8';
  if (urlPath.includes('/agendar/') || urlPath.includes('/primera-consulta/')) return '0.9';
  if (urlPath.includes('/paquetes/') || urlPath.includes('/precios/'))         return '0.8';
  if (urlPath.includes('/portal/'))            return '0.6';
  return '0.7';
}

function getChangefreq(urlPath) {
  if (urlPath.includes('/servicios/') || urlPath.includes('/blog/')) return 'weekly';
  if (urlPath === '/' || urlPath === '/es/')  return 'daily';
  return 'monthly';
}

// ── Walk directories ──────────────────────────────────────────────────────────

const EXCLUDE = ['node_modules', '_archive', '.git', 'archive', 'worktrees'];
const urls    = [];

function walk(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (EXCLUDE.some(ex => entry.startsWith(ex) || entry.startsWith('.'))) continue;
    const abs = resolve(dir, entry);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.isDirectory()) {
      walk(abs, depth + 1);
    } else if (entry === 'index.html') {
      const urlPath = '/' + relative(ROOT, abs).replace(/index\.html$/, '');
      if (!urlPath.includes('worktree') && !urlPath.includes('_codex')) {
        urls.push({ abs, urlPath });
      }
    }
  }
}

// Root index.html
if (existsSync(resolve(ROOT, 'index.html'))) {
  urls.push({ abs: resolve(ROOT, 'index.html'), urlPath: '/' });
}
// Recurse es/ and en/
walk(resolve(ROOT, 'es'));
walk(resolve(ROOT, 'en'));

// ── Generate XML ──────────────────────────────────────────────────────────────

const entries = urls.map(({ abs, urlPath }) => {
  const loc       = DOMAIN + urlPath;
  const lastmod   = gitLastmod(abs);
  const priority  = getPriority(urlPath);
  const changefreq = getChangefreq(urlPath);
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;

writeFileSync(OUTPUT_FILE, xml, 'utf8');
console.log(`✅ gen:sitemap — ${entries.length} URLs generadas en sitemap.xml`);
console.log(`   Dominio: ${DOMAIN}`);
console.log(`   Output:  sitemap.xml`);
