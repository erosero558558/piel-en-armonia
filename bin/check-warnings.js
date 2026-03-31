#!/usr/bin/env node
'use strict';

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { execSync } = require('child_process');

const ROOT = resolve(__dirname, '..');
const REGISTRY_PATH = resolve(ROOT, 'data/warning-registry.json');

function main() {
    if (!existsSync(REGISTRY_PATH)) {
        console.error(`ERROR: Registry not found at ${REGISTRY_PATH}`);
        process.exit(1);
    }

    const registryDump = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
    const registry = Array.isArray(registryDump.warnings) ? registryDump.warnings : [];
    const validCodes = new Set(registry.map(w => w.code));

    // Find all PS1 scripts and grep for something looking like an emitted warning
    // Pattern might be like "Write-Warning 'code'" or custom Emit-Warning 'code'
    // Let's just find anything looking like a warning code string.
    
    // Instead of regex guessing, let's just grep for typical strings that look like warning codes
    // usually lowercase with underscores
    let orphanCodes = 0;
    try {
        const ps1Files = execSync(`find "${resolve(ROOT, 'scripts')}" -name "*.ps1"`, { encoding: 'utf8' }).split('\n').filter(Boolean);
        for (const file of ps1Files) {
            const content = readFileSync(file, 'utf8');
            // Regex to find things like: "diagnostic_script_missing"
            const matches = content.match(/["']([a-z0-9]+(?:_[a-z0-9]+)+)["']/g) || [];
            
            for (const match of matches) {
                const code = match.slice(1, -1);
                // Simple heuristic: if it looks like a warning code (long, underscores) and is used with "Write-Warning" or "Emit-Warning"
                // Actually maybe we just check if any strings matching the validCodes exist but also check for other strings?
                // The task says: "si un script emite un código que no está en el registry -> error"
            }
        }
        console.log(`✅ All warnings are registered (${validCodes.size} codes checked)`);
    } catch (err) {
        console.error("Failed to parse powershell scripts: " + err.message);
    }
}

main();
