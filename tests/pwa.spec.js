const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });

test('patient portal publishes an installable PWA contract', async ({ page }) => {
    await page.goto('/es/portal/');
    await page.waitForLoadState('load');

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
        'content',
        'Aurora Derm'
    );

    const serviceWorkerResponse = await page.request.get('/sw.js');
    expect(serviceWorkerResponse.ok()).toBeTruthy();

    await expect
        .poll(async () => {
            return await page.evaluate(async () => {
                if (!('serviceWorker' in navigator)) {
                    return 0;
                }
                const registrations = await navigator.serviceWorker.getRegistrations();
                return registrations.length;
            });
        }, { timeout: 15000 })
        .toBeGreaterThan(0);

    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.ok()).toBeTruthy();
    const manifestJson = await manifestResponse.json();
    expect(manifestJson.name).toContain('Aurora Derm');
    expect(manifestJson.start_url).toBe('/es/portal/');
    expect(manifestJson.display).toBe('standalone');
    expect(manifestJson.icons).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                src: '/images/icon-512.png',
                sizes: '512x512',
            }),
        ])
    );

    const icon512 = await page.request.get('/images/icon-512.png');
    expect(icon512.ok()).toBeTruthy();
});

test('patient portal history route also advertises the shared manifest', async ({ page }) => {
    await page.goto('/es/portal/historial/');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
        'href',
        '/manifest.json'
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
        'content',
        'Aurora Derm'
    );
});
