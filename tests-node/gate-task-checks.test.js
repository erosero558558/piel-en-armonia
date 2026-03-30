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

test('UI2-17 gate checks and CLI task id matcher support UI2 tasks', () => {
  const gateScript = read(resolve(REPO_ROOT, 'bin', 'gate.js'));
  const result = taskChecks['UI2-17'][0].evaluate();

  assert.match(gateScript, /\^\(S\\d\+\|UI\\d\*\)-\[A-Z0-9\]\+\$/);
  assert.equal(result.ok, true);
  assert.match(result.detail, /BookingShellV5\.astro/);
  assert.match(result.detail, /PreConsultationPageV6\.astro/);
});
