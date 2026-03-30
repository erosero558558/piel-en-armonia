'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const agentsMd = readFileSync(resolve(REPO_ROOT, 'AGENTS.md'), 'utf8');

const {
    CRITICAL_JUNE_SPRINTS,
    buildVelocitySnapshot,
    extractTaskIdsFromGitLog,
    formatVelocityText,
    parseTasks,
} = require('../bin/velocity.js');

test('parseTasks reconoce IDs UI y sprints modernos del board', () => {
    const tasks = parseTasks(`
### 🎨 Sprint UI — Clinical Luxury
- [ ] **UI3-15** \`[M]\` Header sticky
### 🔍 Sprint 13 — Audit
- [x] **S13-04** \`[M]\` Security headers
### 🛠️ Sprint 15 — Sistema de Agentes
- [ ] **S15-01** \`[S]\` Regex velocity
`.trim());

    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].id, 'UI3-15');
    assert.equal(tasks[0].sprint, 99);
    assert.equal(tasks[1].id, 'S13-04');
    assert.equal(tasks[1].sprint, 13);
    assert.equal(tasks[1].done, true);
    assert.equal(tasks[2].id, 'S15-01');
    assert.equal(tasks[2].sprint, 15);
});

test('extractTaskIdsFromGitLog captura commits S y UI sin duplicarlos', () => {
    const taskIds = extractTaskIdsFromGitLog(`
abc123 feat(UI3-15): sticky header
def456 fix: S14-00 board convergence
ghi789 claim: UI2-07
jkl012 feat(S14-00): follow-up
`.trim());

    assert.deepEqual(taskIds.sort(), ['S14-00', 'UI2-07', 'UI3-15']);
});

test('buildVelocitySnapshot incluye UI y S8-S14 en el conteo crítico actual', () => {
    const snapshot = buildVelocitySnapshot({
        md: agentsMd,
        now: new Date('2026-03-30T14:30:00Z'),
        gitVelocity: { commitsPerDay: 12.3 },
        tasksLastWeek: 9,
    });

    assert.equal(snapshot.totalTasks >= 407, true);
    assert.equal(snapshot.uiTaskTotal >= 37, true);
    assert.equal(snapshot.sprint8To14Total >= 99, true);
    assert.deepEqual(snapshot.criticalSprintIds, CRITICAL_JUNE_SPRINTS);
    assert.equal(snapshot.criticalTotal >= snapshot.sprint3Total, true);
    assert.match(
        formatVelocityText(snapshot, new Date('2026-03-30T14:30:00Z')),
        /S3 \+ S8 \+ S9/
    );
    assert.match(
        formatVelocityText(snapshot, new Date('2026-03-30T14:30:00Z')),
        /Tasks UI\/Fases:\s+\d+/
    );
});
