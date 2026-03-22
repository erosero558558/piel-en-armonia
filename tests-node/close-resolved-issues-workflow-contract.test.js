#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'close-resolved-issues.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('close-resolved-issues escucha Production Monitor y el gate real de post-deploy', () => {
    const { parsed } = loadWorkflow();
    const watchedWorkflows =
        parsed?.on?.workflow_run?.workflows ||
        parsed?.true?.workflow_run?.workflows ||
        [];

    assert.equal(
        Array.isArray(watchedWorkflows),
        true,
        'close-resolved-issues debe declarar workflow_run.workflows'
    );
    assert.equal(
        watchedWorkflows.includes('Production Monitor'),
        true,
        'close-resolved-issues debe escuchar Production Monitor'
    );
    assert.equal(
        watchedWorkflows.includes('Post-Deploy Gate (Full Regression)'),
        true,
        'close-resolved-issues debe escuchar el nombre real del gate actual'
    );
});

test('close-resolved-issues sigue cerrando alertas por prefijo o label production-alert', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        "const alertTitlePrefixes = ['[ALERTA PROD]'];",
        "return labelName.toLowerCase() === 'production-alert';",
        'Cerrando alerta automáticamente.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet esperado en close-resolved-issues: ${snippet}`
        );
    }
});
