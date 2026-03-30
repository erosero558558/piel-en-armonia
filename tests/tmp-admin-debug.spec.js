// @ts-check
const { test } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test('debug admin appointments runtime', async ({ page }) => {
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/admin-auth.php') || url.includes('/api.php')) {
            console.log('REQUEST', request.method(), url);
        }
    });
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/admin-auth.php') || url.includes('/api.php')) {
            let body = '';
            try {
                body = await response.text();
            } catch (_error) {
                body = '<unreadable>';
            }
            console.log('RESPONSE', response.status(), url, body);
        }
    });
    page.on('pageerror', (error) => {
        console.log('PAGEERROR', error?.message || error);
    });
    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            console.log(`CONSOLE_${message.type().toUpperCase()}`, message.text());
        }
    });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
    )}-${String(now.getDate()).padStart(2, '0')}`;

    await installLegacyAdminAuthMock(page);
    await installBasicAdminApiMocks(page, {
        dataOverrides: {
            appointments: [
                {
                    id: 1,
                    name: 'Ana',
                    email: 'ana@example.com',
                    phone: '+593 99 111 2222',
                    service: 'consulta_dermatologica',
                    doctor: 'rosero',
                    date: today,
                    time: '09:00',
                    status: 'confirmed',
                    paymentMethod: 'cash',
                    paymentStatus: 'paid',
                    checkinToken: 'CHK-1',
                },
            ],
            queue_tickets: [],
        },
    });

    await page.goto('/admin.html');
    await page.locator('.nav-item[data-section="appointments"]').click();
    await page.waitForTimeout(2000);

    console.log(
        'ROWS',
        await page.locator('#appointmentsTableBody tr').count()
    );
    console.log(
        'DAILY_ITEMS',
        await page.locator('#appointmentsDailyAgenda [data-daily-agenda-item]')
            .count()
    );
    console.log(
        'SUMMARY',
        await page.locator('#appointmentsDeckSummary').textContent()
    );
    console.log(
        'TABLE_HTML',
        await page.locator('#appointmentsTableBody').innerHTML()
    );
    console.log(
        'DAILY_HTML',
        await page.locator('#appointmentsDailyAgenda').innerHTML()
    );
    console.log(
        'LOGIN_HIDDEN',
        await page.locator('#loginScreen').evaluate((node) =>
            node.classList.contains('is-hidden')
        )
    );
});
