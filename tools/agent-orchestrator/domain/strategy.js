'use strict';

const domainFocus = require('./focus');

const ACTIVE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const DEFAULT_SLOT_TASK_STATUSES = new Set([
    'in_progress',
    'review',
    'blocked',
]);
const ALLOWED_STRATEGY_STATUSES = new Set(['draft', 'active', 'closed']);
const ALLOWED_STRATEGY_ROLES = new Set(['primary', 'support', 'exception']);
const ALLOWED_EXCEPTION_STATES = new Set(['open', 'regularized', 'expired']);
const DEFAULT_CODEX_INSTANCES = [
    'codex_backend_ops',
    'codex_frontend',
    'codex_transversal',
];
const DEFAULT_EXCEPTION_TTL_HOURS = 8;
const DEFAULT_AGED_TASK_HOURS = 24;
const STRATEGY_SEED_CATALOG_VERSION = '2026.03.28';
const STRATEGY_SEED_CATALOG = Object.freeze({
    'admin-operativo': Object.freeze({
        id: 'STRAT-2026-03-admin-operativo',
        title: 'Admin operativo',
        objective:
            'Convertir el frente admin clinico, queue/turnero y OpenClaw UX en una entrega operable y visible, con soporte backend y runtime estrictamente alineado.',
        owner_policy: 'detected_default_owner',
        review_due_at: '2026-03-21',
        exit_criteria: [
            'Admin clinico y queue/turnero navegables sin flujos rotos',
            'Auth/readiness/gates en verde para el frente activo',
            'Runtime OpenClaw solo usado como desbloqueo directo del mismo objetivo',
        ],
        success_signal:
            'Un mismo corte operativo puede demostrarse de punta a punta sin abrir trabajo fuera del frente admin operativo.',
        subfronts: [
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-admin-operativo',
                title: 'Admin clinico y shell principal',
                allowed_scopes: ['frontend-admin'],
                support_only_scopes: ['docs', 'frontend-qa'],
                blocked_scopes: ['payments'],
                wip_limit: 2,
                default_acceptance_profile: 'frontend_delivery_checkpoint',
                exception_ttl_hours: 8,
            },
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-queue-turnero-operativo',
                title: 'Queue, turnero y OpenClaw UX de soporte',
                allowed_scopes: ['queue', 'turnero'],
                support_only_scopes: ['docs', 'frontend-qa'],
                blocked_scopes: ['calendar'],
                wip_limit: 2,
                default_acceptance_profile: 'frontend_delivery_checkpoint',
                exception_ttl_hours: 8,
            },
            {
                codex_instance: 'codex_backend_ops',
                subfront_id: 'SF-backend-admin-operativo',
                title: 'Auth, readiness, gates y backend de soporte directo',
                allowed_scopes: ['auth', 'backend', 'readiness', 'gates'],
                support_only_scopes: ['deploy', 'ops', 'monitoring', 'tests'],
                blocked_scopes: ['frontend-public', 'security'],
                wip_limit: 2,
                default_acceptance_profile: 'backend_gate_checkpoint',
                exception_ttl_hours: 6,
            },
            {
                codex_instance: 'codex_transversal',
                subfront_id: 'SF-transversal-admin-operativo',
                title: 'Runtime/orquestacion solo como desbloqueo del frente',
                allowed_scopes: [],
                support_only_scopes: [
                    'openclaw_runtime',
                    'codex-governance',
                    'tooling',
                ],
                blocked_scopes: ['legacy-runtime'],
                wip_limit: 2,
                default_acceptance_profile: 'transversal_runtime_checkpoint',
                exception_ttl_hours: 4,
            },
        ],
    }),
    'turnero-web-pilot-local-first': Object.freeze({
        id: 'STRAT-2026-03-turnero-web-pilot-local-first',
        title: 'Turnero web pilot local-first',
        objective:
            'Reactivar queue/turnero como piloto web local-first por clinica, separando el carril web del bloqueo remoto/productivo y sin exigir desktop o Android como precondicion de salida local.',
        owner_policy: 'detected_default_owner',
        review_due_at: '2026-04-01',
        exit_criteria: [
            'El perfil de clinica acepta release.mode=web_pilot sin romper suite_v2 ni el schema v1',
            'Admin, operador, kiosco y sala leen web_pilot como piloto local valido y dejan desktop/Android como carriles diferidos',
            'El gate local de turnero vuelve a verde sin verify-remote, smoke prod ni dependencia de public_main_sync',
        ],
        success_signal:
            'Piel Armonia Quito puede operar el piloto web local por clinica con readiness, labels y gates locales consistentes, dejando native apps como fase posterior.',
        subfronts: [
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-turnero-web-pilot-local',
                title: 'Turnero web surfaces y canon UI local-first',
                allowed_scopes: ['queue', 'turnero'],
                support_only_scopes: ['frontend-admin', 'docs', 'frontend-qa'],
                blocked_scopes: ['frontend-public', 'payments', 'calendar'],
                wip_limit: 1,
                default_acceptance_profile: 'frontend_delivery_checkpoint',
                exception_ttl_hours: 8,
            },
            {
                codex_instance: 'codex_backend_ops',
                subfront_id: 'SF-backend-turnero-web-pilot-local',
                title: 'Perfil clinico, validadores y gates locales de turnero',
                allowed_scopes: ['backend', 'readiness', 'gates'],
                support_only_scopes: ['queue', 'turnero', 'tests', 'ops'],
                blocked_scopes: ['deploy', 'security', 'payments'],
                wip_limit: 1,
                default_acceptance_profile: 'backend_gate_checkpoint',
                exception_ttl_hours: 6,
            },
            {
                codex_instance: 'codex_transversal',
                subfront_id: 'SF-transversal-turnero-web-pilot-local',
                title: 'Soporte transversal eventual para el piloto web local',
                allowed_scopes: [],
                support_only_scopes: ['codex-governance', 'tooling'],
                blocked_scopes: ['openclaw_runtime', 'legacy-runtime'],
                wip_limit: 1,
                default_acceptance_profile: 'transversal_runtime_checkpoint',
                exception_ttl_hours: 4,
            },
        ],
    }),
    'turnero-web-pilot-multi-clinic-local': Object.freeze({
        id: 'STRAT-2026-03-turnero-web-pilot-multi-clinic-local',
        title: 'Turnero web pilot multi-clinic local',
        objective:
            'Habilitar una segunda clinica web_pilot catalogada dentro del carril local-first de turnero, manteniendo un perfil activo versionado unico y sin reabrir verify-remote ni blockers nativos.',
        owner_policy: 'detected_default_owner',
        review_due_at: '2026-04-04',
        exit_criteria: [
            'clinica-norte-demo valida y stagea como web_pilot sin cambiar el schema v1 ni reemplazar clinic-profile.json',
            'Admin e install hub muestran catalogo multi-clinica y readiness local para la segunda clinica sin blockers nativos o remotos',
            'Los gates locales de turnero permanecen en verde reutilizando los mismos required checks del frente web_pilot',
        ],
        success_signal:
            'Piel Armonia Quito sigue como perfil activo versionado y Clinica Norte Demo queda visible, stageable y local-ready como segunda clinica web_pilot.',
        subfronts: [
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-turnero-web-pilot-multi-clinic',
                title: 'Surfaces web y control tower multi-clinica local',
                allowed_scopes: ['queue', 'turnero'],
                support_only_scopes: ['docs', 'frontend-qa'],
                blocked_scopes: ['frontend-public', 'payments', 'calendar'],
                wip_limit: 1,
                default_acceptance_profile: 'frontend_delivery_checkpoint',
                exception_ttl_hours: 8,
            },
            {
                codex_instance: 'codex_backend_ops',
                subfront_id: 'SF-backend-turnero-web-pilot-multi-clinic',
                title: 'Contrato, CLI y catalogo multi-clinica local-first',
                allowed_scopes: ['backend', 'readiness', 'gates'],
                support_only_scopes: ['turnero', 'tests', 'ops'],
                blocked_scopes: ['deploy', 'security', 'payments'],
                wip_limit: 1,
                default_acceptance_profile: 'backend_gate_checkpoint',
                exception_ttl_hours: 6,
            },
            {
                codex_instance: 'codex_transversal',
                subfront_id: 'SF-transversal-turnero-web-pilot-multi-clinic',
                title: 'Soporte transversal eventual para la ola multi-clinica',
                allowed_scopes: [],
                support_only_scopes: ['codex-governance', 'tooling'],
                blocked_scopes: ['openclaw_runtime', 'legacy-runtime'],
                wip_limit: 1,
                default_acceptance_profile: 'transversal_runtime_checkpoint',
                exception_ttl_hours: 4,
            },
        ],
    }),
    'turnero-web-pilot': Object.freeze({
        id: 'STRAT-2026-03-turnero-web-pilot',
        title: 'Turnero web pilot',
        objective:
            'Reintroducir queue/turnero como piloto web remoto por clinica, con canon unico de surfaces web, readiness repo-side y validacion remota de salida.',
        owner_policy: 'detected_default_owner',
        review_due_at: '2026-04-04',
        exit_criteria: [
            'Admin basic, operador, kiosco y sala quedan alineados al mismo clinic-profile remoto por clinica',
            'Los gates locales del piloto web quedan en verde y la validacion remota de salida deja evidencia reproducible',
            'El release remoto se cierra en verde o el frente queda blocked con evidencia host-side actualizada y sin falso positivo',
        ],
        success_signal:
            'Una sola clinica canonica queda visible y operable en admin queue, operator, kiosk y display, con readiness remota verificable para el corte web.',
        subfronts: [
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-turnero-web-pilot',
                title: 'Turnero web surfaces por clinica',
                allowed_scopes: ['frontend-admin', 'queue', 'turnero'],
                support_only_scopes: ['docs', 'frontend-qa'],
                blocked_scopes: ['frontend-public', 'payments', 'calendar'],
                wip_limit: 1,
                default_acceptance_profile: 'frontend_delivery_checkpoint',
                exception_ttl_hours: 8,
            },
            {
                codex_instance: 'codex_backend_ops',
                subfront_id: 'SF-backend-turnero-web-pilot',
                title: 'Canon remoto, readiness y gates del piloto web',
                allowed_scopes: [
                    'backend',
                    'readiness',
                    'gates',
                    'deploy',
                    'ops',
                ],
                support_only_scopes: ['monitoring', 'tests'],
                blocked_scopes: [
                    'frontend-public',
                    'frontend-admin',
                    'payments',
                    'calendar',
                    'auth',
                ],
                wip_limit: 1,
                default_acceptance_profile: 'backend_gate_checkpoint',
                exception_ttl_hours: 6,
            },
            {
                codex_instance: 'codex_transversal',
                subfront_id: 'SF-transversal-turnero-web-pilot',
                title: 'Bootstrap y soporte eventual del piloto web remoto',
                allowed_scopes: [],
                support_only_scopes: [
                    'openclaw_runtime',
                    'codex-governance',
                    'tooling',
                ],
                blocked_scopes: [
                    'frontend-public',
                    'frontend-admin',
                    'backend',
                    'deploy',
                    'auth',
                    'queue',
                    'turnero',
                ],
                wip_limit: 1,
                default_acceptance_profile: 'transversal_runtime_checkpoint',
                exception_ttl_hours: 4,
            },
        ],
    }),
});

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function normalizeArray(values, options = {}) {
    const { lowerCase = false } = options;
    const list = Array.isArray(values) ? values : values ? [values] : [];
    const seen = new Set();
    const out = [];
    for (const rawValue of list) {
        const normalized = String(rawValue || '').trim();
        if (!normalized) continue;
        const value = lowerCase ? normalized.toLowerCase() : normalized;
        if (seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function normalizePositiveInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateMs(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatusesSet(statuses, fallbackStatuses) {
    const safeFallback = Array.from(
        fallbackStatuses || DEFAULT_SLOT_TASK_STATUSES
    ).map((value) => String(value || '').trim());
    const safeStatuses = Array.isArray(statuses)
        ? statuses
        : statuses instanceof Set
          ? Array.from(statuses)
          : [];
    const normalized = safeStatuses
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    return new Set(normalized.length > 0 ? normalized : safeFallback);
}

function normalizeLaneCapacities(laneCapacities, options = {}) {
    const safeDefaults = options.defaults || {};
    const normalized = {};
    for (const codexInstance of DEFAULT_CODEX_INSTANCES) {
        const fallback = normalizePositiveInt(safeDefaults[codexInstance], 0);
        const requested = normalizePositiveInt(
            laneCapacities?.[codexInstance],
            fallback
        );
        normalized[codexInstance] = requested > 0 ? requested : fallback;
    }
    return normalized;
}

function addHoursIso(baseValue, hours) {
    const baseMs = parseDateMs(baseValue);
    if (baseMs === null) return '';
    const deltaHours = Number(hours);
    if (!Number.isFinite(deltaHours) || deltaHours <= 0) return '';
    return new Date(baseMs + deltaHours * 60 * 60 * 1000).toISOString();
}

function normalizeStrategySubfront(subfront) {
    if (!subfront || typeof subfront !== 'object') return null;
    return {
        codex_instance: normalizeOptionalToken(subfront.codex_instance),
        subfront_id: String(subfront.subfront_id || '').trim(),
        title: String(subfront.title || '').trim(),
        allowed_scopes: normalizeArray(subfront.allowed_scopes, {
            lowerCase: true,
        }),
        support_only_scopes: normalizeArray(subfront.support_only_scopes, {
            lowerCase: true,
        }),
        blocked_scopes: normalizeArray(subfront.blocked_scopes, {
            lowerCase: true,
        }),
        wip_limit: normalizePositiveInt(subfront.wip_limit, 1),
        default_acceptance_profile: String(
            subfront.default_acceptance_profile || ''
        ).trim(),
        exception_ttl_hours: normalizePositiveInt(
            subfront.exception_ttl_hours,
            DEFAULT_EXCEPTION_TTL_HOURS
        ),
    };
}

function normalizeStrategyRecord(strategy) {
    if (!strategy || typeof strategy !== 'object') return null;
    const focusSeed = domainFocus.normalizeStrategyFocus(strategy) || {};
    return {
        id: String(strategy.id || '').trim(),
        title: String(strategy.title || '').trim(),
        objective: String(strategy.objective || '').trim(),
        owner: String(strategy.owner || '').trim(),
        owner_policy: String(strategy.owner_policy || '').trim(),
        status: normalizeOptionalToken(strategy.status),
        started_at: String(strategy.started_at || '').trim(),
        review_due_at: String(strategy.review_due_at || '').trim(),
        closed_at: String(strategy.closed_at || '').trim(),
        close_reason: String(strategy.close_reason || '').trim(),
        exit_criteria: normalizeArray(strategy.exit_criteria),
        success_signal: String(strategy.success_signal || '').trim(),
        focus_id: String(focusSeed.id || strategy.focus_id || '').trim(),
        focus_title: String(
            focusSeed.title || strategy.focus_title || ''
        ).trim(),
        focus_summary: String(
            focusSeed.summary || strategy.focus_summary || ''
        ).trim(),
        focus_status: normalizeOptionalToken(
            focusSeed.status || strategy.focus_status
        ),
        focus_proof: String(
            focusSeed.proof || strategy.focus_proof || ''
        ).trim(),
        focus_steps: normalizeArray(focusSeed.steps || strategy.focus_steps),
        focus_next_step: String(
            focusSeed.next_step || strategy.focus_next_step || ''
        ).trim(),
        focus_required_checks: normalizeArray(
            focusSeed.required_checks || strategy.focus_required_checks,
            { lowerCase: true }
        ),
        focus_non_goals: normalizeArray(
            focusSeed.non_goals || strategy.focus_non_goals
        ),
        focus_owner: String(
            focusSeed.owner || strategy.focus_owner || ''
        ).trim(),
        focus_review_due_at: String(
            focusSeed.review_due_at || strategy.focus_review_due_at || ''
        ).trim(),
        focus_evidence_ref: String(
            focusSeed.evidence_ref || strategy.focus_evidence_ref || ''
        ).trim(),
        focus_max_active_slices:
            Number.parseInt(
                String(
                    focusSeed.max_active_slices ||
                        strategy.focus_max_active_slices ||
                        '3'
                ),
                10
            ) || 3,
        subfronts: (Array.isArray(strategy.subfronts) ? strategy.subfronts : [])
            .map((subfront) => normalizeStrategySubfront(subfront))
            .filter(Boolean),
    };
}

function normalizeStrategyActive(strategy) {
    return normalizeStrategyRecord(strategy);
}

function normalizeTaskStrategyFields(task) {
    if (!task || typeof task !== 'object') return task;
    task.strategy_id = String(task.strategy_id || '').trim();
    task.subfront_id = String(task.subfront_id || '').trim();
    task.strategy_role = normalizeOptionalToken(task.strategy_role);
    task.strategy_reason = String(task.strategy_reason || '').trim();
    task.exception_opened_at = String(task.exception_opened_at || '').trim();
    task.exception_expires_at = String(task.exception_expires_at || '').trim();
    task.exception_state = normalizeOptionalToken(task.exception_state);
    return task;
}

function getConfiguredStrategy(board) {
    return normalizeStrategyRecord(board?.strategy?.active || null);
}

function getConfiguredNextStrategy(board) {
    return normalizeStrategyRecord(board?.strategy?.next || null);
}

function getActiveStrategy(board) {
    const strategy = getConfiguredStrategy(board);
    if (!strategy || strategy.status !== 'active') return null;
    return strategy;
}

function getNextStrategy(board) {
    return getConfiguredNextStrategy(board);
}

function getSubfrontById(strategy, subfrontId) {
    const safeStrategy = strategy || {};
    const safeSubfrontId = String(subfrontId || '').trim();
    if (!safeSubfrontId) return null;
    return (
        (Array.isArray(safeStrategy.subfronts)
            ? safeStrategy.subfronts
            : []
        ).find(
            (subfront) =>
                String(subfront?.subfront_id || '').trim() === safeSubfrontId
        ) || null
    );
}

function getSubfrontByCodexInstance(strategy, codexInstance) {
    const safeStrategy = strategy || {};
    const safeCodexInstance = normalizeOptionalToken(codexInstance);
    if (!safeCodexInstance) return null;
    const matches = (
        Array.isArray(safeStrategy.subfronts) ? safeStrategy.subfronts : []
    ).filter(
        (subfront) =>
            normalizeOptionalToken(subfront?.codex_instance) ===
            safeCodexInstance
    );
    return matches.length === 1 ? matches[0] : null;
}

function getTaskSubfront(strategy, task) {
    const byId = getSubfrontById(strategy, task?.subfront_id);
    if (byId) return byId;
    return getSubfrontByCodexInstance(strategy, task?.codex_instance);
}

function createStrategyError(taskId, code, message) {
    const error = new Error(`task ${taskId}: ${message}`);
    error.code = code;
    error.error_code = code;
    return error;
}

function collectScopeOwnershipConflicts(strategy) {
    const safeStrategy = normalizeStrategyRecord(strategy);
    if (!safeStrategy) return [];
    const ownershipClaims = new Map();
    const blockedScopes = new Map();
    const errors = [];

    for (const subfront of safeStrategy.subfronts) {
        const localScopes = new Map();
        for (const [bucket, scopes] of [
            ['allowed_scopes', subfront.allowed_scopes],
            ['support_only_scopes', subfront.support_only_scopes],
            ['blocked_scopes', subfront.blocked_scopes],
        ]) {
            for (const scope of scopes) {
                if (localScopes.has(scope)) {
                    errors.push(
                        `${safeStrategy.id}: subfront ${subfront.subfront_id} repite scope ${scope} entre ${localScopes.get(scope)} y ${bucket}`
                    );
                    continue;
                }
                localScopes.set(scope, bucket);
            }
        }

        for (const [bucket, scopes] of [
            ['allowed_scopes', subfront.allowed_scopes],
            ['support_only_scopes', subfront.support_only_scopes],
            ['blocked_scopes', subfront.blocked_scopes],
        ]) {
            for (const scope of scopes) {
                if (bucket === 'blocked_scopes') {
                    const currentClaims = ownershipClaims.get(scope) || [];
                    for (const owner of currentClaims) {
                        if (owner.codex_instance !== subfront.codex_instance) {
                            continue;
                        }
                        errors.push(
                            `${safeStrategy.id}: scope ${scope} asignado de forma ambigua a ${owner.subfront_id} y ${subfront.subfront_id}`
                        );
                    }
                    const currentBlocked = blockedScopes.get(scope) || [];
                    currentBlocked.push({
                        subfront_id: subfront.subfront_id,
                        codex_instance: subfront.codex_instance,
                        bucket,
                    });
                    blockedScopes.set(scope, currentBlocked);
                    continue;
                }

                const currentOwners = ownershipClaims.get(scope) || [];
                const currentBlocked = blockedScopes.get(scope) || [];
                for (const blockedOwner of currentBlocked) {
                    if (
                        blockedOwner.codex_instance !== subfront.codex_instance
                    ) {
                        continue;
                    }
                    errors.push(
                        `${safeStrategy.id}: scope ${scope} asignado de forma ambigua a ${blockedOwner.subfront_id} y ${subfront.subfront_id}`
                    );
                }
                currentOwners.push({
                    subfront_id: subfront.subfront_id,
                    codex_instance: subfront.codex_instance,
                    bucket,
                });
                ownershipClaims.set(scope, currentOwners);
            }
        }
    }

    return errors;
}

function getExceptionTtlHours(subfront) {
    return normalizePositiveInt(
        subfront?.exception_ttl_hours,
        DEFAULT_EXCEPTION_TTL_HOURS
    );
}

function resolveTaskExceptionState(task, subfront, options = {}) {
    const nowIso =
        String(options.nowIso || '').trim() || new Date().toISOString();
    const nowMs = parseDateMs(nowIso) || Date.now();
    const role = normalizeOptionalToken(task?.strategy_role);

    if (role !== 'exception') {
        if (
            String(task?.exception_opened_at || '').trim() ||
            String(task?.exception_expires_at || '').trim() ||
            normalizeOptionalToken(task?.exception_state)
        ) {
            task.exception_state = 'regularized';
        } else {
            task.exception_state = '';
        }
        return task;
    }

    if (!task.exception_opened_at) {
        task.exception_opened_at = nowIso;
    }
    if (!task.exception_expires_at) {
        task.exception_expires_at = addHoursIso(
            task.exception_opened_at,
            getExceptionTtlHours(subfront)
        );
    }

    const expiresMs = parseDateMs(task.exception_expires_at);
    const explicitState = normalizeOptionalToken(task.exception_state);
    if (explicitState === 'regularized') {
        task.exception_state = 'regularized';
        return task;
    }
    if (expiresMs !== null && expiresMs <= nowMs) {
        task.exception_state = 'expired';
    } else {
        task.exception_state = 'open';
    }
    return task;
}

function isReleasePromotionExceptionTask(task) {
    if (!task || typeof task !== 'object') return false;
    return (
        normalizeOptionalToken(task.strategy_role) === 'exception' &&
        String(task.strategy_reason || '').trim() ===
            'validated_release_promotion' &&
        String(task.status || '').trim() === 'review' &&
        normalizeOptionalToken(task.work_type) === 'evidence' &&
        normalizeOptionalToken(task.integration_slice) ===
            'governance_evidence' &&
        normalizeOptionalToken(task.executor) === 'codex'
    );
}

function ensureTaskStrategyDefaults(board, task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    normalizeTaskStrategyFields(task);
    const activeStrategy = normalizeStrategyRecord(
        options.strategy || getActiveStrategy(board)
    );
    if (!activeStrategy) return task;
    const status = String(task.status || '').trim();
    if (!activeStatuses.has(status)) return task;

    if (!task.strategy_id) {
        task.strategy_id = activeStrategy.id;
    }

    const subfront =
        getSubfrontById(activeStrategy, task.subfront_id) ||
        getSubfrontByCodexInstance(activeStrategy, task.codex_instance);
    if (!task.subfront_id && subfront) {
        task.subfront_id = subfront.subfront_id;
    }

    const resolvedSubfront =
        subfront ||
        getSubfrontById(activeStrategy, task.subfront_id) ||
        getSubfrontByCodexInstance(activeStrategy, task.codex_instance);
    const scope = normalizeOptionalToken(task.scope);
    if (!task.strategy_role && resolvedSubfront) {
        if (task.strategy_reason) {
            task.strategy_role = 'exception';
        } else if (resolvedSubfront.support_only_scopes.includes(scope)) {
            task.strategy_role = 'support';
        } else if (resolvedSubfront.allowed_scopes.includes(scope)) {
            task.strategy_role = 'primary';
        }
    }

    if (resolvedSubfront) {
        resolveTaskExceptionState(task, resolvedSubfront, options);
    }
    return task;
}

function validateStrategyRecord(strategy, options = {}) {
    const {
        label = 'strategy',
        allowedCodexInstances = DEFAULT_CODEX_INSTANCES,
        requireExactCodexInstances = true,
        allowClosed = true,
    } = options;
    const safeStrategy = normalizeStrategyRecord(strategy);
    if (!safeStrategy) return [];

    const errors = [];
    if (!safeStrategy.id) errors.push(`${label} requiere id`);
    if (!safeStrategy.title) errors.push(`${label} requiere title`);
    if (!safeStrategy.objective) errors.push(`${label} requiere objective`);
    if (!safeStrategy.owner) errors.push(`${label} requiere owner`);
    if (!safeStrategy.owner_policy) {
        errors.push(`${label} requiere owner_policy`);
    }
    if (!ALLOWED_STRATEGY_STATUSES.has(safeStrategy.status)) {
        errors.push(
            `${label} tiene status invalido (${safeStrategy.status || 'vacio'})`
        );
    }
    if (!allowClosed && safeStrategy.status === 'closed') {
        errors.push(`${label} no permite status=closed`);
    }
    if (!safeStrategy.started_at) {
        errors.push(`${label} requiere started_at`);
    }
    if (!safeStrategy.review_due_at) {
        errors.push(`${label} requiere review_due_at`);
    }
    if (safeStrategy.exit_criteria.length === 0) {
        errors.push(`${label} requiere exit_criteria no vacio`);
    }
    if (!safeStrategy.success_signal) {
        errors.push(`${label} requiere success_signal`);
    }
    errors.push(
        ...domainFocus
            .validateFocusConfiguration({ strategy: { active: safeStrategy } })
            .filter(Boolean)
    );

    const seenSubfrontIds = new Set();
    const instanceCounts = {};
    for (const subfront of safeStrategy.subfronts) {
        if (!subfront.subfront_id) {
            errors.push(`${label}.subfronts requiere subfront_id`);
        }
        if (!subfront.codex_instance) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} requiere codex_instance`
            );
        } else if (!allowedCodexInstances.includes(subfront.codex_instance)) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} tiene codex_instance invalido (${subfront.codex_instance})`
            );
        }
        if (!subfront.title) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} requiere title`
            );
        }
        if (subfront.wip_limit <= 0) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} requiere wip_limit > 0`
            );
        }
        if (!subfront.default_acceptance_profile) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} requiere default_acceptance_profile`
            );
        }
        if (subfront.exception_ttl_hours <= 0) {
            errors.push(
                `${label}.subfront ${subfront.subfront_id || '(sin id)'} requiere exception_ttl_hours > 0`
            );
        }
        if (subfront.subfront_id) {
            if (seenSubfrontIds.has(subfront.subfront_id)) {
                errors.push(
                    `${label} duplica subfront_id (${subfront.subfront_id})`
                );
            }
            seenSubfrontIds.add(subfront.subfront_id);
        }
        if (subfront.codex_instance) {
            instanceCounts[subfront.codex_instance] =
                Number(instanceCounts[subfront.codex_instance] || 0) + 1;
        }
    }

    if (requireExactCodexInstances) {
        for (const codexInstance of allowedCodexInstances) {
            const count = Number(instanceCounts[codexInstance] || 0);
            if (count < 1) {
                errors.push(
                    `${label} requiere al menos un subfront para ${codexInstance} (actual: ${count})`
                );
            }
        }
    }

    errors.push(...collectScopeOwnershipConflicts(safeStrategy));
    return errors;
}

function validateStrategyConfiguration(board, options = {}) {
    const errors = [];
    const activeStrategy = getConfiguredStrategy(board);
    const nextStrategy = getConfiguredNextStrategy(board);
    const safeUpdatedAt = String(board?.strategy?.updated_at || '').trim();
    if ((activeStrategy || nextStrategy) && !safeUpdatedAt) {
        errors.push('strategy requiere updated_at');
    }
    if (activeStrategy) {
        errors.push(
            ...validateStrategyRecord(activeStrategy, {
                ...options,
                label: 'strategy.active',
            })
        );
    }
    if (nextStrategy) {
        errors.push(
            ...validateStrategyRecord(nextStrategy, {
                ...options,
                label: 'strategy.next',
                allowClosed: false,
            })
        );
        if (nextStrategy.status !== 'draft') {
            errors.push(
                `strategy.next requiere status=draft (actual: ${nextStrategy.status || 'vacio'})`
            );
        }
    }
    return errors;
}

function validateTaskStrategyAlignment(board, task, options = {}) {
    ensureTaskStrategyDefaults(board, task, options);
    const strategy = normalizeStrategyRecord(
        options.strategy || getActiveStrategy(board)
    );
    if (!strategy) return null;

    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const status = String(task?.status || '').trim();
    if (!activeStatuses.has(status)) return null;

    const taskId = String(task?.id || '(sin id)').trim();
    const scope = normalizeOptionalToken(task?.scope);
    const role = normalizeOptionalToken(task?.strategy_role);

    if (!task.strategy_id) {
        throw createStrategyError(
            taskId,
            'strategy_id_required',
            `estrategia activa requiere strategy_id=${strategy.id}`
        );
    }
    if (task.strategy_id !== strategy.id) {
        throw createStrategyError(
            taskId,
            'strategy_id_mismatch',
            `strategy_id desalineado (${task.strategy_id} != ${strategy.id})`
        );
    }
    if (!task.subfront_id) {
        throw createStrategyError(
            taskId,
            'subfront_required',
            'estrategia activa requiere subfront_id'
        );
    }

    const subfront = getSubfrontById(strategy, task.subfront_id);
    if (!subfront) {
        throw createStrategyError(
            taskId,
            'subfront_invalid',
            `subfront_id invalido para estrategia activa (${task.subfront_id})`
        );
    }

    if (
        normalizeOptionalToken(task?.codex_instance) !== subfront.codex_instance
    ) {
        throw createStrategyError(
            taskId,
            'codex_instance_mismatch',
            `subfront ${subfront.subfront_id} requiere codex_instance=${subfront.codex_instance}`
        );
    }

    if (!ALLOWED_STRATEGY_ROLES.has(role)) {
        throw createStrategyError(
            taskId,
            'strategy_role_invalid',
            `strategy_role invalido (${role || 'vacio'})`
        );
    }

    const isReleasePromotionException = isReleasePromotionExceptionTask(task);
    if (
        subfront.blocked_scopes.includes(scope) &&
        !isReleasePromotionException
    ) {
        throw createStrategyError(
            taskId,
            'scope_blocked',
            `scope bloqueado por subfrente (${scope || 'vacio'})`
        );
    }

    const inAllowedScopes = subfront.allowed_scopes.includes(scope);
    const inSupportOnlyScopes = subfront.support_only_scopes.includes(scope);

    if (role === 'exception') {
        if (!String(task.strategy_reason || '').trim()) {
            throw createStrategyError(
                taskId,
                'strategy_reason_required',
                'strategy_role=exception requiere strategy_reason'
            );
        }
        if (isReleasePromotionException) {
            return { strategy, subfront };
        }
        resolveTaskExceptionState(task, subfront, options);
        if (!ALLOWED_EXCEPTION_STATES.has(task.exception_state)) {
            throw createStrategyError(
                taskId,
                'exception_state_invalid',
                `exception_state invalido (${task.exception_state || 'vacio'})`
            );
        }
        if (!task.exception_opened_at || !task.exception_expires_at) {
            throw createStrategyError(
                taskId,
                'exception_window_missing',
                'strategy_role=exception requiere ventana exception_opened_at/exception_expires_at'
            );
        }
        return { strategy, subfront };
    }

    if (inSupportOnlyScopes && role !== 'support') {
        throw createStrategyError(
            taskId,
            'support_role_required',
            `scope ${scope || 'vacio'} requiere strategy_role=support`
        );
    }
    if (inAllowedScopes && role !== 'primary') {
        throw createStrategyError(
            taskId,
            'primary_role_required',
            `scope ${scope || 'vacio'} requiere strategy_role=primary`
        );
    }
    if (!inAllowedScopes && !inSupportOnlyScopes) {
        throw createStrategyError(
            taskId,
            'scope_outside_subfront',
            `scope ${scope || 'vacio'} fuera del subfrente ${subfront.subfront_id}`
        );
    }

    return { strategy, subfront };
}

function cloneActiveTask(originalTask) {
    return {
        ...originalTask,
        files: Array.isArray(originalTask?.files)
            ? [...originalTask.files]
            : [],
        depends_on: Array.isArray(originalTask?.depends_on)
            ? [...originalTask.depends_on]
            : [],
    };
}

function getTaskAgeHours(task, nowMs) {
    const baseValue =
        String(task?.status_since_at || '').trim() ||
        String(task?.updated_at || '').trim();
    const baseMs = parseDateMs(baseValue);
    if (baseMs === null) return null;
    return (nowMs - baseMs) / (1000 * 60 * 60);
}

function buildEmptyStrategySummary(board, activeStrategy, nextStrategy) {
    return {
        configured: getConfiguredStrategy(board),
        active: activeStrategy,
        next: nextStrategy,
        updated_at: String(board?.strategy?.updated_at || '').trim(),
        active_tasks_total: 0,
        slot_tasks: 0,
        aligned_tasks: 0,
        primary_tasks: 0,
        support_tasks: 0,
        exception_tasks: 0,
        exception_open_tasks: 0,
        exception_expired_tasks: 0,
        orphan_tasks: 0,
        scope_outside_subfront_tasks: 0,
        aged_tasks: 0,
        orphan_task_ids: [],
        exception_task_ids: [],
        exception_open_task_ids: [],
        exception_expired_task_ids: [],
        aligned_task_ids: [],
        aged_task_ids: [],
        scope_outside_subfront_task_ids: [],
        validation_errors: [],
        scope_collisions: activeStrategy
            ? collectScopeOwnershipConflicts(activeStrategy)
            : [],
        wip_overflow_total: 0,
        wip_limited_subfronts: 0,
        dispersion_score: 0,
        lane_capacity: {},
        available_slots: {},
        subfront_count: Array.isArray(activeStrategy?.subfronts)
            ? activeStrategy.subfronts.length
            : 0,
        lane_rows: [],
        rows: [],
    };
}

function finalizeStrategyRows(rowsMap) {
    const rows = Array.from(rowsMap.values());
    for (const row of rows) {
        row.available_slots = Math.max(0, row.wip_limit - row.slot_tasks);
        row.overflow = Math.max(0, row.slot_tasks - row.wip_limit);
        row.exceeds_wip_limit = row.overflow > 0;
    }
    return rows;
}

function buildLaneRows(rows, laneCapacities) {
    const rowsByLane = new Map();
    for (const codexInstance of DEFAULT_CODEX_INSTANCES) {
        rowsByLane.set(codexInstance, {
            codex_instance: codexInstance,
            subfront_count: 0,
            active_tasks: 0,
            slot_tasks: 0,
            aligned_tasks: 0,
            primary_tasks: 0,
            support_tasks: 0,
            exception_tasks: 0,
            exception_open_tasks: 0,
            exception_expired_tasks: 0,
            orphan_tasks: 0,
            aged_tasks: 0,
            lane_capacity: normalizePositiveInt(
                laneCapacities?.[codexInstance],
                0
            ),
            available_slots: 0,
            overflow: 0,
            exceeds_lane_capacity: false,
        });
    }

    for (const row of rows) {
        const laneRow =
            rowsByLane.get(String(row.codex_instance || '').trim()) || null;
        if (!laneRow) continue;
        laneRow.subfront_count += 1;
        laneRow.active_tasks += Number(row.active_tasks || 0);
        laneRow.slot_tasks += Number(row.slot_tasks || 0);
        laneRow.aligned_tasks += Number(row.aligned_tasks || 0);
        laneRow.primary_tasks += Number(row.primary_tasks || 0);
        laneRow.support_tasks += Number(row.support_tasks || 0);
        laneRow.exception_tasks += Number(row.exception_tasks || 0);
        laneRow.exception_open_tasks += Number(row.exception_open_tasks || 0);
        laneRow.exception_expired_tasks += Number(
            row.exception_expired_tasks || 0
        );
        laneRow.orphan_tasks += Number(row.orphan_tasks || 0);
        laneRow.aged_tasks += Number(row.aged_tasks || 0);
    }

    const laneRows = Array.from(rowsByLane.values());
    for (const row of laneRows) {
        row.available_slots = Math.max(0, row.lane_capacity - row.slot_tasks);
        row.overflow = Math.max(0, row.slot_tasks - row.lane_capacity);
        row.exceeds_lane_capacity = row.overflow > 0;
    }
    return laneRows;
}

function buildCoverageForStrategy(board, strategy, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const slotStatuses = normalizeStatusesSet(
        options.slotStatuses,
        DEFAULT_SLOT_TASK_STATUSES
    );
    const laneCapacities = normalizeLaneCapacities(options.laneCapacities, {
        defaults: Object.fromEntries(
            DEFAULT_CODEX_INSTANCES.map((codexInstance) => [codexInstance, 2])
        ),
    });
    const agedThresholdHours = Number(
        options.agedTaskHours || DEFAULT_AGED_TASK_HOURS
    );
    const nowIso =
        String(options.nowIso || '').trim() || new Date().toISOString();
    const nowMs = parseDateMs(nowIso) || Date.now();
    const safeStrategy = normalizeStrategyRecord(strategy);
    const rows = new Map();
    for (const subfront of safeStrategy?.subfronts || []) {
        rows.set(subfront.subfront_id, {
            codex_instance: subfront.codex_instance,
            subfront_id: subfront.subfront_id,
            title: subfront.title,
            wip_limit: subfront.wip_limit,
            default_acceptance_profile:
                subfront.default_acceptance_profile || '',
            exception_ttl_hours: subfront.exception_ttl_hours,
            active_tasks: 0,
            slot_tasks: 0,
            aligned_tasks: 0,
            primary_tasks: 0,
            support_tasks: 0,
            exception_tasks: 0,
            exception_open_tasks: 0,
            exception_expired_tasks: 0,
            orphan_tasks: 0,
            aged_tasks: 0,
            aged_task_ids: [],
        });
    }

    const summary = buildEmptyStrategySummary(board, safeStrategy, null);
    summary.configured = safeStrategy;
    summary.active = safeStrategy?.status === 'active' ? safeStrategy : null;
    summary.scope_collisions = safeStrategy
        ? collectScopeOwnershipConflicts(safeStrategy)
        : [];
    summary.lane_capacity = laneCapacities;
    summary.subfront_count = Array.isArray(safeStrategy?.subfronts)
        ? safeStrategy.subfronts.length
        : 0;

    if (!safeStrategy) {
        return summary;
    }

    const activeTasks = Array.isArray(board?.tasks)
        ? board.tasks.filter((task) =>
              activeStatuses.has(String(task?.status || '').trim())
          )
        : [];
    summary.active_tasks_total = activeTasks.length;

    for (const originalTask of activeTasks) {
        const task = cloneActiveTask(originalTask);
        ensureTaskStrategyDefaults(board, task, {
            ...options,
            activeStatuses,
            strategy: safeStrategy,
            nowIso,
        });

        const explicitSubfrontId = String(task.subfront_id || '').trim();
        const resolvedSubfront = explicitSubfrontId
            ? getSubfrontById(safeStrategy, explicitSubfrontId)
            : getSubfrontByCodexInstance(safeStrategy, task.codex_instance);
        const row = resolvedSubfront
            ? rows.get(resolvedSubfront.subfront_id) || null
            : null;
        const consumesSlot = slotStatuses.has(String(task.status || '').trim());
        if (consumesSlot) {
            summary.slot_tasks += 1;
        }
        if (row) {
            row.active_tasks += 1;
            if (consumesSlot) {
                row.slot_tasks += 1;
            }
        }

        const ageHours = getTaskAgeHours(task, nowMs);
        if (
            row &&
            ageHours !== null &&
            Number.isFinite(ageHours) &&
            ageHours > agedThresholdHours
        ) {
            row.aged_tasks += 1;
            row.aged_task_ids.push(String(task.id || ''));
            summary.aged_tasks += 1;
            summary.aged_task_ids.push(String(task.id || ''));
        }

        try {
            validateTaskStrategyAlignment(board, task, {
                ...options,
                activeStatuses,
                strategy: safeStrategy,
                nowIso,
            });
            summary.aligned_tasks += 1;
            summary.aligned_task_ids.push(String(task.id || ''));
            if (row) {
                row.aligned_tasks += 1;
            }
            if (task.strategy_role === 'exception') {
                summary.exception_tasks += 1;
                summary.exception_task_ids.push(String(task.id || ''));
                if (row) row.exception_tasks += 1;
                if (task.exception_state === 'expired') {
                    summary.exception_expired_tasks += 1;
                    summary.exception_expired_task_ids.push(
                        String(task.id || '')
                    );
                    if (row) row.exception_expired_tasks += 1;
                } else {
                    summary.exception_open_tasks += 1;
                    summary.exception_open_task_ids.push(String(task.id || ''));
                    if (row) row.exception_open_tasks += 1;
                }
            } else if (task.strategy_role === 'support') {
                summary.support_tasks += 1;
                if (row) row.support_tasks += 1;
            } else {
                summary.primary_tasks += 1;
                if (row) row.primary_tasks += 1;
            }
        } catch (error) {
            summary.orphan_tasks += 1;
            summary.orphan_task_ids.push(String(task.id || ''));
            summary.validation_errors.push(String(error.message || error));
            if (String(error?.code || '') === 'scope_outside_subfront') {
                summary.scope_outside_subfront_tasks += 1;
                summary.scope_outside_subfront_task_ids.push(
                    String(task.id || '')
                );
            }
            if (row) {
                row.orphan_tasks += 1;
            }
        }
    }

    summary.rows = finalizeStrategyRows(rows);
    summary.lane_rows = buildLaneRows(summary.rows, laneCapacities);
    summary.available_slots = summary.lane_rows.reduce((acc, row) => {
        acc[row.codex_instance] = row.available_slots;
        return acc;
    }, {});
    summary.wip_overflow_total = summary.rows.reduce(
        (acc, row) => acc + Number(row.overflow || 0),
        0
    );
    summary.wip_limited_subfronts = summary.rows.filter(
        (row) => row.exceeds_wip_limit
    ).length;
    summary.dispersion_score = Math.min(
        100,
        summary.orphan_tasks * 35 +
            summary.scope_outside_subfront_tasks * 20 +
            summary.exception_open_tasks * 8 +
            summary.exception_expired_tasks * 20 +
            summary.wip_overflow_total * 12
    );
    return summary;
}

function buildStrategyCoverageSummary(board, options = {}) {
    const activeStrategy = getActiveStrategy(board);
    const nextStrategy = getNextStrategy(board);
    const summary = buildCoverageForStrategy(board, activeStrategy, options);
    summary.configured = getConfiguredStrategy(board);
    summary.active = activeStrategy;
    summary.next = nextStrategy;
    summary.updated_at = String(board?.strategy?.updated_at || '').trim();
    return summary;
}

function buildStrategySeedCatalog() {
    return {
        version: STRATEGY_SEED_CATALOG_VERSION,
        seeds: Object.entries(STRATEGY_SEED_CATALOG).map(([seedKey, seed]) => ({
            seed_key: seedKey,
            ...seed,
        })),
    };
}

function buildStrategySeed(seedNameRaw, options = {}) {
    const currentDate = options.currentDate || (() => '');
    const owner =
        String(options.owner || '').trim() ||
        String(options.detectDefaultOwner?.() || '').trim() ||
        'ernesto';
    const today = String(currentDate()).trim() || '2026-03-14';
    const seedKey = normalizeOptionalToken(seedNameRaw);
    const seed = STRATEGY_SEED_CATALOG[seedKey];
    if (!seed) {
        throw new Error(
            `strategy seed invalido (${seedNameRaw || 'vacio'}); disponibles: ${Object.keys(
                STRATEGY_SEED_CATALOG
            ).join(', ')}`
        );
    }
    const mode = normalizeOptionalToken(options.mode) || 'active';
    const status = mode === 'next' || mode === 'draft' ? 'draft' : 'active';
    return normalizeStrategyRecord({
        ...seed,
        ...domainFocus.buildFocusSeed(
            {
                id: seed.id,
                owner,
                review_due_at: seed.review_due_at,
            },
            { owner }
        ),
        owner,
        status,
        started_at: today,
        subfronts: seed.subfronts,
    });
}

function buildStrategyPlanBlock(strategy, kind = 'active') {
    const safe = normalizeStrategyRecord(strategy);
    if (!safe) return null;
    return {
        marker:
            kind === 'next' ? 'CODEX_STRATEGY_NEXT' : 'CODEX_STRATEGY_ACTIVE',
        id: safe.id,
        title: safe.title,
        status: safe.status,
        owner: safe.owner,
        owner_policy: safe.owner_policy,
        objective: safe.objective,
        started_at: safe.started_at,
        review_due_at: safe.review_due_at,
        success_signal: safe.success_signal,
        subfront_ids: safe.subfronts.map((subfront) => subfront.subfront_id),
    };
}

function buildStrategyPreview(board, seedNameRaw, options = {}) {
    const candidate = buildStrategySeed(seedNameRaw, {
        ...options,
        mode: 'next',
    });
    const validationErrors = validateStrategyRecord(candidate, {
        ...options,
        label: 'strategy.preview',
        allowClosed: false,
    });
    const impact = buildCoverageForStrategy(board, candidate, options);
    const activationBlockers = [
        ...validationErrors,
        ...impact.scope_collisions,
        ...(impact.orphan_tasks > 0
            ? [
                  `preview detecta ${impact.orphan_tasks} tarea(s) activa(s) que quedarian fuera del nuevo frente`,
              ]
            : []),
        ...(impact.exception_expired_tasks > 0
            ? [
                  `preview detecta ${impact.exception_expired_tasks} exception(es) expirada(s)`,
              ]
            : []),
    ];
    return {
        version: 1,
        ok: activationBlockers.length === 0,
        seed: normalizeOptionalToken(seedNameRaw),
        candidate,
        validation_errors: validationErrors,
        scope_collisions: impact.scope_collisions,
        impact,
        activation_ready: activationBlockers.length === 0,
        activation_blockers: activationBlockers,
        plan_block_expected: {
            next: buildStrategyPlanBlock(candidate, 'next'),
            active_on_activation: buildStrategyPlanBlock(
                {
                    ...candidate,
                    status: 'active',
                },
                'active'
            ),
        },
        seed_catalog_version: STRATEGY_SEED_CATALOG_VERSION,
    };
}

function buildDefaultAcceptanceText(subfront, title, taskId) {
    const profile = String(subfront?.default_acceptance_profile || '').trim();
    const taskLabel = String(title || taskId || 'entrega').trim();
    if (profile === 'frontend_delivery_checkpoint') {
        return `Validar flujo UI y demo del subfrente ${subfront.subfront_id} para "${taskLabel}".`;
    }
    if (profile === 'backend_gate_checkpoint') {
        return `Validar tests/gates y contrato backend del subfrente ${subfront.subfront_id} para "${taskLabel}".`;
    }
    if (profile === 'transversal_runtime_checkpoint') {
        return `Validar runtime/orquestacion del subfrente ${subfront.subfront_id} para "${taskLabel}".`;
    }
    return `Validar salida alineada al subfrente ${subfront?.subfront_id || '(sin subfrente)'} para "${taskLabel}".`;
}

function buildDefaultChecklist(subfront) {
    const profile = String(subfront?.default_acceptance_profile || '').trim();
    if (profile === 'frontend_delivery_checkpoint') {
        return [
            'UI visible y navegable',
            'flujo principal sin regresiones',
            'evidencia visual o smoke del frente',
        ];
    }
    if (profile === 'backend_gate_checkpoint') {
        return [
            'tests relevantes en verde',
            'gate backend o smoke aplicable',
            'evidencia de soporte directo al frente',
        ];
    }
    if (profile === 'transversal_runtime_checkpoint') {
        return [
            'surface/runtime validado',
            'guardrails o smoke en verde',
            'sin abrir trabajo fuera del frente activo',
        ];
    }
    return ['evidencia canónica', 'validación del subfrente'];
}

function resolveStrategyIntakeSubfront(board, input = {}) {
    const activeStrategy = getActiveStrategy(board);
    if (!activeStrategy) {
        throw new Error(
            'strategy intake requiere strategy.active en status=active'
        );
    }
    const requestedSubfrontId = String(input.subfront_id || '').trim();
    const scope = normalizeOptionalToken(input.scope);
    const subfronts = Array.isArray(activeStrategy.subfronts)
        ? activeStrategy.subfronts
        : [];

    if (requestedSubfrontId) {
        const explicit = getSubfrontById(activeStrategy, requestedSubfrontId);
        if (!explicit) {
            throw new Error(
                `strategy intake: subfront_id invalido (${requestedSubfrontId})`
            );
        }
        if (
            !explicit.allowed_scopes.includes(scope) &&
            !explicit.support_only_scopes.includes(scope)
        ) {
            throw new Error(
                `strategy intake: scope ${scope || 'vacio'} fuera del subfrente ${requestedSubfrontId}`
            );
        }
        return explicit;
    }

    const candidates = subfronts.filter(
        (subfront) =>
            subfront.allowed_scopes.includes(scope) ||
            subfront.support_only_scopes.includes(scope)
    );

    if (candidates.length === 1) {
        return candidates[0];
    }
    if (candidates.length > 1) {
        throw new Error(
            `strategy intake: scope ${scope || 'vacio'} ambiguo; candidatos: ${candidates
                .map((subfront) => subfront.subfront_id)
                .join(', ')}`
        );
    }

    throw new Error(
        `strategy intake: scope ${scope || 'vacio'} fuera de strategy.active (${activeStrategy.id})`
    );
}

function buildStrategyIntakeTask(board, input = {}, options = {}) {
    const {
        currentDate = () => new Date().toISOString().slice(0, 10),
        nowIso = () => new Date().toISOString(),
        detectDefaultOwner = () => 'unassigned',
        nextAgentTaskId = () => 'AG-001',
        mapLaneToCodexInstance = () => 'codex_backend_ops',
    } = options;
    const activeStrategy = getActiveStrategy(board);
    if (!activeStrategy) {
        throw new Error(
            'strategy intake requiere strategy.active en status=active'
        );
    }

    const title = String(input.title || '').trim();
    const scope = normalizeOptionalToken(input.scope);
    const files = Array.isArray(input.files)
        ? input.files.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
    if (!title) {
        throw new Error('strategy intake requiere --title');
    }
    if (!scope) {
        throw new Error('strategy intake requiere --scope');
    }
    if (files.length === 0) {
        throw new Error('strategy intake requiere --files con lista no vacia');
    }

    const subfront = resolveStrategyIntakeSubfront(board, {
        subfront_id: input.subfront_id,
        scope,
    });
    const role = subfront.allowed_scopes.includes(scope)
        ? 'primary'
        : 'support';
    const codexInstance = subfront.codex_instance;
    const domainLane =
        codexInstance === 'codex_frontend'
            ? 'frontend_content'
            : codexInstance === 'codex_transversal'
              ? 'transversal_runtime'
              : 'backend_ops';
    const taskId =
        String(input.id || '').trim() || nextAgentTaskId(board.tasks);
    const owner =
        String(input.owner || '').trim() ||
        detectDefaultOwner() ||
        'unassigned';
    const today = String(currentDate()).trim() || '2026-03-14';
    const evidenceRef = `verification/agent-runs/${taskId}.md`;
    const task = {
        id: taskId,
        title,
        owner,
        executor: String(input.executor || 'codex')
            .trim()
            .toLowerCase(),
        status: String(input.status || 'ready')
            .trim()
            .toLowerCase(),
        risk: String(input.risk || 'medium')
            .trim()
            .toLowerCase(),
        scope,
        codex_instance: codexInstance,
        domain_lane: domainLane,
        lane_lock: 'strict',
        cross_domain: false,
        provider_mode: '',
        runtime_surface: '',
        runtime_transport: '',
        runtime_last_transport: '',
        files,
        source_signal: 'strategy_intake',
        source_ref: activeStrategy.id,
        priority_score: Number.parseInt(String(input.priority_score ?? 70), 10),
        sla_due_at: String(input.sla_due_at || '').trim(),
        last_attempt_at: '',
        attempts: 0,
        blocked_reason: '',
        runtime_impact: String(input.runtime_impact || 'low')
            .trim()
            .toLowerCase(),
        critical_zone: Boolean(input.critical_zone),
        acceptance: buildDefaultAcceptanceText(subfront, title, taskId),
        acceptance_ref: evidenceRef,
        evidence_ref: evidenceRef,
        depends_on: Array.isArray(input.depends_on) ? input.depends_on : [],
        prompt: String(input.prompt || title).trim(),
        strategy_id: activeStrategy.id,
        subfront_id: subfront.subfront_id,
        strategy_role: role,
        strategy_reason: '',
        exception_opened_at: '',
        exception_expires_at: '',
        exception_state: '',
        created_at: today,
        updated_at: today,
        status_since_at: today,
    };
    if (!Number.isFinite(task.priority_score)) {
        task.priority_score = 70;
    }
    if (task.executor === 'codex') {
        task.codex_instance =
            mapLaneToCodexInstance(domainLane) || codexInstance;
    }
    ensureTaskStrategyDefaults(board, task, {
        nowIso: typeof nowIso === 'function' ? nowIso() : String(nowIso || ''),
    });
    if (!task.integration_slice) {
        const allowedSlices = Array.from(
            domainFocus.getAllowedSlicesForLane(task)
        );
        task.integration_slice = String(allowedSlices[0] || '')
            .trim()
            .toLowerCase();
    }
    return {
        task,
        subfront,
        intake_defaults: {
            acceptance_profile: subfront.default_acceptance_profile,
            evidence_ref: evidenceRef,
            checklist: buildDefaultChecklist(subfront),
        },
    };
}

function serializeStrategyComment(strategy, deps = {}, kind = 'active') {
    const {
        quote = (value) => JSON.stringify(String(value || '')),
        serializeArrayInline = (values) => JSON.stringify(values || []),
        currentDate = () => '',
    } = deps;
    const safe = normalizeStrategyRecord(strategy);
    if (!safe) return '';
    const marker =
        kind === 'next' ? 'CODEX_STRATEGY_NEXT' : 'CODEX_STRATEGY_ACTIVE';
    const lines = [];
    lines.push(`<!-- ${marker}`);
    lines.push(`id: ${safe.id || ''}`);
    lines.push(`title: ${quote(safe.title || '')}`);
    lines.push(
        `status: ${safe.status || (kind === 'next' ? 'draft' : 'active')}`
    );
    lines.push(`owner: ${safe.owner || ''}`);
    lines.push(`owner_policy: ${quote(safe.owner_policy || '')}`);
    lines.push(`objective: ${quote(safe.objective || '')}`);
    lines.push(`started_at: ${quote(safe.started_at || '')}`);
    lines.push(`review_due_at: ${quote(safe.review_due_at || '')}`);
    lines.push(`success_signal: ${quote(safe.success_signal || '')}`);
    if (safe.focus_id) {
        lines.push(`focus_id: ${quote(safe.focus_id || '')}`);
        lines.push(`focus_title: ${quote(safe.focus_title || '')}`);
        lines.push(`focus_status: ${safe.focus_status || 'active'}`);
        lines.push(`focus_next_step: ${quote(safe.focus_next_step || '')}`);
        lines.push(
            `focus_required_checks: ${serializeArrayInline(
                safe.focus_required_checks || []
            )}`
        );
    }
    lines.push(
        `subfront_ids: ${serializeArrayInline(
            safe.subfronts.map((subfront) => subfront.subfront_id)
        )}`
    );
    lines.push(`updated_at: ${quote(currentDate())}`);
    lines.push('-->');
    return lines.join('\n');
}

function serializeStrategyActiveComment(strategy, deps = {}) {
    return serializeStrategyComment(strategy, deps, 'active');
}

function serializeStrategyNextComment(strategy, deps = {}) {
    return serializeStrategyComment(strategy, deps, 'next');
}

function upsertStrategyBlock(planRaw, strategy, deps = {}, kind = 'active') {
    const {
        buildComment = (value) => serializeStrategyComment(value, deps, kind),
        anchorText = 'Relacion con Operativo 2026:',
    } = deps;
    const marker =
        kind === 'next' ? 'CODEX_STRATEGY_NEXT' : 'CODEX_STRATEGY_ACTIVE';
    const withoutStrategy = String(planRaw || '').replace(
        new RegExp(`<!--\\s*${marker}\\s*\\n[\\s\\S]*?-->\\s*`, 'g'),
        ''
    );
    if (!strategy) {
        return withoutStrategy.replace(/\n{3,}/g, '\n\n');
    }
    const comment = `${buildComment(strategy)}\n\n`;
    const anchorIndex = withoutStrategy.indexOf(anchorText);
    if (anchorIndex === -1) {
        return `${comment}${withoutStrategy}`.replace(/\n{3,}/g, '\n\n');
    }
    const lineEnd = withoutStrategy.indexOf('\n', anchorIndex);
    if (lineEnd === -1) {
        return `${withoutStrategy}\n\n${comment}`.replace(/\n{3,}/g, '\n\n');
    }
    return (
        withoutStrategy.slice(0, lineEnd + 1) +
        '\n' +
        comment +
        withoutStrategy.slice(lineEnd + 1)
    ).replace(/\n{3,}/g, '\n\n');
}

function upsertStrategyActiveBlock(planRaw, strategy, deps = {}) {
    return upsertStrategyBlock(planRaw, strategy, deps, 'active');
}

function upsertStrategyNextBlock(planRaw, strategy, deps = {}) {
    return upsertStrategyBlock(planRaw, strategy, deps, 'next');
}

function upsertStrategyBlocks(planRaw, strategyState = {}, deps = {}) {
    const activeCandidate = normalizeStrategyRecord(
        strategyState.active || null
    );
    const nextCandidate = normalizeStrategyRecord(strategyState.next || null);
    const active =
        activeCandidate &&
        ['active', 'closed'].includes(String(activeCandidate.status || ''))
            ? activeCandidate
            : null;
    const next =
        nextCandidate && String(nextCandidate.status || '') === 'draft'
            ? nextCandidate
            : null;
    let output = upsertStrategyActiveBlock(planRaw, active, deps);
    output = upsertStrategyNextBlock(output, next, deps);
    return output;
}

module.exports = {
    ACTIVE_TASK_STATUSES,
    DEFAULT_SLOT_TASK_STATUSES,
    ALLOWED_STRATEGY_STATUSES,
    ALLOWED_STRATEGY_ROLES,
    ALLOWED_EXCEPTION_STATES,
    DEFAULT_CODEX_INSTANCES,
    DEFAULT_EXCEPTION_TTL_HOURS,
    DEFAULT_AGED_TASK_HOURS,
    STRATEGY_SEED_CATALOG_VERSION,
    STRATEGY_SEED_CATALOG,
    normalizeStrategySubfront,
    normalizeStrategyRecord,
    normalizeStrategyActive,
    normalizeTaskStrategyFields,
    getConfiguredStrategy,
    getConfiguredNextStrategy,
    getActiveStrategy,
    getNextStrategy,
    getSubfrontById,
    getSubfrontByCodexInstance,
    getTaskSubfront,
    isReleasePromotionExceptionTask,
    ensureTaskStrategyDefaults,
    validateStrategyConfiguration,
    validateTaskStrategyAlignment,
    buildStrategyCoverageSummary,
    buildCoverageForStrategy,
    buildStrategySeedCatalog,
    buildStrategySeed,
    buildStrategyPreview,
    resolveStrategyIntakeSubfront,
    buildStrategyIntakeTask,
    buildStrategyPlanBlock,
    buildStrategyActiveComment: serializeStrategyActiveComment,
    buildStrategyNextComment: serializeStrategyNextComment,
    upsertStrategyActiveBlock,
    upsertStrategyNextBlock,
    upsertStrategyBlocks,
};
