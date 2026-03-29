// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Preconsulta publica V6', () => {
    test('renders a monolingual intake surface and submits the structured payload', async ({
        page,
    }) => {
        const uploads = [];
        let patientCasePayload = null;

        await page.route('**/api.php?resource=transfer-proof', async (route) => {
            const index = uploads.length + 1;
            uploads.push(route.request().method());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        transferProofPath: `/uploads/transfer-proofs/preconsulta-${index}.jpg`,
                        transferProofName: `preconsulta-${index}.jpg`,
                        transferProofUrl: `https://pielarmonia.com/uploads/transfer-proofs/preconsulta-${index}.jpg`,
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-cases', async (route) => {
            patientCasePayload = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        caseId: 'pc-preconsulta-001',
                        stage: 'lead_captured',
                        owner: 'frontdesk',
                        callbackId: 991,
                        created: true,
                        whatsapp: '+593999111222',
                    },
                }),
            });
        });

        await gotoPublicRoute(page, '/es/pre-consulta/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('[data-v6-pre-hero]')).toBeVisible();
        await expect(page.locator('[data-v6-pre-reasons]')).toBeVisible();
        await expect(page.locator('[data-v6-pre-form-card]')).toBeVisible();
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        await page.fill('#pre-name', 'Paciente Demo');
        await page.fill('#pre-whatsapp', '+593999111222');
        await page.selectOption('#pre-skin-type', 'sensible');
        await page.fill(
            '#pre-condition',
            'Mancha nueva con picor leve desde hace dos semanas en mejilla derecha.'
        );
        await page.setInputFiles('#pre-photos', {
            name: 'lesion.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-content'),
        });
        await page.check('#pre-consent');
        await page.click('[data-preconsultation-submit]');

        await expect(page.locator('[data-preconsultation-status]')).toContainText(
            'Preconsulta enviada'
        );
        await expect(page.locator('[data-preconsultation-success]')).toBeVisible();
        await expect(page.locator('[data-preconsultation-success-body]')).toContainText(
            'pc-preconsulta-001'
        );
        await expect(page.locator('[data-preconsultation-photo-list] li')).toHaveCount(0);

        expect(uploads).toHaveLength(1);
        expect(patientCasePayload).toMatchObject({
            name: 'Paciente Demo',
            whatsapp: '+593999111222',
            skinType: 'sensible',
            privacyConsent: true,
        });
        expect(Array.isArray(patientCasePayload.casePhotoPaths)).toBe(true);
        expect(patientCasePayload.casePhotoPaths).toEqual([
            '/uploads/transfer-proofs/preconsulta-1.jpg',
        ]);
        expect(patientCasePayload.casePhotoNames).toEqual(['preconsulta-1.jpg']);
    });
});
