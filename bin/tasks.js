#!/usr/bin/env node
/**
 * bin/tasks.js — CLI de gestión de tickets Aurora Derm
 *
 * Comandos:
 *   node bin/tasks.js                      → resumen de progreso
 *   node bin/tasks.js list                 → todos los tickets pendientes
 *   node bin/tasks.js list gemini          → tickets [Gemini] pendientes
 *   node bin/tasks.js list codex           → tickets [Codex] pendientes
 *   node bin/tasks.js next gemini          → próximo ticket para Gemini
 *   node bin/tasks.js next codex           → próximo ticket para Codex
 *   node bin/tasks.js done T-01            → marcar T-01 como completado
 *   node bin/tasks.js done T-01 T-02 T-03  → marcar varios a la vez
 *   node bin/tasks.js block B-02           → bloque completo
 *   node bin/tasks.js search "kiosco"      → buscar en los tickets
 *   node bin/tasks.js stats                → estadísticas por bloque
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const TASKS_FILE = path.join(ROOT, 'TASKS.md');

// ── colores ───────────────────────────────────────────────────────────────────
const C = {
  reset:  s => `\x1b[0m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  magenta:s => `\x1b[35m${s}\x1b[0m`,
  gray:   s => `\x1b[90m${s}\x1b[0m`,
  white:  s => `\x1b[97m${s}\x1b[0m`,
};

// ── helpers ───────────────────────────────────────────────────────────────────
function readTasks() {
  return fs.readFileSync(TASKS_FILE, 'utf8');
}

function writeTasks(content) {
  fs.writeFileSync(TASKS_FILE, content, 'utf8');
}

/**
 * Parsea el TASKS.md y retorna array de tickets con metadata.
 */
