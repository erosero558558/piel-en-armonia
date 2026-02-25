'use strict';

const DEFAULT_ACTIVE_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);

function wildcardToRegex(pattern) {
    const escaped = String(pattern || '')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function normalizePathToken(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function hasWildcard(value) {
    return String(value || '').includes('*');
}

function analyzeFileOverlap(filesA, filesB) {
    const overlapFiles = new Set();
    let ambiguousWildcardOverlap = false;
    let anyOverlap = false;

    for (const rawA of filesA || []) {
        for (const rawB of filesB || []) {
            const a = normalizePathToken(rawA);
            const b = normalizePathToken(rawB);
            if (!a || !b) continue;

            if (a === b) {
                anyOverlap = true;
                overlapFiles.add(a);
                continue;
            }

            const aWild = hasWildcard(a);
            const bWild = hasWildcard(b);

            if (!aWild && bWild && wildcardToRegex(b).test(a)) {
                anyOverlap = true;
                overlapFiles.add(a);
                continue;
            }

            if (aWild && !bWild && wildcardToRegex(a).test(b)) {
                anyOverlap = true;
                overlapFiles.add(b);
                continue;
            }

            if (aWild && bWild) {
                // Pattern-vs-pattern overlap is conservatively treated as ambiguous.
                if (wildcardToRegex(a).test(b) || wildcardToRegex(b).test(a)) {
                    anyOverlap = true;
                    ambiguousWildcardOverlap = true;
                }
            }
        }
    }

    return {
        anyOverlap,
        ambiguousWildcardOverlap,
        overlapFiles: Array.from(overlapFiles).sort(),
    };
}

function filesOverlap(filesA, filesB) {
    return analyzeFileOverlap(filesA, filesB).anyOverlap;
}

function isExpired(dateValue) {
    const parsed = Date.parse(String(dateValue || ''));
    if (!Number.isFinite(parsed)) return true;
    return parsed <= Date.now();
}

function isActiveHandoff(handoff) {
    return (
        String(handoff?.status || '').toLowerCase() === 'active' &&
        !isExpired(handoff?.expires_at)
    );
}

function sameTaskPair(handoff, leftTask, rightTask) {
    const fromTask = String(handoff?.from_task || '');
    const toTask = String(handoff?.to_task || '');
    const leftId = String(leftTask?.id || '');
    const rightId = String(rightTask?.id || '');
    return (
        (fromTask === leftId && toTask === rightId) ||
        (fromTask === rightId && toTask === leftId)
    );
}

function analyzeConflicts(tasks, handoffs = [], options = {}) {
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    const activeTasks = (tasks || []).filter((task) =>
        activeStatuses.has(task.status)
    );
    const activeHandoffs = (handoffs || []).filter(isActiveHandoff);
    const all = [];
    const blocking = [];
    const handoffCovered = [];

    for (let i = 0; i < activeTasks.length; i++) {
        for (let j = i + 1; j < activeTasks.length; j++) {
            const left = activeTasks[i];
            const right = activeTasks[j];
            const overlap = analyzeFileOverlap(left.files, right.files);
            if (!overlap.anyOverlap) continue;

            const matchingHandoffs = activeHandoffs.filter((handoff) =>
                sameTaskPair(handoff, left, right)
            );
            const overlapSet = new Set(overlap.overlapFiles);
            const coveredFiles = new Set();

            for (const handoff of matchingHandoffs) {
                for (const rawFile of handoff.files || []) {
                    const file = normalizePathToken(rawFile);
                    if (overlapSet.has(file)) {
                        coveredFiles.add(file);
                    }
                }
            }

            const fullyCovered =
                !overlap.ambiguousWildcardOverlap &&
                overlap.overlapFiles.length > 0 &&
                overlap.overlapFiles.every((file) => coveredFiles.has(file));
            const leftLane = String(left?.domain_lane || '')
                .trim()
                .toLowerCase();
            const rightLane = String(right?.domain_lane || '')
                .trim()
                .toLowerCase();
            const leftInstance = String(left?.codex_instance || '')
                .trim()
                .toLowerCase();
            const rightInstance = String(right?.codex_instance || '')
                .trim()
                .toLowerCase();
            const crossLane =
                Boolean(leftLane && rightLane) && leftLane !== rightLane;
            const crossCodexInstance =
                Boolean(leftInstance && rightInstance) &&
                leftInstance !== rightInstance;

            const record = {
                left,
                right,
                left_lane: leftLane,
                right_lane: rightLane,
                left_codex_instance: leftInstance,
                right_codex_instance: rightInstance,
                cross_lane: crossLane,
                cross_codex_instance: crossCodexInstance,
                overlap_files: overlap.overlapFiles,
                ambiguous_wildcard_overlap: overlap.ambiguousWildcardOverlap,
                handoff_ids: matchingHandoffs.map((handoff) =>
                    String(handoff.id || '')
                ),
                exempted_by_handoff: fullyCovered,
            };

            all.push(record);
            if (fullyCovered) {
                handoffCovered.push(record);
            } else {
                blocking.push(record);
            }
        }
    }

    return { all, blocking, handoffCovered };
}

function detectConflicts(tasks, handoffs = [], options = {}) {
    return analyzeConflicts(tasks, handoffs, options).blocking;
}

function toConflictJsonRecord(item) {
    return {
        left: {
            id: String(item?.left?.id || ''),
            executor: String(item?.left?.executor || ''),
            status: String(item?.left?.status || ''),
            scope: String(item?.left?.scope || ''),
            codex_instance: String(item?.left?.codex_instance || ''),
            domain_lane: String(item?.left?.domain_lane || ''),
        },
        right: {
            id: String(item?.right?.id || ''),
            executor: String(item?.right?.executor || ''),
            status: String(item?.right?.status || ''),
            scope: String(item?.right?.scope || ''),
            codex_instance: String(item?.right?.codex_instance || ''),
            domain_lane: String(item?.right?.domain_lane || ''),
        },
        cross_lane: Boolean(item?.cross_lane),
        cross_codex_instance: Boolean(item?.cross_codex_instance),
        overlap_files: Array.isArray(item?.overlap_files)
            ? item.overlap_files
            : [],
        ambiguous_wildcard_overlap: Boolean(item?.ambiguous_wildcard_overlap),
        handoff_ids: Array.isArray(item?.handoff_ids) ? item.handoff_ids : [],
        exempted_by_handoff: Boolean(item?.exempted_by_handoff),
    };
}

module.exports = {
    DEFAULT_ACTIVE_STATUSES,
    wildcardToRegex,
    normalizePathToken,
    hasWildcard,
    analyzeFileOverlap,
    filesOverlap,
    isExpired,
    isActiveHandoff,
    sameTaskPair,
    analyzeConflicts,
    detectConflicts,
    toConflictJsonRecord,
};
