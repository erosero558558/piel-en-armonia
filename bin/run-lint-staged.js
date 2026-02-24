#!/usr/bin/env node
'use strict';

const { existsSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const root = resolve(__dirname, '..');
const binPath = resolve(
    root,
    'node_modules',
    'lint-staged',
    'bin',
    'lint-staged.js'
);

if (!existsSync(binPath)) {
    console.error(
        'ERROR: lint-staged no esta instalado. Ejecuta `npm install`.'
    );
    process.exit(1);
}

const result = spawnSync(
    process.execPath,
    [binPath, ...process.argv.slice(2)],
    {
        cwd: root,
        stdio: 'inherit',
    }
);

if (result.error) {
    console.error(
        `ERROR: no se pudo ejecutar lint-staged: ${result.error.message}`
    );
    process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
