#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(__dirname, '..', '.github', 'workflows', 'ci.yml');

function loadWorkflow() {
  const raw = readFileSync(WORKFLOW_PATH, 'utf8');
  return {
    raw,
    parsed: yaml.parse(raw),
  };
}

test('CI lint workflow includes OpenClaw drift guard trigger files', () => {
  const { raw } = loadWorkflow();

  assert.match(raw, /openapi-openclaw\.yaml/);
  assert.match(raw, /bin\/check-openapi-drift\.js/);
  assert.match(raw, /tests-node\/check-openapi-drift\.test\.js/);
});

test('CI lint workflow runs the OpenClaw drift guard command', () => {
  const { parsed } = loadWorkflow();
  const steps = parsed?.jobs?.lint?.steps || [];
  const driftStep = steps.find((step) => String(step?.name || '').includes('OpenClaw OpenAPI drift guard'));

  assert.ok(driftStep, 'falta step de OpenClaw OpenAPI drift guard');
  assert.match(String(driftStep.run || ''), /node bin\/check-openapi-drift\.js/);
});
