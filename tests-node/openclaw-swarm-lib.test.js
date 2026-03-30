#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const swarm = require('../bin/lib/openclaw-swarm.js');

test('buildPatch helpers normalizan task y lane', () => {
    assert.equal(
        swarm.buildPatchAgentId('CDX-901', 'Transversal Runtime'),
        'patch-cdx-901-transversal-runtime'
    );
    assert.equal(
        swarm.buildPatchBranch('CDX-901', 'Transversal Runtime'),
        'codex/swarm-cdx-901-transversal-runtime'
    );
    assert.equal(
        swarm.buildPatchWorktreePath('CDX-901', 'Transversal Runtime').endsWith(
            'pielarmonia-swarm\\cdx-901-transversal-runtime'
        ),
        true
    );
});

test('extractJsonDocument tolera ruido antes y despues del JSON', () => {
    const raw = [
        'OpenClaw warning: duplicate plugin id',
        '{"ok":true,"summary":"works","nested":{"count":2}}',
        'tail noise',
    ].join('\n');
    assert.deepEqual(swarm.extractJsonDocument(raw), {
        ok: true,
        summary: 'works',
        nested: {
            count: 2,
        },
    });
});

test('normalizeContractPayload cae a contrato invalido con raw text', () => {
    const contract = swarm.normalizeContractPayload(null, 'API rate limit reached');
    assert.equal(contract.contract_ok, false);
    assert.equal(
        contract.summary,
        'La respuesta del agente no cumplio el contrato JSON.'
    );
    assert.deepEqual(contract.findings, ['API rate limit reached']);
    assert.equal(contract.next_command, 'retry');
    assert.deepEqual(contract.changed_files, []);
});

test('buildContractPrompt fija guardrails de repo, workspace y contrato', () => {
    const prompt = swarm.buildContractPrompt({
        agentId: 'swarm-scout',
        task: 'Analiza el board',
        allowWrite: false,
    });
    assert.match(prompt, /swarm-scout/);
    assert.match(prompt, /Responde SOLO con un objeto JSON valido/);
    assert.match(prompt, /summary", "findings", "next_command", "changed_files/);
    assert.match(prompt, /Workspace OpenClaw reservado/);
    assert.match(prompt, /Modo de lectura: no edites/);
});
