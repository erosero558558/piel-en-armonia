'use strict';

function parseExpectedRevisionFromFlags(flags = {}, parseExpectedFlag) {
    if (typeof parseExpectedFlag !== 'function') return null;
    const parsed = parseExpectedFlag(flags);
    if (parsed instanceof Error) throw parsed;
    return parsed;
}

function normalizeRevision(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function createDecisionsRevisionMismatchError(expected, actual) {
    const error = new Error(
        `decisions revision mismatch: expected ${expected}, actual ${actual}`
    );
    error.code = 'decisions_revision_mismatch';
    error.error_code = 'decisions_revision_mismatch';
    error.expected_revision = expected;
    error.actual_revision = actual;
    return error;
}

function parseCsvList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function readFlag(flags = {}, ...keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(flags, key)) continue;
        return String(flags[key] || '').trim();
    }
    return '';
}

async function handleDecisionCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        parseDecisions,
        writeDecisions,
        nextDecisionId,
        summarizeDecisions,
        currentDate,
        detectDefaultOwner,
        parseExpectedBoardRevisionFlag,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
    } = ctx;
    const wantsJson = args.includes('--json');
    const subcommand = String(args[0] || 'ls')
        .trim()
        .toLowerCase();
    const { flags, positionals } = parseFlags(args.slice(1));

    if (!['ls', 'open', 'close'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js decision <ls|open|close> [DEC-001] [--json]'
        );
    }

    const data =
        typeof parseDecisions === 'function'
            ? parseDecisions()
            : { version: 1, policy: { revision: 0 }, decisions: [] };

    if (subcommand === 'ls') {
        const payload = {
            version: 1,
            ok: true,
            command: 'decision',
            action: 'ls',
            decisions: Array.isArray(data.decisions) ? data.decisions : [],
            summary:
                typeof summarizeDecisions === 'function'
                    ? summarizeDecisions(data, { now: new Date() })
                    : null,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Decisions: total=${payload.summary?.total ?? 0} open=${payload.summary?.open ?? 0} overdue=${payload.summary?.overdue ?? 0}`
        );
        for (const decision of payload.decisions.slice(0, 20)) {
            console.log(
                `- ${decision.id} [${decision.status}] ${decision.title || 'sin titulo'}`
            );
        }
        return payload;
    }

    const expectedRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag
    );
    const currentRevision = normalizeRevision(data?.policy?.revision);
    if (
        expectedRevision !== null &&
        expectedRevision !== undefined &&
        normalizeRevision(expectedRevision) !== currentRevision
    ) {
        throw createDecisionsRevisionMismatchError(
            normalizeRevision(expectedRevision),
            currentRevision
        );
    }

    if (subcommand === 'open') {
        const board = parseBoard();
        const strategy = board?.strategy?.active || {};
        const title = readFlag(flags, 'title');
        if (!title) {
            throw new Error('decision open requiere --title');
        }
        const decision = {
            id:
                readFlag(flags, 'id') ||
                (typeof nextDecisionId === 'function'
                    ? nextDecisionId(data.decisions)
                    : `DEC-${String((data.decisions || []).length + 1).padStart(3, '0')}`),
            strategy_id:
                readFlag(flags, 'strategy-id', 'strategy_id') ||
                String(strategy.id || '').trim(),
            focus_id:
                readFlag(flags, 'focus-id', 'focus_id') ||
                String(strategy.focus_id || '').trim(),
            focus_step:
                readFlag(flags, 'focus-step', 'focus_step') ||
                String(strategy.focus_next_step || '').trim(),
            title,
            owner:
                readFlag(flags, 'owner') ||
                detectDefaultOwner() ||
                String(strategy.focus_owner || strategy.owner || '').trim() ||
                'ernesto',
            status: 'open',
            due_at:
                readFlag(flags, 'due-at', 'due_at') ||
                String(
                    strategy.focus_review_due_at || strategy.review_due_at || ''
                ).trim(),
            recommended_option: readFlag(
                flags,
                'recommended-option',
                'recommended_option'
            ),
            selected_option: '',
            rationale: readFlag(flags, 'rationale'),
            related_tasks: parseCsvList(
                readFlag(flags, 'related-tasks', 'related_tasks')
            ),
            opened_at: currentDate(),
            resolved_at: '',
        };
        if (!decision.due_at) {
            throw new Error(
                'decision open requiere --due-at o foco con review_due_at'
            );
        }
        data.policy = data.policy || {};
        data.decisions = Array.isArray(data.decisions) ? data.decisions : [];
        data.decisions.push(decision);
        writeDecisions(data, { expectRevision: expectedRevision });
        const payload = {
            version: 1,
            ok: true,
            command: 'decision',
            action: 'open',
            decision,
            policy: data.policy,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(`Decision open OK: ${decision.id}`);
        return payload;
    }

    const decisionId = String(positionals[0] || flags.id || '').trim();
    if (!decisionId) {
        throw new Error('decision close requiere decision_id');
    }
    const index = (
        Array.isArray(data.decisions) ? data.decisions : []
    ).findIndex((item) => String(item?.id || '').trim() === decisionId);
    if (index < 0) {
        throw new Error(`decision close: no existe ${decisionId}`);
    }
    const existing = data.decisions[index];
    const selectedOption =
        readFlag(flags, 'selected-option', 'selected_option') ||
        String(existing.recommended_option || '').trim();
    if (!selectedOption) {
        throw new Error(
            'decision close requiere --selected-option o recommended_option previo'
        );
    }
    data.decisions[index] = {
        ...existing,
        status: 'decided',
        selected_option: selectedOption,
        rationale:
            readFlag(flags, 'rationale') ||
            String(existing.rationale || '').trim(),
        resolved_at: currentDate(),
    };
    writeDecisions(data, { expectRevision: expectedRevision });
    const payload = {
        version: 1,
        ok: true,
        command: 'decision',
        action: 'close',
        decision: data.decisions[index],
        policy: data.policy,
    };
    if (wantsJson) {
        printJson(payload);
        return payload;
    }
    console.log(`Decision close OK: ${decisionId}`);
    return payload;
}

module.exports = {
    handleDecisionCommand,
};
