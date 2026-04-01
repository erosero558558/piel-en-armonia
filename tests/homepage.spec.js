// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public home V6', () => {
    test('renders the V6 shell and core editorial surfaces on ES home', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await expect(page).toHaveTitle(/Aurora Derm/i);
        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        await expectNoLegacyPublicShell(page);
    });

    test.skip('hero controls switch the active V6 slide', async ({ page }) => {
        // Reborn home hero does not have sliders
    });

    test('home boots V6 runtime without legacy runtime markers', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        await waitForHomeV6Runtime(page);
        await expect(page.locator('[data-v6-hero]')).toHaveAttribute(
            'data-v6-state',
            /^(playing|paused)$/
        );
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            document.documentElement.dataset
                                .publicV3RuntimeBooted || ''
                    ),
                { timeout: 1000 }
            )
            .toBe('');
    });

    test('english home keeps the V6 locale switch in the news strip', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const switcher = await findLocaleSwitch(page);
        await expect(switcher).toHaveAttribute('href', '/es/');
        await waitForBookingStatus(page, 'Online booking under maintenance');
        await expectNoLegacyPublicShell(page);
    });

    test.skip('spanish home exposes the Google Maps reviews block with a clinic listing CTA', async ({
        page,
    }) => {
        // Reborn home hero does not have Google Maps reviews
    });
});
