// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Centro publico de instalacion', () => {
    test('renderiza preset de operador bloqueado y actualiza la ruta preparada', async ({
        page,
    }) => {
        await page.route(/\/app-downloads\/stable\/operator\/win\/TurneroOperadorSetup\.exe$/i, async (route) => {
            await route.fulfill({
                status: 404,
                body: '',
            });
        });
        await page.route(/\/app-downloads\/stable\/sala-tv\/android\/TurneroSalaTV\.apk$/i, async (route) => {
            await route.fulfill({
                status: 200,
                body: 'apk',
            });
        });
        await page.route(/\/operador-turnos\.html(\?.*)?$/i, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: '<!doctype html><title>Operador</title>',
            });
        });
        await page.route(/\/sala-turnos\.html(\?.*)?$/i, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: '<!doctype html><title>Sala TV</title>',
            });
        });

        await page.goto(
            '/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
        );

        await expect(page.locator('h1')).toContainText(
            'Prepara cada equipo'
        );
        await expect(page.locator('#appDownloadsResultTitle')).toHaveText(
            'Operador'
        );
        await expect(page.locator('#appDownloadsPreparedUrl')).toContainText(
            'station=c2'
        );
        await expect(page.locator('#appDownloadsPreparedUrl')).toContainText(
            'one_tap=1'
        );
        await expect(page.locator('#appDownloadsSetupTitle')).toContainText(
            'Falta publicación o ruta'
        );
        await expect(page.locator('#appDownloadsSetupChecks')).toContainText(
            'Publicación pendiente'
        );

        await page.locator('#appDownloadsSurface').selectOption('sala_tv');
        await expect(page.locator('#appDownloadsResultTitle')).toHaveText(
            'Sala TV'
        );
        await expect(page.locator('#appDownloadsTargetLabel')).toContainText(
            'Android TV APK'
        );
        await expect(page.locator('#appDownloadsSetupTitle')).toContainText(
            'Listo para instalación'
        );
        await expect(page.locator('#appDownloadsSetupChecks')).toContainText(
            'TCL C655'
        );
    });
});
