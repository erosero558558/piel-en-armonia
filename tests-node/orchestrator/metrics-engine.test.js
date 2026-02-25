#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const metrics = require('../../tools/agent-orchestrator/domain/metrics');

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('metrics-engine buildExecutorContribution pondera por riesgo y rankea ejecutores', () => {
    const contribution = metrics.buildExecutorContribution(
        [
            { executor: 'jules', status: 'done', risk: 'high' },
            { executor: 'jules', status: 'ready', risk: 'medium' },
            { executor: 'kimi', status: 'done', risk: 'low' },
            { executor: 'codex', status: 'backlog', risk: 'high' },
        ],
        { activeStatuses: ACTIVE_STATUSES }
    );

    assert.equal(contribution.totals.tasks, 4);
    assert.equal(contribution.totals.done_tasks, 2);
    assert.equal(contribution.totals.active_tasks, 1);
    assert.equal(contribution.top_executor.executor, 'jules');
    assert.equal(contribution.top_executor.weighted_done_points, 3);

    const jules = contribution.executors.find((r) => r.executor === 'jules');
    const kimi = contribution.executors.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct, 75);
    assert.equal(kimi.weighted_done_points_pct, 25);
});

test('metrics-engine normalizeContributionBaseline y buildContributionTrend generan delta estable', () => {
    const current = {
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 60,
                done_tasks_pct: 50,
            },
            {
                executor: 'kimi',
                weighted_done_points_pct: 40,
                done_tasks_pct: 50,
            },
        ],
    };
    const metricsSnapshot = {
        baseline_contribution: {
            executors: [
                {
                    executor: 'jules',
                    weighted_done_points_pct: 50,
                    done_tasks_pct: 40,
                },
                {
                    executor: 'kimi',
                    weighted_done_points_pct: 50,
                    done_tasks_pct: 60,
                },
            ],
        },
    };

    const baseline = metrics.normalizeContributionBaseline(metricsSnapshot);
    const trend = metrics.buildContributionTrend(current, baseline);
    assert.equal(trend.baseline_source, 'metrics');

    const jules = trend.rows.find((r) => r.executor === 'jules');
    const kimi = trend.rows.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct_delta, 10);
    assert.equal(jules.done_tasks_pct_delta, 10);
    assert.equal(kimi.weighted_done_points_pct_delta, -10);
    assert.equal(kimi.done_tasks_pct_delta, -10);
});

test('metrics-engine upsertContributionHistory y buildContributionHistorySummary resumen ventana', () => {
    const c1 = {
        top_executor: { executor: 'jules' },
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 55,
                done_tasks_pct: 60,
                active_tasks_pct: 20,
            },
        ],
    };
    const c2 = {
        top_executor: { executor: 'kimi' },
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 45,
                done_tasks_pct: 40,
                active_tasks_pct: 10,
            },
            {
                executor: 'kimi',
                weighted_done_points_pct: 55,
                done_tasks_pct: 60,
                active_tasks_pct: 30,
            },
        ],
    };

    let history = metrics.upsertContributionHistory(null, c1, {
        nowIso: '2026-02-24T10:00:00.000Z',
    });
    history = metrics.upsertContributionHistory(history, c2, {
        nowIso: '2026-02-25T10:00:00.000Z',
    });

    const summary = metrics.buildContributionHistorySummary(history, 7);
    assert.equal(summary.snapshots_total, 2);
    assert.deepEqual(summary.executors, ['jules', 'kimi']);
    assert.equal(summary.weekly_delta.available, true);
    assert.equal(summary.weekly_delta.from_date, '2026-02-24');
    assert.equal(summary.weekly_delta.to_date, '2026-02-25');

    const jules = summary.weekly_delta.rows.find((r) => r.executor === 'jules');
    const kimi = summary.weekly_delta.rows.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct_delta, -10);
    assert.equal(kimi.weighted_done_points_pct_delta, 55);
});

test('metrics-engine contribution signal y pp delta mantienen semantica', () => {
    assert.equal(
        metrics.getContributionSignal({
            rank: 1,
            weighted_done_points_pct: 10,
            active_tasks: 0,
        }),
        'GREEN'
    );
    assert.equal(
        metrics.getContributionSignal({
            rank: 2,
            weighted_done_points_pct: 0,
            active_tasks: 1,
        }),
        'YELLOW'
    );
    assert.equal(
        metrics.getContributionSignal({
            rank: 3,
            weighted_done_points_pct: 0,
            active_tasks: 0,
        }),
        'RED'
    );
    assert.equal(metrics.formatPpDelta(3.2), '+3.2pp');
    assert.equal(metrics.formatPpDelta(-1), '-1pp');
    assert.equal(metrics.formatPpDelta('x'), 'n/a');
});
