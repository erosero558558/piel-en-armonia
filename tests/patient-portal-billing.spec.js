// @ts-check
const { test, expect } = require('@playwright/test');

const SESSION = {
    token: 'header.payload.signature',
    expiresAt: '2026-04-06T00:00:00Z',
    patient: {
        patientId: 'pt_lucia_001',
        name: 'Lucia Portal',
        phoneMasked: '******4567',
    },
};

test.describe('Patient portal billing card', () => {
    test('renders the pending balance with warning tone and pay-now CTA', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-dashboard', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        authenticated: true,
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                        },
                        nextAppointment: null,
                        treatmentPlan: null,
                        billing: {
                            tone: 'warning',
                            statusLabel: 'Saldo pendiente',
                            statusDetail:
                                'Tu próxima obligación ya está visible en el portal. Puedes pagarla sin exponer datos bancarios.',
                            totalPendingLabel: '$95.00',
                            reviewBalanceCents: 0,
                            lastPayment: {
                                amountLabel: '$45.00',
                                paidAtLabel: 'jue 5 mar 2026 · 11:30',
                                paymentMethodLabel: 'Tarjeta',
                            },
                            nextObligation: {
                                concept: 'Saldo peeling químico',
                                amountLabel: '$95.00',
                                dueAtLabel: 'mar 31 mar 2026 · 09:00',
                            },
                            payNowUrl: '/es/pago/',
                        },
                        support: {
                            bookingUrl: '/#citas',
                            historyUrl: '/es/portal/historial/',
                            whatsappUrl: 'https://wa.me/593982453672?text=hola',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/');

        await expect(page.locator('[data-portal-billing-card]')).toBeVisible();
        await expect(page.locator('[data-portal-billing-status]')).toContainText('Saldo pendiente');
        await expect(page.locator('[data-portal-billing-total]')).toContainText('$95.00');
        await expect(page.locator('[data-portal-billing-last-payment]')).toContainText('$45.00');
        await expect(page.locator('[data-portal-billing-next-due]')).toContainText('31 mar 2026');
        await expect(page.locator('[data-portal-billing-detail]')).toContainText(
            'Tu próxima obligación ya está visible en el portal'
        );
        await expect(page.locator('[data-portal-billing-cta]')).toHaveAttribute('href', '/es/pago/');
    });

    test('shows a calm good-state summary when the patient is up to date', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-dashboard', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        authenticated: true,
                        patient: {
                            patientId: 'pt_lucia_001',
                            name: 'Lucia Portal',
                        },
                        nextAppointment: null,
                        treatmentPlan: null,
                        billing: {
                            tone: 'good',
                            statusLabel: 'Al día',
                            statusDetail:
                                'Tu último pago quedó aplicado y no tienes obligaciones pendientes por ahora.',
                            totalPendingLabel: '$0.00',
                            reviewBalanceCents: 0,
                            lastPayment: {
                                amountLabel: '$120.00',
                                paidAtLabel: 'lun 9 mar 2026 · 15:45',
                                paymentMethodLabel: 'Transferencia',
                            },
                            nextObligation: null,
                            payNowUrl: '/es/pago/',
                        },
                        support: {
                            bookingUrl: '/#citas',
                            historyUrl: '/es/portal/historial/',
                            whatsappUrl: 'https://wa.me/593982453672?text=hola',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/');

        await expect(page.locator('[data-portal-billing-status]')).toContainText('Al día');
        await expect(page.locator('[data-portal-billing-total]')).toContainText('$0.00');
        await expect(page.locator('[data-portal-billing-next-due]')).toContainText('Sin vencimientos');
        await expect(page.locator('[data-portal-billing-detail]')).toContainText(
            'no tienes obligaciones pendientes'
        );
    });
});
