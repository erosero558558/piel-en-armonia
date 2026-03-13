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

test('desktop navigation guard contract preserves shortcut and blocked-navigation decisions', async () => {
    const policy = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/navigation-guard-policy.mjs'
    );

    assert.equal(
        policy.shouldOpenDesktopSettingsShortcut({
            type: 'keydown',
            key: 'F10',
        }),
        true
    );
    assert.equal(
        policy.shouldOpenDesktopSettingsShortcut({
            type: 'keydown',
            key: ',',
            control: true,
        }),
        true
    );
    assert.equal(
        policy.shouldOpenDesktopSettingsShortcut({
            type: 'keyup',
            key: 'F10',
        }),
        false
    );
    assert.deepEqual(
        policy.getDesktopBlockedNavigationDecision({
            targetUrl: 'https://example.com/operador-turnos.html',
            isAllowedNavigation: false,
        }),
        {
            preventDefault: true,
            status: {
                level: 'warn',
                phase: 'blocked',
                message: 'Navegacion externa bloqueada por el shell desktop.',
            },
        }
    );
    assert.equal(
        policy.getDesktopBlockedNavigationDecision({
            targetUrl: 'https://pielarmonia.com/operador-turnos.html',
            isAllowedNavigation: true,
        }),
        null
    );
});

test('desktop navigation guard contract preserves recovery decisions for process crashes and load failures', async () => {
    const policy = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/navigation-guard-policy.mjs'
    );

    assert.deepEqual(
        policy.getDesktopRenderProcessGoneRecovery({
            reason: 'crashed',
        }),
        {
            logMessage: 'render-process-gone: crashed',
            retryReason: 'La aplicacion remota se cerro de forma inesperada',
        }
    );
    assert.deepEqual(
        policy.getDesktopDidFailLoadRecovery({
            errorCode: -105,
            errorDescription: 'NAME_NOT_RESOLVED',
            validatedUrl: 'https://pielarmonia.com/operador-turnos.html',
            isMainFrame: true,
            isAllowedNavigation: true,
            config: {
                surface: 'operator',
            },
        }),
        {
            logMessage:
                'did-fail-load -105: NAME_NOT_RESOLVED (https://pielarmonia.com/operador-turnos.html)',
            retryReason:
                'La superficie operator no pudo cargar (NAME_NOT_RESOLVED)',
        }
    );
    assert.equal(
        policy.getDesktopDidFailLoadRecovery({
            errorCode: -105,
            errorDescription: 'NAME_NOT_RESOLVED',
            validatedUrl: 'https://pielarmonia.com/operador-turnos.html',
            isMainFrame: false,
            isAllowedNavigation: true,
            config: {
                surface: 'operator',
            },
        }),
        null
    );
});

test('desktop navigation guard contract preserves ready decision and presentation mode', async () => {
    const policy = await importRepoModule(
        'src/apps/turnero-desktop/src/runtime/navigation-guard-policy.mjs'
    );

    assert.deepEqual(
        policy.getDesktopDidFinishLoadDecision({
            currentUrl:
                'https://pielarmonia.com/kiosco-turnos.html?station=1#ready',
            isAllowedNavigation: true,
            config: {
                surface: 'kiosk',
                launchMode: 'fullscreen',
            },
        }),
        {
            transition: {
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
                    message: 'kiosk conectado correctamente.',
                    url: 'https://pielarmonia.com/kiosco-turnos.html?station=1#ready',
                },
            },
            presentation: 'kiosk',
        }
    );
    assert.equal(
        policy.getDesktopDidFinishLoadDecision({
            currentUrl: 'https://example.com/operador-turnos.html',
            isAllowedNavigation: false,
            config: {
                surface: 'operator',
                launchMode: 'fullscreen',
            },
        }),
        null
    );
});
