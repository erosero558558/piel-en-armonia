#!/usr/bin/env node
/**
 * bin/gen-readme-stats.js — Actualiza progreso global en README.md
 * 
 * Lee AGENTS.md, cuenta completadas vs totales, y reempleza el bloque
 * <!-- STATS_START -->...<!-- STATS_END --> en README.md.
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const README_FILE = resolve(ROOT, 'README.md');

if (!existsSync(AGENTS_FILE)) {
  console.error('❌ AGENTS.md no encontrado.');
  process.exit(1);
}

const agentsMd = readFileSync(AGENTS_FILE, 'utf8');
const doneTotal = (agentsMd.match(/^- \[x\] \*\*((?:S\d+|UI\d+)-[A-Z0-9]+)\*\*/gm) || []).length;
const pendingTotal = (agentsMd.match(/^- \[ \] \*\*((?:S\d+|UI\d+)-[A-Z0-9]+)\*\*/gm) || []).length;
const totalTasks = doneTotal + pendingTotal;
const pct = totalTasks > 0 ? Math.round((doneTotal / totalTasks) * 100) : 0;
const progressBar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

const statsBlock = `<!-- STATS_START -->
> **Progreso Global del Proyecto:** ${doneTotal}/${totalTasks} tareas (${pct}%)
> \`${progressBar}\`
<!-- STATS_END -->`;

if (!existsSync(README_FILE)) {
  console.error('❌ README.md no encontrado.');
  process.exit(1);
}

let readmeContent = readFileSync(README_FILE, 'utf8');

const regex = /<!-- STATS_START -->[\s\S]*?<!-- STATS_END -->/;
if (regex.test(readmeContent)) {
  readmeContent = readmeContent.replace(regex, statsBlock);
} else {
  // Fallback: Si no existen marcadores, instertar debajo de "## Estado actual del proyecto"
  readmeContent = readmeContent.replace(
    '## Estado actual del proyecto',
    `## Estado actual del proyecto\n\n${statsBlock}`
  );
}

writeFileSync(README_FILE, readmeContent, 'utf8');
console.log(`✅ README.md actualizado con progreso: ${doneTotal}/${totalTasks} (${pct}%)`);
