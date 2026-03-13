// @ts-check
const { test, expect } = require('@playwright/test');

function bootUrl() {
    return '/src/apps/turnero-desktop/src/renderer/boot.html';
}

async function mockBootBridge(page, snapshotOverrides = {}, options = {}) {
    const snapshot = {
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            launchMode: 'fullscreen',
            stationMode: 'locked',
            stationConsultorio: 1,
            oneTap: false,
            autoStart: true,
            updateChannel: 'pilot',
        },
        status: {
            phase: 'settings',
            message: 'Configura este equipo',
        },
        surfaceLabel: 'Operador',
        surfaceDesktopLabel: 'Turnero Operador',
        packaged: true,
        platform: 'win32',
        version: '0.1.0',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
        installGuideUrl:
            'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c1&lock=1&one_tap=0',
        configPath:
            'C:\\Users\\Ernesto\\AppData\\Roaming\\turnero-desktop\\turnero-desktop.json',
        firstRun: true,
        settingsMode: true,
        ...snapshotOverrides,
    };

    await page.addInitScript(
        ({ initialSnapshot, delayMs }) => {
            const state = {
                runCalls: [],
                saveCalls: [],
                openCalls: 0,
                retryCalls: 0,
                copied: [],
            };

            Object.defineProperty(window.navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText(text) {
                        state.copied.push(String(text || ''));
                        return Promise.resolve();
                    },
                },
            });

            function buildReport(snapshot, payload) {
                if (!snapshot.packaged) {
                    return {
                        state: 'warning',
                        title: 'Equipo casi listo',
                        summary:
                            'La app ya puede abrir, pero el checklist remoto completo se valida solo en desktop instalada.',
                        checks: [
                            {
                                id: 'runtime',
                                label: 'Modo de la app',
                                state: 'warning',
                                detail: 'Modo desarrollo o fallback local; el preflight remoto completo se activa solo en desktop instalada',
                            },
                            {
                                id: 'surface',
                                label: 'Superficie remota',
                                state: 'warning',
                                detail: 'Se valida solo en desktop instalada: https://pielarmonia.com/operador-turnos.html',
                            },
                            {
                                id: 'health',
                                label: 'API de salud',
                                state: 'warning',
                                detail: 'Se valida solo en desktop instalada: https://pielarmonia.com/api.php?resource=health',
                            },
                        ],
                    };
                }

                if (String(payload?.baseUrl || '').includes('offline')) {
                    return {
                        state: 'danger',
                        title: 'Equipo no listo',
                        summary:
                            'Corrige primero los checks en rojo antes de abrir la superficie operativa.',
                        checks: [
                            {
                                id: 'surface',
                                label: 'Superficie remota',
                                state: 'danger',
                                detail: 'No responde (HTTP 503)',
                            },
                        ],
                    };
                }

                return {
                    state: 'ready',
                    title: 'Equipo listo',
                    summary:
                        'Servidor, superficie y perfil del equipo responden correctamente.',
                    checks: [
                        {
                            id: 'profile',
                            label: 'Perfil del equipo',
                            state: 'ready',
                            detail: 'C1 fijo · 1 tecla OFF',
                        },
                        {
                            id: 'surface',
                            label: 'Superficie remota',
                            state: 'ready',
                            detail: 'Disponible (200)',
                        },
                        {
                            id: 'health',
                            label: 'API de salud',
                            state: 'ready',
                            detail: 'Health OK (200)',
                        },
                    ],
                };
            }

            window.__turneroBootBridgeState = state;
            window.turneroDesktop = {
                getRuntimeSnapshot: () => Promise.resolve(initialSnapshot),
                onBootStatus: () => () => {},
                retryLoad: () => {
                    state.retryCalls += 1;
                    return Promise.resolve(true);
                },
                runPreflight: (payload) =>
                    new Promise((resolve) => {
                        state.runCalls.push(payload);
                        window.setTimeout(() => {
                            resolve(buildReport(initialSnapshot, payload));
                        }, delayMs);
                    }),
                saveRuntimeConfig: (payload) => {
                    state.saveCalls.push(payload);
                    return Promise.resolve({
                        ...initialSnapshot,
                        config: {
                            ...initialSnapshot.config,
                            ...payload,
                        },
                    });
                },
                openSurface: () => {
                    state.openCalls += 1;
                    return Promise.resolve(true);
                },
            };
        },
        {
            initialSnapshot: snapshot,
            delayMs: Number(options.delayMs || 90),
        }
    );
}

