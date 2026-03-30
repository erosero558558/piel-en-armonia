// @ts-check
const { test } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test('debug admin appointments runtime', async ({ page }) => {
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
});
