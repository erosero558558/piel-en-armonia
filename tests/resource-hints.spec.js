// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Resource Hints', () => {
    test('homepage has correct resource hints', async ({ page }) => {
        await page.goto('/');

        // Stripe
        const stripePreconnect = page.locator(
            'link[rel="preconnect"][href="https://js.stripe.com"]'
        );
        await expect(stripePreconnect).toHaveCount(1);

        // Sentry
        const sentryDns = page.locator(
            'link[rel="dns-prefetch"][href="https://browser.sentry-cdn.com"]'
        );
        await expect(sentryDns).toHaveCount(1);

        // Google Analytics
        const gaDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.google-analytics.com"]'
        );
        await expect(gaDns).toHaveCount(1);

        // Google Tag Manager
        const gtmDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.googletagmanager.com"]'
        );
        await expect(gtmDns).toHaveCount(1);

        // Google (Maps iframe)
        const googleDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.google.com"]'
        );
        await expect(googleDns).toHaveCount(1);
    });

    test('telemedicina page has correct resource hints', async ({ page }) => {
        await page.goto('/telemedicina.html');

        // Stripe
        const stripePreconnect = page.locator(
            'link[rel="preconnect"][href="https://js.stripe.com"]'
        );
        await expect(stripePreconnect).toHaveCount(1);

        // Sentry
        const sentryDns = page.locator(
            'link[rel="dns-prefetch"][href="https://browser.sentry-cdn.com"]'
        );
        await expect(sentryDns).toHaveCount(1);

        // Google Analytics
        const gaDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.google-analytics.com"]'
        );
        await expect(gaDns).toHaveCount(1);

        // Google Tag Manager
        const gtmDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.googletagmanager.com"]'
        );
        await expect(gtmDns).toHaveCount(1);

        // Google (Maps iframe)
        const googleDns = page.locator(
            'link[rel="dns-prefetch"][href="https://www.google.com"]'
        );
        await expect(googleDns).toHaveCount(1);

        // Jitsi Meet
        const jitsiDns = page.locator(
            'link[rel="dns-prefetch"][href="https://meet.jit.si"]'
        );
        await expect(jitsiDns).toHaveCount(1);
    });
});
