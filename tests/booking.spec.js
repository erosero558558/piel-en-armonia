// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

async function dismissCookieBannerIfVisible(page) {
    const banner = page.locator('#cookieBanner');
    if (await banner.isVisible().catch(() => false)) {
        const rejectButton = page.locator('#cookieRejectBtn');
        if (await rejectButton.isVisible().catch(() => false)) {
            await rejectButton.click();
            await expect(banner).toBeHidden();
        }
    }
}

async function openPublicRoute(page, pathname) {
    await page.goto(pathname);
    await dismissCookieBannerIfVisible(page);
}

async function expectLegacyBookingShellAbsent(page) {
    await expect(page.locator('script[data-data-bundle="true"]')).toHaveCount(
        0
    );
    await expect(page.locator('#appointmentForm')).toHaveCount(0);
    await expect(page.locator('#paymentModal')).toHaveCount(0);
    await expect(page.locator('#chatbotWidget')).toHaveCount(0);
}

test.describe('Reserva online en mantenimiento', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });
    });

    test('inicio conserva la orientacion del primer paso mientras la agenda web sigue pausada', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/');

        const newsStrip = page.locator('[data-v6-news-strip]');
        await expect(newsStrip).toContainText(
            'Dermatologia clara para empezar hoy, aunque la reserva web siga en mantenimiento.'
        );

        await page.locator('[data-v6-news-toggle]').click();
        const newsPanel = page.locator('[data-v6-news-panel]');
        await expect(newsPanel).toBeVisible();
        await expect(newsPanel).toContainText('teledermatologia');
        await expect(
            newsPanel.getByRole('link', { name: 'Ver especialidades' })
        ).toHaveAttribute('href', '/es/servicios/');

        await expectLegacyBookingShellAbsent(page);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const firstVisitCta = bookingStatus.getByRole('link', {
            name: 'Abrir primera consulta',
        });
        await expect(firstVisitCta).toHaveAttribute(
            'href',
            '/es/servicios/diagnostico-integral/'
        );

        await page.locator('[data-v6-search-open]').first().click();
        await expect(page.locator('[data-v6-search]')).toBeVisible();

        const searchInput = page.locator('[data-v6-search-input]');
        await searchInput.fill('tele');

        const telemedicineResult = page.locator(
            '[data-v6-search-results] a[href="/es/telemedicina/"]'
        );
        await expect(telemedicineResult).toBeVisible();
        await expect(telemedicineResult).toContainText('Teledermatologia');

        await Promise.all([
            page.waitForURL(/\/es\/telemedicina\/$/),
            telemedicineResult.click(),
        ]);

        await expect(page).toHaveURL(/\/es\/telemedicina\/$/);
        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
    });

    test('detalle de servicio muestra fallback a telemedicina en lugar del formulario legacy', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/servicios/acne-rosacea/');

        await expect(page.locator('h1')).toContainText('Acne y rosacea');
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();

        await pageMenuPanel
            .getByRole('link', { name: 'Reserva online' })
            .click();
        await expect(page).toHaveURL(/#v6-booking-status$/);

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );
        await expect(bookingStatus).toContainText(
            'puede empezar por teledermatologia'
        );

        const telemedicineLink = bookingStatus.getByRole('link', {
            name: 'Abrir teledermatologia',
        });
        await expect(telemedicineLink).toHaveAttribute(
            'href',
            '/es/telemedicina/'
        );
    });

    test('telemedicina devuelve a servicios cuando la reserva online sigue pausada', async ({
        page,
    }) => {
        await openPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
        await expectLegacyBookingShellAbsent(page);

        await page.locator('[data-v6-page-menu]').click();
        const pageMenuPanel = page.locator('[data-v6-page-menu-panel]');
        await expect(pageMenuPanel).toBeVisible();
        await expect(
            pageMenuPanel.getByRole('link', { name: 'Siguiente paso' })
        ).toHaveAttribute('href', '#v6-booking-status');

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const firstVisitLink = bookingStatus.getByRole('link', {
            name: 'Abrir primera consulta',
        });
        await expect(firstVisitLink).toHaveAttribute(
            'href',
            '/es/servicios/diagnostico-integral/'
        );

        await Promise.all([
            page.waitForURL(/\/es\/servicios\/diagnostico-integral\/$/),
            firstVisitLink.click(),
        ]);

        await expect(page).toHaveURL(
            /\/es\/servicios\/diagnostico-integral\/$/
        );
        await expect(page.locator('h1')).toContainText('Diagnostico integral');
        await expect(page.locator('[data-v6-internal-hero]')).toBeVisible();
    });
});
