// @ts-check
const { test, expect } = require('@playwright/test');
const {
    getTrackedEvents,
    waitForAnalyticsBridge,
} = require('./helpers/public-v6');

const GA4_MEASUREMENT_ID = 'G-2DWZ5PJ4MC';

const CASES = [
    {
        path: '/es/',
        expectedText: 'Hola, me gustaria agendar una evaluacion dermatologica',
        expectedService: 'home',
    },
    {
        path: '/en/',
        expectedText: "Hello, I'd like to book a dermatology evaluation",
        expectedService: 'home',
    },
    {
        path: '/es/servicios/',
        expectedText:
            'Hola, necesito ayuda para elegir la especialidad dermatologica adecuada',
        expectedService: 'service-hub',
    },
    {
        path: '/en/services/',
        expectedText:
            'Hello, I need help choosing the right dermatology specialty',
        expectedService: 'service-hub',
    },
    {
        path: '/es/servicios/acne-rosacea/',
        expectedText: 'Hola, me interesa una consulta sobre acne',
        expectedService: 'acne-rosacea',
    },
    {
        path: '/en/services/acne-rosacea/',
        expectedText: "Hello, I'm interested in an acne consultation",
        expectedService: 'acne-rosacea',
    },
    {
        path: '/es/servicios/laser-dermatologico/',
        expectedText: 'Hola, quiero informacion sobre tratamiento laser',
        expectedService: 'laser-dermatologico',
    },
    {
        path: '/en/services/laser-dermatologico/',
        expectedText: "Hello, I'd like information about laser treatment",
        expectedService: 'laser-dermatologico',
    },
    {
        path: '/es/telemedicina/',
        expectedText: 'Hola, me interesa una orientacion por teledermatologia',
        expectedService: 'teledermatologia',
    },
    {
        path: '/en/telemedicine/',
        expectedText: "Hello, I'm interested in a teledermatology consultation",
        expectedService: 'teledermatologia',
    },
    {
        path: '/es/software/turnero-clinicas/',
        expectedIncludes: 'Flow OS',
        expectedService: 'flow-os',
    },
];

