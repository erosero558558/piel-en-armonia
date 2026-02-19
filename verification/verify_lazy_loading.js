const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Page Error: ${msg.text()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080');

    // 1. Verify Hero Image WebP and Blur-up
    console.log('Verifying Hero Image...');
    const heroPicture = page.locator('.hero-image-container picture');
    await heroPicture.waitFor({ state: 'visible', timeout: 10000 });

    const heroSource = heroPicture.locator('source[type="image/webp"]');
    if (await heroSource.count() > 0) {
      console.log('PASS: WebP source found for hero image.');
    } else {
      console.error('FAIL: WebP source NOT found for hero image.');
    }

    const heroImg = heroPicture.locator('img.hero-bg-image');
    if (await heroImg.count() > 0) {
      console.log('PASS: img.hero-bg-image found.');
      // Check if LQIP style is present on parent
      const container = page.locator('.hero-image-container');
      const style = await container.getAttribute('style');
      if (style && style.includes('background-image')) {
         console.log('PASS: LQIP background-image found on container.');
      } else {
         console.warn('WARN: LQIP background-image style missing on container.');
      }
    } else {
      console.error('FAIL: img.hero-bg-image NOT found.');
    }

    // 2. Verify Map Lazy Loading
    console.log('Verifying Map Lazy Loading...');
    const mapPlaceholder = page.locator('#mapPlaceholder');

    // Scroll to the map section
    console.log('Scrolling to map section...');
    await mapPlaceholder.scrollIntoViewIfNeeded();

    // Wait for IntersectionObserver to trigger and swap content
    // The placeholder ID might remain or be removed depending on implementation.
    // ui-effects.js removes the id='mapPlaceholder' from the div?
    // No: placeholder.classList.remove('map-placeholder'); placeholder.style.backgroundColor = 'transparent';
    // It appends the iframe.

    const iframe = page.locator('.clinic-map iframe');

    try {
        await iframe.waitFor({ state: 'attached', timeout: 5000 });
        console.log('PASS: Map iframe loaded after scrolling.');
    } catch (e) {
        console.log('Iframe not yet attached. Checking for placeholder button...');
        // If not loaded automatically, check if button is there (fallback)
        const button = mapPlaceholder.locator('button');
        if (await button.isVisible()) {
            console.log('Map placeholder button visible. Clicking...');
            await button.click();
            await iframe.waitFor({ state: 'attached', timeout: 5000 });
            console.log('PASS: Map iframe loaded after click.');
        } else {
            console.error('FAIL: Map iframe not found and button not visible.');
        }
    }

    // 3. Verify Dynamic Imports
    // Check if ui-effects loaded by checking nav class 'scrolled' after scroll
    console.log('Verifying Dynamic Imports (UI Effects)...');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);
    const nav = page.locator('.nav');
    const isScrolled = await nav.evaluate(el => el.classList.contains('scrolled'));
    if (isScrolled) {
        console.log('PASS: UI Effects module loaded (nav scrolled).');
    } else {
        console.warn('WARN: Nav did not get "scrolled" class. ui-effects.js might not have loaded.');
    }

    await page.screenshot({ path: 'verification/lazy_loading_final.png', fullPage: true });

  } catch (error) {
    console.error('Test Failed:', error);
    await page.screenshot({ path: 'verification/lazy_loading_fail.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
