// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const bookingEngineScript = fs.readFileSync(
    path.resolve(__dirname, '../src/apps/booking/engine.js'),
    'utf8'
);

test.use({ serviceWorkers: 'block' });

const HARNESS_HTML = `
    <!doctype html>
    <html lang="es">
        <body>
            <form id="v5-booking-form">
                <input name="name" value="Paciente Critical Payments" />
            </form>
            <div id="priceSummary"></div>
            <div id="paymentError" class="is-hidden"></div>
            <div id="successModal"></div>
            <div id="v5-payment-modal" class="modal">
                <div class="payment-method active" data-method="card"></div>
                <div class="payment-method" data-method="transfer"></div>
                <div class="payment-method" data-method="cash"></div>
                <div class="payment-form card-form">
                    <input id="cardholderName" value="" />
                    <div id="stripeCardElement"></div>
                </div>
                <div class="payment-form transfer-form is-hidden">
                    <input id="transferReference" value="" />
                    <input id="transferProofFile" type="file" />
                    <span id="transferProofFileName"></span>
                </div>
                <div class="payment-form cash-form is-hidden"></div>
                <div id="v5-payment-total"></div>
                <button type="button" class="btn-primary" data-action="process-payment">
                    Pagar ahora
                </button>
            </div>
        </body>
    </html>
`;

async function bootHarness(page) {
    await page.setContent(HARNESS_HTML);

    await page.evaluate(() => {
        const initialAppointment = {
            service: 'consulta',
            doctor: 'rosero',
            date: '2026-03-18',
            time: '10:00',
            name: 'Paciente Critical Payments',
            email: 'critical-payments@example.com',
            phone: '+593999999999',
            reason: 'Reserva validada desde el gate critico de pagos',
            price: '$40.00',
            status: 'draft',
            checkoutEntry: 'booking_form',
        };

        window.__paymentsHarness = {
            currentAppointment: { ...initialAppointment },
            checkoutSession: {
                active: false,
                startedAt: 0,
                entry: '',
                completedWith: '',
                steps: [],
            },
            createAppointmentOptions: null,
            createdAppointmentPayload: null,
            paymentIntentPayload: null,
            verifiedPaymentIntentId: '',
            verifyCalls: 0,
            captchaActions: [],
            toasts: [],
            trackedEvents: [],
            successModalEmailSent: null,
            cardMountTarget: '',
            confirmedPayment: null,
        };

        window.Stripe = function StripeMock(publishableKey) {
            window.__paymentsHarness.publishableKey = publishableKey;
            return {
                elements() {
                    return {
                        create() {
                            return {
                                mount(selector) {
                                    window.__paymentsHarness.cardMountTarget =
                                        selector;
                                },
                                clear() {
                                    window.__paymentsHarness.cardCleared = true;
                                },
                                on() {},
                            };
                        },
                    };
                },
                async confirmCardPayment(clientSecret, options) {
                    window.__paymentsHarness.confirmedPayment = {
                        clientSecret,
                        billingDetails:
                            options &&
                            options.payment_method &&
                            options.payment_method.billing_details
                                ? {
                                      ...options.payment_method.billing_details,
                                  }
                                : null,
                    };
                    return {
                        paymentIntent: {
                            id: 'pi_test_id',
                            status: 'succeeded',
                        },
                    };
                },
            };
        };
    });

    await page.addScriptTag({ content: bookingEngineScript, type: 'module' });
    await page.waitForFunction(
        () => typeof window.PielBookingEngine !== 'undefined'
    );

    await page.evaluate(() => {
        const state = window.__paymentsHarness;

        const normalizeAnalyticsLabel = (value, fallback) => {
            const normalized = String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '');
            return normalized || fallback || 'unknown';
        };

        window.PielBookingEngine.init({
            getCurrentLang: () => 'es',
            getCurrentAppointment: () => state.currentAppointment,
            setCurrentAppointment: (appointment) => {
                state.currentAppointment = { ...appointment };
            },
            setCheckoutSessionActive: (active) => {
                state.checkoutSession.active = active === true;
            },
            setCheckoutStep: (step, payload = {}) => {
                state.checkoutSession.steps.push({
                    step,
                    payload: { ...payload },
                });
            },
            showToast: (message, type = 'info') => {
                state.toasts.push({ message, type });
            },
            trackEvent: (eventName, payload = {}) => {
                state.trackedEvents.push({
                    event: eventName,
                    payload: { ...payload },
                });
            },
            normalizeAnalyticsLabel,
            debugLog: () => {},
            getCaptchaToken: async (action) => {
                state.captchaActions.push(action);
                return `captcha_${action}`;
            },
            loadPaymentConfig: async () => ({
                enabled: true,
                provider: 'stripe',
                publishableKey: 'pk_test_critical',
                currency: 'USD',
            }),
            loadStripeSdk: async () => true,
            getCheckoutSession: () => state.checkoutSession,
            startCheckoutSession: (_appointment, metadata = {}) => {
                state.checkoutSession.active = true;
                state.checkoutSession.startedAt = Date.now();
                state.checkoutSession.entry = metadata.checkoutEntry || '';
                state.checkoutSession.startMetadata = { ...metadata };
            },
            maybeTrackCheckoutAbandon: (reason) => {
                state.checkoutSession.abandonReason = reason;
            },
            buildAppointmentPayload: async (appointment) => ({
                ...appointment,
            }),
            stripTransientAppointmentFields: (appointment) => ({
                ...appointment,
            }),
            createPaymentIntent: async (payload) => {
                state.paymentIntentPayload = { ...payload };
                return {
                    clientSecret: 'pi_test_secret',
                    paymentIntentId: 'pi_test_id',
                };
            },
            verifyPaymentIntent: async (paymentIntentId) => {
                state.verifyCalls += 1;
                state.verifiedPaymentIntentId = paymentIntentId;
                return { paid: true };
            },
            createAppointmentRecord: async (payload, options = {}) => {
                state.createdAppointmentPayload = { ...payload };
                state.createAppointmentOptions = { ...options };
                return {
                    appointment: {
                        id: 101,
                        ...payload,
                    },
                    emailSent: false,
                };
            },
            uploadTransferProof: async () => ({
                transferProofPath: '/uploads/test-proof.png',
                transferProofUrl: '/uploads/test-proof.png',
            }),
            completeCheckoutSession: (method) => {
                state.checkoutSession.completedWith = method;
                state.checkoutSession.active = false;
            },
            showSuccessModal: (emailSent) => {
                state.successModalEmailSent = emailSent;
                const modal = document.getElementById('successModal');
                if (modal) {
                    modal.classList.add('active');
                }
            },
        });

        window.PielBookingEngine.openPaymentModal(state.currentAppointment);
    });
}

