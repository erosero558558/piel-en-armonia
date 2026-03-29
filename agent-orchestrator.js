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
    const agents = readFileSync(resolve(__dirname, 'AGENTS.md'), 'utf8');
    const done = (agents.match(/- \[x\]/g) || []).length;
    const pending = (agents.match(/- \[ \]/g) || []).length;
    const total = done + pending;

    // Detect current sprint (first one with pending tasks)
    let currentSprint = 'Sprint 1';
    for (const sprint of ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4']) {
      const num = sprint.split(' ')[1];
      const marker = `Sprint ${num} —`;
      const start = agents.indexOf(marker);
      if (start === -1) continue;
      const end = agents.indexOf('### 🔵 Sprint 4') > start
        ? agents.indexOf('\n### ', start + 10) : agents.length;
      const section = agents.slice(start, end);
      if (section.includes('- [ ]')) { currentSprint = sprint; break; }
    }

    console.log(JSON.stringify({
      source: 'AGENTS.md',
      orchestrator: 'redirect-stub-v2',
      message: 'Lee AGENTS.md + usa dispatch por rol para tomar tu tarea.',
      backlog: {
        done,
        pending,
        total,
        percentDone: Math.round((done / total) * 100),
        currentSprint,
      },
      roles: {
        content:   'npm run dispatch:content   → blog, SEO, textos',
        frontend:  'npm run dispatch:frontend  → HTML, CSS, páginas',
        backend:   'npm run dispatch:backend   → PHP, API, controladores',
        devops:    'npm run dispatch:devops    → CI, limpieza, auditorías',
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
