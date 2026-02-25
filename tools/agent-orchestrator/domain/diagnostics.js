'use strict';

function buildStatusRedExplanation(input = {}, deps = {}) {
    const {
        conflictAnalysis,
        handoffData,
        handoffLintErrors,
        codexCheckReport,
        domainHealth,
        domainHealthHistory,
    } = input;
    const { isExpired = () => true, toConflictJsonRecord = (item) => item } =
        deps;

    const blockingConflicts = Array.isArray(conflictAnalysis?.blocking)
        ? conflictAnalysis.blocking
        : [];
    const handoffCovered = Array.isArray(conflictAnalysis?.handoffCovered)
        ? conflictAnalysis.handoffCovered
        : [];
    const handoffs = Array.isArray(handoffData?.handoffs)
        ? handoffData.handoffs
        : [];
    const activeExpiredHandoffs = handoffs.filter(
        (item) =>
            String(item.status || '').toLowerCase() === 'active' &&
            isExpired(item.expires_at)
    );
    const redDomains = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking.filter(
              (row) => String(row.signal || '') === 'RED'
          )
        : [];
    const greenToRedRegressions = Array.isArray(
        domainHealthHistory?.regressions?.green_to_red
    )
        ? domainHealthHistory.regressions.green_to_red
        : [];

    const blockers = [];
    const reasons = [];
    if (blockingConflicts.length > 0) {
        blockers.push('conflicts');
        reasons.push(`blocking_conflicts:${blockingConflicts.length}`);
    }
    if (Array.isArray(handoffLintErrors) && handoffLintErrors.length > 0) {
        blockers.push('handoffs_lint');
        reasons.push(`handoffs_lint:${handoffLintErrors.length}`);
    }
    if (codexCheckReport?.ok === false) {
        blockers.push('codex_check');
        reasons.push(`codex_check:${codexCheckReport.error_count || 0}`);
    }
    if (greenToRedRegressions.length > 0) {
        blockers.push('domain_regression_green_to_red');
        reasons.push(
            `domain_regression_green_to_red:${greenToRedRegressions.length}`
        );
    }
    if (redDomains.length > 0) {
        reasons.push(
            `domain_red:${redDomains.map((row) => String(row.domain)).join(',')}`
        );
    }
    if (activeExpiredHandoffs.length > 0) {
        reasons.push(`handoffs_active_expired:${activeExpiredHandoffs.length}`);
    }
    if (handoffCovered.length > 0) {
        reasons.push(`handoff_conflicts:${handoffCovered.length}`);
    }
    if (reasons.length === 0) {
        reasons.push('no_red_conditions_detected');
    }

    return {
        version: 1,
        signal: blockers.length > 0 ? 'RED' : 'NOT_RED',
        blockers,
        reasons,
        counts: {
            blocking_conflicts: blockingConflicts.length,
            handoff_conflicts: handoffCovered.length,
            handoff_lint_errors: Array.isArray(handoffLintErrors)
                ? handoffLintErrors.length
                : 0,
            codex_check_errors: Number(codexCheckReport?.error_count || 0),
            active_expired_handoffs: activeExpiredHandoffs.length,
            red_domains: redDomains.length,
            domain_regression_green_to_red: greenToRedRegressions.length,
        },
        top_blocking_conflicts: blockingConflicts
            .slice(0, 5)
            .map((item) => toConflictJsonRecord(item)),
        handoff_lint_errors: Array.isArray(handoffLintErrors)
            ? handoffLintErrors.slice(0, 10)
            : [],
        codex_check_errors: Array.isArray(codexCheckReport?.errors)
            ? codexCheckReport.errors.slice(0, 10)
            : [],
        red_domains: redDomains.slice(0, 10).map((row) => ({
            domain: String(row.domain || ''),
            signal: String(row.signal || ''),
            blocking_conflicts: Number(row.blocking_conflicts || 0),
            handoff_conflicts: Number(row.handoff_conflicts || 0),
            reasons: Array.isArray(row.reasons) ? row.reasons : [],
        })),
        domain_regression_green_to_red: greenToRedRegressions.slice(0, 10),
    };
}

module.exports = {
    buildStatusRedExplanation,
};
