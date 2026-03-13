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

test('desktop boot status contract preserves lifecycle copy for boot settings and ready states', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/boot-status-contract.mjs'
    );

    assert.deepEqual(contract.createInitialDesktopBootStatus(), {
        level: 'info',
        phase: 'boot',
        message: 'Inicializando shell desktop...',
    });
    assert.deepEqual(
        contract.buildDesktopBootEntryStatus(
            { surface: 'operator' },
            {
                firstRun: true,
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
            }
        ),
        {
            level: 'info',
            phase: 'boot',
            message: 'operator listo para configuracion inicial.',
            configPath:
                'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
        }
    );
    assert.deepEqual(
        contract.buildDesktopSettingsStatus(
            { surface: 'operator' },
            {
                firstRun: false,
                reason: 'shortcut',
            }
        ),
        {
            level: 'info',
            phase: 'settings',
            message: 'Configuracion del equipo abierta (shortcut).',
        }
    );
    assert.deepEqual(
        contract.buildDesktopReadyStatus(
            { surface: 'operator' },
            {
                url: 'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
            }
        ),
        {
            level: 'info',
            phase: 'ready',
            message: 'operator conectado correctamente.',
            url: 'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
        }
    );
});

test('desktop boot status contract preserves retry loading blocked and updater copy', async () => {
    const contract = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/boot-status-contract.mjs'
    );

    assert.deepEqual(
        contract.buildDesktopLoadingStatus(
            {
                surface: 'operator',
                baseUrl: 'https://pielarmonia.com',
            },
            {
                source: 'manual-open',
            }
        ),
        {
            level: 'info',
            phase: 'loading',
            message:
                'Conectando operator a https://pielarmonia.com (manual-open)',
        }
    );
    assert.deepEqual(
        contract.buildDesktopRetryStatus(
            'No se pudo abrir la superficie operator',
            {
                delayMs: 5000,
            }
        ),
        {
            level: 'warn',
            phase: 'retry',
            message:
                'No se pudo abrir la superficie operator. Reintentando en 5s.',
        }
    );
    assert.deepEqual(contract.buildDesktopBlockedStatus(), {
        level: 'warn',
        phase: 'blocked',
        message: 'Navegacion externa bloqueada por el shell desktop.',
    });
    assert.deepEqual(
        contract.buildDesktopConfigSavedStatus({ surface: 'kiosk' }),
        {
            level: 'info',
            phase: 'settings',
            message: 'Configuracion guardada para kiosk.',
        }
    );
    assert.deepEqual(contract.buildDesktopUpdateDisabledStatus(), {
        level: 'info',
        phase: 'update',
        message: 'Auto-update desactivado en modo desarrollo.',
    });
    assert.deepEqual(
        contract.buildDesktopUpdateCheckFailedStatus(
            new Error('network timeout')
        ),
        {
            level: 'warn',
            phase: 'update',
            message: 'No se pudo comprobar update: network timeout',
        }
    );
});
