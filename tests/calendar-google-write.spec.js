// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function getEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : fallback;
}

function pickFirstSlot(data, excludeDate = '', excludeTime = '') {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const days = Object.keys(data).sort();
    for (const day of days) {
        const slots = Array.isArray(data[day]) ? [...data[day]].sort() : [];
        for (const slot of slots) {
            if (day === excludeDate && slot === excludeTime) {
                continue;
            }
            return { date: day, time: slot };
        }
    }

    return null;
}

async function adminLogin(request, password) {
    const response = await request.post('/admin-auth.php?action=login', {
        data: { password },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok() || body.ok === false) {
        return {
            ok: false,
            reason: body.error || `HTTP ${response.status()}`,
        };
    }

    if (body.twoFactorRequired) {
        return {
            ok: false,
            reason: '2FA requerido para panel admin',
        };
    }

    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : '';
    if (!csrfToken) {
        return {
            ok: false,
            reason: 'Login admin sin CSRF token',
        };
    }

    return {
        ok: true,
        csrfToken,
    };
}

test.describe('Google Calendar E2E write flow', () => {
    test('crea cita 60min, reprograma y limpia via admin', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);

        const writeEnabled = getEnv('TEST_ENABLE_CALENDAR_WRITE') === 'true';
        test.skip(
            !writeEnabled,
            'TEST_ENABLE_CALENDAR_WRITE=true es requerido para pruebas con escritura real.'
        );

        const adminPassword =
            getEnv('TEST_ADMIN_PASSWORD') ||
            getEnv('PIELARMONIA_ADMIN_PASSWORD');
        test.skip(
            !adminPassword,
            'TEST_ADMIN_PASSWORD o PIELARMONIA_ADMIN_PASSWORD es requerido para cleanup seguro.'
        );

        const healthResp = await request.get('/api.php?resource=health');
        expect(healthResp.ok()).toBeTruthy();
        const health = await healthResp.json();
        expect(health.ok).toBe(true);

        test.skip(
            String(health.calendarSource) !== 'google',
            'La agenda activa no es Google.'
        );
        test.skip(
            health.calendarReachable !== true,
            'Google Calendar no esta reachable.'
        );

        const login = await adminLogin(request, adminPassword);
        test.skip(!login.ok, `No se pudo autenticar admin: ${login.reason}`);

        let appointmentId = null;

        try {
            const availabilityBeforeResp = await request.get(
                '/api.php?resource=availability&doctor=indiferente&service=laser&days=14'
            );
            expect(availabilityBeforeResp.ok()).toBeTruthy();
            const availabilityBefore = await availabilityBeforeResp.json();
            expect(availabilityBefore.ok).toBe(true);
            expect(availabilityBefore.meta.source).toBe('google');
            expect(Number(availabilityBefore.meta.durationMin)).toBe(60);

            const firstSlot = pickFirstSlot(availabilityBefore.data);
            expect(firstSlot).toBeTruthy();

            const stamp = Date.now();
            const createPayload = {
                service: 'laser',
                doctor: 'indiferente',
                date: firstSlot.date,
                time: firstSlot.time,
                name: `Test Calendar Write ${stamp}`,
                email: `calendar-write-${stamp}@example.com`,
                phone: '+593987654321',
                reason: 'Prueba automatizada de agenda real (laser 60 min)',
                privacyConsent: true,
                paymentMethod: 'cash',
            };

            const createResp = await request.post(
                '/api.php?resource=appointments',
                {
                    data: createPayload,
                }
            );
            expect(createResp.status(), await createResp.text()).toBe(201);

            const created = await createResp.json();
            expect(created.ok).toBe(true);
            expect(created.data).toBeTruthy();
            appointmentId = Number(created.data.id);
            expect(Number.isFinite(appointmentId)).toBe(true);
            expect(appointmentId).toBeGreaterThan(0);
            expect(String(created.data.calendarProvider)).toBe('google');
            expect(String(created.data.calendarId || '')).not.toBe('');
            expect(String(created.data.calendarEventId || '')).not.toBe('');
            expect(Number(created.data.slotDurationMin)).toBe(60);

            const assignedDoctor = String(created.data.doctor || '');
            expect(['rosero', 'narvaez']).toContain(assignedDoctor);

            const bookedAfterCreateResp = await request.get(
                `/api.php?resource=booked-slots&date=${encodeURIComponent(firstSlot.date)}&doctor=${encodeURIComponent(assignedDoctor)}&service=laser`
            );
            expect(bookedAfterCreateResp.ok()).toBeTruthy();
            const bookedAfterCreate = await bookedAfterCreateResp.json();
            expect(bookedAfterCreate.ok).toBe(true);
            expect(Array.isArray(bookedAfterCreate.data)).toBe(true);
            expect(bookedAfterCreate.data).toContain(firstSlot.time);

            const token = String(created.data.rescheduleToken || '');
            expect(token.length).toBeGreaterThanOrEqual(16);

            const availabilityForDoctorResp = await request.get(
                `/api.php?resource=availability&doctor=${encodeURIComponent(assignedDoctor)}&service=laser&days=21`
            );
            expect(availabilityForDoctorResp.ok()).toBeTruthy();
            const availabilityForDoctor = await availabilityForDoctorResp.json();
            expect(availabilityForDoctor.ok).toBe(true);

            const nextSlot = pickFirstSlot(
                availabilityForDoctor.data,
                firstSlot.date,
                firstSlot.time
            );
            expect(nextSlot).toBeTruthy();

            const rescheduleResp = await request.patch(
                '/api.php?resource=reschedule',
                {
                    data: {
                        token,
                        date: nextSlot.date,
                        time: nextSlot.time,
                    },
                }
            );
            expect(rescheduleResp.status(), await rescheduleResp.text()).toBe(200);
            const rescheduled = await rescheduleResp.json();
            expect(rescheduled.ok).toBe(true);
            expect(String(rescheduled.data.date)).toBe(nextSlot.date);
            expect(String(rescheduled.data.time)).toBe(nextSlot.time);
            expect(String(rescheduled.data.doctor)).toBe(assignedDoctor);
            expect(String(rescheduled.data.calendarProvider)).toBe('google');
            expect(String(rescheduled.data.calendarEventId || '')).not.toBe('');
            expect(Number(rescheduled.data.slotDurationMin)).toBe(60);

            const bookedAfterRescheduleResp = await request.get(
                `/api.php?resource=booked-slots&date=${encodeURIComponent(nextSlot.date)}&doctor=${encodeURIComponent(assignedDoctor)}&service=laser`
            );
            expect(bookedAfterRescheduleResp.ok()).toBeTruthy();
            const bookedAfterReschedule = await bookedAfterRescheduleResp.json();
            expect(bookedAfterReschedule.ok).toBe(true);
            expect(Array.isArray(bookedAfterReschedule.data)).toBe(true);
            expect(bookedAfterReschedule.data).toContain(nextSlot.time);
        } finally {
            if (appointmentId && Number.isFinite(appointmentId)) {
                const cancelResp = await request.patch(
                    '/api.php?resource=appointments',
                    {
                        headers: {
                            'X-CSRF-Token': login.csrfToken,
                        },
                        data: {
                            id: appointmentId,
                            status: 'cancelled',
                        },
                    }
                );

                expect(cancelResp.status(), await cancelResp.text()).toBe(200);
                const cancelBody = await cancelResp.json();
                expect(cancelBody.ok).toBe(true);
            }

            await request.post('/admin-auth.php?action=logout').catch(() => {});
        }
    });
});

