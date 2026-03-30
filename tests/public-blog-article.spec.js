// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
    waitForBookingStatus,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public blog article', () => {
    test('renders the Quito dermatologist guide with internal links and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/como-elegir-dermatologo-quito/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Como elegir dermatologo en Quito'
        );
        await expect(page.locator('[data-v6-blog-article-section]')).toHaveCount(8);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1500);

        const internalServiceLinks = await page
            .locator('[data-v6-blog-article-body] a[href^="/es/servicios/"]')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(internalServiceLinks.length).toBeGreaterThanOrEqual(6);

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si ya quiere elegir dermatologo en Quito, le ayudamos a aterrizar la ruta'
        );
    });

    test('renders the mole warning signs guide with oncology routing and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/senales-alarma-lunares/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            '5 senales de alarma en lunares'
        );

        const sectionCount = await page.locator('[data-v6-blog-article-section]').count();
        expect(sectionCount).toBeGreaterThanOrEqual(6);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1400);

        const serviceLinks = await page
            .locator('[data-v6-blog-article-body] a')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(serviceLinks).toContain('/es/servicios/tamizaje-oncologico/');
        expect(serviceLinks).toContain('/es/servicios/cancer-piel/');

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si un lunar cambio y quiere revisarlo con criterio, le ayudamos a ubicar la consulta correcta'
        );
    });

    test('renders the Quito photoprotection guide with altitude-specific routing and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/proteccion-solar-ecuador/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Proteccion solar en Ecuador: guia por altitud'
        );

        const sectionCount = await page.locator('[data-v6-blog-article-section]').count();
        expect(sectionCount).toBeGreaterThanOrEqual(7);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1500);

        const serviceLinks = await page
            .locator('[data-v6-blog-article-body] a')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(serviceLinks).toContain('/es/servicios/manchas/');
        expect(serviceLinks).toContain('/es/servicios/acne-rosacea/');
        expect(serviceLinks).toContain('/es/servicios/laser-dermatologico/');

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si quiere aterrizar su proteccion solar a Quito y a su tipo de piel, le ayudamos a ordenar la ruta'
        );
    });

    test('renders the adult acne guide with acne-rosacea routing and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/acne-adulto/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Acne adulto: causas y tratamiento'
        );

        const sectionCount = await page.locator('[data-v6-blog-article-section]').count();
        expect(sectionCount).toBeGreaterThanOrEqual(7);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1500);

        const serviceLinks = await page
            .locator('[data-v6-blog-article-body] a')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(serviceLinks).toContain('/es/servicios/acne-rosacea/');
        expect(serviceLinks).toContain('/es/servicios/cicatrices/');
        expect(serviceLinks).toContain('/es/servicios/manchas/');

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si su acne adulto sigue activo o ya le esta dejando marcas, le ayudamos a ordenar la ruta'
        );
    });

    test('renders the pregnancy melasma guide with manchas routing and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/melasma-embarazo/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Melasma y embarazo: que hacer con las manchas'
        );

        const sectionCount = await page.locator('[data-v6-blog-article-section]').count();
        expect(sectionCount).toBeGreaterThanOrEqual(7);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1500);

        const serviceLinks = await page
            .locator('[data-v6-blog-article-body] a')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(serviceLinks).toContain('/es/servicios/manchas/');
        expect(serviceLinks).toContain('/es/servicios/diagnostico-integral/');
        expect(serviceLinks).toContain('/es/telemedicina/');

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si el melasma en embarazo ya le esta preocupando, le ayudamos a ordenar la ruta'
        );
    });

    test('renders the injectables comparison guide with both service routes and pre-consult CTA', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/blog/bioestimuladores-vs-rellenos/');
        await waitForShellV6Runtime(page);
        await expectNoLegacyPublicShell(page);

        await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
            'Bioestimuladores vs rellenos: diferencias'
        );

        const sectionCount = await page.locator('[data-v6-blog-article-section]').count();
        expect(sectionCount).toBeGreaterThanOrEqual(7);
        await expect(
            page.locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        ).toHaveCount(0);

        const wordCount = await page.locator('[data-v6-blog-article-body]').evaluate((node) => {
            const text = node.textContent || '';
            return text
                .split(/\s+/)
                .map((word) => word.trim())
                .filter(Boolean).length;
        });
        expect(wordCount).toBeGreaterThan(1500);

        const serviceLinks = await page
            .locator('[data-v6-blog-article-body] a')
            .evaluateAll((links) =>
                Array.from(new Set(links.map((link) => link.getAttribute('href') || ''))).filter(
                    Boolean
                )
            );
        expect(serviceLinks).toContain('/es/servicios/bioestimuladores-colageno/');
        expect(serviceLinks).toContain('/es/servicios/rellenos-hialuronico/');
        expect(serviceLinks).toContain('/es/servicios/diagnostico-integral/');

        const preConsultHref = await page
            .locator('[data-v6-booking-status] a')
            .getAttribute('href');
        expect(preConsultHref).toBe('/es/pre-consulta/');
        await expect(
            page.locator('[data-v6-booking-status]').getByRole('link', {
                name: 'Abrir pre-consulta',
            })
        ).toBeVisible();

        await waitForBookingStatus(
            page,
            'Si quiere decidir entre bioestimuladores y rellenos con mas criterio, le ayudamos a elegir la ruta'
        );
    });
});
