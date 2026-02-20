// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Pricing critical fallback', () => {
  test('pricing keeps structured layout when deferred stylesheet fails', async ({ page }) => {
    await page.route('**/styles-deferred.css*', async (route) => {
      await route.abort();
    });

    await page.goto('/');

    const pricing = page.locator('#tarifario .pricing-container');
    await expect(pricing).toBeVisible();

    const firstCard = page.locator('#tarifario .pricing-category').first();
    await expect(firstCard).toBeVisible();

    const firstItem = page.locator('#tarifario .pricing-item').first();
    await expect(firstItem).toBeVisible();

    const layout = await page.evaluate(() => {
      const container = document.querySelector('#tarifario .pricing-container');
      const card = document.querySelector('#tarifario .pricing-category');
      const item = document.querySelector('#tarifario .pricing-item');
      if (!container || !card || !item) {
        return null;
      }

      const containerStyle = window.getComputedStyle(container);
      const cardStyle = window.getComputedStyle(card);
      const itemStyle = window.getComputedStyle(item);

      return {
        containerDisplay: containerStyle.display,
        cardDisplay: cardStyle.display,
        cardBackground: cardStyle.backgroundColor,
        itemDisplay: itemStyle.display,
        itemJustify: itemStyle.justifyContent,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout.containerDisplay).toBe('flex');
    expect(layout.cardDisplay).toBe('block');
    expect(layout.itemDisplay).toBe('flex');
    expect(layout.itemJustify).toBe('space-between');
    expect(layout.cardBackground).not.toBe('rgba(0, 0, 0, 0)');
  });
});
