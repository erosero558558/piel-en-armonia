// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

const HOME_CASES = [
    {
        route: '/es/',
        bookingText: 'Reserva online en mantenimiento',
        switchHref: '/en/',
    },
    {
        route: '/en/',
        bookingText: 'Online booking under maintenance',
        switchHref: '/es/',
    },
];

const HUB_CASES = [
    {
        route: '/es/servicios/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/services/',
        bookingText: 'Online booking under maintenance',
    },
];

const SERVICE_AND_TELE_CASES = [
    {
        route: '/es/servicios/botox/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/services/cancer-piel/',
        bookingText: 'Online booking under maintenance',
    },
    {
        route: '/es/telemedicina/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/telemedicine/',
        bookingText: 'Online booking under maintenance',
    },
];

const LEGAL_CASES = [
    {
        route: '/es/legal/privacidad/',
        switchHref: '/en/legal/privacy/',
    },
    {
        route: '/en/legal/privacy/',
        switchHref: '/es/legal/privacidad/',
    },
];

test.describe('Public conversion contract V6', () => {
    test('home and hub routes keep booking frozen and remove legacy hooks', async ({
        page,
    }) => {
        for (const entry of HOME_CASES) {
            await gotoPublicRoute(page, entry.route);
            await waitForBookingStatus(page, entry.bookingText);
            const switcher = await findLocaleSwitch(page);
            await expect(switcher).toHaveAttribute('href', entry.switchHref);
            await expectNoLegacyPublicShell(page);
        }

        for (const entry of HUB_CASES) {
            await gotoPublicRoute(page, entry.route);
            await expect(page.locator('[data-v6-page-head]')).toBeVisible();
            await waitForBookingStatus(page, entry.bookingText);
            await expectNoLegacyPublicShell(page);
        }
    });

    test('service and telemedicine routes keep v6-booking-status as the active booking entry', async ({
        page,
    }) => {
        for (const entry of SERVICE_AND_TELE_CASES) {
            await gotoPublicRoute(page, entry.route);

            const bookingLink = page
                .locator('[data-v6-internal-rail] a[href="#v6-booking-status"]')
                .first();
            await expect(bookingLink).toBeVisible();
            await bookingLink.click();

            await expect(page).toHaveURL(/#v6-booking-status$/);
            await waitForBookingStatus(page, entry.bookingText);
            await expectNoLegacyPublicShell(page);
        }
    });

    test('legal surfaces preserve locale-safe navigation without reviving legacy booking UI', async ({
        page,
    }) => {
        for (const entry of LEGAL_CASES) {
            await gotoPublicRoute(page, entry.route);

            await expect(page.locator('[data-v6-page-head]')).toBeVisible();
            await expect(page.locator('[data-v6-internal-hero]')).toBeVisible();
            const switcher = await findLocaleSwitch(page);
            await expect(switcher).toHaveAttribute('href', entry.switchHref);
            await expectNoLegacyPublicShell(page);
        }
    });
});
