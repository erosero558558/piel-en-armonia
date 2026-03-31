#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://pielarmonia.com';
const LEGACY_CONTRACT_ROUTES = [
    '/es/agendar/',
    '/es/blog/',
    '/es/blog/acne-adulto/',
    '/es/blog/bioestimuladores-vs-rellenos/',
    '/es/blog/como-elegir-dermatologo-quito/',
    '/es/blog/melasma-embarazo/',
    '/es/blog/proteccion-solar-ecuador/',
    '/es/blog/senales-alarma-lunares/',
    '/es/pago/',
    '/es/servicios/depilacion-laser/',
    '/en/services/depilacion-laser/',
];

function getGitLastMod(relativePath) {
    try {
        const cmd = `git log -1 --format=%cI -- "${relativePath}"`;
        const result = execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
        if (result) {
            return result.split('T')[0];
        }
    } catch (_error) {
        // ignore
    }

    return new Date().toISOString().split('T')[0];
}

function normalizeRoute(routePath) {
    const raw = String(routePath || '/')
        .trim()
        .replace(/[?#].*$/, '') || '/';
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeading === '/' ? '/' : withLeading.replace(/\/+$/, '') + '/';
}

function isPublicSitemapRoute(routePath) {
    const normalized = normalizeRoute(routePath);
    return normalized === '/' || normalized.startsWith('/es/') || normalized.startsWith('/en/');
}

function routeToRepoRelative(routePath) {
    if (routePath === '/') {
        return 'index.html';
    }

    return `${routePath.replace(/^\//, '')}index.html`;
}

function fileExists(relativePath) {
    return fs.existsSync(path.join(ROOT, relativePath));
}

function scanIndexFiles(dir, extension, routes, relativeBase = ROOT) {
    if (!fs.existsSync(dir)) {
        return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanIndexFiles(fullPath, extension, routes, relativeBase);
            continue;
        }

        if (!entry.isFile() || entry.name !== `index.${extension}`) {
            continue;
        }

        const relativePath = path.relative(relativeBase, fullPath).replace(/\\/g, '/');
        let routePath = relativePath.replace(new RegExp(`index\\.${extension}$`), '');
        if (!routePath.startsWith('/')) {
            routePath = `/${routePath}`;
        }

        if (isPublicSitemapRoute(routePath)) {
            routes.add(normalizeRoute(routePath));
        }
    }
}

function collectHrefValues(value, hrefs) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectHrefValues(item, hrefs));
        return;
    }

    if (!value || typeof value !== 'object') {
        return;
    }

    for (const [key, entry] of Object.entries(value)) {
        if (key === 'href' && typeof entry === 'string' && entry.startsWith('/')) {
            if (isPublicSitemapRoute(entry)) {
                hrefs.add(normalizeRoute(entry));
            }
            continue;
        }

        collectHrefValues(entry, hrefs);
    }
}

function collectJsonRoutes(relativePath, routes) {
    if (!fileExists(relativePath)) {
        return;
    }

    try {
        const parsed = JSON.parse(
            fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
        );
        collectHrefValues(parsed, routes);
    } catch (_error) {
        // ignore malformed optional source files
    }
}

function collectCatalogRoutes(routes) {
    const catalogPath = path.join(ROOT, 'data/catalog/services.json');
    if (!fs.existsSync(catalogPath)) {
        return;
    }

    try {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        const services = Array.isArray(catalog.services) ? catalog.services : [];
        for (const service of services) {
            if (String(service.catalog_scope || '') !== 'public_route') {
                continue;
            }

            const slug = String(service.slug || '').trim();
            if (!slug) {
                continue;
            }

            routes.add(`/es/servicios/${slug}/`);
            routes.add(`/en/services/${slug}/`);
        }
    } catch (_error) {
        // ignore malformed optional source files
    }
}

function collectRouteSet() {
    const routes = new Set(['/']);
    const astroPagesRoot = path.join(ROOT, 'src/apps/astro/src/pages');

    scanIndexFiles(path.join(ROOT, 'es'), 'html', routes);
    scanIndexFiles(path.join(ROOT, 'en'), 'html', routes);
    scanIndexFiles(path.join(astroPagesRoot, 'es'), 'astro', routes, astroPagesRoot);
    scanIndexFiles(path.join(astroPagesRoot, 'en'), 'astro', routes, astroPagesRoot);

    collectJsonRoutes('content/public-v6/es/software.json', routes);
    collectJsonRoutes('content/public-v6/en/software.json', routes);
    collectJsonRoutes('content/public-v6/es/legal.json', routes);
    collectJsonRoutes('content/public-v6/en/legal.json', routes);
    collectCatalogRoutes(routes);

    for (const routePath of LEGACY_CONTRACT_ROUTES) {
        if (isPublicSitemapRoute(routePath)) {
            routes.add(normalizeRoute(routePath));
        }
    }

    return [...routes]
        .map((routePath) => normalizeRoute(routePath))
        .sort((left, right) => left.localeCompare(right));
}

function resolveLastMod(routePath) {
    const repoRelative = routeToRepoRelative(routePath);
    if (fileExists(repoRelative)) {
        return getGitLastMod(repoRelative);
    }

    if (routePath.startsWith('/es/servicios/') || routePath.startsWith('/en/services/')) {
        return getGitLastMod('data/catalog/services.json');
    }

    if (routePath.startsWith('/es/legal/')) {
        return getGitLastMod('content/public-v6/es/legal.json');
    }

    if (routePath.startsWith('/en/legal/')) {
        return getGitLastMod('content/public-v6/en/legal.json');
    }

    if (routePath.startsWith('/es/software/')) {
        return getGitLastMod('content/public-v6/es/software.json');
    }

    if (routePath.startsWith('/en/software/')) {
        return getGitLastMod('content/public-v6/en/software.json');
    }

    if (routePath.startsWith('/es/blog/') || routePath === '/es/blog/') {
        return getGitLastMod('AGENTS.md');
    }

    return getGitLastMod('src/apps/astro/src/pages/es/index.astro');
}

function resolvePriority(routePath) {
    if (routePath === '/' || routePath === '/es/' || routePath === '/en/') {
        return '1.0';
    }

    if (routePath.includes('/servicios/') || routePath.includes('/services/')) {
        return '0.9';
    }

    if (routePath.includes('/blog/')) {
        return '0.8';
    }

    if (routePath.includes('/portal/')) {
        return '0.6';
    }

    return '0.7';
}

function resolveChangeFreq(priority) {
    if (priority === '1.0') {
        return 'daily';
    }

    if (priority === '0.9' || priority === '0.8') {
        return 'weekly';
    }

    return 'monthly';
}

function generate() {
    const routes = collectRouteSet();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

    for (const routePath of routes) {
        const loc = new URL(routePath, BASE_URL).toString();
        const priority = resolvePriority(routePath);
        const lastmod = resolveLastMod(routePath);
        const freq = resolveChangeFreq(priority);

        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>${freq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `  </url>\n`;
    }

    xml += `</urlset>\n`;
    fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
    console.log(`Generated sitemap.xml with ${routes.length} URLs`);
}

generate();
