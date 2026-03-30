#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const ROOT = process.env.AURORA_DERM_ROOT
  ? resolve(process.env.AURORA_DERM_ROOT)
  : resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const README_FILE = resolve(ROOT, 'README.md');
const STATS_START = '<!-- STATS_START -->';
const STATS_END = '<!-- STATS_END -->';

function read(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function parseTaskCounts(agentsMarkdown) {
  const source = String(agentsMarkdown || '');
  const done = (source.match(/^- \[x\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
  const pending = (source.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
  const total = done + pending;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, pending, total, percent };
}

function findActiveSprint(agentsMarkdown) {
  const lines = String(agentsMarkdown || '').split('\n');
  let currentSprint = '';
  const sprintStats = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ') && trimmed.includes(' Sprint ')) {
      const after = trimmed.replace(/^###\s+\S+\s+/, '');
      if (after.startsWith('Sprint ')) {
        currentSprint = after.trim();
        sprintStats.push({ sprint: currentSprint, done: 0, total: 0 });
      }
      return;
    }

    if (!currentSprint) {
      return;
    }

    const match = line.match(/^- \[([ x])\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/);
    if (!match) {
      return;
    }

    const bucket = sprintStats[sprintStats.length - 1];
    bucket.total += 1;
    if (match[1] === 'x') {
      bucket.done += 1;
    }
  });

  const active = sprintStats.find((bucket) => bucket.total > bucket.done);
  return active ? active.sprint : 'Sin sprint pendiente';
}

function buildStatsBlock({ done, pending, total, percent, activeSprint }) {
  return [
    STATS_START,
    `- Progreso real del board: **${done}/${total}** tareas completadas (**${percent}%**)`,
    `- Pendientes: **${pending}**`,
    `- Sprint activo: **${activeSprint}**`,
    STATS_END,
  ].join('\n');
}

function replaceStatsBlock(readmeMarkdown, statsBlock) {
  const source = String(readmeMarkdown || '');
  const blockPattern = new RegExp(`${STATS_START}[\\s\\S]*?${STATS_END}`, 'm');

  if (blockPattern.test(source)) {
    return source.replace(blockPattern, statsBlock);
  }

  const heading = '## Estado actual del proyecto';
  if (source.includes(heading)) {
    return source.replace(heading, `${heading}\n\n${statsBlock}`);
  }

  return `${source.trimEnd()}\n\n${statsBlock}\n`;
}

function updateReadmeStats({
  agentsMarkdown = read(AGENTS_FILE),
  readmeMarkdown = read(README_FILE),
} = {}) {
  const counts = parseTaskCounts(agentsMarkdown);
  const activeSprint = findActiveSprint(agentsMarkdown);
  const statsBlock = buildStatsBlock({
    ...counts,
    activeSprint,
  });
  const nextReadme = replaceStatsBlock(readmeMarkdown, statsBlock);

  return {
    ...counts,
    activeSprint,
    statsBlock,
    nextReadme,
  };
}

function main() {
  const result = updateReadmeStats();
  writeFileSync(README_FILE, result.nextReadme, 'utf8');
  console.log(`✅ README.md stats updated — ${result.done}/${result.total} (${result.percent}%)`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  AGENTS_FILE,
  README_FILE,
  STATS_END,
  STATS_START,
  buildStatsBlock,
  findActiveSprint,
  main,
  parseTaskCounts,
  replaceStatsBlock,
  updateReadmeStats,
};
