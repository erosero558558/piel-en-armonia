<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class VerifyBackupEndpointTest extends TestCase
{
    private string $tempDir;

    /** @var array<string,string|false> */
    private array $envBackup = [];

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8000',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'verify-backup-endpoint-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
            'AURORADERM_BACKUP_RECEIVER_TOKEN',
            'AURORADERM_BACKUP_OFFSITE_TOKEN',
            'AURORADERM_BACKUP_WEBHOOK_TOKEN',
            'AURORADERM_CRON_SECRET',
            'AURORADERM_BACKUP_RECEIVER_ENCRYPTION_KEY',
            'AURORADERM_DATA_ENCRYPTION_KEY',
            'AURORADERM_DATA_KEY',
        ] as $key) {
            $this->envBackup[$key] = getenv($key);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('AURORADERM_BACKUP_RECEIVER_TOKEN=backup-token');
        putenv('AURORADERM_BACKUP_OFFSITE_TOKEN');
        putenv('AURORADERM_BACKUP_WEBHOOK_TOKEN');
        putenv('AURORADERM_CRON_SECRET');
        putenv('AURORADERM_BACKUP_RECEIVER_ENCRYPTION_KEY=verify-backup-test-key');
        putenv('AURORADERM_DATA_ENCRYPTION_KEY');
        putenv('AURORADERM_DATA_KEY');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
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

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testAuthMissingReturns401(): void
    {
        $response = $this->invokeEndpoint([], null);

        self::assertSame(401, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('auth_missing', $response['payload']['code'] ?? null);
    }

    public function testAuthInvalidReturns403(): void
    {
        $response = $this->invokeEndpoint([], 'Bearer wrong-token');

        self::assertSame(403, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('auth_invalid', $response['payload']['code'] ?? null);
    }

    public function testPathTraversalReturns400(): void
    {
        mkdir($this->storageRoot(), 0777, true);

        $response = $this->invokeEndpoint(['file' => '../escape.enc']);

        self::assertSame(400, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('invalid_file', $response['payload']['code'] ?? null);
    }

    public function testStorageNotFoundReturns500(): void
    {
        $response = $this->invokeEndpoint();

        self::assertSame(500, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('storage_not_found', $response['payload']['code'] ?? null);
    }

    public function testNoBackupFilesReturns404(): void
    {
        mkdir($this->storageRoot(), 0777, true);

        $response = $this->invokeEndpoint();

        self::assertSame(404, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('no_backup_files', $response['payload']['code'] ?? null);
    }

    public function testChecksumOkReturns200AndHash(): void
    {
        $fixture = $this->createEncryptedBackup('latest-backup.enc', 'contenido-clinico');

        $response = $this->invokeEndpoint(['file' => $fixture['relativePath']]);

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame($fixture['relativePath'], $response['payload']['file'] ?? null);
        self::assertSame($fixture['sha256'], $response['payload']['verification']['sha256'] ?? null);
        self::assertTrue((bool) ($response['payload']['verification']['metaMatch'] ?? false));
    }

    public function testChecksumMismatchReturns409(): void
    {
        $fixture = $this->createEncryptedBackup('broken-backup.enc', 'contenido-alterado', str_repeat('a', 64));

        $response = $this->invokeEndpoint(['file' => $fixture['relativePath']]);

        self::assertSame(409, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('checksum_mismatch', $response['payload']['code'] ?? null);
        self::assertSame('metadata_checksum_mismatch', $response['payload']['verification']['reason'] ?? null);
    }

    /**
     * @param array<string,string> $query
     * @return array{status:int,payload:array<string,mixed>}
     */
    private function invokeEndpoint(array $query = [], ?string $authorization = 'Bearer backup-token'): array
    {
        $_GET = $query;
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8000',
        ];

        if (is_string($authorization) && $authorization !== '') {
            $_SERVER['HTTP_AUTHORIZATION'] = $authorization;
        }

        try {
            require __DIR__ . '/../../verify-backup.php';
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = is_array($exception->payload) ? $exception->payload : [];
            return [
                'status' => (int) $exception->status,
                'payload' => $payload,
            ];
        }
    }

    /**
     * @return array{path:string,relativePath:string,sha256:string}
     */
    private function createEncryptedBackup(string $fileName, string $plain, ?string $metaSha = null): array
    {
        $root = $this->storageRoot();
        if (!is_dir($root)) {
            mkdir($root, 0777, true);
        }

        $encrypted = backup_receiver_encrypt_payload($plain);
        self::assertTrue((bool) ($encrypted['ok'] ?? false));

        $path = $root . DIRECTORY_SEPARATOR . $fileName;
        file_put_contents($path, (string) ($encrypted['ciphertext'] ?? ''), LOCK_EX);
        file_put_contents(
            $path . '.meta.json',
            json_encode(
                ['sha256' => $metaSha ?? (string) ($encrypted['sha256'] ?? '')],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            ),
            LOCK_EX
        );

        return [
            'path' => $path,
            'relativePath' => $fileName,
            'sha256' => (string) ($encrypted['sha256'] ?? ''),
        ];
    }

    private function storageRoot(): string
    {
        return backup_receiver_storage_root();
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $items = scandir($path);
        if (!is_array($items)) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $target = $path . DIRECTORY_SEPARATOR . $item;
            if (is_dir($target)) {
                $this->removeDirectory($target);
                @rmdir($target);
                continue;
            }

            @unlink($target);
        }

        @rmdir($path);
    }
}
