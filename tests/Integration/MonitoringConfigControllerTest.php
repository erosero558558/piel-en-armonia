<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class MonitoringConfigControllerTest extends TestCase
{
    /** @var array<string,string|false> */
    private array $envBackup = [];

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
        ];

        foreach ([
            'PIELARMONIA_SENTRY_DSN_PUBLIC',
            'AURORADERM_SENTRY_DSN_PUBLIC',
            'AURORADERM_SENTRY_DSN_FRONTEND',
            'AURORADERM_SENTRY_DSN',
            'SENTRY_AUTH_TOKEN',
            'PIELARMONIA_GA_MEASUREMENT_ID',
            'AURORADERM_GA_MEASUREMENT_ID',
            'PIELARMONIA_CLARITY_PROJECT_ID',
            'MICROSOFT_CLARITY_PROJECT_ID',
        ] as $key) {
            $this->envBackup[$key] = getenv($key);
        }

        putenv('PIELARMONIA_SENTRY_DSN_PUBLIC');
        putenv('AURORADERM_SENTRY_DSN_PUBLIC=https://public@example.ingest.sentry.io/123');
        putenv('AURORADERM_SENTRY_DSN_FRONTEND');
        putenv('AURORADERM_SENTRY_DSN=https://private@example.ingest.sentry.io/999');
        putenv('SENTRY_AUTH_TOKEN=super-secret-token');
        putenv('AURORADERM_GA_MEASUREMENT_ID=G-ALLOWLIST123');
        putenv('MICROSOFT_CLARITY_PROJECT_ID=clarity-public-id');
        putenv('PIELARMONIA_GA_MEASUREMENT_ID');
        putenv('PIELARMONIA_CLARITY_PROJECT_ID');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/MonitoringConfigController.php';
    }

    protected function tearDown(): void
    {
        foreach ($this->envBackup as $key => $value) {
            if ($value === false) {
                putenv($key);
                continue;
            }

            putenv($key . '=' . $value);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testMonitoringConfigReturnsOnlyAllowlistedPublicKeys(): void
    {
        try {
            \MonitoringConfigController::monitoringConfig([]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            self::assertSame(200, $exception->status);
            self::assertIsArray($exception->payload);

            $payload = is_array($exception->payload) ? $exception->payload : [];
            $keys = array_keys($payload);
            sort($keys);

            self::assertSame(
                ['clarity_id', 'ga_measurement_id', 'sentry_dsn_frontend'],
                $keys
            );
            self::assertSame(
                'https://public@example.ingest.sentry.io/123',
                $payload['sentry_dsn_frontend'] ?? null
            );
            self::assertSame('G-ALLOWLIST123', $payload['ga_measurement_id'] ?? null);
            self::assertSame('clarity-public-id', $payload['clarity_id'] ?? null);

            foreach ([
                'sentry_auth_token',
                'SENTRY_AUTH_TOKEN',
                'sentry_dsn',
                'AURORADERM_SENTRY_DSN',
                'backend_dsn',
                'private_dsn',
            ] as $forbiddenKey) {
                self::assertArrayNotHasKey($forbiddenKey, $payload);
            }
        }
    }

    public function testMonitoringConfigUsesLegacyPublicAliasWhenPresent(): void
    {
        putenv('PIELARMONIA_SENTRY_DSN_PUBLIC=https://legacy-public@example.ingest.sentry.io/abc');
        putenv('AURORADERM_SENTRY_DSN_PUBLIC');

        $payload = \MonitoringConfigController::publicMonitoringConfig();

        self::assertSame(
            'https://legacy-public@example.ingest.sentry.io/abc',
            $payload['sentry_dsn_frontend']
        );
    }
}
