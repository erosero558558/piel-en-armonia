// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForBookingStatus,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public blog index', () => {
    test('renders the editorial structure and keeps the route monolingual', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Blog dermatologico para decidir mejor'
        );
        await expect(page.locator('[data-v6-blog-chip]')).toHaveCount(5);
        await expect(page.locator('[data-v6-blog-card]')).toHaveCount(6);
        await expect(page.locator('[data-v6-blog-track]')).toHaveCount(5);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);
        await expect(page.locator('[data-v6-blog-card]').first().locator('a')).toHaveAttribute(
            'href',
            '/es/blog/como-elegir-dermatologo-quito/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').first().locator('strong')
        ).toContainText('Leer articulo');
        await expect(page.locator('[data-v6-blog-card]').nth(1).locator('a')).toHaveAttribute(
            'href',
            '/es/blog/senales-alarma-lunares/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').nth(1).locator('strong')
        ).toContainText('Leer articulo');
        await expect(page.locator('[data-v6-blog-card]').nth(2).locator('a')).toHaveAttribute(
            'href',
            '/es/blog/proteccion-solar-ecuador/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').nth(2).locator('strong')
        ).toContainText('Leer articulo');
        await expect(page.locator('[data-v6-blog-card]').nth(3).locator('a')).toHaveAttribute(
            'href',
            '/es/blog/acne-adulto/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').nth(3).locator('strong')
        ).toContainText('Leer articulo');
        await expect(page.locator('[data-v6-blog-card]').nth(4).locator('a')).toHaveAttribute(
            'href',
            '/es/blog/melasma-embarazo/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').nth(4).locator('strong')
        ).toContainText('Leer articulo');
        await expect(page.locator('[data-v6-blog-card]').nth(5).locator('a')).toHaveAttribute(
            'href',
            '/es/blog/bioestimuladores-vs-rellenos/'
        );
        await expect(
            page.locator('[data-v6-blog-card]').nth(5).locator('strong')
        ).toContainText('Leer articulo');

        const whatsappHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(whatsappHref || '').toContain('wa.me/593982453672');
        expect(whatsappHref || '').toContain('text=');

        await waitForBookingStatus(
            page,
            'Si una de estas guias ya le ayudo a ubicar su caso, le orientamos hoy'
        );
    });
});
