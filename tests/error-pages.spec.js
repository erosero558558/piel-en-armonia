// @ts-check
const { test, expect } = require('@playwright/test');

const pages = [
    {
        route: '/404.html',
        code: 'Error 404',
        title: 'La ruta ya no esta aqui.',
        whatsappLabel: 'Escribir por WhatsApp',
    },
    {
        route: '/500.html',
        code: 'Error 500',
        title: 'Esta vista fallo, pero la clinica sigue disponible.',
        whatsappLabel: 'Continuar por WhatsApp',
    },
];

for (const entry of pages) {
    test(`${entry.route} uses the Design System recovery shell`, async ({
        page,
    }) => {
        await page.goto(entry.route, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('load');

        await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            'public'
        );
        await expect(page.locator('body')).toHaveAttribute(
            'data-theme',
            'public'
        );
        await expect(page.locator('.brand-clinical')).toContainText(
            'Aurora Derm'
        );
        await expect(page.locator('.error-code-badge')).toContainText(
            entry.code
        );
        await expect(page.locator('main h1')).toContainText(entry.title);
        await expect(
            page.locator(`a.btn-primary:has-text("${entry.whatsappLabel}")`)
        ).toHaveAttribute('href', /wa\.me\/593982453672/);
        await expect(page.locator('a[href="/es/index.html"]').first()).toBeVisible();
        await expect(
            page.locator('a[href="/es/servicios/index.html"]').first()
        ).toBeVisible();

        await expect(
            page.locator('link[href="/styles/tokens.css"]')
        ).toHaveCount(1);
        await expect(
            page.locator('link[href="/styles/components.css"]')
        ).toHaveCount(1);
        await expect(
            page.locator('link[href="/styles/aurora-public.css"]')
        ).toHaveCount(1);
        await expect(
            page.locator('link[href="/styles/error-pages.css"]')
        ).toHaveCount(1);
    });
}
