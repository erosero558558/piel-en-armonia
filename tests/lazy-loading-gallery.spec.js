// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Gallery Lazy Loading', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('gallery images are present with data-src', async ({ page }) => {
        const gallerySection = page.locator('#galeria');
        await gallerySection.scrollIntoViewIfNeeded(); // Just to make sure it's in DOM if lazy loaded section (it's not)

        const images = page.locator('.gallery-img');
        const count = await images.count();
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            const img = images.nth(i);
            await expect(img).toHaveAttribute('data-src');
        }
    });

    test('images load when scrolled into view', async ({ page }) => {
        const gallerySection = page.locator('#galeria');

        // Check first image before scrolling (might be not loaded if below fold)
        // Note: Playwright might scroll automatically if we locator it, but let's try to check attribute.
        const firstImg = page.locator('.gallery-img').first();

        // We scroll to the section
        await gallerySection.scrollIntoViewIfNeeded();

        // Wait a bit for IntersectionObserver
        await page.waitForTimeout(1000);

        // Check if loaded class is added and src is set
        await expect(firstImg).toHaveClass(/loaded/);
        await expect(firstImg).toHaveAttribute('src');

        // Verify src matches data-src
        const dataSrc = await firstImg.getAttribute('data-src');
        const src = await firstImg.getAttribute('src');
        // src might be absolute url, data-src is relative.
        expect(src).toContain(dataSrc);
    });
});
