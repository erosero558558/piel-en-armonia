'use strict';

function percent(part, total) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((Number(part || 0) / total) * 1000) / 10;
}

function riskWeight(task) {
    const risk = String(task?.risk || '').toLowerCase();
    if (risk === 'high') return 3;
    if (risk === 'medium') return 2;
    return 1;
}

function buildExecutorContribution(tasks, options = {}) {
    const activeStatuses =
        options.activeStatuses instanceof Set
            ? options.activeStatuses
            : new Set(options.activeStatuses || []);
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const totals = {
        tasks: safeTasks.length,
        done_tasks: 0,
        active_tasks: 0,
        weighted_points_total: 0,
        weighted_done_points_total: 0,
        weighted_active_points_total: 0,
    };

    const map = new Map();
    for (const task of safeTasks) {
        const executor = String(task.executor || 'unknown');
        const status = String(task.status || '');
        const weight = riskWeight(task);
        const isDone = status === 'done';
        const isActive = activeStatuses.has(status);

        totals.weighted_points_total += weight;
        if (isDone) totals.done_tasks += 1;
        if (isActive) totals.active_tasks += 1;
        if (isDone) totals.weighted_done_points_total += weight;
        if (isActive) totals.weighted_active_points_total += weight;

        if (!map.has(executor)) {
            map.set(executor, {
                executor,
                tasks: 0,
                done_tasks: 0,
                active_tasks: 0,
                weighted_points: 0,
                weighted_done_points: 0,
                weighted_active_points: 0,
            });
        }

        const row = map.get(executor);
        row.tasks += 1;
        row.weighted_points += weight;
        if (isDone) {
            row.done_tasks += 1;
            row.weighted_done_points += weight;
        }
        if (isActive) {
            row.active_tasks += 1;
            row.weighted_active_points += weight;
        }
    }

    const executors = Array.from(map.values())
        .map((row) => ({
            ...row,
            tasks_pct: percent(row.tasks, totals.tasks),
            done_tasks_pct: percent(row.done_tasks, totals.done_tasks),
            active_tasks_pct: percent(row.active_tasks, totals.active_tasks),
            weighted_points_pct: percent(
                row.weighted_points,
                totals.weighted_points_total
            ),
            weighted_done_points_pct: percent(
                row.weighted_done_points,
                totals.weighted_done_points_total
            ),
            weighted_active_points_pct: percent(
                row.weighted_active_points,
                totals.weighted_active_points_total
            ),
        }))
        .sort((a, b) => {
            return (
                b.weighted_done_points - a.weighted_done_points ||
                b.done_tasks - a.done_tasks ||
                b.weighted_active_points - a.weighted_active_points ||
                b.tasks - a.tasks ||
                String(a.executor).localeCompare(String(b.executor))
            );
        });

    const ranking = executors.map((row, idx) => ({
        rank: idx + 1,
        executor: row.executor,
        weighted_done_points: row.weighted_done_points,
        weighted_done_points_pct: row.weighted_done_points_pct,
        done_tasks: row.done_tasks,
        done_tasks_pct: row.done_tasks_pct,
    }));

    return {
        scoring: {
            primary_metric: 'weighted_done_points_pct',
            risk_weights: { low: 1, medium: 2, high: 3 },
        },
        totals,
        executors,
        ranking,
        top_executor: ranking[0] || null,
    };
}

function sanitizeContributionSnapshotExecutors(contribution) {
    const rows = Array.isArray(contribution?.executors)
        ? contribution.executors
        : [];
    return rows
        .map((row) => ({
            executor: String(row.executor || ''),
            weighted_done_points_pct: Number(row.weighted_done_points_pct || 0),
            done_tasks_pct: Number(row.done_tasks_pct || 0),
            active_tasks_pct: Number(row.active_tasks_pct || 0),
            weighted_active_points_pct: Number(
                row.weighted_active_points_pct || 0
            ),
        }))
        .sort((a, b) => String(a.executor).localeCompare(String(b.executor)));
}

function upsertContributionHistory(history, contribution, options = {}) {
    const base = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(base.snapshots)
        ? base.snapshots.slice()
        : [];
    const nowIso =
        typeof options.nowIso === 'string' && options.nowIso
            ? options.nowIso
            : new Date().toISOString();
    const date = nowIso.slice(0, 10);
    const snapshot = {
        date,
        captured_at: nowIso,
        top_executor: contribution?.top_executor
            ? String(contribution.top_executor.executor || '')
            : null,
        executors: sanitizeContributionSnapshotExecutors(contribution),
    };

    const next = snapshots.filter((item) => String(item.date || '') !== date);
    next.push(snapshot);
    next.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
    );

    return {
        version: 1,
        updated_at: nowIso,
        snapshots: next.slice(-365),
    };
}

