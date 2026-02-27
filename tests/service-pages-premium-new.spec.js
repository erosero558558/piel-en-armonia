// @ts-check
const { test, expect } = require('@playwright/test');

const PREMIUM_SERVICE_ROUTES = [
    '/servicios/diagnostico-integral.html',
    '/servicios/acne-rosacea.html',
    '/servicios/verrugas.html',
    '/servicios/granitos-brazos-piernas.html',
    '/servicios/cicatrices.html',
    '/servicios/cancer-piel.html',
    '/servicios/peeling-quimico.html',
    '/servicios/mesoterapia.html',
    '/servicios/laser-dermatologico.html',
    '/servicios/botox.html',
    '/servicios/bioestimuladores-colageno.html',
    '/servicios/piel-cabello-unas.html',
    '/ninos/dermatologia-pediatrica.html',
];

test.describe('Premium service routes', () => {
    test('all premium routes render content and booking CTA', async ({
        page,
    }) => {
        for (const route of PREMIUM_SERVICE_ROUTES) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('.service-hero-card')).toBeVisible();
            await expect(page.locator('.service-hero-card h1')).not.toHaveText(
                ''
            );

            const bookingCta = page
                .locator(
                    '.service-actions a[data-analytics-event="start_booking_from_service"]'
                )
                .first();
            await expect(bookingCta).toBeVisible();
            await expect(bookingCta).toHaveAttribute(
                'href',
                /\/\?service=.+#citas/
            );
        }
    });
});
