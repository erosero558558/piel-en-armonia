#!/usr/bin/env node
/**
 * bin/report.js — Reporte diario de progreso Aurora Derm
 *
 * Genera un resumen ejecutivo de lo que los agentes hicieron:
 * commits, tareas completadas, blockers humanos, velocidad.
 *
 * Uso:
 *   node bin/report.js              ← reporte de las últimas 24h
 *   node bin/report.js --hours 48   ← últimas 48h
 *   node bin/report.js --md         ← output en Markdown (para REPORT.md)
 *   node bin/report.js --write      ← escribe REPORT.md automáticamente
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const CLAIMS_DIR  = resolve(ROOT, 'data/claims/tasks'); // v2: archivos individuales

const hoursArg = parseInt(process.argv.find(a => a.startsWith('--hours='))?.split('=')[1] || '24');
const asMarkdown = process.argv.includes('--md') || process.argv.includes('--write');
const writeFile = process.argv.includes('--write');

function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

function read(f) { return existsSync(f) ? readFileSync(f, 'utf8') : ''; }

function loadClaims() {
  const claims = {};
  try {
    const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const id = f.replace('.json', '');
      try { claims[id] = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8').replace(/^\uFEFF/, '')); } catch {}
    }
  } catch {}
  return claims;
}

// ── Data collection ───────────────────────────────────────────────────────────

const since = `${hoursArg} hours ago`;
const commits = run(`git log --oneline --since="${since}"`)
  .split('\n').filter(Boolean);

const authors = run(`git log --format="%ae" --since="${since}"`)
  .split('\n').filter(Boolean);
const authorCounts = {};
authors.forEach(a => authorCounts[a] = (authorCounts[a] || 0) + 1);

const filesChanged = run(`git diff --name-only HEAD~${Math.min(commits.length, 50)} HEAD`)
  .split('\n').filter(Boolean);

const agentsMd = read(AGENTS_FILE);
// Contar solo líneas con ID de tarea real (S3-19, S3-OC1, etc.) — igual que claim.js
const doneTotal    = (agentsMd.match(/^- \[x\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
const pendingTotal = (agentsMd.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*/gm) || []).length;
const totalTasks   = doneTotal + pendingTotal;

// Tasks completed in the period (look at recent commits with task IDs)
const completedInPeriod = commits
  .map(c => c.match(/\((S\d+-[A-Z0-9]+)\)/)?.[1])
  .filter(Boolean);

// Human blockers
const humanBlockers = [];
agentsMd.split('\n').forEach(line => {
  const m = line.match(/^- \[ \] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*.*\[HUMAN\](.*)/);
  if (m) humanBlockers.push({ id: m[1], description: line.replace(/^- \[ \] /, '').trim() });
});

// Active claims
const claims = loadClaims();
const activeClaims = Object.entries(claims).filter(([, c]) => {
  return c?.expiresAt && new Date(c.expiresAt) > new Date();
});

// Expired claims (potential stuck agents)
const expiredClaims = Object.entries(claims).filter(([, c]) => {
  return c?.expiresAt && new Date(c.expiresAt) < new Date();
});

// Explicitly stuck tasks
function loadStuck() {
  const f = resolve(ROOT, 'data/claims/stuck.json');
  try { return JSON.parse(read(f).replace(/^\uFEFF/, '')); } catch { return {}; }
}
const stuckData = loadStuck();
const stuckTasks = Object.entries(stuckData).filter(([, s]) => !s.resolved);



// Sprint velocity
const sprintSections = {
  'Sprint 1': { done: 0, total: 0 },
  'Sprint 2': { done: 0, total: 0 },
  'Sprint 3': { done: 0, total: 0 },
  'Sprint 4': { done: 0, total: 0 },
};
let currentSprint = '';
agentsMd.split('\n').forEach(line => {
  if (line.match(/Sprint 1/)) currentSprint = 'Sprint 1';
  else if (line.match(/Sprint 2/)) currentSprint = 'Sprint 2';
  else if (line.match(/Sprint 3/)) currentSprint = 'Sprint 3';
  else if (line.match(/Sprint 4/)) currentSprint = 'Sprint 4';
  if (!currentSprint || !sprintSections[currentSprint]) return;
  if (line.match(/^- \[x\]/)) sprintSections[currentSprint].done++;
  if (line.match(/^- \[ \]/)) sprintSections[currentSprint].total++;
});
Object.keys(sprintSections).forEach(s => {
  sprintSections[s].total += sprintSections[s].done;
});

