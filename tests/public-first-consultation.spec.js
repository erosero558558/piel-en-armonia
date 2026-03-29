// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForBookingStatus,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public first consultation page', () => {
    test('guide publishes prep, logistics and booking guidance for the first visit', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/primera-consulta/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(page.locator('h1')).toContainText('Primera consulta');
        await expect(
            page.locator('[data-v6-first-consultation-card]')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-v6-first-logistics-card]')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-v6-first-consultation]')
        ).toContainText('45 min');
        await expect(
            page.locator('[data-v6-first-consultation]')
        ).toContainText('Que traer para aprovechar mejor la visita');
        await expect(page.locator('[data-v6-first-logistics]')).toContainText(
            'Estacionamiento'
        );
        await expect(
            page.locator(
                '[data-v6-first-logistics] a[href="https://www.google.com/maps?cid=15768128031462376471"]'
            )
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si quiere confirmar su primera consulta, escribanos por WhatsApp'
        );
    });

    test('page menu anchors to logistics and site search surfaces the guide', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/primera-consulta/');
        await waitForShellV6Runtime(page);

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();

        await menuButton.click();
        await expect(panel).toBeVisible();

        const logisticsLink = panel.getByRole('link', { name: 'Como llegar' });
        await logisticsLink.click();
        await expect(page).toHaveURL(/#v6-first-logistics$/);

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('primera consulta');

        const result = page.locator(
            '[data-v6-search-results] a[href="/es/primera-consulta/"]'
        );
        await expect(result).toBeVisible();
        await expect(result).toContainText('Primera consulta');
    });
});
