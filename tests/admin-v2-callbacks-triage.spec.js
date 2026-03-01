// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 920 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function isoMinutesAgo(minutesAgo) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildCallbacksSeed() {
    return [
        {
            id: 401,
            telefono: '+593 98 111 2222',
            preferencia: 'ahora',
            fecha: isoMinutesAgo(260),
            status: 'pending',
        },
        {
            id: 402,
            telefono: '+593 97 333 4444',
            preferencia: '30min',
            fecha: isoMinutesAgo(70),
            status: 'pending',
        },
        {
            id: 403,
            telefono: '+593 96 555 6666',
            preferencia: '1hora',
            fecha: isoMinutesAgo(320),
            status: 'contactado',
        },
        {
            id: 404,
            telefono: '+593 95 777 8888',
            preferencia: '15min',
            fecha: isoMinutesAgo(12),
            status: 'pendiente',
        },
    ];
}

async function setupSonyV2CallbacksMocks(page) {
    const state = {
        callbacks: buildCallbacksSeed(),
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
    };

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();
        const method = route.request().method().toUpperCase();

        let payload = {};
        if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
            try {
                payload = route.request().postDataJSON() || {};
            } catch (_error) {
                payload = {};
            }
        }

        const intendedMethod = String(payload._method || method).toUpperCase();

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    appointments: [],
                    callbacks: state.callbacks,
                    reviews: [],
                    availability: {},
                    availabilityMeta: state.availabilityMeta,
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
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
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: state.availabilityMeta,
            });
        }

        if (
            resource === 'callbacks' &&
            (method === 'PATCH' ||
                method === 'POST' ||
                intendedMethod === 'PATCH')
        ) {
            const callbackId = Number(payload.id || 0);
            const nextStatus = String(payload.status || 'contacted');
            state.callbacks = state.callbacks.map((item) =>
                Number(item.id || 0) === callbackId
                    ? {
                          ...item,
                          status: nextStatus,
                      }
                    : item
            );
            const updated = state.callbacks.find(
                (item) => Number(item.id || 0) === callbackId
            );
            return jsonResponse(route, { ok: true, data: updated || {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openCallbacksSectionSonyV2(page) {
    await setupSonyV2CallbacksMocks(page);
    await page.goto('/admin.html?admin_ui=sony_v2');

    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v2'
    );
    await expect(page.locator('#adminDashboard')).toBeVisible();

    await page.keyboard.press('Alt+Shift+Digit3');
    await expect(page.locator('#callbacks')).toHaveClass(/active/);
    await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(4);
}

test.describe('Admin callbacks triage sony_v2', () => {
    test('aplica filtro urgente SLA, orden por espera y persiste orden en recarga', async ({
        page,
    }) => {
        await openCallbacksSectionSonyV2(page);

        await page
            .locator(
                '[data-action="callback-quick-filter"][data-filter-value="pending"]'
            )
            .click();
        await expect(page.locator('#callbackFilter')).toHaveValue('pending');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            3
        );

        await page.locator('#callbackSort').selectOption('waiting_desc');
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Orden: Mayor espera (SLA)'
        );
        await expect(
            page.locator('#callbacksGrid .callback-card').first().locator('h4')
        ).toHaveText('+593 98 111 2222');

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+U');
        await expect(page.locator('#callbackFilter')).toHaveValue('sla_urgent');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            1
        );
        await expect(page.locator('#callbacksToolbarState')).toContainText(
            'Urgentes SLA'
        );

        await page.reload();
        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ui',
            'sony_v2'
        );
        await page.keyboard.press('Alt+Shift+Digit3');
        await expect(page.locator('#callbackSort')).toHaveValue('waiting_desc');
    });

    test('bulk select/clear/mark actualiza seleccion y drena pendientes', async ({
        page,
    }) => {
        await openCallbacksSectionSonyV2(page);

        await page
            .locator(
                '[data-action="callback-quick-filter"][data-filter-value="pending"]'
            )
            .click();
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            3
        );

        await page.locator('#callbacksBulkSelectVisibleBtn').click();
        await expect(page.locator('#callbacksSelectedCount')).toHaveText('3');
        await expect(page.locator('#callbacksSelectionChip')).not.toHaveClass(
            /is-hidden/
        );

        await page.locator('#callbacksBulkClearBtn').click();
        await expect(page.locator('#callbacksSelectedCount')).toHaveText('0');
        await expect(page.locator('#callbacksSelectionChip')).toHaveClass(
            /is-hidden/
        );

        await page.locator('#callbacksBulkSelectVisibleBtn').click();
        await page.locator('#callbacksBulkMarkBtn').click();

        await expect(page.locator('#callbacksOpsPendingCount')).toHaveText('0');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            0
        );
        await expect(page.locator('#callbacksToolbarMeta')).toContainText(
            'Mostrando 0 de 4'
        );

        await page.locator('#callbackFilter').selectOption('contacted');
        await expect(page.locator('#callbacksGrid .callback-card')).toHaveCount(
            4
        );
        await expect(page.locator('#callbacksToolbarMeta')).toContainText(
            'Mostrando 4 de 4'
        );
    });
});
