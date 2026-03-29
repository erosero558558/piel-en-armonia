// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF/gLRRHFqWQAAAABJRU5ErkJggg==',
    'base64'
);

test.describe('Public preconsultation page', () => {
    test('page publishes the intake narrative, anchors and site search entry', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/pre-consulta/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(page.locator('h1')).toContainText('Preconsulta digital');
        await expect(page.locator('[data-v6-preconsultation-card]')).toHaveCount(
            3
        );
        await expect(page.locator('[data-v6-preconsultation-step]')).toHaveCount(
            3
        );
        await expect(page.locator('[data-v6-preconsultation]')).toContainText(
            'lead_captured'
        );
        await expect(
            page.locator('[data-v6-preconsultation-hero]')
        ).toContainText('Hasta 3');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        await menuButton.click();
        await expect(panel).toBeVisible();

        await panel.getByRole('link', { name: 'Que pasa despues' }).click();
        await expect(page).toHaveURL(/#v6-preconsulta-next$/);

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('preconsulta');

        const result = page.locator(
            '[data-v6-search-results] a[href="/es/pre-consulta/"]'
        );
        await expect(result).toBeVisible();
        await expect(result).toContainText('Preconsulta digital');
    });

    test('form submits multipart intake data and shows the returned case id', async ({
        page,
    }) => {
        /** @type {{method:string, contentType:string, body:string}|null} */
        let capturedRequest = null;

        await page.route('**/api.php?resource=flow-os-intake', async (route) => {
            capturedRequest = {
                method: route.request().method(),
                contentType: route.request().headers()['content-type'] || '',
                body: route.request().postData() || '',
            };

            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        caseId: 'pc_demo_001',
                        photoCount: 1,
                        message:
                            'Preconsulta recibida. Frontdesk le escribira por WhatsApp.',
                    },
                }),
            });
        });

        await gotoPublicRoute(page, '/es/pre-consulta/');
        await waitForShellV6Runtime(page);

        await page.locator('input[name="nombre"]').fill('Paciente Journey');
        await page.locator('input[name="whatsapp"]').fill('0991234567');
        await page.locator('select[name="tipo_piel"]').selectOption('mixta');
        await page
            .locator('textarea[name="condicion"]')
            .fill('Manchas y picazon que cambiaron esta semana.');
        await page.locator('input[name="fotos[]"]').setInputFiles({
            name: 'lesion.png',
            mimeType: 'image/png',
            buffer: TINY_PNG,
        });

        await expect(page.locator('[data-preconsultation-files]')).toContainText(
            '1 foto lista para enviar: lesion.png'
        );

        await page
            .locator('[data-preconsultation-form] button[type="submit"]')
            .click();

        await expect(page.locator('[data-preconsultation-status]')).toContainText(
            'Preconsulta recibida. Frontdesk le escribira por WhatsApp.'
        );
        await expect(
            page.locator('[data-preconsultation-success]')
        ).toBeVisible();
        await expect(
            page.locator('[data-preconsultation-case-id]')
        ).toContainText('Case ID: pc_demo_001.');

        await expect
            .poll(() => capturedRequest !== null, { timeout: 5000 })
            .toBeTruthy();
        expect(capturedRequest?.method).toBe('POST');
        expect(capturedRequest?.contentType || '').toContain(
            'multipart/form-data'
        );
        expect(capturedRequest?.body || '').toContain('name="nombre"');
        expect(capturedRequest?.body || '').toContain('Paciente Journey');
        expect(capturedRequest?.body || '').toContain('name="whatsapp"');
        expect(capturedRequest?.body || '').toContain('0991234567');
        expect(capturedRequest?.body || '').toContain('name="condicion"');
        expect(capturedRequest?.body || '').toContain(
            'Manchas y picazon que cambiaron esta semana.'
        );
        expect(capturedRequest?.body || '').toContain('name="fotos[]"');
        expect(capturedRequest?.body || '').toContain('filename="lesion.png"');
    });
});
