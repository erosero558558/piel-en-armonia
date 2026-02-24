// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function getEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : fallback;
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

async function adminLogin(request, password) {
    const response = await request.post('/admin-auth.php?action=login', {
        data: { password },
    });
    const body = await safeJson(response);

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

    return {
        ok: true,
    };
}

test.describe('Retention metrics contract (admin)', () => {
    test('funnel-metrics expone bloque retention no-break', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);

        const adminPassword =
            getEnv('TEST_ADMIN_PASSWORD') ||
            getEnv('PIELARMONIA_ADMIN_PASSWORD');
        test.skip(
            !adminPassword,
            'TEST_ADMIN_PASSWORD o PIELARMONIA_ADMIN_PASSWORD es requerido.'
        );

        const login = await adminLogin(request, adminPassword);
        test.skip(!login.ok, `No se pudo autenticar admin: ${login.reason}`);

        const response = await request.get('/api.php?resource=funnel-metrics');
        expect(response.ok()).toBeTruthy();
        const body = await safeJson(response);
        expect(body.ok).toBe(true);
        expect(body.data).toBeTruthy();

        const retention = body.data.retention;
        expect(retention).toBeTruthy();

        expect(typeof retention.appointmentsTotal).toBe('number');
        expect(typeof retention.appointmentsNonCancelled).toBe('number');
        expect(typeof retention.uniquePatients).toBe('number');
        expect(typeof retention.recurrentPatients).toBe('number');
        expect(typeof retention.statusCounts).toBe('object');
        expect(typeof retention.statusCounts.confirmed).toBe('number');
        expect(typeof retention.statusCounts.completed).toBe('number');
        expect(typeof retention.statusCounts.noShow).toBe('number');
        expect(typeof retention.statusCounts.cancelled).toBe('number');

        const rates = [
            Number(retention.noShowRatePct || 0),
            Number(retention.completionRatePct || 0),
            Number(retention.recurrenceRatePct || 0),
        ];
        for (const rate of rates) {
            expect(Number.isFinite(rate)).toBe(true);
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(100);
        }

        await request.post('/admin-auth.php?action=logout').catch(() => {});
    });
});
