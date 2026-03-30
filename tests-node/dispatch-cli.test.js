'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ROLE_AFFINITY,
    buildDispatchResult,
} = require('../bin/dispatch.js');

test('ROLE_AFFINITY keeps S8-S14 preferred tasks for backend, frontend, and devops', () => {
    assert.deepEqual(
        ROLE_AFFINITY.backend.prefer.slice(0, 8),
        ['S8-05', 'S8-06', 'S8-07', 'S8-12', 'S8-20', 'S9-08', 'S10-06', 'S14-13']
    );
    assert.deepEqual(
        ROLE_AFFINITY.frontend.prefer.slice(0, 5),
        ['S9-01', 'S9-09', 'S10-01', 'S10-25', 'S12-17']
    );
    assert.deepEqual(
        ROLE_AFFINITY.devops.prefer.slice(0, 6),
        ['S14-00', 'S14-02', 'S14-06', 'S14-07', 'S14-09', 'S13-04']
    );
});

test('backend dispatch prefers S8-S14 backlog over generic later sprint work', () => {
    const result = buildDispatchResult({
        roleArg: 'backend',
        md: `
### 🔧 Sprint 8
- [ ] **S8-05** \`[M]\` Remote operator-auth recovery — endpoint auth remoto con 502.
### 🔍 Sprint 13
- [ ] **S13-03** \`[M]\` [UI] 404 y 500 con Design System — página pública.
`.trim(),
        claims: {},
    });

    assert.equal(result.best.id, 'S8-05');
});

test('frontend dispatch prefers S9/S10 UI work over generic public backlog', () => {
    const result = buildDispatchResult({
        roleArg: 'frontend',
        md: `
### 🎯 Sprint 9
- [ ] **S9-01** \`[M]\` [UI] Portal: próxima cita viva — card con datos reales.
### 🔍 Sprint 13
- [ ] **S13-03** \`[M]\` [UI] 404 y 500 con Design System — página pública.
`.trim(),
        claims: {},
    });

    assert.equal(result.best.id, 'S9-01');
});

test('devops dispatch prefers governance tasks from Sprint 14 before older audit backlog', () => {
    const result = buildDispatchResult({
        roleArg: 'devops',
        md: `
### 🔧 Sprint 14
- [ ] **S14-00** \`[M]\` Convergencia real de estado del sistema — status y report no coinciden.
### 🔍 Sprint 13
- [ ] **S13-04** \`[M]\` Security headers en nginx — headers faltantes.
### ⏸ Sprint 4
- [ ] **S4-21** \`[M]\` Auditoría final pre-launch — checklist general.
`.trim(),
        claims: {},
    });

    assert.equal(result.best.id, 'S14-00');
});
