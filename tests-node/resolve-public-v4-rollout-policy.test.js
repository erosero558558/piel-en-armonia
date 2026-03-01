#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('path');

const { resolvePublicV4RolloutPolicy } = require(
    resolve(__dirname, '..', 'bin', 'resolve-public-v4-rollout-policy.js')
);

test('resolver aplica defaults de canary cuando no hay overrides', () => {
    const result = resolvePublicV4RolloutPolicy({
        stage: 'canary',
        defaultStage: 'canary',
    });

    assert.equal(result.stage_effective, 'canary');
    assert.equal(result.stage_profile, 'progressive');
    assert.equal(result.enable_monitor_effective, true);
    assert.equal(result.surface_test_effective, 'v4');
    assert.equal(result.surface_control_effective, 'legacy');
    assert.equal(result.min_view_booking_effective, 20);
    assert.equal(result.min_start_checkout_effective, 10);
    assert.equal(result.max_confirmed_drop_pp_effective, 8);
    assert.equal(result.min_confirmed_rate_pct_effective, 20);
    assert.equal(result.allow_missing_control_effective, false);
    assert.equal(result.policy_source, 'stage_default');
});

test('resolver aplica fallback de stage invalido y lo marca en policy_source', () => {
    const result = resolvePublicV4RolloutPolicy({
        stage: 'bad-stage',
        defaultStage: 'general',
    });

    assert.equal(result.stage_effective, 'general');
    assert.equal(result.stage_profile, 'strict');
    assert.equal(result.policy_source, 'invalid_stage_fallback+stage_default');
});

test('resolver respeta overrides de input/vars en stage general', () => {
    const result = resolvePublicV4RolloutPolicy({
        stage: 'general',
        defaultStage: 'canary',
        minViewBooking: '70',
        minStartCheckout: '30',
        maxConfirmedDropPp: '4',
        minConfirmedRatePct: '28',
        allowMissingControl: 'true',
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
    });

    assert.equal(result.stage_effective, 'general');
    assert.equal(result.min_view_booking_effective, 70);
    assert.equal(result.min_start_checkout_effective, 30);
    assert.equal(result.max_confirmed_drop_pp_effective, 4);
    assert.equal(result.min_confirmed_rate_pct_effective, 28);
    assert.equal(result.allow_missing_control_effective, true);
    assert.equal(result.policy_source, 'stage_default+input_or_var');
});

test('resolver fuerza guardrails de rollback y trazabilidad', () => {
    const result = resolvePublicV4RolloutPolicy({
        stage: 'rollback',
        defaultStage: 'canary',
        surfaceTest: 'v4',
        surfaceControl: 'legacy',
        allowMissingControl: 'false',
    });

    assert.equal(result.stage_effective, 'rollback');
    assert.equal(result.stage_profile, 'rollback_strict');
    assert.equal(result.surface_test_effective, 'legacy');
    assert.equal(result.surface_control_effective, 'v4');
    assert.equal(result.allow_missing_control_effective, true);
    assert.equal(
        result.policy_source,
        'stage_default+input_or_var+rollback_guardrail'
    );
});

test('resolver corrige test/control iguales con surface guardrail', () => {
    const result = resolvePublicV4RolloutPolicy({
        stage: 'canary',
        defaultStage: 'canary',
        surfaceTest: 'v4',
        surfaceControl: 'v4',
    });

    assert.equal(result.surface_test_effective, 'v4');
    assert.equal(result.surface_control_effective, 'legacy');
    assert.equal(
        result.policy_source,
        'stage_default+input_or_var+surface_guardrail'
    );
});