function parseTickets(content) {
  const lines   = content.split('\n');
  const tickets = [];
  let   currentBlock = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar bloque (## Bloque N — nombre)
    const blockMatch = line.match(/^## (Bloque \d+[^—]*—?\s*.+)/);
    if (blockMatch) {
      currentBlock = blockMatch[1].trim();
      continue;
    }

    // Detectar ticket
    // Formatos: - [ ] **ID** `[Owner]` descripción
    //           - [x] **ID** `[Owner]` descripción
    //           - [/] **ID** `[Owner]` descripción
    const ticketMatch = line.match(/^- \[([ x/])\] \*\*([A-Z0-9\-]+)\*\* `\[(Gemini|Codex)\]` (.+)/);
    if (!ticketMatch) continue;

    const [, status, id, owner, desc] = ticketMatch;
    const isDone     = status === 'x';
    const inProgress = status === '/';

    // Extraer la primera línea de descripción limpia (sin markdown inline)
    const cleanDesc = desc.replace(/`[^`]+`/g,'').replace(/\*\*/g,'').replace(/\s{2,}/g,' ').replace(/^[\s—\-–]+/,'').trim();

    // Siguiente línea puede ser _API_, _UX_, etc.
    let meta = '';
    if (lines[i + 1] && lines[i + 1].match(/^\s+_/)) {
      meta = lines[i + 1].trim().replace(/^_|_$/g, '').replace(/_.*?_:/g, '');
    }

    tickets.push({
      id,
      owner,
      done: isDone,
      inProgress,
      block: currentBlock,
      desc: cleanDesc,
      meta,
      lineIndex: i,
      raw: line,
    });
  }

  return tickets;
}

/**
 * Muestra una barra de progreso.
 */
function progressBar(done, total, width) {
  const w    = width || 24;
  const pct  = total === 0 ? 0 : Math.round((done / total) * 100);
  const filled = Math.round((done / (total || 1)) * w);
  const bar  = '█'.repeat(filled) + '░'.repeat(w - filled);
  return `${bar} ${pct}% (${done}/${total})`;
}

/**
 * Imprime una línea de ticket con colores.
 */
function printTicket(t, compact) {
  const statusIcon = t.done ? C.green('✓') : t.inProgress ? C.yellow('⟳') : C.gray('○');
  const ownerColor = t.owner === 'Gemini' ? C.cyan : C.magenta;
  const idColor    = t.done ? C.gray : C.bold;
  const descColor  = t.done ? C.gray : s => s;

  if (compact) {
    console.log(
      `  ${statusIcon} ${idColor(t.id.padEnd(12))} ${ownerColor('[' + t.owner + ']')}`
      + ` ${descColor(t.desc.slice(0, 60))}${t.desc.length > 60 ? C.gray('…') : ''}`
    );
  } else {
    console.log(
      `  ${statusIcon} ${C.bold(idColor(t.id))} ${ownerColor('[' + t.owner + ']')}`
    );
    console.log(`     ${descColor(t.desc)}`);
    if (t.block) console.log(`     ${C.gray(t.block)}`);
    console.log('');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COMANDOS
// ══════════════════════════════════════════════════════════════════════════════

function cmdSummary() {
  const content = readTasks();
  const tickets = parseTickets(content);

  const total  = tickets.length;
  const done   = tickets.filter(t => t.done).length;
  const gemini = tickets.filter(t => t.owner === 'Gemini');
  const codex  = tickets.filter(t => t.owner === 'Codex');
  const gDone  = gemini.filter(t => t.done).length;
  const cDone  = codex.filter(t => t.done).length;

  console.log('\n' + C.bold('📋  Aurora Derm — Task Board'));
  console.log('─'.repeat(50));
  console.log(C.bold('  Total    ') + progressBar(done, total));
  console.log(C.cyan('  Gemini   ') + progressBar(gDone, gemini.length));
  console.log(C.magenta('  Codex    ') + progressBar(cDone, codex.length));
  console.log('');

  // Próximos tickets para cada agente
  const nextG = gemini.find(t => !t.done && !t.inProgress);
  const nextC = codex.find(t => !t.done && !t.inProgress);

  if (nextG) {
    console.log(C.cyan('  Próximo [Gemini]:') + ' ' + C.bold(nextG.id) + ' — ' + nextG.desc.slice(0, 50));
  }
  if (nextC) {
    console.log(C.magenta('  Próximo [Codex]: ') + ' ' + C.bold(nextC.id) + ' — ' + nextC.desc.slice(0, 50));
  }
  console.log('');
}

function cmdList(ownerFilter, query) {
  const content = readTasks();
  const tickets = parseTickets(content);

  let filtered = tickets.filter(t => !t.done);

  if (ownerFilter) {
    const f = ownerFilter.toLowerCase();
    filtered = filtered.filter(t => t.owner.toLowerCase() === f);
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.block.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    console.log(C.green('\n  ✓ Sin tickets pendientes.\n'));
    return;
  }

  const label = ownerFilter ? `[${ownerFilter}]` : 'todos';
  console.log('\n' + C.bold(`📋  Pendientes — ${label} (${filtered.length})`));
  console.log('─'.repeat(50));

  // Agrupar por bloque
  const byBlock = {};
  for (const t of filtered) {
    if (!byBlock[t.block]) byBlock[t.block] = [];
    byBlock[t.block].push(t);
  }

  for (const [block, blockTickets] of Object.entries(byBlock)) {
    console.log('\n' + C.yellow('  ' + block));
    for (const t of blockTickets) {
      printTicket(t, true);
    }
  }
  console.log('');
}

function cmdNext(ownerFilter) {
  const content = readTasks();
  const tickets = parseTickets(content);

  const f    = (ownerFilter || '').toLowerCase();
  const pool = f
    ? tickets.filter(t => t.owner.toLowerCase() === f && !t.done)
    : tickets.filter(t => !t.done);

  if (!pool.length) {
    console.log(C.green('\n  ✓ Sin tickets pendientes.\n'));
    return;
  }

  const t = pool[0];
  const ownerColor = t.owner === 'Gemini' ? C.cyan : C.magenta;

  console.log('\n' + C.bold('  Próximo ticket:'));
  console.log('');
  console.log(`  ${C.bold(t.id)}  ${ownerColor('[' + t.owner + ']')}`);
  console.log(`  ${t.desc}`);
  console.log(`  ${C.gray(t.block)}`);
  console.log('');
  console.log(C.dim(`  Para marcarlo como hecho:\n    node bin/tasks.js done ${t.id}\n`));
}

function cmdDone(ids) {
  if (!ids.length) {
    console.error('  Uso: node bin/tasks.js done T-01 [T-02 ...]');
    process.exit(1);
  }

  let content  = readTasks();
  const lines  = content.split('\n');
  const marked = [];
  const notFound = [];

  for (const id of ids) {
    const idClean = id.toUpperCase().trim();
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      // Buscar la línea del ticket
      const match = lines[i].match(/^- \[([ /])\] \*\*([A-Z0-9\-]+)\*\*/);
      if (match && match[2] === idClean) {
        lines[i] = lines[i].replace(/^- \[[ /]\]/, '- [x]');
        marked.push(idClean);
        found = true;
        break;
      }
    }

    if (!found) notFound.push(id);
  }

  if (!marked.length) {
    console.error(C.red('\n  No se encontraron los tickets: ' + notFound.join(', ') + '\n'));
    process.exit(1);
  }

  writeTasks(lines.join('\n'));

  console.log('\n' + C.bold('✅  Tickets marcados como completados:'));
  for (const id of marked) console.log('  ' + C.green('✓') + ' ' + C.bold(id));
  if (notFound.length) {
    console.log(C.yellow('\n  ⚠ No encontrados: ' + notFound.join(', ')));
  }
  console.log('');

  // Auto-commit si hay git
  try {
    const { execSync } = require('child_process');
    execSync(
      `git add "${TASKS_FILE}" && HUSKY=0 git commit --no-verify -m "chore(tasks): done ${marked.join(' ')}"`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    console.log(C.dim('  Commiteado automáticamente.\n'));
  } catch {
    console.log(C.dim('  Commitea manualmente: git add TASKS.md && git commit -m "done ' + marked.join(' ') + '"\n'));
  }
}

function cmdSearch(query) {
  if (!query) { console.error('  Uso: node bin/tasks.js search "texto"'); process.exit(1); }

  const content = readTasks();
  const tickets = parseTickets(content);
  const q       = query.toLowerCase();
  const results = tickets.filter(t =>
    t.id.toLowerCase().includes(q)   ||
    t.desc.toLowerCase().includes(q) ||
    t.block.toLowerCase().includes(q)
  );

  console.log('\n' + C.bold(`🔍  Resultados para "${query}" (${results.length})`));
  console.log('─'.repeat(50));
  if (!results.length) { console.log(C.gray('  Sin resultados.\n')); return; }
  for (const t of results) printTicket(t, true);
  console.log('');
}

function cmdStats() {
  const content = readTasks();
  const tickets = parseTickets(content);

  // Agrupar por bloque
  const blocks = {};
  for (const t of tickets) {
    if (!blocks[t.block]) blocks[t.block] = { done: 0, total: 0, gemini: 0, codex: 0 };
    blocks[t.block].total++;
    if (t.done) blocks[t.block].done++;
    if (t.owner === 'Gemini') blocks[t.block].gemini++;
    else blocks[t.block].codex++;
  }

  console.log('\n' + C.bold('📊  Estadísticas por bloque'));
  console.log('─'.repeat(60));

  for (const [block, st] of Object.entries(blocks)) {
    const pct   = Math.round((st.done / st.total) * 100);
    const color = pct === 100 ? C.green : pct > 50 ? C.yellow : s => s;
    const g = st.gemini > 0 ? C.cyan(`G:${st.gemini}`) : '';
    const c = st.codex  > 0 ? C.magenta(`C:${st.codex}`) : '';
    console.log(
      `  ${color(block.slice(0, 36).padEnd(36))} ` +
      `${color((st.done + '/' + st.total).padStart(5))} ${[g, c].filter(Boolean).join(' ')}`
    );
  }

  const total = tickets.length;
  const done  = tickets.filter(t => t.done).length;
  const pct   = Math.round((done / total) * 100);
  console.log('─'.repeat(60));
  console.log(C.bold(`  TOTAL ${(done + '/' + total).padStart(39)} ${pct}%`));
  console.log('');
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTER DE COMANDOS
// ══════════════════════════════════════════════════════════════════════════════

const [,, cmd, ...args] = process.argv;

switch ((cmd || '').toLowerCase()) {
  case '':
  case 'summary':
  case 's':
    cmdSummary();
    break;

  case 'list':
  case 'ls':
  case 'l': {
    const owner = args[0] && !args[0].startsWith('-')
      ? (args[0][0].toUpperCase() + args[0].slice(1).toLowerCase())
      : null;
    const q = owner ? args[1] : args[0];
    cmdList(owner, q);
    break;
  }

  case 'next':
  case 'n': {
    const owner = args[0]
      ? (args[0][0].toUpperCase() + args[0].slice(1).toLowerCase())
      : null;
    cmdNext(owner);
    break;
  }

  case 'done':
  case 'd':
    cmdDone(args);
    break;

  case 'search':
  case 'find':
  case 'q':
    cmdSearch(args.join(' '));
    break;

  case 'stats':
  case 'st':
    cmdStats();
    break;

  default:
    console.log('\n' + C.bold('Aurora Derm — tasks CLI'));
    console.log('');
    console.log('  Comandos:');
    console.log('  ' + C.cyan('node bin/tasks.js') + '              → resumen de progreso');
    console.log('  ' + C.cyan('node bin/tasks.js list') + '         → tickets pendientes');
    console.log('  ' + C.cyan('node bin/tasks.js list gemini') + '  → tickets [Gemini]');
    console.log('  ' + C.cyan('node bin/tasks.js list codex') + '   → tickets [Codex]');
    console.log('  ' + C.cyan('node bin/tasks.js next gemini') + '  → próximo para Gemini');
    console.log('  ' + C.cyan('node bin/tasks.js done T-01') + '    → marcar completado');
    console.log('  ' + C.cyan('node bin/tasks.js search kiosco') + '→ buscar tickets');
    console.log('  ' + C.cyan('node bin/tasks.js stats') + '        → estadísticas por bloque');
    console.log('');
}
