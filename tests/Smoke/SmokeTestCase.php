<?php

declare(strict_types=1);

namespace Tests\Smoke;

use PHPUnit\Framework\TestCase;

abstract class SmokeTestCase extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'smoke-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('AURORADERM_SKIP_ENV_FILE=true');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('AURORADERM_DATA_DIR');
        putenv('PIELARMONIA_SKIP_ENV_FILE');
        putenv('AURORADERM_SKIP_ENV_FILE');

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    protected function captureResponse(callable $callable, string $method = 'GET', ?array $body = null): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException but the method returned normally.');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload) ? $exception->payload : [],
                'status' => (int) $exception->status,
            ];
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
