// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');
const {
    installLegacyAdminAuthMock,
    installLegacyAdminLoginFlowMock,
    installOpenClawAdminAuthMock,
} = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

function recalculateCheckoutReviewSummary(meta = {}) {
    const queue = Array.isArray(meta.queue) ? meta.queue : [];
    return {
        pendingCount: queue.filter(
            (item) => String(item.paymentStatus || '') === 'pending_transfer'
        ).length,
        verifiedCount: queue.filter(
            (item) => String(item.paymentStatus || '') === 'verified_transfer'
        ).length,
        appliedCount: queue.filter(
            (item) => String(item.paymentStatus || '') === 'applied'
        ).length,
        missingProofCount: Number(meta?.summary?.missingProofCount || 0),
        queueCount: queue.length,
    };
}

async function setupAuthenticatedAdminMocks(page, overrides = {}) {
    const funnelMetrics =
        overrides.funnelMetrics && typeof overrides.funnelMetrics === 'object'
            ? overrides.funnelMetrics
            : null;
    const dataOverrides = {
        ...overrides,
    };
    delete dataOverrides.funnelMetrics;

    await installLegacyAdminAuthMock(page, {
        csrfToken: 'csrf_test_token',
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides,
        funnelMetrics,
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            intendedMethod,
            context,
            fulfillJson,
        }) => {
            const mergedData = context.data;

            if (
                resource === 'callbacks' &&
                (method === 'PATCH' ||
                    method === 'POST' ||
                    intendedMethod === 'PATCH')
            ) {
                const callbackId = Number(payload.id || 0);
                let callback = mergedData.callbacks.find(
                    (item) => Number(item.id || 0) === callbackId
                );
                if (callbackId > 0 && callback) {
                    callback.status = String(payload.status || callback.status);
                } else {
                    mergedData.callbacks.forEach((item) => {
                        if (
                            String(item.status || '').toLowerCase() ===
                            'pending'
                        ) {
                            item.status = String(
                                payload.status || 'contactado'
                            );
                        }
                    });
                    callback = mergedData.callbacks[0] || null;
                }
                await fulfillJson(route, { ok: true, data: callback || {} });
                return true;
            }

            if (
                resource === 'appointments' &&
                (method === 'PATCH' ||
                    method === 'POST' ||
                    intendedMethod === 'PATCH')
            ) {
                const appointmentId = Number(payload.id || 0);
                const appointment = mergedData.appointments.find(
                    (item) => Number(item.id || 0) === appointmentId
                );
                if (appointment) {
                    Object.assign(appointment, payload);
                }
                await fulfillJson(route, { ok: true, data: appointment || {} });
                return true;
            }

            if (
                resource === 'checkout-orders' &&
                (method === 'PATCH' || intendedMethod === 'PATCH')
            ) {
                const orderId = String(payload.id || payload.orderId || '').trim();
                const action = String(payload.action || '').trim();
                const meta =
                    mergedData.checkoutReviewMeta &&
                    typeof mergedData.checkoutReviewMeta === 'object'
                        ? mergedData.checkoutReviewMeta
                        : { summary: {}, queue: [] };
                const queue = Array.isArray(meta.queue) ? meta.queue : [];
                const order = queue.find(
                    (item) => String(item.id || '').trim() === orderId
                );

                if (order) {
                    if (action === 'verify') {
                        order.paymentStatus = 'verified_transfer';
                        order.paymentStatusLabel = 'Verificado';
                        order.canVerify = false;
                        order.canApply = true;
                    } else if (action === 'apply') {
                        order.paymentStatus = 'applied';
                        order.paymentStatusLabel = 'Aplicado';
                        order.canVerify = false;
                        order.canApply = false;
                    }
                    meta.summary = recalculateCheckoutReviewSummary(meta);
                }

                mergedData.checkoutReviewMeta = meta;
                await fulfillJson(route, { ok: true, data: order || {} });
                return true;
            }

            return false;
        },
    });
}

async function setupLoginAdminMocks(
    page,
    {
        authMode = 'legacy_password',
        twoFactorRequired = false,
        dataOverrides = {},
        funnelMetrics = null,
        loginError = '',
        openClawOptions = {},
    } = {}
) {
    if (authMode === 'openclaw_chatgpt') {
        await installOpenClawAdminAuthMock(page, {
            pollsBeforeTerminal: 1,
            ...openClawOptions,
        });
    } else {
        await installLegacyAdminLoginFlowMock(page, {
            twoFactorRequired,
            loginError,
            csrfToken: 'csrf_login_test',
        });
    }

    await installBasicAdminApiMocks(page, {
        dataOverrides,
        funnelMetrics,
    });
}

async function waitForAdminReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

async function openDashboardSection(page) {
    await page
        .locator('#adminSidebar .nav-item[data-section="dashboard"]')
        .click();
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.locator('#pageTitle')).toHaveText('Inicio');
}

