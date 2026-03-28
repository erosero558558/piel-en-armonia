'use strict';

const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const { resolvePhpBinary } = require('../bin/run-php-cs-fixer.js');

const REPO_ROOT = resolve(__dirname, '..');

function resolveRepoPath(...segments) {
    return resolve(REPO_ROOT, ...segments);
}

function buildLocalDependencyMissingMessage(
    relativePath,
    installHint = 'npm ci'
) {
    return `Falta ${relativePath} en este worktree. Ejecuta \`${installHint}\` antes de correr este contrato.`;
}

function requireRepoPath(relativePath, installHint = 'npm ci') {
    const resolvedPath = resolveRepoPath(relativePath);
    if (!existsSync(resolvedPath)) {
        throw new Error(
            buildLocalDependencyMissingMessage(relativePath, installHint)
        );
    }
    return resolvedPath;
}

function runLocalNodeScript(relativePath, args = [], options = {}) {
    const { installHint = 'npm ci', ...spawnOptions } = options;
    const scriptPath = requireRepoPath(relativePath, installHint);
    return spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        ...spawnOptions,
    });
}

function buildPhpRuntimeMissingMessage(
    label = 'contrato PHP local',
    tried = []
) {
    const triedLabel =
        Array.isArray(tried) && tried.length > 0 ? tried.join(', ') : 'php';
    return `${label}: PHP no disponible. Configura PATH o define PHP_BIN. Candidatos probados: ${triedLabel}`;
}

function resolvePhpRuntime() {
    return resolvePhpBinary();
}

function requirePhpRuntime(t, label = 'contrato PHP local') {
    const runtime = resolvePhpRuntime();
    if (!runtime.ok || !runtime.command) {
        if (t && typeof t.skip === 'function') {
            t.skip(buildPhpRuntimeMissingMessage(label, runtime.tried));
            return null;
        }

        throw new Error(buildPhpRuntimeMissingMessage(label, runtime.tried));
    }

    return runtime.command;
}

function runInlinePhp(script, options = {}) {
    const { t, label = 'contrato PHP local', ...spawnOptions } = options;
    const phpCommand = requirePhpRuntime(t, label);
    if (!phpCommand) {
        return null;
    }

    return spawnSync(phpCommand, ['-r', script], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        ...spawnOptions,
    });
}

module.exports = {
    REPO_ROOT,
    buildLocalDependencyMissingMessage,
    buildPhpRuntimeMissingMessage,
    requirePhpRuntime,
    requireRepoPath,
    resolvePhpRuntime,
    resolveRepoPath,
    runInlinePhp,
    runLocalNodeScript,
};
