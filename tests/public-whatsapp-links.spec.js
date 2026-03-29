// @ts-check
const { test, expect } = require('@playwright/test');

const CASES = [
    {
        path: '/es/',
        expectedText: 'Hola, me gustaria agendar una evaluacion dermatologica',
    },
    {
        path: '/en/',
        expectedText: "Hello, I'd like to book a dermatology evaluation",
    },
    {
        path: '/es/servicios/',
        expectedText:
            'Hola, necesito ayuda para elegir la especialidad dermatologica adecuada',
    },
    {
        path: '/en/services/',
        expectedText:
            'Hello, I need help choosing the right dermatology specialty',
    },
    {
        path: '/es/servicios/acne-rosacea/',
        expectedText: 'Hola, me interesa una consulta sobre acne',
    },
    {
        path: '/en/services/acne-rosacea/',
        expectedText: "Hello, I'm interested in an acne consultation",
    },
    {
        path: '/es/servicios/laser-dermatologico/',
        expectedText: 'Hola, quiero informacion sobre tratamiento laser',
    },
    {
        path: '/en/services/laser-dermatologico/',
        expectedText: "Hello, I'd like information about laser treatment",
    },
    {
        path: '/es/telemedicina/',
        expectedText: 'Hola, me interesa una orientacion por teledermatologia',
    },
    {
        path: '/en/telemedicine/',
        expectedText: "Hello, I'm interested in a teledermatology consultation",
    },
    {
        path: '/es/software/turnero-clinicas/',
        expectedIncludes: 'Flow OS',
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
        });
    }
});