test.describe('Turnero Desktop boot', () => {
    test('desktop empaquetado exige preflight vigente antes de guardar y abrir', async ({
        page,
    }) => {
        await mockBootBridge(page, {
            packaged: true,
            firstRun: true,
            settingsMode: true,
        });

        await page.goto(bootUrl());
        await expect(page.locator('#bootSaveBtn')).toBeDisabled();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Checklist vigente'
        );
        await expect(page.locator('#bootSaveBtn')).toBeEnabled();

        await page.locator('#bootConfigBaseUrl').fill('https://offline.test');
        await page.locator('#bootConfigProfile').focus();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Corrige los checks en rojo'
        );
        await expect(page.locator('#bootSaveBtn')).toBeDisabled();
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__turneroBootBridgeState.saveCalls.length
                )
            )
            .toBe(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(0);

        await page
            .locator('#bootConfigBaseUrl')
            .fill('https://pielarmonia.com');
        await page.locator('#bootConfigProfile').focus();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Checklist vigente'
        );
        await expect(page.locator('#bootSaveBtn')).toBeEnabled();

        await page.locator('#bootSaveBtn').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__turneroBootBridgeState.saveCalls.length
                )
            )
            .toBe(1);
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(1);
    });

    test('modo desarrollo no bloquea abrir la superficie', async ({ page }) => {
        await mockBootBridge(
            page,
            {
                packaged: false,
                firstRun: false,
                settingsMode: false,
            },
            { delayMs: 20 }
        );

        await page.goto(bootUrl());
        await expect(page.locator('#bootOpenSurfaceBtn')).toBeVisible();
        await expect(page.locator('#bootOpenSurfaceBtn')).toBeEnabled();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'desktop instalada'
        );

        await page.locator('#bootOpenSurfaceBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(1);
    });

    test('retry pendiente deja visible countdown y permite adelantar la carga', async ({
        page,
    }) => {
        await mockBootBridge(page, {
            firstRun: false,
            settingsMode: true,
            status: {
                phase: 'retry',
                message:
                    'No se pudo abrir la superficie operator. Reintentando en 5s.',
            },
            retry: {
                active: true,
                attempt: 2,
                delayMs: 5000,
                nextRetryAt: new Date(Date.now() + 5000).toISOString(),
                remainingMs: 5000,
                reason: 'No se pudo abrir la superficie operator',
            },
        });

        await page.goto(bootUrl());
        await expect(page.locator('#bootRetryCard')).toBeVisible();
        await expect(page.locator('#bootRetrySummary')).toContainText(
            'Reintento #2'
        );
        await expect(page.locator('#bootRetryHint')).toContainText(
            'No se pudo abrir la superficie operator'
        );

        await page.locator('#bootRetryBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.retryCalls)
            )
            .toBe(1);
    });

    test('boot deja visible soporte remoto con feed, guia y config local copiables', async ({
        page,
    }) => {
        await mockBootBridge(page, {
            config: {
                surface: 'operator',
                baseUrl: 'https://pielarmonia.com',
                launchMode: 'windowed',
                stationMode: 'locked',
                stationConsultorio: 2,
                oneTap: true,
                autoStart: false,
                updateChannel: 'pilot',
            },
            installGuideUrl:
                'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
        });

        await page.goto(bootUrl());
        await expect(page.locator('#bootSupportTitle')).toContainText(
            'Datos listos para soporte remoto'
        );
        await expect(page.locator('#bootSupportProfile')).toContainText(
            'Operador C2 fijo · 1 tecla ON'
        );
        await expect(page.locator('#bootSupportProvisioning')).toContainText(
            'Ventana · Autoarranque OFF'
        );
        await expect(page.locator('#bootSupportFeedUrl')).toContainText(
            'latest.yml'
        );
        await expect(page.locator('#bootSupportGuideUrl')).toContainText(
            'station=c2'
        );
        await expect(page.locator('#bootSupportGuideUrl')).toContainText(
            'one_tap=1'
        );
        await expect(page.locator('#bootSupportConfigPath')).toContainText(
            'turnero-desktop.json'
        );

        await page.locator('#bootCopyFeedBtn').click();
        await page.locator('#bootCopyGuideBtn').click();
        await page.locator('#bootCopyConfigBtn').click();

        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.copied)
            )
            .toEqual([
                'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
                'C:\\Users\\Ernesto\\AppData\\Roaming\\turnero-desktop\\turnero-desktop.json',
            ]);
    });

    test('boot deriva feed y guia desde la configuracion local cuando el snapshot no trae urls resueltas', async ({
        page,
    }) => {
        await mockBootBridge(page, {
            config: {
                surface: 'operator',
                baseUrl: 'https://pielarmonia.com',
                launchMode: 'fullscreen',
                stationMode: 'locked',
                stationConsultorio: 2,
                oneTap: true,
                autoStart: true,
                updateChannel: 'pilot',
            },
            updateMetadataUrl: '',
            installGuideUrl: '',
        });

        await page.goto(bootUrl());
        await expect(page.locator('#bootSupportFeedUrl')).toContainText(
            'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml'
        );
        await expect(page.locator('#bootSupportGuideUrl')).toContainText(
            'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
        );
    });
});
