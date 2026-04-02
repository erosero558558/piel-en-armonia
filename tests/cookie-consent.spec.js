// @ts-check
const { test, expect } = require('@playwright/test');

const GA4_MEASUREMENT_ID = 'G-2DWZ5PJ4MC';
const CLARITY_PROJECT_ID = 'aurora-test-clarity';
const CLARITY_RUNTIME_PROJECT_ID =
    process.env.CLARITY_ID ||
    process.env.PIELARMONIA_CLARITY_PROJECT_ID ||
    process.env.MICROSOFT_CLARITY_PROJECT_ID ||
    '';

async function getConsentModeCalls(page) {
    return page.evaluate(() => {
        const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
        return dl.flatMap((item) => {
            const tuple =
                Array.isArray(item) ||
                (item &&
                    typeof item === 'object' &&
                    typeof item.length === 'number')
                    ? Array.from(item)
                    : null;

            if (
                !tuple ||
                tuple[0] !== 'consent' ||
                typeof tuple[1] !== 'string' ||
                !tuple[2] ||
                typeof tuple[2] !== 'object'
            ) {
                return [];
            }

            return [
                {
                    mode: tuple[1],
                    ...tuple[2],
                },
            ];
        });
    });
}

async function getGa4State(page) {
    return page.evaluate((measurementId) => {
        const hasScript = Array.from(document.scripts).some((script) =>
            String(script.src || '').includes(
                `googletagmanager.com/gtag/js?id=${measurementId}`
            )
        );
        const hasConfig = (window.dataLayer || []).some((item) => {
            const tuple =
                Array.isArray(item) ||
                (item &&
                    typeof item === 'object' &&
                    typeof item.length === 'number')
                    ? Array.from(item)
                    : null;

            return (
                Array.isArray(tuple) &&
                tuple[0] === 'config' &&
                tuple[1] === measurementId
            );
        });

        return {
            hasScript,
            hasConfig,
            ga4Loaded: window._ga4Loaded === true,
        };
    }, GA4_MEASUREMENT_ID);
}

async function augmentRuntimeConfigWithClarity(page) {
    await page.route(
        '**/api.php?resource=public-runtime-config',
        async (route) => {
            const response = await route.fetch();
            const payload = await response.json();
            const data =
                payload && payload.data && typeof payload.data === 'object'
                    ? payload.data
                    : {};

            await route.fulfill({
                response,
                json: {
                    ...payload,
                    data: {
                        ...data,
                        analytics: {
                            ...(data.analytics || {}),
                            clarityProjectId: CLARITY_PROJECT_ID,
                        },
                    },
                },
            });
        }
    );
}

async function augmentRuntimeConfigWithAnalytics(page, config = { gaMeasurementId: 'G-2DWZ5PJ4MC' }) {
    await page.route(
        '**/api.php?resource=public-runtime-config',
        async (route) => {
            const response = await route.fetch();
            const payload = await response.json();
            const data =
                payload && payload.data && typeof payload.data === 'object'
                    ? payload.data
                    : {};

            await route.fulfill({
                response,
                json: {
                    ...payload,
                    data: {
                        ...data,
                        analytics: {
                            ...(data.analytics || {}),
                            ...config,
                        },
                    },
                },
            });
        }
    );
}

async function getClarityState(page, projectId = CLARITY_PROJECT_ID) {
    return page.evaluate((projectId) => {
        const hasScript = Array.from(document.scripts).some((script) =>
            String(script.src || '').includes(
                `https://www.clarity.ms/tag/${projectId}`
            )
        );

        return {
            hasScript,
            clarityLoaded: window.__clarityLoaded === true,
        };
    }, projectId);
}

