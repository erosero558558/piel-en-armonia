#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const DEFAULT_ROOT = resolve(__dirname, '..');
const SCHEMA_RELATIVE_PATH = 'openapi-openclaw.yaml';
const INSTRUCTIONS_RELATIVE_PATH = 'docs/chatgpt-custom-gpt-instructions.md';
const PACK_RELATIVE_PATH = 'docs/gpt-schema-pack-latest.md';
const SCHEMA_VERSION_PATTERN = /^x-schema-version:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+)\s*$/m;

function normalizeText(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function stripSchemaVersion(text) {
  return normalizeText(text).replace(/^x-schema-version:.*\n?/m, '');
}

function computeSchemaHash(text) {
  return createHash('sha256').update(stripSchemaVersion(text), 'utf8').digest('hex').slice(0, 12);
}

function resolveSchemaDate(existingVersion, now = new Date()) {
  const match = String(existingVersion || '').match(/^(\d{4}-\d{2}-\d{2})-[a-z0-9]+$/);
  if (match) {
    return match[1];
  }
  return new Date(now).toISOString().slice(0, 10);
}

function buildSchemaVersion(text, now = new Date()) {
  const existingVersion = normalizeText(text).match(SCHEMA_VERSION_PATTERN)?.[1] || '';
  const schemaHash = computeSchemaHash(text);
  const schemaDate = resolveSchemaDate(existingVersion, now);

  return {
    schemaHash,
    schemaDate,
    schemaVersion: `${schemaDate}-${schemaHash}`,
  };
}

function upsertSchemaVersion(text, schemaVersion) {
  const normalized = normalizeText(text);
  if (SCHEMA_VERSION_PATTERN.test(normalized)) {
    return normalized.replace(SCHEMA_VERSION_PATTERN, `x-schema-version: ${schemaVersion}`);
  }

  if (normalized.startsWith('openapi:')) {
    return normalized.replace(/^openapi:\s*[^\n]+\n/, (match) => `${match}x-schema-version: ${schemaVersion}\n`);
  }

  return `x-schema-version: ${schemaVersion}\n${normalized}`;
}

function renderSchemaPack({
  generatedAt,
  schemaVersion,
  schemaHash,
  schemaPath = SCHEMA_RELATIVE_PATH,
  instructionsPath = INSTRUCTIONS_RELATIVE_PATH,
}) {
  return `# OpenClaw Custom GPT Schema Pack

- Generated at: \`${generatedAt}\`
- Schema file: \`${schemaPath}\`
- Instructions file: \`${instructionsPath}\`
- Schema hash (SHA-256 / 12): \`${schemaHash}\`
- Schema version: \`x-schema-version: ${schemaVersion}\`

## Importacion

1. Abre el creador del GPT de Aurora Derm y entra a **Actions**.
2. Carga el contenido completo de \`${schemaPath}\` en el editor YAML.
3. Verifica que el schema importado conserve \`x-schema-version: ${schemaVersion}\`.
4. Revisa \`${instructionsPath}\` para copiar el prompt y las reglas operativas vigentes.
5. Confirma que el server productivo siga siendo \`https://pielarmonia.com/api/openclaw\`.

## Referencia rapida

- Version vigente del schema: \`${schemaVersion}\`
- Hash vigente del YAML: \`${schemaHash}\`
- Documento operativo vigente: \`${instructionsPath}\`
`;
}

function generateSchemaPack({ rootDir = DEFAULT_ROOT, now = new Date() } = {}) {
  const schemaPath = resolve(rootDir, SCHEMA_RELATIVE_PATH);
  const instructionsPath = resolve(rootDir, INSTRUCTIONS_RELATIVE_PATH);
  const packPath = resolve(rootDir, PACK_RELATIVE_PATH);

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  if (!existsSync(instructionsPath)) {
    throw new Error(`Instructions file not found: ${instructionsPath}`);
  }

  const schemaSource = readFileSync(schemaPath, 'utf8');
  const { schemaHash, schemaVersion } = buildSchemaVersion(schemaSource, now);
  const updatedSchema = upsertSchemaVersion(schemaSource, schemaVersion);
  const generatedAt = new Date(now).toISOString();

  if (updatedSchema !== schemaSource) {
    writeFileSync(schemaPath, updatedSchema, 'utf8');
  }

  mkdirSync(resolve(rootDir, 'docs'), { recursive: true });
  const packDocument = renderSchemaPack({
    generatedAt,
    schemaVersion,
    schemaHash,
  });
  writeFileSync(packPath, packDocument, 'utf8');

  return {
    generatedAt,
    schemaHash,
    schemaPath,
    schemaVersion,
    instructionsPath,
    packPath,
  };
}

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_ROOT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== '--root') {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value) {
      throw new Error('Missing value for --root');
    }

    options.rootDir = resolve(process.cwd(), value);
    index += 1;
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = generateSchemaPack(options);

  process.stdout.write(
    `✅ GPT schema pack generated — ${result.schemaVersion}\n` +
      `   Schema: ${result.schemaPath}\n` +
      `   Pack:   ${result.packPath}\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`GPT schema pack failed: ${message}\n`);
    process.exit(1);
  }
}

module.exports = {
  SCHEMA_VERSION_PATTERN,
  buildSchemaVersion,
  computeSchemaHash,
  generateSchemaPack,
  normalizeText,
  parseArgs,
  renderSchemaPack,
  resolveSchemaDate,
  stripSchemaVersion,
  upsertSchemaVersion,
};
