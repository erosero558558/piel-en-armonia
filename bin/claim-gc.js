#!/usr/bin/env node
/**
 * bin/claim-gc.js — Garbage collector de claims expirados
 *
 * Carencia #1 resuelta: claims sin timeout se quedaban activos indefinidamente.
 * Este script expira claims >24h automáticamente y genera un reporte.
 *
 * Uso:
 *   node bin/claim-gc.js           ← muestra expirados sin borrar
 *   node bin/claim-gc.js --purge   ← elimina los expirados
 *   node bin/claim-gc.js --json    ← salida JSON
 */

const { readFileSync, writeFileSync, unlinkSync, readdirSync, existsSync } = require('fs');
const { resolve, join } = require('path');

const ROOT       = resolve(__dirname, '..');
const CLAIMS_DIR = resolve(ROOT, 'data/claims/tasks');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');

const CLAIM_TTL_HOURS = 24; // claims más viejos de 24h se consideran expirados
const purge  = process.argv.includes('--purge');
const asJson = process.argv.includes('--json');

function loadAgentsDone() {
  const md = existsSync(AGENTS_FILE) ? readFileSync(AGENTS_FILE, 'utf8') : '';
  const done = new Set();
  for (const line of md.split('\n')) {
    const m = line.match(/^- \[x\] \*\*((S\d+|UI\d*|RB)-[A-Z0-9]+)\*\*/);
    if (m) done.add(m[1]);
  }
  return done;
}

function main() {
  if (!existsSync(CLAIMS_DIR)) {
    console.log('⚪ No hay directorio de claims.');
    process.exit(0);
  }

  const files  = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
  const now    = new Date();
  const done   = loadAgentsDone();

  const expired    = [];
  const orphaned   = [];
  const active     = [];

  for (const f of files) {
    const id   = f.replace('.json', '');
    let claim;
    try { claim = JSON.parse(readFileSync(join(CLAIMS_DIR, f), 'utf8')); } catch { continue; }

    const claimedAt   = claim.claimedAt ? new Date(claim.claimedAt) : null;
    const hoursOld    = claimedAt ? (now - claimedAt) / 3_600_000 : 999;
    const isTaskDone  = done.has(id);
    const isExplicitlyExpired = claim.expiresAt && new Date(claim.expiresAt) < now;

    if (isTaskDone) {
      // Done in AGENTS.md but claim file still exists → orphaned
      orphaned.push({ id, f, reason: 'task marked [x] in AGENTS.md but claim file remains' });
    } else if (isExplicitlyExpired || hoursOld > CLAIM_TTL_HOURS) {
      expired.push({
        id, f,
        claimedAt: claimedAt?.toISOString(),
        hoursOld: Math.round(hoursOld),
        reason: isExplicitlyExpired ? 'expiresAt elapsed' : `claim is ${Math.round(hoursOld)}h old (>${CLAIM_TTL_HOURS}h TTL)`
      });
    } else {
      active.push({ id, claimedAt: claimedAt?.toISOString(), hoursOld: Math.round(hoursOld) });
    }
  }

  const toRemove = [...expired, ...orphaned];

  if (asJson) {
    console.log(JSON.stringify({ expired, orphaned, active, total: files.length }, null, 2));
    process.exit(toRemove.length > 0 ? 1 : 0);
  }

  console.log(`\n🗑  Claim GC — Aurora Derm`);
  console.log(`   TTL: ${CLAIM_TTL_HOURS}h | Total claims: ${files.length}\n`);

  if (expired.length === 0 && orphaned.length === 0) {
    console.log('✅ Todos los claims están activos y dentro del TTL.');
  } else {
    if (expired.length > 0) {
      console.log(`⏰ Expirados por TTL (${expired.length}):`);
      expired.forEach(c => console.log(`   ${c.id.padEnd(12)} ${c.reason}`));
      console.log('');
    }
    if (orphaned.length > 0) {
      console.log(`👻 Huérfanos — tarea done en AGENTS.md pero claim activo (${orphaned.length}):`);
      orphaned.forEach(c => console.log(`   ${c.id.padEnd(12)} ${c.reason}`));
      console.log('');
    }

    if (purge) {
      toRemove.forEach(c => {
        unlinkSync(join(CLAIMS_DIR, c.f));
        console.log(`   🗑 Eliminado: ${c.id}`);
      });
      console.log(`\n✅ ${toRemove.length} claims eliminados.`);
    } else {
      console.log(`   → Ejecuta con --purge para eliminarlos.`);
    }
  }

  if (active.length > 0) {
    console.log(`\n🟢 Activos (${active.length}):`);
    active.forEach(c => console.log(`   ${c.id.padEnd(12)} ${c.hoursOld}h desde claim`));
  }

  process.exit(toRemove.length > 0 && !purge ? 1 : 0);
}

main();
