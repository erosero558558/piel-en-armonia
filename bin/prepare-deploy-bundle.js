#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    GENERATED_SITE_ROOT,
    REPO_ROOT,
    normalizeRelativePath,
} = require('./lib/generated-site-root.js');
const { buildDeployBundleManifest } = require('./lib/deploy-bundle-contract.js');

function parseArgs(argv) {
    const options = {
        outputDir: '_deploy_bundle',
        includeTooling: false,
        build: true,
        json: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) continue;

        if (token === '--output-dir') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                options.outputDir = nextValue;
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--output-dir=')) {
            options.outputDir = token.slice('--output-dir='.length).trim();
            continue;
        }

        if (token === '--include-tooling') {
            options.includeTooling = true;
            continue;
        }

        if (token === '--skip-build' || token === '--no-build') {
            options.build = false;
            continue;
        }

        if (token === '--json') {
            options.json = true;
        }
    }

    return options;
}

function runCommand(program, args, options = {}) {
    return spawnSync(program, args, {
        cwd: options.cwd || REPO_ROOT,
        encoding: 'utf8',
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        shell: Boolean(options.shell),
    });
}

function ensureCommandOk(result, label) {
    if (!result || result.status !== 0) {
        throw new Error(
            `${label} failed: ${
                result && result.error && result.error.message
                    ? String(result.error.message).trim()
                    : result &&
                        (result.stderr || result.stdout)
                      ? String(result.stderr || result.stdout).trim()
                      : 'unknown error'
            }`
        );
    }
}

function ensureStageBuild(options) {
    if (!options.build) {
        return;
    }

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const buildResult = runCommand(
        npmCommand,
        ['run', 'build'],
        {
            cwd: REPO_ROOT,
            capture: Boolean(options.json),
            shell: process.platform === 'win32',
        }
    );
    if (options.json && buildResult) {
        if (buildResult.stdout) {
            process.stderr.write(buildResult.stdout);
        }
        if (buildResult.stderr) {
            process.stderr.write(buildResult.stderr);
        }
    }
    ensureCommandOk(buildResult, 'npm run build');
}

function ensureDirectory(targetPath) {
    fs.mkdirSync(targetPath, { recursive: true });
}

function resolveSourcePath(entry) {
    const relativePath = normalizeRelativePath(entry.relativePath);
    if (!relativePath) {
        throw new Error('deploy bundle entry without relativePath');
    }

    return entry.source === 'stage'
        ? path.resolve(GENERATED_SITE_ROOT, relativePath)
        : path.resolve(REPO_ROOT, relativePath);
}

function copyEntry(entry, stageRoot, missing) {
    const sourcePath = resolveSourcePath(entry);
    if (!fs.existsSync(sourcePath)) {
        missing.push({
            source: entry.source,
            type: entry.type,
            relativePath: entry.relativePath,
        });
        return;
    }

    const targetPath = path.resolve(stageRoot, entry.relativePath);
    ensureDirectory(path.dirname(targetPath));

    if (entry.type === 'directory') {
        fs.cpSync(sourcePath, targetPath, {
            recursive: true,
            force: true,
        });
        return;
    }

    fs.cpSync(sourcePath, targetPath, {
        force: true,
    });
}

function listFilesRecursive(baseDir, currentDir = baseDir, collector = []) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursive(baseDir, absolutePath, collector);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        collector.push(absolutePath);
    }

    return collector.sort();
}

function hashFile(filePath) {
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
}

function writeManifest(stageRoot) {
    const manifestPath = path.join(stageRoot, 'manifest-sha256.txt');
    const lines = listFilesRecursive(stageRoot)
        .filter((filePath) => filePath !== manifestPath)
        .map((filePath) => {
            const relativePath = path
                .relative(stageRoot, filePath)
                .replace(/\\/g, '/');
            return `${hashFile(filePath)}  ${relativePath}`;
        });

    fs.writeFileSync(manifestPath, `${lines.join('\n')}\n`, 'utf8');
    return manifestPath;
}

function resolvePowerShellBinary() {
    const candidates =
        process.platform === 'win32'
            ? ['powershell', 'powershell.exe', 'pwsh']
            : ['pwsh', 'powershell'];

    for (const candidate of candidates) {
        const probe = spawnSync(
            candidate,
            ['-NoProfile', '-Command', 'Get-Command Compress-Archive | Out-Null'],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            }
        );
        if (!probe.error && probe.status === 0) {
            return candidate;
        }
    }

    return '';
}