// Key files touched
const keyFileCategories = {
  'Frontend (HTML/CSS)': filesChanged.filter(f => f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.astro')),
  'Backend (PHP)': filesChanged.filter(f => f.endsWith('.php')),
  'JavaScript': filesChanged.filter(f => f.endsWith('.js') && !f.startsWith('bin/')),
  'Content/Docs': filesChanged.filter(f => f.endsWith('.md') || f.endsWith('.xml') || f.endsWith('.json')),
  'Tests': filesChanged.filter(f => f.includes('test') || f.includes('spec')),
};

// ── Format output ─────────────────────────────────────────────────────────────

const perfJsonPath = resolve(ROOT, 'governance/performance-gate.json');
let perfStatus = null;
if (existsSync(perfJsonPath)) {
  try {
    const pData = JSON.parse(readFileSync(perfJsonPath, 'utf8'));
    let maxLcp = 0;
    if (pData.routes && Array.isArray(pData.routes)) {
      maxLcp = Math.max(...pData.routes.map(r => r.metrics?.lcpMs || 0));
    }
    perfStatus = {
      passed: pData.passed === true,
      maxLcp: Math.round(maxLcp)
    };
  } catch (e) {}
}

const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
const pct = Math.round((doneTotal / totalTasks) * 100);
const progressBar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

if (asMarkdown) {
  const lines = [
    `# 📊 Aurora Derm — Reporte de Progreso`,
    `_Generado: ${now} | Período: últimas ${hoursArg}h_`,
    ``,
    `## Progreso General`,
    ``,
    `\`\`\``,
    `${progressBar} ${pct}%`,
    `Completadas: ${doneTotal} / ${totalTasks} tareas`,
    `Pendientes:  ${pendingTotal}`,
    `\`\`\``,
    ``,
    `## ⚡ Performance Gate`,
    ``,
    perfStatus 
      ? (perfStatus.passed 
          ? `🟢 **Budget OK:** Rendimiento estable (Max LCP: ${perfStatus.maxLcp}ms)` 
          : `🔴 **LCP over budget:** Revisar regresión de web vitals (Max LCP: ${perfStatus.maxLcp}ms)`)
      : `_No performance data available._`,
    ``,
    `## Velocidad por Sprint`,
    ``,
    `| Sprint | Hecho | Total | % |`,
    `|--------|-------|-------|---|`,
    ...Object.entries(sprintSections).map(([s, { done, total }]) => {
      const p = total > 0 ? Math.round((done / total) * 100) : 0;
      const status = p === 100 ? '✅' : p > 50 ? '🟡' : p > 0 ? '🔴' : '⬜';
      return `| ${status} ${s} | ${done} | ${total} | ${p}% |`;
    }),
    ``,
    `## Actividad (últimas ${hoursArg}h)`,
    ``,
    `- **${commits.length}** commits`,
    `- **${filesChanged.length}** archivos modificados`,
    completedInPeriod.length > 0
      ? `- **Tareas completadas:** ${completedInPeriod.join(', ')}`
      : `- No se detectaron task IDs en commits del período`,
    ``,
    `### Archivos por categoría`,
    ``,
    ...Object.entries(keyFileCategories)
      .filter(([, files]) => files.length > 0)
      .map(([cat, files]) => `- **${cat}:** ${files.length} archivos`),
    ``,
  ];

  if (humanBlockers.length > 0) {
    lines.push(`## 🚨 Blockers — Requieren respuesta del dueño`);
    lines.push(``);
    lines.push(`> Estas tareas están marcadas [HUMAN] y los agentes NO pueden avanzar sin su input.`);
    lines.push(``);
    humanBlockers.forEach(b => {
      lines.push(`### ${b.id}`);
      const desc = b.description.replace(/\*\*/g, '').replace(/`\[[^\]]+\]`/g, '').trim();
      lines.push(desc.slice(0, 300));
      lines.push(``);
    });
  } else {
    lines.push(`## ✅ Sin Blockers Humanos`);
    lines.push(``);
  }

  if (activeClaims.length > 0) {
    lines.push(`## 🔒 Claims Activos (trabajo en curso)`);
    lines.push(``);
    activeClaims.forEach(([id, c]) => {
      const mins = Math.round((new Date(c.expiresAt) - new Date()) / 60000);
      lines.push(`- **${id}** → \`${c.agent}\` (expira en ${mins} min)`);
    });
    lines.push(``);
  }

  lines.push(`## Próximos pasos recomendados`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`# Ver siguiente tarea para cada rol:`);
  lines.push(`npm run dispatch:content   # blog, SEO, textos`);
  lines.push(`npm run dispatch:frontend  # HTML, CSS, páginas`);
  lines.push(`npm run dispatch:backend   # PHP, API, Flow OS`);
  lines.push(`npm run dispatch:devops    # limpieza, CI, audit`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(`_Para responder un blocker [HUMAN]: edita BLOCKERS.md con la respuesta y haz commit._`);

  const output = lines.join('\n');

  if (writeFile) {
    writeFileSync(resolve(ROOT, 'REPORT.md'), output, 'utf8');
    console.log(`✅ REPORT.md actualizado — ${now}`);
  } else {
    console.log(output);
  }

} else {
  // Console output
  console.log(`\n📊 Aurora Derm — Reporte (últimas ${hoursArg}h)`);
  console.log(`   ${now}\n`);
  console.log(`   [${progressBar}] ${pct}%`);
  console.log(`   ${doneTotal}/${totalTasks} tareas completadas, ${pendingTotal} pendientes\n`);

  console.log(`⚡ Performance Gate:`);
  if (perfStatus) {
    if (perfStatus.passed) {
      console.log(`   🟢 Budget OK (Max LCP: ${perfStatus.maxLcp}ms)\n`);
    } else {
      console.log(`   🔴 LCP over budget (Max LCP: ${perfStatus.maxLcp}ms)\n`);
    }
  } else {
    console.log(`   ⚪ No performance data available\n`);
  }

  console.log(`📈 Velocidad por sprint:`);
  Object.entries(sprintSections).forEach(([s, { done, total }]) => {
    const p = total > 0 ? Math.round((done / total) * 100) : 0;
    const bar = '■'.repeat(Math.round(p / 10)) + '□'.repeat(10 - Math.round(p / 10));
    console.log(`   ${s.padEnd(10)} [${bar}] ${p}% (${done}/${total})`);
  });

  console.log(`\n⚡ Actividad:`);
  console.log(`   ${commits.length} commits | ${filesChanged.length} archivos`);
  if (completedInPeriod.length > 0)
    console.log(`   Tareas: ${completedInPeriod.join(', ')}`);

  if (humanBlockers.length > 0) {
    console.log(`\n🚨 BLOCKERS — Requieren tu respuesta (${humanBlockers.length}):`);
    humanBlockers.forEach(b => {
      const short = b.description.replace(/\*\*/g, '').replace(/`\[[^\]]+\]`/g, '').slice(0, 80);
      console.log(`   ${b.id}: ${short}...`);
    });
    console.log(`   → Responde en BLOCKERS.md y haz commit`);
  } else {
    console.log(`\n✅ Sin blockers humanos`);
  }

  if (activeClaims.length > 0) {
    console.log(`\n🔒 Claims activos:`);
    activeClaims.forEach(([id, c]) => {
      const mins = Math.round((new Date(c.expiresAt) - new Date()) / 60000);
      console.log(`   ${id} → ${c.agent} (${mins}m restantes)`);
    });
  }

  if (stuckTasks.length > 0) {
    console.log(`\n🚧 AGENTES BLOQUEADOS — requieren tu atención (${stuckTasks.length}):`);
    stuckTasks.forEach(([id, s]) => {
      const age = Math.round((Date.now() - new Date(s.stuckAt).getTime()) / 60000);
      const ageStr = age < 60 ? `${age}min` : `${Math.round(age/60)}h`;
      console.log(`   ${id} (${ageStr}) → ${s.agent}`);
      console.log(`   Razón: ${s.reason}`);
    });
    console.log(`   → Responde en BLOCKERS.md o edita la tarea en AGENTS.md para simplificarla`);
    console.log(`   → Cuando esté resuelto: node bin/stuck.js clear <ID>`);
  }

  if (expiredClaims.length > 0) {
    console.log(`\n⚠️  Claims expirados (trabajo posiblemente incompleto):`);
    expiredClaims.forEach(([id, c]) => {
      const ago = Math.round((Date.now() - new Date(c.expiresAt).getTime()) / 60000);
      const agoStr = ago < 60 ? `${ago}min` : `${Math.round(ago/60)}h`;
      console.log(`   ${id} → ${c.agent} (expiró hace ${agoStr})`);
    });
    console.log(`   → Verifica si el trabajo fue pusheado. Si no: tarea disponible para retomar.`);
    console.log(`   → Para limpiar: node bin/claim.js purge-expired`);
  }

  console.log();
}
