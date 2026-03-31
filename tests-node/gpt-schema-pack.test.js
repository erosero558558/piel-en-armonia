'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'gen-gpt-schema-pack.js');

const {
  buildSchemaVersion,
  computeSchemaHash,
  generateSchemaPack,
} = require('../bin/gen-gpt-schema-pack.js');

test('buildSchemaVersion reuses explicit date and hashes normalized schema content', () => {
  const schema = [
    'openapi: 3.1.0',
    'x-schema-version: 2026-03-30-bootstrap',
    'info:',
    '  version: 1.0.0',
    '',
  ].join('\n');

  const version = buildSchemaVersion(schema, new Date('2026-04-02T12:00:00Z'));

  assert.equal(version.schemaDate, '2026-03-30');
  assert.equal(version.schemaHash, computeSchemaHash(schema));
  assert.match(version.schemaVersion, /^2026-03-30-[a-f0-9]{12}$/);
});

test('generateSchemaPack writes normalized schema version and pack markdown', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'aurora-gpt-pack-'));

  try {
    mkdirSync(join(rootDir, 'docs'), { recursive: true });
    writeFileSync(
      join(rootDir, 'openapi-openclaw.yaml'),
      ['openapi: 3.1.0', 'info:', '  version: 1.0.0', 'paths: {}', ''].join('\n'),
      'utf8'
    );
    writeFileSync(join(rootDir, 'docs', '.gitkeep'), '', 'utf8');
  } catch (error) {
    rmSync(rootDir, { recursive: true, force: true });
    throw error;
  }

  try {
    writeFileSync(
      join(rootDir, 'docs', 'chatgpt-custom-gpt-instructions.md'),
      '# Aurora GPT\n',
      'utf8'
    );

    const result = generateSchemaPack({
      rootDir,
      now: new Date('2026-03-30T15:45:00Z'),
    });

    const schema = readFileSync(join(rootDir, 'openapi-openclaw.yaml'), 'utf8');
    const pack = readFileSync(join(rootDir, 'docs', 'gpt-schema-pack-latest.md'), 'utf8');

    assert.match(schema, /^x-schema-version: 2026-03-30-[a-f0-9]{12}$/m);
    assert.match(pack, /Schema version: `x-schema-version: 2026-03-30-[a-f0-9]{12}`/);
    assert.match(pack, /Schema hash \(SHA-256 \/ 12\): `[a-f0-9]{12}`/);
    assert.equal(pack.includes(result.schemaVersion), true);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('CLI supports custom roots for fixture generation', () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'aurora-gpt-pack-cli-'));

  try {
    mkdirSync(join(rootDir, 'docs'), { recursive: true });
    writeFileSync(
      join(rootDir, 'openapi-openclaw.yaml'),
      ['openapi: 3.1.0', 'info:', '  version: 1.0.0', 'paths: {}', ''].join('\n'),
      'utf8'
    );
    writeFileSync(
      join(rootDir, 'docs', 'chatgpt-custom-gpt-instructions.md'),
      '# Aurora GPT\n',
      'utf8'
    );

    const result = spawnSync(process.execPath, [SCRIPT_PATH, '--root', rootDir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /GPT schema pack generated/);
    assert.equal(
      readFileSync(join(rootDir, 'docs', 'gpt-schema-pack-latest.md'), 'utf8').includes('x-schema-version:'),
      true
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
