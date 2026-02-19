const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 800 }, // Mobile viewport
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // Go to the local server
    await page.goto('http://localhost:8000/index.html');

    // Wait for network idle to ensure CSS is loaded
    await page.waitForLoadState('networkidle');

    // Wait for the chat widget and quick dock to be visible
    await page.waitForSelector('.chatbot-widget', { state: 'visible' });
    await page.waitForSelector('.quick-dock', { state: 'visible' });

    // Wait a bit for any initial animations
    await page.waitForTimeout(2000);

    // Scroll to the bottom just in case
    // await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Take a screenshot of the full page or just the bottom area
    // Let's take the whole viewport
    await page.screenshot({ path: 'verification/mobile-chat-layout.png' });

    console.log('Screenshot taken: verification/mobile-chat-layout.png');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
