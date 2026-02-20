// @ts-check
const { test, expect } = require('@playwright/test');

async function openChatbot(page) {
  await page.addInitScript(() => {
    localStorage.setItem('pa_cookie_consent_v1', JSON.stringify({
      status: 'rejected',
      at: new Date().toISOString(),
    }));
  });

  await page.goto('/');
  await page.locator('#chatbotWidget .chatbot-toggle').click();
  await expect(page.locator('#chatbotContainer')).toHaveClass(/active/);
}

async function assertChatFitsViewport(page) {
  const metrics = await page.evaluate(() => {
    const container = document.getElementById('chatbotContainer');
    const input = document.querySelector('#chatbotContainer .chatbot-input-area input');
    if (!container || !input) return null;
    const rect = container.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      chat: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      input: {
        left: inputRect.left,
        right: inputRect.right,
        top: inputRect.top,
        bottom: inputRect.bottom,
      },
    };
  });

  expect(metrics).not.toBeNull();
  const { viewportWidth, viewportHeight, chat, input } = metrics;

  expect(chat.left).toBeGreaterThanOrEqual(0);
  expect(chat.right).toBeLessThanOrEqual(viewportWidth);
  expect(chat.top).toBeGreaterThanOrEqual(0);
  expect(chat.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(chat.width).toBeGreaterThan(240);
  expect(chat.height).toBeGreaterThan(260);

  expect(input.left).toBeGreaterThanOrEqual(0);
  expect(input.right).toBeLessThanOrEqual(viewportWidth);
  expect(input.bottom).toBeLessThanOrEqual(viewportHeight);
}

test.describe('Chat responsive layout', () => {
  test('chat stays within viewport on narrow desktop window', async ({ page }) => {
    await page.setViewportSize({ width: 665, height: 1242 });
    await openChatbot(page);
    await assertChatFitsViewport(page);
  });

  test('chat stays within viewport on mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openChatbot(page);
    await assertChatFitsViewport(page);
  });
});
