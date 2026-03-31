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

test.describe('Patient portal treatment plan page', () => {
    test('renders progress, session timeline, and next steps for the active plan', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-plan', async (route) => {
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
                        treatmentPlan: {
                            diagnosis: 'Control integral para dermatitis irritativa',
                            followUpFrequency: 'Control cada 14 días',
                            generatedAtLabel: 'Emitido el sab 1 mar 2026',
                            completedSessions: 2,
                            plannedSessions: 4,
                            scheduledSessions: 3,
                            unscheduledSessions: 1,
                            adherencePercent: 50,
                            adherenceLabel: '50%',
                            progressLabel: '2 de 4 sesiones',
                            timelineLabel: '4 hitos del plan',
                            scheduledSessionsLabel: '3 sesiones ya definidas',
                            unscheduledSessionsLabel: '1 sesión pendiente por agendar',
                            treatmentsText:
                                'Completar 4 sesiones de control. Tomar Cetirizina 10 mg cada noche por 7 días.',
                            goalsText:
                                'Enviar foto de control 48 horas antes. Mantener hidratación diaria.',
                            nextSession: {
                                dateLabel: 'jue 2 abr 2026',
                                timeLabel: '10:30',
                                serviceName: 'Consulta Dermatológica',
                                doctorName: 'Dra Ana Rosero',
                                locationLabel: 'Consultorio Aurora Derm',
                                rescheduleUrl: '/?reschedule=tok_live_001',
                                whatsappUrl: 'https://wa.me/593982453672?text=hola',
                            },
                            tasks: [
                                { label: 'Completar 4 sesiones de control.' },
                                { label: 'Tomar Cetirizina 10 mg cada noche por 7 días.' },
                                { label: 'Enviar foto de control 48 horas antes.' },
                            ],
                            timeline: [
                                {
                                    id: 'session-1-89',
                                    label: 'Sesión 1',
                                    status: 'completed',
                                    statusLabel: 'Realizada',
                                    tone: 'good',
                                    dateLabel: 'jue 12 mar 2026',
                                    timeLabel: '09:00',
                                    serviceName: 'Consulta Dermatológica',
                                    appointmentTypeLabel: 'Consulta presencial',
                                    doctorName: 'Dra Ana Rosero',
                                    locationLabel: 'Consultorio Aurora Derm',
                                    preparation: 'Llega 10 minutos antes y trae tus medicamentos.',
                                },
                                {
                                    id: 'session-2-90',
                                    label: 'Sesión 2',
                                    status: 'completed',
                                    statusLabel: 'Realizada',
                                    tone: 'good',
                                    dateLabel: 'mie 18 mar 2026',
                                    timeLabel: '16:15',
                                    serviceName: 'Control dermatológico',
                                    appointmentTypeLabel: 'Consulta presencial',
                                    doctorName: 'Dra Ana Rosero',
                                    locationLabel: 'Consultorio Aurora Derm',
                                    preparation: 'Trae tus fotos previas si ayudan a explicar la evolución.',
                                },
                                {
                                    id: 'session-3-101',
                                    label: 'Sesión 3',
                                    status: 'scheduled',
                                    statusLabel: 'Próxima',
                                    tone: 'warning',
                                    isNext: true,
                                    dateLabel: 'jue 2 abr 2026',
                                    timeLabel: '10:30',
                                    serviceName: 'Consulta Dermatológica',
                                    appointmentTypeLabel: 'Consulta presencial',
                                    doctorName: 'Dra Ana Rosero',
                                    locationLabel: 'Consultorio Aurora Derm',
                                    preparation: 'Llega 10 minutos antes y trae tus medicamentos.',
                                    rescheduleUrl: '/?reschedule=tok_live_001',
                                    whatsappUrl: 'https://wa.me/593982453672?text=hola',
                                },
                                {
                                    id: 'session-pending-4',
                                    label: 'Sesión 4',
                                    status: 'pending',
                                    statusLabel: 'Por agendar',
                                    tone: 'idle',
                                },
                            ],
                        },
                    },
                }),
            });
        });

        await page.goto('/es/portal/plan/');

        await expect(page.locator('[data-portal-plan-hero-card]')).toBeVisible();
        await expect(page.locator('[data-portal-patient-name]')).toContainText('Lucia Portal');
        await expect(page.locator('[data-portal-plan-diagnosis]')).toContainText(
            'Control integral para dermatitis irritativa'
        );
        await expect(page.locator('[data-portal-plan-progress]')).toContainText('2 de 4 sesiones');
        await expect(page.locator('[data-portal-plan-adherence]')).toContainText('50%');
        await expect(page.locator('[data-portal-plan-banner]')).toContainText('3 sesiones ya definidas');
        await expect(page.locator('[data-portal-plan-banner]')).toContainText(
            '1 sesión pendiente por agendar'
        );
        await expect(page.locator('[data-portal-plan-timeline-card]')).toHaveCount(4);
        await expect(page.locator('[data-portal-plan-timeline-card]').nth(0)).toContainText('Sesión 1');
        await expect(page.locator('[data-portal-plan-timeline-card]').nth(0)).toContainText('Realizada');
        await expect(page.locator('[data-portal-plan-timeline-card]').nth(2)).toContainText('Próxima');
        await expect(page.locator('[data-portal-plan-timeline-card]').nth(2)).toContainText('2 abr 2026');
        await expect(page.locator('[data-portal-plan-timeline-card]').nth(3)).toContainText(
            'Por agendar'
        );
        await expect(page.locator('[data-portal-plan-next-session]')).toContainText('2 abr 2026');
        await expect(page.locator('[data-portal-plan-next-item]')).toHaveCount(3);
    });

    test('shows a calm empty state when there is no active treatment plan yet', async ({ page }) => {
        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));
        }, SESSION);

        await page.route('**/api.php?resource=patient-portal-plan', async (route) => {
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
                        treatmentPlan: null,
                    },
                }),
            });
        });

        await page.goto('/es/portal/plan/');

        await expect(page.locator('[data-portal-plan-empty]')).toBeVisible();
        await expect(page.locator('[data-portal-plan-empty]')).toContainText(
            'Todavía no tenemos un plan activo visible'
        );
    });
});
