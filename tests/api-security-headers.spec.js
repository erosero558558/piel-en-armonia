// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('API security headers', () => {
  test('health endpoint returns hardened security headers', async ({ request }) => {
    const response = await request.get('/api.php?resource=health');
    expect(response.ok()).toBeTruthy();

    const contentType = response.headers()['content-type'] || '';
    test.skip(!contentType.includes('application/json'), 'PHP runtime no disponible en el webServer de Playwright');

    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(headers['cross-origin-resource-policy']).toBe('same-origin');

    const permissionsPolicy = headers['permissions-policy'] || '';
    expect(permissionsPolicy).toContain('geolocation=()');
    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('microphone=()');

    const csp = headers['content-security-policy'] || '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");

    const cacheControl = headers['cache-control'] || '';
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('max-age=0');
  });
});
