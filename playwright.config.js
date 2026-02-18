// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * URL base para los tests. Opciones:
 *   - Variable de entorno: TEST_BASE_URL=https://pielarmonia.com npx playwright test
 *   - Servidor PHP local: php -S localhost:8000 (y usar la URL por defecto)
 */
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8000';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  /* Descomenta si tienes PHP local:
  webServer: {
    command: 'php -S localhost:8000',
    port: 8000,
    reuseExistingServer: true,
    timeout: 10000,
  },
  */
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