async function whatsappTextsFor(page) {
    return page.evaluate(() => {
        const CLINIC_PHONE = '593982453672';
        return Array.from(
            document.querySelectorAll(
                'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
            )
        )
            .map((node) => {
                if (!(node instanceof HTMLAnchorElement)) return '';
                try {
                    const url = new URL(node.href, window.location.href);
                    const host = String(url.hostname || '')
                        .replace(/^www\./, '')
                        .toLowerCase();
                    const isClinicLink =
                        (host === 'wa.me' &&
                            url.pathname.replace(/\//g, '') === CLINIC_PHONE) ||
                        ((host === 'api.whatsapp.com' ||
                            host === 'web.whatsapp.com') &&
                            String(url.searchParams.get('phone') || '').replace(
                                /\D/g,
                                ''
                            ) === CLINIC_PHONE);
                    return isClinicLink
                        ? String(url.searchParams.get('text') || '')
                        : '';
                } catch (_error) {
                    return '';
                }
            })
            .filter(Boolean);
    });
}

async function dispatchClinicWhatsAppClick(page) {
    return page.evaluate(() => {
        const CLINIC_PHONE = '593982453672';
        const link = Array.from(
            document.querySelectorAll(
                'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
            )
        ).find((node) => {
            if (!(node instanceof HTMLAnchorElement)) return false;
            try {
                const url = new URL(node.href, window.location.href);
                const host = String(url.hostname || '')
                    .replace(/^www\./, '')
                    .toLowerCase();
                return (
                    (host === 'wa.me' &&
                        url.pathname.replace(/\//g, '') === CLINIC_PHONE) ||
                    ((host === 'api.whatsapp.com' ||
                        host === 'web.whatsapp.com') &&
                        String(url.searchParams.get('phone') || '').replace(
                            /\D/g,
                            ''
                        ) === CLINIC_PHONE)
                );
            } catch (_error) {
                return false;
            }
        });

        if (!(link instanceof HTMLAnchorElement)) {
            return false;
        }

        window.dataLayer = [];
        if (typeof window.gtag !== 'function') {
            window.gtag = function () {
                window.dataLayer.push(arguments);
            };
        }

        link.addEventListener('click', (event) => event.preventDefault(), {
            once: true,
        });
        link.click();
        return true;
    });
}

async function trackedEventsFor(page) {
    return page.evaluate(() => {
        const normalizeEvent = (entry) => {
            if (!entry || typeof entry !== 'object') return null;

            if (
                (Array.isArray(entry) || typeof entry.length === 'number') &&
                entry[0] === 'event'
            ) {
                return {
                    eventName: String(entry[1] || ''),
                    params:
                        entry[2] && typeof entry[2] === 'object'
                            ? entry[2]
                            : {},
                };
            }

            if (typeof entry.event === 'string') {
                const params = { ...entry };
                delete params.event;
                return {
                    eventName: entry.event,
                    params,
                };
            }

            return null;
        };

        return (window.dataLayer || []).map(normalizeEvent).filter(Boolean);
    });
}

test.describe('Public WhatsApp CTA contextualization', () => {
    for (const scenario of CASES) {
        test(`page ${scenario.path} sets contextual WhatsApp text`, async ({
            page,
        }) => {
            await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });

            await page.waitForFunction(() => {
                const CLINIC_PHONE = '593982453672';
                return Array.from(
                    document.querySelectorAll(
                        'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
                    )
                ).some((node) => {
                    if (!(node instanceof HTMLAnchorElement)) return false;
                    try {
                        const url = new URL(node.href, window.location.href);
                        const host = String(url.hostname || '')
                            .replace(/^www\./, '')
                            .toLowerCase();
                        const isClinicLink =
                            (host === 'wa.me' &&
                                url.pathname.replace(/\//g, '') ===
                                    CLINIC_PHONE) ||
                            ((host === 'api.whatsapp.com' ||
                                host === 'web.whatsapp.com') &&
                                String(
                                    url.searchParams.get('phone') || ''
                                ).replace(/\D/g, '') === CLINIC_PHONE);
                        return Boolean(
                            isClinicLink &&
                            String(url.searchParams.get('text') || '').trim()
                        );
                    } catch (_error) {
                        return false;
                    }
                });
            });

            const texts = await whatsappTextsFor(page);
            expect(texts.length).toBeGreaterThan(0);
            for (const text of texts) {
                expect(text.trim().length).toBeGreaterThan(0);
            }

            if (scenario.expectedText) {
                expect(texts).toContain(scenario.expectedText);
            }

            if (scenario.expectedIncludes) {
                expect(
                    texts.some((text) =>
                        text.includes(scenario.expectedIncludes)
                    )
                ).toBeTruthy();
            }

            await page.waitForFunction(
                () =>
                    typeof window.gtag === 'function' &&
                    Array.isArray(window.dataLayer)
            );

            expect(await dispatchClinicWhatsAppClick(page)).toBeTruthy();

            const trackedEvents = await trackedEventsFor(page);
            const whatsappEvent = trackedEvents.find(
                (entry) => entry.eventName === 'whatsapp_click'
            );

            expect(whatsappEvent).toBeTruthy();
            expect(whatsappEvent.params.service).toBe(
                scenario.expectedService
            );
            expect(whatsappEvent.params.page).toBe(scenario.path);
        });
    }
});

const TRACKING_CASES = [
    {
        path: '/es/',
        expectedService: 'home',
    },
    {
        path: '/es/servicios/acne-rosacea/',
        expectedService: 'acne-rosacea',
    },
    {
        path: '/en/services/laser-dermatologico/',
        expectedService: 'laser-dermatologico',
    },
    {
        path: '/es/software/turnero-clinicas/',
        expectedService: 'flow-os',
    },
];

const GA4_CASES = [
    '/es/',
    '/en/',
    '/es/servicios/acne-rosacea/',
    '/en/telemedicine/',
    '/es/software/turnero-clinicas/',
];

async function ga4StateFor(page) {
    return page.evaluate((measurementId) => {
        const hasScript = Array.from(document.scripts).some((script) =>
            String(script.src || '').includes(
                `googletagmanager.com/gtag/js?id=${measurementId}`
            )
        );
        const hasBridge =
            typeof window.gtag === 'function' &&
            Array.isArray(window.dataLayer);
        const hasConfig = (window.dataLayer || []).some(
            (entry) =>
                entry &&
                typeof entry === 'object' &&
                entry[0] === 'config' &&
                entry[1] === measurementId
        );

        return {
            hasScript,
            hasBridge,
            hasConfig,
            ga4Loaded: window._ga4Loaded === true,
        };
    }, GA4_MEASUREMENT_ID);
}

test.describe('Public GA4 tag bootstrap', () => {
    for (const route of GA4_CASES) {
        test(`page ${route} publishes and configures GA4`, async ({
            page,
        }) => {
            await page.goto(route, { waitUntil: 'domcontentloaded' });

            await expect
                .poll(async () => ga4StateFor(page))
                .toMatchObject({
                    hasScript: false,
                    hasConfig: false,
                    ga4Loaded: false,
                });

            await page.evaluate(() => {
                localStorage.setItem(
                    'pa_cookie_consent_v1',
                    JSON.stringify({
                        status: 'accepted',
                        at: new Date().toISOString(),
                    })
                );
            });

            await page.goto(route, { waitUntil: 'domcontentloaded' });

            await expect
                .poll(async () => ga4StateFor(page))
                .toMatchObject({
                    hasScript: true,
                    hasBridge: true,
                    hasConfig: true,
                    ga4Loaded: true,
                });
        });
    }
});

test.describe('Public WhatsApp click tracking', () => {
    for (const scenario of TRACKING_CASES) {
        test(`page ${scenario.path} tracks whatsapp_click with service + page`, async ({
            page,
        }) => {
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => {
                localStorage.setItem(
                    'pa_cookie_consent_v1',
                    JSON.stringify({
                        status: 'accepted',
                        at: new Date().toISOString(),
                    })
                );
            });

            await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });
            await waitForAnalyticsBridge(page);

            await expect
                .poll(async () => ga4StateFor(page))
                .toMatchObject({
                    hasScript: true,
                    hasBridge: true,
                    hasConfig: true,
                    ga4Loaded: true,
                });

            await page.evaluate(() => {
                const link = document.querySelector(
                    'a[href*="wa.me/"], a[href*="whatsapp.com/"]'
                );
                if (!(link instanceof HTMLAnchorElement)) return;

                link.addEventListener(
                    'click',
                    (event) => {
                        event.preventDefault();
                    },
                    { once: true }
                );

                link.dispatchEvent(
                    new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                    })
                );
            });

            let events = [];
            await expect
                .poll(async () => {
                    events = await getTrackedEvents(page, 'whatsapp_click');
                    return events.length;
                })
                .toBeGreaterThan(0);

            expect(events).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        service: scenario.expectedService,
                        page: scenario.path,
                    }),
                ])
            );
        });
    }
});
