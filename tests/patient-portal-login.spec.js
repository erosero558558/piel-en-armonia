// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Patient portal login page', () => {
    test('requests OTP, stores the signed session in localStorage, and redirects to the portal', async ({
        page,
    }) => {
        await page.route('**/api.php?resource=patient-portal-auth-status', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        authenticated: false,
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-portal-auth-start', async (route) => {
            const payload = JSON.parse(route.request().postData() || '{}');
            expect(payload.phone).toBe('0991234567');

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        challengeId: 'ppc_demo_001',
                        maskedPhone: '******4567',
                        debugCode: '123456',
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=patient-portal-auth-complete', async (route) => {
            const payload = JSON.parse(route.request().postData() || '{}');
            expect(payload.challengeId).toBe('ppc_demo_001');
            expect(payload.phone).toBe('0991234567');
            expect(payload.code).toBe('123456');

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        token: 'header.payload.signature',
                        expiresAt: '2026-04-06T00:00:00Z',
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                            phoneMasked: '******4567',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/login/');

        await expect(page.locator('h1')).toContainText('Ingresa sin contraseñas');
        await page.locator('input[name="whatsapp"]').fill('0991234567');
        await page.locator('[data-portal-login-request-form] button[type="submit"]').click();

        await expect(page.locator('[data-portal-login-verify-stage]')).toBeVisible();
        await expect(page.locator('[data-portal-login-phone]')).toContainText('******4567');
        await expect(page.locator('[data-portal-login-debug-code]')).toContainText('123456');

        await page.locator('input[name="otp"]').fill('123456');
        await page.locator('[data-portal-login-verify-form] button[type="submit"]').click();

        await expect(page).toHaveURL(/\/es\/portal\/$/);

        const storedSession = await page.evaluate(() =>
            window.localStorage.getItem('auroraPatientPortalSession')
        );
        expect(storedSession).toContain('header.payload.signature');
        expect(storedSession).toContain('Lucia Portal');
    });
});
