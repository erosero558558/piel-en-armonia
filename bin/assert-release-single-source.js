#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const APP_DOWNLOADS_ROOT = path.join(ROOT, 'app-downloads');
const DESKTOP_UPDATES_ROOT = path.join(ROOT, 'desktop-updates');

function sha256(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
}

function walkDir(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath, fileList);
        } else {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function main() {
    const issues = [];
    const canonicalFiles = walkDir(APP_DOWNLOADS_ROOT);

    if (canonicalFiles.length === 0) {
        console.warn('[release-single-source] Warning: No files found in app-downloads/');
        return;
    }

    const targetExtensions = ['.exe', '.dmg', '.zip', '.apk', '.blockmap'];

    for (const canonicalPath of canonicalFiles) {
        const ext = path.extname(canonicalPath).toLowerCase();
        if (!targetExtensions.includes(ext) && !canonicalPath.endsWith('.blockmap')) {
            continue;
        }

        const relativePath = path.relative(APP_DOWNLOADS_ROOT, canonicalPath);
        const updatePath = path.join(DESKTOP_UPDATES_ROOT, relativePath);

        if (!fs.existsSync(updatePath)) {
            // It is okay if an app-download doesn't have an auto-update equivalent yet, 
            // but if it does exist it MUST be an alias/match.
            continue;
        }

        const stats = fs.lstatSync(updatePath);
        
        if (!stats.isSymbolicLink()) {
            issues.push(
                `Duplication Error: File ${relativePath} in desktop-updates/ is a physical file. It must be a symlink to app-downloads/`
            );
        }

        const canonicalHash = sha256(canonicalPath);
        const updateHash = sha256(updatePath);

        if (canonicalHash !== updateHash) {
            issues.push(
                `Checksum Mismatch: ${relativePath} hash differs between app-downloads/ y desktop-updates/`
            );
        }
    }

    const releaseDir = path.join(ROOT, 'release');
    if (fs.existsSync(releaseDir)) {
         const releaseFiles = walkDir(releaseDir);
         const heavyArtifacts = releaseFiles.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return targetExtensions.includes(ext) || f.endsWith('.blockmap');
         });
         
         if (heavyArtifacts.length > 0) {
            issues.push(`Ephemeral release/ directory contains heavy artifacts that should be cleaned to avoid git contamination.`);
         }
    }

    if (issues.length) {
        console.error('[release-single-source] FAILED - Violación Single Source of Truth:');
        issues.forEach((issue) => console.error(`- ${issue}`));
        process.exitCode = 1;
        return;
    }

    console.log('[release-single-source] OK. Single Source of Truth integrity validated.');
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error(`[release-single-source] Fatal error: ${err.message}`);
        process.exitCode = 1;
    }
}
