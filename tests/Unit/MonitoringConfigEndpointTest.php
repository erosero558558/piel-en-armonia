<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class MonitoringConfigEndpointTest extends TestCase
{
    private string $originalDataDir;
    private string $tempData;

    protected function setUp(): void
    {
        $this->originalDataDir = getenv('AURORADERM_DATA_DIR') ?: '';
        $this->tempData = sys_get_temp_dir() . '/auroraderm_test_monitoring_' . uniqid('', true);
        @mkdir($this->tempData, 0777, true);
    }

    protected function tearDown(): void
    {
        putenv('AURORADERM_DATA_DIR=' . $this->originalDataDir);
        $this->removeDirectory($this->tempData);
    }

    private function removeDirectory(string $dir): void
    {
        if (is_dir($dir)) {
            $objects = scandir($dir);
            if ($objects !== false) {
                foreach ($objects as $object) {
                    if ($object !== '.' && $object !== '..') {
                        $p = $dir . '/' . $object;
                        if (is_dir($p) && !is_link($p)) {
                            $this->removeDirectory($p);
                        } else {
                            @unlink($p);
                        }
                    }
                }
            }
            @rmdir($dir);
        }
    }

    private function invokeEndpoint(array $envVars = []): array
    {
        $targetFile = realpath(__DIR__ . '/../../api.php');

        $fullEnv = array_merge(getenv(), $envVars);
        $fullEnv['AURORADERM_DATA_DIR'] = $this->tempData;
        $fullEnv['AURORADERM_SKIP_ENV_FILE'] = '1';
        $fullEnv['TESTING_ENV'] = '1';

        $wrapperScript = <<<PHP
\$_SERVER['REQUEST_METHOD'] = 'GET';
\$_GET['resource'] = 'monitoring-config';
require 'api.php';
PHP;

        $process = proc_open(
            [PHP_BINARY, '-r', $wrapperScript],
            [
                1 => ['pipe', 'w'], // stdout
                2 => ['pipe', 'w'], // stderr
            ],
            $pipes,
            __DIR__ . '/../../',
            $fullEnv
        );

        if (!is_resource($process)) {
            throw new \RuntimeException('Failed to execute api.php via proc_open');
        }

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        $payload = [];
        $status = 200; // default for json_response if ok

        if (is_string($stdout) && $stdout !== '') {
            $lines = explode("\n", $stdout);
            foreach ($lines as $line) {
                if (preg_match('/^HTTP\/\d(?:\.\d)? (\d+)/i', $line, $m)) {
                    $status = (int)$m[1];
                }
            }

            $jsonPos = strpos($stdout, '{"');
            if ($jsonPos !== false) {
                $jsonStr = substr($stdout, $jsonPos);
                $decoded = json_decode($jsonStr, true);
                if (is_array($decoded)) {
                    $payload = $decoded;
                }
            }
        }

        return [
            'status' => $status,
            'payload' => $payload,
            'stdout' => $stdout,
            'stderr' => $stderr,
            'exitCode' => $exitCode,
        ];
    }

    public function testMonitoringConfigOnlyReturnsAllowlistedKeys(): void
    {
        $response = $this->invokeEndpoint([
            'SENTRY_AUTH_TOKEN' => 'secret-auth-token-that-should-leak',
            'PIELARMONIA_GA_MEASUREMENT_ID' => 'G-TESTV',
            'SENTRY_DSN_FRONTEND' => 'fake-dsn-1',
            'PIELARMONIA_SENTRY_DSN_PUBLIC' => 'https://valid@sentry.test/2',
            'PIELARMONIA_SECRET_AWS' => 'AKIAYYYYYYYY'
        ]);

        $payload = $response['payload'];

        // Assert 1: Only exactly 3 keys are present in the actual contract body
        $expectedKeys = ['sentry_dsn_frontend', 'ga_measurement_id', 'clarity_id'];

        foreach (array_keys($payload) as $key) {
            $this->assertContains($key, $expectedKeys, "Prohibited key '$key' leaked in public monitoring API.");
        }

        $this->assertEquals('https://valid@sentry.test/2', $payload['sentry_dsn_frontend']);
        $this->assertEquals('G-TESTV', $payload['ga_measurement_id']);

        // Assert 2: explicitly ensure the auth token or AWS keys aren't in there
        $this->assertArrayNotHasKey('sentry_auth_token', $payload);
        $this->assertArrayNotHasKey('dsn', $payload); // old undocumented key
        $this->assertArrayNotHasKey('environment', $payload);
        $this->assertArrayNotHasKey('tracesSampleRate', $payload);
    }
}
