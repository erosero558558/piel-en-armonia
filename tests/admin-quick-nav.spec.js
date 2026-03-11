// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildDataPayload() {
    return {
        ok: true,
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {},
            availabilityMeta: {
                source: 'store',
                mode: 'live',
                timezone: 'America/Guayaquil',
                calendarConfigured: true,
                calendarReachable: true,
                generatedAt: new Date().toISOString(),
            },
        },
    };
}

function buildFunnelPayload() {
    return {
        ok: true,
        data: {
            summary: {
                viewBooking: 0,
                startCheckout: 0,
                bookingConfirmed: 0,
                checkoutAbandon: 0,
                startRatePct: 0,
                confirmedRatePct: 0,
                abandonRatePct: 0,
            },
            checkoutAbandonByStep: [],
            checkoutEntryBreakdown: [],
            paymentMethodBreakdown: [],
            bookingStepBreakdown: [],
            sourceBreakdown: [],
            abandonReasonBreakdown: [],
            errorCodeBreakdown: [],
        },
    };
}

async function setupAdminApiMocks(page) {
    const agentSessionId = 'ags_test_quick_nav';

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'data') {
            return jsonResponse(route, buildDataPayload());
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: buildDataPayload().data.availabilityMeta,
            });
        }

        if (resource === 'admin-agent-status') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    session: null,
                    health: {
                        relay: {
                            mode: 'online',
                        },
                    },
                    tools: [],
                },
            });
        }

        if (resource === 'admin-agent-session-start') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    session: {
                        sessionId: agentSessionId,
                        status: 'active',
                        riskMode: 'autopilot_partial',
                    },
                    context: {
                        section: 'dashboard',
                    },
                    messages: [],
                    turns: [],
                    toolCalls: [],
                    approvals: [],
                    events: [],
                    health: {
                        relay: {
                            mode: 'online',
                        },
                    },
                    tools: [],
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

test.describe('Admin navigation desktop', () => {
    test('sidebar keeps section and hash in sync', async ({ page }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        const primaryNav = page.locator('#adminPrimaryNav');
        await expect(primaryNav).toBeVisible();

        const availabilityNavItem = primaryNav.locator(
            '.nav-item[data-section="availability"]'
        );
        await availabilityNavItem.click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
        await expect(availabilityNavItem).toHaveClass(/active/);
        await expect(availabilityNavItem).toHaveAttribute(
            'aria-current',
            'page'
        );
        await expect(page.locator('#pageTitle')).toHaveText('Horarios');
    });

    test('keyboard shortcuts navigate sections but ignore focused inputs', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#appointments$/);

        await page.locator('#searchAppointments').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#appointments')).toHaveClass(/active/);

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
    });

    test('Ctrl+K abre el copiloto y la paleta rapida sigue disponible por boton', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminAgentPanel')).toHaveClass(/is-hidden/);

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminAgentPanel')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminAgentPrompt')).toBeFocused();

        await page
            .locator('button[data-action="open-command-palette"]')
            .click();
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminQuickCommand')).toBeFocused();
    });
});
