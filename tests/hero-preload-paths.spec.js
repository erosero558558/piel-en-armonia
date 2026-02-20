// @ts-check
const { test, expect } = require('@playwright/test');

const SERVICE_PAGES = [
  '/servicios/acne.html',
  '/servicios/laser.html'
];

test.describe('Service hero preload paths', () => {
  for (const path of SERVICE_PAGES) {
    test(`hero preload is valid on ${path}`, async ({ page }) => {
      const heroResponses = [];
      page.on('response', (response) => {
        const url = response.url();
        if (url.endsWith('/hero-woman.jpg')) {
          heroResponses.push(response.status());
        }
      });

      await page.goto(path);
      await page.waitForTimeout(600);

      expect(heroResponses.length, `no hero image response captured for ${path}`).toBeGreaterThan(0);
      const hasError = heroResponses.some((status) => status >= 400);
      expect(hasError, `hero preload/image returned an error status on ${path}`).toBeFalsy();
    });
  }
});
