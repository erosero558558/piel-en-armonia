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

        await page.route('**/data/catalog/cross-sell.json', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    suggestions: [
                        {
                            service_id: 'consulta',
                            badge_es: 'Complemento frecuente',
                            title_es: 'Diagnóstico integral de piel, cabello y uñas',
                            description_es: 'Esta valoración suele ser el siguiente paso más útil después de una consulta general.',
                            href: '/servicios/diagnostico-integral.html',
                            cta_label_es: 'Ver valoración',
                        },
                    ],
                }),
            });
        });

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
                            serviceId: 'consulta',
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
        await expect(page.locator('[data-portal-next-cross-sell]')).toBeVisible();
        await expect(page.locator('[data-portal-next-cross-sell-title]')).toContainText(
            'Diagnóstico integral de piel, cabello y uñas'
        );
        await expect(page.locator('[data-portal-next-cross-sell-cta]')).toHaveAttribute(
            'href',
            '/servicios/diagnostico-integral.html'
        );
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

        await page.route('**/data/catalog/cross-sell.json', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    suggestions: [],
                }),
            });
        });

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

    test('telemedicine appointment exposes pre-consultation and room shortcuts', async ({
        page,
    }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem(
                'auroraPatientPortalSession',
                JSON.stringify(session)
            );
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
                        nextAppointment: {
                            id: 202,
                            appointmentType: 'telemedicine',
                            appointmentTypeLabel: 'Teleconsulta',
                            serviceName: 'Teleconsulta de control',
                            doctorName: 'Dra Ana Rosero',
                            dateLabel: 'lun 6 abr 2026',
                            timeLabel: '09:20',
                            locationLabel: 'Sala virtual segura',
                            preparation:
                                'Ten tu celular con buena conexion, fotos de apoyo y resultados recientes a la mano 10 minutos antes.',
                            preConsultationUrl:
                                '/es/telemedicina/pre-consulta/?token=tok_tele_001',
                            roomUrl:
                                '/es/telemedicina/sala/index.html?token=tok_tele_001',
                            telemedicinePreConsultation: {
                                status: 'submitted',
                                statusLabel: 'Pre-consulta enviada',
                            },
                            whatsappUrl:
                                'https://wa.me/593982453672?text=telemedicina',
                        },
                        support: {
                            bookingUrl: '/#citas',
                            historyUrl: '/es/portal/historial/',
                            whatsappUrl:
                                'https://wa.me/593982453672?text=telemedicina',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/');

        await expect(page.locator('[data-portal-next-appointment-card]')).toBeVisible();
        await expect(
            page.locator('[data-portal-next-preconsultation]')
        ).toHaveAttribute(
            'href',
            '/es/telemedicina/pre-consulta/?token=tok_tele_001'
        );
        await expect(page.locator('[data-portal-next-room]')).toHaveAttribute(
            'href',
            '/es/telemedicina/sala/index.html?token=tok_tele_001'
        );
        await expect(
            page.locator('[data-portal-next-preconsultation-status]')
        ).toContainText('Pre-consulta enviada');
    });
});
