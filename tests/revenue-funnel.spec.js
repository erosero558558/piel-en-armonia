// @ts-check
const { test, expect } = require('@playwright/test');
const { getTrackedEvents } = require('./helpers/public-v6');

test.use({ serviceWorkers: 'block' });

async function seedRevenueAnalytics(page) {
    await page.addInitScript(() => {
        localStorage.setItem(
            'pa_cookie_consent_v1',
            JSON.stringify({
                status: 'accepted',
                at: new Date().toISOString(),
            })
        );
        window.dataLayer = [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };
    });
}

async function preventNextNavigation(locator) {
    await locator.evaluate((node) => {
        node.addEventListener(
            'click',
            (event) => {
                event.preventDefault();
            },
            { once: true }
        );
    });
}

test.describe('Revenue funnel GA4 tracking', () => {
    test('paquetes registra visita, scroll, click y mensaje al abrir WhatsApp', async ({
        page,
    }) => {
        await seedRevenueAnalytics(page);
        await page.goto('/es/paquetes/', { waitUntil: 'domcontentloaded' });

        await page.waitForFunction(
            () => typeof window.AuroraRevenueFunnel === 'object'
        );

        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });

        const whatsappLink = page
            .locator('.packages-cta__actions a[href*="wa.me/"]')
            .first();
        await preventNextNavigation(whatsappLink);
        await whatsappLink.click();

        await expect
            .poll(async () => (await getTrackedEvents(page, 'revenue_page_visit')).length)
            .toBeGreaterThan(0);

        const visitEvents = await getTrackedEvents(page, 'revenue_page_visit');
        const scrollEvents = await getTrackedEvents(page, 'revenue_page_scroll');
        const clickEvents = await getTrackedEvents(page, 'revenue_whatsapp_click');
        const messageEvents = await getTrackedEvents(page, 'revenue_message_intent');

        expect(visitEvents.at(-1)?.revenue_page).toBe('paquetes');
        expect(scrollEvents.at(-1)?.scroll_depth_percent).toBeGreaterThanOrEqual(45);
        expect(clickEvents.at(-1)?.cta_label).toBe('hablar_con_la_clinica');
        expect(messageEvents.at(-1)?.message_channel).toBe('whatsapp_prefill');
    });

    test('gift cards registra el CTA dinámico de WhatsApp con mensaje prefijado', async ({
        page,
    }) => {
        await seedRevenueAnalytics(page);
        await page.goto('/es/gift-cards/', { waitUntil: 'domcontentloaded' });

        await page.locator('#gift-recipient').fill('Paciente Demo');
        await page.locator('#gift-sender').fill('Aurora Demo');
        await page.locator('#gift-note').fill('Para tu siguiente consulta con calma.');
        await page.locator('#gift-card-form').evaluate((form) => form.requestSubmit());

        const whatsappLink = page.locator('#gift-whatsapp');
        await expect(whatsappLink).toHaveAttribute('aria-disabled', 'false');
        await preventNextNavigation(whatsappLink);
        await whatsappLink.click();

        await expect
            .poll(async () => (await getTrackedEvents(page, 'revenue_whatsapp_click')).length)
            .toBeGreaterThan(0);

        const clickEvents = await getTrackedEvents(page, 'revenue_whatsapp_click');
        const messageEvents = await getTrackedEvents(page, 'revenue_message_intent');

        expect(clickEvents.at(-1)?.revenue_page).toBe('gift_cards');
        expect(clickEvents.at(-1)?.cta_label).toBe('enviar_por_whatsapp');
        expect(messageEvents.at(-1)?.message_channel).toBe('whatsapp_prefill');
        expect(messageEvents.at(-1)?.message_length).toBeGreaterThan(20);
    });
});
