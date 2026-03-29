#!/usr/bin/env node
'use strict';

const VALID_STAGES = new Set(['internal', 'canary', 'general', 'rollback']);

const STAGE_PROFILE_BY_STAGE = {
    internal: 'tolerant',
    canary: 'progressive',
    general: 'strict',
    rollback: 'rollback_strict',
};

const STAGE_DEFAULTS = {
    internal: {
        enableMonitor: true,
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
        minViewBooking: 10,
        minStartCheckout: 5,
        maxConfirmedDropPp: 12,
        minConfirmedRatePct: 15,
        allowMissingControl: true,
    },
    canary: {
        enableMonitor: true,
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
        minViewBooking: 20,
        minStartCheckout: 10,
        maxConfirmedDropPp: 8,
        minConfirmedRatePct: 20,
        allowMissingControl: false,
    },
    general: {
        enableMonitor: true,
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
        minViewBooking: 50,
        minStartCheckout: 20,
        maxConfirmedDropPp: 5,
        minConfirmedRatePct: 25,
        allowMissingControl: false,
    },
    rollback: {
        enableMonitor: true,
        surfaceTest: 'legacy',
        surfaceControl: 'v4',
        minViewBooking: 20,
        minStartCheckout: 10,
        maxConfirmedDropPp: 10,
        minConfirmedRatePct: 20,
        allowMissingControl: true,
    },
};

function parseBooleanLike(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return Boolean(fallback);
    }
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

function parseNumberLike(value, fallback, minimum) {
    if (value === undefined || value === null || value === '') {
        return Number(fallback);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return Number(fallback);
    }
    if (Number.isFinite(minimum) && parsed < minimum) {
        return Number(fallback);
    }
    return parsed;
}

function normalizeStage(rawStage, fallbackStage) {
    const normalizedFallback = String(fallbackStage || 'canary')
        .trim()
        .toLowerCase();
    const safeFallback = VALID_STAGES.has(normalizedFallback)
        ? normalizedFallback
        : 'canary';
    const normalizedStage = String(rawStage || '')
        .trim()
        .toLowerCase();

    if (VALID_STAGES.has(normalizedStage)) {
        return {
            input: normalizedStage,
            effective: normalizedStage,
            usedFallback: false,
        };
    }

    return {
        input: normalizedStage,
        effective: safeFallback,
        usedFallback: true,
    };
}

function normalizeSurface(value, fallback) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function resolvePublicV4RolloutPolicy(options = {}) {
    const stageInfo = normalizeStage(options.stage, options.defaultStage);
    const stageDefaults =
        STAGE_DEFAULTS[stageInfo.effective] || STAGE_DEFAULTS.canary;
    let policySource = stageInfo.usedFallback
        ? 'invalid_stage_fallback+stage_default'
        : 'stage_default';

    const rawEnableMonitor = options.enableMonitor;
    const rawSurfaceTest = options.surfaceTest;
    const rawSurfaceControl = options.surfaceControl;
    const rawMinViewBooking = options.minViewBooking;
    const rawMinStartCheckout = options.minStartCheckout;
    const rawMaxConfirmedDropPp = options.maxConfirmedDropPp;
    const rawMinConfirmedRatePct = options.minConfirmedRatePct;
    const rawAllowMissingControl = options.allowMissingControl;

    const hasOverride =
        rawEnableMonitor !== undefined ||
        rawSurfaceTest !== undefined ||
        rawSurfaceControl !== undefined ||
        rawMinViewBooking !== undefined ||
        rawMinStartCheckout !== undefined ||
        rawMaxConfirmedDropPp !== undefined ||
        rawMinConfirmedRatePct !== undefined ||
        rawAllowMissingControl !== undefined;

    if (hasOverride) {
        policySource += '+input_or_var';
    }

    let enableMonitor = parseBooleanLike(
        rawEnableMonitor,
        stageDefaults.enableMonitor
    );
    let surfaceTest = normalizeSurface(
        rawSurfaceTest,
        stageDefaults.surfaceTest
    );
    let surfaceControl = normalizeSurface(
        rawSurfaceControl,
        stageDefaults.surfaceControl
    );
    let minViewBooking = parseNumberLike(
        rawMinViewBooking,
        stageDefaults.minViewBooking,
        0
    );
    let minStartCheckout = parseNumberLike(
        rawMinStartCheckout,
        stageDefaults.minStartCheckout,
        0
    );
    let maxConfirmedDropPp = parseNumberLike(
        rawMaxConfirmedDropPp,
        stageDefaults.maxConfirmedDropPp,
        0
    );
    let minConfirmedRatePct = parseNumberLike(
        rawMinConfirmedRatePct,
        stageDefaults.minConfirmedRatePct,
        0
    );
    let allowMissingControl = parseBooleanLike(
        rawAllowMissingControl,
        stageDefaults.allowMissingControl
    );

    // Guardrails for rollback stage: enforce legacy-first analysis.
    if (stageInfo.effective === 'rollback') {
        let adjusted = false;
        if (surfaceTest !== 'legacy') {
            surfaceTest = 'legacy';
            adjusted = true;
        }
        if (surfaceControl !== 'v4') {
            surfaceControl = 'v4';
            adjusted = true;
        }
        if (!allowMissingControl) {
            allowMissingControl = true;
            adjusted = true;
        }
        if (adjusted) {
            policySource += '+rollback_guardrail';
        }
    }

    // Guardrail: control and test surfaces should not be equal.
    if (surfaceTest === surfaceControl) {
        surfaceControl = surfaceTest === 'v4' ? 'legacy' : 'v4';
        policySource += '+surface_guardrail';
    }

    return {
        stage_input: stageInfo.input || '',
        stage_effective: stageInfo.effective,
        stage_profile:
            STAGE_PROFILE_BY_STAGE[stageInfo.effective] ||
            STAGE_PROFILE_BY_STAGE.canary,
        enable_monitor_effective: enableMonitor,
        surface_test_effective: surfaceTest,
        surface_control_effective: surfaceControl,
        min_view_booking_effective: minViewBooking,
        min_start_checkout_effective: minStartCheckout,
        max_confirmed_drop_pp_effective: maxConfirmedDropPp,
        min_confirmed_rate_pct_effective: minConfirmedRatePct,
        allow_missing_control_effective: allowMissingControl,
        policy_source: policySource,
    };
}

function parseArgs(argv) {
    const args = {
        defaultStage: 'canary',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        const hasValue = next !== undefined && !next.startsWith('--');
        if (hasValue) {
            args[key] = next;
            index += 1;
        } else {
            args[key] = 'true';
        }
    }

    return {
        stage: args.stage,
        defaultStage: args['default-stage'] || args.defaultStage,
        enableMonitor: args['enable-monitor'],
        surfaceTest: args['surface-test'],
        surfaceControl: args['surface-control'],
        minViewBooking: args['min-view-booking'],
        minStartCheckout: args['min-start-checkout'],
        maxConfirmedDropPp: args['max-confirmed-drop-pp'],
        minConfirmedRatePct: args['min-confirmed-rate-pct'],
        allowMissingControl: args['allow-missing-control'],
    };
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const result = resolvePublicV4RolloutPolicy(options);
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : 'unexpected_error_resolving_public_v4_rollout_policy';
        process.stderr.write(`${message}\n`);
        process.exit(1);
    }
}

module.exports = {
    normalizeStage,
    parseBooleanLike,
    parseNumberLike,
    normalizeSurface,
    resolvePublicV4RolloutPolicy,
};