async function readHarnessState(page) {
    return page.evaluate(() => window.__paymentsHarness);
}

test.describe('Critical payments booking engine flow', () => {
    test('procesa el pago con tarjeta y registra una cita confirmada', async ({
        page,
    }) => {
        await bootHarness(page);

        await expect(page.locator('#v5-payment-modal.active')).toBeVisible();
        await expect(
            page.locator('.payment-method.active[data-method="card"]')
        ).toHaveAttribute('data-method', 'card');
        await expect(page.locator('#cardholderName')).toHaveValue(
            'Paciente Critical Payments'
        );
        await expect(page.locator('#v5-payment-total')).toHaveText('$40.00');

        await page.evaluate(() => window.PielBookingEngine.processPayment());

        const state = await readHarnessState(page);

        expect(state.cardMountTarget).toBe('#stripeCardElement');
        expect(state.publishableKey).toBe('pk_test_critical');
        expect(state.captchaActions).toEqual([
            'payment_intent',
            'appointment_submit',
        ]);
        expect(state.paymentIntentPayload).toEqual(
            expect.objectContaining({
                service: 'consulta',
                doctor: 'rosero',
                date: '2026-03-18',
                time: '10:00',
                captchaToken: 'captcha_payment_intent',
            })
        );
        expect(state.confirmedPayment).toEqual(
            expect.objectContaining({
                clientSecret: 'pi_test_secret',
                billingDetails: expect.objectContaining({
                    name: 'Paciente Critical Payments',
                    email: 'critical-payments@example.com',
                    phone: '+593999999999',
                }),
            })
        );
        expect(state.verifyCalls).toBe(1);
        expect(state.verifiedPaymentIntentId).toBe('pi_test_id');
        expect(state.createAppointmentOptions).toEqual({
            allowLocalFallback: false,
        });
        expect(state.createdAppointmentPayload).toEqual(
            expect.objectContaining({
                paymentMethod: 'card',
                paymentStatus: 'paid',
                paymentProvider: 'stripe',
                paymentIntentId: 'pi_test_id',
                status: 'confirmed',
                captchaToken: 'captcha_appointment_submit',
            })
        );
        expect(state.checkoutSession.completedWith).toBe('card');
        expect(state.successModalEmailSent).toBe(false);
        expect(state.toasts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: 'Pago aprobado y cita registrada.',
                    type: 'success',
                }),
            ])
        );
        expect(state.trackedEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'start_checkout',
                }),
                expect.objectContaining({
                    event: 'payment_method_selected',
                    payload: expect.objectContaining({
                        payment_method: 'card',
                    }),
                }),
                expect.objectContaining({
                    event: 'payment_success',
                    payload: expect.objectContaining({
                        payment_intent_id: 'pi_test_id',
                    }),
                }),
            ])
        );

        await expect(page.locator('#successModal')).toHaveClass(/active/);
        await expect(page.locator('#paymentError')).toHaveClass(/is-hidden/);
        await expect(page.locator('#v5-payment-modal')).not.toHaveClass(
            /active/
        );
    });
});
