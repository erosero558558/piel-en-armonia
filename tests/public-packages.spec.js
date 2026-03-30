// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForBookingStatus,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public packages page', () => {
    test('publishes package cards, visible pricing and the highlighted Plan Piel Perfecta', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/paquetes/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('body')).toHaveAttribute(
            'data-public-template-id',
            'packages_v6'
        );
        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(page.locator('h1')).toContainText('Paquetes dermatologicos');
        await expect(page.locator('[data-v6-package-card]')).toHaveCount(3);
        await expect(
            page.locator('[data-v6-package-card="plan-piel-perfecta"]')
        ).toContainText('Plan Piel Perfecta');
        await expect(
            page.locator('[data-v6-package-card="plan-piel-perfecta"]')
        ).toContainText('$495');
        await expect(
            page.locator('[data-v6-package-card="plan-piel-perfecta"]')
        ).toContainText('3 laser + 1 peeling + 1 follow-up');
        await expect(page.locator('[data-v6-package-compare]')).toContainText(
            'Comparativa rapida'
        );
        await expect(page.locator('[data-v6-package-process]')).toContainText(
            'No cerramos un paquete sin revisar'
        );

        await waitForBookingStatus(
            page,
            'Si quiere revisar un paquete por WhatsApp'
        );
    });

    test('page menu anchors to package sections and site search surfaces the new route', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/paquetes/');
        await waitForShellV6Runtime(page);

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();

        await menuButton.click();
        await expect(panel).toBeVisible();

        await panel.getByRole('link', { name: 'Comparativa' }).click();
        await expect(page).toHaveURL(/#v6-packages-compare$/);

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('paquetes');

        const result = page.locator(
            '[data-v6-search-results] a[href="/es/paquetes/"]'
        );
        await expect(result).toBeVisible();
        await expect(result).toContainText('Paquetes dermatologicos');
    });
});
