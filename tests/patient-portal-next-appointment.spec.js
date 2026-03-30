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

test.describe('Patient portal next appointment card', () => {
    test('renders skeleton first and then the live next appointment', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-dashboard', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 180));
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
                        nextAppointment: {
                            id: 101,
                            dateLabel: 'jue 2 abr 2026',
                            timeLabel: '10:30',
                            doctorName: 'Dra Ana Rosero',
                            appointmentTypeLabel: 'Consulta presencial',
                            serviceName: 'Consulta Dermatológica',
                            preparation: 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.',
                            rescheduleUrl: '/?reschedule=tok_live_001',
                            whatsappUrl: 'https://wa.me/593982453672?text=hola',
                            locationLabel: 'Consultorio Aurora Derm',
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

        await expect(page.locator('[data-portal-next-skeleton]')).toBeVisible();
        await expect(page.locator('[data-portal-next-appointment-card]')).toBeVisible();
        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-next-date]')).toContainText('2 abr 2026');
        await expect(page.locator('[data-portal-next-time]')).toContainText('10:30');
        await expect(page.locator('[data-portal-next-doctor]')).toContainText('Dra Ana Rosero');
        await expect(page.locator('[data-portal-next-type]')).toContainText('Consulta presencial');
        await expect(page.locator('[data-portal-next-service]')).toContainText('Consulta Dermatológica');
        await expect(page.locator('[data-portal-next-preparation]')).toContainText('Llega 10 minutos antes');
        await expect(page.locator('[data-portal-next-reagendar]')).toHaveAttribute(
            'href',
            '/?reschedule=tok_live_001'
        );
        await expect(page.locator('[data-portal-next-whatsapp]')).toHaveAttribute(
            'href',
            'https://wa.me/593982453672?text=hola'
        );
    });

    test('shows highlighted booking CTA when there is no upcoming appointment', async ({ page }) => {
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
                        support: {
                            bookingUrl: '/#citas',
                            historyUrl: '/es/portal/historial/',
                            whatsappUrl: 'https://wa.me/593982453672?text=sin-cita',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/');

        await expect(page.locator('[data-portal-empty-state]')).toBeVisible();
        await expect(page.locator('[data-portal-booking-cta]')).toHaveAttribute('href', '/#citas');
        await expect(page.locator('[data-portal-empty-whatsapp]')).toHaveAttribute(
            'href',
            'https://wa.me/593982453672?text=sin-cita'
        );
    });
});
