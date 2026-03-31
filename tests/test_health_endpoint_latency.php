<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

/**
 * @param list<float> $samples
 */
function health_latency_p95(array $samples): float
{
    sort($samples);
    $count = count($samples);
    if ($count === 0) {
        return 0.0;
    }

    $index = (int) ceil($count * 0.95) - 1;
    if ($index < 0) {
        $index = 0;
    }
    if ($index >= $count) {
        $index = $count - 1;
    }

    return $samples[$index];
}

run_test('health endpoint local p95 stays under 200ms', function (): void {
    $dataDir = sys_get_temp_dir() . '/aurora-health-latency-' . uniqid('', true);
    $server = [];

    ensure_clean_directory($dataDir);

    try {
        $server = start_test_php_server([
            'docroot' => __DIR__ . '/..',
            'router' => __DIR__ . '/../bin/local-stage-router.php',
            'env' => [
                'AURORADERM_SKIP_ENV_FILE' => '1',
                'PIELARMONIA_SKIP_ENV_FILE' => '1',
                'PIELARMONIA_DATA_DIR' => $dataDir,
                'AURORADERM_DATA_DIR' => $dataDir,
                'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
            ],
        ]);

        $url = rtrim((string) ($server['base_url'] ?? ''), '/') . '/api.php?resource=health';
        $samples = [];
        $iterations = 20;

        for ($i = 0; $i < $iterations; $i += 1) {
            $startedAt = microtime(true);
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $body = curl_exec($ch);
            $elapsed = microtime(true) - $startedAt;
            $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            assert_true($body !== false, 'health endpoint debe responder contenido');
            assert_equals(200, $statusCode, 'health endpoint debe responder HTTP 200');

            $payload = json_decode((string) $body, true);
            assert_true(is_array($payload), 'health endpoint debe devolver JSON');
            assert_true(($payload['ok'] ?? false) === true, 'health endpoint debe reportar ok=true');
            $samples[] = $elapsed;
        }

        $p95Seconds = health_latency_p95($samples);
        $p95Ms = (int) round($p95Seconds * 1000);

        assert_true(
            $p95Seconds < 0.2,
            "health endpoint debe quedar bajo 200ms p95; obtenido {$p95Ms}ms"
        );

        echo "Measured p95: {$p95Ms}ms\n";
    } finally {
        stop_test_php_server($server);
        delete_path_recursive($dataDir);
    }
});

print_test_summary();
