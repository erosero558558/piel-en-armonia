// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const bookingFormSource = fs.readFileSync(
    path.resolve(__dirname, '../src/apps/booking/modules/booking-form.js'),
    'utf8'
);

const harnessScript = `${bookingFormSource.replace(
    'export function init',
    'function init'
)}
window.__BookingGiftCardHarnessModule = { init };`;

test.use({ serviceWorkers: 'block' });

const HARNESS_HTML = `
    <!doctype html>
    <html lang="es">
        <body>
            <form id="v5-booking-form" class="appointment-form">
                <div id="v5-booking-feedback" class="booking-inline-feedback is-hidden"></div>
                <div class="form-group">
                    <select id="v5-service-select" name="service" required>
                        <option value="">Selecciona</option>
                        <option
                            value="consulta"
                            data-price="40"
                            data-service-tax="0"
                            data-price-total="40"
                            data-price-rule="base_plus_tax"
                            data-price-label-short="Consulta general"
                            data-price-disclaimer="Monto visible"
                            data-service-type="clinical"
                            data-duration-min="30"
                            selected
                        >
                            Consulta
                        </option>
                    </select>
                </div>
                <div id="priceSummary" class="is-hidden"></div>
                <span id="subtotalPrice"></span>
                <span id="ivaPrice"></span>
                <span id="totalPrice"></span>
                <span id="selectedPriceLabel"></span>
                <span id="selectedPriceRule"></span>
                <span id="selectedServiceMeta"></span>
                <span id="selectedPriceDisclaimer"></span>
                <p id="priceHint"></p>

                <div class="form-group">
                    <select id="v5-doctor-select" name="doctor" required>
                        <option value="">Selecciona</option>
                        <option value="rosero" selected>Rosero</option>
                    </select>
                </div>

                <div class="form-group">
                    <input id="v5-date" type="date" name="date" required value="2026-04-05" />
                </div>
                <div class="form-group">
                    <select id="v5-time" name="time" required>
                        <option value="">Selecciona</option>
                        <option value="10:00" selected>10:00</option>
                    </select>
                </div>

                <div class="form-group">
                    <input name="name" value="Paciente Demo" required />
                </div>
                <div class="form-group">
                    <input name="email" type="email" value="paciente@example.com" required />
                </div>
                <div class="form-group">
                    <input name="phone" value="0991234567" required />
                </div>
                <div class="form-group">
                    <input id="bookingGiftCardCode" name="giftCardCode" value="" />
                    <div id="bookingGiftCardFeedback" class="booking-inline-feedback is-hidden"></div>
                </div>
                <div class="form-group">
                    <textarea name="reason">Brote facial</textarea>
                </div>
                <div class="form-group">
                    <select name="affectedArea">
                        <option value="">Selecciona</option>
                        <option value="rostro" selected>Rostro</option>
                    </select>
                </div>
                <div class="form-group">
                    <select name="evolutionTime">
                        <option value="">Selecciona</option>
                        <option value="1_4_semanas" selected>1-4 semanas</option>
                    </select>
                </div>
                <div class="form-group">
                    <input id="casePhotos" name="casePhotos" type="file" multiple />
                </div>
                <div class="form-consent">
                    <input id="privacyConsent" name="privacyConsent" type="checkbox" checked required />
                </div>
                <button type="submit">Continuar</button>
            </form>
        </body>
    </html>
`;

test('valida la gift card en tiempo real y la adjunta a la cita antes del checkout', async ({
    page,
}) => {
    await page.setContent(HARNESS_HTML);
    await page.addScriptTag({ content: harnessScript, type: 'module' });

    await page.evaluate(() => {
        const state = {
            validatedCodes: [],
            currentAppointment: null,
            openPaymentModalCalls: 0,
            checkoutSessions: [],
            trackedEvents: [],
            toasts: [],
        };

        window.__bookingGiftCardHarness = state;
        window.__BookingGiftCardHarnessModule.init({
            getCurrentLang: () => 'es',
            updateAvailableTimes: async () => {},
            getBookedSlots: async () => [],
            validateGiftCard: async (code) => {
                state.validatedCodes.push(code);
                return {
                    code,
                    status: 'active',
                    balance_cents: 6000,
                    recipient_name: 'Paciente Demo',
                    giftCard: {
                        code,
                        status: 'active',
                        balance_cents: 6000,
                        recipient_name: 'Paciente Demo',
                    },
                };
            },
            getCasePhotoFiles: () => [],
            validateCasePhotoFiles: () => {},
            markBookingViewed: () => {},
            setCurrentAppointment: (appointment) => {
                state.currentAppointment = { ...appointment };
            },
            startCheckoutSession: (appointment, metadata = {}) => {
                state.checkoutSessions.push({
                    appointment: { ...appointment },
                    metadata: { ...metadata },
                });
            },
            setCheckoutStep: () => {},
            trackEvent: (name, payload = {}) => {
                state.trackedEvents.push({
                    name,
                    payload: { ...payload },
                });
            },
            normalizeAnalyticsLabel: (value, fallback) =>
                String(value || fallback || 'unknown'),
            openPaymentModal: () => {
                state.openPaymentModalCalls += 1;
            },
            showToast: (message, type) => {
                state.toasts.push({ message, type });
            },
            debugLog: () => {},
        });
    });

    await page.locator('#bookingGiftCardCode').fill('aur gift ab12 cd34');
    await expect(page.locator('#bookingGiftCardFeedback')).toContainText(
        'Gift card valida. Saldo disponible $60.00.'
    );

    await page.locator('#v5-booking-form').evaluate((form) => {
        form.requestSubmit();
    });

    await expect
        .poll(() =>
            page.evaluate(() => window.__bookingGiftCardHarness.openPaymentModalCalls)
        )
        .toBe(1);

    const state = await page.evaluate(() => window.__bookingGiftCardHarness);
    expect(state.validatedCodes).toContain('AURGIFTAB12CD34');
    expect(state.currentAppointment.giftCardCode).toBe('AURGIFTAB12CD34');
    expect(state.currentAppointment.giftCardBalanceCents).toBe(6000);
    expect(state.currentAppointment.giftCardRecipientName).toBe(
        'Paciente Demo'
    );
    expect(state.checkoutSessions).toHaveLength(1);
});
