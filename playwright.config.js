// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * URL base para los tests. Opciones:
 *   - Variable de entorno: TEST_BASE_URL=https://pielarmonia.com npx playwright test
 *   - Servidor PHP local: php -S localhost:8000 (y usar la URL por defecto)
 */
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8000';
const shouldStartLocalServer = !process.env.TEST_BASE_URL;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: shouldStartLocalServer
    ? {
      command: 'python -m http.server 8000 --bind 127.0.0.1',
      port: 8000,
      reuseExistingServer: true,
      timeout: 15000,
    }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
