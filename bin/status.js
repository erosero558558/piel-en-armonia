#!/usr/bin/env node
/**
 * bin/status.js — Resumen rápido de operación en una sola ejecución
 *
 * Combina:
 *   - report.js
 *   - claim.js status
 *   - velocity.js --json
 *   - merge-ready.js --json
 *
 * Uso:
 *   node bin/status.js
 *   node bin/status.js --json
 */

'use strict';

const { execFileSync } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

function runNodeScript(scriptName, args = []) {
  try {
    return execFileSync(process.execPath, [resolve(__dirname, scriptName), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 8,
    }).trim();
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : '';
    return stdout || stderr || '';
  }
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseClaimStatus(raw) {
  const parsed = {
    totalTasks: 0,
    doneTasks: 0,
    pctDone: 0,
    pendingTasks: 0,
    claimsActive: 0,
    expiredClaims: 0,
    claims: [],
    raw,
  };

  const totalsMatch = raw.match(
    /Total:\s*(\d+)\s*\|\s*Done:\s*(\d+)\s*\((\d+)%\)\s*\|\s*Pending:\s*(\d+)/
  );
  if (totalsMatch) {
    parsed.totalTasks = Number(totalsMatch[1]);
    parsed.doneTasks = Number(totalsMatch[2]);
    parsed.pctDone = Number(totalsMatch[3]);
    parsed.pendingTasks = Number(totalsMatch[4]);
  }

  const claimsMatch = raw.match(/Claims activos:\s*(\d+)\s*\|\s*Expirados:\s*(\d+)/);
  if (claimsMatch) {
    parsed.claimsActive = Number(claimsMatch[1]);
    parsed.expiredClaims = Number(claimsMatch[2]);
  }

  raw.split('\n').forEach((line) => {
    const claimMatch = line.match(/^\s*([A-Z0-9-]+)\s+→\s+"([^"]+)"\s+\(([^)]+)\)$/);
    if (!claimMatch) {
      return;
    }

    parsed.claims.push({
      taskId: claimMatch[1],
      agent: claimMatch[2],
      detail: claimMatch[3],
    });
  });

  return parsed;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  });
}

function nextReviewDate(now = new Date()) {
  const reviewDate = new Date(now);
  reviewDate.setDate(reviewDate.getDate() + 7);
  return reviewDate.toLocaleDateString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'medium',
  });
}

function buildStatusPayload({
  now = new Date(),
  reportText = '',
  claimStatusText = '',
  velocity = {},
  mergeReady = {},
}) {
  const claims = parseClaimStatus(claimStatusText);
  const readyBranches = Array.isArray(mergeReady.ready) ? mergeReady.ready : [];
  const pendingBranches = Array.isArray(mergeReady.pending) ? mergeReady.pending : [];

  return {
    generatedAt: now.toISOString(),
    generatedLabel: formatDateTime(now),
    nextReviewDate: nextReviewDate(now),
    summary: {
      pctDone:
        typeof velocity.pctDone === 'number'
          ? velocity.pctDone
          : claims.pctDone,
      doneTasks:
        typeof velocity.doneTasks === 'number'
          ? velocity.doneTasks
          : claims.doneTasks,
      totalTasks:
        typeof velocity.totalTasks === 'number'
          ? velocity.totalTasks
          : claims.totalTasks,
      pendingTasks:
        claims.pendingTasks ||
        Math.max(
          0,
          (typeof velocity.totalTasks === 'number' ? velocity.totalTasks : 0) -
            (typeof velocity.doneTasks === 'number' ? velocity.doneTasks : 0)
        ),
      claimsActive: claims.claimsActive,
      expiredClaims: claims.expiredClaims,
      mergeReadyCount: readyBranches.length,
      mergePendingCount: pendingBranches.length,
      velocityPerWeek:
        typeof velocity.velocity === 'number' ? velocity.velocity : 0,
      commitsPerDay:
        typeof velocity.commitsPerDay === 'number' ? velocity.commitsPerDay : 0,
      signal: velocity.signal || 'SIN DATOS',
    },
    claims,
    mergeReady: {
      ready: readyBranches,
      pending: pendingBranches,
      total:
        typeof mergeReady.total === 'number'
          ? mergeReady.total
          : readyBranches.length + pendingBranches.length,
    },
    velocity,
    reportText: reportText.trim(),
    claimStatusText: claimStatusText.trim(),
  };
}

function formatBranchLines(branches, emptyMessage, limit = 5) {
  if (!Array.isArray(branches) || branches.length === 0) {
    return [`   ${emptyMessage}`];
  }

  const lines = branches.slice(0, limit).map((branch) => {
    const taskId = branch.taskId ? ` · ${branch.taskId}` : '';
    const suffix = branch.lastCommit ? ` — ${branch.lastCommit}` : '';
    return `   ${branch.branch}${taskId}${suffix}`;
  });

  if (branches.length > limit) {
    lines.push(`   … +${branches.length - limit} más`);
  }

  return lines;
}

function formatClaimLines(claims) {
  if (!claims || claims.claims.length === 0) {
    return ['   Sin claims activos'];
  }

  return claims.claims.map(
    (claim) => `   ${claim.taskId} → ${claim.agent} (${claim.detail})`
  );
}

function formatStatusText(payload) {
  const lines = [
    '📌 Aurora Derm — Status rápido',
    `   ${payload.generatedLabel}`,
    '',
    `   Progreso actual: ${payload.summary.pctDone}% (${payload.summary.doneTasks}/${payload.summary.totalTasks})`,
    `   Claims activos: ${payload.summary.claimsActive}`,
    `   Ramas pendientes de merge: ${payload.summary.mergeReadyCount} listas, ${payload.summary.mergePendingCount} en progreso`,
    `   Velocidad actual: ${payload.summary.velocityPerWeek} tareas/semana · ${payload.summary.signal}`,
    `   Próxima revisión: ${payload.nextReviewDate}`,
    '',
    '🔒 Claims activos',
    ...formatClaimLines(payload.claims),
    '',
    '🔀 Ramas listas para merge',
    ...formatBranchLines(payload.mergeReady.ready, 'Sin ramas listas'),
    '',
    '⏳ Ramas en progreso',
    ...formatBranchLines(payload.mergeReady.pending, 'Sin ramas en progreso'),
  ];

  if (payload.reportText) {
    lines.push('', '📊 Reporte consolidado', payload.reportText);
  }

  return `${lines.join('\n')}\n`;
}

function collectStatusPayload() {
  const reportText = runNodeScript('report.js');
  const claimStatusText = runNodeScript('claim.js', ['status']);
  const velocity = parseJson(runNodeScript('velocity.js', ['--json']), {});
  const mergeReady = parseJson(runNodeScript('merge-ready.js', ['--json']), {
    ready: [],
    pending: [],
    total: 0,
  });

  return buildStatusPayload({
    now: new Date(),
    reportText,
    claimStatusText,
    velocity,
    mergeReady,
  });
}

function main() {
  const payload = collectStatusPayload();

  if (JSON_MODE) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  process.stdout.write(formatStatusText(payload));
}

if (require.main === module) {
  main();
}

module.exports = {
  buildStatusPayload,
  formatStatusText,
  nextReviewDate,
  parseClaimStatus,
};
