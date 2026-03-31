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

const PNG_PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0WQAAAAASUVORK5CYII=',
    'base64'
);

test.describe('Patient portal photo gallery', () => {
    test('renders visible clinical photos grouped by zone and fetches images with bearer auth', async ({ page }) => {
        const imageAuthorizations = [];

        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-photos', async (route) => {
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
                        gallery: {
                            totalPhotos: 3,
                            bodyZoneCount: 2,
                            latestCreatedAtLabel: 'sab 29 mar 2026 · 08:05',
                            groups: [
                                {
                                    bodyZone: 'rostro',
                                    bodyZoneLabel: 'Rostro',
                                    photoCount: 2,
                                    latestCreatedAtLabel: 'sab 29 mar 2026 · 08:05',
                                    items: [
                                        {
                                            id: 'upload_portal_gallery_001',
                                            fileName: 'rostro-control-1.png',
                                            createdAtLabel: 'sab 29 mar 2026 · 08:05',
                                            imageUrl: '/api.php?resource=patient-portal-photo-file&id=upload_portal_gallery_001',
                                            alt: 'Rostro · sab 29 mar 2026 · 08:05',
                                        },
                                        {
                                            id: 'upload_portal_gallery_003',
                                            fileName: 'rostro-control-2.png',
                                            createdAtLabel: 'vie 21 mar 2026 · 07:45',
                                            imageUrl: '/api.php?resource=patient-portal-photo-file&id=upload_portal_gallery_003',
                                            alt: 'Rostro · vie 21 mar 2026 · 07:45',
                                        },
                                    ],
                                },
                                {
                                    bodyZone: 'cuello',
                                    bodyZoneLabel: 'Cuello',
                                    photoCount: 1,
                                    latestCreatedAtLabel: 'mar 25 mar 2026 · 07:10',
                                    items: [
                                        {
                                            id: 'upload_portal_gallery_002',
                                            fileName: 'cuello-contexto.png',
                                            createdAtLabel: 'mar 25 mar 2026 · 07:10',
                                            imageUrl: '/api.php?resource=patient-portal-photo-file&id=upload_portal_gallery_002',
                                            alt: 'Cuello · mar 25 mar 2026 · 07:10',
                                            photoRoleLabel: 'Contexto',
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-portal-photo-file**', async (route) => {
            imageAuthorizations.push(route.request().headers().authorization || '');
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: PNG_PIXEL,
            });
        });

        await page.goto('/es/portal/fotos/');

        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-photos-total]')).toContainText('3');
        await expect(page.locator('[data-portal-photos-zones]')).toContainText('2');
        await expect(page.locator('[data-portal-photo-group]')).toHaveCount(2);
        await expect(page.getByRole('heading', { name: 'Rostro' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Cuello' })).toBeVisible();
        await expect(page.locator('[data-portal-photo-card]')).toHaveCount(3);
        await expect(page.locator('[data-portal-photo-file-name]').first()).toContainText('rostro-control-1.png');
        await expect(page.getByText('Contexto', { exact: true })).toBeVisible();
        await expect(page.locator('[data-portal-photo-image][data-loaded="true"]')).toHaveCount(3);

        await expect.poll(() => imageAuthorizations.length).toBe(3);
        expect(imageAuthorizations).toEqual([
            'Bearer header.payload.signature',
            'Bearer header.payload.signature',
            'Bearer header.payload.signature',
        ]);
    });

    test('shows an empty state when there are no photos visible to the patient', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-photos', async (route) => {
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
                        gallery: {
                            totalPhotos: 0,
                            bodyZoneCount: 0,
                            latestCreatedAtLabel: '',
                            groups: [],
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/fotos/');

        await expect(page.locator('[data-portal-photos-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-photos-empty]')).toContainText(
            'Todavía no hay fotos visibles en tu portal'
        );
    });
});
