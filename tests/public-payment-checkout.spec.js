// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForShellV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public payment checkout page', () => {
    test('renders the integrated checkout and prefills amount + concept from query params', async ({
        page,
    }) => {
        await page.route('**/api.php?resource=checkout-config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        currency: 'USD',
                        stripeEnabled: true,
                        publishableKey: 'pk_test_checkout',
                        bank: {
                            bankName: 'Banco Pichincha',
                            account: 'Cuenta de Ahorros: 2200160272',
                            owner: 'Titular: Rosero Caiza Javier Alejandro',
                        },
                    },
                }),
            });
        });

        await page.addInitScript(() => {
            window.Stripe = function StripeMock() {
                return {
                    elements() {
                        return {
                            create() {
                                return {
                                    mount() {},
                                };
                            },
                        };
                    },
                };
            };
        });

        await gotoPublicRoute(
            page,
            '/es/pago/?concept=Control%20de%20rosacea&amount=45.00&name=Ana%20Perez'
        );
        await waitForShellV6Runtime(page);

        await expect(page.locator('body')).toHaveAttribute(
            'data-public-template-id',
            'payment_checkout_v6'
        );
        await expect(page.locator('h1')).toContainText('Checkout dermatologico');
        await expect(page.locator('[data-checkout-method]')).toHaveCount(3);
        await expect(page.locator('#checkout-concept')).toHaveValue(
            'Control de rosacea'
        );
        await expect(page.locator('#checkout-amount')).toHaveValue('45.00');
        await expect(page.locator('#checkout-name')).toHaveValue('Ana Perez');
        await expect(
            page.locator('[data-checkout-summary-amount]')
        ).toContainText('$45.00');
    });

    test('submits manual cash checkout and renders the digital receipt', async ({
        page,
    }) => {
        await page.route('**/api.php?resource=checkout-config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        currency: 'USD',
                        stripeEnabled: false,
                        publishableKey: '',
                        bank: {
                            bankName: 'Banco Pichincha',
                            account: 'Cuenta de Ahorros: 2200160272',
                            owner: 'Titular: Rosero Caiza Javier Alejandro',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=checkout-submit', async (route) => {
            const payload = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        receipt: {
                            receiptNumber: 'PAY-20260330-CASH01',
                            concept: payload.concept,
                            amountLabel: '$40.00',
                            paymentMethodLabel: 'Efectivo en consultorio',
                            paymentStatusLabel: 'Pendiente de pago en consultorio',
                            issuedAt: '2026-03-30T10:15:00-05:00',
                            payer: {
                                name: payload.name,
                                whatsapp: payload.whatsapp,
                            },
                        },
                    },
                }),
            });
        });

        await gotoPublicRoute(page, '/es/pago/');
        await waitForShellV6Runtime(page);

        await page.locator('[data-checkout-method="cash"]').click();
        await page.locator('#checkout-concept').fill('Consulta dermatologica');
        await page.locator('#checkout-amount').fill('40.00');
        await page.locator('#checkout-name').fill('Paciente Caja');
        await page.locator('#checkout-whatsapp').fill('+593999999999');
        await page.locator('[data-checkout-submit]').click();

        await expect(page.locator('[data-checkout-status]')).toContainText(
            'Checkout generado correctamente'
        );
        await expect(page.locator('[data-checkout-receipt]')).toBeVisible();
        await expect(
            page.locator('[data-checkout-receipt-number]')
        ).toContainText('PAY-20260330-CASH01');
        await expect(
            page.locator('[data-checkout-receipt-status]')
        ).toContainText('Pendiente de pago en consultorio');
    });

    test('uploads transfer proof on top of the generated checkout receipt', async ({
        page,
    }) => {
        await page.route('**/api.php?resource=checkout-config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        currency: 'USD',
                        stripeEnabled: false,
                        publishableKey: '',
                        bank: {
                            bankName: 'Banco Pichincha',
                            account: 'Cuenta de Ahorros: 2200160272',
                            owner: 'Titular: Rosero Caiza Javier Alejandro',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=checkout-submit', async (route) => {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        order: {
                            id: 'co_transfer_001',
                        },
                        receipt: {
                            receiptNumber: 'PAY-20260330-TRF01',
                            concept: 'Saldo peeling',
                            amountLabel: '$95.00',
                            paymentMethod: 'transfer',
                            paymentMethodLabel: 'Transferencia',
                            paymentStatusLabel: 'Pendiente de transferencia',
                            issuedAt: '2026-03-30T10:45:00-05:00',
                            payer: {
                                name: 'Paciente Transferencia',
                                whatsapp: '+593999777666',
                            },
                        },
                    },
                }),
            });
        });

        await page.route(
            '**/api.php?resource=checkout-transfer-proof',
            async (route) => {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            order: {
                                id: 'co_transfer_001',
                            },
                            receipt: {
                                receiptNumber: 'PAY-20260330-TRF01',
                                concept: 'Saldo peeling',
                                amountLabel: '$95.00',
                                paymentMethod: 'transfer',
                                paymentMethodLabel: 'Transferencia',
                                paymentStatusLabel: 'Pendiente de verificacion',
                                issuedAt: '2026-03-30T10:45:00-05:00',
                                payer: {
                                    name: 'Paciente Transferencia',
                                    whatsapp: '+593999777666',
                                },
                                transferProofUrl:
                                    'https://pielarmonia.com/uploads/transfer-proofs/proof-001.png',
                            },
                        },
                    }),
                });
            }
        );

        await gotoPublicRoute(page, '/es/pago/');
        await waitForShellV6Runtime(page);

        await page.locator('[data-checkout-method="transfer"]').click();
        await page.locator('#checkout-concept').fill('Saldo peeling');
        await page.locator('#checkout-amount').fill('95.00');
        await page.locator('#checkout-name').fill('Paciente Transferencia');
        await page.locator('#checkout-whatsapp').fill('+593999777666');
        await page.locator('#checkout-transfer-reference').fill('TRX-VERIFY-01');
        await page.locator('[data-checkout-submit]').click();

        await expect(page.locator('[data-checkout-proof-card]')).toBeVisible();

        await page.locator('[data-checkout-proof-input]').setInputFiles({
            name: 'proof.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5qv6cAAAAASUVORK5CYII=',
                'base64'
            ),
        });
        await page.locator('[data-checkout-proof-submit]').click();

        await expect(page.locator('[data-checkout-proof-status]')).toContainText(
            'Comprobante recibido'
        );
        await expect(
            page.locator('[data-checkout-receipt-status]')
        ).toContainText('Pendiente de verificacion');
        await expect(page.locator('[data-checkout-proof-link]')).toHaveAttribute(
            'href',
            'https://pielarmonia.com/uploads/transfer-proofs/proof-001.png'
        );
    });

    test('processes card checkout and upgrades the receipt to paid', async ({
        page,
    }) => {
        await page.route('**/api.php?resource=checkout-config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        currency: 'USD',
                        stripeEnabled: true,
                        publishableKey: 'pk_test_checkout',
                        bank: {
                            bankName: 'Banco Pichincha',
                            account: 'Cuenta de Ahorros: 2200160272',
                            owner: 'Titular: Rosero Caiza Javier Alejandro',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=checkout-intent', async (route) => {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        clientSecret: 'pi_checkout_secret',
                        paymentIntentId: 'pi_checkout_001',
                        order: {
                            id: 'co_checkout_001',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=checkout-confirm', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        receipt: {
                            receiptNumber: 'PAY-20260330-CARD01',
                            concept: 'Anticipo laser',
                            amountLabel: '$120.00',
                            paymentMethodLabel: 'Tarjeta',
                            paymentStatusLabel: 'Pagado',
                            issuedAt: '2026-03-30T10:30:00-05:00',
                            payer: {
                                name: 'Paciente Tarjeta',
                                email: 'tarjeta@example.com',
                            },
                        },
                    },
                }),
            });
        });

        await page.addInitScript(() => {
            window.Stripe = function StripeMock() {
                return {
                    elements() {
                        return {
                            create() {
                                return {
                                    mount() {},
                                };
                            },
                        };
                    },
                    async confirmCardPayment() {
                        return {
                            paymentIntent: {
                                id: 'pi_checkout_001',
                                status: 'succeeded',
                            },
                        };
                    },
                };
            };
        });

        await gotoPublicRoute(page, '/es/pago/');
        await waitForShellV6Runtime(page);

        await page.locator('#checkout-concept').fill('Anticipo laser');
        await page.locator('#checkout-amount').fill('120.00');
        await page.locator('#checkout-name').fill('Paciente Tarjeta');
        await page.locator('#checkout-email').fill('tarjeta@example.com');
        await page.locator('#checkout-cardholder').fill('Paciente Tarjeta');
        await page.locator('[data-checkout-submit]').click();

        await expect(page.locator('[data-checkout-receipt]')).toBeVisible();
        await expect(
            page.locator('[data-checkout-receipt-method]')
        ).toContainText('Tarjeta');
        await expect(
            page.locator('[data-checkout-receipt-status]')
        ).toContainText('Pagado');
    });
});
