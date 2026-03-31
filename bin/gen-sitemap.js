#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://aurora-derm.com';

function getGitLastMod(filePath) {
    try {
        const cmd = `git log -1 --format=%cI -- "${filePath}"`;
        const result = execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
        // Return YYYY-MM-DD format as required by sitemaps
        if (result) {
            return result.split('T')[0];
        }
    } catch (e) {
        // ignore
    }
    // Fallback to today
    return new Date().toISOString().split('T')[0];
}

function scanHtmlFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanHtmlFiles(fullPath, fileList);
        } else if (file === 'index.html') {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function generate() {
    // Collect all index.html paths in root, es/ and en/
    const pages = [];
    
    // Add root index.html
    const rootIndex = path.join(ROOT, 'index.html');
    if (fs.existsSync(rootIndex)) {
        pages.push(rootIndex);
    }
    
    // Add everything in es/ and en/
    scanHtmlFiles(path.join(ROOT, 'es'), pages);
    scanHtmlFiles(path.join(ROOT, 'en'), pages);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
    
    for (const page of pages) {
        const relPath = path.relative(ROOT, page).replace(/\\/g, '/');
        
        let urlPath = relPath.replace('index.html', '');
        if (!urlPath.startsWith('/')) {
            urlPath = '/' + urlPath;
        }
        
        const loc = `${BASE_URL}${urlPath}`;
        const lastmod = getGitLastMod(relPath);
        
        let priority = '0.7';
        if (urlPath === '/' || urlPath === '/es/' || urlPath === '/en/') priority = '1.0';
        else if (urlPath.includes('/servicios/')) priority = '0.9';
        else if (urlPath.includes('/blog/')) priority = '0.8';
        else if (urlPath.includes('/portal/')) priority = '0.6';
        
        // Let's use weekly/monthly logic
        let freq = 'monthly';
        if (priority === '1.0') freq = 'daily';
        else if (priority === '0.9' || priority === '0.8') freq = 'weekly';

        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>${freq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `  </url>\n`;
    }
    
    xml += `</urlset>\n`;
    fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
    console.log(`Generated sitemap.xml with ${pages.length} URLs`);
}

generate();
