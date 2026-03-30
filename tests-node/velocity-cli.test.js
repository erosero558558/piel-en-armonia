'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

const {
  CRITICAL_SPRINTS,
  buildVelocityReport,
  formatVelocityText,
  parseTasks,
} = require('../bin/velocity.js');

test('parseTasks captures UI tasks and sprint metadata with the shared regex', () => {
  const tasks = parseTasks(`
### 🎨 Sprint UI — Fase 2
- [x] **UI2-01** \`[M]\` Texto
- [ ] **UI3-14** \`[S]\` Texto
### 🛠️ Sprint 15 — Sistema de Agentes
- [ ] **S15-01** \`[S]\` Texto
`);

  assert.deepEqual(
    tasks.map((task) => ({ id: task.id, sprint: task.sprint, done: task.done })),
    [
      { id: 'UI2-01', sprint: 99, done: true },
      { id: 'UI3-14', sprint: 99, done: false },
      { id: 'S15-01', sprint: 15, done: false },
    ]
  );
});

test('buildVelocityReport treats sprints 3, 8 and 9 as critical for June', () => {
  const report = buildVelocityReport({
    tasks: [
      { id: 'S3-01', sprint: 3, done: false, human: false },
      { id: 'S8-01', sprint: 8, done: false, human: false },
      { id: 'S9-01', sprint: 9, done: true, human: false },
      { id: 'S4-01', sprint: 4, done: false, human: false },
    ],
    now: new Date('2026-03-30T12:00:00Z'),
    launchDate: new Date('2026-04-20T00:00:00Z'),
    tasksLastWeek: 1,
    gitVelocity: { commitsPerDay: 2.5 },
  });

  assert.deepEqual(report.criticalSprints, CRITICAL_SPRINTS);
  assert.equal(report.criticalSprintsTotal, 3);
  assert.equal(report.criticalSprintsDone, 1);
  assert.equal(report.criticalSprintsPending, 2);
  assert.equal(report.willFinishCriticalSprints, true);
  assert.equal(report.willFinishSprint3, true);
  assert.match(formatVelocityText(report), /Sprints críticos para junio \(3, 8, 9\)/);
  assert.match(formatVelocityText(report), /Sprint 8: 0\/1 \(1 pendientes\)/);
});

test('current AGENTS inventory stays above the UI-aware task threshold for S15-01', () => {
  const tasks = parseTasks(readFileSync(resolve(REPO_ROOT, 'AGENTS.md'), 'utf8'));
  const report = buildVelocityReport({
    tasks,
    now: new Date('2026-03-30T12:00:00Z'),
    tasksLastWeek: 1,
    gitVelocity: { commitsPerDay: 1 },
  });

  assert.ok(report.totalTasks >= 407);
  assert.deepEqual(report.criticalSprints, [3, 8, 9]);
  assert.ok(report.criticalSprintsTotal >= report.sprint3Total);
});
