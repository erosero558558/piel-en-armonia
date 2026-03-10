// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

test.describe('Reprogramacion de citas', () => {
    test('querystring invalido no rompe la home publica V6', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/?reschedule=token_invalido_123');
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expectNoLegacyPublicShell(page);

        await expect(
            page.locator(
                '#rescheduleModal, #rescheduleDate, #rescheduleTime, #rescheduleSubmitBtn'
            )
        ).toHaveCount(0);
    });

    test('superficie publica no expone modal legacy de reprogramacion', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
        await expect(page.locator('[data-v6-booking-status]')).toBeVisible();

        const legacyFields = [
            '#rescheduleModal',
            '#rescheduleDate',
            '#rescheduleTime',
            '#rescheduleSubmitBtn',
        ];

        for (const selector of legacyFields) {
            await expect(page.locator(selector)).toHaveCount(0);
        }
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
