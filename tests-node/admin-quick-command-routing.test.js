#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function loadModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

test('parseQuickCommand enruta historia clinica y telemedicina al frente clinico', async () => {
    const { parseQuickCommand } = await loadModule(
        'src/apps/admin-v3/core/boot/navigation/commands.js'
    );

    assert.equal(
        parseQuickCommand('historia clinica'),
        'clinical_history_section'
    );
    assert.equal(
        parseQuickCommand('telemedicina pendiente'),
        'clinical_history_section'
    );
    assert.equal(
        parseQuickCommand('casos de pacientes'),
        'clinical_history_section'
    );
});

test('parseQuickCommand enruta OpenClaw y copiloto al panel del agente', async () => {
    const { parseQuickCommand } = await loadModule(
        'src/apps/admin-v3/core/boot/navigation/commands.js'
    );

    assert.equal(parseQuickCommand('OpenClaw'), 'agent_panel');
    assert.equal(parseQuickCommand('copiloto operativo'), 'agent_panel');
    assert.equal(parseQuickCommand('agente ia'), 'agent_panel');
});

test('parseQuickCommand mantiene los atajos operativos previos', async () => {
    const { parseQuickCommand } = await loadModule(
        'src/apps/admin-v3/core/boot/navigation/commands.js'
    );

    assert.equal(parseQuickCommand('agenda'), 'appointments_overview');
    assert.equal(parseQuickCommand('callbacks sla'), 'callbacks_sla_urgent');
    assert.equal(parseQuickCommand('turnero'), 'queue_sla_risk');
});
