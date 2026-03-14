// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildOperatorAuthChallenge,
    buildOperatorQueueState,
    buildOperatorQueueTicket,
    buildOpenClawBrokerRedirect,
    installOperatorOpenClawAuthMock,
    installWindowOpenRecorder,
} = require('./helpers/admin-auth-mocks');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function adminUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/admin.html${search ? `?${search}` : ''}`;
}

function operatorUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/operador-turnos.html${search ? `?${search}` : ''}`;
}

async function waitForAdminReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

async function expectAdminOpenClawStage(page) {
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#openclawLoginStage')).toBeVisible();
    await expect(page.locator('#legacyLoginStage')).toHaveClass(/is-hidden/);
}

async function installSharedOperatorAuthMocks(context, options = {}) {
    const transport =
        String(options.transport || 'local_helper')
            .trim()
            .toLowerCase() === 'web_broker'
            ? 'web_broker'
            : 'local_helper';
    const queueTicket = buildOperatorQueueTicket();
    const queueState = buildOperatorQueueState(queueTicket);
    const availabilityMeta = {
        source: 'store',
        mode: 'live',
        timezone: 'America/Guayaquil',
        calendarConfigured: true,
        calendarReachable: true,
        generatedAt: new Date().toISOString(),
    };

    const authSession = await installOperatorOpenClawAuthMock(context, {
        transport,
        autoAuthenticateOnPendingStatus: true,
        authenticatedPayload: {
            csrfToken: 'csrf_shared_operator_auth',
            operator: {
                email: 'operator@example.com',
                source: 'openclaw_chatgpt',
            },
        },
        startResponseFactory(nextStartCount, requestMeta) {
            if (transport === 'web_broker') {
                const redirectUrl = new URL(
                    'https://broker.example.test/authorize'
                );
                redirectUrl.searchParams.set('attempt', String(nextStartCount));
                if (requestMeta?.body?.returnTo) {
                    redirectUrl.searchParams.set(
                        'returnTo',
                        String(requestMeta.body.returnTo)
                    );
                }

                return {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    transport: 'web_broker',
                    status: 'pending',
                    ...buildOpenClawBrokerRedirect({
                        redirectUrl: redirectUrl.toString(),
                    }),
                };
            }

            return {
                ok: true,
                authenticated: false,
                mode: 'openclaw_chatgpt',
                transport: 'local_helper',
                status: 'pending',
                challenge: buildOperatorAuthChallenge({
                    challengeId: `shared-openclaw-${nextStartCount}`,
                    manualCode: `SHARED-${String(nextStartCount).padStart(3, '0')}`,
                }),
            };
        },
    });

    if (transport === 'web_broker') {
        await context.route('https://broker.example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const params = new URLSearchParams(window.location.search);
const ref = String(document.referrer || '');
const base = ref ? new URL(ref).origin : window.location.origin;
const requestedReturnTo = String(params.get('returnTo') || '').trim();
const fallbackTarget = ref.includes('/operador-turnos.html')
    ? ${JSON.stringify(operatorUrl('station=c2&lock=1&one_tap=1'))}
    : ${JSON.stringify(adminUrl('callback=shared_web_broker'))};
const target = new URL(requestedReturnTo || fallbackTarget, base).toString();
window.location.replace(target);
</script>`,
            });
        });
    }

    await context.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = String(url.searchParams.get('resource') || '');

        if (resource === 'features') {
            return json(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return json(route, {
                ok: true,
                data: {
                    appointments: [],
                    callbacks: [],
                    reviews: [],
                    availability: {},
                    availabilityMeta,
                    queue_tickets: [queueTicket],
                    queueMeta: queueState,
                },
            });
        }

        if (resource === 'availability') {
            return json(route, {
                ok: true,
                data: {},
                meta: availabilityMeta,
            });
        }

        if (resource === 'health') {
            return json(route, {
                ok: true,
                status: 'ok',
                data: {},
            });
        }

        if (resource === 'funnel-metrics') {
            return json(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'monitoring-config') {
            return json(route, { ok: true, data: {} });
        }

        if (resource === 'whatsapp-openclaw-ops') {
            return json(route, { ok: true, data: {} });
        }

        if (resource === 'queue-state') {
            return json(route, { ok: true, data: queueState });
        }

        if (
            resource === 'queue-surface-heartbeat' ||
            resource === 'queue-ticket' ||
            resource === 'queue-call-next'
        ) {
            return json(route, { ok: true, data: { queueState } });
        }

        return json(route, { ok: true, data: {} });
    });

    return authSession;
}

test.describe('OpenClaw shared session', () => {
    test('admin autentica y operador reutiliza la misma sesion OpenClaw', async ({
        page,
        context,
    }) => {
        const session = await installSharedOperatorAuthMocks(context);
        await installWindowOpenRecorder(page);

        await page.goto(adminUrl());
        await waitForAdminReady(page);
        await expectAdminOpenClawStage(page);

        await page.locator('#loginBtn').click();

        await expect
            .poll(() =>
                String(session.getLastIssuedChallenge()?.helperUrl || '')
            )
            .not.toBe('');
        await expect
            .poll(() =>
                page.evaluate(() => String(window.__openedUrls[0] || ''))
            )
            .toBe(session.getLastIssuedChallenge().helperUrl);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /operator@example\.com/i
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /OpenClaw/i
        );

        const operatorPage = await context.newPage();
        await operatorPage.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect(operatorPage.locator('#operatorApp')).toBeVisible();
        await expect(operatorPage.locator('#operatorLoginView')).toHaveClass(
            /is-hidden/
        );
        await expect(
            operatorPage.locator('#operatorActionTitle')
        ).toContainText('Siguiente: B-2201');
    });

    test('admin autentica via web broker y operador reutiliza la misma sesion', async ({
        page,
        context,
    }) => {
        const session = await installSharedOperatorAuthMocks(context, {
            transport: 'web_broker',
        });

        await page.goto(adminUrl());
        await waitForAdminReady(page);
        await expectAdminOpenClawStage(page);
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();

        await page.locator('#loginBtn').click();

        await expect
            .poll(() =>
                String(session.getLastIssuedChallenge()?.redirectUrl || '')
            )
            .toContain('https://broker.example.test/authorize');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /operator@example\.com/i
        );

        const operatorPage = await context.newPage();
        await operatorPage.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect(operatorPage.locator('#operatorApp')).toBeVisible();
        await expect(operatorPage.locator('#operatorLoginView')).toHaveClass(
            /is-hidden/
        );
        await expect(
            operatorPage.locator('#operatorActionTitle')
        ).toContainText('Siguiente: B-2201');
    });

    test('operator autentica, admin reutiliza, y logout invalida ambas superficies', async ({
        page,
        context,
    }) => {
        const session = await installSharedOperatorAuthMocks(context);
        await installWindowOpenRecorder(page);

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();

        await page.locator('#operatorOpenClawBtn').click();

        await expect
            .poll(() =>
                String(session.getLastIssuedChallenge()?.helperUrl || '')
            )
            .not.toBe('');
        await expect
            .poll(() =>
                page.evaluate(() => String(window.__openedUrls[0] || ''))
            )
            .toBe(session.getLastIssuedChallenge().helperUrl);
        await expect(page.locator('#operatorApp')).toBeVisible();

        const adminPage = await context.newPage();
        await adminPage.goto(adminUrl());
        await waitForAdminReady(adminPage);

        await expect(adminPage.locator('#adminDashboard')).toBeVisible();
        await expect(adminPage.locator('#adminSessionMeta')).toContainText(
            /operator@example\.com/i
        );
        await expect(adminPage.locator('#adminSessionMeta')).toContainText(
            /OpenClaw/i
        );

        await page.locator('#operatorLogoutBtn').click();

        await expect(page.locator('#operatorLoginView')).toBeVisible();
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorLegacyLoginFields')).toHaveClass(
            /is-hidden/
        );

        await adminPage.reload();
        await waitForAdminReady(adminPage);
        await expectAdminOpenClawStage(adminPage);
        await expect(page.locator('#operatorApp')).toHaveClass(/is-hidden/);
        await expect(adminPage.locator('#adminDashboard')).toHaveClass(
            /is-hidden/
        );
    });

    test('operator autentica via web broker, admin reutiliza, y logout invalida ambas superficies', async ({
        page,
        context,
    }) => {
        await installSharedOperatorAuthMocks(context, {
            transport: 'web_broker',
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorOpenClawLinkRow')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorOpenClawManualRow')).toHaveClass(
            /is-hidden/
        );

        await page.locator('#operatorOpenClawBtn').click();
        await expect(page.locator('#operatorApp')).toBeVisible();

        const adminPage = await context.newPage();
        await adminPage.goto(adminUrl());
        await waitForAdminReady(adminPage);
        await expect(adminPage.locator('#adminDashboard')).toBeVisible();

        await page.locator('#operatorLogoutBtn').click();

        await expect(page.locator('#operatorLoginView')).toBeVisible();
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();

        await adminPage.reload();
        await waitForAdminReady(adminPage);
        await expectAdminOpenClawStage(adminPage);
        await expect(adminPage.locator('#adminDashboard')).toHaveClass(
            /is-hidden/
        );
    });
});
