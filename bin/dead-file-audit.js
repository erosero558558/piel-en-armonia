#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUT_FILE = path.join(DOCS_DIR, 'DEAD_FILES.md');

let allFiles = [];
try {
    const output = execSync('git ls-files "*.html" "*.css" "*.js"', { cwd: ROOT, encoding: 'utf8' });
    allFiles = output.split('\n').filter(f => f.trim() !== '');
} catch (e) {
    console.error("Error executing git ls-files:", e.message);
    process.exit(1);
}

const ignoredPaths = ['node_modules/', 'data/', 'docs/', 'bin/', 'k8s/', 'scripts/', 'tests-node/'];
const entryPoints = new Set([
    'index.html', 'admin.html', 'kiosco-turnos.html', 'operador-turnos.html', 'sala-turnos.html', 'test.html'
]);

// 1. Read all files into memory
const fileContents = [];
for (const file of allFiles) {
    if (ignoredPaths.some(ip => file.startsWith(ip))) continue;
    try {
        const fullPath = path.join(ROOT, file);
        fileContents.push({
            file,
            basename: path.basename(file),
            text: fs.readFileSync(fullPath, 'utf8')
        });
    } catch(e) {}
}

const deadFiles = [];

// 2. Fast string search
for (const item of fileContents) {
    const targetFile = item.file;
    const targetBase = item.basename;
    
    if (entryPoints.has(targetBase)) continue;
    
    // check if this targetBase exists in any OTHER file's text
    let isUsed = false;
    for (const other of fileContents) {
        if (other.file === targetFile) continue;
        if (other.text.includes(targetBase)) {
            isUsed = true;
            break;
        }
    }
    
    // Additionally, some CSS might not be explicitly loaded by name. BUT wait! The ticket S13-17 says:
    // "detectar archivos HTML/JS/CSS que existen en el repo pero no son referenciados desde ningún otro archivo."
    if (!isUsed) {
        deadFiles.push(targetFile);
    }
}

let md = `# Audit de Archivos Huérfanos (Dead Files)\n\n`;
md += `Se detectaron **${deadFiles.length}** archivos de UI (HTML/CSS/JS) en el repositorio que no están referenciados por su nombre en ningún otro archivo del proyecto.\n\n`;
md += `> Estos archivos son **fuertes candidatos a eliminación (\`git rm\`)** previo a una revisión humana. \n\n`;

md += `### Lista de archivos sin referencias\n\n`;

for (const dead of deadFiles.sort()) {
    md += `- \`${dead}\`\n`;
}

md += `\n---\n_Generado automáticamente por \`bin/dead-file-audit.js\`_\n`;

if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, {recursive: true});
fs.writeFileSync(OUT_FILE, md, 'utf8');

console.log(`Audit complete. Found ${deadFiles.length} dead files. Report saved to docs/DEAD_FILES.md`);
