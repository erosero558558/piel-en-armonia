#!/usr/bin/env node
/**
 * bin/regression-watch.js — S15-09: Watchdog de Regresiones
 * 
 * Detecta alteraciones recientes en archivos que fueron foco principal de
 * tareas previamente marcadas como completadas en AGENTS.md.
 */

const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const silent = process.argv.includes('--silent');
const asJson = process.argv.includes('--json');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// 1. Obtener archivos cambiados recientemente (últimos 5 commits o ~1 día)
const recentFilesCmd = run('git diff --name-only HEAD~5 HEAD');
if (!recentFilesCmd) {
  if (asJson) console.log(JSON.stringify({ regressions: [] }));
  else if (!silent) console.log('✅ 0 regresiones detectadas (sin cambios recientes)');
  process.exit(0);
}

const recentFiles = recentFilesCmd.split('\n').filter(Boolean);

// 2. Extraer archivos mencionados en tareas completadas [x]
const agentsMd = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
const completedTasks = [];

agentsMd.split('\n').forEach(line => {
  const match = line.match(/^- \[x\] \*\*((?:S\d+|UI\d*|RB)-[A-Z0-9]+)\*\*(.*)/);
  if (match) {
    const id = match[1];
    const desc = match[2];
    // Rudimentary file extraction: looks for standard extensions
    const fileMatches = desc.match(/([a-zA-Z0-9_\-\/]+\.(?:js|html|css|php|md))/g);
    if (fileMatches) {
        completedTasks.push({ id, desc: desc.trim(), files: [...new Set(fileMatches)] });
    }
  }
});

// 3. Cruzar datos
const regressions = [];
for (const task of completedTasks) {
  for (const file of task.files) {
    if (recentFiles.includes(file)) {
      regressions.push({
        task: task.id,
        file: file,
        message: `⚠️ Regresión detectada: ${file} (mencionado en ${task.id}) fue modificado recientemente.`
      });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ regressions }));
  process.exit(0);
}

if (regressions.length === 0) {
  if (!silent) console.log('✅ 0 regresiones detectadas.');
} else {
  if (!silent) console.log(`🛑 Detectadas ${regressions.length} modificaciones sospechosas:`);
  regressions.forEach(r => {
    if (!silent) console.log(`   - ${r.message}`);
  });
}
