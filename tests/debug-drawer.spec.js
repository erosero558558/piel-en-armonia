// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test('debug drawer', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoPublicRoute(page, '/es/servicios/');

    const toggle = page.locator('[data-v6-drawer-open]').first();
    await toggle.waitFor({ state: 'visible' });
    await toggle.click();
    await page.waitForTimeout(1000);

    const info = await page.evaluate(() => {
        const drawer = document.querySelector('[data-v6-drawer]');
        const panel = document.querySelector('.v6-drawer__panel');
        if (!drawer || !panel) return "Element missing";
        const dStyle = window.getComputedStyle(drawer);
        const pStyle = window.getComputedStyle(panel);
        return {
            drawerHiddenAttr: drawer.hasAttribute('hidden'),
            drawerDisplay: dStyle.display,
            drawerVisibility: dStyle.visibility,
            drawerRect: drawer.getBoundingClientRect(),
            panelDisplay: pStyle.display,
            panelVisibility: pStyle.visibility,
            panelRect: panel.getBoundingClientRect()
        };
    });
    console.log("INFO:", JSON.stringify(info, null, 2));
    expect(info.panelDisplay).toBe('flex');
});