test.describe('Panel de administracion', () => {
    test('pagina admin carga correctamente', async ({ page }) => {
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(/Admin|Aurora Derm/);
    });

    test('formulario de login esta visible', async ({ page }) => {
        await page.goto('/admin.html');
        const loginForm = page
            .locator('#loginForm, form, [class*="login"]')
            .first();
        await expect(loginForm).toBeVisible();
    });

    test('tema claro/oscuro funciona en login y persiste tras recarga', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await waitForAdminReady(page);

        const darkThemeBtn = page
            .locator(
                '.login-theme-bar .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        await expect(darkThemeBtn).toBeVisible();
        await darkThemeBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
                stored: 'dark',
            });

        await page.reload();
        await expect(page.locator('#loginForm')).toBeVisible();
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('dark');
    });

    test('login OpenClaw por defecto actualiza el estado de sesion en el chrome', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, {
            authMode: 'openclaw_chatgpt',
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toBeHidden();
        await expect(page.locator('#adminPassword')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(
            /OpenClaw|Continuar/
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /OpenClaw validado/
        );
    });

    test('settings guarda el perfil del medico principal y sube la firma digital', async ({
        page,
    }) => {
        const savedProfiles = [];
        const initialSignature =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_test_token',
        });

        await installBasicAdminApiMocks(page, {
            dataOverrides: {
                doctorProfile: {
                    fullName: 'Dra. Aurora Demo',
                    specialty: 'Dermatologia clinica',
                    mspNumber: 'MSP-100200',
                    signatureImage: initialSignature,
                    updatedAt: '2026-03-28T10:00:00-05:00',
                },
            },
            handleRoute: async ({
                route,
                resource,
                method,
                payload,
                context,
                fulfillJson,
            }) => {
                if (resource === 'doctor-profile' && method === 'GET') {
                    await fulfillJson(route, {
                        ok: true,
                        data: context.data.doctorProfile || {},
                    });
                    return true;
                }

                if (resource === 'doctor-profile' && method === 'POST') {
                    savedProfiles.push(payload);
                    context.data.doctorProfile = {
                        ...payload,
                        updatedAt: '2026-03-29T15:45:00-05:00',
                    };
                    await fulfillJson(route, {
                        ok: true,
                        data: context.data.doctorProfile,
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page
            .locator('#adminSidebar .nav-item[data-section="settings"]')
            .click();

        await expect(page.locator('#settings')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Perfil medico');
        await expect(page.locator('#doctorProfileFullName')).toHaveValue(
            'Dra. Aurora Demo'
        );
        await expect(
            page.locator('#doctorProfileSignaturePreview img')
        ).toBeVisible();

        await page.locator('#doctorProfileFullName').fill('Dra. Lucia Rosero');
        await page
            .locator('#doctorProfileSpecialty')
            .fill('Dermatologia medico quirurgica');
        await page.locator('#doctorProfileMspNumber').fill('MSP-445566');
        await page.locator('#doctorProfileSignatureFile').setInputFiles({
            name: 'firma.png',
            mimeType: 'image/png',
            buffer: Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
                'base64'
            ),
        });

        await expect(page.locator('#doctorProfilePreviewName')).toContainText(
            'Dra. Lucia Rosero'
        );
        await expect(
            page.locator('#doctorProfileSignaturePreview img')
        ).toBeVisible();

        await page.locator('#doctorProfileSaveBtn').click();

        await expect.poll(() => savedProfiles.length).toBe(1);
        expect(savedProfiles[0]).toMatchObject({
            fullName: 'Dra. Lucia Rosero',
            specialty: 'Dermatologia medico quirurgica',
            mspNumber: 'MSP-445566',
        });
        expect(String(savedProfiles[0].signatureImage || '')).toMatch(
            /^data:image\/png;base64,/
        );
        await expect(page.locator('#doctorProfileSaveMeta')).toContainText(
            'Actualizado'
        );
        await expect(page.locator('#doctorProfilePreviewMeta')).toContainText(
            'MSP-445566'
        );
    });

    test('settings muestra suscripción Flow OS y prepara checkout Stripe', async ({
        page,
    }) => {
        const checkoutRequests = [];

        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_test_token',
        });

        await installBasicAdminApiMocks(page, {
            dataOverrides: {
                clinicProfile: {
                    clinicName: 'Aurora Derm Centro',
                    address: 'Av. Clinica 123',
                    phone: '+593999111222',
                    software_plan: 'Starter',
                    software_subscription: {
                        status: 'active',
                        statusLabel: 'Activa',
                        planKey: 'starter',
                        planLabel: 'Starter',
                        amountLabel: '$29.00/mes',
                        renewalAt: '2026-04-15T10:00:00-05:00',
                        updatedAt: '2026-03-29T15:45:00-05:00',
                        invoices: [
                            {
                                id: 'in_flowos_001',
                                number: 'INV-FLOWOS-001',
                                status: 'paid',
                                statusLabel: 'Pagada',
                                amountLabel: '$29.00',
                                issuedAt: '2026-03-29T15:45:00-05:00',
                                hostedInvoiceUrl:
                                    'https://billing.stripe.test/invoices/in_flowos_001',
                            },
                        ],
                    },
                    updatedAt: '2026-03-29T15:45:00-05:00',
                },
            },
            handleRoute: async ({
                route,
                resource,
                method,
                payload,
                context,
                fulfillJson,
            }) => {
                if (
                    resource === 'software-subscription-checkout' &&
                    method === 'POST'
                ) {
                    checkoutRequests.push(payload);
                    context.data.clinicProfile = {
                        ...context.data.clinicProfile,
                        software_subscription: {
                            ...context.data.clinicProfile.software_subscription,
                            status: 'pending_checkout',
                            statusLabel: 'Checkout pendiente',
                            pendingPlanKey: 'pro',
                            pendingPlanLabel: 'Pro',
                            checkoutSessionId: 'cs_sub_001',
                            checkoutUrl:
                                'https://checkout.stripe.test/session/cs_sub_001',
                            updatedAt: '2026-03-30T09:00:00-05:00',
                        },
                    };
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            checkoutUrl:
                                'https://checkout.stripe.test/session/cs_sub_001',
                            sessionId: 'cs_sub_001',
                            clinicProfile: context.data.clinicProfile,
                            subscription:
                                context.data.clinicProfile.software_subscription,
                        },
                    });
                    return true;
                }

                return false;
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page
            .locator('#adminSidebar .nav-item[data-section="settings"]')
            .click();

        await expect(page.locator('#clinicProfileName')).toHaveValue(
            'Aurora Derm Centro'
        );
        await expect(page.locator('#clinicProfileSoftwarePlan')).toHaveValue(
            'Starter'
        );
        await expect(
            page.locator('#softwareSubscriptionPlanHeadline')
        ).toHaveText('Starter');
        await expect(page.locator('#softwareSubscriptionStatusLine')).toContainText(
            'Activa'
        );
        await expect(
            page.locator('#softwareSubscriptionRenewalLine')
        ).toContainText('Próxima renovación');
        await expect(
            page.locator('#softwareSubscriptionInvoiceList')
        ).toContainText('INV-FLOWOS-001');

        await page.locator('#softwareSubscriptionProBtn').click();

        await expect.poll(() => checkoutRequests.length).toBe(1);
        expect(checkoutRequests[0]).toMatchObject({
            planKey: 'pro',
        });
        await expect(
            page.locator('#softwareSubscriptionPendingLine')
        ).toContainText('Cambio preparado a Pro');
        await expect(
            page.locator('#softwareSubscriptionCheckoutLink')
        ).toHaveAttribute(
            'href',
            'https://checkout.stripe.test/session/cs_sub_001'
        );
    });

    test('login legacy de respaldo con contrasena vacia no funciona', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page);

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('#adminPassword');
        const loginBtn = page.locator('#loginBtn');
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('');
        await loginBtn.click();

        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /No se pudo iniciar sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            /Contrasena requerida/
        );
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login legacy de respaldo con contrasena incorrecta muestra error', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, {
            loginError: 'Credenciales inválidas',
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('#adminPassword');
        const loginBtn = page.locator('#loginBtn');
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('contrasena_incorrecta_test');
        await loginBtn.click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /No se pudo iniciar sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            /Credenciales/
        );
        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login legacy de respaldo con 2FA muestra etapa dedicada y permite volver al paso de clave', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: true });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#group2FA')).toBeVisible();
        await expect(page.locator('#loginBtn')).toHaveText(
            /Verificar y entrar/
        );
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /Codigo 2FA requerido/
        );

        await page.locator('#loginReset2FABtn').click();

        await expect(page.locator('#group2FA')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(/Ingresar/);
        await expect(page.locator('#adminPassword')).toBeEnabled();
    });

    test('login legacy de respaldo exitoso actualiza el estado de sesion en el chrome v2', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: false });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /Protegida/
        );
    });

    test('dashboard incluye desgloses de embudo extendidos', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await expect(page.locator('#funnelAbandonList')).toHaveCount(1);
        await expect(page.locator('#funnelEntryList')).toHaveCount(1);
        await expect(page.locator('#funnelSourceList')).toHaveCount(1);
        await expect(page.locator('#funnelPaymentMethodList')).toHaveCount(1);
        await expect(page.locator('#funnelAbandonReasonList')).toHaveCount(1);
        await expect(page.locator('#funnelStepList')).toHaveCount(1);
        await expect(page.locator('#funnelErrorCodeList')).toHaveCount(1);
    });

    test('dashboard resume utilidad historica del asistente de sala', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            funnelMetrics: {
                queueAssistant: {
                    today: {
                        actioned: 5,
                        resolvedWithoutHuman: 3,
                        assistedResolutions: 2,
                        escalated: 1,
                        clinicalBlocked: 1,
                        avgQueueWaitMs: 180000,
                        hourlyThroughput: {
                            '09': 2,
                            '11': 1,
                        },
                    },
                    last7d: {
                        actioned: 21,
                        resolvedWithoutHuman: 12,
                        assistedResolutions: 6,
                        escalated: 5,
                        clinicalBlocked: 2,
                        usefulSessions: 14,
                        avgLatencyMs: 840,
                    },
                    intentBreakdown: [
                        {
                            label: 'wait_time',
                            count: 6,
                        },
                    ],
                    helpReasonBreakdown: [
                        {
                            label: 'clinical_redirect',
                            count: 2,
                        },
                    ],
                    reviewOutcomeBreakdown: [
                        {
                            label: 'appointment_confirmed',
                            count: 4,
                        },
                    ],
                    topIntent: {
                        label: 'wait_time',
                        count: 6,
                    },
                    topHelpReason: {
                        label: 'clinical_redirect',
                        count: 2,
                    },
                    topReviewOutcome: {
                        label: 'appointment_confirmed',
                        count: 4,
                    },
                },
            },
        });

        await page.goto('/admin.html');
        await openDashboardSection(page);
        await expect(page.locator('#dashboardAssistantUtility')).toBeVisible();
        await expect(page.locator('#dashboardAssistantStatus')).toHaveText(
            'Con derivaciones'
        );
        await expect(page.locator('#dashboardAssistantActioned')).toHaveText(
            '5'
        );
        await expect(page.locator('#dashboardAssistantResolved')).toHaveText(
            '3'
        );
        await expect(page.locator('#dashboardAssistantEscalated')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardAssistantBlocked')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardAssistantSummary')).toContainText(
            'Hoy acciono 5'
        );
        await expect(page.locator('#dashboardAssistantSummary')).toContainText(
            'recepcion cerro 2'
        );
        await expect(
            page.locator('#dashboardAssistantWindowMeta')
        ).toContainText('14 sesiones utiles');
        await expect(
            page.locator('#dashboardAssistantWindowMeta')
        ).toContainText('6 cierre(s) asistidos');
        await expect(
            page.locator('#dashboardAssistantWindowMeta')
        ).toContainText('espera hoy 180.000 ms');
        await expect(
            page.locator('#dashboardAssistantTopIntent')
        ).toContainText('wait time');
        await expect(
            page.locator('#dashboardAssistantTopReason')
        ).toContainText('clinical redirect');
        await expect(
            page.locator('#dashboardAssistantTopOutcome')
        ).toContainText('appointment confirmed');
        await expect(page.locator('#waitTimeChart')).toBeVisible();
        await expect(page.locator('#throughputChart')).toBeVisible();
    });

    test('dashboard muestra conversion publica con visitas por dia, clicks WhatsApp y top servicios', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            funnelMetrics: {
                conversionDashboard: {
                    today: {
                        visits: 18,
                        whatsappClicks: 5,
                        bookingConfirmed: 2,
                    },
                    last7d: {
                        days: 7,
                        visits: 84,
                        whatsappClicks: 21,
                        bookingConfirmed: 9,
                        visitsPerDay: 12,
                        whatsappClicksPerDay: 3,
                        bookingConfirmedPerDay: 1.3,
                    },
                    dailySeries: [
                        {
                            day: '2026-03-24',
                            label: '2026-03-24',
                            visits: 10,
                            whatsappClicks: 2,
                            bookingConfirmed: 1,
                        },
                        {
                            day: '2026-03-25',
                            label: '2026-03-25',
                            visits: 11,
                            whatsappClicks: 2,
                            bookingConfirmed: 1,
                        },
                        {
                            day: '2026-03-26',
                            label: '2026-03-26',
                            visits: 12,
                            whatsappClicks: 3,
                            bookingConfirmed: 1,
                        },
                        {
                            day: '2026-03-27',
                            label: '2026-03-27',
                            visits: 13,
                            whatsappClicks: 3,
                            bookingConfirmed: 2,
                        },
                    ],
                    topServices: [
                        {
                            serviceSlug: 'botox',
                            detailViews: 20,
                            bookingIntent: 8,
                            checkoutStarts: 6,
                            bookingConfirmed: 3,
                            detailToConfirmedPct: 15,
                        },
                        {
                            serviceSlug: 'acne_rosacea',
                            detailViews: 14,
                            bookingIntent: 5,
                            checkoutStarts: 4,
                            bookingConfirmed: 2,
                            detailToConfirmedPct: 14.3,
                        },
                    ],
                },
                bookingFunnelReport: {
                    summary: {
                        servicesTracked: 2,
                        detailViews: 23,
                        bookingOpened: 12,
                        slotSelected: 6,
                        bookingConfirmed: 3,
                        biggestDropoffService: 'botox',
                        biggestDropoffStage: 'open_to_slot',
                        biggestDropoffCount: 5,
                    },
                    rows: [
                        {
                            serviceSlug: 'botox',
                            detailViews: 18,
                            bookingOpened: 8,
                            slotSelected: 3,
                            bookingConfirmed: 2,
                            detailToConfirmedPct: 11.1,
                            largestDropoffStage: 'open_to_slot',
                            largestDropoffCount: 5,
                        },
                        {
                            serviceSlug: 'acne_rosacea',
                            detailViews: 5,
                            bookingOpened: 4,
                            slotSelected: 3,
                            bookingConfirmed: 1,
                            detailToConfirmedPct: 20,
                            largestDropoffStage: 'slot_to_confirmed',
                            largestDropoffCount: 2,
                        },
                    ],
                },
            },
        });

        await page.goto('/admin.html');
        await openDashboardSection(page);
        await expect(page.locator('#dashboardConversionChip')).toHaveText(
            'Con traccion'
        );
        await expect(page.locator('#funnelDailyVisitsToday')).toHaveText('18');
        await expect(page.locator('#funnelDailyWhatsappToday')).toHaveText('5');
        await expect(page.locator('#funnelDailyVisitsAvg')).toHaveText('12.0');
        await expect(page.locator('#funnelDailyWhatsappAvg')).toHaveText(
            '3.0'
        );
        await expect(page.locator('#dashboardConversionTopService')).toHaveText(
            'Botox'
        );
        await expect(page.locator('#dashboardConversionPaceHeadline')).toHaveText(
            '9 confirmadas'
        );
        await expect(
            page.locator('#dashboardConversionDailyList [data-conversion-day="true"]')
        ).toHaveCount(4);
        await expect(
            page.locator(
                '#dashboardConversionTopServices [data-conversion-service="true"]'
            )
        ).toHaveCount(2);
        await expect(
            page.locator('#dashboardBookingFunnelDropoffService')
        ).toHaveText('Botox');
        await expect(
            page.locator('#dashboardBookingFunnelDropoffMeta')
        ).toContainText('apertura -> hora');
        await expect(
            page.locator(
                '#dashboardBookingFunnelList [data-booking-funnel-service="true"]'
            )
        ).toHaveCount(2);
    });

    test('dashboard resume operacion multi-clinica por sucursal', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            multiClinicOverview: {
                summary: {
                    clinicCount: 3,
                    clinicsWithActivity: 2,
                    todayAppointments: 9,
                    patientCount: 7,
                    settledRevenueLabel: '$1,420.00',
                    fallbackAssignedRecords: 2,
                    explicitlyScopedRecords: 8,
                    generatedAt: '2026-03-31T11:05:00-05:00',
                },
                comparative: {
                    leaderByRevenue: {
                        clinicId: 'clinica-centro',
                        clinicLabel: 'Clinica Centro',
                        todayAppointments: 4,
                        patientCount: 3,
                        settledRevenueLabel: '$720.00',
                    },
                    leaderByDemand: {
                        clinicId: 'clinica-norte',
                        clinicLabel: 'Clinica Norte',
                        todayAppointments: 5,
                        patientCount: 4,
                        settledRevenueLabel: '$540.00',
                    },
                },
                clinics: [
                    {
                        clinicId: 'clinica-centro',
                        clinicLabel: 'Clinica Centro',
                        region: 'Quito',
                        status: 'leader',
                        isActiveClinic: true,
                        isRevenueLeader: true,
                        isDemandLeader: false,
                        hasActivity: true,
                        todayAppointments: 4,
                        patientCount: 3,
                        settledRevenueLabel: '$720.00',
                    },
                    {
                        clinicId: 'clinica-norte',
                        clinicLabel: 'Clinica Norte',
                        region: 'Quito Norte',
                        status: 'leader',
                        isActiveClinic: false,
                        isRevenueLeader: false,
                        isDemandLeader: true,
                        hasActivity: true,
                        todayAppointments: 5,
                        patientCount: 4,
                        settledRevenueLabel: '$540.00',
                    },
                    {
                        clinicId: 'clinica-sur',
                        clinicLabel: 'Clinica Sur',
                        region: 'Valle',
                        status: 'idle',
                        isActiveClinic: false,
                        isRevenueLeader: false,
                        isDemandLeader: false,
                        hasActivity: false,
                        todayAppointments: 0,
                        patientCount: 0,
                        settledRevenueLabel: '$0.00',
                    },
                ],
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        await expect(page.locator('#dashboardMultiClinicChip')).toHaveText(
            '2/3 activas'
        );
        await expect(page.locator('#multiClinicCount')).toHaveText('3');
        await expect(page.locator('#multiClinicAppointmentsToday')).toHaveText(
            '9'
        );
        await expect(page.locator('#multiClinicRevenueLabel')).toHaveText(
            '$1,420.00'
        );
        await expect(page.locator('#multiClinicPatientCount')).toHaveText('7');
        await expect(
            page.locator('#dashboardMultiClinicRevenueLeaderHeadline')
        ).toHaveText('Clinica Centro');
        await expect(
            page.locator('#dashboardMultiClinicDemandLeaderHeadline')
        ).toHaveText('Clinica Norte');
        await expect(page.locator('#dashboardMultiClinicSummary')).toContainText(
            '2 registro(s) siguen usando fallback'
        );
        await expect(
            page.locator('#dashboardMultiClinicList [data-multi-clinic-row="true"]')
        ).toHaveCount(3);
        await expect(page.locator('#dashboardMultiClinicList')).toContainText(
            'Clinica Sur'
        );
        await expect(page.locator('#dashboardMultiClinicList')).toContainText(
            'Ingresos $720.00'
        );
    });

    test('inicio operativo simplifica accesos y resuelve tareas en un clic', async ({
        page,
    }) => {
        const today = new Date().toISOString().split('T')[0];
        await setupAuthenticatedAdminMocks(page, {
            appointments: [
                {
                    id: 1,
                    name: 'Paciente Test',
                    email: 'paciente@example.com',
                    phone: '+593999111222',
                    service: 'consulta',
                    doctor: 'rosero',
                    date: today,
                    time: '10:00',
                    status: 'confirmed',
                    paymentStatus: 'pending_transfer_review',
                },
            ],
            callbacks: [
                {
                    id: 9,
                    telefono: '+593988776655',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);
        await expect(page.locator('#opsTodaySummaryCard')).toBeVisible();
        await expect(page.locator('#opsPendingSummaryCard')).toBeVisible();
        await expect(page.locator('#opsAvailabilitySummaryCard')).toBeVisible();
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(
            page.locator('#dashboardAdvancedAnalytics')
        ).not.toHaveJSProperty('open', true);
        await expect(page.locator('#operationPendingReviewCount')).toHaveText(
            '1'
        );
        await expect(
            page.locator('#operationPendingCallbacksCount')
        ).toHaveText('1');

        await page
            .locator(
                '#opsTodaySummaryCard [data-action="context-open-appointments-overview"]'
            )
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsPendingSummaryCard [data-action="context-open-callbacks-pending"]'
            )
            .click();

        await expect(page.locator('#callbacks')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsAvailabilitySummaryCard [data-action="context-open-availability"]'
            )
            .click();

        await expect(page.locator('#availability')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page.locator('#openOperatorAppBtn').click();

        await expect(page).toHaveURL(/\/operador-turnos\.html$/);
    });

    test('dashboard incorpora telemedicina y patient flow en la atencion operativa', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            patientFlowMeta: {
                casesTotal: 3,
                casesOpen: 2,
                pendingApprovals: 1,
                activeHelpRequests: 1,
                journeyPreview: {
                    redacted: true,
                    cases: [],
                    stageCounts: {
                        scheduled: 2,
                        care_plan: 1,
                    },
                },
            },
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 2,
                },
            },
            internalConsoleMeta: {
                clinicalData: {
                    ready: false,
                },
                overall: {
                    ready: false,
                    summary:
                        'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                },
            },
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        const telemedicineItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Telemedicina' });
        await expect(telemedicineItem).toContainText('2');
        await expect(telemedicineItem).toContainText(/gate clinico/i);

        const patientFlowItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Casos activos' });
        await expect(patientFlowItem).toContainText('2');
        await expect(patientFlowItem).toContainText(/3 caso\(s\) totales/i);
        await expect(patientFlowItem).toContainText(/1 aprobacion\(es\)/i);

        await expect(page.locator('#dashboardFlowStatus')).toContainText(
            '2 intake(s) telemedicina'
        );
        await expect(page.locator('#dashboardFlowStatus')).toContainText(
            '2 caso(s) activos'
        );
        await expect(page.locator('#dashboardJourneyHeadline')).toContainText(
            'Journey protegido'
        );
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'almacenamiento cifrado'
        );
    });

    test('dashboard muestra timeline visual por paciente cuando Flow OS expone journey cases', async ({
        page,
    }) => {
        const sixHoursAgo = new Date(
            Date.now() - 6 * 60 * 60 * 1000
        ).toISOString();
        const fourHoursAgo = new Date(
            Date.now() - 4 * 60 * 60 * 1000
        ).toISOString();
        const threeHoursAgo = new Date(
            Date.now() - 3 * 60 * 60 * 1000
        ).toISOString();
        const twoHoursAgo = new Date(
            Date.now() - 2 * 60 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            patientFlowMeta: {
                casesTotal: 4,
                casesOpen: 4,
                journeyPreview: {
                    stage: 'scheduled',
                    label: 'Cita programada',
                    ownerLabel: 'Agenda',
                    timelineStages: [
                        {
                            id: 'lead_captured',
                            displayId: 'lead_captured',
                            displayLabel: 'Lead',
                        },
                        {
                            id: 'intake_completed',
                            displayId: 'intake',
                            displayLabel: 'Intake',
                        },
                        {
                            id: 'scheduled',
                            displayId: 'scheduled',
                            displayLabel: 'Agendada',
                        },
                        {
                            id: 'care_plan_ready',
                            displayId: 'care_plan',
                            displayLabel: 'Plan',
                        },
                        {
                            id: 'follow_up_active',
                            displayId: 'follow_up',
                            displayLabel: 'Seguimiento',
                        },
                        {
                            id: 'resolved',
                            displayId: 'resolved',
                            displayLabel: 'Resuelto',
                        },
                    ],
                    stageCounts: {
                        lead_captured: 1,
                        scheduled: 1,
                        care_plan: 1,
                        follow_up: 1,
                    },
                    activityFeed: [
                        {
                            id: 'history-ana-scheduled',
                            caseId: 'pc-001',
                            patientLabel: 'Ana Ruiz',
                            stage: 'scheduled',
                            displayStage: 'scheduled',
                            displayStageLabel: 'Agendada',
                            stageIndex: 2,
                            timestamp: twoHoursAgo,
                            sourceLabel: 'Reserva confirmada',
                            actorLabel: 'Agenda',
                            isCurrentStage: true,
                        },
                        {
                            id: 'history-luis-care-plan',
                            caseId: 'pc-002',
                            patientLabel: 'Luis Perez',
                            stage: 'care_plan_ready',
                            displayStage: 'care_plan',
                            displayStageLabel: 'Plan',
                            stageIndex: 3,
                            timestamp: threeHoursAgo,
                            sourceLabel: 'Paciente llamado a consultorio',
                            actorLabel: 'Consultorio',
                            isCurrentStage: true,
                        },
                    ],
                    cases: [
                        {
                            caseId: 'pc-000',
                            patientLabel: 'Marta Salazar',
                            serviceLine: 'Primera consulta',
                            providerName: 'Recepcion',
                            stage: 'lead_captured',
                            displayStage: 'lead_captured',
                            stageLabel: 'Lead captado',
                            ownerLabel: 'Recepcion',
                            timeInStageMs: 3 * 60 * 60 * 1000,
                            nextActionLabel: 'Solicitar datos de identidad',
                            nextActions: [
                                {
                                    id: 'request_identity_completion',
                                    label: 'Solicitar datos de identidad',
                                },
                                {
                                    id: 'offer_preconsultation_form',
                                    label: 'Enviar formulario de preconsulta',
                                },
                            ],
                            alerts: [],
                            journeyHistory: [
                                {
                                    id: 'pc-000-lead',
                                    caseId: 'pc-000',
                                    stage: 'lead_captured',
                                    displayStage: 'lead_captured',
                                    displayStageLabel: 'Lead',
                                    stageIndex: 0,
                                    timestamp: fourHoursAgo,
                                    sourceLabel: 'Caso abierto',
                                    actorLabel: 'Recepcion',
                                    isCurrentStage: true,
                                },
                            ],
                        },
                        {
                            caseId: 'pc-001',
                            patientLabel: 'Ana Ruiz',
                            serviceLine: 'Consulta dermatologica',
                            providerName: 'Dra. Rosero',
                            stage: 'scheduled',
                            displayStage: 'scheduled',
                            stageLabel: 'Cita programada',
                            ownerLabel: 'Agenda',
                            timeInStageMs: 2 * 60 * 60 * 1000,
                            nextActionLabel: 'Confirmar cita',
                            nextActions: [
                                {
                                    id: 'confirm_appointment',
                                    label: 'Confirmar cita',
                                },
                                {
                                    id: 'prepare_chart',
                                    label: 'Preparar resumen clinico',
                                },
                            ],
                            alerts: [],
                            journeyHistory: [
                                {
                                    id: 'pc-001-lead',
                                    caseId: 'pc-001',
                                    stage: 'lead_captured',
                                    displayStage: 'lead_captured',
                                    displayStageLabel: 'Lead',
                                    stageIndex: 0,
                                    timestamp: sixHoursAgo,
                                    sourceLabel: 'Caso abierto',
                                    actorLabel: 'Recepcion',
                                },
                                {
                                    id: 'pc-001-scheduled',
                                    caseId: 'pc-001',
                                    stage: 'scheduled',
                                    displayStage: 'scheduled',
                                    displayStageLabel: 'Agendada',
                                    stageIndex: 2,
                                    timestamp: twoHoursAgo,
                                    sourceLabel: 'Reserva confirmada',
                                    actorLabel: 'Agenda',
                                    isCurrentStage: true,
                                },
                            ],
                        },
                        {
                            caseId: 'pc-002',
                            patientLabel: 'Luis Perez',
                            serviceLine: 'Control de acne',
                            providerName: 'Dra. Narvaez',
                            stage: 'care_plan_ready',
                            displayStage: 'care_plan',
                            stageLabel: 'Plan de cuidado listo',
                            ownerLabel: 'Clinico',
                            timeInStageMs: 3 * 60 * 60 * 1000,
                            nextActionLabel: 'Enviar plan al paciente',
                            nextActions: [
                                {
                                    id: 'deliver_care_plan',
                                    label: 'Enviar plan al paciente',
                                },
                                {
                                    id: 'schedule_follow_up',
                                    label: 'Agendar seguimiento',
                                },
                            ],
                            alerts: ['1 aprobacion(es) pendiente(s)'],
                            journeyHistory: [
                                {
                                    id: 'pc-002-scheduled',
                                    caseId: 'pc-002',
                                    stage: 'scheduled',
                                    displayStage: 'scheduled',
                                    displayStageLabel: 'Agendada',
                                    stageIndex: 2,
                                    timestamp: sixHoursAgo,
                                    sourceLabel: 'Reserva confirmada',
                                    actorLabel: 'Agenda',
                                },
                                {
                                    id: 'pc-002-care-plan',
                                    caseId: 'pc-002',
                                    stage: 'care_plan_ready',
                                    displayStage: 'care_plan',
                                    displayStageLabel: 'Plan',
                                    stageIndex: 3,
                                    timestamp: threeHoursAgo,
                                    sourceLabel:
                                        'Paciente llamado a consultorio',
                                    actorLabel: 'Consultorio',
                                    isCurrentStage: true,
                                },
                            ],
                        },
                        {
                            caseId: 'pc-003',
                            patientLabel: 'Diego Mora',
                            serviceLine: 'Seguimiento de melasma',
                            providerName: 'Dra. Rosero',
                            stage: 'follow_up_active',
                            displayStage: 'follow_up',
                            stageLabel: 'Seguimiento activo',
                            ownerLabel: 'Seguimiento',
                            timeInStageMs: 80 * 60 * 60 * 1000,
                            nextActionLabel:
                                'Solicitar actualizacion de evolucion',
                            nextActions: [
                                {
                                    id: 'request_progress_update',
                                    label: 'Solicitar actualizacion de evolucion',
                                },
                            ],
                            alerts: [],
                            journeyHistory: [
                                {
                                    id: 'pc-003-follow-up',
                                    caseId: 'pc-003',
                                    stage: 'follow_up_active',
                                    displayStage: 'follow_up',
                                    displayStageLabel: 'Seguimiento',
                                    stageIndex: 4,
                                    timestamp: fourHoursAgo,
                                    sourceLabel: 'Seguimiento activado',
                                    actorLabel: 'Seguimiento',
                                    isCurrentStage: true,
                                },
                            ],
                        },
                    ],
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await openDashboardSection(page);

        await expect(page.locator('#dashboardJourneyHeadline')).toContainText(
            '4 paciente(s)'
        );
        await expect(page.locator('#dashboardJourneySummary')).toContainText(
            '1 agendada'
        );
        await expect(page.locator('#dashboardJourneySummary')).toContainText(
            '1 plan'
        );
        await expect(page.locator('#dashboardJourneyBoard')).toContainText(
            'Todo el journey'
        );
        await expect(
            page.locator('[data-journey-stage-filter="lead_captured"]')
        ).toContainText('1 alerta(s) SLA');
        await expect(
            page.locator('[data-journey-stage-filter="follow_up"]')
        ).toContainText('1 alerta(s) SLA');

        const anaJourneyCard = page
            .locator('#dashboardJourneyTimeline .dashboard-journey-item')
            .filter({ hasText: 'Ana Ruiz' });
        await expect(anaJourneyCard).toContainText('Agenda');
        await expect(anaJourneyCard).toContainText('Lleva 2 h');
        await expect(anaJourneyCard).toContainText('Confirmar cita');
        await expect(
            anaJourneyCard.locator('.dashboard-journey-history')
        ).toContainText('Lead');
        await expect(
            anaJourneyCard.locator('.dashboard-journey-history')
        ).toContainText('Reserva confirmada');
        await expect(
            anaJourneyCard.locator('.dashboard-journey-node.is-active')
        ).toContainText('Agendada');
        await expect(page.locator('#dashboardJourneyFeed')).toContainText(
            'Ana Ruiz -> Agendada'
        );
        await expect(page.locator('#dashboardJourneyFeed')).toContainText(
            'Reserva confirmada'
        );
        await expect(page.locator('#dashboardJourneyFeed')).toContainText(
            'por Agenda'
        );
        await expect(page.locator('#dashboardJourneyFeed')).toContainText(
            /Hace [23] h/
        );

        const luisJourneyCard = page
            .locator('#dashboardJourneyTimeline .dashboard-journey-item')
            .filter({ hasText: 'Luis Perez' });
        await expect(luisJourneyCard).toContainText('Clinico');
        await expect(luisJourneyCard).toContainText(
            /aprobacion\(es\) pendiente/i
        );
        await expect(
            luisJourneyCard.locator('.dashboard-journey-history')
        ).toContainText('Paciente llamado a consultorio');
        await expect(
            luisJourneyCard.locator('.dashboard-journey-history')
        ).toContainText('por Consultorio');
        await expect(page.locator('#dashboardJourneyStatusChip')).toContainText(
            'Con alertas'
        );

        await page
            .locator('[data-journey-stage-filter="lead_captured"]')
            .click();
        await expect(
            page.locator('#dashboardJourneyFilterLabel')
        ).toContainText('Lead');
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Marta Salazar'
        );
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Lead sin respuesta > 2 h'
        );
        await expect(
            page.locator('#dashboardJourneyTimeline')
        ).not.toContainText('Ana Ruiz');
        await expect(
            page.locator(
                '#dashboardJourneyTimeline [data-journey-action="request_identity_completion"]'
            )
        ).toContainText('Solicitar datos de identidad');
        await expect(
            page.locator(
                '#dashboardJourneyTimeline [data-journey-action="offer_preconsultation_form"]'
            )
        ).toContainText('Enviar formulario de preconsulta');

        await page.locator('[data-journey-stage-filter="follow_up"]').click();
        await expect(
            page.locator('#dashboardJourneyFilterLabel')
        ).toContainText('Seguimiento');
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Diego Mora'
        );
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Follow-up vencido'
        );
        await expect(page.locator('#dashboardJourneySlaSummary')).toContainText(
            '1 caso(s) con alerta SLA'
        );

        await page.locator('[data-journey-stage-filter="care_plan"]').click();
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Luis Perez'
        );
        const deliverCarePlanButton = page.locator(
            '#dashboardJourneyTimeline [data-journey-action="deliver_care_plan"]'
        );
        await expect(deliverCarePlanButton).toContainText(
            'Enviar plan al paciente'
        );
        await deliverCarePlanButton.click();
        await expect(page.locator('#toastContainer')).toContainText(
            'Luis Perez: plan listo para enviar al paciente.'
        );
    });

    test('dashboard permite verificar y aplicar transferencias del checkout publico', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            checkoutReviewMeta: {
                summary: {
                    pendingCount: 1,
                    verifiedCount: 1,
                    appliedCount: 0,
                    missingProofCount: 0,
                    queueCount: 2,
                },
                queue: [
                    {
                        id: 'co_transfer_001',
                        receiptNumber: 'PAY-20260330-TRF01',
                        concept: 'Saldo peeling',
                        amountLabel: '$95.00',
                        paymentStatus: 'pending_transfer',
                        paymentStatusLabel: 'Pendiente de verificacion',
                        payerName: 'Paciente Transferencia',
                        payerWhatsapp: '+593999777666',
                        transferReference: 'TRX-VERIFY-01',
                        transferProofUrl:
                            'https://pielarmonia.com/uploads/transfer-proofs/proof-001.png',
                        transferProofUploadedAt: new Date().toISOString(),
                        canVerify: true,
                        canApply: false,
                    },
                    {
                        id: 'co_transfer_002',
                        receiptNumber: 'PAY-20260330-TRF02',
                        concept: 'Control laser',
                        amountLabel: '$75.00',
                        paymentStatus: 'verified_transfer',
                        paymentStatusLabel: 'Verificado',
                        payerName: 'Paciente Aplicar',
                        payerEmail: 'aplicar@example.com',
                        transferReference: 'TRX-APPLY-02',
                        transferProofUrl:
                            'https://pielarmonia.com/uploads/transfer-proofs/proof-002.png',
                        transferProofUploadedAt: new Date().toISOString(),
                        transferVerifiedAt: new Date().toISOString(),
                        canVerify: false,
                        canApply: true,
                    },
                ],
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await openDashboardSection(page);

        await expect(page.locator('#checkoutReviewPendingCount')).toHaveText(
            '1'
        );
        await expect(page.locator('#checkoutReviewVerifiedCount')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardCheckoutReviewQueue')).toContainText(
            'PAY-20260330-TRF01'
        );

        await page
            .locator(
                '[data-checkout-review-action="verify"][data-order-id="co_transfer_001"]'
            )
            .click();

        await expect(page.locator('#checkoutReviewPendingCount')).toHaveText(
            '0'
        );
        await expect(page.locator('#checkoutReviewVerifiedCount')).toHaveText(
            '2'
        );
        await expect(page.locator('#toastContainer')).toContainText(
            'Transferencia verificada'
        );

        await page
            .locator(
                '[data-checkout-review-action="apply"][data-order-id="co_transfer_002"]'
            )
            .click();

        await expect(page.locator('#checkoutReviewAppliedCount')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardCheckoutReviewQueue')).toContainText(
            'Aplicado'
        );
    });

    test('dashboard muestra estado de cuenta por paciente con saldos y vencimientos', async ({
        page,
    }) => {
        const now = Date.now();
        const overdueAt = new Date(now - 6 * 60 * 60 * 1000).toISOString();
        const dueSoonAt = new Date(now + 20 * 60 * 60 * 1000).toISOString();
        const settledAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            paymentAccountMeta: {
                summary: {
                    patientCount: 2,
                    outstandingCount: 2,
                    reconciliatingCount: 1,
                    dueSoonCount: 1,
                    overdueCount: 1,
                    outstandingBalanceCents: 15500,
                    outstandingBalanceLabel: '$155.00',
                    reconciliatingBalanceCents: 4000,
                    reconciliatingBalanceLabel: '$40.00',
                    settledBalanceCents: 4500,
                    settledBalanceLabel: '$45.00',
                },
                patients: [
                    {
                        id: 'acct_ana',
                        patientKey: 'email:ana@example.com',
                        patientName: 'Ana Test',
                        patientEmail: 'ana@example.com',
                        patientWhatsapp: '+593999000111',
                        orderCount: 2,
                        outstandingCount: 1,
                        reconciliatingCount: 0,
                        settledCount: 1,
                        dueSoonCount: 0,
                        overdueCount: 1,
                        outstandingBalanceCents: 8000,
                        outstandingBalanceLabel: '$80.00',
                        reconciliatingBalanceCents: 0,
                        reconciliatingBalanceLabel: '$0.00',
                        settledBalanceCents: 4500,
                        settledBalanceLabel: '$45.00',
                        nextDueAt: overdueAt,
                        lastActivityAt: overdueAt,
                        orders: [
                            {
                                id: 'co_ana_pending',
                                receiptNumber: 'PAY-ANA-001',
                                concept: 'Saldo peeling',
                                amountLabel: '$80.00',
                                paymentMethod: 'transfer',
                                paymentMethodLabel: 'Transferencia',
                                paymentStatus: 'pending_transfer',
                                paymentStatusLabel: 'Pendiente de verificacion',
                                statusBucket: 'outstanding',
                                dueAt: overdueAt,
                                dueState: 'overdue',
                                activityAt: overdueAt,
                            },
                            {
                                id: 'co_ana_paid',
                                receiptNumber: 'PAY-ANA-002',
                                concept: 'Control laser',
                                amountLabel: '$45.00',
                                paymentMethod: 'card',
                                paymentMethodLabel: 'Tarjeta',
                                paymentStatus: 'paid',
                                paymentStatusLabel: 'Pagado',
                                statusBucket: 'settled',
                                activityAt: settledAt,
                            },
                        ],
                    },
                    {
                        id: 'acct_luis',
                        patientKey: 'email:luis@example.com',
                        patientName: 'Luis Mora',
                        patientEmail: 'luis@example.com',
                        patientWhatsapp: '+593999000222',
                        orderCount: 2,
                        outstandingCount: 1,
                        reconciliatingCount: 1,
                        settledCount: 0,
                        dueSoonCount: 1,
                        overdueCount: 0,
                        outstandingBalanceCents: 7500,
                        outstandingBalanceLabel: '$75.00',
                        reconciliatingBalanceCents: 4000,
                        reconciliatingBalanceLabel: '$40.00',
                        settledBalanceCents: 0,
                        settledBalanceLabel: '$0.00',
                        nextDueAt: dueSoonAt,
                        lastActivityAt: dueSoonAt,
                        orders: [
                            {
                                id: 'co_luis_pending',
                                receiptNumber: 'PAY-LUI-001',
                                concept: 'Control acne',
                                amountLabel: '$75.00',
                                paymentMethod: 'cash',
                                paymentMethodLabel: 'Efectivo en consultorio',
                                paymentStatus: 'pending_cash',
                                paymentStatusLabel: 'Pendiente de pago en consultorio',
                                statusBucket: 'outstanding',
                                dueAt: dueSoonAt,
                                dueState: 'due_soon',
                                activityAt: dueSoonAt,
                            },
                            {
                                id: 'co_luis_verified',
                                receiptNumber: 'PAY-LUI-002',
                                concept: 'Reserva procedimiento',
                                amountLabel: '$40.00',
                                paymentMethod: 'transfer',
                                paymentMethodLabel: 'Transferencia',
                                paymentStatus: 'verified_transfer',
                                paymentStatusLabel: 'Verificado',
                                statusBucket: 'reconciliating',
                                activityAt: overdueAt,
                            },
                        ],
                    },
                ],
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await openDashboardSection(page);

        await expect(page.locator('#paymentAccountPatientCount')).toHaveText(
            '2'
        );
        await expect(page.locator('#paymentAccountOutstandingCount')).toHaveText(
            '2'
        );
        await expect(page.locator('#paymentAccountOverdueCount')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardPaymentAccountChip')).toContainText(
            '1 vencido'
        );
        await expect(page.locator('#dashboardPaymentAccountSummary')).toContainText(
            'Saldo pendiente $155.00'
        );
        await expect(page.locator('#dashboardPaymentAccountList')).toContainText(
            'Ana Test'
        );
        await expect(page.locator('#dashboardPaymentAccountList')).toContainText(
            'Luis Mora'
        );
        await expect(page.locator('#dashboardPaymentAccountList')).toContainText(
            'PAY-ANA-001'
        );
        await expect(page.locator('#dashboardPaymentAccountList')).toContainText(
            '$40.00 por aplicar'
        );
    });

    test('dashboard muestra el timeline reciente de Flow OS por paciente', async ({
        page,
    }) => {
        const now = Date.now();
        const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
        const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            patientFlowMeta: {
                casesTotal: 2,
                casesOpen: 1,
                pendingApprovals: 0,
                activeHelpRequests: 0,
                journeyHistory: {
                    selectedCaseId: 'pc_demo_001',
                    generatedAt: new Date(now).toISOString(),
                    cases: [
                        {
                            caseId: 'pc_demo_001',
                            patientId: 'pt_demo_001',
                            patientLabel: 'Juan Perez',
                            caseStatus: 'booked',
                            currentStage: 'scheduled',
                            currentStageLabel: 'Cita programada',
                            owner: 'appointment-worker',
                            ownerLabel: 'Agenda',
                            latestActivityAt: oneHourAgo,
                            openedAt: threeHoursAgo,
                            timelineCount: 2,
                            currentTransitionTitle: 'Reserva confirmada',
                        },
                    ],
                    recentTransitions: [
                        {
                            caseId: 'pc_demo_001',
                            patientId: 'pt_demo_001',
                            patientLabel: 'Juan Perez',
                            caseStatus: 'booked',
                            stage: 'scheduled',
                            stageLabel: 'Cita programada',
                            title: 'Reserva confirmada',
                            actor: 'appointment-worker',
                            actorLabel: 'Agenda',
                            occurredAt: oneHourAgo,
                            sourceType: 'appointment_created',
                            sourceTitle: 'Reserva confirmada',
                            meta: 'Agenda confirmada',
                        },
                        {
                            caseId: 'pc_demo_001',
                            patientId: 'pt_demo_001',
                            patientLabel: 'Juan Perez',
                            caseStatus: 'booked',
                            stage: 'lead_captured',
                            stageLabel: 'Lead captado',
                            title: 'Lead captado',
                            actor: 'frontdesk',
                            actorLabel: 'Recepcion',
                            occurredAt: threeHoursAgo,
                            sourceType: 'callback_created',
                            sourceTitle: 'Callback registrado',
                            meta: 'Callback pendiente',
                        },
                    ],
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        await expect(page.locator('#dashboardJourneyHistoryChip')).toContainText(
            '2 cambio(s)'
        );
        await expect(
            page.locator('#dashboardJourneyFocusHeadline')
        ).toContainText('Juan Perez');
        await expect(
            page.locator('#dashboardJourneyStageHeadline')
        ).toContainText('Cita programada');
        await expect(
            page.locator('#dashboardJourneyTimeline .dashboard-journey-item')
        ).toHaveCount(2);
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Juan Perez -> Cita programada'
        );
        await expect(page.locator('#dashboardJourneyTimeline')).toContainText(
            'Agenda'
        );
    });

    test('dashboard mantiene una accion clinica util cuando solo hay telemedicina o patient flow pendientes', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            clinicalHistoryMeta: {
                summary: {
                    configured: true,
                    reviewQueueCount: 0,
                    drafts: {
                        pendingAiCount: 0,
                        reviewQueueCount: 0,
                    },
                    events: {
                        unreadCount: 0,
                    },
                },
                reviewQueue: [],
                events: [],
            },
            patientFlowMeta: {
                casesTotal: 2,
                casesOpen: 1,
                pendingApprovals: 1,
                activeHelpRequests: 0,
            },
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 2,
                },
            },
            internalConsoleMeta: {
                clinicalData: {
                    ready: false,
                },
                overall: {
                    ready: false,
                    summary:
                        'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        const clinicalAction = page
            .locator('#dashboardClinicalHistoryActions .operations-action-item')
            .filter({ hasText: 'Abrir frente clinico' });
        await expect(clinicalAction).toContainText(
            '2 intake(s) telemedicina pausados por gate clinico'
        );

        await clinicalAction.click();

        await expect(page.locator('#clinical-history')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Historia clinica');
    });

    test('dashboard destaca urgencia IA alta en telemedicina cuando hay intakes sensibles', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 2,
                    intakes: {
                        photoAiHighUrgencyCount: 1,
                    },
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        const telemedicineItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Telemedicina' });
        await expect(telemedicineItem).toContainText(
            '1 intake(s) con urgencia IA 4-5'
        );

        const clinicalAction = page
            .locator('#dashboardClinicalHistoryActions .operations-action-item')
            .filter({ hasText: 'Abrir frente clinico' });
        await expect(clinicalAction).toContainText(
            '1 intake(s) telemedicina con urgencia IA 4-5'
        );
    });

    test('dashboard destaca pre-consulta nueva de telemedicina antes de entrar', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 0,
                    briefingQueueCount: 1,
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await openDashboardSection(page);

        const telemedicineItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Telemedicina' });
        await expect(telemedicineItem).toContainText(
            '1 teleconsulta(s) llegan con pre-consulta nueva antes de entrar.'
        );

        const clinicalAction = page
            .locator('#dashboardClinicalHistoryActions .operations-action-item')
            .filter({ hasText: 'Abrir frente clinico' });
        await expect(clinicalAction).toContainText(
            '1 teleconsulta(s) tienen pre-consulta nueva antes de entrar'
        );
    });

    test('acciones secundarias del dashboard siguen llevando a triage util', async ({
        page,
    }) => {
        const today = new Date().toISOString().split('T')[0];
        await setupAuthenticatedAdminMocks(page, {
            appointments: [
                {
                    id: 1,
                    name: 'Paciente Test',
                    email: 'paciente@example.com',
                    phone: '+593999111222',
                    service: 'consulta',
                    doctor: 'rosero',
                    date: today,
                    time: '10:00',
                    status: 'confirmed',
                    paymentStatus: 'pending_transfer_review',
                },
            ],
            callbacks: [
                {
                    id: 9,
                    telefono: '+593988776655',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await openDashboardSection(page);
        await expect(page.locator('.dashboard-card-operations')).toBeVisible();
        await expect(
            page.locator('#operationActionList .operations-action-item')
        ).toHaveCount(3);

        await page
            .locator(
                '.dashboard-card-operations [data-action="context-open-appointments-overview"]'
            )
            .first()
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
    });

    test('callbacks triage prioriza siguiente llamada y enfoca contacto', async ({
        page,
    }) => {
        const oldPendingDate = new Date(
            Date.now() - 3 * 60 * 60 * 1000
        ).toISOString();
        const recentPendingDate = new Date(
            Date.now() - 20 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 101,
                    telefono: '+593988111222',
                    preferencia: 'ahora',
                    fecha: oldPendingDate,
                    status: 'pending',
                    leadOps: {
                        priorityBand: 'hot',
                    },
                },
                {
                    id: 102,
                    telefono: '+593977333444',
                    preferencia: '30min',
                    fecha: recentPendingDate,
                    status: 'pending',
                },
                {
                    id: 103,
                    telefono: '+593966555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsPendingCount')).toHaveText('2');
        await expect(page.locator('#callbacksOpsUrgentCount')).toHaveText('1');
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: prioridad comercial alta'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            '+593988111222'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);

        await page.locator('#callbacksOpsNextBtn').click();
        await expect(
            page.locator(
                '.callback-quick-filter-btn[data-filter-value="pending"]'
            )
        ).toHaveClass(/is-active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card.pendiente:has-text("+593988111222")'
            )
        ).toBeVisible();
        await expect(page.locator('#callbacksOpsNextBtn')).toBeEnabled();
    });

    test('callbacks triage muestra copy UTF-8 correcto en estado de atencion y fallback de telefono', async ({
        page,
    }) => {
        const mediumPendingDateA = new Date(
            Date.now() - 150 * 60 * 1000
        ).toISOString();
        const mediumPendingDateB = new Date(
            Date.now() - 130 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 201,
                    telefono: '',
                    preferencia: 'ahora',
                    fecha: mediumPendingDateA,
                    status: 'pending',
                },
                {
                    id: 202,
                    telefono: '+593977111222',
                    preferencia: '30min',
                    fecha: mediumPendingDateB,
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: atencion requerida'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            'Sin telefono'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);
    });

    test('callbacks permite seleccion visible y marcado masivo', async ({
        page,
    }) => {
        const callbackWriteRequests = [];
        page.on('request', (request) => {
            if (
                request.url().includes('/api.php?resource=callbacks') &&
                request.method() !== 'GET'
            ) {
                callbackWriteRequests.push(request.method());
            }
        });

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 301,
                    telefono: '+593955111222',
                    preferencia: 'ahora',
                    fecha: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 302,
                    telefono: '+593955333444',
                    preferencia: '30min',
                    fecha: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 303,
                    telefono: '+593955555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
            )
        ).toHaveCount(2);

        await page.locator('#callbacksBulkSelectVisibleBtn').click();
        await expect(page.locator('#callbacksSelectionChip')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#callbacksSelectedCount')).toHaveText('2');

        await page.locator('#callbacksBulkMarkBtn').click();
        await expect
            .poll(() => callbackWriteRequests.length)
            .toBeGreaterThan(0);
        await expect(page.locator('#callbacksSelectionChip')).toHaveClass(
            /is-hidden/
        );
    });

    test('tema tambien funciona en dashboard autenticado', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        const headerDarkBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        const headerLightBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="light"]'
            )
            .first();

        await expect(headerDarkBtn).toBeVisible();
        await headerDarkBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({ mode: 'dark', theme: 'dark' });

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 15000,
        });
        await expect(headerDarkBtn).toHaveClass(/is-active/);
        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({ theme: 'dark', stored: 'dark' });

        await headerLightBtn.click();
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('tema en admin se sincroniza via storage event', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'dark',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
            });

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'light',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('reanuda ultima seccion y estado de sidebar colapsado en desktop', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminLastSection', 'callbacks');
            localStorage.setItem('adminSidebarCollapsed', '1');
        });
        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 701,
                    telefono: '+593900000701',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page).toHaveURL(/#callbacks$/);
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        await page.locator('#adminSidebarCollapse').click();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    localStorage.getItem('adminSidebarCollapsed')
                )
            )
            .toBe('0');
    });

    test('atajo Alt+Shift+M colapsa en desktop y abre menu en viewport compacto', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.setViewportSize({ width: 900, height: 900 });
        await expect(page.locator('#adminMenuToggle')).toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page.keyboard.press('Escape');
        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
    });

    test.describe('API de administracion (requiere PHP)', () => {
        test('API health check funciona', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=health');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
            expect(body.status).toBe('ok');
        });

        test('API data sin auth devuelve 401', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=data');
            expect(resp.status()).toBe(401);
        });

        test('API availability devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=availability');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });

        test('API reviews devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=reviews');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });
    });
});
