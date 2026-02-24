#!/usr/bin/env node
'use strict';

const { existsSync, readdirSync } = require('fs');
const { resolve, dirname, join } = require('path');
const { homedir } = require('os');
const { spawnSync } = require('child_process');

const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const args = process.argv.slice(2);

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function run(command, commandArgs, options = {}) {
    return spawnSync(command, commandArgs, {
        cwd: root,
        stdio: 'inherit',
        ...options,
    });
}

function probePhp(command) {
    const probe = spawnSync(command, ['-v'], {
        cwd: root,
        stdio: 'ignore',
        shell: false,
    });
    return !probe.error && probe.status === 0;
}

function uniqueList(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const value = String(raw || '').trim();
        if (!value) continue;
        const key = isWin ? value.toLowerCase() : value;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}

function listLaragonPhpCandidates() {
    if (!isWin) return [];
    const base = 'C:\\laragon\\bin\\php';
    if (!existsSync(base)) return [];

    const candidates = [];
    try {
        for (const entry of readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const phpExe = join(base, entry.name, 'php.exe');
            if (existsSync(phpExe)) {
                candidates.push(phpExe);
            }
        }
    } catch {
        return [];
    }
    // Prefer lexicographically latest first (often newest version).
    return candidates.sort((a, b) => b.localeCompare(a));
}

function buildPhpCandidates() {
    const home = homedir();
    const winCandidates = isWin
        ? [
              process.env.PHP_BIN || '',
              'php',
              'C:\\xampp\\php\\php.exe',
              'C:\\php\\php.exe',
              'C:\\tools\\php\\php.exe',
              'C:\\Program Files\\PHP\\php.exe',
              'C:\\Program Files\\php\\php.exe',
              'C:\\ProgramData\\chocolatey\\bin\\php.exe',
              home
                  ? join(home, 'scoop', 'apps', 'php', 'current', 'php.exe')
                  : '',
              home
                  ? join(home, 'AppData', 'Local', 'Programs', 'PHP', 'php.exe')
                  : '',
              ...listLaragonPhpCandidates(),
          ]
        : [process.env.PHP_BIN || '', 'php'];

    return uniqueList(winCandidates);
}

function resolvePhpBinary() {
    const tried = [];
    for (const candidate of buildPhpCandidates()) {
        tried.push(candidate);
        if (candidate !== 'php' && !existsSync(candidate)) {
            continue;
        }
        if (probePhp(candidate)) {
            return { ok: true, command: candidate, tried };
        }
    }
    return { ok: false, command: null, tried };
}

if (args.length === 0) {
    fail('Uso: node bin/run-php-cs-fixer.js <args...>');
}

const fixerPath = resolve(root, 'vendor', 'bin', 'php-cs-fixer');
if (!existsSync(fixerPath)) {
    fail('No existe vendor/bin/php-cs-fixer. Ejecuta `composer install`.');
}

const phpRuntime = resolvePhpBinary();
if (!phpRuntime.ok || !phpRuntime.command) {
    const tried =
        phpRuntime.tried.length > 0 ? phpRuntime.tried.join(', ') : 'php';
    fail(
        `PHP no esta disponible. Configura PATH o define PHP_BIN (ej: setx PHP_BIN "C:\\\\ruta\\\\php.exe"). Candidatos probados: ${tried}`
    );
}

const result = run(phpRuntime.command, [fixerPath, ...args]);
if (result.error) {
    fail(`no se pudo ejecutar php-cs-fixer: ${result.error.message}`);
}

process.exit(result.status === null ? 1 : result.status);
