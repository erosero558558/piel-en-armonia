// @ts-check
const { test, expect } = require('@playwright/test');

async function openPricingSection(page, viewport) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page
        .locator('#tarifario .pricing-container')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => {
        const target = document.getElementById('tarifario');
        if (target) {
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    });
}

async function getLayoutMetrics(page) {
    return page.evaluate(() => {
        const pricingSection = document.getElementById('tarifario');
        const header = pricingSection?.querySelector('.section-header');
        const container = pricingSection?.querySelector('.pricing-container');
        const category = pricingSection?.querySelector('.pricing-category');
        const disclaimers = document.querySelector('.services-disclaimers');

        if (
            !pricingSection ||
            !header ||
            !container ||
            !category ||
            !disclaimers
        ) {
            return null;
        }

        const toRect = (el) => {
            const rect = el.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                width: rect.width,
            };
        };

        const containerStyle = getComputedStyle(container);
        const categoryStyle = getComputedStyle(category);
        const disclaimersStyle = getComputedStyle(disclaimers);

        return {
            viewportWidth: window.innerWidth,
            header: toRect(header),
            container: toRect(container),
            category: toRect(category),
            disclaimers: toRect(disclaimers),
            styles: {
                containerDisplay: containerStyle.display,
                containerPaddingLeft: containerStyle.paddingLeft,
                categoryDisplay: categoryStyle.display,
                categoryPaddingTop: categoryStyle.paddingTop,
                disclaimersDisplay: disclaimersStyle.display,
            },
        };
    });
}

function expectHorizontallyInside(rect, viewportWidth, tolerance = 2) {
    expect(rect.left).toBeGreaterThanOrEqual(-tolerance);
    expect(rect.right).toBeLessThanOrEqual(viewportWidth + tolerance);
}

test.describe('Pricing layout', () => {
    test('desktop pricing cards are centered and styled', async ({ page }) => {
        await openPricingSection(page, { width: 1536, height: 754 });
        const metrics = await getLayoutMetrics(page);
        expect(metrics).not.toBeNull();

        expect(metrics.styles.containerDisplay).toBe('flex');
        expect(metrics.styles.categoryDisplay).toBe('block');
        expect(metrics.styles.disclaimersDisplay).toBe('grid');
        expect(metrics.styles.categoryPaddingTop).not.toBe('0px');

        expectHorizontallyInside(metrics.header, metrics.viewportWidth);
        expectHorizontallyInside(metrics.container, metrics.viewportWidth);
        expectHorizontallyInside(metrics.category, metrics.viewportWidth);
        expectHorizontallyInside(metrics.disclaimers, metrics.viewportWidth);

        expect(metrics.container.left).toBeGreaterThan(80);
    });

    test('mobile pricing stays inside viewport with proper spacing', async ({
        page,
    }) => {
        await openPricingSection(page, { width: 390, height: 844 });
        const metrics = await getLayoutMetrics(page);
        expect(metrics).not.toBeNull();

        expect(metrics.styles.containerDisplay).toBe('flex');
        expect(metrics.styles.categoryDisplay).toBe('block');
        expect(metrics.styles.disclaimersDisplay).toBe('grid');

        expectHorizontallyInside(metrics.header, metrics.viewportWidth);
        expectHorizontallyInside(metrics.container, metrics.viewportWidth);
        expectHorizontallyInside(metrics.category, metrics.viewportWidth);
        expectHorizontallyInside(metrics.disclaimers, metrics.viewportWidth);

        expect(metrics.container.left).toBeGreaterThanOrEqual(0);
    });
});