function buildContributionHistorySummary(history, days = 7) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const ordered = snapshots
        .filter((item) => item && typeof item === 'object' && item.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const windowDays = Math.max(1, Number(days) || 7);
    const recent = ordered.slice(-windowDays);

    const executorSet = new Set();
    for (const item of recent) {
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            executorSet.add(String(row.executor || ''));
        }
    }
    const executors = Array.from(executorSet).filter(Boolean).sort();

    const daily = recent.map((item) => {
        const byExecutor = {};
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            byExecutor[String(row.executor || '')] = {
                weighted_done_points_pct: Number(
                    row.weighted_done_points_pct || 0
                ),
                done_tasks_pct: Number(row.done_tasks_pct || 0),
                active_tasks_pct: Number(row.active_tasks_pct || 0),
            };
        }
        return {
            date: String(item.date),
            captured_at: String(item.captured_at || ''),
            top_executor: item.top_executor ? String(item.top_executor) : null,
            executors: byExecutor,
        };
    });

    let weeklyDelta = { available: false, rows: [] };
    if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];
        const union = Array.from(
            new Set([
                ...Object.keys(first.executors),
                ...Object.keys(last.executors),
            ])
        ).sort();
        weeklyDelta = {
            available: true,
            from_date: first.date,
            to_date: last.date,
            rows: union.map((executor) => {
                const firstVal = Number(
                    first.executors[executor]?.weighted_done_points_pct || 0
                );
                const lastVal = Number(
                    last.executors[executor]?.weighted_done_points_pct || 0
                );
                return {
                    executor,
                    weighted_done_points_pct_from: firstVal,
                    weighted_done_points_pct_to: lastVal,
                    weighted_done_points_pct_delta:
                        Math.round((lastVal - firstVal) * 10) / 10,
                };
            }),
        };
    }

    return {
        version: 1,
        source_file: 'verification/agent-contribution-history.json',
        window_days: windowDays,
        snapshots_total: ordered.length,
        daily,
        executors,
        weekly_delta: weeklyDelta,
    };
}

function normalizeContributionBaseline(metricsSnapshot) {
    if (!metricsSnapshot || typeof metricsSnapshot !== 'object') return null;
    if (
        metricsSnapshot.baseline_contribution &&
        Array.isArray(metricsSnapshot.baseline_contribution.executors)
    ) {
        return metricsSnapshot.baseline_contribution;
    }
    if (
        metricsSnapshot.contribution &&
        Array.isArray(metricsSnapshot.contribution.executors)
    ) {
        return metricsSnapshot.contribution;
    }
    return null;
}

function buildContributionTrend(currentContribution, baselineContribution) {
    if (
        !currentContribution ||
        !Array.isArray(currentContribution.executors) ||
        !baselineContribution ||
        !Array.isArray(baselineContribution.executors)
    ) {
        return null;
    }

    const baselineByExecutor = new Map(
        baselineContribution.executors.map((row) => [
            String(row.executor || ''),
            row,
        ])
    );

    const rows = currentContribution.executors.map((row) => {
        const baseline =
            baselineByExecutor.get(String(row.executor || '')) || {};
        const weightedDonePctCurrent = Number(
            row.weighted_done_points_pct || 0
        );
        const weightedDonePctBaseline = Number(
            baseline.weighted_done_points_pct || 0
        );
        const donePctCurrent = Number(row.done_tasks_pct || 0);
        const donePctBaseline = Number(baseline.done_tasks_pct || 0);

        return {
            executor: String(row.executor || ''),
            weighted_done_points_pct_current: weightedDonePctCurrent,
            weighted_done_points_pct_baseline: weightedDonePctBaseline,
            weighted_done_points_pct_delta:
                Math.round(
                    (weightedDonePctCurrent - weightedDonePctBaseline) * 10
                ) / 10,
            done_tasks_pct_current: donePctCurrent,
            done_tasks_pct_baseline: donePctBaseline,
            done_tasks_pct_delta:
                Math.round((donePctCurrent - donePctBaseline) * 10) / 10,
        };
    });

    return {
        baseline_source: 'metrics',
        rows,
    };
}

function getContributionSignal(row) {
    const weightedDone = Number(row?.weighted_done_points_pct || 0);
    const active = Number(row?.active_tasks || 0);
    const rank = Number(row?.rank || 999);

    if (rank === 1 && weightedDone > 0) return 'GREEN';
    if (weightedDone > 0 || active > 0) return 'YELLOW';
    return 'RED';
}

function formatPpDelta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    if (n > 0) return `+${n}pp`;
    return `${n}pp`;
}

module.exports = {
    percent,
    riskWeight,
    buildExecutorContribution,
    sanitizeContributionSnapshotExecutors,
    upsertContributionHistory,
    buildContributionHistorySummary,
    normalizeContributionBaseline,
    buildContributionTrend,
    getContributionSignal,
    formatPpDelta,
};
