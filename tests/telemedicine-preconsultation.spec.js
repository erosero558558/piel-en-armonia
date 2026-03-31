// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
} = require('./helpers/public-v6');

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
    'base64'
);

test.describe('Telemedicine pre-consultation page', () => {
    test('loads appointment context from the telemedicine pre-consultation endpoint', async ({
        page,
    }) => {
        await page.route(
            '**/api.php?resource=telemedicine-preconsultation&token=tok_tele_pre_001',
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            appointment: {
                                id: 501,
                                patientName: 'Lucia Telemed',
                                doctorName: 'Dra. Rosero',
                                serviceName: 'Teleconsulta de control',
                                date: '2026-04-06',
                                time: '09:20',
                                channelLabel: 'Video seguro',
                            },
                            preConsultation: {
                                status: 'submitted',
                                statusLabel: 'Pre-consulta enviada',
                                concern: 'Hoy la lesión se ve más roja.',
                                photoCount: 1,
                            },
                            roomUrl:
                                '/es/telemedicina/sala/index.html?token=tok_tele_pre_001',
                        },
                    }),
                });
            }
        );

        await gotoPublicRoute(
            page,
            '/es/telemedicina/pre-consulta/?token=tok_tele_pre_001'
        );

        await expect(page.locator('body')).toHaveAttribute(
            'data-public-template-id',
            'telemedicine_preconsultation_v6'
        );
        await expectNoLegacyPublicShell(page);
        await expect(
            page.locator('[data-tele-pre-field="patient"]')
        ).toContainText('Lucia Telemed');
        await expect(
            page.locator('[data-tele-pre-field="doctor"]')
        ).toContainText('Dra. Rosero');
        await expect(
            page.locator('[data-tele-pre-field="channel"]')
        ).toContainText('Video seguro');
        await expect(
            page.locator('[data-tele-pre-history-status]')
        ).toContainText('Pre-consulta enviada');
        await expect(page.locator('[data-tele-pre-room-link]')).toHaveAttribute(
            'href',
            '/es/telemedicina/sala/index.html?token=tok_tele_pre_001'
        );
    });

    test('submits concern and photos before entering the teleconsultation room', async ({
        page,
    }) => {
        let postCount = 0;

        await page.route(
            '**/api.php?resource=telemedicine-preconsultation&token=tok_tele_pre_002',
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            appointment: {
                                id: 502,
                                patientName: 'Ana Perez',
                                doctorName: 'Dra. Narvaez',
                                serviceName: 'Teleconsulta de seguimiento',
                                date: '2026-04-07',
                                time: '10:40',
                                channelLabel: 'Video seguro',
                            },
                            preConsultation: null,
                            roomUrl:
                                '/es/telemedicina/sala/index.html?token=tok_tele_pre_002',
                        },
                    }),
                });
            }
        );

        await page.route(
            '**/api.php?resource=telemedicine-preconsultation',
            async (route) => {
                if (route.request().method() !== 'POST') {
                    await route.fallback();
                    return;
                }

                postCount += 1;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            appointment: {
                                id: 502,
                                patientName: 'Ana Perez',
                                doctorName: 'Dra. Narvaez',
                                serviceName: 'Teleconsulta de seguimiento',
                                date: '2026-04-07',
                                time: '10:40',
                                channelLabel: 'Video seguro',
                            },
                            preConsultation: {
                                status: 'submitted',
                                statusLabel: 'Pre-consulta enviada',
                                concern: 'La lesión amaneció más inflamada.',
                                photoCount: 1,
                                hasNewLesion: true,
                            },
                            roomUrl:
                                '/es/telemedicina/sala/index.html?token=tok_tele_pre_002',
                            message:
                                'Pre-consulta guardada. El médico la verá antes de entrar a la teleconsulta.',
                        },
                    }),
                });
            }
        );

        await gotoPublicRoute(
            page,
            '/es/telemedicina/pre-consulta/?token=tok_tele_pre_002'
        );

        await page
            .locator('[data-tele-pre-concern]')
            .fill('La lesión amaneció más inflamada.');
        await page.locator('[data-tele-pre-new-lesion]').check();
        await page.locator('[data-tele-pre-photos]').setInputFiles([
            {
                name: 'lesion.png',
                mimeType: 'image/png',
                buffer: tinyPng,
            },
        ]);

        await expect(page.locator('[data-tele-pre-files] li')).toHaveCount(1);
        await page.locator('[data-tele-pre-submit]').click();

        await expect(page.locator('[data-tele-pre-status]')).toContainText(
            'Pre-consulta enviada'
        );
        await expect(page.locator('[data-tele-pre-success]')).toBeVisible();
        await expect(page.locator('[data-tele-pre-history-copy]')).toContainText(
            'La lesión amaneció más inflamada.'
        );
        await expect(page.locator('[data-tele-pre-room-link]')).toHaveAttribute(
            'href',
            '/es/telemedicina/sala/index.html?token=tok_tele_pre_002'
        );
        expect(postCount).toBe(1);
    });
});
