'use strict';

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function normalizeArray(values) {
    const list = Array.isArray(values) ? values : values ? [values] : [];
    return list.map((value) => String(value || '').trim()).filter(Boolean);
}

function normalizeDecision(decision) {
    if (!decision || typeof decision !== 'object') return null;
    return {
        id: String(decision.id || '').trim(),
        strategy_id: String(decision.strategy_id || '').trim(),
        focus_id: String(decision.focus_id || '').trim(),
        focus_step: String(decision.focus_step || '').trim(),
        title: String(decision.title || '').trim(),
        owner: String(decision.owner || '').trim(),
        status: normalizeOptionalToken(decision.status),
        due_at: String(decision.due_at || '').trim(),
        recommended_option: String(decision.recommended_option || '').trim(),
        selected_option: String(decision.selected_option || '').trim(),
        rationale: String(decision.rationale || '').trim(),
        related_tasks: normalizeArray(decision.related_tasks),
        opened_at: String(decision.opened_at || '').trim(),
        resolved_at: String(decision.resolved_at || '').trim(),
    };
}

function nextDecisionId(decisions = []) {
    let max = 0;
    for (const decision of Array.isArray(decisions) ? decisions : []) {
        const match = String(decision?.id || '').match(/^DEC-(\d+)$/);
        if (!match) continue;
        max = Math.max(max, Number(match[1]));
    }
    return `DEC-${String(max + 1).padStart(3, '0')}`;
}

function summarizeDecisions(data = {}, options = {}) {
    const nowMs =
        options.now instanceof Date ? options.now.getTime() : Date.now();
    const decisions = (Array.isArray(data.decisions) ? data.decisions : [])
        .map((item) => normalizeDecision(item))
        .filter(Boolean);
    const summary = {
        total: decisions.length,
        open: 0,
        decided: 0,
        overdue: 0,
        expired: 0,
        by_focus: {},
    };
    for (const decision of decisions) {
        const status = String(decision.status || '');
        if (status === 'open') summary.open += 1;
        if (status === 'decided') summary.decided += 1;
        if (status === 'expired') summary.expired += 1;
        const dueMs = Date.parse(String(decision.due_at || ''));
        const overdue =
            status === 'open' && Number.isFinite(dueMs) && dueMs < nowMs;
        if (overdue) summary.overdue += 1;
        const focusId = String(decision.focus_id || '') || 'none';
        if (!summary.by_focus[focusId]) {
            summary.by_focus[focusId] = {
                total: 0,
                open: 0,
                overdue: 0,
            };
        }
        summary.by_focus[focusId].total += 1;
        if (status === 'open') summary.by_focus[focusId].open += 1;
        if (overdue) summary.by_focus[focusId].overdue += 1;
    }
    return summary;
}

module.exports = {
    normalizeDecision,
    nextDecisionId,
    summarizeDecisions,
};
