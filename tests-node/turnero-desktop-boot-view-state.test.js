#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

test('boot view state formats retry countdown and hint from retry snapshot', async () => {
    const viewState = await importRepoModule(
        'src/apps/turnero-desktop/src/renderer/boot-view-state.mjs'
    );

    assert.equal(viewState.formatBootCountdownLabel(5000), '5s');
    assert.equal(viewState.formatBootCountdownLabel(61000), '1m 1s');

    assert.deepEqual(
        viewState.getBootRetryView(
            {
                message: 'No se pudo abrir la superficie operator',
                retry: {
                    active: true,
                    attempt: 2,
                    delayMs: 5000,
                    nextRetryAt: '2026-03-12T19:00:05.000Z',
                    reason: 'No se pudo abrir la superficie operator',
                },
            },
            Date.parse('2026-03-12T19:00:00.000Z')
        ),
        {
            attempt: 2,
            summary: 'Reintento #2 en ~5s',
            hint: 'No se pudo abrir la superficie operator. Usa Reintentar para adelantar la carga o F10 para quedarte en configuración.',
        }
    );
    assert.equal(viewState.getBootRetryView({}, Date.now()), null);
});

test('boot view state normalizes preflight summaries and checks', async () => {
    const viewState = await importRepoModule(
        'src/apps/turnero-desktop/src/renderer/boot-view-state.mjs'
    );

    assert.deepEqual(viewState.getBootPreflightView(null), {
        summaryState: 'warning',
        summaryText:
            'Ejecuta la comprobación para validar servidor, superficie y perfil del equipo.',
        checks: [],
    });
    assert.deepEqual(viewState.getBootPendingPreflightView(), {
        summaryState: 'warning',
        summaryText: 'Comprobando servidor, superficie y salud del equipo...',
        checks: [],
    });

    const reportView = viewState.getBootPreflightView({
        state: 'ready',
        title: 'Equipo listo',
        summary:
            'Servidor, superficie y perfil del equipo responden correctamente.',
        checks: [
            {
                id: 'profile',
                label: 'Perfil del equipo',
                state: 'ready',
                detail: 'C2 fijo · 1 tecla ON',
            },
        ],
    });

    assert.deepEqual(reportView, {
        summaryState: 'ready',
        summaryText:
            'Equipo listo: Servidor, superficie y perfil del equipo responden correctamente.',
        checks: [
            {
                id: 'profile',
                label: 'Perfil del equipo',
                state: 'ready',
                detail: 'C2 fijo · 1 tecla ON',
            },
        ],
    });
});
