// @ts-check
const { test, expect } = require('@playwright/test');

const SESSION = {
    token: 'header.payload.signature',
    expiresAt: '2026-04-06T00:00:00Z',
    patient: {
        patientId: 'pt_lucia_001',
        patientCaseId: 'pc_lucia_001',
        name: 'Lucia Portal',
        phoneMasked: '******4567',
    },
};

test.describe('Patient portal digital consent page', () => {
    test('renders the consent summary, captures touch signature, and downloads the signed PDF with bearer auth', async ({
        page,
    }) => {
        let signRequest = null;
        const documentAuthorizations = [];

        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-consent', async (route) => {
            if (route.request().method() === 'POST') {
                signRequest = {
                    headers: route.request().headers(),
                    body: JSON.parse(route.request().postData() || '{}'),
                };

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
                            consent: {
                                status: 'signed',
                                statusLabel: 'Firmado y archivado',
                                title: 'Consentimiento informado HCU-form.024/2008',
                                serviceLabel: 'Dermatología ambulatoria',
                                procedureName: 'Aplicación de toxina botulínica',
                                diagnosisLabel: 'Rosácea inflamatoria en seguimiento.',
                                durationEstimate: '20 minutos',
                                procedureWhatIsIt:
                                    'Aplicación controlada de toxina botulínica en puntos definidos.',
                                procedureHowItIsDone:
                                    'Se limpia la zona, se marca el trayecto y se infiltra en consultorio.',
                                benefits: 'Mejoría funcional y estética según criterio médico.',
                                frequentRisks: 'Dolor leve, edema transitorio y hematoma pequeño.',
                                rareSeriousRisks: 'Ptosis, asimetría o reacción alérgica.',
                                alternatives: 'Observación clínica o manejo no infiltrativo.',
                                postProcedureCare: 'Evitar masaje local y seguir control indicado.',
                                packetId: 'consent_portal_001',
                                sessionId: 'chs_portal_consent_001',
                                caseId: 'pc_lucia_001',
                                patientName: 'Lucia Portal',
                                patientDocumentNumber: '0102030405',
                                doctorName: 'Dra Ana Rosero',
                                signedAtLabel: 'mar 31 mar 2026 · 09:15',
                                snapshotId: 'consent-form-001',
                                pdfAvailable: true,
                                pdfFileName: 'consentimiento-botox.pdf',
                                downloadUrl:
                                    '/api.php?resource=patient-portal-document&type=consent&id=consent-form-001',
                            },
                        },
                    }),
                });
                return;
            }

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
                        consent: {
                            status: 'pending',
                            statusLabel: 'Pendiente de firma',
                            readyForSignature: true,
                            title: 'Consentimiento informado HCU-form.024/2008',
                            serviceLabel: 'Dermatología ambulatoria',
                            procedureName: 'Aplicación de toxina botulínica',
                            diagnosisLabel: 'Rosácea inflamatoria en seguimiento.',
                            durationEstimate: '20 minutos',
                            procedureWhatIsIt:
                                'Aplicación controlada de toxina botulínica en puntos definidos.',
                            procedureHowItIsDone:
                                'Se limpia la zona, se marca el trayecto y se infiltra en consultorio.',
                            benefits: 'Mejoría funcional y estética según criterio médico.',
                            frequentRisks: 'Dolor leve, edema transitorio y hematoma pequeño.',
                            rareSeriousRisks: 'Ptosis, asimetría o reacción alérgica.',
                            alternatives: 'Observación clínica o manejo no infiltrativo.',
                            postProcedureCare: 'Evitar masaje local y seguir control indicado.',
                            packetId: 'consent_portal_001',
                            sessionId: 'chs_portal_consent_001',
                            caseId: 'pc_lucia_001',
                            patientName: 'Lucia Portal',
                            patientDocumentNumber: '0102030405',
                            doctorName: 'Dra Ana Rosero',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-portal-document&type=consent**', async (route) => {
            documentAuthorizations.push(route.request().headers().authorization || '');
            await route.fulfill({
                status: 200,
                contentType: 'application/pdf',
                headers: {
                    'content-disposition': 'inline; filename="consentimiento-botox.pdf"',
                },
                body: '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
            });
        });

        await page.goto('/es/portal/consentimiento/');

        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-consent-title]')).toContainText(
            'Consentimiento informado HCU-form.024/2008'
        );
        await expect(page.locator('[data-portal-consent-procedure]')).toContainText(
            'Aplicación de toxina botulínica'
        );

        const canvas = page.locator('[data-portal-consent-signature]');
        await canvas.evaluate((node) => {
            if (!(node instanceof HTMLCanvasElement)) {
                throw new Error('Signature canvas is missing');
            }

            const rect = node.getBoundingClientRect();
            const points = [
                { x: rect.left + 24, y: rect.top + 26, type: 'mousedown' },
                { x: rect.left + 140, y: rect.top + 90, type: 'mousemove' },
                { x: rect.left + 220, y: rect.top + 60, type: 'mousemove' },
                { x: rect.left + 220, y: rect.top + 60, type: 'mouseup' },
            ];

            points.forEach((point) => {
                node.dispatchEvent(
                    new MouseEvent(point.type, {
                        bubbles: true,
                        cancelable: true,
                        clientX: point.x,
                        clientY: point.y,
                    })
                );
            });
        });

        await expect(page.locator('[data-portal-consent-signature-state]')).toContainText('Firma lista');
        await page.locator('input[name="accepted"]').check();
        await page.locator('[data-portal-consent-submit]').click();

        await expect.poll(() => signRequest !== null).toBeTruthy();
        expect(signRequest.headers.authorization).toBe('Bearer header.payload.signature');
        expect(signRequest.body.packetId).toBe('consent_portal_001');
        expect(signRequest.body.patientName).toBe('Lucia Portal');
        expect(signRequest.body.patientDocumentNumber).toBe('0102030405');
        expect(signRequest.body.accepted).toBe(true);
        expect(String(signRequest.body.signatureDataUrl || '')).toMatch(/^data:image\/png;base64,/);

        await expect(page.locator('[data-portal-consent-signed]')).toBeVisible();
        await expect(page.locator('[data-portal-consent-download]')).toBeVisible();

        await page.locator('[data-portal-consent-download]').click();

        await expect.poll(() => documentAuthorizations.length).toBe(1);
        expect(documentAuthorizations[0]).toBe('Bearer header.payload.signature');
    });

    test('shows a calm empty state when there is no pending consent for the patient', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-consent', async (route) => {
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
                        consent: null,
                    },
                }),
            });
        });

        await page.goto('/es/portal/consentimiento/');

        await expect(page.locator('[data-portal-consent-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-consent-empty]')).toContainText(
            'No tienes un consentimiento activo para firmar'
        );
    });
});
