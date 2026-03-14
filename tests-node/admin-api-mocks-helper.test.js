#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
    buildAdminAgentSnapshot,
    buildAdminAgentStatusPayload,
} = require('../tests/helpers/admin-api-mocks');

const ADMIN_QUICK_NAV_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'admin-quick-nav.spec.js'
);

test('buildAdminAgentStatusPayload expone defaults canonicos del copiloto admin', () => {
    const payload = buildAdminAgentStatusPayload();

    assert.equal(payload.ok, true);
    assert.equal(payload.data.session, null);
    assert.deepEqual(payload.data.outbox, []);
    assert.equal(payload.data.health.relay.mode, 'disabled');
    assert.equal(payload.data.health.counts.messages, 0);
    assert.equal(payload.data.tools.length, 0);
});

test('buildAdminAgentSnapshot calcula conteos y acepta overrides', () => {
    const payload = buildAdminAgentSnapshot({
        session: {
            status: 'cancelled',
        },
        approvals: [
            { approvalId: 'ap_1', status: 'pending' },
            { approvalId: 'ap_2', status: 'approved' },
        ],
        outbox: [
            { itemId: 'out_1', status: 'queued' },
            { itemId: 'out_2', status: 'sent' },
        ],
        messages: [{ role: 'assistant', content: 'ok' }],
        toolCalls: [{ toolCallId: 'tool_1', status: 'completed' }],
    });

    assert.equal(payload.session.status, 'cancelled');
    assert.equal(payload.health.counts.messages, 1);
    assert.equal(payload.health.counts.toolCalls, 1);
    assert.equal(payload.health.counts.pendingApprovals, 1);
    assert.equal(payload.health.counts.outboxQueued, 1);
    assert.equal(payload.health.counts.outboxTotal, 2);
});

test('admin quick-nav consume helper compartido para mocks del copiloto', () => {
    const raw = readFileSync(ADMIN_QUICK_NAV_SPEC_PATH, 'utf8');

    assert.match(
        raw,
        /const \{\s+buildAdminAgentSnapshot,\s+buildAdminAgentStatusPayload,\s+installBasicAdminApiMocks,\s+\} = require\('\.\/helpers\/admin-api-mocks'\);/m
    );
    assert.match(raw, /await installBasicAdminApiMocks\(page, \{/m);
    assert.doesNotMatch(raw, /function buildAgentStatusPayload\(/);
    assert.doesNotMatch(raw, /function buildAgentSnapshot\(/);
    assert.doesNotMatch(raw, /function jsonResponse\(/);
    assert.doesNotMatch(raw, /async function handleJsonResponse\(/);
});
