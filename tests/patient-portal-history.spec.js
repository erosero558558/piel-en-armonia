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

test.describe('Patient portal history timeline', () => {
    test('renders document states and downloads PDFs with the active bearer token', async ({ page }) => {
        const downloadAuthorizations = [];

        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-history', async (route) => {
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
                        consultations: [
                            {
                                id: 'case-pc_lucia_003',
                                caseId: 'pc_lucia_003',
                                status: 'completed',
                                statusLabel: 'Atención finalizada',
                                dateLabel: 'mie 18 mar 2026',
                                timeLabel: '16:15',
                                doctorName: 'Dra Ana Rosero',
                                serviceName: 'Control dermatológico',
                                appointmentTypeLabel: 'Consulta presencial',
                                locationLabel: 'Consultorio Aurora Derm',
                                events: [
                                    {
                                        type: 'consultation',
                                        icon: 'visit',
                                        label: 'Consulta por control dermatológico',
                                        meta: 'mie 18 mar 2026 · 16:15',
                                        tone: 'idle',
                                    },
                                    {
                                        type: 'prescription',
                                        icon: 'prescription',
                                        label: 'Receta en preparación',
                                        meta: 'Tu documento está en preparación y aparecerá aquí cuando quede firmado.',
                                        tone: 'warning',
                                    },
                                    {
                                        type: 'certificate',
                                        icon: 'document',
                                        label: 'Certificado listo',
                                        meta: 'Emitido el mie 18 mar 2026',
                                        tone: 'good',
                                    },
                                    {
                                        type: 'photo',
                                        icon: 'photo',
                                        label: 'Foto de control enviada',
                                        meta: 'Rostro · jue 19 mar 2026 · 08:05',
                                        tone: 'good',
                                    },
                                    {
                                        type: 'appointment',
                                        icon: 'calendar',
                                        label: 'Próximo control: jue 2 abr 2099',
                                        meta: 'Consulta Dermatológica · 10:30',
                                        tone: 'warning',
                                    },
                                ],
                                documents: {
                                    prescription: {
                                        type: 'prescription',
                                        title: 'Receta médica',
                                        status: 'pending',
                                        statusLabel: 'Pendiente',
                                        description: 'Tu documento está en preparación y aparecerá aquí cuando quede firmado.',
                                    },
                                    certificate: {
                                        type: 'certificate',
                                        title: 'Certificado médico',
                                        status: 'available',
                                        statusLabel: 'Disponible',
                                        description: 'PDF listo para descargar en un toque.',
                                        downloadUrl: '/api.php?resource=patient-portal-document&type=certificate&id=cert_portal_003',
                                        fileName: 'certificado-AD-2026-00021.pdf',
                                        issuedAtLabel: 'Emitido el mie 18 mar 2026',
                                    },
                                },
                            },
                            {
                                id: 'case-pc_lucia_002',
                                caseId: 'pc_lucia_002',
                                status: 'completed',
                                statusLabel: 'Atención finalizada',
                                dateLabel: 'jue 12 mar 2026',
                                timeLabel: '09:00',
                                doctorName: 'Dra Ana Rosero',
                                serviceName: 'Consulta Dermatológica',
                                appointmentTypeLabel: 'Consulta presencial',
                                locationLabel: 'Consultorio Aurora Derm',
                                events: [
                                    {
                                        type: 'consultation',
                                        icon: 'visit',
                                        label: 'Consulta Dermatológica',
                                        meta: 'jue 12 mar 2026 · 09:00',
                                        tone: 'idle',
                                    },
                                    {
                                        type: 'prescription',
                                        icon: 'prescription',
                                        label: 'Receta lista',
                                        meta: 'Emitido el jue 12 mar 2026',
                                        tone: 'good',
                                    },
                                ],
                                documents: {
                                    prescription: {
                                        type: 'prescription',
                                        title: 'Receta médica',
                                        status: 'available',
                                        statusLabel: 'Disponible',
                                        description: 'PDF listo para descargar en un toque.',
                                        downloadUrl: '/api.php?resource=patient-portal-document&type=prescription&id=rx_portal_002',
                                        fileName: 'receta-rx_portal_002.pdf',
                                        issuedAtLabel: 'Emitido el jue 12 mar 2026',
                                    },
                                    certificate: {
                                        type: 'certificate',
                                        title: 'Certificado médico',
                                        status: 'not_issued',
                                        statusLabel: 'No emitido',
                                        description: 'En esta consulta todavía no se emitió este documento.',
                                    },
                                },
                            },
                        ],
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
                    'content-disposition': 'inline; filename="certificado-AD-2026-00021.pdf"',
                },
                body: '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
            });
        });

        await page.goto('/es/portal/historial/');

        await expect(page.locator('[data-portal-history-feed]')).toBeVisible();
        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-consultation-item]')).toHaveCount(2);
        await expect(page.locator('[data-portal-consultation-item]').nth(0).locator('[data-portal-history-event]')).toHaveCount(5);
        await expect(page.locator('[data-portal-consultation-item]').nth(1).locator('[data-portal-history-event]')).toHaveCount(2);
        await expect(page.getByText('Consulta por control dermatológico', { exact: true })).toBeVisible();
        await expect(page.getByText('Receta en preparación', { exact: true })).toBeVisible();
        await expect(page.getByText('Certificado listo', { exact: true })).toBeVisible();
        await expect(page.getByText('Foto de control enviada', { exact: true })).toBeVisible();
        await expect(page.getByText('Próximo control: jue 2 abr 2099', { exact: true })).toBeVisible();
        await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();
        await expect(page.getByText('No emitido', { exact: true })).toBeVisible();
        await expect(page.locator('[data-portal-document-link]')).toHaveCount(2);

        await page.locator('[data-portal-document-link]').first().click();

        await expect.poll(() => downloadAuthorizations.length).toBe(1);
        expect(downloadAuthorizations[0]).toBe('Bearer header.payload.signature');
    });

    test('shows an empty state when the patient still has no downloadable history', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-history', async (route) => {
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
                        consultations: [],
                    },
                }),
            });
        });

        await page.goto('/es/portal/historial/');

        await expect(page.locator('[data-portal-history-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-history-empty]')).toContainText(
            'Todavía no hay atenciones por mostrar'
        );
    });
});
