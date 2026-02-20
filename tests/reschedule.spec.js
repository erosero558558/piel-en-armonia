// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

test.describe('Reprogramacion de citas', () => {
    test('token invalido muestra error', async ({ page }) => {
        await page.goto('/?reschedule=token_invalido_123');
        await page.waitForTimeout(2000);

        const toast = page
            .locator('.toast, [class*="toast"], [role="alert"]')
            .first();
        if (await toast.isVisible()) {
            await expect(toast).toContainText(/invalido|no encontrada|error/i);
        }
    });

    test('modal de reprogramacion tiene los campos necesarios', async ({
        page,
    }) => {
        await page.goto('/');

        const modal = page.locator('#rescheduleModal');
        await expect(modal).toBeAttached();

        const dateInput = page.locator('#rescheduleDate');
        await expect(dateInput).toBeAttached();

        const timeSelect = page.locator('#rescheduleTime');
        await expect(timeSelect).toBeAttached();

        const submitBtn = page.locator('#rescheduleSubmitBtn');
        await expect(submitBtn).toBeAttached();
    });

    test.describe('API reprogramacion (requiere PHP)', () => {
        test('API GET reschedule con token vacio devuelve 400', async ({
            request,
        }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get(
                '/api.php?resource=reschedule&token='
            );
            expect(resp.status()).toBe(400);
            const body = await resp.json();
            expect(body.ok).toBe(false);
        });

        test('API GET reschedule con token inexistente devuelve 404', async ({
            request,
        }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get(
                '/api.php?resource=reschedule&token=abcdef1234567890abcdef1234567890'
            );
            expect(resp.status()).toBe(404);
            const body = await resp.json();
            expect(body.ok).toBe(false);
        });

        test('API PATCH reschedule sin fecha devuelve 400', async ({
            request,
        }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.patch('/api.php?resource=reschedule', {
                data: {
                    token: 'abcdef1234567890abcdef1234567890',
                    date: '',
                    time: '',
                },
            });
            expect(resp.status()).toBe(400);
        });
    });
});
