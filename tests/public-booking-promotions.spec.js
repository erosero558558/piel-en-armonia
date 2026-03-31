// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public booking promotions', () => {
    test('shows first consult promo for new patient and hides it for members', async ({
        page,
    }) => {
        await page.route(/\/api\.php\?resource=active-promotions.*/i, async (route) => {
            const url = new URL(route.request().url());
            const email = String(url.searchParams.get('email') || '').trim();
            const isMember = email === 'miembro@auroraderm.test';

            const payload = isMember
                ? {
                      ok: true,
                      data: {
                          promotions: [],
                          patient: {
                              patientId: 'pt_member_001',
                              isFirstVisit: false,
                              isMember: true,
                              isReferred: false,
                          },
                      },
                  }
                : {
                      ok: true,
                      data: {
                          promotions: [
                              {
                                  id: 'first_consult',
                                  title: 'Primera consulta',
                                  description:
                                      'Beneficio de bienvenida para pacientes sin historial previo en Aurora Derm.',
                                  discountPercent: 20,
                              },
                          ],
                          patient: {
                              patientId: 'pt_new_001',
                              isFirstVisit: true,
                              isMember: false,
                              isReferred: false,
                          },
                      },
                  };

            await route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify(payload),
            });
        });

        await gotoPublicRoute(
            page,
            '/tests/fixtures/booking-promotions-harness.html'
        );

        await expect(page.locator('#appointmentForm')).toBeVisible();
        await expect(page.locator('#serviceSelect')).toHaveValue('acne');

        await page.locator('#appointmentName').fill('Paciente Nueva');
        await page.locator('#appointmentEmail').fill('nueva@auroraderm.test');
        await page.locator('#appointmentPhone').fill('+593 98 245 3672');
        await page.locator('#appointmentName').blur();
        await page.locator('#appointmentEmail').blur();
        await page.locator('#appointmentPhone').blur();

        const promotions = page.locator('#bookingPromotions');
        await expect(promotions).toBeVisible();
        await expect(promotions).toContainText('Primera consulta');
        await expect(promotions).toContainText('20% OFF');

        await page.locator('#appointmentEmail').fill('miembro@auroraderm.test');
        await page.locator('#appointmentEmail').blur();

        await expect(promotions).toBeHidden();
    });
});
