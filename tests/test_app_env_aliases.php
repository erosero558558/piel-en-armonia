<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../lib/common.php';

function restore_env_value(string $name, $value): void
{
    if ($value === false || $value === null || $value === '') {
        putenv($name);
        unset($_ENV[$name], $_SERVER[$name]);
        return;
    }

    putenv($name . '=' . $value);
    $_ENV[$name] = (string) $value;
    $_SERVER[$name] = (string) $value;
}

run_test('app_env prioriza AURORADERM sobre PIELARMONIA', function (): void {
    $previousCanonical = getenv('AURORADERM_ADMIN_PASSWORD');
    $previousLegacy = getenv('PIELARMONIA_ADMIN_PASSWORD');

    putenv('AURORADERM_ADMIN_PASSWORD=aurora-secret');
    putenv('PIELARMONIA_ADMIN_PASSWORD=legacy-secret');

    assert_equals('aurora-secret', app_env('AURORADERM_ADMIN_PASSWORD'));
    assert_equals('aurora-secret', app_env('PIELARMONIA_ADMIN_PASSWORD'));

    restore_env_value('AURORADERM_ADMIN_PASSWORD', $previousCanonical);
    restore_env_value('PIELARMONIA_ADMIN_PASSWORD', $previousLegacy);
});

run_test('app_env cae al alias legacy cuando falta el canonico', function (): void {
    $previousCanonical = getenv('AURORADERM_OPERATOR_AUTH_MODE');
    $previousLegacy = getenv('PIELARMONIA_OPERATOR_AUTH_MODE');

    putenv('AURORADERM_OPERATOR_AUTH_MODE');
    putenv('PIELARMONIA_OPERATOR_AUTH_MODE=openclaw_chatgpt');

    assert_equals('openclaw_chatgpt', app_env('AURORADERM_OPERATOR_AUTH_MODE'));

    restore_env_value('AURORADERM_OPERATOR_AUTH_MODE', $previousCanonical);
    restore_env_value('PIELARMONIA_OPERATOR_AUTH_MODE', $previousLegacy);
});

run_test('app_prometheus_alias_output emite canonico y legacy', function (): void {
    $payload = app_prometheus_alias_output(
        "# TYPE auroraderm_metric_total gauge\n" .
        "auroraderm_metric_total{status=\"ok\"} 1"
    );

    assert_contains('# TYPE auroraderm_metric_total gauge', $payload);
    assert_contains('# TYPE pielarmonia_metric_total gauge', $payload);
    assert_contains('auroraderm_metric_total{status="ok"} 1', $payload);
    assert_contains('pielarmonia_metric_total{status="ok"} 1', $payload);
});

print_test_summary();
