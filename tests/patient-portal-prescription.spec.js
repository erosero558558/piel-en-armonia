// @ts-check
const { test, expect } = require('@playwright/test');

const SESSION = {
    token: 'header.payload.signature',
    expiresAt: '2026-04-06T00:00:00Z',
    patient: {
        patientId: 'pt_lucia_001',
        name: 'Lucia Portal',
        phoneMasked: '******4567',
    },
};

test.describe('Patient portal active prescription page', () => {
    test('renders medications, verification QR, and downloads the PDF with the session bearer token', async ({
        page,
    }) => {
        const downloadAuthorizations = [];

        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-prescription', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        authenticated: true,
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                        },
                        prescription: {
                            status: 'available',
                            statusLabel: 'Activa',
                            title: 'Mi receta activa',
                            description:
                                'Esta es tu última receta emitida. Si tu consulta más reciente generó cambios, la actualización aparecerá aquí cuando quede firmada.',
                            documentId: 'rx_portal_002',
                            fileName: 'receta-rx_portal_002.pdf',
                            downloadUrl:
                                '/api.php?resource=patient-portal-document&type=prescription&id=rx_portal_002',
                            issuedAtLabel: 'Emitido el jue 12 mar 2026',
                            doctorName: 'Dra Ana Rosero',
                            doctorSpecialty: 'Dermatología',
                            doctorMsp: '12345',
                            serviceName: 'Consulta Dermatológica',
                            consultationDateLabel: 'jue 12 mar 2026',
                            medicationCountLabel: '1 medicamento activo',
                            hasPendingUpdate: true,
                            pendingUpdateLabel:
                                'Hay una actualización clínica en preparación desde tu atención más reciente.',
                            verificationCode: 'RX-PORTAL-002',
                            verificationUrl:
                                'https://pielarmonia.com/es/verificar-documento/?token=verify_token_001',
                            verificationQrImageUrl:
                                'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https%3A%2F%2Fpielarmonia.com%2Fes%2Fverificar-documento%2F%3Ftoken%3Dverify_token_001',
                            medications: [
                                {
                                    id: 'rx-item-1',
                                    medication: 'Doxiciclina 100 mg',
                                    dose: '1 cápsula',
                                    frequency: 'cada 12 horas',
                                    duration: '14 días',
                                    instructions: 'Tomar después del desayuno y la cena.',
                                    chips: ['1 cápsula', 'cada 12 horas', '14 días'],
                                },
                            ],
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-portal-document**', async (route) => {
            downloadAuthorizations.push(route.request().headers().authorization || '');
            await route.fulfill({
                status: 200,
                contentType: 'application/pdf',
                headers: {
                    'content-disposition': 'inline; filename="receta-rx_portal_002.pdf"',
                },
                body: '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
            });
        });

        await page.goto('/es/portal/receta/');

        await expect(page.locator('[data-portal-rx-summary-card]')).toBeVisible();
        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-rx-title]')).toContainText('1 medicamento activo');
        await expect(page.locator('[data-portal-rx-status]')).toContainText('Activa');
        await expect(page.locator('[data-portal-rx-doctor]')).toContainText('Dra Ana Rosero');
        await expect(page.locator('[data-portal-rx-issued]')).toContainText('12 mar 2026');
        await expect(page.locator('[data-portal-rx-pending-banner]')).toContainText(
            'actualización clínica en preparación'
        );
        await expect(page.locator('[data-portal-rx-med-card]')).toHaveCount(1);
        await expect(page.locator('[data-portal-rx-med-name]')).toContainText('Doxiciclina 100 mg');
        await expect(page.locator('[data-portal-rx-med-chip]')).toHaveCount(3);
        await expect(page.locator('[data-portal-rx-verification-code]')).toContainText('RX-PORTAL-002');
        await expect(page.locator('[data-portal-rx-verification-link]')).toHaveAttribute(
            'href',
            'https://pielarmonia.com/es/verificar-documento/?token=verify_token_001'
        );
        await expect(page.locator('[data-portal-rx-qr]')).toHaveAttribute(
            'src',
            /api\.qrserver\.com\/v1\/create-qr-code/
        );

        await page.locator('[data-portal-prescription-download]').click();

        await expect.poll(() => downloadAuthorizations.length).toBe(1);
        expect(downloadAuthorizations[0]).toBe('Bearer header.payload.signature');
    });

    test('shows a calm empty state when the patient still has no issued prescription', async ({
        page,
    }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-prescription', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        authenticated: true,
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                        },
                        prescription: {
                            status: 'pending',
                            title: 'Mi receta activa',
                            description:
                                'Tu receta se está terminando de firmar y aparecerá aquí cuando quede lista.',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/receta/');

        await expect(page.locator('[data-portal-rx-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-rx-empty]')).toContainText(
            'Mi receta activa'
        );
        await expect(page.locator('[data-portal-rx-empty]')).toContainText(
            'aparecerá aquí cuando quede lista'
        );
    });
});
