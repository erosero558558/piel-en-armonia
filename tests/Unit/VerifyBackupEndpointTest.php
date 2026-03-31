<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class VerifyBackupEndpointTest extends TestCase
{
    private string $tempData;
    private string $tempStorage;
    private string $originalToken;

    protected function setUp(): void
    {
        $this->tempData = sys_get_temp_dir() . '/aurora-test-data-' . uniqid();
        $this->tempStorage = $this->tempData . '/offsite-receiver';
        @mkdir($this->tempStorage, 0777, true);

        $this->originalToken = getenv('AURORADERM_BACKUP_RECEIVER_TOKEN') ?: 'test-token-receiver';
        putenv('AURORADERM_BACKUP_RECEIVER_TOKEN=' . $this->originalToken);
        putenv('AURORADERM_DATA_DIR=' . $this->tempData);
        putenv('AURORADERM_BACKUP_RECEIVER_ENCRYPTION_KEY=' . str_repeat('k', 32));
    }

    protected function tearDown(): void
    {
        if (is_dir($this->tempData)) {
            $this->deleteTree($this->tempData);
        }
    }

    private function deleteTree(string $dir): void
    {
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            is_dir($path) ? $this->deleteTree($path) : unlink($path);
        }
        rmdir($dir);
    }

    private function invokeEndpoint(array $envVars = [], array $getVars = []): array
    {
        $targetFile = realpath(__DIR__ . '/../../verify-backup.php');

        $script = <<<PHP
<?php
\$envVars = json_decode(\$argv[1], true);
foreach (\$envVars as \$k => \$v) {
    if (\$v === null) {
        putenv(\$k);
        unset(\$_SERVER[\$k]);
        unset(\$_ENV[\$k]);
    } else {
        putenv("\$k=\$v");
        \$_SERVER[\$k] = \$v;
        \$_ENV[\$k] = \$v;
    }
}
\$getVars = json_decode(\$argv[2], true);
\$_GET = \$getVars;

register_shutdown_function(function() {
    \$code = http_response_code();
    // In CLI mode if it's not set, it might be false. Default to 200.
    file_put_contents('php://stderr', "HTTP_CODE:" . (\$code ?: 200));
});

require '{$targetFile}';
PHP;

        $runnerFile = sys_get_temp_dir() . '/aurora_verify_runner_' . uniqid() . '.php';
        file_put_contents($runnerFile, $script);

        $fullEnv = array_merge(getenv(), $envVars);
        $fullEnv['REQUEST_METHOD'] = 'GET';
        // Mock AURORADERM_DATA_DIR directly in proc_open
        $fullEnv['AURORADERM_DATA_DIR'] = $this->tempData;
        $fullEnv['AURORADERM_BACKUP_RECEIVER_TOKEN'] = $this->originalToken;
        $fullEnv['AURORADERM_SKIP_ENV_FILE'] = '1';

        $process = proc_open(
            ['php', $runnerFile, json_encode($envVars), json_encode($getVars)],
            [
                1 => ['pipe', 'w'], // stdout
                2 => ['pipe', 'w'], // stderr
            ],
            $pipes,
            __DIR__,
            $fullEnv
        );

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        proc_close($process);
        @unlink($runnerFile);

        $statusCode = 200; // default
        if (preg_match('/HTTP_CODE:(\d+)/', $stderr, $matches)) {
            $statusCode = (int)$matches[1];
        }

        // Remove warnings from stdout in case there are deprecations or anything
        // JSON payload should be valid
        $payload = json_decode($stdout, true);
        return [
            'status' => $statusCode,
            'payload' => $payload,
            'stdout' => $stdout,
            'stderr' => $stderr
        ];
    }

    public function testAuthMissingReturns401(): void
    {
        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => null,
            'HTTP_X_BACKUP_TOKEN' => null,
            'HTTP_X_CRON_TOKEN' => null,
        ]);

        $this->assertEquals(401, $response['status']);
        $this->assertEquals('No autorizado', $response['payload']['error'] ?? '');
    }

    public function testAuthInvalidReturns403(): void
    {
        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer invalid-token'
        ]);

        $this->assertEquals(403, $response['status']);
        $this->assertEquals('No autorizado', $response['payload']['error'] ?? '');
    }

    public function testPathTraversalReturns400(): void
    {
        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->originalToken,
        ], [
            'file' => '../../etc/passwd'
        ]);

        $this->assertEquals(400, $response['status']);
        $this->assertEquals('invalid_file', $response['payload']['code'] ?? '');
    }

    public function testStorageNotFoundReturns500(): void
    {
        $this->deleteTree($this->tempData);

        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->originalToken,
        ]);

        $this->assertEquals(500, $response['status']);
        $this->assertEquals('storage_not_found', $response['payload']['code'] ?? '');
    }

    public function testNoBackupFilesReturns404(): void
    {
        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->originalToken,
        ]);

        $this->assertEquals(404, $response['status']);
        $this->assertEquals('no_backup_files', $response['payload']['code'] ?? '');
    }

    private function createDummyEncryptedFile(bool $validChecksum): string
    {
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/backup/BackupCrypto.php';

        $filename = 'test-backup.enc';
        $fullPath = $this->tempStorage . '/' . $filename;

        $encrypted = \BackupCrypto::receiverEncryptPayload('test-data');
        file_put_contents($fullPath, $encrypted['ciphertext']);

        $metaHash = $validChecksum ? $encrypted['sha256'] : str_repeat('a', 64);
        file_put_contents($fullPath . '.meta.json', json_encode(['sha256' => $metaHash]));

        return $filename;
    }

    public function testChecksumOkReturns200(): void
    {
        $file = $this->createDummyEncryptedFile(true);

        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->originalToken,
        ], [
            'file' => $file
        ]);

        $this->assertEquals(200, $response['status']);
        $this->assertTrue($response['payload']['ok'] ?? false);
        $this->assertTrue($response['payload']['verification']['ok'] ?? false);
        $this->assertStringContainsString($file, $response['payload']['file'] ?? '');
    }

    public function testChecksumMismatchReturns409(): void
    {
        $file = $this->createDummyEncryptedFile(false);

        $response = $this->invokeEndpoint([
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->originalToken,
        ], [
            'file' => $file
        ]);

        $this->assertEquals(409, $response['status']);
        $this->assertFalse($response['payload']['ok'] ?? true);
        $this->assertEquals('metadata_checksum_mismatch', $response['payload']['verification']['reason'] ?? '');
    }
}
