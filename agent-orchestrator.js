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

    // Find current sprint
    let currentSprint = 'Unknown';
    const lines = agents.split('\n');
    for (const line of lines) {
      if (line.includes('Sprint') && line.includes('🔴')) currentSprint = 'Sprint 1 — Arreglar lo roto';
      if (line.includes('Sprint') && line.includes('🟡')) {
        // Check if Sprint 1 is done
        const s1Start = agents.indexOf('🔴 Sprint 1');
        const s1End = agents.indexOf('🟡 Sprint 2');
        const s1Section = agents.slice(s1Start, s1End);
        if (!s1Section.includes('- [ ]')) currentSprint = 'Sprint 2 — Convertir visitantes';
      }
    }

    console.log(JSON.stringify({
      source: 'AGENTS.md',
      orchestrator: 'redirect-stub',
      message: 'El orquestador legacy fue archivado. Lee AGENTS.md para el backlog.',
      backlog: { done, pending, total, percentDone: Math.round((done / total) * 100) },
      currentSprint,
      instruction: 'Lee AGENTS.md, busca la primera tarea [ ] del sprint actual, y ejecútala.',
      quickStart: [
        '1. Lee AGENTS.md sección "Backlog de Producto"',
        '2. Busca el primer [ ] sin completar en el sprint actual',
        '3. Ejecuta la tarea',
        '4. Marca [x] en AGENTS.md',
        '5. Commit con feat(S1-XX): descripción'
      ]
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
