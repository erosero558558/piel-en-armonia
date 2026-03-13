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

test('desktop boot lifecycle contract preserves retry scheduling and boot-page transitions', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/boot-lifecycle-state.mjs'
    );

    assert.deepEqual(
        contract.buildDesktopBootPageTransition({
            firstRunPending: true,
            lastBootStatus: {
                level: 'info',
                phase: 'settings',
                message: 'Configura operator antes del primer arranque.',
            },
        }),
        {
            settingsMode: true,
            heartbeatReason: 'first_run',
            status: {
                level: 'info',
                phase: 'settings',
                message: 'Configura operator antes del primer arranque.',
            },
        }
    );

    const retryTransition = contract.buildDesktopRetryTransition({
        retryCount: 1,
        reason: 'No se pudo abrir la superficie operator',
    });

    assert.equal(retryTransition.settingsMode, false);
    assert.equal(retryTransition.delayMs, 5000);
    assert.equal(retryTransition.retryCount, 2);
    assert.equal(retryTransition.retryState.active, true);
    assert.equal(retryTransition.retryState.attempt, 2);
    assert.equal(
        retryTransition.status.message,
        'No se pudo abrir la superficie operator. Reintentando en 5s.'
    );
});

test('desktop boot lifecycle contract preserves loading settings and ready transitions', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/boot-lifecycle-state.mjs'
    );

    assert.deepEqual(
        contract.buildDesktopLoadSurfaceTransition(
            {
                surface: 'operator',
                baseUrl: 'https://pielarmonia.com',
            },
            {
                source: 'settings-open',
            }
        ),
        {
            settingsMode: false,
            status: {
                level: 'info',
                phase: 'loading',
                message:
                    'Conectando operator a https://pielarmonia.com (settings-open)',
            },
        }
    );
    assert.deepEqual(
        contract.buildDesktopOpenSettingsTransition(
            {
                surface: 'kiosk',
            },
            {
                firstRun: true,
                reason: 'shortcut',
            }
        ),
        {
            settingsMode: true,
            status: {
                level: 'info',
                phase: 'settings',
                message: 'Configura kiosk antes del primer arranque.',
            },
        }
    );
    assert.deepEqual(
        contract.buildDesktopReadyTransition(
            {
                surface: 'operator',
            },
            {
                url: 'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
            }
        ),
        {
            firstRunPending: false,
            retryCount: 0,
            retryState: {
                active: false,
                attempt: 0,
                delayMs: 0,
                nextRetryAt: '',
                reason: '',
            },
            status: {
                level: 'info',
                phase: 'ready',
                message: 'operator conectado correctamente.',
                url: 'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
            },
        }
    );
});
