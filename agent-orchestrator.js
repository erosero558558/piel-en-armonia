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

const { readFileSync } = require('fs');
const { resolve } = require('path');

const cmd = process.argv[2] || 'status';

const messages = {
  status: () => {
    const root = __dirname;
    const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
    // S14-00 fix: regex unificado igual que dispatch.js — captura S3-09, UI-01, UI2-20, UI3-15, S14-00, etc.
    const doneCount = (agents.match(/^- \[x\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
    const pendingLines = agents.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*.+$/gm) || [];
    const pending = pendingLines.length;
    const total = doneCount + pending;

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

    const { existsSync, readdirSync, statSync } = require('fs');

    let activeClaims = 0;
    const claimsDir = resolve(root, 'data/claims');
    if (existsSync(claimsDir)) {
      activeClaims = readdirSync(claimsDir).filter(f => f.endsWith('.json')).length;
    }

    let lastAudit = null;
    const summaryPath = resolve(root, 'governance/qa-summary.json');
    if (existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
        lastAudit = summary.timestamp || statSync(summaryPath).mtime.toISOString();
      } catch (e) {}
    }

    const pendingByLane = {};
    pendingLines.forEach(line => {
      const tags = [...line.matchAll(/`\[([a-z_]+)\]`/gi)].map(m => m[1]);
      const laneTags = tags.filter(t => !['S', 'M', 'L', 'XL'].includes(t.toUpperCase()));
      if (laneTags.length > 0) {
        laneTags.forEach(lane => {
          pendingByLane[lane] = (pendingByLane[lane] || 0) + 1;
        });
      } else {
        pendingByLane['unassigned'] = (pendingByLane['unassigned'] || 0) + 1;
      }
    });

    console.log(JSON.stringify({
      source:       'live',
      parsedFrom:   'AGENTS.md',  // S14-00: canonical source, same as claim.js + dispatch.js
      orchestrator: 'live',
      message: 'Lee AGENTS.md + usa dispatch por rol para tomar tu tarea.',
      activeClaims,
      pendingByLane,
      doneCount,
      lastAudit,
      backlog: {
        done: doneCount,
        pending,
        total,
        percentDone: total > 0 ? Math.round((doneCount / total) * 100) : 0,
        currentSprint,
      },
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
