// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Gallery Lazy Loading', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    // Removed test checking for specific script tag since logic is bundled now
    /*
    test('gallery script is loaded', async ({ page }) => {
        const script = page.locator('script[src="gallery-lazy.js"]');
        await expect(script).toHaveCount(1);
    });
    */

    test('gallery images are present with data-src', async ({ page }) => {
        const gallerySection = page.locator('#galeria');
        // Scroll to ensure section is close to view (though logic might require actual intersection)
        await gallerySection.scrollIntoViewIfNeeded();

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
