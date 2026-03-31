#!/usr/bin/env node
/**
 * bin/verify-task-contract.js — Gate de contrato de tarea
 *
 * Carencia #2 resuelta: cada tarea en AGENTS.md debe tener un criterio
 * verificable explícito ("Verificable:") antes de poder completarse.
 *
 * Uso:
 *   node bin/verify-task-contract.js              ← audita todas las pendientes
 *   node bin/verify-task-contract.js --task UI4-08 ← audita tarea específica
 *   node bin/verify-task-contract.js --sprint RB   ← audita un sprint
 *   node bin/verify-task-contract.js --json        ← salida JSON
 *
 * Integrar en gov:audit para que falle el pipeline si hay tareas [M][L][XL]
 * sin criterio Verificable.
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT        = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

const taskArg   = process.argv.find(a => a.startsWith('--task='))?.split('=')[1] || null;
const sprintArg = process.argv.find(a => a.startsWith('--sprint='))?.split('=')[1] || null;
const asJson    = process.argv.includes('--json');

// Sizes that REQUIRE a Verificable contract (S is optional but recommended)
const REQUIRED_SIZES = new Set(['M', 'L', 'XL']);

function parseTasks(md) {
  const tasks = [];
  let currentSprint = '';

  for (const line of md.split('\n')) {
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      currentSprint = line.replace(/^#+\s+/, '').trim();
    }

    // Match task line with size tag
    const m = line.match(/^- \[([ x])\] \*\*((S\d+|UI\d*|RB)-[A-Z0-9]+)\*\*\s+`\[([SMLX]+)\]`(.*)/);
    if (!m) continue;

    const [, doneChar, id, , size, rest] = m;
    const done = doneChar === 'x';

    // Extract Verificable
    const verificableMatch = rest.match(/Verificable:\s*(.+?)(?:\.|$)/);
    const verificable = verificableMatch ? verificableMatch[1].trim() : null;

    tasks.push({ id, done, size, sprint: currentSprint, verificable, rest: rest.trim() });
  }

  return tasks;
}

function main() {
  const md = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
  let tasks = parseTasks(md);

  // Filters
  if (taskArg) tasks = tasks.filter(t => t.id === taskArg);
  if (sprintArg) tasks = tasks.filter(t => t.sprint.toUpperCase().includes(sprintArg.toUpperCase()));

  // Only check pending tasks that require a contract
  const pending = tasks.filter(t => !t.done);
  const violations = pending.filter(t => REQUIRED_SIZES.has(t.size) && !t.verificable);
  const warnings   = pending.filter(t => t.size === 'S' && !t.verificable);
  const ok         = pending.filter(t => t.verificable);

  if (asJson) {
    console.log(JSON.stringify({ violations, warnings, ok, total: pending.length }, null, 2));
    process.exit(violations.length > 0 ? 1 : 0);
  }

  console.log('\n📋 Verify Task Contract — Aurora Derm');
  console.log(`   Pendientes auditadas: ${pending.length} | Requeridas: ${REQUIRED_SIZES.size} tamaños [M,L,XL]\n`);

  if (violations.length === 0) {
    console.log('✅ Todas las tareas [M][L][XL] tienen criterio Verificable.');
  } else {
    console.log(`❌ ${violations.length} tareas SIN Verificable (bloquean gov:audit):\n`);
    violations.forEach(t => {
      console.log(`   ${t.id} [${t.size}] — ${t.sprint}`);
      console.log(`     ${t.rest.slice(0, 80)}...`);
      console.log(`     → Añadir: "Verificable: <grep/test específico>"`);
      console.log('');
    });
  }

  if (warnings.length > 0 && !asJson) {
    console.log(`⚠️  ${warnings.length} tareas [S] sin Verificable (recomendado):`);
    warnings.forEach(t => console.log(`   ${t.id} — ${t.rest.slice(0, 60)}...`));
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

main();
