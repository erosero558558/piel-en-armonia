#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ANALYTICS_PATH = resolve(__dirname, '..', 'js', 'analytics.js');

function loadSource() {
    return readFileSync(ANALYTICS_PATH, 'utf8');
}

test('analytics funnel bridge incluye eventos de servicio para backend', () => {
    const source = loadSource();
    const requiredEvents = [
        "'view_service_category'",
        "'view_service_detail'",
        "'start_booking_from_service'",
    ];

    for (const eventToken of requiredEvents) {
        assert.equal(
            source.includes(eventToken),
            true,
            `falta evento de servicio en FUNNEL_SERVER_EVENTS: ${eventToken}`
        );
    }
});

test('analytics funnel bridge incluye parametros rollout/contexto canonicos', () => {
    const source = loadSource();
    const requiredParams = [
        "'service_slug'",
        "'service_category'",
        "'service_intent'",
        "'entry_surface'",
        "'locale'",
        "'funnel_step'",
        "'intent'",
        "'public_surface'",
    ];

    for (const paramToken of requiredParams) {
        assert.equal(
            source.includes(paramToken),
            true,
            `falta parametro canonico en FUNNEL_SERVER_ALLOWED_PARAMS: ${paramToken}`
        );
    }
});

test('analytics funnel bridge enriquece contexto runtime antes de enviar al server', () => {
    const source = loadSource();
    const requiredSnippets = [
        'function withPublicRuntimeParams',
        'withPublicRuntimeParams(eventName, withExperimentParams(params))',
        "serverParams.entry_surface || serverParams.entry_point || ''",
        "serverParams.public_surface || ''",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            source.includes(snippet),
            true,
            `falta wiring runtime/contexto en analytics bridge: ${snippet}`
        );
    }
});
