#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'openapi-openclaw.yaml');
const INSTRUCTIONS_PATH = path.join(ROOT, 'docs', 'chatgpt-custom-gpt-instructions.md');
const OUT_PATH = path.join(ROOT, 'docs', 'gpt-schema-pack-latest.md');

function run() {
    console.log('[schema-pack] Generando release pack para Custom GPT...');

    if (!fs.existsSync(YAML_PATH) || !fs.existsSync(INSTRUCTIONS_PATH)) {
        console.error('❌ No se encontraron los archivos base (YAML o Instrucciones)');
        process.exit(1);
    }

    let yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
    const instructionsContent = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8');

    // Remove old schema version line if exists
    yamlContent = yamlContent.replace(/^  x-schema-version:.*$/m, '');
    
    // Hash before version injection
    const hash = crypto.createHash('sha256').update(yamlContent).digest('hex').substring(0, 8);
    const dateStr = new Date().toISOString().split('T')[0];
    const versionStr = `${dateStr}-${hash}`;

    // Inject x-schema-version below version: 1.0.0
    yamlContent = yamlContent.replace(/(  version: 1\.0\.0\n)/, `$1  x-schema-version: ${versionStr}\n`);
    
    // Guardar YAML actualizado
    fs.writeFileSync(YAML_PATH, yamlContent, 'utf8');

    const outContent = `# OpenClaw Custom GPT Schema Pack
> **Version:** ${versionStr}
> **Generado:** ${new Date().toISOString()}

Este documento consolida el esquema y las instrucciones necesarias para actualizar el Custom GPT Médico de Aurora Derm ("OpenClaw").

## Instrucciones de Importación

1. En ChatGPT, ve a la configuración de tu Custom GPT.
2. Abre la pestaña **Configure**.
3. En la caja de **Instructions**, pega el contenido de *System Instructions* de abajo.
4. Baja a la sección **Actions** y haz clic en *Edit*.
5. Pega el contenido de *OpenAPI Schema* en la caja.
6. Pulsa **Update** en la esquina superior derecha para publicar los cambios de forma privada al Workspace de la clínica.

---

## 1. System Instructions

\`\`\`markdown
${instructionsContent}
\`\`\`

---

## 2. OpenAPI Schema (Actions)

\`\`\`yaml
${yamlContent}
\`\`\`
`;

    fs.writeFileSync(OUT_PATH, outContent, 'utf8');
    console.log(`✅ Pack generado con éxito: docs/gpt-schema-pack-latest.md (Version ${versionStr})`);
}

run();
