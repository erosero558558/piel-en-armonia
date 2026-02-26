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
    'calendar-write-smoke.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('calendar-write-smoke habilita permisos para incidentes', () => {
    const { parsed } = loadWorkflow();
    const permissions = parsed?.permissions || {};

    assert.equal(
        permissions.issues,
        'write',
        'calendar-write-smoke debe tener issues: write para ciclo de incidente'
    );
});

test('calendar-write-smoke mantiene schedule diario y dispatch con confirmacion de write', () => {
    const { raw, parsed } = loadWorkflow();
    const schedule = parsed?.on?.schedule || [];
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    assert.equal(Array.isArray(schedule), true, 'falta bloque schedule');
    assert.equal(schedule.length > 0, true, 'falta cron schedule');
    assert.equal(
        raw.includes("cron: '10 14 * * *'"),
        true,
        'cron diario esperado no encontrado'
    );

    assert.equal(
        Object.prototype.hasOwnProperty.call(inputs, 'enable_write'),
        true,
        'falta input enable_write'
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(inputs, 'domain'),
        true,
        'falta input domain'
    );
});

test('calendar-write-smoke fuerza write y google en corridas schedule', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes(
            "TEST_ENABLE_CALENDAR_WRITE: ${{ github.event_name == 'schedule' && 'true'"
        ),
        true,
        'schedule debe forzar TEST_ENABLE_CALENDAR_WRITE=true'
    );
    assert.equal(
        raw.includes("TEST_REQUIRE_GOOGLE_CALENDAR: 'true'"),
        true,
        'workflow debe forzar TEST_REQUIRE_GOOGLE_CALENDAR=true'
    );
    assert.equal(
        raw.includes('if [ "${GITHUB_EVENT_NAME}" = "schedule" ]; then'),
        true,
        'falta bypass de validacion manual en schedule'
    );
});

test('calendar-write-smoke incluye preflight, artefactos y ciclo de incidente', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['calendar-write-smoke']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    const requiredStepNames = [
        'Preflight calendar health',
        'Verificar contrato de agenda real (read-only)',
        'Ejecutar smoke write calendar',
        'Publicar artefactos Playwright de calendar smoke',
        'Crear/actualizar incidente calendar write smoke',
        'Cerrar incidente calendar write smoke al recuperar',
    ];

    for (const stepName of requiredStepNames) {
        assert.equal(
            stepNames.includes(stepName),
            true,
            `falta step: ${stepName}`
        );
    }

    assert.equal(
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura de incidente solo en fallos no manuales'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre de incidente solo en recuperacion no manual'
    );
    assert.equal(
        raw.includes('Calendar Write Smoke fallando'),
        true,
        'falta titulo canonico de incidente calendar smoke'
    );
});
