#!/usr/bin/env node
/**
 * Agent Orchestrator — Redirect Stub
 *
 * El orquestador legacy fue archivado en _archive/agent-governance/.
 * La fuente de verdad operativa es AGENTS.md.
 *
 * Este stub existe para que los scripts de package.json no rompan.
 * Cualquier agente que llegue aquí es redirigido a AGENTS.md.
 */

const { readFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT = process.env.AURORA_DERM_ROOT
  ? resolve(process.env.AURORA_DERM_ROOT)
  : __dirname;
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks');
const LEGACY_FILE = resolve(ROOT, 'data/claims/tasks.json');

const cmd = process.argv[2] || 'status';

function loadAllClaims() {
  const claims = {};

  try {
    const files = readdirSync(CLAIMS_DIR).filter((fileName) => fileName.endsWith('.json'));
    for (const fileName of files) {
      const taskId = fileName.replace(/\.json$/u, '');
      try {
        claims[taskId] = JSON.parse(readFileSync(join(CLAIMS_DIR, fileName), 'utf8'));
      } catch {}
    }
  } catch {}

  if (existsSync(LEGACY_FILE)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8'));
      for (const [taskId, payload] of Object.entries(legacy)) {
        if (!claims[taskId]) {
          claims[taskId] = payload;
        }
      }
    } catch {}
  }

  return claims;
}

function isExpired(claim) {
  return Boolean(claim?.expiresAt) && new Date(claim.expiresAt) < new Date();
}

function buildExpiryWarning() {
  const expiredClaims = Object.entries(loadAllClaims())
    .filter(([, claim]) => isExpired(claim))
    .sort(([leftId], [rightId]) =>
      String(leftId).localeCompare(String(rightId), undefined, { numeric: true })
    )
    .map(([taskId, claim]) => ({
      taskId,
      agent: String(claim?.agent || 'unknown'),
      expiresAt: String(claim?.expiresAt || ''),
    }));

  if (expiredClaims.length === 0) {
    return null;
  }

  return {
    count: expiredClaims.length,
    claims: expiredClaims,
  };
}

const messages = {
  status: () => {
    const agents = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf8');
    // S14-00 fix: regex unificado igual que dispatch.js — captura S3-09, UI-01, UI2-20, UI3-15, S14-00, etc.
    const done    = (agents.match(/^- \[x\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
    const pending = (agents.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
    const total   = done + pending;
    const expiryWarning = buildExpiryWarning();

    // Detect current sprint dynamically — busca el primero con tareas pendientes
    let currentSprint = 'Sprint 3';
    const sprintMatches = [...agents.matchAll(/^### [^\n]*Sprint (\d+|UI)[^\n]*/gm)];
    for (const m of sprintMatches) {
      const label = m[0].replace(/^### /, '').trim();
      const idx   = agents.indexOf(m[0]);
      const nextIdx = agents.indexOf('\n### ', idx + 10);
      const section = agents.slice(idx, nextIdx === -1 ? agents.length : nextIdx);
      if (section.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/m)) {
        currentSprint = label;
        break;
      }
    }

    console.log(JSON.stringify({
      source:       'AGENTS.md',
      parsedFrom:   'AGENTS.md',  // S14-00: canonical source, same as claim.js + dispatch.js
      orchestrator: 'redirect-stub-v3-canonical',
      message: 'Lee AGENTS.md + usa dispatch por rol para tomar tu tarea.',
      backlog: {
        done,
        pending,
        total,
        percentDone: Math.round((done / total) * 100),
        currentSprint,
      },
      expiryWarning,
      roles: {
        content:   'npm run dispatch:content   → blog, SEO, textos',
        frontend:  'npm run dispatch:frontend  → HTML, CSS, páginas',
        backend:   'npm run dispatch:backend   → PHP, API, controladores',
        devops:    'npm run dispatch:devops    → CI, limpieza, auditorías',
        ui:        'npm run dispatch:ui        → SOLO Antigravity — UI/UX Aurora Derm',
        fullstack: 'npm run dispatch:fullstack → cualquier tarea disponible',
      },
      workflow: [
        '1. git pull origin main',
        '2. npm run dispatch:<tu-rol>',
        '3. node bin/claim.js claim <ID> "<tu-nombre>"',
        '4. git add data/claims/ && HUSKY=0 git commit --no-verify -m "claim: <ID>" && git push',
        '5. [hacer el trabajo — lee AGENTS.md para contexto]',
        '6. git add . && HUSKY=0 git commit --no-verify -m "feat(<ID>): ..." && git push',
      ],
    }, null, 2));
  },


  help: () => {
    console.log(`
Agent Orchestrator — Redirect Stub

El orquestador legacy fue archivado. La fuente de verdad es AGENTS.md.

Comandos disponibles:
  status    — Ver estado del backlog (tareas hechas/pendientes)
  help      — Esta ayuda

Para trabajar:
  1. Lee AGENTS.md
  2. Busca la primera tarea [ ] del sprint actual
  3. Ejecuta la tarea
  4. Marca [x] y commitea
`);
  }
};

const handler = messages[cmd] || messages['status'];
handler();
