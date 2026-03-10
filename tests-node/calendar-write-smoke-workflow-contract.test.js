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
        'Ejecutar smoke API write calendar',
        'Clasificar estado telemedicina calendar smoke',
        'Publicar artefactos Playwright de calendar smoke',
        'Crear/actualizar incidente calendar write smoke',
        'Crear/actualizar incidente telemedicina calendar write smoke',
        'Cerrar incidente calendar write smoke al recuperar',
        'Cerrar incidente telemedicina calendar write smoke al recuperar',
    ];

    for (const stepName of requiredStepNames) {
        assert.equal(
            stepNames.includes(stepName),
            true,
            `falta step: ${stepName}`
        );
    }

    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && ((env.TELEMEDICINE_CALENDAR_STATUS != 'degraded_only' && env.TELEMEDICINE_CALENDAR_STATUS != 'unknown') || env.TELEMEDICINE_CALENDAR_NON_TELE_FAILURES != '0')"
        ),
        true,
        'falta condicion de incidente general excluyendo tele-only unknown/degraded_only'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_CALENDAR_STATUS == 'degraded_only' || env.TELEMEDICINE_CALENDAR_STATUS == 'degraded_mixed' || env.TELEMEDICINE_CALENDAR_STATUS == 'unknown')"
        ),
        true,
        'falta condicion de apertura de incidente dedicado telemedicina con unknown'
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
    assert.equal(
        raw.includes('Calendar Write Smoke telemedicina degradado'),
        true,
        'falta titulo canonico de incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            'verification/calendar-write-smoke/api-write-smoke-last.json'
        ),
        true,
        'falta artefacto JSON de smoke API-only'
    );
    assert.equal(
        raw.includes('steps.api_write_test.outputs.api_write_status'),
        true,
        'falta resumen/senal de salida de api_write_status'
    );
    assert.equal(
        raw.includes('steps.api_write_test.outcome'),
        true,
        'falta outcome de api_write_test en summary/incidente'
    );
    assert.equal(
        raw.includes('steps.health.outputs.telemedicine_health'),
        true,
        'falta trazabilidad de telemedicine_health desde preflight'
    );
    assert.equal(
        raw.includes('TELEMEDICINE_CALENDAR_NON_TELE_FAILURES'),
        true,
        'falta trazabilidad de non-tele failures en calendar smoke'
    );
    assert.equal(
        raw.includes('calendar-write-smoke-telemedicine-signal'),
        true,
        'falta marker de senal para dedupe en incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            "non_tele:${process.env.TELEMEDICINE_CALENDAR_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta non_tele en signal de dedupe para incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            "telemedicine_calendar_non_tele_failures: ${process.env.TELEMEDICINE_CALENDAR_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta trazabilidad de non_tele_failures en updates de incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            "const baseLabels = ['production-alert', 'calendar-smoke', 'telemedicine', severity];"
        ),
        true,
        'falta set canonico de labels base con severidad en incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes('severity:critical'),
        true,
        'falta label de severidad critica en incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes('severity:warning'),
        true,
        'falta label de severidad warning en incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            'Incidente telemedicina calendar smoke ya refleja la misma senal'
        ),
        true,
        'falta deduplicacion idempotente cuando la senal no cambia en incidente telemedicina calendar smoke'
    );
    assert.equal(
        raw.includes(
            'Incidente telemedicina calendar smoke actualizado por cambio de senal.'
        ),
        true,
        'falta comentario de auditoria por cambio de senal en incidente telemedicina calendar smoke'
    );
});
