const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Sprint 29 Smoke Tests', async (t) => {
  await t.test('S29-17.1: data/cie10-derm.json exists and has >= 250 entries', () => {
    const p = path.join(__dirname, '../data/cie10-derm.json');
    assert.ok(fs.existsSync(p), 'File must exist');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(Array.isArray(data), 'Should be an array');
    assert.ok(data.length >= 250, 'Should have >= 250 entries');
    assert.ok(data[0].code, 'Should have code property');
  });

  await t.test('S29-17.2: bin/send-appointment-reminders.php --dry --json executes correctly', () => {
    const cmd = 'php ' + path.join(__dirname, '../bin/send-appointment-reminders.php') + ' --dry --json';
    const output = execSync(cmd).toString();
    const result = JSON.parse(output);
    assert.strictEqual(result.dryRun, true, 'Output should have dryRun: true');
  });

  await t.test('S29-17.3: GET /api.php?resource=clinical-photos is registered in routes', async () => {
    const routesContent = fs.readFileSync(path.join(__dirname, '../lib/routes.php'), 'utf8');
    assert.match(routesContent, /'clinical-photos'.*ClinicalHistoryController/, 'Should register clinical-photos route');
  });

  await t.test('S29-17.4: js/cie10-search.js and styles/cie10-search.css exist', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '../js/cie10-search.js')), 'js exists');
    assert.ok(fs.existsSync(path.join(__dirname, '../styles/cie10-search.css')), 'css exists');
  });

  await t.test('S29-17.5: js/clinical-photo-timeline.js has >= 400 lines', () => {
    const p = path.join(__dirname, '../js/clinical-photo-timeline.js');
    assert.ok(fs.existsSync(p), 'File must exist');
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines >= 400, 'Should have >= 400 lines');
  });

  await t.test('S29-17.6: es/bienvenida-medico/index.html exists', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '../es/bienvenida-medico/index.html')), 'html exists');
  });
});
