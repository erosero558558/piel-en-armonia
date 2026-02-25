'use strict';

function findCriticalScopeKeyword(scopeValue, criticalScopeKeywords = []) {
    const scope = String(scopeValue || '')
        .trim()
        .toLowerCase();
    if (!scope) return null;
    for (const keyword of criticalScopeKeywords) {
        if (scope.includes(String(keyword || '').toLowerCase())) {
            return String(keyword || '').toLowerCase();
        }
    }
    return null;
}

function validateTaskExecutorScopeGuard(task, options = {}) {
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : [];
    const allowedExecutors = options.allowedExecutors || new Set();

    const scope = String(task?.scope || '');
    const executor = String(task?.executor || '')
        .trim()
        .toLowerCase();
    const matchedKeyword = findCriticalScopeKeyword(
        scope,
        criticalScopeKeywords
    );
    if (!matchedKeyword) return;
    if (allowedExecutors.has(executor)) return;

    const allowed = Array.from(allowedExecutors).join(', ');
    throw new Error(
        `task critica (${scope}) no puede asignarse a executor ${executor}; permitidos: ${allowed}`
    );
}

function validateTaskDependsOn(board, task, options = {}) {
    const { allowSelf = false } = options;
    const taskId = String(task?.id || '').trim();
    const deps = Array.isArray(task?.depends_on) ? task.depends_on : [];
    const seen = new Set();
    const idsInBoard = new Set(
        (board?.tasks || []).map((item) => String(item.id || ''))
    );

    for (const rawDep of deps) {
        const dep = String(rawDep || '').trim();
        if (!dep) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on contiene valor vacio`
            );
        }
        if (!/^(AG|CDX)-\d+$/.test(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on invalido (${dep}), esperado AG-### o CDX-###`
            );
        }
        if (seen.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on duplicado (${dep})`
            );
        }
        seen.add(dep);
        if (!allowSelf && dep === taskId) {
            throw new Error(
                `task ${taskId}: depends_on no puede referenciarse a si misma`
            );
        }
        if (!idsInBoard.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on no existe en board (${dep})`
            );
        }
    }
}

function validateTaskGovernancePrechecks(board, task, options = {}) {
    validateTaskExecutorScopeGuard(task, options);
    validateTaskDependsOn(board, task, options);
}

module.exports = {
    findCriticalScopeKeyword,
    validateTaskExecutorScopeGuard,
    validateTaskDependsOn,
    validateTaskGovernancePrechecks,
};
