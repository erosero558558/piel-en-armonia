'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatusPayload,
  formatStatusText,
  nextReviewDate,
  parseClaimStatus,
} = require('../bin/status.js');

test('parseClaimStatus extracts totals and active claims', () => {
  const parsed = parseClaimStatus(`
📊 Aurora Derm — Task Board
   Total: 232 | Done: 83 (36%) | Pending: 149
   Claims activos: 2 | Expirados: 0

🔒 Claims activos (NO duplicar):
   S3-49 → "Codex-erosero558558" (119m restantes)
   UI-05 → "Antigravity" (239m restantes)
`);

  assert.equal(parsed.totalTasks, 232);
  assert.equal(parsed.doneTasks, 83);
  assert.equal(parsed.pctDone, 36);
  assert.equal(parsed.pendingTasks, 149);
  assert.equal(parsed.claimsActive, 2);
  assert.equal(parsed.expiredClaims, 0);
  assert.deepEqual(parsed.claims[0], {
    taskId: 'S3-49',
    agent: 'Codex-erosero558558',
    detail: '119m restantes',
  });
});

test('buildStatusPayload and formatStatusText aggregate merge, velocity, and report output', () => {
  const payload = buildStatusPayload({
    now: new Date('2026-03-29T23:58:36-05:00'),
    reportText: 'Reporte corto',
    claimStatusText: `
📊 Aurora Derm — Task Board
   Total: 232 | Done: 83 (36%) | Pending: 149
   Claims activos: 1 | Expirados: 0

🔒 Claims activos (NO duplicar):
   S3-49 → "Codex-erosero558558" (119m restantes)
`,
    velocity: {
      signal: 'EN CAMINO',
      velocity: 48,
      doneTasks: 79,
      totalTasks: 213,
      pctDone: 37,
      commitsPerDay: 24.9,
    },
    mergeReady: {
      ready: [
        {
          branch: 'codex/s3-28-daily-agenda-admin',
          taskId: '3-28-DAILY-AGENDA-ADMIN',
          lastCommit: 'feat(S3-28): add daily agenda and arrived flow',
        },
      ],
      pending: [
        {
          branch: 'codex/s3-41-cie10-autocomplete',
          taskId: '3-41-CIE10-AUTOCOMPLETE',
          lastCommit: 'claim: S3-41',
        },
      ],
      total: 2,
    },
  });

  assert.equal(payload.summary.pctDone, 37);
  assert.equal(payload.summary.claimsActive, 1);
  assert.equal(payload.summary.mergeReadyCount, 1);
  assert.equal(payload.summary.mergePendingCount, 1);
  assert.equal(payload.nextReviewDate, nextReviewDate(new Date('2026-03-29T23:58:36-05:00')));

  const text = formatStatusText(payload);
  assert.match(text, /Progreso actual: 37% \(79\/213\)/);
  assert.match(text, /Claims activos: 1/);
  assert.match(text, /Ramas pendientes de merge: 1 listas, 1 en progreso/);
  assert.match(text, /Velocidad actual: 48 tareas\/semana · EN CAMINO/);
  assert.match(text, /S3-49 → Codex-erosero558558 \(119m restantes\)/);
  assert.match(text, /codex\/s3-28-daily-agenda-admin/);
  assert.match(text, /Reporte corto/);
});