test.describe('Consentimiento de cookies', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        await augmentRuntimeConfigWithAnalytics(page);
        // Limpiar localStorage para que aparezca el banner
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
    });

    test('banner de cookies aparece sin consentimiento previo', async ({
        page,
    }) => {
        const banner = page.locator('#cookieBanner');
        // El banner puede tardar en aparecer si la inicializacion es diferida
        await expect(banner).toBeVisible({ timeout: 10000 });
    });

    test('GA4 no se carga antes del consentimiento', async ({ page }) => {
        await expect
            .poll(async () => getGa4State(page))
            .toMatchObject({
                hasScript: false,
                hasConfig: false,
                ga4Loaded: false,
            });
    });

    test('aceptar cookies oculta el banner', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        const acceptBtn = page.locator('#cookieAcceptBtn');
        await acceptBtn.click();

        await expect(banner).toBeHidden();

        // Verificar que se guardó el consentimiento
        const consent = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consent).not.toBeNull();
        expect(consent.status).toBe('accepted');
    });

    test('rechazar cookies oculta el banner', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click();

        await expect(banner).toBeHidden();

        const consent = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consent).not.toBeNull();
        expect(consent.status).toBe('rejected');
    });

    test('banner no aparece si ya se aceptó', async ({ page }) => {
        // Aceptar cookies
        await page.evaluate(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'accepted',
                    at: new Date().toISOString(),
                })
            );
        });
        await page.reload();

        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeHidden();
    });

    test('Consent Mode mantiene analytics_storage denied al rechazar cookies', async ({
        page,
    }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click();

        // Verify consent mode via dataLayer (set by our cookie-consent code, not GTM).
        // Does not require the external GTM container to load.
        let consentCalls = [];
        await expect
            .poll(async () => {
                consentCalls = await getConsentModeCalls(page);
                return consentCalls.length;
            })
            .toBeGreaterThan(0);

        expect(consentCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    mode: 'default',
                    analytics_storage: 'denied',
                }),
                expect.objectContaining({
                    mode: 'update',
                    analytics_storage: 'denied',
                }),
            ])
        );
    });

    test('GA4 se carga al aceptar cookies', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        const acceptBtn = page.locator('#cookieAcceptBtn');
        await acceptBtn.click();

        await expect
            .poll(() => page.evaluate(() => !!window._ga4Loaded))
            .toBe(true);

        let consentCalls = [];
        await expect
            .poll(async () => {
                consentCalls = await getConsentModeCalls(page);
                return consentCalls.filter(
                    (item) =>
                        item.mode === 'update' &&
                        item.analytics_storage === 'granted'
                ).length;
            })
            .toBeGreaterThan(0);
    });

    test('Clarity solo se carga despues de aceptar cookies', async ({
        page,
    }) => {
        await augmentRuntimeConfigWithClarity(page);

        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        await expect
            .poll(async () => getClarityState(page))
            .toMatchObject({
                hasScript: false,
                clarityLoaded: false,
            });

        await page.locator('#cookieAcceptBtn').click();

        await expect
            .poll(async () => getClarityState(page))
            .toMatchObject({
                hasScript: true,
                clarityLoaded: true,
            });
    });

    test('Clarity se carga con CLARITY_ID del servidor tras aceptar cookies', async ({
        page,
    }) => {
        test.skip(
            !CLARITY_RUNTIME_PROJECT_ID,
            'Requires CLARITY_ID (or legacy clarity env alias) in the test server env'
        );

        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        await expect
            .poll(async () =>
                getClarityState(page, CLARITY_RUNTIME_PROJECT_ID)
            )
            .toMatchObject({
                hasScript: false,
                clarityLoaded: false,
            });

        await page.locator('#cookieAcceptBtn').click();

        await expect
            .poll(async () =>
                getClarityState(page, CLARITY_RUNTIME_PROJECT_ID)
            )
            .toMatchObject({
                hasScript: true,
                clarityLoaded: true,
            });
    });

    test('GA4 declara disabled_by_config si falta config', async ({ page }) => {
        await page.unrouteAll({ behavior: 'wait' });
        await augmentRuntimeConfigWithAnalytics(page, { gaMeasurementId: '' });
        
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        
        await page.locator('#cookieAcceptBtn').click();
        
        await expect
            .poll(() => page.evaluate(() => window._ga4Loaded))
            .toBe('disabled_by_config');
    });
});
