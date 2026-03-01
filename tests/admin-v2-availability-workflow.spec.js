// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 920 },
});

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
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

function createAvailabilitySeed() {
    const dayOne = new Date();
    dayOne.setDate(dayOne.getDate() + 1);
    const dayTwo = new Date();
    dayTwo.setDate(dayTwo.getDate() + 4);
    return {
        [toDateKey(dayOne)]: ['09:00', '10:00'],
        [toDateKey(dayTwo)]: ['16:30'],
    };
}

async function setupSonyV2AvailabilityMocks(page, sourceMode = 'store') {
    const state = {
        availability: createAvailabilitySeed(),
        availabilityMeta: {
            source: sourceMode === 'google' ? 'google' : 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            calendarAuth: sourceMode === 'google' ? 'oauth_refresh' : 'none',
            generatedAt: new Date().toISOString(),
            calendarLastSuccessAt: new Date().toISOString(),
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
        if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
            try {
                payload = route.request().postDataJSON() || {};
            } catch (_error) {
                payload = {};
            }
        }

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
                    callbacks: [],
                    reviews: [],
                    availability: state.availability,
                    availabilityMeta: state.availabilityMeta,
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            if (method === 'POST') {
                const nextAvailability =
                    payload &&
                    typeof payload === 'object' &&
                    payload.availability &&
                    typeof payload.availability === 'object'
                        ? payload.availability
                        : {};
                state.availability = nextAvailability;
                state.availabilityMeta = {
                    ...state.availabilityMeta,
                    generatedAt: new Date().toISOString(),
                };
            }
            return jsonResponse(route, {
                ok: true,
                data: state.availability,
                meta: state.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openAvailabilitySonyV2(page, sourceMode = 'store') {
    await setupSonyV2AvailabilityMocks(page, sourceMode);
    await page.goto('/admin.html?admin_ui=sony_v2');

    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        'sony_v2'
    );
    await expect(page.locator('#adminDashboard')).toBeVisible();

    await page.keyboard.press('Alt+Shift+Digit5');
    await expect(page.locator('#availability')).toHaveClass(/active/);
    await expect(
        page.locator('#availabilityCalendar .calendar-day')
    ).toHaveCount(42);
}

test.describe('Admin availability sony_v2', () => {
    test('workflow editable persiste fecha seleccionada y protege salida con borrador pendiente', async ({
        page,
    }) => {
        await openAvailabilitySonyV2(page, 'store');

        await expect(page.locator('#availabilityHeading')).toContainText(
            'Configurar Horarios Disponibles'
        );
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Fuente: Local');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Modo: Editable');

        const firstSlotDay = page
            .locator('#availabilityCalendar .calendar-day.has-slots')
            .first();
        await expect(firstSlotDay).toBeVisible();
        await firstSlotDay.click();

        const selectedDate = (
            (await page.locator('#selectedDate').textContent()) || ''
        ).trim();
        expect(selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        await page
            .locator(
                '#availabilityDayActions [data-action="copy-availability-day"]'
            )
            .click();
        await expect(
            page.locator('#availabilityDayActionsStatus')
        ).toContainText('Portapapeles:');

        await page
            .locator(
                '#availabilityDayActions [data-action="duplicate-availability-next-week"]'
            )
            .click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeEnabled();

        let dismissedNavigationPrompt = false;
        page.once('dialog', async (dialog) => {
            dismissedNavigationPrompt = true;
            expect(dialog.message()).toContain('cambios pendientes');
            await dialog.dismiss();
        });
        await page.locator('.nav-item[data-section="appointments"]').click();
        expect(dismissedNavigationPrompt).toBe(true);
        await expect(page.locator('#availability')).toHaveClass(/active/);

        let acceptedNavigationPrompt = false;
        page.once('dialog', async (dialog) => {
            acceptedNavigationPrompt = true;
            await dialog.accept();
        });
        await page.locator('.nav-item[data-section="appointments"]').click();
        expect(acceptedNavigationPrompt).toBe(true);
        await expect(page.locator('#appointments')).toHaveClass(/active/);

        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);

        await page.locator('#availabilitySaveDraftBtn').click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'Sin cambios pendientes'
        );

        const expectedPersistedDate = (
            (await page.locator('#selectedDate').textContent()) || ''
        ).trim();
        const prefs = await page.evaluate(() => ({
            selectedDate: localStorage.getItem(
                'admin-availability-selected-date'
            ),
            monthAnchor: localStorage.getItem(
                'admin-availability-month-anchor'
            ),
        }));

        expect(prefs.selectedDate).toBe(expectedPersistedDate);
        expect(String(prefs.monthAnchor || '')).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        await page.reload();
        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ui',
            'sony_v2'
        );

        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page.locator('#selectedDate')).toHaveText(
            expectedPersistedDate
        );
    });

    test('readonly google bloquea edicion y muestra resumen de fuente/modo', async ({
        page,
    }) => {
        await openAvailabilitySonyV2(page, 'google');

        await expect(page.locator('#availabilityHeading')).toContainText(
            'Solo lectura'
        );
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Fuente: Google Calendar');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Modo: Solo lectura');
        await expect(page.locator('#availabilitySyncStatus')).toContainText(
            'Google Calendar'
        );

        await expect(page.locator('#addSlotForm')).toHaveClass(/is-hidden/);
        await expect(page.locator('#availabilityQuickSlotPresets')).toHaveClass(
            /is-hidden/
        );

        await expect(
            page.locator(
                '#availabilityDayActions [data-action="copy-availability-day"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="paste-availability-day"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="clear-availability-week"]'
            )
        ).toBeDisabled();
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeDisabled();
        await expect(
            page.locator('#availabilityDiscardDraftBtn')
        ).toBeDisabled();
    });

    test('acciones destructivas requieren confirmacion explicita', async ({
        page,
    }) => {
        await openAvailabilitySonyV2(page, 'store');

        const firstSlotDay = page
            .locator('#availabilityCalendar .calendar-day.has-slots')
            .first();
        await firstSlotDay.click();

        const slotItems = page.locator('#timeSlotsList .time-slot-item');
        const initialCount = await slotItems.count();
        expect(initialCount).toBeGreaterThan(0);

        page.once('dialog', async (dialog) => {
            expect(dialog.message()).toContain(
                'Se eliminaran los slots del dia'
            );
            await dialog.dismiss();
        });
        await page
            .locator(
                '#availabilityDayActions [data-action="clear-availability-day"]'
            )
            .click();
        await expect(slotItems).toHaveCount(initialCount);

        page.once('dialog', async (dialog) => {
            await dialog.accept();
        });
        await page
            .locator(
                '#availabilityDayActions [data-action="clear-availability-day"]'
            )
            .click();
        await expect(slotItems).toHaveCount(0);
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );

        await page
            .locator(
                '#availabilityQuickSlotPresets .slot-preset-btn[data-time="09:00"]'
            )
            .click();
        await page.locator('[data-action="add-time-slot"]').click();
        await expect(slotItems).toHaveCount(1);

        page.once('dialog', async (dialog) => {
            expect(dialog.message()).toContain('semana');
            await dialog.accept();
        });
        await page
            .locator(
                '#availabilityDayActions [data-action="clear-availability-week"]'
            )
            .click();
        await expect(slotItems).toHaveCount(0);

        page.once('dialog', async (dialog) => {
            expect(dialog.message()).toContain(
                'descartaran los cambios pendientes'
            );
            await dialog.dismiss();
        });
        await page.locator('#availabilityDiscardDraftBtn').click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );

        page.once('dialog', async (dialog) => {
            await dialog.accept();
        });
        await page.locator('#availabilityDiscardDraftBtn').click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'Sin cambios pendientes'
        );
    });
});
