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

test.describe('Patient portal treatment plan card', () => {
    test('renders the active treatment progress, adherence and pending tasks', async ({ page }) => {
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
                        nextAppointment: {
                            id: 101,
                            dateLabel: 'jue 2 abr 2026',
                            timeLabel: '10:30',
                            doctorName: 'Dra Ana Rosero',
                            appointmentTypeLabel: 'Consulta presencial',
                            serviceName: 'Consulta Dermatológica',
                            preparation: 'Llega 10 minutos antes y trae tus medicamentos a la consulta.',
                            rescheduleUrl: '/?reschedule=tok_demo_001',
                            whatsappUrl: 'https://wa.me/593982453672?text=hola',
                            locationLabel: 'Consultorio Aurora Derm',
                        },
                        treatmentPlan: {
                            diagnosis: 'Control integral para dermatitis irritativa',
                            followUpFrequency: 'Control cada 14 días',
                            completedSessions: 2,
                            plannedSessions: 4,
                            adherencePercent: 50,
                            adherenceLabel: '50%',
                            progressLabel: '2 de 4 sesiones',
                            nextSession: {
                                dateLabel: 'jue 2 abr 2026',
                                timeLabel: '10:30',
                            },
                            tasks: [
                                { label: 'Completar 4 sesiones de control.' },
                                { label: 'Tomar Cetirizina 10 mg cada noche por 7 días.' },
                                { label: 'Enviar foto de control 48 horas antes.' },
                            ],
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

        await expect(page.locator('[data-portal-treatment-plan-card]')).toBeVisible();
        await expect(page.locator('[data-portal-treatment-diagnosis]')).toContainText(
            'Control integral para dermatitis irritativa'
        );
        await expect(page.locator('[data-portal-treatment-follow-up]')).toContainText(
            'Control cada 14 días'
        );
        await expect(page.locator('[data-portal-treatment-progress]')).toContainText('2 de 4 sesiones');
        await expect(page.locator('[data-portal-treatment-adherence]')).toContainText('50%');
        await expect(page.locator('[data-portal-treatment-next-session]')).toContainText('2 abr 2026');
        await expect(page.locator('[data-portal-treatment-task]')).toHaveCount(3);
        await expect(page.locator('[data-portal-treatment-task]').first()).toContainText(
            'Completar 4 sesiones de control'
        );
    });

    test('shows a calm empty state when there is no active plan yet', async ({ page }) => {
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

        await expect(page.locator('[data-portal-treatment-plan-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-treatment-plan-empty]')).toContainText(
            'Todavía no tenemos un plan activo visible'
        );
    });
});
