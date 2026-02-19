// @ts-check
const { test, expect } = require('@playwright/test');

function jsonResponse(route, payload) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  });
}

async function mockApi(page) {
  await page.route('**/api.php?**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resource = url.searchParams.get('resource') || '';

    if (resource === 'availability') {
      return jsonResponse(route, { ok: true, data: {} });
    }

    if (resource === 'booked-slots') {
      return jsonResponse(route, { ok: true, data: [] });
    }

    if (resource === 'reviews') {
      return jsonResponse(route, { ok: true, data: [] });
    }

    if (resource === 'payment-config') {
      return jsonResponse(route, {
        ok: true,
        data: {
          enabled: false,
          provider: 'stripe',
          publishableKey: '',
          currency: 'USD',
        },
      });
    }

    if (resource === 'payment-intent') {
      return jsonResponse(route, {
        ok: true,
        data: {
          clientSecret: 'pi_test_secret',
          paymentIntentId: 'pi_test_id',
        },
      });
    }

    if (resource === 'payment-verify') {
      return jsonResponse(route, { ok: true, paid: true });
    }

    if (resource === 'transfer-proof') {
      return jsonResponse(route, {
        ok: true,
        data: {
          transferProofPath: '/uploads/test-proof.png',
          transferProofUrl: '/uploads/test-proof.png',
          transferProofName: 'test-proof.png',
          transferProofMime: 'image/png',
        },
      });
    }

    if (resource === 'appointments' && request.method() === 'POST') {
      let body = {};
      try {
        body = request.postDataJSON() || {};
      } catch (_) {
        body = {};
      }

      return jsonResponse(route, {
        ok: true,
        data: {
          id: Date.now(),
          status: body.status || 'confirmed',
          ...body,
        },
        emailSent: false,
      });
    }

    return jsonResponse(route, { ok: true, data: {} });
  });
}

async function dismissCookieBannerIfVisible(page) {
  const banner = page.locator('#cookieBanner');
  if (await banner.isVisible().catch(() => false)) {
    const rejectButton = page.locator('#cookieRejectBtn');
    if (await rejectButton.isVisible().catch(() => false)) {
      await rejectButton.click();
      await expect(banner).not.toBeVisible();
    }
  }
}

async function getTrackedEvents(page) {
  return page.evaluate(() => {
    const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    return dl
      .filter((item) => item && typeof item === 'object' && typeof item.event === 'string')
      .map((item) => ({ ...item }));
  });
}

async function fillBookingFormAndOpenPayment(page) {
  const serviceSelect = page.locator('#serviceSelect');
  await serviceSelect.selectOption('consulta');

  const doctorSelect = page.locator('select[name="doctor"]');
  await doctorSelect.selectOption('rosero');

  const dateInput = page.locator('input[name="date"]');
  const target = new Date();
  target.setDate(target.getDate() + 7);
  const dateValue = target.toISOString().split('T')[0];
  await dateInput.fill(dateValue);
  await dateInput.dispatchEvent('change');
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    const timeSelect = document.querySelector('select[name="time"]');
    if (!timeSelect) return;
    let candidate = Array.from(timeSelect.options).find((option) => option.value && !option.disabled);
    if (!candidate) {
      candidate = document.createElement('option');
      candidate.value = '10:00';
      candidate.textContent = '10:00';
      timeSelect.appendChild(candidate);
    }
    timeSelect.value = candidate.value;
    timeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const nameInput = page.locator('input[name="name"]');
  await nameInput.fill('Paciente Test Tracking');
  await nameInput.blur();

  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill('tracking-test@example.com');
  await emailInput.blur();

  const phoneInput = page.locator('input[name="phone"]');
  await phoneInput.fill('+593999999999');
  await phoneInput.blur();

  await page.locator('textarea[name="reason"]').fill('Control dermatologico de prueba');
  await page.locator('textarea[name="reason"]').blur();

  await page.locator('input[name="privacyConsent"]').check();
  await page.locator('#appointmentForm button[type="submit"]').click();

  await expect(page.locator('#paymentModal')).toHaveClass(/active/);
  await page.waitForTimeout(250);
}

test.describe('Tracking del embudo de conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pa_cookie_consent_v1', JSON.stringify({
        status: 'rejected',
        at: new Date().toISOString(),
      }));
    });
    await mockApi(page);
    await page.goto('/');
    await dismissCookieBannerIfVisible(page);
  });

  test('emite eventos de pasos y start_checkout en reserva web', async ({ page }) => {
    await fillBookingFormAndOpenPayment(page);
    const events = await getTrackedEvents(page);

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'booking_step_completed',
        step: 'service_selected',
        source: 'booking_form',
      }),
      expect.objectContaining({
        event: 'booking_step_completed',
        step: 'form_submitted',
        source: 'booking_form',
      }),
      expect.objectContaining({
        event: 'start_checkout',
        checkout_entry: 'booking_form',
      }),
    ]));
  });

  test('emite checkout_abandon con paso y origen al cerrar modal', async ({ page }) => {
    await fillBookingFormAndOpenPayment(page);
    await page.locator('#paymentModal [data-action="close-payment-modal"]').click();
    await expect(page.locator('#paymentModal')).not.toHaveClass(/active/);
    await page.waitForTimeout(250);

    const events = await getTrackedEvents(page);
    const abandonEvent = events.find((item) => item.event === 'checkout_abandon');

    expect(abandonEvent).toBeTruthy();
    expect(abandonEvent.checkout_step).toBe('payment_modal_closed');
    expect(abandonEvent.checkout_entry).toBe('booking_form');
    expect(abandonEvent.reason).toBe('modal_close');
  });

  test('emite chat_started y paso inicial al iniciar reserva desde chatbot', async ({ page }) => {
    await page.locator('#chatbotWidget .chatbot-toggle').click();
    await expect(page.locator('#chatbotContainer')).toHaveClass(/active/);
    await page.locator('#quickOptions [data-action="quick-message"][data-value="appointment"]').click();
    await page.waitForTimeout(600);

    const events = await getTrackedEvents(page);

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'chat_started',
      }),
      expect.objectContaining({
        event: 'booking_step_completed',
        step: 'chat_booking_started',
        source: 'chatbot',
      }),
    ]));
  });
});
