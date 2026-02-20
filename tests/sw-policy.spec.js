const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const swPath = path.resolve(__dirname, '..', 'sw.js');

test.describe('Service worker policy hardening', () => {
  test('sw bypasses dynamic API endpoints and non-GET requests', () => {
    const source = fs.readFileSync(swPath, 'utf8');

    expect(source).toContain("request.method !== 'GET'");
    expect(source).toContain("'/api.php'");
    expect(source).toContain("'/figo-chat.php'");
    expect(source).toContain("'/figo-backend.php'");
    expect(source).toContain("'/proxy.php'");
  });

  test('sw pre-caches versioned critical bundles', () => {
    const source = fs.readFileSync(swPath, 'utf8');

    expect(source).toContain("/styles-deferred.css?v=ui-20260220-deferred15-cookiebannerfix1");
    expect(source).toContain("/bootstrap-inline-engine.js?v=figo-bootstrap-20260220-cachecoherence1");
    expect(source).toContain("/script.js?v=figo-20260220-phase6-cachecoherence1");
  });
});
