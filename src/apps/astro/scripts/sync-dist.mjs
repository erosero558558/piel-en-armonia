import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const astroRoot = path.resolve(scriptDir, '..');
const distRoot = path.resolve(astroRoot, 'dist');
const require = createRequire(import.meta.url);
const {
    GENERATED_PUBLIC_ENTRIES,
    GENERATED_SITE_ROOT,
} = require('../../../../bin/lib/generated-site-root.js');

function ensureEmptyDirectory(targetDir) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
}

function copyDirectoryContents(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Astro dist missing expected entry: ${sourceDir}`);
    }

    ensureEmptyDirectory(targetDir);

    for (const entry of fs.readdirSync(sourceDir)) {
        const sourceEntry = path.join(sourceDir, entry);
        const targetEntry = path.join(targetDir, entry);
        fs.cpSync(sourceEntry, targetEntry, { recursive: true, force: true });
    }
}

function run() {
    if (!fs.existsSync(distRoot)) {
        throw new Error(`Astro dist no encontrado: ${distRoot}`);
    }

    for (const entry of GENERATED_PUBLIC_ENTRIES) {
        const source = path.join(distRoot, entry);
        const target = path.join(GENERATED_SITE_ROOT, entry);
        copyDirectoryContents(source, target);
    }

    console.log(`Public V6 artifacts synchronized in ${GENERATED_SITE_ROOT}`);
}

run();
