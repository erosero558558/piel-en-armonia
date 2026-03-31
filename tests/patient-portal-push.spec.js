// @ts-check
const { test, expect } = require('@playwright/test');

const SESSION = {
    token: 'header.payload.signature',
    expiresAt: '2026-04-06T00:00:00Z',
    patient: {
        subject: 'pt_lucia_001',
        patientId: 'pt_lucia_001',
        patientCaseId: 'pc_lucia_001',
        name: 'Lucia Portal',
        phoneMasked: '******4567',
    },
};

test.describe('Patient portal push reminders', () => {
    test('activates Web Push from the portal dashboard and scopes the subscription to the signed patient session', async ({
        page,
    }) => {
        let serverSubscribed = false;
        let subscribeRequest = null;

        await page.addInitScript((session) => {
            window.localStorage.setItem('auroraPatientPortalSession', JSON.stringify(session));

            const subscription = {
                endpoint: 'https://push.example.test/subscriptions/browser-001',
                expirationTime: null,
                keys: {
                    p256dh: 'browser_p256dh',
                    auth: 'browser_auth',
                },
                toJSON() {
                    return {
                        endpoint: this.endpoint,
                        expirationTime: this.expirationTime,
                        keys: this.keys,
                    };
                },
                async unsubscribe() {
                    window.__mockPushSubscription = null;
                    return true;
                },
            };

            const registration = {
                scope: '/sw.js',
                pushManager: {
                    async getSubscription() {
                        return window.__mockPushSubscription || null;
                    },
                    async subscribe() {
                        window.__mockPushSubscription = subscription;
                        return subscription;
                    },
                },
            };

            Object.defineProperty(window, 'PushManager', {
                configurable: true,
                value: function PushManager() {},
            });

            Object.defineProperty(window, 'Notification', {
                configurable: true,
                value: {
                    permission: 'default',
                    async requestPermission() {
                        this.permission = 'granted';
                        return 'granted';
                    },
                },
            });

            Object.defineProperty(Navigator.prototype, 'serviceWorker', {
                configurable: true,
                get() {
                    return {
                        register: async () => registration,
                        ready: Promise.resolve(registration),
                    };
                },
            });
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
                        billing: null,
                        support: {
                            bookingUrl: '/#citas',
                            historyUrl: '/es/portal/historial/',
                            planUrl: '/es/portal/plan/',
                            prescriptionUrl: '/es/portal/receta/',
                            photosUrl: '/es/portal/fotos/',
                            whatsappUrl: 'https://wa.me/593982453672?text=hola',
                        },
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=notification-config', async (route) => {
            expect(route.request().headers().authorization).toBe('Bearer header.payload.signature');

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        configured: true,
                        publicKey: 'test_public_key',
                        subscribed: serverSubscribed,
                        subscriptions: serverSubscribed ? 1 : 0,
                    },
                }),
            });
        });

        await page.route('**/api.php?resource=notification-subscribe', async (route) => {
            subscribeRequest = {
                headers: route.request().headers(),
                body: JSON.parse(route.request().postData() || '{}'),
            };
            serverSubscribed = true;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        subscribed: true,
                        subscriptions: 1,
                    },
                }),
            });
        });

        await page.goto('/es/portal/');

        await expect(page.locator('[data-portal-push-card]')).toBeVisible();
        await expect(page.locator('[data-portal-push-status]')).toContainText('Listas para activar');
        await expect(page.locator('[data-portal-push-toggle]')).toBeEnabled();

        await page.locator('[data-portal-push-toggle]').click();

        await expect.poll(() => subscribeRequest !== null).toBeTruthy();
        expect(subscribeRequest.headers.authorization).toBe('Bearer header.payload.signature');
        expect(subscribeRequest.body.locale).toBe('es');
        expect(subscribeRequest.body.subscription.endpoint).toBe(
            'https://push.example.test/subscriptions/browser-001'
        );
        expect(subscribeRequest.body.subscription.keys).toEqual({
            p256dh: 'browser_p256dh',
            auth: 'browser_auth',
        });

        await expect(page.locator('[data-portal-push-status]')).toContainText('Activas');
        await expect(page.locator('[data-portal-push-toggle]')).toContainText('Desactivar avisos');
    });
});
