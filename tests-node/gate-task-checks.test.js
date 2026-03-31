'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const { createTaskCheckDefinitions } = require('../bin/lib/gate-checks');

function read(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function fileExists(relativePath) {
  return existsSync(resolve(REPO_ROOT, relativePath));
}

const taskChecks = createTaskCheckDefinitions({
  ROOT: REPO_ROOT,
  read,
  fileExists,
  execSync,
});

test('S3-19 gate check accepts Openclaw prescription fallback with PDF evidence', () => {
  const result = taskChecks['S3-19'][0].evaluate();

  assert.equal(result.ok, true);
  assert.match(result.detail, /OpenclawController\.php/);
  assert.match(result.detail, /PDF/);
  assert.match(result.detail, /openclaw-prescription/);
});

test('S3-24 gate check verifies booking page artifact', () => {
  const result = taskChecks['S3-24'][0].evaluate();

  assert.equal(result.ok, true);
  assert.match(result.detail, /es\/agendar\/index\.html/);
});

test('S3-36 gate checks verify controller and routes with evidence', () => {
  const controllerResult = taskChecks['S3-36'][0].evaluate();
  const routeResult = taskChecks['S3-36'][1].evaluate();

  assert.equal(controllerResult.ok, true);
  assert.match(controllerResult.detail, /DoctorProfileController\.php/);
  assert.equal(routeResult.ok, true);
  assert.match(routeResult.detail, /doctor-profile/);
});

test('S3-45 gate checks verify shared map wiring and test coverage evidence', () => {
  const mapResult = taskChecks['S3-45'][0].evaluate();
  const wiringResult = taskChecks['S3-45'][1].evaluate();

  assert.equal(mapResult.ok, true);
  assert.match(mapResult.detail, /gate-checks\.js/);
  assert.equal(wiringResult.ok, true);
  assert.match(wiringResult.detail, /bin\/gate\.js/);
  assert.match(wiringResult.detail, /gate-task-checks\.test\.js/);
});

test('S13-02 gate check verifies sitemap automation and current public routes', () => {
  const result = taskChecks['S13-02'][0].evaluate();

  assert.equal(result.ok, true);
  assert.match(result.detail, /bin\/gen-sitemap\.js/);
  assert.match(result.detail, /bin\/sync-backlog\.js/);
  assert.match(result.detail, /sitemap\.xml/);
  assert.match(result.detail, /paquetes/);
  assert.match(result.detail, /SEO canónico/);
});

test('S13-14 gate map covers audited Sprint 8, 9, 10 and 12 checks', () => {
  const s801 = taskChecks['S8-01'][0].evaluate();
  const s807 = taskChecks['S8-07'][0].evaluate();
  const s911 = taskChecks['S9-11'][0].evaluate();
  const s1006 = taskChecks['S10-06'][0].evaluate();
  const s1206 = taskChecks['S12-06'][0].evaluate();
  const s1314Map = taskChecks['S13-14'][0].evaluate();
  const s1314Tests = taskChecks['S13-14'][1].evaluate();

  assert.equal(s801.ok, true);
  assert.match(s801.detail, /DESKTOP_CATALOG\.md/);
  assert.match(s801.detail, /turnero-surfaces\.json/);

  assert.equal(s807.ok, true);
  assert.match(s807.detail, /bin\/report\.js/);
  assert.match(s807.detail, /weekly-report-bom-parser\.test\.js/);

  assert.equal(s911.ok, true);
  assert.match(s911.detail, /20 servicios/);
  assert.match(s911.detail, /ServiceCatalog\.php/);

  assert.equal(s1006.ok, true);
  assert.match(s1006.detail, /ComplianceMSP\.php/);
  assert.match(s1006.detail, /ComplianceMspTest\.php/);

  assert.equal(typeof s1206.ok, 'boolean');
  assert.match(s1206.detail, /GOOGLE_BUSINESS_CHECKLIST\.md/);

  assert.equal(s1314Map.ok, true);
  assert.match(s1314Map.detail, /S8-01/);
  assert.match(s1314Map.detail, /S12-06/);

  assert.equal(s1314Tests.ok, true);
  assert.match(s1314Tests.detail, /gate-task-checks\.test\.js/);
});