function resolvePythonBinary() {
    for (const candidate of ['python', 'python3']) {
        const probe = spawnSync(
            candidate,
            ['-c', 'import sys, zipfile'],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            }
        );
        if (!probe.error && probe.status === 0) {
            return candidate;
        }
    }

    return '';
}

function zipWithPowerShell(powerShellBinary, stageRoot, zipPath) {
    const script = [
        '$ErrorActionPreference = "Stop"',
        `if (Test-Path -LiteralPath "${zipPath.replace(/\\/g, '\\\\')}") { Remove-Item -LiteralPath "${zipPath.replace(/\\/g, '\\\\')}" -Force }`,
        `Compress-Archive -Path "${path.join(stageRoot, '*').replace(/\\/g, '\\\\')}" -DestinationPath "${zipPath.replace(/\\/g, '\\\\')}" -CompressionLevel Optimal`,
    ].join('; ');

    const result = spawnSync(
        powerShellBinary,
        ['-NoProfile', '-Command', script],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    ensureCommandOk(result, 'Compress-Archive');
}

function zipWithPython(pythonBinary, stageRoot, zipPath) {
    const script = [
        'import os, sys, zipfile',
        'root = sys.argv[1]',
        'zip_path = sys.argv[2]',
        'with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:',
        '    for current_root, _dirs, files in os.walk(root):',
        '        for name in files:',
        '            absolute = os.path.join(current_root, name)',
        '            relative = os.path.relpath(absolute, root)',
        '            zf.write(absolute, relative)',
    ].join('\n');
    const result = spawnSync(
        pythonBinary,
        ['-c', script, stageRoot, zipPath],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    ensureCommandOk(result, 'python zipfile');
}

function createZip(stageRoot, zipPath) {
    const powerShellBinary = resolvePowerShellBinary();
    if (powerShellBinary) {
        zipWithPowerShell(powerShellBinary, stageRoot, zipPath);
        return 'powershell';
    }

    const pythonBinary = resolvePythonBinary();
    if (pythonBinary) {
        zipWithPython(pythonBinary, stageRoot, zipPath);
        return pythonBinary;
    }

    throw new Error(
        'No zip backend available. Install pwsh/powershell or python/python3.'
    );
}

function buildBundle(options) {
    ensureStageBuild(options);

    const outputRoot = path.resolve(REPO_ROOT, options.outputDir);
    ensureDirectory(outputRoot);

    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\..+$/, '')
        .replace('T', '-');
    const stageDirName = `pielarmonia-deploy-${timestamp}`;
    const stageRoot = path.join(outputRoot, stageDirName);

    fs.rmSync(stageRoot, { recursive: true, force: true });
    ensureDirectory(stageRoot);

    const manifestEntries = buildDeployBundleManifest({
        includeTooling: options.includeTooling,
    });
    const missing = [];
    for (const entry of manifestEntries) {
        copyEntry(entry, stageRoot, missing);
    }

    const manifestPath = writeManifest(stageRoot);
    const zipPath = path.join(outputRoot, `${stageDirName}.zip`);
    const zipBackend = createZip(stageRoot, zipPath);
    const fileCount = listFilesRecursive(stageRoot).length;

    return {
        ok: true,
        stageRoot,
        zipPath,
        manifestPath,
        fileCount,
        zipBackend,
        missing,
        generatedSiteRoot: GENERATED_SITE_ROOT,
    };
}

function printResult(result, options) {
    if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
    }

    process.stdout.write(`Paquete listo: ${result.zipPath}\n`);
    process.stdout.write(`Stage root: ${result.stageRoot}\n`);
    process.stdout.write(`Generated site root: ${result.generatedSiteRoot}\n`);
    process.stdout.write(`Archivos incluidos: ${result.fileCount}\n`);
    process.stdout.write(`ZIP backend: ${result.zipBackend}\n`);

    if (result.missing.length > 0) {
        process.stdout.write('Advertencia: faltaron rutas (no incluidas):\n');
        for (const entry of result.missing) {
            process.stdout.write(
                ` - [${entry.source}:${entry.type}] ${entry.relativePath}\n`
            );
        }
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const result = buildBundle(options);
    printResult(result, options);
}

try {
    main();
} catch (error) {
    process.stderr.write(
        `${error && error.message ? error.message : 'bundle deploy failed'}\n`
    );
    process.exit(1);
}
